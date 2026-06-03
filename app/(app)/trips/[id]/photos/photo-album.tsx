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
