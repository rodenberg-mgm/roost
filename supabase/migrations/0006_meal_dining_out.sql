-- 0006_meal_dining_out.sql
-- Meal "eating out" mode: a host-set meal slot that shows a place + meet time
-- instead of cook sign-ups.

alter table public.meal_slots
  add column if not exists is_dining_out boolean not null default false,
  add column if not exists meet_time text;

-- No RLS change: host-only enforcement for these two fields lives in the
-- server actions (addMealSlot / updateMealSlot). The existing
-- meal_slots_cook_update (host-or-cook) policy stays as a backstop.
