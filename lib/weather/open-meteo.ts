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
