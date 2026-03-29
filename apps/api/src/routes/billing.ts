import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../services/supabase.js';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
});

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

// ── Price IDs (set in .env, created in Stripe dashboard) ─────────────────────
// STRIPE_PRICE_PRO_MONTHLY        — €19/mês individual
// STRIPE_PRICE_PRO_ANNUAL         — €190/ano individual
// STRIPE_PRICE_ENTERPRISE_MONTHLY — €15/licença/mês (per-seat)
// STRIPE_PRICE_ENTERPRISE_ANNUAL  — €12/licença/mês anual (per-seat)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateCustomer(userId: string, email: string, name: string) {
  // Check if we already have a Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  // Create a new Stripe customer
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
// Creates a Stripe Checkout session for individual plans (Pro Monthly / Pro Annual)
router.post(
  '/individual/checkout',
  requireAuth,
  requireRole('nutritionist'),
  async (req: AuthRequest, res: Response) => {
    const { plan } = req.body as { plan: 'pro_monthly' | 'pro_annual' };

    const priceId =
      plan === 'pro_monthly'
        ? process.env.STRIPE_PRICE_PRO_MONTHLY
        : process.env.STRIPE_PRICE_PRO_ANNUAL;

    if (!priceId) {
      res.status(500).json({ error: 'Stripe price not configured' });
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, stripe_customer_id, stripe_subscription_id, individual_plan')
      .eq('user_id', req.user!.id)
      .single();

    // Already has active subscription → redirect to portal
    if (profile?.stripe_subscription_id) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id!,
        return_url: `${WEB_URL}/dashboard/settings`,
      });
      res.json({ url: portalSession.url });
      return;
    }

    const customerId = await getOrCreateCustomer(
      req.user!.id,
      req.user!.email,
      profile?.full_name ?? req.user!.email,
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
          supabase_user_id: req.user!.id,
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
// Creates a Stripe Checkout session for enterprise (per-seat)
router.post(
  '/enterprise/checkout',
  requireAuth,
  requireRole('nutritionist'),
  async (req: AuthRequest, res: Response) => {
    const { org_id, billing_interval, seats } = req.body as {
      org_id: string;
      billing_interval: 'monthly' | 'annual';
      seats: number;
    };

    if (!org_id || !billing_interval || !seats || seats < 2) {
      res.status(400).json({ error: 'org_id, billing_interval and seats (min 2) are required' });
      return;
    }

    // Confirm requester is org owner
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org_id)
      .eq('user_id', req.user!.id)
      .not('joined_at', 'is', null)
      .maybeSingle();

    if (!member || member.role !== 'owner') {
      res.status(403).json({ error: 'Only the org owner can manage billing' });
      return;
    }

    const priceId =
      billing_interval === 'monthly'
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

    const customerId = await getOrCreateOrgCustomer(org_id, req.user!.email, org.name);

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
// Returns a Stripe Customer Portal URL to manage subscriptions
router.post(
  '/portal',
  requireAuth,
  requireRole('nutritionist'),
  async (req: AuthRequest, res: Response) => {
    const { context, org_id } = req.body as { context: 'individual' | 'enterprise'; org_id?: string };

    let customerId: string | null = null;
    let returnUrl = `${WEB_URL}/dashboard/settings`;

    if (context === 'enterprise' && org_id) {
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
        .eq('user_id', req.user!.id)
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

// ── POST /api/billing/webhook ─────────────────────────────────────────────────
// Stripe sends events here. Must use raw body (no JSON middleware).
export function billingWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).send('Webhook Error');
    return;
  }

  handleStripeEvent(event).catch((e) =>
    console.error('Stripe webhook handler error:', e)
  );

  res.json({ received: true });
}

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {

    // ── Checkout completed ─────────────────────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;

      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      await activateSubscription(sub);
      break;
    }

    // ── Subscription updated (plan change, renewal, trial end) ────────────
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await activateSubscription(sub);
      break;
    }

    // ── Subscription cancelled ────────────────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.supabase_org_id;
      const userId = sub.metadata?.supabase_user_id;

      if (orgId) {
        await supabase
          .from('organizations')
          .update({
            subscription_status: 'cancelled',
            stripe_subscription_id: null,
          })
          .eq('id', orgId);
      } else if (userId) {
        await supabase
          .from('profiles')
          .update({
            individual_plan: 'free',
            stripe_subscription_id: null,
          })
          .eq('user_id', userId);
      }
      break;
    }

    // ── Payment failed ─────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const orgId  = (invoice.subscription_details?.metadata as Record<string,string>)?.supabase_org_id;
      const userId = (invoice.subscription_details?.metadata as Record<string,string>)?.supabase_user_id;

      if (orgId) {
        await supabase
          .from('organizations')
          .update({ subscription_status: 'past_due' })
          .eq('id', orgId);
      } else if (userId) {
        await supabase
          .from('profiles')
          .update({ individual_plan: 'free' })
          .eq('user_id', userId);
      }
      break;
    }

    default:
      break;
  }
}

async function activateSubscription(sub: Stripe.Subscription) {
  const orgId  = sub.metadata?.supabase_org_id;
  const userId = sub.metadata?.supabase_user_id;
  const plan   = sub.metadata?.plan as string;
  const seats  = sub.metadata?.seats ? parseInt(sub.metadata.seats, 10) : undefined;

  const status = sub.status === 'active' || sub.status === 'trialing'
    ? 'active'
    : sub.status === 'past_due'
    ? 'past_due'
    : 'cancelled';

  if (orgId) {
    await supabase
      .from('organizations')
      .update({
        subscription_status: status,
        stripe_subscription_id: sub.id,
        ...(seats ? { max_members: seats } : {}),
        billing_interval: sub.metadata?.billing_interval ?? 'monthly',
      })
      .eq('id', orgId);
  } else if (userId) {
    const individual_plan =
      plan === 'pro_annual' ? 'pro_annual' :
      plan === 'pro_monthly' ? 'pro_monthly' :
      'free';

    await supabase
      .from('profiles')
      .update({
        individual_plan,
        stripe_subscription_id: sub.id,
      })
      .eq('user_id', userId);
  }
}

export default router;
