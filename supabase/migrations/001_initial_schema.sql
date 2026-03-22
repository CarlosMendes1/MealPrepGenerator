-- NutriDesk: Initial database schema
-- Run this in Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('nutritionist', 'client')) default 'client',
  full_name       text,
  age             smallint check (age >= 10 and age <= 120),
  weight_kg       numeric(5,2) check (weight_kg >= 20 and weight_kg <= 300),
  height_cm       numeric(5,1) check (height_cm >= 100 and height_cm <= 250),
  body_fat_pct    numeric(4,1) check (body_fat_pct >= 1 and body_fat_pct <= 60),
  goal            text check (goal in ('lose_weight', 'gain_muscle', 'maintain', 'improve_health')),
  nutritionist_id uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(user_id)
);

-- ─────────────────────────────────────────
-- MEALS
-- ─────────────────────────────────────────
create table if not exists public.meals (
  id                    uuid primary key default uuid_generate_v4(),
  client_id             uuid not null references auth.users(id) on delete cascade,
  photo_url             text not null,
  meal_type             text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  eaten_at              timestamptz not null default now(),
  ai_analysis           jsonb,
  ai_feedback_draft     text,
  nutritionist_feedback text,
  feedback_status       text not null check (feedback_status in ('pending_ai', 'draft', 'sent')) default 'pending_ai',
  created_at            timestamptz not null default now()
);

-- Index for efficient queries
create index if not exists meals_client_id_eaten_at_idx on public.meals(client_id, eaten_at desc);
create index if not exists meals_feedback_status_idx on public.meals(feedback_status);

-- ─────────────────────────────────────────
-- INVITES
-- ─────────────────────────────────────────
create table if not exists public.invites (
  id               uuid primary key default uuid_generate_v4(),
  code             text not null unique,
  nutritionist_id  uuid not null references auth.users(id) on delete cascade,
  used_by          uuid references auth.users(id) on delete set null,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);

create index if not exists invites_code_idx on public.invites(code);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────

-- Profiles RLS
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "users_read_own_profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Nutritionists can read their clients' profiles
create policy "nutritionists_read_client_profiles"
  on public.profiles for select
  using (
    nutritionist_id = auth.uid()
    or auth.uid() = user_id
  );

-- Users can update their own profile
create policy "users_update_own_profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Allow insert on sign up (handled by trigger or API with service role)
create policy "service_role_insert_profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- Meals RLS
alter table public.meals enable row level security;

-- Clients can see their own meals
create policy "clients_read_own_meals"
  on public.meals for select
  using (auth.uid() = client_id);

-- Nutritionists can see their clients' meals
create policy "nutritionists_read_client_meals"
  on public.meals for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = meals.client_id
        and profiles.nutritionist_id = auth.uid()
    )
  );

-- Clients can insert their own meals
create policy "clients_insert_own_meals"
  on public.meals for insert
  with check (auth.uid() = client_id);

-- Nutritionists can update feedback on their clients' meals
create policy "nutritionists_update_feedback"
  on public.meals for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = meals.client_id
        and profiles.nutritionist_id = auth.uid()
    )
  );

-- Service role can update meals (for AI analysis from API)
-- This is handled in the API layer with service role key

-- Invites RLS
alter table public.invites enable row level security;

-- Nutritionists can see their own invites
create policy "nutritionists_read_own_invites"
  on public.invites for select
  using (nutritionist_id = auth.uid());

-- Nutritionists can create invites
create policy "nutritionists_create_invites"
  on public.invites for insert
  with check (nutritionist_id = auth.uid());

-- Anyone authenticated can read invites by code (for joining)
-- This is handled by the API with service role key

-- ─────────────────────────────────────────
-- STORAGE BUCKET
-- ─────────────────────────────────────────
-- Run in Supabase dashboard Storage section:
-- Create bucket "meal-photos" with public access = true (for simplicity)
-- Or via SQL:
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
create policy "clients_upload_own_photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read of meal photos
create policy "public_read_meal_photos"
  on storage.objects for select
  to public
  using (bucket_id = 'meal-photos');

-- ─────────────────────────────────────────
-- TRIGGER: auto-create profile on sign up
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
