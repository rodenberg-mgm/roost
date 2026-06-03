# Shared Photo Album — Design Spec (v1.2)

**Date:** 2026-06-02
**Phase:** v1.2 (Roadmap §4)
**Status:** Approved for planning

---

## 1. Goal

Trip members upload phone photos that appear **live** in a shared, **by-day** album, with fast-loading thumbnails and per-photo **original** download. The album is members-only and never shown to anonymous `/trip/[token]` viewers.

The wedge is "everyone's photos, live, in one place" — not a social feed. Captions, reactions/likes, and bulk-zip download are explicitly **out of MVP scope** (see §9).

---

## 2. Key decisions (settled during brainstorm)

| Decision | Choice | Why |
|---|---|---|
| Thumbnails | **Server-stored, client-generated** thumb + display renditions | Loading hundreds of multi-MB originals into a grid is brutal on mobile; thumbs make scrolling cheap. |
| Processing site | **Client-side pre-process** | Avoids standing up server image infra / HEIC decoding in Deno or sharp; browser converts HEIC→JPEG and downscales before upload. |
| Renditions kept | **Thumb + display + original** | Full archival; bulk download (later) and per-photo download return the true camera original. |
| Bulk download | **Deferred** | Per-photo original download ships now; server-side streaming-zip is the riskiest piece and not the wedge. Add as fast-follow once dogfooded. |
| Upload transport | **Signed upload URLs** | Bytes go client→Storage directly, dodging server-action body limits & function timeouts on flaky wifi; authority to write still flows through `lib/storage/`. |
| Delete permission | **Uploader or host** | Photos are personal property; deleting someone's memory differs from unclaiming a packing item. Narrower than §3.5's "everyone can edit" default — intentional. |
| Grouping & order | **By-day, chronological (oldest→newest)** | A trip album tells a start-to-finish story; reverse-chron feels like a feed, which §10 cuts. |

---

## 3. Data model

New table `public.photos` (trip-scoped, soft-deleted, RLS modeled on `meal_cooks`).

| column | type | notes |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | Generated **client-side** before upload so storage keys can be derived pre-upload. |
| `trip_id` | uuid not null → `trips(id)` on delete cascade | |
| `uploaded_by_user_id` | uuid not null → `users(id)` on delete cascade | |
| `thumb_path` | text not null | Storage key for the grid thumbnail. |
| `display_path` | text not null | Storage key for the lightbox (~2048px) version. |
| `original_path` | text not null | Storage key for the untouched camera file. |
| `taken_at` | timestamptz **null** | From EXIF `DateTimeOriginal`. Null → group/sort by `created_at`. |
| `display_width` | int not null | Display rendition width, for masonry aspect-ratio reservation (no reflow). |
| `display_height` | int not null | Display rendition height. |
| `content_type` | text not null | Original file MIME (e.g. `image/heic`, `image/jpeg`). |
| `created_at` | timestamptz not null default `now()` | |
| `deleted_at` | timestamptz null | Soft delete. |

**Storage layout** (existing `trip-photos` bucket, via `lib/storage/`):
```
trips/{tripId}/photos/{photoId}/thumb.jpg
trips/{tripId}/photos/{photoId}/display.jpg
trips/{tripId}/photos/{photoId}/original.{ext}
```

**Indexes:** `(trip_id, taken_at)` and `(trip_id, created_at)` for grouped fetches filtered to `deleted_at is null`.

---

## 4. RLS policies

Reuse existing `public.is_trip_member(trip_id)` / `public.is_trip_host(trip_id)` helpers.

- **select:** `is_trip_member(trip_id)` (callers filter `deleted_at is null`; not enforced in policy so host tooling can see deleted rows later if needed).
- **insert:** `is_trip_member(trip_id) AND uploaded_by_user_id = auth.uid()`.
- **update (soft-delete + any future edit):** `using` and `with check` = `uploaded_by_user_id = auth.uid() OR is_trip_host(trip_id)`.
- No hard `delete` policy (soft-delete only via update; hard delete is a separate explicit admin op per CLAUDE.md).

Realtime: `alter publication supabase_realtime add table public.photos;`

Anonymous `/trip/[token]` view: photos are **not** queried on the public route. No service-role exposure of the album.

---

## 5. Storage abstraction additions (`lib/storage/index.ts`)

Two new functions; components never touch Supabase Storage directly.

- `createSignedUploadUrl(tripId, key): Promise<{ path, token/url }>` — mints a one-shot signed **upload** URL for a specific derived key. Bucket/path logic stays in the abstraction; the component receives an opaque target.
- `signedUrls(paths: string[], expiresIn?): Promise<StorageFile[]>` — batch read URLs via Supabase `createSignedUrls` (plural), for grid thumbnails.

Existing `put` / `signedUrl` / `remove` remain. Grid thumb URLs minted server-side at page load (1-hour expiry); display/original URLs minted on demand when the lightbox opens.

---

## 6. Upload pipeline (client-side)

1. **Select** — `<input type="file" accept="image/*" multiple>` (offers camera + library on mobile). No drag-drop dependency for MVP.
2. **Per file, in the browser:**
   - Read EXIF `DateTimeOriginal` → `taken_at` (`exifr`). Missing → leave null.
   - HEIC → decode to canvas-drawable bitmap (`heic2any`); JPEG/PNG draw directly.
   - Emit **thumb** (~400px longest edge, JPEG q≈0.7) and **display** (~2048px longest edge, JPEG q≈0.82). Keep **original** blob untouched. Capture display width/height.
   - Generate `photoId` (uuid) and derive the three storage keys.
3. **Upload** — request 3 signed upload URLs (server action → `lib/storage/createSignedUploadUrl`); client PUTs the three blobs directly to Storage.
4. **Record** — server action inserts the `photos` row only after all three uploads succeed. Realtime fires.

**Robustness:**
- Concurrency cap (2–3 files processed/uploaded at a time) so a phone uploading dozens doesn't exhaust memory.
- Per-file progress; per-file failure isolation (one bad file doesn't abort the batch).
- HEIC-decode failure on an old device → that file is skipped with a visible "couldn't process this photo" note (no silent drop).
- Orphan tolerance: if uploads succeed but the row insert fails, the blobs are orphaned (acceptable for MVP; a cleanup job is a later concern, not built now).

---

## 7. Album UI

**Route:** `app/(app)/trips/[id]/photos/page.tsx`, members-only via `requireTripMembership` (same guard as meals/packing). Linked as a Trip Guide tile alongside Meals/Packing.

**Grouping:** by-day under date headers using `taken_at` (fallback `created_at`), **chronological oldest→newest**. Headers read "Saturday · May 16" with the `stamp` badge treatment (brand §14.4).

**Grid:** masonry, mobile-first — 2 columns at 375px, scaling to 3–4 at wider breakpoints. Each cell renders the thumb inside a reserved aspect-ratio box (from `display_width/height`) → zero reflow. Lazy-load below the fold. Cards/borders per §14.5.

**Lightbox:** tap thumb → full-screen overlay loads the **display** version. Includes: uploader name + day, navigation between photos, **download** (fetches a signed URL to the **original**), and **delete** (visible only to uploader or host → soft-delete → realtime removes it for everyone).

**Empty state:** `topo-bg` + sage camera icon (§14.5): "No photos yet — add the first one."

**Live updates:** `useTripChannel(tripId, ["photos"], invalidate)` → TanStack Query refetch (same pattern as `meals-list.tsx`). New uploads and deletions appear live.

---

## 8. Files touched (anticipated)

- `supabase/migrations/0007_photos.sql` — table, indexes, RLS, realtime publication.
- `lib/storage/index.ts` — add `createSignedUploadUrl`, `signedUrls`.
- `lib/schemas/photos.ts` — zod types (`Photo`, grouped-by-day shape).
- `lib/actions/photos.ts` — `getPhotos`, `createUploadUrls`, `recordPhoto`, `deletePhoto`.
- `lib/photos/group.ts` — by-day grouping/sorting helper (mirrors `lib/meals/group.ts`).
- `lib/photos/process-image.ts` (client) — EXIF read, HEIC decode, thumb/display generation.
- `app/(app)/trips/[id]/photos/page.tsx` — server page (membership guard, initial fetch, batch thumb URLs).
- `app/(app)/trips/[id]/photos/photo-album.tsx` (client) — grid + grouping + realtime.
- `app/(app)/trips/[id]/photos/photo-uploader.tsx` (client) — picker, processing, progress.
- `app/(app)/trips/[id]/photos/photo-lightbox.tsx` (client) — overlay, nav, download, delete.
- Trip Guide page — add the Photos tile.
- New deps: `exifr`, `heic2any`.

---

## 9. Out of MVP scope (deliberate)

- **Bulk zip download** — deferred; per-photo original download ships instead. Revisit after dogfooding.
- **Captions** and **reactions/likes** — feed-product features; not the wedge (§10 cuts a full social layer).
- **Orphaned-blob cleanup job** — acceptable to defer; failure mode is wasted storage, not incorrectness.
- **Anonymous access to photos** — explicitly never (CLAUDE.md v1.2, §8).

---

## 10. Risks

- **HEIC decode reliability in-browser** — `heic2any` is WASM and can be slow/flaky on old devices. A decode failure skips the **whole** file (display + thumb generation both require the decode, so there's no partial upload). Mitigation: per-file isolation + a visible "couldn't process this photo" message. Acceptable for MVP.
- **Many signed URLs at page load** — hundreds of thumbs. Batch via `createSignedUrls`; consider pagination if a single trip exceeds a few hundred photos (not built now, flagged).
- **Mobile memory during large batches** — mitigated by the 2–3 concurrency cap and releasing blob references after each upload.
