import { createClient } from "@/lib/supabase/client";

const PHOTO_BUCKET = "trip-photos";
const INVENTORY_BUCKET = "inventory-images";

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
    .from(PHOTO_BUCKET)
    .uploadToSignedUrl(path, token, blob, { contentType });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

/** Upload an inventory photo blob to its signed URL (public bucket). */
export async function uploadInventoryImage(
  path: string,
  token: string,
  blob: Blob,
  contentType: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(INVENTORY_BUCKET)
    .uploadToSignedUrl(path, token, blob, { contentType });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}
