-- 0016_trip_archive.sql
-- Let a host hide a trip from the dashboard without deleting it. Past trips are
-- filtered out of the default view by date; archiving is the manual equivalent
-- for trips that aren't date-past but should be tucked away. Deletion continues
-- to use the existing soft-delete `deleted_at` (CLAUDE.md: soft-delete user-
-- facing data).

alter table public.trips
  add column if not exists archived_at timestamptz;
