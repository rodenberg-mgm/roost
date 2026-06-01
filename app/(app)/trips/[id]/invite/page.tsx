import { InviteForm } from "@/components/invite-form";
import { InviteList } from "@/components/invite-list";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface InvitePageProps {
  params: Promise<{ id: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);

  if (!isHostRole(membership.role)) {
    redirect(`/trips/${id}`);
  }

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("name")
    .eq("id", id)
    .single();

  // Fetch existing invites
  const { data: invites } = await supabase
    .from("trip_invites")
    .select("id, email, consumed_at, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/trips/${id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-light hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to trip
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink">Invite Guests</h1>
        <p className="mt-1 text-sm text-ink-light">
          Send invite links to {trip?.name || "your trip"}
        </p>
      </header>

      <div className="space-y-4">
        <div className="rounded-card border bg-card p-6 shadow-card">
          <InviteForm tripId={id} />
        </div>

        {invites && invites.length > 0 && (
          <div className="rounded-card border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold text-ink">Sent invites</h2>
            <InviteList invites={invites} />
          </div>
        )}
      </div>
    </div>
  );
}
