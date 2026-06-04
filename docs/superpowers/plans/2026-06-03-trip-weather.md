# Trip Weather (Open-Meteo) — Implementation Plan

> Execute with superpowers:subagent-driven-development on a branch off `main` (e.g. `feat/trip-weather`). Steps use `- [ ]` checkboxes.

**Goal:** A weather-forecast card on the trip guide for the trip's dates + location, via the keyless Open-Meteo API.

**Spec:** `docs/superpowers/specs/2026-06-03-trip-weather-design.md`

**Tech:** Next.js 16 App Router (server components, `fetch` with `next.revalidate`), TypeScript, Lucide. No API key, no new deps.

---

## Task 1: Weather lib (Open-Meteo client + WMO code map)

**Create:** `lib/weather/open-meteo.ts`, `lib/weather/weather-code.ts`

- [ ] **Step 1: `lib/weather/weather-code.ts`** — map WMO weather codes to a label + Lucide icon. (Server-safe: icons are referenced as components, rendered by the client card.)

```ts
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  CloudSun,
  type LucideIcon,
} from "lucide-react";

export interface WeatherCondition {
  label: string;
  Icon: LucideIcon;
}

/** WMO weather interpretation codes → label + icon. */
export function weatherCondition(code: number): WeatherCondition {
  if (code === 0) return { label: "Clear", Icon: Sun };
  if (code === 1 || code === 2) return { label: "Partly cloudy", Icon: CloudSun };
  if (code === 3) return { label: "Overcast", Icon: Cloud };
  if (code === 45 || code === 48) return { label: "Fog", Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: "Drizzle", Icon: CloudDrizzle };
  if (code >= 61 && code <= 67) return { label: "Rain", Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: "Showers", Icon: CloudRain };
  if (code === 85 || code === 86) return { label: "Snow showers", Icon: CloudSnow };
  if (code >= 95) return { label: "Thunderstorm", Icon: CloudLightning };
  return { label: "—", Icon: Cloud };
}
```

- [ ] **Step 2: `lib/weather/open-meteo.ts`** — geocode + forecast + orchestrator. Server-only (uses `fetch` with `next.revalidate`).

```ts
export interface ForecastDay {
  date: string; // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  code: number;
  precipProbMax: number | null;
}

export type TripWeather =
  | { status: "ok"; days: ForecastDay[] }
  | { status: "too_far" }
  | { status: "tbd" }
  | { status: "past" }
  | { status: "unavailable" };

const FORECAST_WINDOW_DAYS = 15; // Open-Meteo reliably serves ~16 days; clamp to 15 ahead.

function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function geocode(city: string, region?: string | null): Promise<{ lat: number; lon: number } | null> {
  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(city)}&count=10&language=en&format=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } }); // geocode rarely changes
    if (!res.ok) return null;
    const json = await res.json();
    const results: Array<{ latitude: number; longitude: number; admin1?: string }> = json.results || [];
    if (results.length === 0) return null;
    const match =
      (region && results.find((r) => r.admin1?.toLowerCase() === region.toLowerCase())) || results[0];
    return { lat: match.latitude, lon: match.longitude };
  } catch {
    return null;
  }
}

async function getForecast(lat: number, lon: number, startISO: string, endISO: string): Promise<ForecastDay[] | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&timezone=auto` +
      `&start_date=${startISO}&end_date=${endISO}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.daily;
    if (!d?.time) return null;
    return d.time.map((date: string, i: number) => ({
      date,
      tempMax: Math.round(d.temperature_2m_max[i]),
      tempMin: Math.round(d.temperature_2m_min[i]),
      code: d.weather_code[i],
      precipProbMax: d.precipitation_probability_max?.[i] ?? null,
    }));
  } catch {
    return null;
  }
}

/** Resolve a trip's location + dates to a weather card state. Never throws. */
export async function getTripWeather(args: {
  city: string | null;
  region: string | null;
  startsOn: string | null;
  endsOn: string | null;
}): Promise<TripWeather> {
  const { city, region, startsOn, endsOn } = args;
  if (!city) return { status: "unavailable" };
  if (!startsOn) return { status: "tbd" };

  const today = todayISO();
  const lastEnd = endsOn || startsOn;
  if (lastEnd < today) return { status: "past" };

  const maxISO = isoAddDays(today, FORECAST_WINDOW_DAYS);
  if (startsOn > maxISO) return { status: "too_far" };

  const fetchStart = startsOn < today ? today : startsOn;
  const fetchEnd = lastEnd > maxISO ? maxISO : lastEnd;

  const geo = await geocode(city, region);
  if (!geo) return { status: "unavailable" };

  const days = await getForecast(geo.lat, geo.lon, fetchStart, fetchEnd);
  if (!days || days.length === 0) return { status: "unavailable" };
  return { status: "ok", days };
}
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`. Confirm `LucideIcon` type imports cleanly. (Note: `new Date()` is fine here — this is normal server code, not a Workflow script.)
- [ ] **Step 4: Commit** — `feat(weather): Open-Meteo client + WMO code map`

---

## Task 2: Weather card component

**Create:** `components/trip-weather.tsx`

Presentational client component (icons + horizontal scroll). Takes the `TripWeather` result.

- [ ] **Step 1: Write the component**

```tsx
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
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`. (Importing `type TripWeather` from a server lib into a client component is fine — types erase. The lib has no `"use server"` directive and isn't a server action, so no bundler issue; if any arises, move the `TripWeather`/`ForecastDay` types into a shared `lib/weather/types.ts` and import from there.)
- [ ] **Step 3: Commit** — `feat(weather): trip weather card component`

---

## Task 3: Trip-guide integration + verify

**Modify:** `app/(app)/trips/[id]/page.tsx`

The page is a server component that already fetches `trip` via `select("*")` (has `city`, `region`, `starts_on`, `ends_on`) and computes `canEdit`. Add a weather section near the top of the info stack (after the trip header, before House Rules).

- [ ] **Step 1: Fetch + render**

Imports: `import { getTripWeather } from "@/lib/weather/open-meteo";` and `import { TripWeather } from "@/components/trip-weather";` and a Lucide icon for the section header (e.g. `CloudSun`).

After the existing data fetches, resolve weather (the lib swallows errors to `unavailable`, so no try/catch needed):
```tsx
  const weather = await getTripWeather({
    city: trip.city,
    region: trip.region,
    startsOn: trip.starts_on,
    endsOn: trip.ends_on,
  });
```

Render a section near the top of the info stack (use the existing `TripInfoSection` wrapper for visual consistency), only when there's something to show — i.e. skip `past`/`unavailable`, and skip `tbd` for non-hosts:
```tsx
        {weather.status !== "unavailable" && weather.status !== "past" &&
          !(weather.status === "tbd" && !canEdit) && (
            <TripInfoSection icon={CloudSun} title="Weather">
              <TripWeather weather={weather} canEdit={canEdit} />
            </TripInfoSection>
          )}
```
Place this block right after the trip header / above the House Rules section in the existing stack.

> Optional (nicer first paint): wrap the fetch+card in a `<Suspense fallback={<a small skeleton/>}>` via a tiny async server subcomponent so the Open-Meteo call doesn't delay the rest of the page. Not required for correctness — the call is cached (`revalidate: 3600`) and fast — but note it if the page feels slow.

- [ ] **Step 2: Typecheck, lint, build** — `npx tsc --noEmit; npm run lint; npm run build`. tsc/build clean; only the known pre-existing lint errors; no new ones. (Heads-up: `npm run build` may hit a transient Windows `EPERM`/`.next` OneDrive lock — delete `.next` and rebuild if so.)
- [ ] **Step 3: Run the suite** — `npm test`, still green.
- [ ] **Step 4: Manual e2e**
  1. A trip with a real city and dates within ~16 days shows a forecast row (weekday, condition icon, hi/lo, precip% when ≥30).
  2. A trip dated >2 weeks out shows the "opens about two weeks before" note.
  3. A TBD-dates trip shows the host-only "set dates" hint (and nothing for non-host viewers); a past trip and a city-less trip show nothing — and the page never errors.
  4. Kill network / bad city → card silently absent, page fine.
  5. 375px: the day row scrolls horizontally without breaking layout.
- [ ] **Step 5: Commit** — `feat(weather): forecast card on the trip guide`

---

## Notes for the implementer

- Open-Meteo needs **no key**. If a call fails for any reason, `getTripWeather` returns `unavailable` and the card renders nothing — the trip page must never break because of weather.
- Geocoding uses the public `city`/`region` only — never the sensitive address.
- Forecast window is ~16 days; the lib clamps the requested range to `[today, today+15]`. Historical/seasonal averages for far-out trips are a deliberate future enhancement, not in this plan.
- Temperatures are Fahrenheit (`temperature_unit=fahrenheit`); US-first audience.
