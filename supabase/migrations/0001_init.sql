-- supabase/migrations/0001_init.sql
-- Roost v0: All tables + RLS for trip-scoped multi-tenancy
-- Run in Supabase SQL Editor for v0; wire up the Supabase CLI when migrations get frequent.
--
-- Structure: ALL tables created first, then ALL RLS policies added after,
-- because policies on trips/trip_sensitive_info reference trip_members/trip_grants
-- which must exist before the policy can be created.

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. CREATE ALL TABLES
-- ============================================================

-- USERS (extends auth.users)
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- PROPERTIES (recurring locations — non-sensitive fields)
create table public.properties (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name          text not null,
  city          text,
  region        text,
  house_rules   text,
  local_tips    text,
  stocked_items jsonb not null default '[]'::jsonb,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- PROPERTY_SENSITIVE_INFO (wifi, codes, address)
create table public.property_sensitive_info (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null unique references public.properties(id) on delete cascade,
  wifi_ssid     text,
  wifi_password text,
  door_code     text,
  gate_code     text,
  address_line  text,
  postal_code   text,
  parking_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- TRIPS (core object — non-sensitive fields)
create table public.trips (
  id                      uuid primary key default gen_random_uuid(),
  host_user_id            uuid not null references public.users(id) on delete cascade,
  property_id             uuid references public.properties(id) on delete set null,
  name                    text not null,
  starts_on               date,
  ends_on                 date,
  city                    text,
  region                  text,
  house_rules             text,
  local_tips              text,
  stocked_items           jsonb not null default '[]'::jsonb,
  require_pin_to_view     boolean not null default false,
  pin_hash                text,
  property_synced_at      timestamptz,
  property_sync_overrides jsonb not null default '{}'::jsonb,
  details                 jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

-- TRIP_SENSITIVE_INFO (wifi, codes, address — separate RLS)
create table public.trip_sensitive_info (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null unique references public.trips(id) on delete cascade,
  wifi_ssid     text,
  wifi_password text,
  door_code     text,
  gate_code     text,
  address_line  text,
  postal_code   text,
  parking_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- TRIP_MEMBERS (who is on a trip + their per-trip role)
create table public.trip_members (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  role          text not null check (role in ('host', 'co-host', 'guest')),
  invited_email text,
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (trip_id, user_id)
);

-- TRIP_INVITES (per-recipient single-use email tokens)
create table public.trip_invites (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips(id) on delete cascade,
  email               text not null,
  token               text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at          timestamptz not null default (now() + interval '14 days'),
  consumed_at         timestamptz,
  consumed_by_user_id uuid references public.users(id),
  created_at          timestamptz not null default now()
);

-- TRIP_GRANTS (verification state for tiered visibility C+B)
create table public.trip_grants (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid references public.users(id) on delete cascade,
  level       text not null check (level in ('view', 'sensitive')),
  source      text not null check (source in ('magic-link', 'pin-entry', 'email-verify')),
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days'),
  last_seen_at timestamptz
);

-- PACKING_ITEMS
create table public.packing_items (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips(id) on delete cascade,
  title               text not null,
  quantity            text,
  notes               text,
  claimed_by_user_id  uuid references public.users(id),
  claimed_at          timestamptz,
  is_completed        boolean not null default false,
  created_by_user_id  uuid not null references public.users(id),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- MEAL_SLOTS
create table public.meal_slots (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  day_date      date not null,
  meal_type     text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'other')),
  title         text,
  cook_user_id  uuid references public.users(id),
  menu          text,
  notes         text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- PHOTOS
create table public.photos (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips(id) on delete cascade,
  storage_path        text not null,
  uploaded_by_user_id uuid not null references public.users(id),
  caption             text,
  taken_at            timestamptz,
  mime_type           text not null,
  width               integer,
  height              integer,
  file_size_bytes     bigint not null,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- ============================================================
-- 2. ENABLE RLS ON ALL TABLES
-- ============================================================
alter table public.users enable row level security;
alter table public.properties enable row level security;
alter table public.property_sensitive_info enable row level security;
alter table public.trips enable row level security;
alter table public.trip_sensitive_info enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.trip_grants enable row level security;
alter table public.packing_items enable row level security;
alter table public.meal_slots enable row level security;
alter table public.photos enable row level security;

-- ============================================================
-- 3. CREATE ALL RLS POLICIES
-- (now safe — all tables exist)
-- ============================================================

-- USERS policies
create policy "users_select_all"
  on public.users for select
  using (true);

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id);

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

-- PROPERTIES policies
create policy "properties_owner_select"
  on public.properties for select
  using (auth.uid() = owner_user_id and deleted_at is null);

create policy "properties_owner_insert"
  on public.properties for insert
  with check (auth.uid() = owner_user_id);

create policy "properties_owner_update"
  on public.properties for update
  using (auth.uid() = owner_user_id);

-- PROPERTY_SENSITIVE_INFO policies
create policy "prop_sensitive_owner_select"
  on public.property_sensitive_info for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.owner_user_id = auth.uid()
    )
  );

create policy "prop_sensitive_owner_insert"
  on public.property_sensitive_info for insert
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.owner_user_id = auth.uid()
    )
  );

create policy "prop_sensitive_owner_update"
  on public.property_sensitive_info for update
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.owner_user_id = auth.uid()
    )
  );

-- TRIPS policies
create policy "trips_member_select"
  on public.trips for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = id
        and tm.user_id = auth.uid()
    )
  );

create policy "trips_host_update"
  on public.trips for update
  using (auth.uid() = host_user_id);

create policy "trips_insert"
  on public.trips for insert
  with check (auth.uid() = host_user_id);

-- TRIP_SENSITIVE_INFO policies
create policy "trip_sensitive_member_select"
  on public.trip_sensitive_info for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_sensitive_info.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
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
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_sensitive_info.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

create policy "trip_sensitive_insert"
  on public.trip_sensitive_info for insert
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id
        and t.host_user_id = auth.uid()
    )
  );

-- TRIP_MEMBERS policies
create policy "trip_members_select"
  on public.trip_members for select
  using (
    exists (
      select 1 from public.trip_members my
      where my.trip_id = trip_members.trip_id
        and my.user_id = auth.uid()
    )
  );

create policy "trip_members_insert"
  on public.trip_members for insert
  with check (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
    or (auth.uid() = user_id and role = 'host')
  );

create policy "trip_members_update"
  on public.trip_members for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
        and tm.role = 'host'
    )
  );

-- TRIP_INVITES policies
create policy "trip_invites_host_select"
  on public.trip_invites for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_invites.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

create policy "trip_invites_host_insert"
  on public.trip_invites for insert
  with check (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_invites.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

-- TRIP_GRANTS policies
create policy "trip_grants_own_select"
  on public.trip_grants for select
  using (auth.uid() = user_id);

-- PACKING_ITEMS policies
create policy "packing_items_member_select"
  on public.packing_items for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = packing_items.trip_id
        and tm.user_id = auth.uid()
    )
  );

create policy "packing_items_member_insert"
  on public.packing_items for insert
  with check (
    auth.uid() = created_by_user_id
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = packing_items.trip_id
        and tm.user_id = auth.uid()
    )
  );

create policy "packing_items_member_update"
  on public.packing_items for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = packing_items.trip_id
        and tm.user_id = auth.uid()
    )
  );

create policy "packing_items_host_delete"
  on public.packing_items for delete
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = packing_items.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

-- MEAL_SLOTS policies
create policy "meal_slots_member_select"
  on public.meal_slots for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = meal_slots.trip_id
        and tm.user_id = auth.uid()
    )
  );

create policy "meal_slots_host_insert"
  on public.meal_slots for insert
  with check (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = meal_slots.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

create policy "meal_slots_member_update"
  on public.meal_slots for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = meal_slots.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- PHOTOS policies
create policy "photos_member_select"
  on public.photos for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = photos.trip_id
        and tm.user_id = auth.uid()
    )
  );

create policy "photos_member_insert"
  on public.photos for insert
  with check (
    auth.uid() = uploaded_by_user_id
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = photos.trip_id
        and tm.user_id = auth.uid()
    )
  );

create policy "photos_delete"
  on public.photos for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = photos.trip_id
        and tm.user_id = auth.uid()
        and (
          auth.uid() = photos.uploaded_by_user_id
          or tm.role in ('host', 'co-host')
        )
    )
  );

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- UPDATED_AT TRIGGER (reusable)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.property_sensitive_info
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.trip_sensitive_info
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.packing_items
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.meal_slots
  for each row execute function public.set_updated_at();

-- AUTO-CREATE USER PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 5. REALTIME (enable for tables that need live updates)
-- ============================================================
alter publication supabase_realtime add table public.packing_items;
alter publication supabase_realtime add table public.meal_slots;
alter publication supabase_realtime add table public.photos;
alter publication supabase_realtime add table public.trip_members;
