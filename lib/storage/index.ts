import { createClient } from "@/lib/supabase/server";

export interface StorageFile {
  path: string;
  signedUrl: string;
}

const BUCKET = "trip-photos";

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
