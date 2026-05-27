import { EmptyState } from "@/components/empty-state";
import { TripCard } from "@/components/trip-card";
import { createClient } from "@/lib/supabase/server";
import { Map, Plus } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch trips where user is a member
  const { data: memberships } = await supabase
    .from("trip_members")
    .select(
      "trip_id, role, trips:trip_id(id, name, starts_on, ends_on, city, region, deleted_at)"
    )
    .eq("user_id", user!.id);

  type TripRow = {
    id: string;
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    city: string | null;
    region: string | null;
    deleted_at: string | null;
  };

  // Filter out deleted trips
  const activeTrips = (memberships || []).filter((m) => {
    const trip = (m.trips as unknown) as TripRow | null;
    return trip && !trip.deleted_at;
  });

  // Get member counts for each trip
  const tripIds = activeTrips.map((m) => {
    const trip = (m.trips as unknown) as TripRow;
    return trip.id;
  });

  let memberCounts: Record<string, number> = {};
  if (tripIds.length > 0) {
    const { data: counts } = await supabase
      .from("trip_members")
      .select("trip_id")
      .in("trip_id", tripIds);

    if (counts) {
      memberCounts = counts.reduce(
        (acc, row) => {
          acc[row.trip_id] = (acc[row.trip_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">My Trips</h1>
        {activeTrips.length > 0 && (
          <Link
            href="/trips/new"
            className="flex h-9 w-9 items-center justify-center rounded-button bg-fern text-white hover:bg-fern-dark"
          >
            <Plus className="h-5 w-5" />
          </Link>
        )}
      </header>

      {activeTrips.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No trips yet"
          description="Start planning your next group stay, or join one with an invite link."
          action={{ label: "Start a Trip", href: "/trips/new" }}
        />
      ) : (
        <div className="space-y-3">
          {activeTrips.map((m) => {
            const trip = (m.trips as unknown) as TripRow;
            return (
              <TripCard
                key={trip.id}
                id={trip.id}
                name={trip.name}
                startsOn={trip.starts_on}
                endsOn={trip.ends_on}
                city={trip.city}
                region={trip.region}
                memberCount={memberCounts[trip.id] || 1}
                role={m.role}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
