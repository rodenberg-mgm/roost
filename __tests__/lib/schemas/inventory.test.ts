import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  inventoryCategorySchema,
  upsertInventoryItemSchema,
  upsertSuggestedItemSchema,
} from "@/lib/schemas/inventory";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";

describe("categoryLabel", () => {
  it("maps known values to labels", () => {
    expect(categoryLabel("food")).toBe("Food & Pantry");
    expect(categoryLabel("safety")).toBe("Safety");
  });

  it("falls back to Other for unknown/legacy values", () => {
    expect(categoryLabel("bogus")).toBe("Other");
    expect(categoryLabel("")).toBe("Other");
  });
});

describe("inventoryCategorySchema", () => {
  it("rejects values outside the fixed set", () => {
    expect(inventoryCategorySchema.safeParse("food").success).toBe(true);
    expect(inventoryCategorySchema.safeParse("nope").success).toBe(false);
  });
});

describe("upsertInventoryItemSchema", () => {
  it("defaults category to other and accepts a minimal item", () => {
    const parsed = upsertInventoryItemSchema.parse({
      scope: "property",
      parent_id: TRIP_ID,
      title: "Life jackets",
    });
    expect(parsed.category).toBe("other");
  });

  it("requires a title", () => {
    const res = upsertInventoryItemSchema.safeParse({
      scope: "trip",
      parent_id: TRIP_ID,
      title: "",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid scope", () => {
    const res = upsertInventoryItemSchema.safeParse({
      scope: "household",
      parent_id: TRIP_ID,
      title: "x",
    });
    expect(res.success).toBe(false);
  });
});

describe("upsertSuggestedItemSchema", () => {
  it("accepts a valid suggestion", () => {
    expect(
      upsertSuggestedItemSchema.safeParse({
        scope: "trip",
        parent_id: TRIP_ID,
        category: "outdoor",
        title: "Water shoes",
      }).success
    ).toBe(true);
  });
});
