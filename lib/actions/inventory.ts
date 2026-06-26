"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  createInventoryUploadUrl,
  inventoryPublicUrl,
  removeInventoryImage,
} from "@/lib/storage";
import {
  upsertInventoryItemSchema,
  upsertSuggestedItemSchema,
  type InventoryItem,
  type InventoryScope,
  type SuggestedItem,
  type UpsertInventoryItemInput,
  type UpsertSuggestedItemInput,
} from "@/lib/schemas/inventory";

const INVENTORY_TABLE: Record<InventoryScope, string> = {
  property: "property_inventory_items",
  trip: "trip_inventory_items",
};
const SUGGESTED_TABLE: Record<InventoryScope, string> = {
  property: "property_suggested_items",
  trip: "trip_suggested_items",
};
const PARENT_COL: Record<InventoryScope, string> = {
  property: "property_id",
  trip: "trip_id",
};

/**
 * Confirm the caller may write a given scope/parent. Used before minting an
 * image upload URL (no row exists yet to lean on RLS). Row CRUD relies on the
 * tables' own RLS in addition to this.
 */
async function canWrite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  scope: InventoryScope,
  parentId: string
): Promise<boolean> {
  if (scope === "property") {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("id", parentId)
      .eq("owner_user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    return !!data;
  }
  const { data } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", parentId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data && ["host", "co-host"].includes(data.role);
}

// ============================================================
// Reads
// ============================================================
export async function getInventory(
  scope: InventoryScope,
  parentId: string
): Promise<InventoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(INVENTORY_TABLE[scope])
    .select("id, category, title, quantity, detail, image_path, sort_order")
    .eq(PARENT_COL[scope], parentId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    quantity: r.quantity,
    detail: r.detail,
    image_path: r.image_path,
    image_url: inventoryPublicUrl(r.image_path),
    sort_order: r.sort_order,
  }));
}

export async function getSuggestions(
  scope: InventoryScope,
  parentId: string
): Promise<SuggestedItem[]> {
  const supabase = await createClient();
  // `provided` only exists on the trip table; select "*" (a static literal so
  // the typed client doesn't choke on a dynamic column list) and read defensively.
  const { data } = await supabase
    .from(SUGGESTED_TABLE[scope])
    .select("*")
    .eq(PARENT_COL[scope], parentId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    category: row.category as string,
    title: row.title as string,
    provided: scope === "trip" ? Boolean(row.provided) : false,
    sort_order: row.sort_order as number,
  }));
}

// ============================================================
// Inventory writes
// ============================================================
export async function upsertInventoryItem(input: UpsertInventoryItemInput) {
  const parsed = upsertInventoryItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { scope, parent_id, id, ...fields } = parsed.data;
  const table = INVENTORY_TABLE[scope];

  const row = {
    category: fields.category,
    title: fields.title,
    quantity: fields.quantity ?? null,
    detail: fields.detail?.trim() ? fields.detail.trim() : null,
    image_path: fields.image_path ?? null,
  };

  if (id) {
    const { error } = await supabase
      .from(table)
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: { _form: [error.message] } };
  } else {
    const { error } = await supabase
      .from(table)
      .insert({ [PARENT_COL[scope]]: parent_id, ...row });
    if (error) return { error: { _form: [error.message] } };
  }
  return { data: { ok: true } };
}

export async function deleteInventoryItem(scope: InventoryScope, id: string) {
  const supabase = await createClient();
  // Read the image path first so we can clean up the storage object after the
  // row is gone (soft delete keeps the row; we hard-remove the orphan-able byte).
  const { data: existing } = await supabase
    .from(INVENTORY_TABLE[scope])
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from(INVENTORY_TABLE[scope])
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  if (existing?.image_path) {
    await removeInventoryImage(existing.image_path);
  }
  return { data: { ok: true } };
}

// ============================================================
// Suggested writes
// ============================================================
export async function upsertSuggestedItem(input: UpsertSuggestedItemInput) {
  const parsed = upsertSuggestedItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { scope, parent_id, id, category, title } = parsed.data;
  const table = SUGGESTED_TABLE[scope];

  if (id) {
    const { error } = await supabase
      .from(table)
      .update({ category, title, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: { _form: [error.message] } };
  } else {
    const { error } = await supabase
      .from(table)
      .insert({ [PARENT_COL[scope]]: parent_id, category, title });
    if (error) return { error: { _form: [error.message] } };
  }
  return { data: { ok: true } };
}

export async function deleteSuggestedItem(scope: InventoryScope, id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(SUGGESTED_TABLE[scope])
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

/** Toggle the "already at the property — skip it" flag (trip scope only). */
export async function setSuggestedProvided(tripItemId: string, provided: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_suggested_items")
    .update({ provided, updated_at: new Date().toISOString() })
    .eq("id", tripItemId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

// ============================================================
// Image upload
// ============================================================
/** Mint a signed upload URL for an inventory photo after checking write
 *  authority. Returns the storage key + token; the client uploads bytes and
 *  then saves the key via upsertInventoryItem. */
export async function createInventoryImageUploadUrl(input: {
  scope: InventoryScope;
  parent_id: string;
  ext: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await canWrite(supabase, user.id, input.scope, input.parent_id))) {
    return { error: "Not allowed to edit this inventory" };
  }

  const safeExt = (input.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const key = `${input.scope}/${input.parent_id}/${randomUUID()}.${safeExt}`;

  try {
    const { path, token } = await createInventoryUploadUrl(key);
    return { data: { path, token } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload URL failed" };
  }
}
