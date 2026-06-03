# Shared Photo Album Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trip members upload phone photos that appear live in a shared, by-day album with fast thumbnails and per-photo original download.

**Architecture:** The browser pre-processes each photo (read EXIF date, decode HEIC, generate a small thumbnail + a ~2048px display JPEG, keep the untouched original), then uploads all three renditions directly to Supabase Storage using short-lived **signed upload URLs** minted by `lib/storage/`. A `photos` row is inserted after the uploads succeed; `useTripChannel` makes new uploads and deletions appear live. The grid loads thumbnails into a masonry layout grouped by the day each photo was taken; tapping opens a lightbox that loads the display version and offers original download and (for the uploader or a host) delete.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + Storage + Realtime), TanStack Query, zod, Vitest. New deps: `exifr` (EXIF read), `heic2any` (HEIC decode).

**Spec:** `docs/superpowers/specs/2026-06-02-roost-photos-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/0007_photos.sql` — `photos` table, indexes, RLS, realtime publication.
- `lib/schemas/photos.ts` — zod schemas + `Photo` / `PhotoDay` types.
- `lib/photos/group.ts` — pure: group photos by day, chronological.
- `lib/photos/fit.ts` — pure: aspect-preserving downscale math (`fitWithin`).
- `lib/photos/process-image.ts` — client: EXIF read, HEIC decode, thumb/display generation (uses `fitWithin`).
- `lib/storage/client.ts` — client-side storage helper (`uploadToSignedUrl`) so components never call Supabase Storage directly.
- `lib/actions/photos.ts` — server actions: `getPhotos`, `createUploadUrls`, `recordPhoto`, `getDisplayUrl`, `getOriginalUrl`, `deletePhoto`.
- `app/(app)/trips/[id]/photos/page.tsx` — server page (membership guard + initial fetch).
- `app/(app)/trips/[id]/photos/photo-album.tsx` — client: grid, grouping, realtime, lightbox state.
- `app/(app)/trips/[id]/photos/photo-uploader.tsx` — client: picker, processing, progress.
- `app/(app)/trips/[id]/photos/photo-lightbox.tsx` — client: overlay, nav, download, delete.
- `__tests__/lib/photos/fit.test.ts`, `__tests__/lib/photos/group.test.ts`, `__tests__/lib/schemas/photos.test.ts` — unit tests.

**Modify:**
- `lib/storage/index.ts` — add `createSignedUploadUrl` and `signedUrls` (batch).
- `components/feature-tiles.tsx:32` — flip the Photos tile from `soon: true` to a real `href`.

---

## Task 1: Add dependencies

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install runtime deps**

Run: `npm install exifr heic2any`
Expected: both added to `dependencies`, no peer-dep errors.

- [ ] **Step 2: Verify they resolve**

Run: `node -e "require.resolve('exifr'); require.resolve('heic2any'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(photos): add exifr + heic2any for client image processing"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/0007_photos.sql`

- [ ] **Step 1: Write the migration**

`is_trip_member` / `is_trip_host` already exist (used in `0005_meal_cooks.sql`). Mirror that file's RLS style.

```sql
-- 0007_photos.sql
-- Shared photo album (v1.2): photos table + RLS + realtime.

-- ============================================================
-- 1. CREATE photos
-- ============================================================
create table public.photos (
  id                   uuid primary key default gen_random_uuid(),
  trip_id              uuid not null references public.trips(id) on delete cascade,
  uploaded_by_user_id  uuid not null references public.users(id) on delete cascade,
  thumb_path           text not null,
  display_path         text not null,
  original_path        text not null,
  taken_at             timestamptz,
  display_width        int  not null,
  display_height       int  not null,
  content_type         text not null,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index photos_trip_taken_idx   on public.photos (trip_id, taken_at);
create index photos_trip_created_idx on public.photos (trip_id, created_at);

alter table public.photos enable row level security;

-- ============================================================
-- 2. RLS
-- ============================================================
create policy "photos_member_select"
  on public.photos for select
  using (public.is_trip_member(trip_id));

create policy "photos_own_insert"
  on public.photos for insert
  with check (public.is_trip_member(trip_id) and uploaded_by_user_id = auth.uid());

-- Soft-delete (and any future edit) is uploader-or-host only.
create policy "photos_uploader_or_host_update"
  on public.photos for update
  using (uploaded_by_user_id = auth.uid() or public.is_trip_host(trip_id))
  with check (uploaded_by_user_id = auth.uid() or public.is_trip_host(trip_id));

-- No hard-delete policy: deletion is soft (update deleted_at).

-- ============================================================
-- 3. Realtime
-- ============================================================
alter publication supabase_realtime add table public.photos;
```

- [ ] **Step 2: Apply the migration**

Run (whichever the project uses to apply migrations to the linked Supabase project — match the workflow used for `0006`):
`npx supabase db push`
Expected: `0007_photos.sql` applied, no errors. If the project applies migrations via the Supabase dashboard SQL editor instead, paste and run the file there.

- [ ] **Step 3: Verify the table + RLS exist**

Run: `npx supabase db diff` (expect no pending diff) OR confirm in the dashboard that `public.photos` exists with RLS enabled and three policies.
Expected: table present, `rowsecurity = true`, policies `photos_member_select` / `photos_own_insert` / `photos_uploader_or_host_update`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_photos.sql
git commit -m "feat(photos): photos table with trip-scoped RLS + realtime"
```

---

## Task 3: Downscale math (`fitWithin`) — TDD

**Files:**
- Create: `lib/photos/fit.ts`
- Test: `__tests__/lib/photos/fit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/photos/fit";

describe("fitWithin", () => {
  it("downscales a landscape image to the max longest edge", () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it("downscales a portrait image to the max longest edge", () => {
    expect(fitWithin(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it("never upscales below the max", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it("rounds to whole pixels", () => {
    expect(fitWithin(1000, 333, 400)).toEqual({ width: 400, height: 133 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/photos/fit.test.ts`
Expected: FAIL — cannot resolve `@/lib/photos/fit`.

- [ ] **Step 3: Write the implementation**

```typescript
/** Scale (w,h) so the longest edge is at most `max`, preserving aspect ratio.
 *  Never upscales. Returns whole-pixel dimensions. */
export function fitWithin(
  width: number,
  height: number,
  max: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/photos/fit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/photos/fit.ts __tests__/lib/photos/fit.test.ts
git commit -m "feat(photos): aspect-preserving downscale helper"
```

---

## Task 4: Schemas + types

**Files:**
- Create: `lib/schemas/photos.ts`
- Test: `__tests__/lib/schemas/photos.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { recordPhotoSchema } from "@/lib/schemas/photos";

const base = {
  id: "11111111-1111-1111-1111-111111111111",
  trip_id: "22222222-2222-2222-2222-222222222222",
  thumb_path: "trips/t/photos/p/thumb.jpg",
  display_path: "trips/t/photos/p/display.jpg",
  original_path: "trips/t/photos/p/original.heic",
  display_width: 2048,
  display_height: 1536,
  content_type: "image/heic",
  taken_at: "2026-05-16T18:30:00.000Z",
};

describe("recordPhotoSchema", () => {
  it("accepts a valid record", () => {
    expect(recordPhotoSchema.safeParse(base).success).toBe(true);
  });

  it("allows a null taken_at", () => {
    expect(recordPhotoSchema.safeParse({ ...base, taken_at: null }).success).toBe(true);
  });

  it("rejects a non-positive dimension", () => {
    expect(recordPhotoSchema.safeParse({ ...base, display_width: 0 }).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(recordPhotoSchema.safeParse({ ...base, id: "nope" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/schemas/photos.test.ts`
Expected: FAIL — cannot resolve `@/lib/schemas/photos`.

- [ ] **Step 3: Write the implementation**

```typescript
import { z } from "zod";

/** Payload the client sends to record a photo after its three renditions
 *  have been uploaded to storage. The client generates `id` so storage keys
 *  can be derived before upload. */
export const recordPhotoSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  thumb_path: z.string().min(1).max(500),
  display_path: z.string().min(1).max(500),
  original_path: z.string().min(1).max(500),
  display_width: z.number().int().positive(),
  display_height: z.number().int().positive(),
  content_type: z.string().min(1).max(100),
  taken_at: z.string().datetime().nullable(),
});
export type RecordPhotoInput = z.infer<typeof recordPhotoSchema>;

/** A photo as rendered in the album. `thumb_url` is a signed URL minted
 *  server-side at fetch time. */
export interface Photo {
  id: string;
  trip_id: string;
  uploaded_by_user_id: string;
  uploader_name: string;
  thumb_path: string;
  display_path: string;
  original_path: string;
  taken_at: string | null;
  display_width: number;
  display_height: number;
  content_type: string;
  created_at: string;
  thumb_url: string;
}

/** Photos grouped under one calendar day (yyyy-mm-dd). */
export interface PhotoDay {
  day: string;
  photos: Photo[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/schemas/photos.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/photos.ts __tests__/lib/schemas/photos.test.ts
git commit -m "feat(photos): zod schema + Photo/PhotoDay types"
```

---

## Task 5: Group-by-day helper — TDD

**Files:**
- Create: `lib/photos/group.ts`
- Test: `__tests__/lib/photos/group.test.ts`

Mirrors `lib/meals/group.ts`. Groups by the local calendar day of `taken_at` (fallback `created_at`), chronological oldest→newest; photos within a day sorted by time ascending.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { groupPhotosByDay } from "@/lib/photos/group";
import type { Photo } from "@/lib/schemas/photos";

function photo(p: Partial<Photo>): Photo {
  return {
    id: p.id ?? "x",
    trip_id: "t",
    uploaded_by_user_id: "u",
    uploader_name: "Matt",
    thumb_path: "thumb",
    display_path: "display",
    original_path: "original",
    taken_at: p.taken_at ?? null,
    display_width: 100,
    display_height: 100,
    content_type: "image/jpeg",
    created_at: p.created_at ?? "2026-05-16T12:00:00.000Z",
    thumb_url: "url",
  };
}

describe("groupPhotosByDay", () => {
  it("groups by the day of taken_at, chronological", () => {
    const days = groupPhotosByDay([
      photo({ id: "b", taken_at: "2026-05-17T09:00:00.000Z" }),
      photo({ id: "a", taken_at: "2026-05-16T20:00:00.000Z" }),
    ]);
    expect(days.map((d) => d.day)).toEqual(["2026-05-16", "2026-05-17"]);
    expect(days[0].photos[0].id).toBe("a");
  });

  it("sorts photos within a day by time ascending", () => {
    const days = groupPhotosByDay([
      photo({ id: "late", taken_at: "2026-05-16T20:00:00.000Z" }),
      photo({ id: "early", taken_at: "2026-05-16T08:00:00.000Z" }),
    ]);
    expect(days[0].photos.map((p) => p.id)).toEqual(["early", "late"]);
  });

  it("falls back to created_at when taken_at is null", () => {
    const days = groupPhotosByDay([
      photo({ id: "c", taken_at: null, created_at: "2026-05-18T10:00:00.000Z" }),
    ]);
    expect(days[0].day).toBe("2026-05-18");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/photos/group.test.ts`
Expected: FAIL — cannot resolve `@/lib/photos/group`.

- [ ] **Step 3: Write the implementation**

```typescript
import type { Photo, PhotoDay } from "@/lib/schemas/photos";

/** The effective timestamp used for grouping/sorting (taken_at, else created_at). */
function effectiveTime(p: Photo): string {
  return p.taken_at ?? p.created_at;
}

/** yyyy-mm-dd in the runtime's local timezone. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Group photos by calendar day, chronological oldest->newest, with each day's
 *  photos sorted by time ascending. */
export function groupPhotosByDay(photos: Photo[]): PhotoDay[] {
  const byDay = new Map<string, Photo[]>();
  for (const p of photos) {
    const key = dayKey(effectiveTime(p));
    const arr = byDay.get(key) ?? [];
    arr.push(p);
    byDay.set(key, arr);
  }
  return [...byDay.keys()].sort().map((day) => ({
    day,
    photos: byDay
      .get(day)!
      .slice()
      .sort((a, b) => effectiveTime(a).localeCompare(effectiveTime(b))),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/photos/group.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/photos/group.ts __tests__/lib/photos/group.test.ts
git commit -m "feat(photos): group-photos-by-day helper"
```

---

## Task 6: Storage abstraction additions

**Files:**
- Modify: `lib/storage/index.ts`
- Create: `lib/storage/client.ts`

No unit test: these wrap Supabase Storage I/O (verified end-to-end in Task 11). Keep the bucket constant and path logic inside the abstraction.

- [ ] **Step 1: Add server-side signed-URL functions to `lib/storage/index.ts`**

Append to the existing file (which already exports `put` / `signedUrl` / `remove` and defines `const BUCKET = "trip-photos"`):

```typescript
/**
 * Mint a one-shot signed UPLOAD url for a specific storage key. The client
 * uploads bytes directly to Storage with this (see lib/storage/client.ts), so
 * large files never pass through a server function. Authority to write still
 * originates here.
 */
export async function createSignedUploadUrl(
  path: string
): Promise<{ path: string; token: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Signed upload URL failed: ${error?.message ?? "no data"}`);
  }
  return { path: data.path, token: data.token };
}

/**
 * Batch-mint signed READ urls (e.g. all grid thumbnails). Preserves input
 * order; any individual failure yields an empty string for that entry.
 */
export async function signedUrls(
  paths: string[],
  expiresIn: number = 3600
): Promise<string[]> {
  if (paths.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error || !data) {
    throw new Error(`Signed URLs failed: ${error?.message ?? "no data"}`);
  }
  return data.map((d) => d.signedUrl ?? "");
}
```

- [ ] **Step 2: Create the client-side upload helper `lib/storage/client.ts`**

```typescript
import { createClient } from "@/lib/supabase/client";

const BUCKET = "trip-photos";

/**
 * Upload a blob to Storage using a signed upload URL minted server-side
 * (lib/storage/createSignedUploadUrl). This is the ONLY place a browser
 * touches Supabase Storage directly — components go through here.
 */
export async function uploadToSignedUrl(
  path: string,
  token: string,
  blob: Blob,
  contentType: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, blob, { contentType });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/storage/index.ts lib/storage/client.ts
git commit -m "feat(photos): signed upload-url minting + client upload helper"
```

---

## Task 7: Client image processing

**Files:**
- Create: `lib/photos/process-image.ts`

Browser-only (canvas + `createImageBitmap`). Not unit-tested (needs a real canvas); verified end-to-end in Task 11. Uses `fitWithin` from Task 3.

- [ ] **Step 1: Write the implementation**

```typescript
import heic2any from "heic2any";
import exifr from "exifr";
import { fitWithin } from "@/lib/photos/fit";

const DISPLAY_MAX = 2048;
const THUMB_MAX = 400;
const DISPLAY_QUALITY = 0.82;
const THUMB_QUALITY = 0.7;

export interface ProcessedPhoto {
  thumb: Blob;
  display: Blob;
  original: Blob;
  displayWidth: number;
  displayHeight: number;
  contentType: string;
  takenAt: string | null;
}

function isHeic(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.hei[cf]$/i.test(file.name)
  );
}

/** Read EXIF DateTimeOriginal as an ISO string, or null if absent/unreadable. */
async function readTakenAt(file: File): Promise<string | null> {
  try {
    const exif = await exifr.parse(file, ["DateTimeOriginal"]);
    const d = exif?.DateTimeOriginal;
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

/** Draw a bitmap scaled into a canvas and return a JPEG blob. */
async function toJpeg(
  bitmap: ImageBitmap,
  max: number,
  quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Canvas toBlob failed");
  return { blob, width, height };
}

/**
 * Turn a selected file into thumb + display JPEGs (keeping the untouched
 * original) and read its EXIF capture time. Throws if the image can't be
 * decoded (caller skips that file with a visible message).
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const takenAt = await readTakenAt(file);

  // Decode source: HEIC -> JPEG blob first, otherwise use the file directly.
  let decodeSource: Blob = file;
  if (isHeic(file)) {
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    decodeSource = Array.isArray(converted) ? converted[0] : converted;
  }

  // `imageOrientation: from-image` bakes EXIF rotation into the pixels.
  const bitmap = await createImageBitmap(decodeSource, {
    imageOrientation: "from-image",
  });

  try {
    const display = await toJpeg(bitmap, DISPLAY_MAX, DISPLAY_QUALITY);
    const thumb = await toJpeg(bitmap, THUMB_MAX, THUMB_QUALITY);
    return {
      thumb: thumb.blob,
      display: display.blob,
      original: file,
      displayWidth: display.width,
      displayHeight: display.height,
      contentType: file.type || "application/octet-stream",
      takenAt,
    };
  } finally {
    bitmap.close();
  }
}

/** File extension for the original, derived from its name (fallback "bin"). */
export function originalExt(file: File): string {
  const m = file.name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "bin";
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `heic2any` lacks bundled types, add `// @ts-expect-error no types` above its import with a `// reason: heic2any ships no types` note — but it does ship types as of current versions; only add if tsc complains.)

- [ ] **Step 3: Commit**

```bash
git add lib/photos/process-image.ts
git commit -m "feat(photos): client-side EXIF read + HEIC decode + rendition generation"
```

---

## Task 8: Server actions

**Files:**
- Create: `lib/actions/photos.ts`

Mirrors `lib/actions/meals.ts` conventions (`"use server"`, server client, `{ data }`/`{ error }` returns). `getPhotos` attaches signed thumb URLs so the client never mints URLs.

- [ ] **Step 1: Write the implementation**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { signedUrls, createSignedUploadUrl, signedUrl } from "@/lib/storage";
import { recordPhotoSchema, type Photo } from "@/lib/schemas/photos";

/** Fetch a trip's photos (newest-uploaded first from DB; client regroups by
 *  day) with signed thumbnail URLs attached. */
export async function getPhotos(tripId: string): Promise<Photo[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, trip_id, uploaded_by_user_id, thumb_path, display_path, original_path, taken_at, display_width, display_height, content_type, created_at, users:uploaded_by_user_id(display_name)"
    )
    .eq("trip_id", tripId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const urls = await signedUrls(data.map((r) => r.thumb_path));

  return data.map((row, i) => {
    const u = row.users as unknown as { display_name: string } | null;
    return {
      id: row.id,
      trip_id: row.trip_id,
      uploaded_by_user_id: row.uploaded_by_user_id,
      uploader_name: u?.display_name ?? "Someone",
      thumb_path: row.thumb_path,
      display_path: row.display_path,
      original_path: row.original_path,
      taken_at: row.taken_at,
      display_width: row.display_width,
      display_height: row.display_height,
      content_type: row.content_type,
      created_at: row.created_at,
      thumb_url: urls[i] ?? "",
    };
  });
}

/** Mint signed upload URLs for a photo's three renditions. Keys are derived
 *  from a client-generated photoId. */
export async function createUploadUrls(input: {
  trip_id: string;
  photo_id: string;
  original_ext: string;
}): Promise<
  | { error: string }
  | {
      data: {
        thumb: { path: string; token: string };
        display: { path: string; token: string };
        original: { path: string; token: string };
        thumb_path: string;
        display_path: string;
        original_path: string;
      };
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Confirm membership before minting write authority.
  const { data: member } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", input.trip_id)
    .eq("user_id", user.id)
    .single();
  if (!member) return { error: "Not a member of this trip" };

  const base = `trips/${input.trip_id}/photos/${input.photo_id}`;
  const thumbPath = `${base}/thumb.jpg`;
  const displayPath = `${base}/display.jpg`;
  const originalPath = `${base}/original.${input.original_ext}`;

  try {
    const [thumb, display, original] = await Promise.all([
      createSignedUploadUrl(thumbPath),
      createSignedUploadUrl(displayPath),
      createSignedUploadUrl(originalPath),
    ]);
    return {
      data: {
        thumb,
        display,
        original,
        thumb_path: thumbPath,
        display_path: displayPath,
        original_path: originalPath,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start upload" };
  }
}

/** Insert the photos row after the three renditions are uploaded. */
export async function recordPhoto(input: unknown) {
  const parsed = recordPhotoSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid photo data" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // RLS (photos_own_insert) enforces membership + ownership.
  const { error } = await supabase.from("photos").insert({
    id: parsed.data.id,
    trip_id: parsed.data.trip_id,
    uploaded_by_user_id: user.id,
    thumb_path: parsed.data.thumb_path,
    display_path: parsed.data.display_path,
    original_path: parsed.data.original_path,
    taken_at: parsed.data.taken_at,
    display_width: parsed.data.display_width,
    display_height: parsed.data.display_height,
    content_type: parsed.data.content_type,
  });
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

/** Signed URL for the display (lightbox) rendition. */
export async function getDisplayUrl(displayPath: string) {
  try {
    return { data: await signedUrl(displayPath) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "URL failed" };
  }
}

/** Signed URL for the original (download). */
export async function getOriginalUrl(originalPath: string) {
  try {
    return { data: await signedUrl(originalPath) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "URL failed" };
  }
}

/** Soft-delete a photo. RLS (photos_uploader_or_host_update) restricts to the
 *  uploader or a host; a blocked write affects 0 rows, so report that. */
export async function deletePhoto(photoId: string) {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("photos")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", photoId)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  if (!count) return { error: "Only the uploader or a host can remove this photo" };
  return { data: { ok: true } };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`signedUrl`, `signedUrls`, `createSignedUploadUrl` all exported from `lib/storage/index.ts` — confirm the import path `@/lib/storage` resolves to that index.)

- [ ] **Step 3: Commit**

```bash
git add lib/actions/photos.ts
git commit -m "feat(photos): server actions (fetch, upload-urls, record, urls, delete)"
```

---

## Task 9: Album page (server) + lightbox + grid (client)

**Files:**
- Create: `app/(app)/trips/[id]/photos/page.tsx`
- Create: `app/(app)/trips/[id]/photos/photo-lightbox.tsx`
- Create: `app/(app)/trips/[id]/photos/photo-album.tsx`

- [ ] **Step 1: Write the server page**

Mirrors `app/(app)/trips/[id]/meals/page.tsx` (membership guard + initial fetch + header).

```tsx
import { PhotoAlbum } from "./photo-album";
import { getPhotos } from "@/lib/actions/photos";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PhotosPageProps {
  params: Promise<{ id: string }>;
}

export default async function PhotosPage({ params }: PhotosPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);
  const initialPhotos = await getPhotos(id);

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/trips/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-light transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" />
          Trip Guide
        </Link>
        <h1 className="font-display text-2xl font-bold uppercase text-ink">Photos</h1>
        <p className="mt-1 text-sm text-ink-light">
          Everyone&apos;s photos, in one place. Uploads appear live.
        </p>
      </header>

      <PhotoAlbum
        tripId={id}
        initialPhotos={initialPhotos}
        currentUserId={membership.userId}
        isHost={isHostRole(membership.role)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the lightbox client component**

```tsx
"use client";

import type { Photo } from "@/lib/schemas/photos";
import { getDisplayUrl, getOriginalUrl } from "@/lib/actions/photos";
import { ChevronLeft, ChevronRight, Download, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface PhotoLightboxProps {
  photos: Photo[];
  index: number;
  currentUserId: string;
  isHost: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDelete: (photoId: string) => void;
}

export function PhotoLightbox({
  photos,
  index,
  currentUserId,
  isHost,
  onClose,
  onNavigate,
  onDelete,
}: PhotoLightboxProps) {
  const photo = photos[index];
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDisplayUrl(null);
    getDisplayUrl(photo.display_path).then((r) => {
      if (active && "data" in r) setDisplayUrl(r.data);
    });
    return () => {
      active = false;
    };
  }, [photo.display_path]);

  const canDelete = isHost || photo.uploaded_by_user_id === currentUserId;
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  async function download() {
    const r = await getOriginalUrl(photo.original_path);
    if ("data" in r) window.open(r.data, "_blank");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink/95"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between p-4 text-bone">
        <span className="font-mono text-xs uppercase tracking-wider text-bone/70">
          {photo.uploader_name}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={download} aria-label="Download original" className="p-2 hover:text-sage">
            <Download className="h-5 w-5" />
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(photo.id)}
              aria-label="Delete photo"
              className="p-2 hover:text-brick"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="p-2 hover:text-sage">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {hasPrev && (
          <button
            onClick={() => onNavigate(index - 1)}
            aria-label="Previous"
            className="absolute left-2 z-10 rounded-full bg-ink/40 p-2 text-bone hover:bg-ink/60"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-bone/30 border-t-bone" />
        )}
        {hasNext && (
          <button
            onClick={() => onNavigate(index + 1)}
            aria-label="Next"
            className="absolute right-2 z-10 rounded-full bg-ink/40 p-2 text-bone hover:bg-ink/60"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the album client component**

Uses `useTripChannel(["photos"])` + TanStack Query exactly like `meals-list.tsx`. CSS-columns masonry; reserved aspect-ratio boxes from `display_width/height`. Renders the uploader and the lightbox.

```tsx
"use client";

import { PhotoUploader } from "./photo-uploader";
import { PhotoLightbox } from "./photo-lightbox";
import { StampBadge } from "@/components/stamp-badge";
import { deletePhoto, getPhotos } from "@/lib/actions/photos";
import { groupPhotosByDay } from "@/lib/photos/group";
import type { Photo } from "@/lib/schemas/photos";
import { useTripChannel } from "@/lib/realtime/use-trip-channel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

const PHOTO_TABLES = ["photos"];

function formatDay(day: string): string {
  return new Date(day + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

interface PhotoAlbumProps {
  tripId: string;
  initialPhotos: Photo[];
  currentUserId: string;
  isHost: boolean;
}

export function PhotoAlbum({
  tripId,
  initialPhotos,
  currentUserId,
  isHost,
}: PhotoAlbumProps) {
  const queryClient = useQueryClient();

  const { data: photos = [] } = useQuery({
    queryKey: ["photos", tripId],
    queryFn: () => getPhotos(tripId),
    initialData: initialPhotos,
    initialDataUpdatedAt: 0,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["photos", tripId] });
  }, [queryClient, tripId]);
  useTripChannel(tripId, PHOTO_TABLES, invalidate);

  const days = useMemo(() => groupPhotosByDay(photos), [photos]);
  const flat = useMemo(() => days.flatMap((d) => d.photos), [days]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const del = useMutation({
    mutationFn: (photoId: string) => deletePhoto(photoId),
    onSuccess: () => {
      setLightboxIndex(null);
      invalidate();
    },
  });

  const flatIndexOf = (photoId: string) => flat.findIndex((p) => p.id === photoId);

  return (
    <div>
      <div className="mb-5">
        <PhotoUploader tripId={tripId} onUploaded={invalidate} />
      </div>

      {photos.length === 0 ? (
        <div className="topo-bg flex flex-col items-center justify-center rounded-card border bg-card p-10 text-center shadow-card">
          <ImageIcon className="mb-3 h-10 w-10 text-sage" />
          <p className="text-sm text-ink-light">No photos yet — add the first one.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d.day}>
              <div className="mb-3">
                <StampBadge variant="kraft">{formatDay(d.day)}</StampBadge>
              </div>
              <div className="columns-2 gap-2.5 md:columns-3 lg:columns-4 [&>*]:mb-2.5">
                {d.photos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setLightboxIndex(flatIndexOf(p.id))}
                    className="block w-full overflow-hidden rounded-card border bg-card shadow-card"
                    style={{ aspectRatio: `${p.display_width} / ${p.display_height}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumb_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {lightboxIndex !== null && flat[lightboxIndex] && (
        <PhotoLightbox
          photos={flat}
          index={lightboxIndex}
          currentUserId={currentUserId}
          isHost={isHost}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDelete={(photoId) => del.mutate(photoId)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`PhotoUploader` is created in Task 10; tsc will error on its import until then — acceptable mid-task. If executing tasks strictly in order, defer this typecheck to Task 10 Step 2.)

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/trips/[id]/photos/page.tsx" "app/(app)/trips/[id]/photos/photo-lightbox.tsx" "app/(app)/trips/[id]/photos/photo-album.tsx"
git commit -m "feat(photos): album page, masonry grid, by-day grouping, lightbox"
```

---

## Task 10: Uploader (client)

**Files:**
- Create: `app/(app)/trips/[id]/photos/photo-uploader.tsx`

Picker → per-file process (Task 7) → mint URLs (Task 8) → upload three blobs (Task 6 client helper) → record row. Concurrency cap of 2; per-file failure isolation; visible skip message.

- [ ] **Step 1: Write the uploader**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { createUploadUrls, recordPhoto } from "@/lib/actions/photos";
import { processPhoto, originalExt } from "@/lib/photos/process-image";
import { uploadToSignedUrl } from "@/lib/storage/client";
import { ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

const CONCURRENCY = 2;

interface PhotoUploaderProps {
  tripId: string;
  onUploaded: () => void;
}

/** Browser-side uuid (no extra dep; crypto.randomUUID is available in all
 *  supported browsers). */
function uuid(): string {
  return crypto.randomUUID();
}

export function PhotoUploader({ tripId, onUploaded }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const busy = total > 0 && done + failed < total;

  async function uploadOne(file: File): Promise<boolean> {
    try {
      const processed = await processPhoto(file);
      const photoId = uuid();

      const urls = await createUploadUrls({
        trip_id: tripId,
        photo_id: photoId,
        original_ext: originalExt(file),
      });
      if ("error" in urls) throw new Error(urls.error);

      await Promise.all([
        uploadToSignedUrl(urls.data.thumb.path, urls.data.thumb.token, processed.thumb, "image/jpeg"),
        uploadToSignedUrl(urls.data.display.path, urls.data.display.token, processed.display, "image/jpeg"),
        uploadToSignedUrl(urls.data.original.path, urls.data.original.token, processed.original, processed.contentType),
      ]);

      const rec = await recordPhoto({
        id: photoId,
        trip_id: tripId,
        thumb_path: urls.data.thumb_path,
        display_path: urls.data.display_path,
        original_path: urls.data.original_path,
        display_width: processed.displayWidth,
        display_height: processed.displayHeight,
        content_type: processed.contentType,
        taken_at: processed.takenAt,
      });
      if ("error" in rec) throw new Error(rec.error);
      return true;
    } catch {
      return false;
    }
  }

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    setTotal(list.length);
    setDone(0);
    setFailed(0);

    // Simple concurrency-capped worker pool.
    let cursor = 0;
    async function worker() {
      while (cursor < list.length) {
        const file = list[cursor++];
        const ok = await uploadOne(file);
        if (ok) {
          setDone((n) => n + 1);
          onUploaded();
        } else {
          setFailed((n) => n + 1);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // Reset the picker so the same files can be re-selected if needed.
    if (inputRef.current) inputRef.current.value = "";
    // Leave the summary visible briefly, then clear.
    setTimeout(() => setTotal(0), 4000);
  }

  return (
    <div className="rounded-card border bg-card p-4 shadow-card">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
        }}
      />
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading {done + failed}/{total}…
          </>
        ) : (
          <>
            <ImagePlus className="h-4 w-4" />
            Add Photos
          </>
        )}
      </Button>
      {!busy && failed > 0 && (
        <p className="mt-2 text-center text-xs text-brick">
          {failed} photo{failed > 1 ? "s" : ""} couldn&apos;t be processed and {failed > 1 ? "were" : "was"} skipped.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck the whole feature**

Run: `npx tsc --noEmit`
Expected: no errors (Task 9's import of `PhotoUploader` now resolves).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors (the `<img>` eslint-disable comments in Task 9/this file keep `@next/next/no-img-element` quiet; signed URLs aren't compatible with `next/image` loaders here).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/trips/[id]/photos/photo-uploader.tsx"
git commit -m "feat(photos): multi-file uploader with client processing + signed-url upload"
```

---

## Task 11: Wire the Trip Guide tile + end-to-end verification

**Files:**
- Modify: `components/feature-tiles.tsx:32`

- [ ] **Step 1: Flip the Photos tile to a real link**

In `components/feature-tiles.tsx`, change the Photos tile from a `soon` stub to a real route:

```tsx
    { label: "Photos", icon: ImageIcon, href: `/trips/${tripId}/photos` },
```

(Remove `soon: true`; keep the `ImageIcon` import.)

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — existing tests plus `fit`, `group`, and `photos` schema tests.

- [ ] **Step 3: Typecheck + lint + build**

Run: `npx tsc --noEmit; if ($?) { npm run lint; if ($?) { npm run build } }`
Expected: all clean; build succeeds.

- [ ] **Step 4: Manual end-to-end check (dev server, real Supabase project)**

Run: `npm run dev`, then on a trip you're a member of:
1. Trip Guide → **Photos** tile now links (no "Soon" pill).
2. **Add Photos** → select several images including at least one iPhone HEIC → progress counts up → grid fills, grouped under day headers, oldest day first, no layout reflow as thumbs load.
3. Open a second browser/device on the same trip → confirm a new upload appears live (realtime).
4. Tap a photo → lightbox shows the display version → navigate prev/next → **Download** opens the original.
5. As the uploader, delete a photo → it disappears for everyone (realtime). As a host, confirm you can delete someone else's. As a non-host non-uploader, confirm no delete button appears.
6. Resize to 375px → grid is 2 columns, lightbox controls reachable.
7. Confirm an anonymous `/trip/[token]` view shows **no** photos (album route is members-only; tile/section absent from public view).

Document the result of each step. If any fail, fix before committing.

- [ ] **Step 5: Commit**

```bash
git add components/feature-tiles.tsx
git commit -m "feat(photos): link the Photos tile from the Trip Guide"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** thumbnails (Tasks 3,7) · client pre-process + HEIC (Task 7) · thumb+display+original renditions (Tasks 7,8) · signed-url direct upload (Tasks 6,8,10) · per-photo original download (Tasks 8,9) · by-day chronological grid (Tasks 5,9) · uploader-or-host delete (Tasks 2,8,9) · realtime (Task 9) · members-only / no anonymous access (Tasks 8,9, verified Task 11) · bulk-zip & captions & reactions intentionally absent (spec §9).
- **Orphaned blobs:** if `recordPhoto` fails after uploads succeed, the three blobs are orphaned. Accepted MVP gap (spec §10); no cleanup job built.
- **Type consistency:** `Photo` / `PhotoDay` defined in Task 4 are the only shapes used in Tasks 5, 8, 9. Action return shape is `{ data } | { error }`, matched in the client via `"error" in r` / `"data" in r`.
- **`crypto.randomUUID()`** is used client-side (Task 10) — available in all supported browsers over HTTPS/localhost; no `uuid` dep needed.
