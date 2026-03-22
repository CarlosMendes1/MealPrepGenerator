import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  age: z.number().int().min(10).max(120).optional(),
  weight_kg: z.number().min(20).max(300).optional(),
  height_cm: z.number().min(100).max(250).optional(),
  body_fat_pct: z.number().min(1).max(60).optional(),
  goal: z.enum(['lose_weight', 'gain_muscle', 'maintain', 'improve_health']).optional(),
});

// GET /profile - get own profile
router.get('/', async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', req.userId!)
    .single();

  if (error) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json(data);
});

// PATCH /profile - update own profile
router.patch('/', async (req: AuthRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('user_id', req.userId!)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update profile' });
    return;
  }
  res.json(data);
});

export default router;
