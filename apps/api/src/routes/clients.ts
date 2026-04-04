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

// ── GET /clients — list clients (?context=personal|team) ──────────────────────
router.get('/', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const pagination = paginationSchema.safeParse(req.query);
  if (!pagination.success) {
    res.status(400).json({ error: pagination.error.flatten() });
    return;
  }
  const { limit, offset } = pagination.data;
  const context = (req.query.context as string) ?? 'personal'; // 'personal' | 'team'

  let query = supabase
    .from('profiles')
    .select('user_id, full_name, age, weight_kg, goal, organization_id, nutritionist_id, created_at')
    .eq('role', 'client')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (context === 'team') {
    // Get user's org membership
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', req.userId!)
      .not('joined_at', 'is', null)
      .maybeSingle();

    if (!membership) {
      res.status(403).json({ error: 'Not a member of any organization.' });
      return;
    }

    query = query.eq('organization_id', membership.organization_id);

    // Members only see their own assigned clients
    if (membership.role === 'member') {
      query = query.eq('nutritionist_id', req.userId!);
    }
  } else {
    // Personal clients: assigned to this nutritionist with no org
    query = query
      .eq('nutritionist_id', req.userId!)
      .is('organization_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[GET /clients] Supabase error:', error.message);
    res.status(500).json({ error: 'Failed to fetch clients' });
    return;
  }

  // Single batch query for all meal counts — avoids N+1
  const clientIds = (data ?? []).map((c) => c.user_id);
  const { data: mealRows } = clientIds.length
    ? await supabase.from('meals').select('client_id').in('client_id', clientIds)
    : { data: [] };

  const mealCountMap = new Map<string, number>();
  for (const row of mealRows ?? []) {
    mealCountMap.set(row.client_id, (mealCountMap.get(row.client_id) ?? 0) + 1);
  }

  const clientsWithCounts = (data ?? []).map((client) => ({
    ...client,
    meals: [{ count: mealCountMap.get(client.user_id) ?? 0 }],
  }));

  res.json(clientsWithCounts);
});

// ── GET /clients/:clientId — client detail + recent meals ──────────────────
router.get('/:clientId', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { clientId } = req.params;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, full_name, age, weight_kg, height_cm, body_fat_pct, goal, allergies, intolerances, dietary_preferences, lifestyle_notes, created_at')
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

// ── Notes: shared helpers ──────────────────────────────────────────────────
const noteSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

// ── GET /clients/:clientId/notes ───────────────────────────────────────────
router.get('/:clientId/notes', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { clientId } = req.params;

  // Verify client belongs to this nutritionist
  const { data: check } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', clientId)
    .eq('nutritionist_id', req.userId!)
    .single();

  if (!check) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const { data, error } = await supabase
    .from('nutritionist_notes')
    .select('id, content, created_at, updated_at')
    .eq('nutritionist_id', req.userId!)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch notes' });
    return;
  }

  res.json(data ?? []);
});

// ── POST /clients/:clientId/notes ──────────────────────────────────────────
router.post('/:clientId/notes', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { clientId } = req.params;

  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { data: check } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', clientId)
    .eq('nutritionist_id', req.userId!)
    .single();

  if (!check) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const { data, error } = await supabase
    .from('nutritionist_notes')
    .insert({ nutritionist_id: req.userId!, client_id: clientId, content: parsed.data.content })
    .select('id, content, created_at, updated_at')
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to create note' });
    return;
  }

  res.status(201).json(data);
});

// ── PATCH /clients/:clientId/notes/:noteId ─────────────────────────────────
router.patch('/:clientId/notes/:noteId', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { clientId, noteId } = req.params;

  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { data, error } = await supabase
    .from('nutritionist_notes')
    .update({ content: parsed.data.content, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('nutritionist_id', req.userId!)
    .eq('client_id', clientId)
    .select('id, content, created_at, updated_at')
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  res.json(data);
});

// ── DELETE /clients/:clientId/notes/:noteId ────────────────────────────────
router.delete('/:clientId/notes/:noteId', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { clientId, noteId } = req.params;

  const { error } = await supabase
    .from('nutritionist_notes')
    .delete()
    .eq('id', noteId)
    .eq('nutritionist_id', req.userId!)
    .eq('client_id', clientId);

  if (error) {
    res.status(500).json({ error: 'Failed to delete note' });
    return;
  }

  res.status(204).end();
});

export default router;
