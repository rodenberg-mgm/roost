// app/(app)/dashboard/page.tsx
import { EmptyState } from "@/components/empty-state";
import { TripCard } from "@/components/trip-card";
import { StampBadge } from "@/components/stamp-badge";
import { createClient } from "@/lib/supabase/server";
import { Map, Plus } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch user display name
  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user!.id)
    .single();

  const displayName = profile?.display_name || user!.email?.split("@")[0] || "Friend";

  // Time-of-day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Fetch trips where user is a member
  const { data: memberships } = await supabase
    .from("trip_members")
    .select("trip_id, role, trips:trip_id(id, name, starts_on, ends_on, city, region, deleted_at)")
    .eq("user_id", user!.id);

  // Filter out deleted trips
  type TripRow = {
    id: string;
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    city: string | null;
    region: string | null;
    deleted_at: string | null;
  };

  const activeTrips = (memberships || [])
    .filter((m) => {
      const trip = (Array.isArray(m.trips) ? m.trips[0] : m.trips) as TripRow | null;
      return trip && !trip.deleted_at;
    });

  // Get member counts for each trip
  const tripIds = activeTrips.map((m) => {
    const trip = (Array.isArray(m.trips) ? m.trips[0] : m.trips) as TripRow;
    return trip.id;
  });

  let memberCounts: Record<string, number> = {};
  if (tripIds.length > 0) {
    const { data: counts } = await supabase
      .from("trip_members")
      .select("trip_id")
      .in("trip_id", tripIds);

    if (counts) {
      memberCounts = counts.reduce((acc, row) => {
        acc[row.trip_id] = (acc[row.trip_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  // Determine if any trip is "this weekend" (within 7 days)
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  function getTripLabel(startsOn: string | null): string | null {
    if (!startsOn) return null;
    const start = new Date(startsOn + "T00:00:00");
    if (start <= nextWeek && start >= now) return "THIS WEEKEND";
    if (start > nextWeek) return "UPCOMING";
    return null;
  }

  return (
    <div className="-mx-4 -mt-6">
      {/* Kraft header */}
      <div className="kraft-bg px-4 pb-6 pt-6">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-forest/60">
                {greeting},
              </p>
              <h1 className="font-display text-2xl font-bold uppercase text-forest">
                {displayName}
              </h1>
            </div>
            {activeTrips.length > 0 && (
              <Link
                href="/trips/new"
                className="flex h-10 w-10 items-center justify-center rounded-button bg-forest text-white shadow-button hover:bg-forest-dark"
              >
                <Plus className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-lg px-4 pt-4">
        {activeTrips.length === 0 ? (
          <div className="topo-bg rounded-card border p-2">
            <EmptyState
              icon={Map}
              title="No trips yet"
              description="Start planning your next group stay, or join one with an invite link."
              action={{ label: "Start a Trip", href: "/trips/new" }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {activeTrips.map((m) => {
              const trip = (Array.isArray(m.trips) ? m.trips[0] : m.trips) as TripRow;
              const label = getTripLabel(trip.starts_on);
              return (
                <div key={trip.id}>
                  {label && (
                    <div className="mb-2">
                      <StampBadge variant={label === "THIS WEEKEND" ? "brick" : "forest"}>
                        {label}
                      </StampBadge>
                    </div>
                  )}
                  <TripCard
                    id={trip.id}
                    name={trip.name}
                    startsOn={trip.starts_on}
                    endsOn={trip.ends_on}
                    city={trip.city}
                    region={trip.region}
                    memberCount={memberCounts[trip.id] || 1}
                    role={m.role}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
