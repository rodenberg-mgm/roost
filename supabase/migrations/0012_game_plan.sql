-- 0012_game_plan.sql
-- Game Plan v1.1: claimable trip to-dos with one owner + optional helpers,
-- optional due date, done state, owner note, and a soft source reference
-- (e.g. a meal slot) for cross-page creation. Mirrors packing_claims / meal_cooks.

-- ============================================================
-- 1. CREATE game_plan_tasks
-- ============================================================
create table public.game_plan_tasks (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 200),
  owner_user_id      uuid references public.users(id) on delete set null,
  note               text check (note is null or char_length(note) <= 280),
  due_date           date,
  done               boolean not null default false,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  source_kind        text,
  source_id          uuid,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index game_plan_tasks_trip_id_idx on public.game_plan_tasks(trip_id);
create index game_plan_tasks_source_idx
  on public.game_plan_tasks(source_kind, source_id);

alter table public.game_plan_tasks enable row level security;

create trigger set_updated_at before update on public.game_plan_tasks
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. CREATE game_plan_task_helpers (mirrors meal_cooks)
-- ============================================================
create table public.game_plan_task_helpers (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.game_plan_tasks(id) on delete cascade,
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (task_id, user_id)
);

alter table public.game_plan_task_helpers enable row level security;

-- ============================================================
-- 3. RLS for game_plan_tasks
-- ============================================================
create policy "game_plan_tasks_member_select"
  on public.game_plan_tasks for select
  using (public.is_trip_member(trip_id));

create policy "game_plan_tasks_member_insert"
  on public.game_plan_tasks for insert
  with check (public.is_trip_member(trip_id) and created_by_user_id = auth.uid());

create policy "game_plan_tasks_owner_or_host_update"
  on public.game_plan_tasks for update
  using (public.is_trip_host(trip_id) or owner_user_id = auth.uid())
  with check (public.is_trip_host(trip_id) or owner_user_id = auth.uid());

create policy "game_plan_tasks_delete"
  on public.game_plan_tasks for delete
  using (created_by_user_id = auth.uid() or public.is_trip_host(trip_id));

-- ============================================================
-- 4. RLS for game_plan_task_helpers (verbatim from meal_cooks)
-- ============================================================
create policy "game_plan_task_helpers_member_select"
  on public.game_plan_task_helpers for select
  using (public.is_trip_member(trip_id));

create policy "game_plan_task_helpers_own_insert"
  on public.game_plan_task_helpers for insert
  with check (public.is_trip_member(trip_id) and user_id = auth.uid());

create policy "game_plan_task_helpers_delete"
  on public.game_plan_task_helpers for delete
  using (user_id = auth.uid() or public.is_trip_host(trip_id));

-- ============================================================
-- 5. Realtime
-- ============================================================
alter publication supabase_realtime add table public.game_plan_tasks;
alter publication supabase_realtime add table public.game_plan_task_helpers;
