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
