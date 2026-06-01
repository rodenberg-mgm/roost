import { LandscapeBanner } from "@/components/illustrations";
import { StampBadge } from "@/components/stamp-badge";
import { Calendar, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";

interface HeroTripCardProps {
  id: string;
  name: string;
  dateDisplay: string;
  location: string | null;
  memberCount: number;
  /** Display names (or emails) of members, used for avatar initials */
  memberNames: string[];
  /** Stamp label shown over the banner, e.g. "THIS WEEKEND" */
  stampLabel?: string | null;
}

export function HeroTripCard({
  id,
  name,
  dateDisplay,
  location,
  memberCount,
  memberNames,
  stampLabel,
}: HeroTripCardProps) {
  const shown = memberNames.slice(0, 5);
  const overflow = memberCount - shown.length;

  return (
    <Link
      href={`/trips/${id}`}
      className="group block overflow-hidden rounded-card border bg-card shadow-card transition-shadow hover:shadow-card-hover"
    >
      {/* Illustrated banner */}
      <div className="relative h-32 w-full">
        <LandscapeBanner className="h-full w-full" />
        {stampLabel && (
          <div className="absolute left-4 top-4">
            <StampBadge variant={stampLabel === "THIS WEEKEND" ? "brick" : "forest"}>
              {stampLabel}
            </StampBadge>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase leading-tight text-ink">
            {name}
          </h2>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-light/50 transition-transform group-hover:translate-x-0.5" />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-light">
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
        </div>

        {/* Avatar row */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-2">
            {shown.map((n, i) => (
              <div
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-sand font-display text-xs font-bold uppercase text-ink-light"
                title={n}
              >
                {n.charAt(0).toUpperCase()}
              </div>
            ))}
            {overflow > 0 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-forest font-display text-[0.65rem] font-bold text-bone-light">
                +{overflow}
              </div>
            )}
          </div>
          <span className="text-xs text-ink-light">
            {memberCount} {memberCount === 1 ? "guest" : "guests"}
          </span>
        </div>
      </div>
    </Link>
  );
}
