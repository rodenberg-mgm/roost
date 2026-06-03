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
