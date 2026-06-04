# Trip Weather (Open-Meteo) — Design Spec

**Date:** 2026-06-03
**Status:** Approved, pending implementation (next session)

## Goal

Show a weather forecast for the trip's dates + location on the trip guide — a warm, glanceable "what to pack for" signal.

## Why

It's a high-delight, low-cost addition to the during/before-trip experience. Matt asked specifically for a free/cheap weather API. (Honest note: it's off the committed roadmap — a nice-to-have slotted into this UX batch, not a v1.3/v1.4 item.)

## API choice: Open-Meteo

- **Free, no API key** — nothing to store or secure.
- Forecast endpoint: `https://api.open-meteo.com/v1/forecast` — daily fields up to ~16 days out.
- Geocoding endpoint: `https://geocoding-api.open-meteo.com/v1/search?name=...&count=...` — city/region → lat/lon (no key).
- Commercial-use-friendly enough for MVP.

(Alternatives considered: OpenWeatherMap / WeatherAPI — solid but require an API key. Open-Meteo's keyless model wins for MVP simplicity.)

## Data we have

The trip (`trips` table, fetched `select("*")` on the guide page) has: `starts_on`, `ends_on` (ISO date strings or null for TBD), `city`, `region` (public, non-sensitive). We geocode `city` (+ `region` to disambiguate) — we do **not** need the sensitive street address.

## The hard constraint

Forecasts only reach ~16 days out. So the card has distinct states based on the trip's dates relative to today:
- **`ok`** — trip overlaps the available window (today … today+16): show daily forecast for the overlapping days.
- **`too_far`** — trip starts more than ~16 days out: "Forecast opens ~2 weeks before your trip." (Future enhancement: seasonal/historical averages via Open-Meteo's archive API — out of scope for v1.)
- **`tbd`** — no dates set: render nothing (or, host-only, a subtle "set dates to see the forecast").
- **`past`** — trip already ended: render nothing.
- **`unavailable`** — no city, or the API/geocode failed: render nothing (never break the page).

## Architecture

- **`lib/weather/open-meteo.ts`** — server-only:
  - `geocode(city, region?)` → `{ latitude, longitude } | null` (pick the result whose `admin1` best matches `region`, else the first).
  - `getForecast(lat, lon, startISO, endISO)` → daily `{ date, tempMax, tempMin, code, precipProbMax }[]` (Fahrenheit, `timezone=auto`), with the requested range **clamped** to `[today, today+15]` before the call.
  - `getTripWeather({ city, region, startsOn, endsOn })` → a discriminated union: `{ status: "ok"; days } | { status: "too_far" } | { status: "tbd" } | { status: "past" } | { status: "unavailable" }`. All fetches use `fetch(url, { next: { revalidate: 3600 } })` (1-hour cache) and are wrapped so any failure returns `unavailable`.
- **`lib/weather/weather-code.ts`** — map WMO weather codes → `{ label, Icon }` (Lucide): clear/cloud/fog/drizzle/rain/snow/showers/thunder buckets.
- **`components/trip-weather.tsx`** — presentational; takes the `getTripWeather` result and renders a horizontally-scrollable row of day chips (weekday, Lucide condition icon, hi°/lo°) for `ok`; a one-line muted note for `too_far`/`tbd`; nothing for `past`/`unavailable`. Brand-styled (bg-card, forest accents, `font-mono` for temps, Lucide icons, `transition-colors` only).

## Placement

On the trip guide (`app/(app)/trips/[id]/page.tsx`), as a `TripInfoSection`-style card (or a compact band) near the top of the info stack — after the trip header (dates/location), before House Rules. Fetch server-side. To avoid the external call blocking first paint, wrap it in `<Suspense>` with a lightweight skeleton, OR fetch in the page with try/catch (the lib already swallows errors to `unavailable`). Render the card only when there's a location to work with.

## Out of scope

Hourly forecast, historical/seasonal averages for far-out trips (future), weather alerts, per-day "pack this" suggestions, caching beyond the 1-hour `revalidate`, unit toggle (Fahrenheit only for MVP).

## Acceptance

- A trip with a city and dates within ~16 days shows a daily forecast row (weekday, icon, hi/lo) on the guide.
- A far-out trip shows the "opens ~2 weeks before" note; a TBD/past/locationless/failed trip shows nothing and never errors the page.
- No API key anywhere. tsc/lint/build pass.
