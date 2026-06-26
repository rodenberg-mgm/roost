-- 0015_households.sql
-- Households: named groupings of trip members (e.g. "The Rodenbergs") that own a
-- private packing checklist. This is the first data scoped NARROWER than the
-- whole trip — a household's list is visible only to its members, not the rest
-- of the group. The is_household_member() helper is the trust boundary; treat it
-- as carefully as is_trip_member()/is_trip_host().

-- ============================================================
-- 1. Tables
-- ============================================================
create table public.trip_households (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  name               text not null,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create table public.trip_household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.trip_households(id) on delete cascade,
  trip_id      uuid not null references public.trips(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- A member belongs to at most one household per trip.
  unique (trip_id, user_id)
);

create table public.household_packing_items (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  household_id       uuid not null references public.trip_households(id) on delete cascade,
  title              text not null,
  category           text,
  quantity           int,                 -- optional; rendered inline as "Swimsuit ×2"
  packed             boolean not null default false,
  packed_by_user_id  uuid references public.users(id) on delete set null,
  suggestion_item_id uuid references public.trip_suggested_items(id) on delete set null,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index trip_households_trip_idx on public.trip_households(trip_id) where deleted_at is null;
create index trip_household_members_household_idx on public.trip_household_members(household_id);
create index household_packing_items_household_idx on public.household_packing_items(household_id);

-- ============================================================
-- 2. Membership helper (SECURITY DEFINER, mirrors is_trip_member)
-- ============================================================
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.trip_household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  );
$$;

-- ============================================================
-- 3. RLS
-- ============================================================
alter table public.trip_households        enable row level security;
alter table public.trip_household_members enable row level security;
alter table public.household_packing_items enable row level security;

-- trip_households: only your own household is visible. Creation goes through the
-- SECURITY DEFINER rpc below (so the self-join can't be abused); this INSERT
-- policy still requires you to be the creator and a trip member.
create policy "trip_households_member_select"
  on public.trip_households for select
  using (public.is_household_member(id));

create policy "trip_households_insert"
  on public.trip_households for insert
  with check (created_by_user_id = auth.uid() and public.is_trip_member(trip_id));

create policy "trip_households_member_update"
  on public.trip_households for update
  using (public.is_household_member(id));

create policy "trip_households_member_delete"
  on public.trip_households for delete
  using (public.is_household_member(id));

-- trip_household_members: visible to co-members. INSERT is restricted to EXISTING
-- household members adding another trip member — there is intentionally NO open
-- self-join (that would let anyone add themselves to another family's household
-- and read its list). The creator's first membership is seeded by the rpc.
create policy "trip_household_members_select"
  on public.trip_household_members for select
  using (public.is_household_member(household_id));

create policy "trip_household_members_insert"
  on public.trip_household_members for insert
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_household_members.trip_id
        and tm.user_id = trip_household_members.user_id
    )
  );

create policy "trip_household_members_delete"
  on public.trip_household_members for delete
  using (public.is_household_member(household_id));

-- household_packing_items: fully scoped to household members.
create policy "household_packing_items_member_all"
  on public.household_packing_items for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ============================================================
-- 4. get_or_create_my_household — atomic, leak-safe creation
--    Returns the caller's household for the trip, creating a household-of-one
--    on first use. SECURITY DEFINER so it can seed the first membership row past
--    the restrictive INSERT policy above.
-- ============================================================
create or replace function public.get_or_create_my_household(p_trip_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_household_id uuid;
  v_name text;
begin
  if not public.is_trip_member(p_trip_id) then
    raise exception 'Not a member of this trip';
  end if;

  -- Already in a household for this trip?
  select household_id into v_household_id
  from public.trip_household_members
  where trip_id = p_trip_id and user_id = auth.uid();

  if v_household_id is not null then
    return v_household_id;
  end if;

  select coalesce(nullif(trim(display_name), ''), 'My') into v_name
  from public.users where id = auth.uid();

  insert into public.trip_households (trip_id, name, created_by_user_id)
  values (p_trip_id, v_name || '''s packing', auth.uid())
  returning id into v_household_id;

  insert into public.trip_household_members (household_id, trip_id, user_id)
  values (v_household_id, p_trip_id, auth.uid());

  return v_household_id;
end;
$$;
