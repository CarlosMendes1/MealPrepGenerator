import { Router } from 'express';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

// Max active (unused, non-expired) invite codes per nutritionist.
const MAX_ACTIVE_INVITES = 10;

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── GET /clients — list nutritionist's clients (paginated) ─────────────────
router.get('/', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const pagination = paginationSchema.safeParse(req.query);
  if (!pagination.success) {
    res.status(400).json({ error: pagination.error.flatten() });
    return;
  }
  const { limit, offset } = pagination.data;

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, age, weight_kg, goal, created_at')
    .eq('nutritionist_id', req.userId!)
    .eq('role', 'client')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[GET /clients] Supabase error:', error.message);
    res.status(500).json({ error: 'Failed to fetch clients' });
    return;
  }

  // Fetch meal counts per client in parallel
  const clientsWithCounts = await Promise.all(
    (data ?? []).map(async (client) => {
      const { count } = await supabase
        .from('meals')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.user_id);
      return { ...client, meals: [{ count: count ?? 0 }] };
    })
  );

  res.json(clientsWithCounts);
});

// ── GET /clients/:clientId — client detail + recent meals ──────────────────
router.get('/:clientId', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { clientId } = req.params;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, full_name, age, weight_kg, height_cm, body_fat_pct, goal, created_at')
    .eq('user_id', clientId)
    .eq('nutritionist_id', req.userId!)
    .single();

  if (profileError || !profile) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('id, photo_url, meal_type, eaten_at, feedback_status, ai_analysis, ai_feedback_draft, nutritionist_feedback')
    .eq('client_id', clientId)
    .order('eaten_at', { ascending: false })
    .limit(30);

  if (mealsError) {
    res.status(500).json({ error: 'Failed to fetch meals' });
    return;
  }

  res.json({ profile, meals });
});

// ── POST /clients/invite — generate invite code (nutritionist only) ────────
router.post('/invite', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  // Prevent abuse: cap active invites per nutritionist.
  const { count, error: countError } = await supabase
    .from('invites')
    .select('*', { count: 'exact', head: true })
    .eq('nutritionist_id', req.userId!)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString());

  if (countError) {
    res.status(500).json({ error: 'Failed to check invite limit' });
    return;
  }

  if ((count ?? 0) >= MAX_ACTIVE_INVITES) {
    res.status(429).json({
      error: `Maximum of ${MAX_ACTIVE_INVITES} active invite codes allowed. Wait for existing ones to expire or be used.`,
    });
    return;
  }

  const code = nanoid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('invites')
    .insert({ code, nutritionist_id: req.userId!, expires_at: expiresAt })
    .select('code, expires_at')
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to create invite' });
    return;
  }
  res.json({ code: data.code, expires_at: data.expires_at });
});

// ── POST /clients/join — client uses invite code ───────────────────────────
const joinSchema = z.object({
  code: z.string().length(8).regex(/^[A-Z2-9]+$/, 'Invalid code format'),
});

router.post('/join', requireAuth, requireRole('client'), async (req: AuthRequest, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid invite code format' });
    return;
  }

  // Prevent client from switching nutritionist silently.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('nutritionist_id')
    .eq('user_id', req.userId!)
    .single();

  if (existingProfile?.nutritionist_id) {
    res.status(409).json({ error: 'You are already linked to a nutritionist. Contact support to change.' });
    return;
  }

  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('id, nutritionist_id')
    .eq('code', parsed.data.code)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (inviteError || !invite) {
    res.status(404).json({ error: 'Invalid or expired invite code' });
    return;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ nutritionist_id: invite.nutritionist_id, updated_at: new Date().toISOString() })
    .eq('user_id', req.userId!);

  if (updateError) {
    res.status(500).json({ error: 'Failed to join nutritionist' });
    return;
  }

  // Mark invite as used — ignore error (non-fatal, invite won't be reusable anyway via .is('used_by', null))
  await supabase
    .from('invites')
    .update({ used_by: req.userId! })
    .eq('id', invite.id);

  res.json({ message: 'Successfully linked to nutritionist' });
});

export default router;
