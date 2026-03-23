import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── GET /dashboard/stats — nutritionist only ───────────────────────────────
// Returns: meals_today, pending_feedback, avg_adherence (last 7 days)
router.get('/stats', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  // Resolve all client IDs for this nutritionist
  const { data: clientProfiles } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('nutritionist_id', req.userId!)
    .eq('role', 'client');

  const clientIds = clientProfiles?.map((p) => p.user_id) ?? [];

  if (clientIds.length === 0) {
    res.json({ meals_today: 0, pending_feedback: 0, avg_adherence: null });
    return;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [todayResult, pendingResult, adherenceResult] = await Promise.all([
    // Meals registered today
    supabase
      .from('meals')
      .select('*', { count: 'exact', head: true })
      .in('client_id', clientIds)
      .gte('eaten_at', todayStart.toISOString()),

    // Meals with AI draft ready, waiting for nutritionist
    supabase
      .from('meals')
      .select('*', { count: 'exact', head: true })
      .in('client_id', clientIds)
      .eq('feedback_status', 'draft'),

    // AI scores over last 7 days for average adherence
    supabase
      .from('meals')
      .select('ai_analysis')
      .in('client_id', clientIds)
      .gte('eaten_at', sevenDaysAgo.toISOString())
      .not('ai_analysis', 'is', null),
  ]);

  const scores = (adherenceResult.data ?? [])
    .map((m) => (m.ai_analysis as { score?: number } | null)?.score)
    .filter((s): s is number => typeof s === 'number');

  const avg_adherence =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

  res.json({
    meals_today:      todayResult.count ?? 0,
    pending_feedback: pendingResult.count ?? 0,
    avg_adherence,
  });
});

export default router;
