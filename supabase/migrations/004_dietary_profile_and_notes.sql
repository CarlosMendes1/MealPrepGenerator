-- NutriDesk: Dietary profile fields + nutritionist internal notes

-- ─────────────────────────────────────────
-- PROFILES: add dietary / lifestyle fields
-- ─────────────────────────────────────────
alter table public.profiles
  add column if not exists allergies           text,            -- e.g. "Amendoins, marisco"
  add column if not exists intolerances        text,            -- e.g. "Lactose, glúten"
  add column if not exists dietary_preferences text,            -- e.g. "Vegetariano, sem glúten"
  add column if not exists lifestyle_notes     text;            -- free-text: work schedule, habits, etc.

-- ─────────────────────────────────────────
-- NUTRITIONIST NOTES (internal, not visible to clients)
-- ─────────────────────────────────────────
create table if not exists public.nutritionist_notes (
  id               uuid primary key default uuid_generate_v4(),
  nutritionist_id  uuid not null references auth.users(id) on delete cascade,
  client_id        uuid not null references auth.users(id) on delete cascade,
  content          text not null check (char_length(content) >= 1 and char_length(content) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists notes_nutritionist_client_idx
  on public.nutritionist_notes(nutritionist_id, client_id, created_at desc);

-- RLS: only the nutritionist who created the note can access it
alter table public.nutritionist_notes enable row level security;

create policy "nutritionists_manage_own_notes"
  on public.nutritionist_notes
  for all
  using  (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());
