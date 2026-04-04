import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
});

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

// ── Input schemas ─────────────────────────────────────────────────────────────

const individualCheckoutSchema = z.object({
  plan: z.enum(['pro_monthly', 'pro_annual']),
});

const enterpriseCheckoutSchema = z.object({
  org_id:           z.string().uuid(),
  billing_interval: z.enum(['monthly', 'annual']),
  seats:            z.number().int().min(2).max(200),
});

const portalSchema = z.object({
  context: z.enum(['individual', 'enterprise']),
  org_id:  z.string().uuid().optional(),
});

const coachCheckoutSchema = z.object({
  plan: z.enum(['coach_monthly', 'coach_annual']),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateCustomer(userId: string, email: string, name: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { supabase_user_id: userId },
  });

  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('user_id', userId);

  return customer.id;
}

async function getOrCreateOrgCustomer(orgId: string, ownerEmail: string, orgName: string) {
  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', orgId)
    .single();

  if (org?.stripe_customer_id) {
    return org.stripe_customer_id as string;
  }

  const customer = await stripe.customers.create({
    email: ownerEmail,
    name: orgName,
    metadata: { supabase_org_id: orgId },
  });

  await supabase
    .from('organizations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', orgId);

  return customer.id;
}

// ── POST /api/billing/individual/checkout ─────────────────────────────────────
router.post(
  '/individual/checkout',
  requireAuth,
  requireRole('nutritionist'),
  async (req: AuthRequest, res: Response) => {
    const parsed = individualCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { plan } = parsed.data;

    const priceId = plan === 'pro_monthly'
      ? process.env.STRIPE_PRICE_PRO_MONTHLY
      : process.env.STRIPE_PRICE_PRO_ANNUAL;

    if (!priceId) {
      res.status(500).json({ error: 'Stripe price not configured' });
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', req.userId!)
      .single();

    // Already subscribed → portal
    if (profile?.stripe_subscription_id) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id!,
        return_url: `${WEB_URL}/dashboard/settings`,
      });
      res.json({ url: portalSession.url });
      return;
    }

    const email = req.userEmail ?? '';
    const customerId = await getOrCreateCustomer(
      req.userId!,
      email,
      profile?.full_name ?? email,
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card', 'multibanco', 'mb_way'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${WEB_URL}/dashboard/settings?billing=success`,
      cancel_url:  `${WEB_URL}/dashboard/settings?billing=cancel`,
      locale: 'pt',
      subscription_data: {
        metadata: {
          supabase_user_id: req.userId!,
          plan_type: 'individual',
          plan,
        },
      },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  }
);

// ── POST /api/billing/enterprise/checkout ─────────────────────────────────────
router.post(
  '/enterprise/checkout',
  requireAuth,
  requireRole('nutritionist'),
  async (req: AuthRequest, res: Response) => {
    const parsed = enterpriseCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { org_id, billing_interval, seats } = parsed.data;

    // Confirm requester is org owner
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org_id)
      .eq('user_id', req.userId!)
      .not('joined_at', 'is', null)
      .maybeSingle();

    if (!member || member.role !== 'owner') {
      res.status(403).json({ error: 'Only the org owner can manage billing' });
      return;
    }

    const priceId = billing_interval === 'monthly'
      ? process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY
      : process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL;

    if (!priceId) {
      res.status(500).json({ error: 'Stripe enterprise price not configured' });
      return;
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name, stripe_customer_id, stripe_subscription_id')
      .eq('id', org_id)
      .single();

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Already subscribed → portal
    if (org.stripe_subscription_id) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id!,
        return_url: `${WEB_URL}/dashboard/team`,
      });
      res.json({ url: portalSession.url });
      return;
    }

    const customerId = await getOrCreateOrgCustomer(
      org_id,
      req.userEmail ?? '',
      org.name,
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card', 'multibanco', 'mb_way'],
      line_items: [{ price: priceId, quantity: seats }],
      success_url: `${WEB_URL}/dashboard/team?billing=success`,
      cancel_url:  `${WEB_URL}/dashboard/team?billing=cancel`,
      locale: 'pt',
      subscription_data: {
        metadata: {
          supabase_org_id: org_id,
          plan_type: 'enterprise',
          billing_interval,
          seats: String(seats),
        },
      },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  }
);

// ── POST /api/billing/portal ──────────────────────────────────────────────────
router.post(
  '/portal',
  requireAuth,
  requireRole('nutritionist'),
  async (req: AuthRequest, res: Response) => {
    const parsed = portalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { context, org_id } = parsed.data;

    let customerId: string | null = null;
    let returnUrl = `${WEB_URL}/dashboard/settings`;

    if (context === 'enterprise' && org_id) {
      // Verify requester is actually a member of that org
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', org_id)
        .eq('user_id', req.userId!)
        .not('joined_at', 'is', null)
        .maybeSingle();

      if (!membership) {
        res.status(403).json({ error: 'Not a member of this organization' });
        return;
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', org_id)
        .single();
      customerId = org?.stripe_customer_id ?? null;
      returnUrl = `${WEB_URL}/dashboard/team`;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('user_id', req.userId!)
        .single();
      customerId = profile?.stripe_customer_id ?? null;
    }

    if (!customerId) {
      res.status(400).json({ error: 'No active subscription found' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    res.json({ url: session.url });
  }
);

// ── POST /api/billing/coach/checkout ─────────────────────────────────────────
router.post(
  '/coach/checkout',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parsed = coachCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { plan } = parsed.data;

    const priceId = plan === 'coach_annual'
      ? process.env.STRIPE_PRICE_AI_COACH_ANNUAL
      : process.env.STRIPE_PRICE_AI_COACH_MONTHLY;

    if (!priceId) {
      res.status(500).json({ error: 'Stripe AI Coach price not configured' });
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, stripe_customer_id, stripe_coach_subscription_id')
      .eq('user_id', req.userId!)
      .single();

    // Already subscribed → portal
    if (profile?.stripe_coach_subscription_id) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id!,
        return_url: `${WEB_URL}/dashboard/settings?billing=coach_success`,
      });
      res.json({ url: portalSession.url });
      return;
    }

    const email = req.userEmail ?? '';
    const customerId = await getOrCreateCustomer(
      req.userId!,
      email,
      profile?.full_name ?? email,
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card', 'multibanco', 'mb_way'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${WEB_URL}/dashboard/settings?billing=coach_success`,
      cancel_url:  `${WEB_URL}/dashboard/settings?billing=cancel`,
      locale: 'pt',
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          supabase_user_id: req.userId!,
          plan_type: 'ai_coach',
          plan,
        },
      },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  }
);

// ── POST /api/billing/webhook ─────────────────────────────────────────────────
// Must use raw body — registered BEFORE json middleware in index.ts
export function billingWebhookHandler(req: Request, res: Response) {
  const sig    = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).send('Webhook Error');
    return;
  }

  // Handle asynchronously — always return 200 fast to avoid Stripe retries
  handleStripeEvent(event).catch((e) =>
    console.error('Stripe webhook handler error:', e)
  );

  res.json({ received: true });
}

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      await activateSubscription(sub);
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await activateSubscription(sub);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await deactivateSubscription(sub);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice  = event.data.object as Stripe.Invoice;
      const meta     = invoice.subscription_details?.metadata as Record<string, string> | undefined;
      const orgId    = meta?.supabase_org_id;
      const userId   = meta?.supabase_user_id;
      const planType = meta?.plan_type;

      if (orgId) {
        await supabase.from('organizations').update({ subscription_status: 'past_due' }).eq('id', orgId);
      } else if (userId) {
        if (planType === 'ai_coach') {
          await supabase.from('profiles').update({ ai_coach_enabled: false }).eq('user_id', userId);
        } else {
          await supabase.from('profiles').update({ individual_plan: 'free' }).eq('user_id', userId);
        }
      }
      break;
    }
    default:
      break;
  }
}

async function activateSubscription(sub: Stripe.Subscription) {
  const orgId    = sub.metadata?.supabase_org_id;
  const userId   = sub.metadata?.supabase_user_id;
  const plan     = sub.metadata?.plan as string;
  const planType = sub.metadata?.plan_type as string;
  const seats    = sub.metadata?.seats ? parseInt(sub.metadata.seats, 10) : undefined;

  const isActive = sub.status === 'active' || sub.status === 'trialing';
  const status   = isActive ? 'active' : sub.status === 'past_due' ? 'past_due' : 'cancelled';

  if (orgId) {
    await supabase.from('organizations').update({
      subscription_status: status,
      stripe_subscription_id: sub.id,
      ...(seats ? { max_members: seats } : {}),
      billing_interval: sub.metadata?.billing_interval ?? 'monthly',
    }).eq('id', orgId);
    return;
  }

  if (!userId) return;

  if (planType === 'ai_coach') {
    await supabase.from('profiles').update({
      ai_coach_enabled: isActive,
      stripe_coach_subscription_id: isActive ? sub.id : null,
    }).eq('user_id', userId);
    return;
  }

  const individual_plan =
    plan === 'pro_annual'  ? 'pro_annual'  :
    plan === 'pro_monthly' ? 'pro_monthly' :
    'free';

  await supabase.from('profiles').update({
    individual_plan,
    stripe_subscription_id: sub.id,
  }).eq('user_id', userId);
}

async function deactivateSubscription(sub: Stripe.Subscription) {
  const orgId    = sub.metadata?.supabase_org_id;
  const userId   = sub.metadata?.supabase_user_id;
  const planType = sub.metadata?.plan_type as string;

  if (orgId) {
    await supabase.from('organizations').update({
      subscription_status: 'cancelled',
      stripe_subscription_id: null,
    }).eq('id', orgId);
    return;
  }

  if (!userId) return;

  if (planType === 'ai_coach') {
    await supabase.from('profiles').update({
      ai_coach_enabled: false,
      stripe_coach_subscription_id: null,
    }).eq('user_id', userId);
  } else {
    await supabase.from('profiles').update({
      individual_plan: 'free',
      stripe_subscription_id: null,
    }).eq('user_id', userId);
  }
}

export default router;
