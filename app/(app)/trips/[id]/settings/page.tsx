import { SettingsForm } from "./settings-form";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { createServiceClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripSettingsPage({ params }: SettingsPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);

  if (!isHostRole(membership.role)) {
    redirect(`/trips/${id}`);
  }

  // Use service-role to read pin_hash (host can't see via RLS directly)
  const serviceClient = await createServiceClient();
  const { data: trip } = await serviceClient
    .from("trips")
    .select("require_pin_to_view, pin_hash, archived_at")
    .eq("id", id)
    .single();

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
        <h1 className="font-display text-2xl font-bold text-ink">Trip Settings</h1>
      </header>
      <div className="rounded-card border bg-card p-6 shadow-card">
        <SettingsForm
          tripId={id}
          requirePin={trip?.require_pin_to_view || false}
          hasPin={!!trip?.pin_hash}
          archived={!!trip?.archived_at}
          isPrimaryHost={membership.role === "host"}
        />
      </div>
    </div>
  );
}
