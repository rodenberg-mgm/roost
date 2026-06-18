import { z } from "zod";

export const addPackingItemSchema = z.object({
  trip_id: z.string().uuid(),
  title: z.string().min(1, "Item name is required").max(200),
  target_quantity: z.number().int().positive().max(9999).nullable().optional(),
});
export type AddPackingItemInput = z.infer<typeof addPackingItemSchema>;

export const claimItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().positive().max(9999),
});
export type ClaimItemInput = z.infer<typeof claimItemSchema>;

export const setClaimNoteSchema = z.object({
  claim_id: z.string().uuid(),
  // Empty string from the input is normalized to null (clears the note).
  note: z.string().max(140).nullable(),
});
export type SetClaimNoteInput = z.infer<typeof setClaimNoteSchema>;

// Shared shapes returned by getPacking and consumed by summarize + UI.
export interface PackingClaim {
  id: string;
  user_id: string;
  user_name: string;
  quantity: number;
  brought: boolean;
  note: string | null;
}

export interface PackingItem {
  id: string;
  title: string;
  target_quantity: number | null;
  created_by_user_id: string;
  sort_order: number;
  claims: PackingClaim[];
}
