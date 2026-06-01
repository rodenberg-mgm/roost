import { Calendar, ChevronRight, MapPin, Users } from "lucide-react";
import Link from "next/link";

interface TripCardProps {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  city: string | null;
  region: string | null;
  memberCount: number;
  role: string;
}

export function TripCard({
  id,
  name,
  startsOn,
  endsOn,
  city,
  region,
  memberCount,
  role,
}: TripCardProps) {
  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const startDate = formatDate(startsOn);
  const endDate = formatDate(endsOn);
  const dateDisplay =
    startDate && endDate
      ? `${startDate} – ${endDate}`
      : startDate
      ? `Starting ${startDate}`
      : "Dates TBD";

  const location = [city, region].filter(Boolean).join(", ");

  return (
    <Link
      href={`/trips/${id}`}
      className="group block rounded-card border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-semibold uppercase text-ink">
              {name}
            </h3>
            <span className="shrink-0 rounded-badge bg-sand/60 px-2 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-ink-light">
              {role === "host" ? "Host" : role === "co-host" ? "Co-host" : "Guest"}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-light">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-forest/60" />
              {dateDisplay}
            </span>
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-forest/60" />
                {location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-forest/60" />
              {memberCount} {memberCount === 1 ? "guest" : "guests"}
            </span>
          </div>
        </div>
        <ChevronRight className="ml-3 h-5 w-5 shrink-0 text-ink-light/50 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
