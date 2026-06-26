import { z } from "zod";

export const addHouseholdItemSchema = z.object({
  household_id: z.string().uuid(),
  trip_id: z.string().uuid(),
  title: z.string().min(1, "Item is required").max(200),
  category: z.string().max(40).nullable().optional(),
  quantity: z.number().int().min(1).max(100000).nullable().optional(),
  suggestion_item_id: z.string().uuid().nullable().optional(),
});
export type AddHouseholdItemInput = z.infer<typeof addHouseholdItemSchema>;

export const renameHouseholdSchema = z.object({
  household_id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(80),
});

export interface HouseholdMember {
  user_id: string;
  name: string;
}

export interface Household {
  id: string;
  name: string;
  members: HouseholdMember[];
}

export interface HouseholdPackingItem {
  id: string;
  title: string;
  category: string | null;
  quantity: number | null;
  packed: boolean;
  packed_by_user_id: string | null;
  sort_order: number;
}
