"use server";

import { createClient } from "@/lib/supabase/server";
import {
  addHouseholdItemSchema,
  renameHouseholdSchema,
  type Household,
  type HouseholdMember,
  type HouseholdPackingItem,
} from "@/lib/schemas/household";

/**
 * Return the caller's household for a trip, creating a household-of-one on first
 * use (via the leak-safe SECURITY DEFINER rpc). Call this when the user opens
 * "Our Packing" — not on every packing page load.
 */
export async function getOrCreateMyHousehold(tripId: string): Promise<
  { household: Household } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: householdId, error } = await supabase.rpc("get_or_create_my_household", {
    p_trip_id: tripId,
  });
  if (error || !householdId) return { error: error?.message ?? "Could not load your list" };

  const household = await getHousehold(householdId as string);
  if (!household) return { error: "Could not load your list" };
  return { household };
}

export async function getHousehold(householdId: string): Promise<Household | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("trip_households")
    .select("id, name")
    .eq("id", householdId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return null;

  const { data: memberRows } = await supabase
    .from("trip_household_members")
    .select("user_id, users:user_id(display_name)")
    .eq("household_id", householdId);

  const members: HouseholdMember[] = (memberRows ?? []).map((m) => {
    const u = m.users as unknown as { display_name: string } | null;
    return { user_id: m.user_id, name: u?.display_name ?? "Someone" };
  });

  return { id: row.id, name: row.name, members };
}

export async function getHouseholdPacking(householdId: string): Promise<HouseholdPackingItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_packing_items")
    .select("id, title, category, quantity, packed, packed_by_user_id, sort_order")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export interface ClaimedSupply {
  item_id: string;
  title: string;
  quantity: number;
  brought: boolean;
}

/**
 * The caller's own claims on the trip's Shared Supplies — powers the read-only
 * "Also bringing for the group" strip on Our Packing. Derived live from the
 * claims (the claim stays the single source of truth); nothing is copied.
 */
export async function getMyClaimedSupplies(tripId: string): Promise<ClaimedSupply[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("packing_claims")
    .select("quantity, brought, item:item_id(id, title)")
    .eq("trip_id", tripId)
    .eq("user_id", user.id);

  return (data ?? [])
    .map((c) => {
      const item = c.item as unknown as { id: string; title: string } | null;
      if (!item) return null;
      return { item_id: item.id, title: item.title, quantity: c.quantity, brought: c.brought };
    })
    .filter((x): x is ClaimedSupply => x !== null);
}

export async function renameHousehold(householdId: string, name: string) {
  const parsed = renameHouseholdSchema.safeParse({ household_id: householdId, name });
  if (!parsed.success) return { error: "Invalid name" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_households")
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq("id", householdId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

/**
 * Trip members who can be added to a household: everyone on the trip except the
 * household's current members. Someone already in *another* household will hit
 * the unique constraint on add (handled with a friendly error) — RLS hides
 * other households' rosters, so we can't pre-filter them here.
 */
export async function getAddableMembers(tripId: string, householdId: string) {
  const supabase = await createClient();

  const { data: tripMembers } = await supabase
    .from("trip_members")
    .select("user_id, users:user_id(display_name), invited_email, joined_at")
    .eq("trip_id", tripId);

  const { data: current } = await supabase
    .from("trip_household_members")
    .select("user_id")
    .eq("household_id", householdId);

  const inHousehold = new Set((current ?? []).map((m) => m.user_id));

  return (tripMembers ?? [])
    .filter((m) => m.joined_at && !inHousehold.has(m.user_id))
    .map((m) => {
      const u = m.users as unknown as { display_name: string } | null;
      return { user_id: m.user_id, name: u?.display_name ?? m.invited_email ?? "Guest" };
    });
}

export async function addHouseholdMember(householdId: string, tripId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_household_members")
    .insert({ household_id: householdId, trip_id: tripId, user_id: userId });
  if (error) {
    if (error.code === "23505") {
      return { error: "They're already part of another household on this trip." };
    }
    return { error: error.message };
  }
  return { data: { ok: true } };
}

export async function removeHouseholdMember(householdId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function addHouseholdItem(input: {
  household_id: string;
  trip_id: string;
  title: string;
  category?: string | null;
  quantity?: number | null;
  suggestion_item_id?: string | null;
}) {
  const parsed = addHouseholdItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("household_packing_items").insert({
    household_id: parsed.data.household_id,
    trip_id: parsed.data.trip_id,
    title: parsed.data.title,
    category: parsed.data.category ?? null,
    quantity: parsed.data.quantity ?? null,
    suggestion_item_id: parsed.data.suggestion_item_id ?? null,
  });
  if (error) return { error: { _form: [error.message] } };
  return { data: { ok: true } };
}

/** Ensure the caller has a household, then copy a Suggested item into its list. */
export async function addSuggestionToMyHousehold(input: {
  trip_id: string;
  suggestion_item_id: string;
  title: string;
  category?: string | null;
}) {
  const ensured = await getOrCreateMyHousehold(input.trip_id);
  if ("error" in ensured) return { error: ensured.error };

  return addHouseholdItem({
    household_id: ensured.household.id,
    trip_id: input.trip_id,
    title: input.title,
    category: input.category ?? null,
    suggestion_item_id: input.suggestion_item_id,
  });
}

export async function toggleHouseholdPacked(itemId: string, packed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("household_packing_items")
    .update({
      packed,
      packed_by_user_id: packed ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function deleteHouseholdItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("household_packing_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}
