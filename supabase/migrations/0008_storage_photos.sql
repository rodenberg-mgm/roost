-- 0008_storage_photos.sql
-- Versioned storage gate for the photo album (v1.2).
--
-- Until now the `trip-photos` bucket and its access policies lived only in the
-- Supabase dashboard (unversioned — violates CLAUDE.md §7). This migration puts
-- the bucket + per-trip RLS into source control so a fresh project reproduces
-- the gate.
--
-- Path convention (set by lib/actions/photos.ts -> createUploadUrls):
--   trips/{tripId}/photos/{photoId}/{thumb,display,original}.{ext}
-- storage.foldername(name) returns the folder segments (1-indexed), so
--   [1] = 'trips', [2] = {tripId}, [3] = 'photos', [4] = {photoId}.
--
-- DEFENSE-IN-DEPTH NOTE: the app layer (getDisplayUrl/getOriginalUrl) already
-- reauthorizes by photoId through the photos-table RLS before minting any
-- signed URL, so the practical read hole is closed regardless of this file.
-- These policies harden the storage byte layer itself.
--
-- ⚠️ MANUAL STEP AFTER APPLYING: Postgres RLS policies are OR'd together. If the
-- dashboard still has a PERMISSIVE policy on storage.objects for this bucket
-- (e.g. "authenticated users can read trip-photos"), it will OVERRIDE the
-- scoping below and leave the back door open. Audit the bucket's policies in
-- the dashboard (Storage -> Policies) and DELETE any broad allow-rule for
-- `trip-photos` so only the trip-scoped policies below remain.

-- ============================================================
-- 1. Ensure the bucket exists and is PRIVATE (idempotent)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do update set public = false;

-- ============================================================
-- 2. Replace any prior copies of these named policies, then
--    create trip-scoped policies on storage.objects.
--    (storage.objects already has RLS enabled by Supabase.)
-- ============================================================
drop policy if exists "trip_photos_member_select" on storage.objects;
drop policy if exists "trip_photos_member_insert" on storage.objects;
drop policy if exists "trip_photos_member_delete" on storage.objects;

-- Members of the trip may READ objects under that trip's photo path.
-- (createSignedUrl via the user session requires select on the object.)
create policy "trip_photos_member_select"
  on storage.objects for select
  using (
    bucket_id = 'trip-photos'
    and array_length(storage.foldername(name), 1) >= 4
    and (storage.foldername(name))[1] = 'trips'
    and public.is_trip_member(((storage.foldername(name))[2])::uuid)
  );

-- Members may WRITE objects under their trip's photo path.
-- (uploadToSignedUrl performs an insert against storage.objects.)
create policy "trip_photos_member_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'trip-photos'
    and array_length(storage.foldername(name), 1) >= 4
    and (storage.foldername(name))[1] = 'trips'
    and public.is_trip_member(((storage.foldername(name))[2])::uuid)
  );

-- Members may DELETE objects under their trip's photo path (for the
-- lib/storage remove() helper / future hard-delete cleanup). Photo soft-delete
-- itself does NOT touch storage; this is for explicit byte removal.
create policy "trip_photos_member_delete"
  on storage.objects for delete
  using (
    bucket_id = 'trip-photos'
    and array_length(storage.foldername(name), 1) >= 4
    and (storage.foldername(name))[1] = 'trips'
    and public.is_trip_member(((storage.foldername(name))[2])::uuid)
  );
