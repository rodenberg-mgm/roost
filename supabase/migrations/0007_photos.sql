-- 0007_photos.sql
-- Shared photo album (v1.2): reshape photos table schema, update RLS, and add indexes.
--
-- NOTE: public.photos already exists from 0001_init.sql with a different column set
-- (storage_path, caption, mime_type, width, height, file_size_bytes).
-- This migration drops the old columns, adds the new ones, replaces all RLS policies,
-- and adds indexes.  The realtime publication was already added in 0001_init.sql so
-- "alter publication … add table public.photos" is intentionally omitted here.

-- ============================================================
-- 1. RESHAPE photos (ALTER existing table from 0001 schema)
-- ============================================================

-- Drop columns that no longer exist in the new schema
alter table public.photos
  drop column if exists storage_path,
  drop column if exists caption,
  drop column if exists mime_type,
  drop column if exists width,
  drop column if exists height,
  drop column if exists file_size_bytes;

-- Add the new columns required by v1.2
alter table public.photos
  add column if not exists thumb_path      text,
  add column if not exists display_path    text,
  add column if not exists original_path   text,
  add column if not exists display_width   int,
  add column if not exists display_height  int,
  add column if not exists content_type    text;

-- Make the new required columns NOT NULL (safe once added — table is empty in dev;
-- on a live table with data you would back-fill first, then add the constraint).
alter table public.photos
  alter column thumb_path     set not null,
  alter column display_path   set not null,
  alter column original_path  set not null,
  alter column display_width  set not null,
  alter column display_height set not null,
  alter column content_type   set not null;

-- Fix the uploaded_by_user_id FK to add ON DELETE CASCADE (0001 omitted it)
alter table public.photos
  drop constraint if exists photos_uploaded_by_user_id_fkey;

alter table public.photos
  add constraint photos_uploaded_by_user_id_fkey
    foreign key (uploaded_by_user_id)
    references public.users(id)
    on delete cascade;

-- ============================================================
-- 2. INDEXES
-- ============================================================

create index if not exists photos_trip_taken_idx   on public.photos (trip_id, taken_at);
create index if not exists photos_trip_created_idx on public.photos (trip_id, created_at);

-- ============================================================
-- 3. RLS — replace the three policies from 0001_init.sql
-- ============================================================

-- Drop old policies created in 0001_init.sql
drop policy if exists "photos_member_select" on public.photos;
drop policy if exists "photos_member_insert" on public.photos;
drop policy if exists "photos_delete"        on public.photos;

-- All trip members can see non-deleted photos
create policy "photos_member_select"
  on public.photos for select
  using (public.is_trip_member(trip_id) and deleted_at is null);

-- Any trip member can upload their own photo
create policy "photos_own_insert"
  on public.photos for insert
  with check (public.is_trip_member(trip_id) and uploaded_by_user_id = auth.uid());

-- Soft-delete (and any future edit) is uploader-or-host only
create policy "photos_uploader_or_host_update"
  on public.photos for update
  using (uploaded_by_user_id = auth.uid() or public.is_trip_host(trip_id))
  with check (uploaded_by_user_id = auth.uid() or public.is_trip_host(trip_id));

-- No hard-delete policy: deletion is soft (update deleted_at).

-- ============================================================
-- 4. Realtime
-- ============================================================
-- public.photos was already added to supabase_realtime in 0001_init.sql.
-- No action needed here.
