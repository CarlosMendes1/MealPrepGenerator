-- ─────────────────────────────────────────────────────────────────────────────
-- 008 — Custom calorie target on profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS calorie_target integer CHECK (calorie_target BETWEEN 800 AND 5000);
