import { z } from "zod";

/** Fixed category set shared by inventory + suggestions. DB stores the value
 *  as free text (default 'other'); the app constrains to this list. */
export const INVENTORY_CATEGORIES = [
  { value: "food", label: "Food & Pantry" },
  { value: "kitchen", label: "Kitchen" },
  { value: "outdoor", label: "Outdoor & Pool" },
  { value: "safety", label: "Safety" },
  { value: "linens", label: "Linens" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" },
] as const;

export const inventoryCategorySchema = z.enum([
  "food",
  "kitchen",
  "outdoor",
  "safety",
  "linens",
  "entertainment",
  "other",
]);

export type InventoryCategory = z.infer<typeof inventoryCategorySchema>;

export function categoryLabel(value: string): string {
  return INVENTORY_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

/** Where an inventory/suggested row lives: the reusable Property template, or a
 *  specific Trip's editable copy. */
export const inventoryScopeSchema = z.enum(["property", "trip"]);
export type InventoryScope = z.infer<typeof inventoryScopeSchema>;

export const upsertInventoryItemSchema = z.object({
  scope: inventoryScopeSchema,
  parent_id: z.string().uuid(),
  id: z.string().uuid().optional(), // present when editing
  category: inventoryCategorySchema.default("other"),
  title: z.string().min(1, "Name is required").max(200),
  quantity: z.number().int().min(0).max(100000).nullable().optional(),
  detail: z.string().max(500).nullable().optional(),
  image_path: z.string().max(500).nullable().optional(),
});

export type UpsertInventoryItemInput = z.infer<typeof upsertInventoryItemSchema>;

export const upsertSuggestedItemSchema = z.object({
  scope: inventoryScopeSchema,
  parent_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  category: inventoryCategorySchema.default("other"),
  title: z.string().min(1, "Name is required").max(200),
});

export type UpsertSuggestedItemInput = z.infer<typeof upsertSuggestedItemSchema>;

export interface InventoryItem {
  id: string;
  category: string;
  title: string;
  quantity: number | null;
  detail: string | null;
  image_path: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface SuggestedItem {
  id: string;
  category: string;
  title: string;
  provided: boolean; // always false at property scope
  sort_order: number;
}
