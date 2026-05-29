-- 0003_fix_trips_host_select.sql
--
-- Fix: creating a trip does .insert().select("id") but the SELECT policy
-- requires is_trip_member(id). At insert time, trip_members hasn't been
-- populated yet → RLS blocks the RETURNING clause.
--
-- Solution: add a SELECT policy so the host (trip creator) can always
-- read their own trips, independent of trip_members.

create policy "trips_host_select"
  on public.trips for select
  using (
    deleted_at is null
    and auth.uid() = host_user_id
  );
