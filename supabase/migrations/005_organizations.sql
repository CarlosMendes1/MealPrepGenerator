-- ── Organizations ─────────────────────────────────────────────────────────────

CREATE TABLE organizations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  slug                  text UNIQUE NOT NULL,
  owner_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan                  text NOT NULL DEFAULT 'enterprise',
  billing_interval      text NOT NULL DEFAULT 'monthly',
  subscription_status   text NOT NULL DEFAULT 'trial',
  stripe_customer_id    text,
  stripe_subscription_id text,
  max_members           int  NOT NULL DEFAULT 5,
  trial_ends_at         timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Organization members ──────────────────────────────────────────────────────

CREATE TABLE organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member',   -- owner | admin | member
  invited_email   text NOT NULL,
  invite_token    text UNIQUE,
  invite_expires_at timestamptz,
  joined_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- ── Extend profiles ───────────────────────────────────────────────────────────
-- organization_id: only set on CLIENT profiles (which org they belong to)
-- individual_plan: only relevant for nutritionist profiles without a team

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS organization_id         uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS individual_plan         text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations: visible to members
CREATE POLICY "org_visible_to_members"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_owner_can_update"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "authenticated_can_create_org"
  ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Members: visible to co-members; anyone can read an invite by token
CREATE POLICY "members_visible_to_co_members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR invite_token IS NOT NULL
  );

-- Admins/owners can insert/update/delete members
CREATE POLICY "admins_manage_members"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Allow invited user to update their own pending invite (accept)
CREATE POLICY "accept_own_invite"
  ON organization_members FOR UPDATE
  USING (
    invite_token IS NOT NULL
    AND invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_org_members_org   ON organization_members(organization_id);
CREATE INDEX idx_org_members_user  ON organization_members(user_id);
CREATE INDEX idx_org_members_token ON organization_members(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX idx_profiles_org      ON profiles(organization_id) WHERE organization_id IS NOT NULL;
