-- 0009_member_management.sql
-- Member management: allow host/co-host to delete a membership row, and add an
-- atomic host-transfer function.

-- ============================================================
-- 1. trip_members DELETE policy (none existed -> removal was denied)
-- ============================================================
drop policy if exists "trip_members_delete" on public.trip_members;
create policy "trip_members_delete"
  on public.trip_members for delete
  using (
    public.is_trip_host(trip_id)
    and user_id <> (select host_user_id from public.trips where id = trip_id)
  );

-- ============================================================
-- 2. Atomic host transfer
--    Re-checks authority server-side (defense in depth beyond the action).
-- ============================================================
create or replace function public.transfer_trip_host(p_trip_id uuid, p_new_host uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_old_host uuid;
begin
  select host_user_id into v_old_host from public.trips where id = p_trip_id;
  if v_old_host is null then
    raise exception 'Trip not found';
  end if;
  -- Caller must currently be the primary host.
  if v_old_host is distinct from auth.uid() then
    raise exception 'Only the current host can transfer host';
  end if;
  -- No-op/foot-gun guard: transferring to yourself would demote you with no new host.
  if p_new_host = v_old_host then
    raise exception 'New host must be different from the current host';
  end if;
  -- Target must be a joined member of this trip.
  if not exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_new_host and joined_at is not null
  ) then
    raise exception 'New host must be a joined member';
  end if;

  update public.trips set host_user_id = p_new_host where id = p_trip_id;
  update public.trip_members set role = 'host'    where trip_id = p_trip_id and user_id = p_new_host;
  update public.trip_members set role = 'co-host' where trip_id = p_trip_id and user_id = v_old_host;
end;
$$;
