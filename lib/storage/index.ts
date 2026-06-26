import { createClient } from "@/lib/supabase/server";

export interface StorageFile {
  path: string;
  signedUrl: string;
}

const BUCKET = "trip-photos";

// Inventory photos live in a PUBLIC bucket: they are non-sensitive and shown to
// anonymous /trip/[token] viewers who have no session to mint signed URLs. Paths
// are unguessable UUIDs. Write authority is enforced server-side before minting
// the signed upload URL (see lib/actions/inventory.ts).
const INVENTORY_BUCKET = "inventory-images";

/** Mint a one-shot signed upload URL for an inventory photo key. */
export async function createInventoryUploadUrl(
  key: string
): Promise<{ path: string; token: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(INVENTORY_BUCKET)
    .createSignedUploadUrl(key);
  if (error || !data) {
    throw new Error(`Inventory upload URL failed: ${error?.message ?? "no data"}`);
  }
  return { path: data.path, token: data.token };
}

/** Public URL for a stored inventory photo (bucket is public). */
export function inventoryPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${INVENTORY_BUCKET}/${path}`;
}

/** Delete an inventory photo object (best-effort cleanup). */
export async function removeInventoryImage(path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(INVENTORY_BUCKET).remove([path]);
}

/**
 * Upload a file to storage.
 * All photo uploads MUST go through this interface — never call
 * Supabase Storage directly from components.
 */
export async function put(
  tripId: string,
  fileName: string,
  file: Buffer | Blob,
  contentType: string
): Promise<string> {
  const supabase = await createClient();
  const path = `trips/${tripId}/photos/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return path;
}

/**
 * Generate a signed URL for a stored file.
 * Expires in 1 hour by default.
 */
export async function signedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);

  return data.signedUrl;
}

/**
 * Delete a file from storage.
 */
export async function remove(path: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

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
