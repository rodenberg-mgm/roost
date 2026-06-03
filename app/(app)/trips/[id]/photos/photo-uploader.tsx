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
