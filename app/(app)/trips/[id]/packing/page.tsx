import { PackingList } from "./packing-list";
import { getPacking } from "@/lib/actions/packing";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PackingPageProps {
  params: Promise<{ id: string }>;
}

export default async function PackingPage({ params }: PackingPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);
  const initialItems = await getPacking(id);

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
        <h1 className="font-display text-2xl font-bold uppercase text-ink">Packing</h1>
        <p className="mt-1 text-sm text-ink-light">
          Claim what you&apos;ll bring. Updates appear live for everyone.
        </p>
      </header>

      <PackingList
        tripId={id}
        initialItems={initialItems}
        currentUserId={membership.userId}
        isHost={isHostRole(membership.role)}
      />
    </div>
  );
}
