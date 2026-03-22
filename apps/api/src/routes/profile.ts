import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Columns safe to return — never expose internal/system fields.
const PROFILE_COLUMNS =
  'user_id, role, full_name, age, weight_kg, height_cm, body_fat_pct, goal, nutritionist_id, created_at, updated_at';

const profileSchema = z.object({
  full_name: z.string().min(1).max(100).trim().optional(),
  age: z.number().int().min(10).max(120).optional(),
  weight_kg: z.number().min(20).max(300).optional(),
  height_cm: z.number().min(100).max(250).optional(),
  body_fat_pct: z.number().min(1).max(60).optional(),
  goal: z.enum(['lose_weight', 'gain_muscle', 'maintain', 'improve_health']).optional(),
});

// ── GET /profile ──────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', req.userId!)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json(data);
});

// ── PATCH /profile ────────────────────────────────────────────────────────
router.patch('/', async (req: AuthRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('user_id', req.userId!)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update profile' });
    return;
  }
  res.json(data);
});

export default router;
