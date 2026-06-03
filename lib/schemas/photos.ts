import { z } from "zod";

// Zod v4 tightened .uuid() to enforce RFC 4122 variant bits, which rejects
// test-fixture UUIDs like "11111111-..." and Postgres-generated UUIDs that
// don't conform to the variant constraint. Use a shape-only regex that matches
// the 8-4-4-4-12 hex format — identical to what Zod v3's .uuid() accepted.
const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

/** Payload the client sends to record a photo after its three renditions
 *  have been uploaded to storage. The client generates `id` so storage keys
 *  can be derived before upload. */
export const recordPhotoSchema = z.object({
  id: uuid,
  trip_id: uuid,
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
