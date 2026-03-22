import { Router } from 'express';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

// GET /clients - list nutritionist's clients (nutritionist only)
router.get('/', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      meals(count)
    `)
    .eq('nutritionist_id', req.userId!)
    .eq('role', 'client')
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch clients' });
    return;
  }
  res.json(data);
});

// GET /clients/:clientId - get client details + recent meals
router.get('/:clientId', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { clientId } = req.params;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', clientId)
    .eq('nutritionist_id', req.userId!)
    .single();

  if (profileError || !profile) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('*')
    .eq('client_id', clientId)
    .order('eaten_at', { ascending: false })
    .limit(30);

  if (mealsError) {
    res.status(500).json({ error: 'Failed to fetch meals' });
    return;
  }

  res.json({ profile, meals });
});

// POST /clients/invite - generate invite code (nutritionist only)
router.post('/invite', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const code = nanoid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const { data, error } = await supabase
    .from('invites')
    .insert({
      code,
      nutritionist_id: req.userId!,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to create invite' });
    return;
  }
  res.json({ code: data.code, expires_at: data.expires_at });
});

// POST /clients/join - client uses invite code to link to nutritionist
const joinSchema = z.object({ code: z.string().length(8) });

router.post('/join', requireAuth, requireRole('client'), async (req: AuthRequest, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid invite code format' });
    return;
  }

  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('*')
    .eq('code', parsed.data.code)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (inviteError || !invite) {
    res.status(404).json({ error: 'Invalid or expired invite code' });
    return;
  }

  // Link client to nutritionist
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ nutritionist_id: invite.nutritionist_id, updated_at: new Date().toISOString() })
    .eq('user_id', req.userId!);

  if (updateError) {
    res.status(500).json({ error: 'Failed to join nutritionist' });
    return;
  }

  // Mark invite as used
  await supabase
    .from('invites')
    .update({ used_by: req.userId! })
    .eq('id', invite.id);

  res.json({ message: 'Successfully linked to nutritionist' });
});

export default router;
