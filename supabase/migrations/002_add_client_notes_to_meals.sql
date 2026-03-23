-- Add client_notes to meals so clients can describe ingredients/preparation
-- when submitting a photo, improving AI analysis accuracy.

ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS client_notes text;
