"use client";

import { weatherCondition } from "@/lib/weather/weather-code";
import type { TripWeather } from "@/lib/weather/open-meteo";

function weekday(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function TripWeather({ weather, canEdit }: { weather: TripWeather; canEdit?: boolean }) {
  if (weather.status === "past" || weather.status === "unavailable") return null;

  if (weather.status === "tbd") {
    if (!canEdit) return null;
    return <p className="text-sm text-ink-light">Set trip dates to see the forecast.</p>;
  }
  if (weather.status === "too_far") {
    return <p className="text-sm text-ink-light">The forecast opens about two weeks before your trip.</p>;
  }

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {weather.days.map((d) => {
        const { label, Icon } = weatherCondition(d.code);
        return (
          <div
            key={d.date}
            className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-input border bg-sand/20 px-3 py-2 text-center"
          >
            <span className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">{weekday(d.date)}</span>
            <Icon className="h-5 w-5 text-forest" aria-label={label} />
            <span className="font-mono text-xs text-ink">
              {d.tempMax}&deg;<span className="text-ink-light"> / {d.tempMin}&deg;</span>
            </span>
            {typeof d.precipProbMax === "number" && d.precipProbMax >= 30 && (
              <span className="font-mono text-[0.6rem] text-forest/70">{d.precipProbMax}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
