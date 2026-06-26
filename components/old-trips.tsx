"use client";

import { TripCard } from "@/components/trip-card";
import { History, ChevronDown } from "lucide-react";
import { useState } from "react";

export interface OldTripData {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  city: string | null;
  region: string | null;
  memberCount: number;
  role: string;
  archived: boolean;
}

/** Past + archived trips, collapsed behind a toggle to keep the dashboard clean. */
export function OldTrips({ trips }: { trips: OldTripData[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3 pt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 rounded-button border border-subtle bg-card/60 px-4 py-2 text-sm text-ink-light transition-colors hover:bg-card hover:text-ink"
      >
        <History className="h-4 w-4" />
        {open ? "Hide old trips" : `Show old trips (${trips.length})`}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="grid gap-3 sm:grid-cols-2">
          {trips.map((t) => (
            <TripCard
              key={t.id}
              id={t.id}
              name={t.name}
              startsOn={t.startsOn}
              endsOn={t.endsOn}
              city={t.city}
              region={t.region}
              memberCount={t.memberCount}
              role={t.role}
              archived={t.archived}
            />
          ))}
        </div>
      )}
    </div>
  );
}
