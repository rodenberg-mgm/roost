-- 0014_inventory_and_suggestions.sql
-- Promote the flat `stocked_items` string arrays into structured, categorized
-- inventory (with quantities, free-text sizes, and an optional photo), and add
-- a property-remembered "suggested to bring" list. Both live at property level
-- (the reusable template) AND trip level (the editable copy), mirroring the
-- existing copy-on-link sync model. See lib/actions/trips.ts -> syncPropertyToTrip.

-- ============================================================
-- 1. Inventory — "what's already at the place"
-- ============================================================
create table public.property_inventory_items (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category    text not null default 'other',
  title       text not null,
  quantity    int,
  detail      text,                       -- free-text sizes/specifics, e.g. "Youth S–L ×4, Adult ×6"
  image_path  text,                       -- key in the public `inventory-images` bucket
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.trip_inventory_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  category    text not null default 'other',
  title       text not null,
  quantity    int,
  detail      text,
  image_path  text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index property_inventory_items_property_idx on public.property_inventory_items(property_id) where deleted_at is null;
create index trip_inventory_items_trip_idx on public.trip_inventory_items(trip_id) where deleted_at is null;

-- ============================================================
-- 2. Suggested to bring — reminders, never claimable
-- ============================================================
create table public.property_suggested_items (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category    text not null default 'other',
  title       text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.trip_suggested_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  category    text not null default 'other',
  title       text not null,
  provided    boolean not null default false,  -- "already at the property — skip it" (manual flag)
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index property_suggested_items_property_idx on public.property_suggested_items(property_id) where deleted_at is null;
create index trip_suggested_items_trip_idx on public.trip_suggested_items(trip_id) where deleted_at is null;

-- ============================================================
-- 3. RLS
--    property_*  -> owner-only (mirrors property_sensitive_info)
--    trip_*      -> members read, host/co-host write (mirrors packing_items)
-- ============================================================
alter table public.property_inventory_items enable row level security;
alter table public.trip_inventory_items     enable row level security;
alter table public.property_suggested_items enable row level security;
alter table public.trip_suggested_items     enable row level security;

-- Property-scoped tables: owner-only (mirrors property_sensitive_info).
create policy "property_inventory_owner_all"
  on public.property_inventory_items for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_user_id = auth.uid()));

create policy "property_suggested_owner_all"
  on public.property_suggested_items for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_user_id = auth.uid()));

-- Trip-scoped tables: members read, host/co-host write (mirrors packing_items).
create policy "trip_inventory_member_select"
  on public.trip_inventory_items for select using (public.is_trip_member(trip_id));
create policy "trip_inventory_host_insert"
  on public.trip_inventory_items for insert with check (public.is_trip_host(trip_id));
create policy "trip_inventory_host_update"
  on public.trip_inventory_items for update using (public.is_trip_host(trip_id));
create policy "trip_inventory_host_delete"
  on public.trip_inventory_items for delete using (public.is_trip_host(trip_id));

create policy "trip_suggested_member_select"
  on public.trip_suggested_items for select using (public.is_trip_member(trip_id));
create policy "trip_suggested_host_insert"
  on public.trip_suggested_items for insert with check (public.is_trip_host(trip_id));
create policy "trip_suggested_host_update"
  on public.trip_suggested_items for update using (public.is_trip_host(trip_id));
create policy "trip_suggested_host_delete"
  on public.trip_suggested_items for delete using (public.is_trip_host(trip_id));

-- ============================================================
-- 4. Backfill existing stocked_items arrays into inventory rows
--    (category 'other'); the old jsonb columns are left in place but the app
--    stops reading them. A later migration can drop them once confirmed unused.
-- ============================================================
insert into public.property_inventory_items (property_id, category, title, sort_order)
select p.id, 'other', elem.value, (elem.ord - 1)::int
from public.properties p,
     lateral jsonb_array_elements_text(p.stocked_items) with ordinality as elem(value, ord)
where jsonb_typeof(p.stocked_items) = 'array'
  and length(trim(elem.value)) > 0;

insert into public.trip_inventory_items (trip_id, category, title, sort_order)
select t.id, 'other', elem.value, (elem.ord - 1)::int
from public.trips t,
     lateral jsonb_array_elements_text(t.stocked_items) with ordinality as elem(value, ord)
where jsonb_typeof(t.stocked_items) = 'array'
  and length(trim(elem.value)) > 0;

-- ============================================================
-- 5. Public bucket for inventory photos
--    Inventory is non-sensitive and shown to anonymous /trip/[token] viewers
--    (who have no session to mint signed URLs), so reads are public. Paths are
--    unguessable UUIDs — "annoying if leaked, not unsafe" (CLAUDE.md §3.6).
--    Write authority originates server-side (createInventoryUploadUrl mints the
--    signed upload only after the host/owner check); the policy just requires a
--    logged-in user.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('inventory-images', 'inventory-images', true)
on conflict (id) do update set public = true;

drop policy if exists "inventory_images_auth_insert" on storage.objects;
drop policy if exists "inventory_images_auth_delete" on storage.objects;

create policy "inventory_images_auth_insert"
  on storage.objects for insert
  with check (bucket_id = 'inventory-images' and auth.uid() is not null);

create policy "inventory_images_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'inventory-images' and auth.uid() is not null);
