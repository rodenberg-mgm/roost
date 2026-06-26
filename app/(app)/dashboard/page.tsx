// app/(app)/dashboard/page.tsx
import { EmptyState } from "@/components/empty-state";
import { HeroTripCard } from "@/components/hero-trip-card";
import { TripCard } from "@/components/trip-card";
import { OldTrips } from "@/components/old-trips";
import { StampBadge } from "@/components/stamp-badge";
import { SavedToast } from "@/components/saved-toast";
import { createClient } from "@/lib/supabase/server";
import { Map, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

type TripRow = {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  city: string | null;
  region: string | null;
  deleted_at: string | null;
  archived_at: string | null;
};

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
    .select("trip_id, role, trips:trip_id(id, name, starts_on, ends_on, city, region, deleted_at, archived_at)")
    .eq("user_id", user!.id);

  const tripOf = (m: { trips: unknown }) =>
    (Array.isArray(m.trips) ? m.trips[0] : m.trips) as TripRow | null;

  // Today as YYYY-MM-DD for date-only "is this trip over?" comparisons.
  const todayStr = new Date().toLocaleDateString("en-CA"); // en-CA → ISO-like YYYY-MM-DD

  // A trip is "past" once its end (or start, if no end) is before today. TBD
  // trips (no dates) are never past.
  const isPast = (t: TripRow) => {
    const effectiveEnd = t.ends_on || t.starts_on;
    return !!effectiveEnd && effectiveEnd < todayStr;
  };

  const liveMemberships = (memberships || []).filter((m) => {
    const trip = tripOf(m);
    return trip && !trip.deleted_at;
  });

  // Active = shown by default. Old = past OR archived, revealed on demand.
  const activeTrips = liveMemberships.filter((m) => {
    const t = tripOf(m)!;
    return !t.archived_at && !isPast(t);
  });
  const oldMemberships = liveMemberships.filter((m) => {
    const t = tripOf(m)!;
    return t.archived_at || isPast(t);
  });

  const tripIds = liveMemberships.map((m) => tripOf(m)!.id);

  // Fetch all members (for counts + hero avatars) in one query
  const memberCounts: Record<string, number> = {};
  const memberNames: Record<string, string[]> = {};
  if (tripIds.length > 0) {
    const { data: rows } = await supabase
      .from("trip_members")
      .select("trip_id, invited_email, users:user_id(display_name)")
      .in("trip_id", tripIds);

    if (rows) {
      for (const row of rows) {
        memberCounts[row.trip_id] = (memberCounts[row.trip_id] || 0) + 1;
        const userRaw = row.users as unknown;
        const u = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as { display_name: string } | null;
        const name = u?.display_name || row.invited_email || "Guest";
        (memberNames[row.trip_id] ||= []).push(name);
      }
    }
  }

  // Date helpers
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const formatDate = (date: string | null) =>
    date
      ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;

  function dateDisplayFor(trip: TripRow): string {
    const s = formatDate(trip.starts_on);
    const e = formatDate(trip.ends_on);
    return s && e ? `${s} – ${e}` : s ? `Starting ${s}` : "Dates TBD";
  }

  function stampFor(startsOn: string | null): string | null {
    if (!startsOn) return null;
    const start = new Date(startsOn + "T00:00:00");
    if (start >= now && start <= nextWeek) return "THIS WEEKEND";
    if (start > nextWeek) return "UPCOMING";
    return null;
  }

  // Pick the hero trip: soonest upcoming start date, else the first trip
  const sorted = [...activeTrips].sort((a, b) => {
    const ta = (Array.isArray(a.trips) ? a.trips[0] : a.trips) as TripRow;
    const tb = (Array.isArray(b.trips) ? b.trips[0] : b.trips) as TripRow;
    const da = ta.starts_on ? new Date(ta.starts_on).getTime() : Infinity;
    const db = tb.starts_on ? new Date(tb.starts_on).getTime() : Infinity;
    return da - db;
  });

  const heroMembership = sorted[0];
  const restMemberships = sorted.slice(1);

  // Old trips (past or archived), most-recent first, as plain card data for the
  // client toggle component.
  const oldTripsData = oldMemberships
    .map((m) => {
      const t = tripOf(m)!;
      return {
        id: t.id,
        name: t.name,
        startsOn: t.starts_on,
        endsOn: t.ends_on,
        city: t.city,
        region: t.region,
        memberCount: memberCounts[t.id] || 1,
        role: m.role,
        archived: !!t.archived_at,
      };
    })
    .sort((a, b) => (b.startsOn || "").localeCompare(a.startsOn || ""));

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6">
      <Suspense>
        <SavedToast />
      </Suspense>

      {/* Kraft header */}
      <div className="kraft-bg px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between sm:max-w-2xl md:max-w-3xl">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Roost" width={40} height={40} className="h-9 w-9" />
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-forest/50">
                {greeting},
              </p>
              <h1 className="font-display text-2xl font-bold uppercase leading-none text-forest">
                {displayName}
              </h1>
            </div>
          </div>
          {liveMemberships.length > 0 && (
            <Link
              href="/trips/new"
              aria-label="Start a trip"
              className="flex h-10 w-10 items-center justify-center rounded-button bg-forest text-bone-light shadow-button transition-transform hover:bg-forest-dark active:translate-y-px"
            >
              <Plus className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-lg px-4 pt-5 sm:max-w-2xl sm:px-6 md:max-w-3xl">
        {liveMemberships.length === 0 ? (
          <div className="topo-bg rounded-card border">
            <EmptyState
              icon={Map}
              title="No trips yet"
              description="Start planning your next group stay, or join one with an invite link."
              action={{ label: "Start a Trip", href: "/trips/new" }}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {activeTrips.length === 0 ? (
              <div className="topo-bg rounded-card border p-6 text-center">
                <p className="text-sm text-ink-light">
                  No upcoming trips. Start a new one, or look back at past trips below.
                </p>
              </div>
            ) : (
              <>
                {/* Hero trip */}
                {heroMembership && (() => {
                  const trip = (Array.isArray(heroMembership.trips) ? heroMembership.trips[0] : heroMembership.trips) as TripRow;
                  return (
                    <div className="animate-slide-up">
                      <HeroTripCard
                        id={trip.id}
                        name={trip.name}
                        dateDisplay={dateDisplayFor(trip)}
                        location={[trip.city, trip.region].filter(Boolean).join(", ") || null}
                        memberCount={memberCounts[trip.id] || 1}
                        memberNames={memberNames[trip.id] || []}
                        stampLabel={stampFor(trip.starts_on)}
                      />
                    </div>
                  );
                })()}

                {/* Remaining trips */}
                {restMemberships.length > 0 && (
                  <div className="space-y-3">
                    <StampBadge variant="kraft">All Trips</StampBadge>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {restMemberships.map((m) => {
                        const trip = (Array.isArray(m.trips) ? m.trips[0] : m.trips) as TripRow;
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
                  </div>
                )}
              </>
            )}

            {/* Past + archived trips, hidden by default */}
            {oldTripsData.length > 0 && <OldTrips trips={oldTripsData} />}
          </div>
        )}
      </div>
    </div>
  );
}
