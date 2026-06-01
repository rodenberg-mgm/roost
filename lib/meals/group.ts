import type { MealSlot, MealType } from "@/lib/schemas/meals";

const MEAL_ORDER: Record<MealType, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  other: 3,
};

export interface MealDay {
  day: string;
  slots: MealSlot[];
}

export function groupMealSlots(slots: MealSlot[]): MealDay[] {
  const byDay = new Map<string, MealSlot[]>();
  for (const s of slots) {
    const arr = byDay.get(s.day_date) ?? [];
    arr.push(s);
    byDay.set(s.day_date, arr);
  }
  // ISO yyyy-mm-dd sorts lexicographically === chronologically.
  return [...byDay.keys()].sort().map((day) => ({
    day,
    slots: byDay
      .get(day)!
      .slice()
      .sort(
        (a, b) =>
          MEAL_ORDER[a.meal_type] - MEAL_ORDER[b.meal_type] ||
          a.sort_order - b.sort_order
      ),
  }));
}
