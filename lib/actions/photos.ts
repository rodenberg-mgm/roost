"use server";

import { createClient } from "@/lib/supabase/server";
import { signedUrls, createSignedUploadUrl, signedUrl } from "@/lib/storage";
import { recordPhotoSchema, type Photo } from "@/lib/schemas/photos";

/** Fetch a trip's photos (oldest-first; client regroups by day) with signed
 *  thumbnail URLs attached. */
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
