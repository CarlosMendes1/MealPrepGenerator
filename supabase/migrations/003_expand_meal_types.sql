-- Expand meal_type to include morning_snack, afternoon_snack and supper,
-- supporting clients with different daily routines.

ALTER TABLE public.meals DROP CONSTRAINT IF EXISTS meals_meal_type_check;

ALTER TABLE public.meals
  ADD CONSTRAINT meals_meal_type_check CHECK (
    meal_type IN (
      'breakfast',
      'morning_snack',
      'lunch',
      'afternoon_snack',
      'dinner',
      'supper',
      'snack'          -- kept for backward-compatibility with existing records
    )
  );
