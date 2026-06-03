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
      if (active && "data" in r) setDisplayUrl(r.data ?? null);
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
