import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function getUserOrgMembership(userId: string) {
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id, role, joined_at, organizations(id, name, slug, plan, billing_interval, subscription_status, max_members, trial_ends_at)')
    .eq('user_id', userId)
    .not('joined_at', 'is', null)
    .maybeSingle();
  return data;
}

async function assertOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .in('role', ['owner', 'admin'])
    .not('joined_at', 'is', null)
    .maybeSingle();
  return !!data;
}

// ── GET /organizations/mine ─────────────────────────────────────────────────────

router.get('/mine', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const membership = await getUserOrgMembership(req.userId!);
  if (!membership) { res.json(null); return; }
  res.json(membership);
});

// ── POST /organizations — create org ──────────────────────────────────────────

const createOrgSchema = z.object({
  name:             z.string().min(2).max(80),
  billing_interval: z.enum(['monthly', 'annual']).default('monthly'),
  max_members:      z.number().int().min(2).max(200).default(5),
});

router.post('/', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { name, billing_interval, max_members } = parsed.data;

  // Ensure user is not already in an org
  const existing = await getUserOrgMembership(req.userId!);
  if (existing) { res.status(409).json({ error: 'Already a member of an organization.' }); return; }

  // Create unique slug
  let slug = makeSlug(name);
  const { count } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug);
  if ((count ?? 0) > 0) slug = `${slug}-${randomBytes(2).toString('hex')}`;

  // Create org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, slug, owner_id: req.userId!, billing_interval, max_members })
    .select()
    .single();

  if (orgError || !org) {
    console.error('[POST /organizations]', orgError?.message);
    res.status(500).json({ error: 'Failed to create organization' });
    return;
  }

  // Fetch creator's email and name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', req.userId!)
    .single();

  const { data: { user } } = await supabase.auth.admin.getUserById(req.userId!);

  // Add creator as owner member
  await supabase.from('organization_members').insert({
    organization_id: org.id,
    user_id:         req.userId!,
    role:            'owner',
    invited_email:   user?.email ?? '',
    joined_at:       new Date().toISOString(),
  });

  res.status(201).json(org);
});

// ── GET /organizations/:id/members ────────────────────────────────────────────

router.get('/:orgId/members', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { orgId } = req.params;

  // Must be a member of this org
  const { data: self } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', req.userId!)
    .maybeSingle();

  if (!self) { res.status(403).json({ error: 'Not a member of this organization.' }); return; }

  // Get all members (including pending invites)
  const { data: members, error } = await supabase
    .from('organization_members')
    .select('id, user_id, role, invited_email, joined_at, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });

  if (error) { res.status(500).json({ error: 'Failed to fetch members' }); return; }

  // Enrich with profile data + stats
  const enriched = await Promise.all((members ?? []).map(async (m) => {
    if (!m.user_id) return { ...m, full_name: null, client_count: 0, avg_adherence: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', m.user_id)
      .single();

    const { count: clientCount } = await supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('nutritionist_id', m.user_id)
      .eq('organization_id', orgId)
      .eq('role', 'client');

    // Avg adherence last 7 days
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: meals } = await supabase
      .from('meals')
      .select('ai_analysis')
      .eq('nutritionist_id', m.user_id)
      .gte('eaten_at', since)
      .not('ai_analysis', 'is', null);

    const scores = (meals ?? [])
      .map((meal: any) => meal.ai_analysis?.score)
      .filter((s: any) => typeof s === 'number');

    const avg_adherence = scores.length
      ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
      : null;

    return { ...m, full_name: profile?.full_name ?? null, client_count: clientCount ?? 0, avg_adherence };
  }));

  res.json(enriched);
});

// ── POST /organizations/:id/invitations ───────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email(),
  role:  z.enum(['admin', 'member']).default('member'),
});

router.post('/:orgId/invitations', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { orgId } = req.params;

  const isAdmin = await assertOrgAdmin(req.userId!, orgId);
  if (!isAdmin) { res.status(403).json({ error: 'Admin access required.' }); return; }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, role } = parsed.data;

  // Check org member limit
  const { data: org } = await supabase
    .from('organizations')
    .select('max_members')
    .eq('id', orgId)
    .single();

  const { count: currentCount } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .not('joined_at', 'is', null);

  if ((currentCount ?? 0) >= (org?.max_members ?? 5)) {
    res.status(409).json({ error: 'License limit reached. Upgrade to add more members.' });
    return;
  }

  // Check if already a member or has pending invite
  const { data: existing } = await supabase
    .from('organization_members')
    .select('id, joined_at')
    .eq('organization_id', orgId)
    .eq('invited_email', email.toLowerCase())
    .maybeSingle();

  if (existing?.joined_at) {
    res.status(409).json({ error: 'This person is already a member.' });
    return;
  }

  const token = randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();

  if (existing) {
    // Refresh existing pending invite
    await supabase
      .from('organization_members')
      .update({ invite_token: token, invite_expires_at: expires, role })
      .eq('id', existing.id);
  } else {
    await supabase.from('organization_members').insert({
      organization_id:  orgId,
      role,
      invited_email:    email.toLowerCase(),
      invite_token:     token,
      invite_expires_at: expires,
    });
  }

  res.status(201).json({ token, invite_url: `/accept-invitation/${token}` });
});

// ── GET /invitations/:token — get invite info ─────────────────────────────────

router.get('/invitations/:token', async (req, res) => {
  const { token } = req.params;

  const { data: invite, error } = await supabase
    .from('organization_members')
    .select('id, role, invited_email, invite_expires_at, organizations(id, name, slug)')
    .eq('invite_token', token)
    .is('joined_at', null)
    .maybeSingle();

  if (error || !invite) { res.status(404).json({ error: 'Invite not found or already used.' }); return; }

  if (new Date(invite.invite_expires_at) < new Date()) {
    res.status(410).json({ error: 'This invite has expired.' });
    return;
  }

  res.json(invite);
});

// ── POST /invitations/:token/accept ───────────────────────────────────────────

router.post('/invitations/:token/accept', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { token } = req.params;

  const { data: invite, error } = await supabase
    .from('organization_members')
    .select('id, organization_id, invited_email, invite_expires_at')
    .eq('invite_token', token)
    .is('joined_at', null)
    .maybeSingle();

  if (error || !invite) { res.status(404).json({ error: 'Invite not found or already used.' }); return; }
  if (new Date(invite.invite_expires_at) < new Date()) {
    res.status(410).json({ error: 'This invite has expired.' });
    return;
  }

  // Accept
  const { error: updateError } = await supabase
    .from('organization_members')
    .update({ user_id: req.userId!, joined_at: new Date().toISOString(), invite_token: null })
    .eq('id', invite.id);

  if (updateError) { res.status(500).json({ error: 'Failed to accept invite.' }); return; }

  res.json({ success: true, organization_id: invite.organization_id });
});

// ── PATCH /organizations/:id/members/:userId — change role ────────────────────

router.patch('/:orgId/members/:memberId', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { orgId, memberId } = req.params;
  const { role } = z.object({ role: z.enum(['admin', 'member']) }).parse(req.body);

  const isAdmin = await assertOrgAdmin(req.userId!, orgId);
  if (!isAdmin) { res.status(403).json({ error: 'Admin access required.' }); return; }

  // Cannot change owner role
  const { data: target } = await supabase
    .from('organization_members')
    .select('role')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single();

  if (!target) { res.status(404).json({ error: 'Member not found.' }); return; }
  if (target.role === 'owner') { res.status(403).json({ error: 'Cannot change owner role.' }); return; }

  await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', memberId);

  res.json({ success: true });
});

// ── DELETE /organizations/:id/members/:memberId — remove member ───────────────

router.delete('/:orgId/members/:memberId', requireAuth, requireRole('nutritionist'), async (req: AuthRequest, res) => {
  const { orgId, memberId } = req.params;

  const isAdmin = await assertOrgAdmin(req.userId!, orgId);
  if (!isAdmin) { res.status(403).json({ error: 'Admin access required.' }); return; }

  const { data: target } = await supabase
    .from('organization_members')
    .select('role')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single();

  if (!target) { res.status(404).json({ error: 'Member not found.' }); return; }
  if (target.role === 'owner') { res.status(403).json({ error: 'Cannot remove the owner.' }); return; }

  await supabase.from('organization_members').delete().eq('id', memberId);

  res.json({ success: true });
});

export default router;
