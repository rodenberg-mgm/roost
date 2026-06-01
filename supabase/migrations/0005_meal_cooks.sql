-- 0005_meal_cooks.sql
-- Meal plan v1.1: restructure meal_slots for multi-cook + member-created slots,
-- add meal_cooks, RLS, and realtime.

-- ============================================================
-- 1. RESTRUCTURE meal_slots (empty table — feature unbuilt)
-- ============================================================
alter table public.meal_slots
  drop column if exists cook_user_id;

alter table public.meal_slots
  add column if not exists created_by_user_id uuid not null references public.users(id) on delete cascade;

-- ============================================================
-- 2. CREATE meal_cooks
-- ============================================================
create table public.meal_cooks (
  id          uuid primary key default gen_random_uuid(),
  slot_id     uuid not null references public.meal_slots(id) on delete cascade,
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (slot_id, user_id)
);

alter table public.meal_cooks enable row level security;

-- ============================================================
-- 3. RLS for meal_cooks (uses existing is_trip_member / is_trip_host)
-- ============================================================
create policy "meal_cooks_member_select"
  on public.meal_cooks for select
  using (public.is_trip_member(trip_id));

create policy "meal_cooks_own_insert"
  on public.meal_cooks for insert
  with check (public.is_trip_member(trip_id) and user_id = auth.uid());

create policy "meal_cooks_delete"
  on public.meal_cooks for delete
  using (user_id = auth.uid() or public.is_trip_host(trip_id));

-- ============================================================
-- 4. meal_slots RLS: member insert, host-or-cook update, creator-or-host delete
-- (drop the host-only insert + member update from 0002)
-- ============================================================
drop policy if exists "meal_slots_host_insert" on public.meal_slots;
drop policy if exists "meal_slots_member_update" on public.meal_slots;

create policy "meal_slots_member_insert"
  on public.meal_slots for insert
  with check (public.is_trip_member(trip_id) and created_by_user_id = auth.uid());

create policy "meal_slots_cook_update"
  on public.meal_slots for update
  using (
    public.is_trip_host(trip_id)
    or exists (
      select 1 from public.meal_cooks mc
      where mc.slot_id = meal_slots.id
        and mc.user_id = auth.uid()
    )
  )
  with check (
    public.is_trip_host(trip_id)
    or exists (
      select 1 from public.meal_cooks mc
      where mc.slot_id = meal_slots.id
        and mc.user_id = auth.uid()
    )
  );

create policy "meal_slots_delete"
  on public.meal_slots for delete
  using (
    created_by_user_id = auth.uid()
    or public.is_trip_host(trip_id)
  );

-- ============================================================
-- 5. Realtime (meal_slots already in the publication from 0001)
-- ============================================================
alter publication supabase_realtime add table public.meal_cooks;
