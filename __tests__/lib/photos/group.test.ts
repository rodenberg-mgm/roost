import { describe, expect, it } from "vitest";
import { groupPhotosByDay } from "@/lib/photos/group";
import type { Photo } from "@/lib/schemas/photos";

function photo(p: Partial<Photo>): Photo {
  return {
    id: p.id ?? "x",
    trip_id: "t",
    uploaded_by_user_id: "u",
    uploader_name: "Matt",
    thumb_path: "thumb",
    display_path: "display",
    original_path: "original",
    taken_at: p.taken_at ?? null,
    display_width: 100,
    display_height: 100,
    content_type: "image/jpeg",
    created_at: p.created_at ?? "2026-05-16T12:00:00.000Z",
    thumb_url: "url",
  };
}

describe("groupPhotosByDay", () => {
  it("groups by the day of taken_at, chronological", () => {
    const days = groupPhotosByDay([
      photo({ id: "b", taken_at: "2026-05-17T09:00:00.000Z" }),
      photo({ id: "a", taken_at: "2026-05-16T20:00:00.000Z" }),
    ]);
    expect(days.map((d) => d.day)).toEqual(["2026-05-16", "2026-05-17"]);
    expect(days[0].photos[0].id).toBe("a");
  });

  it("sorts photos within a day by time ascending", () => {
    const days = groupPhotosByDay([
      photo({ id: "late", taken_at: "2026-05-16T20:00:00.000Z" }),
      photo({ id: "early", taken_at: "2026-05-16T08:00:00.000Z" }),
    ]);
    expect(days[0].photos.map((p) => p.id)).toEqual(["early", "late"]);
  });

  it("falls back to created_at when taken_at is null", () => {
    const days = groupPhotosByDay([
      photo({ id: "c", taken_at: null, created_at: "2026-05-18T10:00:00.000Z" }),
    ]);
    expect(days[0].day).toBe("2026-05-18");
  });
});
