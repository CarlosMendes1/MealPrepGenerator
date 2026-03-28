import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const consultationSchema = z.object({
  client_id:    z.string().uuid().nullable().optional(),
  client_name:  z.string().min(1).max(120).optional(),
  scheduled_at: z.string().datetime(),
  duration_min: z.number().int().min(15).max(480).default(60),
  type:         z.enum(['video', 'whatsapp', 'in_person']).default('video'),
  meeting_link: z.string().url().nullable().optional(),
  notes:        z.string().max(1000).nullable().optional(),
  status:       z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).default('scheduled'),
});

// ── GET /consultations?from=&to= ───────────────────────────────────────────────

router.get('/', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const from = req.query.from as string | undefined;
  const to   = req.query.to   as string | undefined;

  let query = supabase
    .from('consultations')
    .select(`
      id, client_id, client_name, scheduled_at, duration_min,
      type, meeting_link, status, notes, created_at,
      profiles!consultations_client_id_fkey(full_name)
    `)
    .eq('nutritionist_id', req.userId!)
    .order('scheduled_at', { ascending: true });

  if (from) query = query.gte('scheduled_at', from);
  if (to)   query = query.lte('scheduled_at', to);

  const { data, error } = await query;
  if (error) {
    console.error('[GET /consultations]', error.message);
    res.status(500).json({ error: 'Failed to fetch consultations' });
    return;
  }

  // Flatten client name: prefer profile full_name, fallback to client_name field
  const result = (data ?? []).map((c: any) => ({
    ...c,
    client_display_name: (c.profiles as any)?.full_name ?? c.client_name ?? 'Cliente sem nome',
    profiles: undefined,
  }));

  res.json(result);
});

// ── POST /consultations ────────────────────────────────────────────────────────

router.post('/', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const parsed = consultationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { data, error } = await supabase
    .from('consultations')
    .insert({ ...parsed.data, nutritionist_id: req.userId! })
    .select()
    .single();

  if (error) {
    console.error('[POST /consultations]', error.message);
    res.status(500).json({ error: 'Failed to create consultation' });
    return;
  }

  res.status(201).json(data);
});

// ── PATCH /consultations/:id ───────────────────────────────────────────────────

router.patch('/:id', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const parsed = consultationSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { data, error } = await supabase
    .from('consultations')
    .update(parsed.data)
    .eq('id', req.params.id)
    .eq('nutritionist_id', req.userId!)
    .select()
    .single();

  if (error || !data) { res.status(404).json({ error: 'Consultation not found' }); return; }
  res.json(data);
});

// ── DELETE /consultations/:id ─────────────────────────────────────────────────

router.delete('/:id', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { error } = await supabase
    .from('consultations')
    .delete()
    .eq('id', req.params.id)
    .eq('nutritionist_id', req.userId!);

  if (error) { res.status(404).json({ error: 'Consultation not found' }); return; }
  res.json({ success: true });
});

export default router;
