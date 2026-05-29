-- 0002_fix_trip_members_rls_recursion.sql
--
-- Fix: the trip_members SELECT policy queries trip_members, which triggers
-- the same SELECT policy → infinite recursion. Same issue hits INSERT and
-- UPDATE policies, and any OTHER table's policy that joins to trip_members
-- (trips, trip_sensitive_info, packing_items, meal_slots, photos, trip_invites).
--
-- Solution: a SECURITY DEFINER function that bypasses RLS to check membership.
-- All policies that need "is this user a member of this trip?" call the function
-- instead of doing a subquery on trip_members directly.

-- ============================================================
-- 1. CREATE HELPER FUNCTIONS (security definer = bypasses RLS)
-- ============================================================

-- Check if the current user is a member of the given trip
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and user_id = auth.uid()
  );
$$;

-- Check if the current user is a host or co-host of the given trip
create or replace function public.is_trip_host(p_trip_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and role in ('host', 'co-host')
  );
$$;

-- ============================================================
-- 2. DROP OLD POLICIES that cause recursion
-- ============================================================

-- trip_members (self-referencing)
drop policy if exists "trip_members_select" on public.trip_members;
drop policy if exists "trip_members_insert" on public.trip_members;
drop policy if exists "trip_members_update" on public.trip_members;

-- trips (references trip_members)
drop policy if exists "trips_member_select" on public.trips;

-- trip_sensitive_info (references trip_members)
drop policy if exists "trip_sensitive_member_select" on public.trip_sensitive_info;
drop policy if exists "trip_sensitive_host_update" on public.trip_sensitive_info;

-- trip_invites (references trip_members)
drop policy if exists "trip_invites_host_select" on public.trip_invites;
drop policy if exists "trip_invites_host_insert" on public.trip_invites;

-- packing_items (references trip_members)
drop policy if exists "packing_items_member_select" on public.packing_items;
drop policy if exists "packing_items_member_insert" on public.packing_items;
drop policy if exists "packing_items_member_update" on public.packing_items;
drop policy if exists "packing_items_host_delete" on public.packing_items;

-- meal_slots (references trip_members)
drop policy if exists "meal_slots_member_select" on public.meal_slots;
drop policy if exists "meal_slots_host_insert" on public.meal_slots;
drop policy if exists "meal_slots_member_update" on public.meal_slots;

-- photos (references trip_members)
drop policy if exists "photos_member_select" on public.photos;
drop policy if exists "photos_member_insert" on public.photos;
drop policy if exists "photos_delete" on public.photos;

-- ============================================================
-- 3. RECREATE POLICIES using helper functions
-- ============================================================

-- TRIP_MEMBERS: use auth.uid() directly for select (no self-reference)
create policy "trip_members_select"
  on public.trip_members for select
  using (public.is_trip_member(trip_id));

-- INSERT: host/co-host can add members, OR user can insert themselves as host
create policy "trip_members_insert"
  on public.trip_members for insert
  with check (
    public.is_trip_host(trip_id)
    or (auth.uid() = user_id and role = 'host')
  );

-- UPDATE: only host can change roles
create policy "trip_members_update"
  on public.trip_members for update
  using (public.is_trip_host(trip_id));

-- TRIPS
create policy "trips_member_select"
  on public.trips for select
  using (
    deleted_at is null
    and public.is_trip_member(id)
  );

-- TRIP_SENSITIVE_INFO
create policy "trip_sensitive_member_select"
  on public.trip_sensitive_info for select
  using (
    public.is_trip_host(trip_id)
    or exists (
      select 1 from public.trip_grants tg
      where tg.trip_id = trip_sensitive_info.trip_id
        and tg.user_id = auth.uid()
        and tg.level = 'sensitive'
        and tg.expires_at > now()
    )
  );

create policy "trip_sensitive_host_update"
  on public.trip_sensitive_info for update
  using (public.is_trip_host(trip_id));

-- TRIP_INVITES
create policy "trip_invites_host_select"
  on public.trip_invites for select
  using (public.is_trip_host(trip_id));

create policy "trip_invites_host_insert"
  on public.trip_invites for insert
  with check (public.is_trip_host(trip_id));

-- PACKING_ITEMS
create policy "packing_items_member_select"
  on public.packing_items for select
  using (public.is_trip_member(trip_id));

create policy "packing_items_member_insert"
  on public.packing_items for insert
  with check (
    auth.uid() = created_by_user_id
    and public.is_trip_member(trip_id)
  );

create policy "packing_items_member_update"
  on public.packing_items for update
  using (public.is_trip_member(trip_id));

create policy "packing_items_host_delete"
  on public.packing_items for delete
  using (public.is_trip_host(trip_id));

-- MEAL_SLOTS
create policy "meal_slots_member_select"
  on public.meal_slots for select
  using (public.is_trip_member(trip_id));

create policy "meal_slots_host_insert"
  on public.meal_slots for insert
  with check (public.is_trip_host(trip_id));

create policy "meal_slots_member_update"
  on public.meal_slots for update
  using (public.is_trip_member(trip_id));

-- PHOTOS
create policy "photos_member_select"
  on public.photos for select
  using (
    deleted_at is null
    and public.is_trip_member(trip_id)
  );

create policy "photos_member_insert"
  on public.photos for insert
  with check (
    auth.uid() = uploaded_by_user_id
    and public.is_trip_member(trip_id)
  );

create policy "photos_delete"
  on public.photos for update
  using (
    public.is_trip_member(trip_id)
    and (
      auth.uid() = uploaded_by_user_id
      or public.is_trip_host(trip_id)
    )
  );
