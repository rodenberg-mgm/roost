import { EditForm } from "./edit-form";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTripPage({ params }: EditPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);

  if (!isHostRole(membership.role)) {
    redirect(`/trips/${id}`);
  }

  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("name, starts_on, ends_on, city, region, house_rules, local_tips, stocked_items")
    .eq("id", id)
    .single();

  if (!trip) notFound();

  const { data: sensitiveInfo } = await supabase
    .from("trip_sensitive_info")
    .select("wifi_ssid, wifi_password, door_code, gate_code, address_line, postal_code, parking_notes")
    .eq("trip_id", id)
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
        <h1 className="font-display text-2xl font-bold text-ink">Edit Trip</h1>
      </header>
      <div className="rounded-card border bg-card p-6 shadow-card">
        <EditForm
          tripId={id}
          initialData={{
            ...trip,
            house_rules: (trip.house_rules as string[]) || [],
            local_tips: (trip.local_tips as string[]) || [],
            stocked_items: (trip.stocked_items as string[]) || [],
          }}
          sensitiveData={sensitiveInfo}
        />
      </div>
    </div>
  );
}
