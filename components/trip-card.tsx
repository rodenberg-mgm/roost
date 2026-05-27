import { Calendar, MapPin, Users } from "lucide-react";
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
      className="block rounded-card bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-display text-lg font-semibold text-ink">{name}</h3>
        <span className="rounded-badge bg-sand/50 px-2 py-0.5 text-xs text-ink-light">
          {role === "host" ? "Host" : role === "co-host" ? "Co-host" : "Guest"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-light">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {dateDisplay}
        </span>
        {location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {location}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {memberCount}
        </span>
      </div>
    </Link>
  );
}
