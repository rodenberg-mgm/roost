import { PhotoAlbum } from "./photo-album";
import { getPhotos } from "@/lib/actions/photos";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PhotosPageProps {
  params: Promise<{ id: string }>;
}

export default async function PhotosPage({ params }: PhotosPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);
  const initialPhotos = await getPhotos(id);

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/trips/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-light transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" />
          Trip Guide
        </Link>
        <h1 className="font-display text-2xl font-bold uppercase text-ink">Photos</h1>
        <p className="mt-1 text-sm text-ink-light">
          Everyone&apos;s photos, in one place. Uploads appear live.
        </p>
      </header>

      <PhotoAlbum
        tripId={id}
        initialPhotos={initialPhotos}
        currentUserId={membership.userId}
        isHost={isHostRole(membership.role)}
      />
    </div>
  );
}
