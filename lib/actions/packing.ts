"use server";

import { createClient } from "@/lib/supabase/server";
import {
  addPackingItemSchema,
  claimItemSchema,
  setClaimNoteSchema,
  type PackingItem,
} from "@/lib/schemas/packing";

/** Fetch all packing items for a trip with their claims + claimer names. */
export async function getPacking(tripId: string): Promise<PackingItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("packing_items")
    .select(
      "id, title, target_quantity, created_by_user_id, sort_order, claims:packing_claims(id, user_id, quantity, brought, note, users:user_id(display_name))"
    )
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    target_quantity: row.target_quantity,
    created_by_user_id: row.created_by_user_id,
    sort_order: row.sort_order,
    claims: (row.claims ?? []).map((c) => {
      const u = c.users as unknown as { display_name: string } | null;
      return {
        id: c.id,
        user_id: c.user_id,
        user_name: u?.display_name ?? "Someone",
        quantity: c.quantity,
        brought: c.brought,
        note: c.note ?? null,
      };
    }),
  }));
}

export async function addPackingItem(input: {
  trip_id: string;
  title: string;
  target_quantity?: number | null;
}) {
  const parsed = addPackingItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { _form: ["Not authenticated"] } };

  const { error } = await supabase.from("packing_items").insert({
    trip_id: parsed.data.trip_id,
    title: parsed.data.title,
    target_quantity: parsed.data.target_quantity ?? null,
    created_by_user_id: user.id,
  });

  if (error) return { error: { _form: [error.message] } };
  return { data: { ok: true } };
}

export async function deletePackingItem(itemId: string) {
  const supabase = await createClient();
  // RLS (packing_items_delete) restricts to creator or host.
  const { error } = await supabase.from("packing_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

/** Create or update the caller's claim on an item (one row per user per item). */
export async function claimItem(input: { item_id: string; quantity: number }) {
  const parsed = claimItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid claim" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Need trip_id for the claim row; read it from the item.
  const { data: item } = await supabase
    .from("packing_items")
    .select("trip_id")
    .eq("id", parsed.data.item_id)
    .single();
  if (!item) return { error: "Item not found" };

  // Reset brought: changing your committed quantity means you're re-committing,
  // not confirming you already packed the new amount.
  const { error } = await supabase.from("packing_claims").upsert(
    {
      item_id: parsed.data.item_id,
      trip_id: item.trip_id,
      user_id: user.id,
      quantity: parsed.data.quantity,
      brought: false,
    },
    { onConflict: "item_id,user_id" }
  );

  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function unclaimItem(itemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("packing_claims")
    .delete()
    .eq("item_id", itemId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function setBrought(input: { claim_id: string; brought: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // RLS (packing_claims_own_update) also enforces ownership; the explicit
  // user_id filter makes a non-owner attempt a clear 0-row no-op.
  const { error } = await supabase
    .from("packing_claims")
    .update({ brought: input.brought })
    .eq("id", input.claim_id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}

/**
 * Set or clear the note on the caller's claim ("bringing Catan + Codenames").
 * Kept separate from claimItem so editing a note never resets `brought`.
 */
export async function setClaimNote(input: { claim_id: string; note: string | null }) {
  const parsed = setClaimNoteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid note" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = parsed.data.note?.trim();
  const { error } = await supabase
    .from("packing_claims")
    .update({ note: trimmed ? trimmed : null })
    .eq("id", parsed.data.claim_id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}
