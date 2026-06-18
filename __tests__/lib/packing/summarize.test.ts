import { describe, expect, it } from "vitest";
import { summarizeItem } from "@/lib/packing/summarize";
import type { PackingItem } from "@/lib/schemas/packing";

function item(partial: Partial<PackingItem>): PackingItem {
  return {
    id: "i1",
    title: "Wine",
    target_quantity: null,
    created_by_user_id: "u0",
    sort_order: 0,
    claims: [],
    ...partial,
  };
}

describe("summarizeItem", () => {
  it("uncounted item with no claims", () => {
    const s = summarizeItem(item({ target_quantity: null }));
    expect(s.needed).toBeNull();
    expect(s.claimed).toBe(0);
    expect(s.packed).toBe(0);
    expect(s.surplus).toBe(0);
    expect(s.fullyPacked).toBe(false);
    expect(s.contributors).toEqual([]);
  });

  it("sums claimed and packed quantities", () => {
    const s = summarizeItem(
      item({
        target_quantity: 3,
        claims: [
          { id: "c1", user_id: "u1", user_name: "Alex", quantity: 2, brought: true, note: null },
          { id: "c2", user_id: "u2", user_name: "Bo", quantity: 1, brought: false, note: null },
        ],
      })
    );
    expect(s.needed).toBe(3);
    expect(s.claimed).toBe(3);
    expect(s.packed).toBe(2);
    expect(s.surplus).toBe(0);
    expect(s.fullyPacked).toBe(false);
  });

  it("treats overpacking as positive surplus, never negative", () => {
    const s = summarizeItem(
      item({
        target_quantity: 3,
        claims: [
          { id: "c1", user_id: "u1", user_name: "Alex", quantity: 3, brought: true, note: null },
          { id: "c2", user_id: "u2", user_name: "Bo", quantity: 2, brought: true, note: null },
        ],
      })
    );
    expect(s.packed).toBe(5);
    expect(s.surplus).toBe(2);
    expect(s.fullyPacked).toBe(true);
  });

  it("uncounted item never reports surplus and is fullyPacked once anyone brings it", () => {
    const s = summarizeItem(
      item({
        target_quantity: null,
        claims: [
          { id: "c1", user_id: "u1", user_name: "Alex", quantity: 1, brought: true, note: null },
        ],
      })
    );
    expect(s.surplus).toBe(0);
    expect(s.fullyPacked).toBe(true);
    expect(s.contributors).toHaveLength(1);
  });

  it("maps contributors preserving names, quantities, brought, note", () => {
    const s = summarizeItem(
      item({
        target_quantity: 2,
        claims: [
          {
            id: "c1",
            user_id: "u1",
            user_name: "Alex",
            quantity: 2,
            brought: false,
            note: "bringing Catan",
          },
        ],
      })
    );
    expect(s.contributors).toEqual([
      { userId: "u1", name: "Alex", quantity: 2, brought: false, note: "bringing Catan" },
    ]);
  });
});
