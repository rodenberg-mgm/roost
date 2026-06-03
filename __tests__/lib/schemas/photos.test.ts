import { describe, expect, it } from "vitest";
import { recordPhotoSchema } from "@/lib/schemas/photos";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  trip_id: "22222222-2222-4222-8222-222222222222",
  thumb_path: "trips/t/photos/p/thumb.jpg",
  display_path: "trips/t/photos/p/display.jpg",
  original_path: "trips/t/photos/p/original.heic",
  display_width: 2048,
  display_height: 1536,
  content_type: "image/heic",
  taken_at: "2026-05-16T18:30:00.000Z",
};

describe("recordPhotoSchema", () => {
  it("accepts a valid record", () => {
    expect(recordPhotoSchema.safeParse(base).success).toBe(true);
  });

  it("allows a null taken_at", () => {
    expect(recordPhotoSchema.safeParse({ ...base, taken_at: null }).success).toBe(true);
  });

  it("rejects a non-positive dimension", () => {
    expect(recordPhotoSchema.safeParse({ ...base, display_width: 0 }).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(recordPhotoSchema.safeParse({ ...base, id: "nope" }).success).toBe(false);
  });
});
