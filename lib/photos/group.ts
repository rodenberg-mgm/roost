import type { Photo, PhotoDay } from "@/lib/schemas/photos";

/** The effective timestamp used for grouping/sorting (taken_at, else created_at). */
function effectiveTime(p: Photo): string {
  return p.taken_at ?? p.created_at;
}

/** yyyy-mm-dd in the runtime's local timezone. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Group photos by calendar day, chronological oldest->newest, with each day's
 *  photos sorted by time ascending. */
export function groupPhotosByDay(photos: Photo[]): PhotoDay[] {
  const byDay = new Map<string, Photo[]>();
  for (const p of photos) {
    const key = dayKey(effectiveTime(p));
    const arr = byDay.get(key) ?? [];
    arr.push(p);
    byDay.set(key, arr);
  }
  return [...byDay.keys()].sort().map((day) => ({
    day,
    photos: byDay
      .get(day)!
      .slice()
      .sort((a, b) => effectiveTime(a).localeCompare(effectiveTime(b))),
  }));
}
