-- ─────────────────────────────────────────────────────────────────────────────
-- 007 — AI Nutrition Coach
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Feature flag on client profiles ───────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_coach_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_coach_subscription_id text;

-- ── 2. Coach feedback on meals (auto-generated after each meal) ───────────────
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS coach_feedback text;

-- ── 3. Chat history ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_messages_user_created_idx
  ON coach_messages (user_id, created_at DESC);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

-- Clients can read and write their own messages only
CREATE POLICY "coach_messages_own_select"
  ON coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "coach_messages_own_insert"
  ON coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role (API) can bypass RLS as usual
