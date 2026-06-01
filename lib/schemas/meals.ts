import { z } from "zod";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "other"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const addMealSlotSchema = z.object({
  trip_id: z.string().uuid(),
  day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  meal_type: z.enum(MEAL_TYPES),
  title: z.string().max(200).optional(),
});
export type AddMealSlotInput = z.infer<typeof addMealSlotSchema>;

export const updateMealSlotSchema = z.object({
  slot_id: z.string().uuid(),
  title: z.string().max(200).nullable().optional(),
  menu: z.string().max(5000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateMealSlotInput = z.infer<typeof updateMealSlotSchema>;

export interface MealCook {
  id: string;
  user_id: string;
  user_name: string;
}

export interface MealSlot {
  id: string;
  day_date: string;
  meal_type: MealType;
  title: string | null;
  menu: string | null;
  notes: string | null;
  sort_order: number;
  created_by_user_id: string;
  cooks: MealCook[];
}
