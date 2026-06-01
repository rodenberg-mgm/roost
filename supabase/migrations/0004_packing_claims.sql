-- 0004_packing_claims.sql
-- Packing list v1.1: restructure packing_items for multi-claim + optional target,
-- add packing_claims, RLS, and realtime.

-- ============================================================
-- 1. RESTRUCTURE packing_items
-- packing_items is empty (feature unbuilt) so dropping columns is safe.
-- ============================================================
alter table public.packing_items
  add column if not exists target_quantity integer;

alter table public.packing_items
  drop column if exists claimed_by_user_id,
  drop column if exists claimed_at,
  drop column if exists is_completed,
  drop column if exists quantity;

-- ============================================================
-- 2. CREATE packing_claims
-- ============================================================
create table public.packing_claims (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.packing_items(id) on delete cascade,
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  brought     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.packing_claims enable row level security;

create trigger set_updated_at before update on public.packing_claims
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. RLS for packing_claims (uses existing is_trip_member / is_trip_host)
-- ============================================================
create policy "packing_claims_member_select"
  on public.packing_claims for select
  using (public.is_trip_member(trip_id));

create policy "packing_claims_own_insert"
  on public.packing_claims for insert
  with check (public.is_trip_member(trip_id) and user_id = auth.uid());

create policy "packing_claims_own_update"
  on public.packing_claims for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "packing_claims_delete"
  on public.packing_claims for delete
  using (user_id = auth.uid() or public.is_trip_host(trip_id));

-- ============================================================
-- 4. Loosen packing_items delete: creator OR host (was host-only in 0002)
-- ============================================================
drop policy if exists "packing_items_host_delete" on public.packing_items;

create policy "packing_items_delete"
  on public.packing_items for delete
  using (
    created_by_user_id = auth.uid()
    or public.is_trip_host(trip_id)
  );

-- ============================================================
-- 5. Realtime (packing_items already in the publication from 0001)
-- ============================================================
alter publication supabase_realtime add table public.packing_claims;
