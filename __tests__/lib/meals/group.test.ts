import { describe, expect, it } from "vitest";
import { groupMealSlots } from "@/lib/meals/group";
import type { MealSlot } from "@/lib/schemas/meals";

function slot(partial: Partial<MealSlot>): MealSlot {
  return {
    id: Math.random().toString(36).slice(2),
    day_date: "2026-05-16",
    meal_type: "dinner",
    title: null,
    menu: null,
    notes: null,
    sort_order: 0,
    created_by_user_id: "u0",
    cooks: [],
    ...partial,
  };
}

describe("groupMealSlots", () => {
  it("returns empty array for no slots", () => {
    expect(groupMealSlots([])).toEqual([]);
  });

  it("orders meals within a day breakfast→lunch→dinner→other", () => {
    const days = groupMealSlots([
      slot({ meal_type: "dinner" }),
      slot({ meal_type: "breakfast" }),
      slot({ meal_type: "other" }),
      slot({ meal_type: "lunch" }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].slots.map((s) => s.meal_type)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "other",
    ]);
  });

  it("orders days chronologically", () => {
    const days = groupMealSlots([
      slot({ day_date: "2026-05-18" }),
      slot({ day_date: "2026-05-16" }),
      slot({ day_date: "2026-05-17" }),
    ]);
    expect(days.map((d) => d.day)).toEqual([
      "2026-05-16",
      "2026-05-17",
      "2026-05-18",
    ]);
  });

  it("breaks ties within a meal type by sort_order", () => {
    const days = groupMealSlots([
      slot({ meal_type: "dinner", sort_order: 2, title: "B" }),
      slot({ meal_type: "dinner", sort_order: 1, title: "A" }),
    ]);
    expect(days[0].slots.map((s) => s.title)).toEqual(["A", "B"]);
  });
});
