// app/trip/[token]/page.tsx
import { TripInfoSection } from "@/components/trip-info-section";
import { StampBadge } from "@/components/stamp-badge";
import { InventoryBrowse, SuggestedBrowse } from "@/components/inventory-browse";
import { inventoryPublicUrl } from "@/lib/storage";
import type { InventoryItem, SuggestedItem } from "@/lib/schemas/inventory";
import { validateInviteToken } from "@/lib/trip-access/validate-token";
import { createServiceClient, createClient } from "@/lib/supabase/server";
import {
  Calendar,
  MapPin,
  Users,
  ScrollText,
  Lightbulb,
  Package,
  ClipboardList,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface TripViewProps {
  params: Promise<{ token: string }>;
}

export default async function TripViewPage({ params }: TripViewProps) {
  const { token } = await params;
  const validation = await validateInviteToken(token);

  if (!validation.valid || !validation.tripId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            {validation.error || "Invalid invite"}
          </h1>
          <p className="mt-2 text-sm text-ink-light">
            This invite link is no longer valid. Ask your host for a new one.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-forest hover:text-forest-dark">
            Go to Roost
          </Link>
        </div>
      </main>
    );
  }

  // Check if user is already authenticated and a member
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  let redirectTo: string | null = null;

  if (user) {
    const { data: member } = await authClient
      .from("trip_members")
      .select("id")
      .eq("trip_id", validation.tripId)
      .eq("user_id", user.id)
      .single();

    if (member) {
      redirectTo = `/trips/${validation.tripId}`;
    }
  }

  if (redirectTo) {
    redirect(redirectTo);
  }

  // Use service-role to read trip data (anonymous viewer has no RLS session)
  const serviceClient = await createServiceClient();

  const { data: trip } = await serviceClient
    .from("trips")
    .select("*")
    .eq("id", validation.tripId)
    .is("deleted_at", null)
    .single();

  if (!trip) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Trip not found</h1>
          <p className="mt-2 text-sm text-ink-light">This trip may have been removed.</p>
        </div>
      </main>
    );
  }

  // Fetch members (non-sensitive: just names and roles)
  const { data: members } = await serviceClient
    .from("trip_members")
    .select("id, role, joined_at, invited_email, users:user_id(display_name)")
    .eq("trip_id", validation.tripId);

  // Inventory + suggestions (non-sensitive) for the anonymous viewer. Personal /
  // household packing is intentionally NOT fetched here.
  const { data: inventoryRows } = await serviceClient
    .from("trip_inventory_items")
    .select("id, category, title, quantity, detail, image_path, sort_order")
    .eq("trip_id", validation.tripId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const inventory: InventoryItem[] = (inventoryRows ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    quantity: r.quantity,
    detail: r.detail,
    image_path: r.image_path,
    image_url: inventoryPublicUrl(r.image_path),
    sort_order: r.sort_order,
  }));

  const { data: suggestedRows } = await serviceClient
    .from("trip_suggested_items")
    .select("id, category, title, provided, sort_order")
    .eq("trip_id", validation.tripId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const suggestions: SuggestedItem[] = (suggestedRows ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    provided: Boolean(r.provided),
    sort_order: r.sort_order,
  }));

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const startDate = formatDate(trip.starts_on);
  const endDate = formatDate(trip.ends_on);
  const dateDisplay = startDate && endDate
    ? `${startDate} — ${endDate}`
    : startDate
    ? `Starting ${startDate}`
    : "Dates TBD";

  return (
    <main className="min-h-screen bg-page pb-20">
      <div className="mx-auto w-full max-w-lg px-4 pt-6 sm:max-w-2xl sm:px-6">
        <header className="mb-6">
          <div className="mb-2">
            <StampBadge variant="forest">You&apos;re Invited</StampBadge>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">{trip.name}</h1>
          {(trip.city || trip.region) && (
            <p className="mt-1 text-sm text-ink-light">
              {[trip.city, trip.region].filter(Boolean).join(", ")}
            </p>
          )}
        </header>

        <div className="space-y-4">
          <TripInfoSection icon={Calendar} title="Dates">
            <p className="text-sm text-ink">{dateDisplay}</p>
          </TripInfoSection>

          {(trip.city || trip.region) && (
            <TripInfoSection icon={MapPin} title="Location">
              <p className="text-sm text-ink">
                {[trip.city, trip.region].filter(Boolean).join(", ")}
              </p>
            </TripInfoSection>
          )}

          <TripInfoSection icon={Users} title={`Guests (${members?.length || 0})`}>
            <ul className="space-y-2">
              {members?.map((m) => {
                const memberUser = m.users as unknown as { display_name: string } | null;
                const name = memberUser?.display_name || m.invited_email || "Invited guest";
                return (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{name}</span>
                    <span className="text-xs text-ink-light">
                      {m.role === "host" ? "Host" : m.role === "co-host" ? "Co-host" : "Guest"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </TripInfoSection>

          {(trip.house_rules as string[])?.length > 0 && (
            <TripInfoSection icon={ScrollText} title="House Rules">
              <ul className="space-y-1.5">
                {(trip.house_rules as string[]).map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </TripInfoSection>
          )}

          {(trip.local_tips as string[])?.length > 0 && (
            <TripInfoSection icon={Lightbulb} title="Local Tips">
              <ul className="space-y-1.5">
                {(trip.local_tips as string[]).map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </TripInfoSection>
          )}

          {inventory.length > 0 && (
            <TripInfoSection icon={Package} title="What's already here">
              <InventoryBrowse items={inventory} />
            </TripInfoSection>
          )}

          {suggestions.length > 0 && (
            <TripInfoSection icon={ClipboardList} title="Suggested to bring">
              <SuggestedBrowse items={suggestions} />
            </TripInfoSection>
          )}

          <TripInfoSection icon={Lock} title="Wifi, Codes & Address">
            <p className="text-sm text-ink-light">
              Join this trip to reveal wifi password, door codes, and address.
            </p>
          </TripInfoSection>

          <div className="rounded-card bg-forest/5 p-5 text-center">
            <h3 className="font-semibold text-ink">Want to claim items or see more?</h3>
            <p className="mt-1 text-sm text-ink-light">
              Just need your name and email to join.
            </p>
            <Link
              href={`/trip/${token}/join`}
              className="mt-4 inline-block rounded-button bg-forest px-6 py-2.5 text-sm font-medium text-white hover:bg-forest-dark"
            >
              Join this trip
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
