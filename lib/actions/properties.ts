"use server";

import { createClient } from "@/lib/supabase/server";
import { createPropertySchema, type CreatePropertyInput } from "@/lib/schemas/property";

export async function createProperty(input: CreatePropertyInput) {
  const parsed = createPropertySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: { _form: ["Not authenticated"] } };
  }

  const { wifi_ssid, wifi_password, door_code, gate_code, address_line, postal_code, parking_notes, ...propertyFields } = parsed.data;

  // Insert property
  const { data: property, error: propError } = await supabase
    .from("properties")
    .insert({
      owner_user_id: user.id,
      name: propertyFields.name,
      city: propertyFields.city || null,
      region: propertyFields.region || null,
      house_rules: propertyFields.house_rules ?? [],
      local_tips: propertyFields.local_tips ?? [],
    })
    .select("id")
    .single();

  if (propError) {
    return { error: { _form: [propError.message] } };
  }

  // Insert sensitive info — if this fails we must not leave an orphan property
  // with the address/wifi/codes silently dropped.
  const { error: sensError } = await supabase
    .from("property_sensitive_info")
    .insert({
      property_id: property.id,
      wifi_ssid: wifi_ssid || null,
      wifi_password: wifi_password || null,
      door_code: door_code || null,
      gate_code: gate_code || null,
      address_line: address_line || null,
      postal_code: postal_code || null,
      parking_notes: parking_notes || null,
    });

  if (sensError) {
    // Best-effort rollback: soft-delete the just-created property so we don't
    // strand a property with no sensitive row.
    await supabase
      .from("properties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", property.id);
    return { error: { _form: [sensError.message] } };
  }

  return { data: { id: property.id } };
}

/** Fetch one property + its sensitive sibling for the owner (RLS-gated). */
export async function getProperty(propertyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, city, region, house_rules, local_tips, stocked_items")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!property) return null;

  const { data: sensitive } = await supabase
    .from("property_sensitive_info")
    .select(
      "wifi_ssid, wifi_password, door_code, gate_code, address_line, postal_code, parking_notes"
    )
    .eq("property_id", propertyId)
    .maybeSingle();

  return { property, sensitive };
}

export async function updateProperty(
  propertyId: string,
  input: CreatePropertyInput
) {
  const parsed = createPropertySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: { _form: ["Not authenticated"] } };
  }

  const {
    wifi_ssid,
    wifi_password,
    door_code,
    gate_code,
    address_line,
    postal_code,
    parking_notes,
    ...propertyFields
  } = parsed.data;

  // Update non-sensitive fields. RLS (properties_owner_update) ensures only the
  // owner can change the row; a non-owner update simply affects zero rows.
  const propertyUpdate: Record<string, unknown> = {
    name: propertyFields.name,
    city: propertyFields.city || null,
    region: propertyFields.region || null,
    house_rules: propertyFields.house_rules ?? [],
    local_tips: propertyFields.local_tips ?? [],
  };

  const { data: updated, error: propError } = await supabase
    .from("properties")
    .update(propertyUpdate)
    .eq("id", propertyId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (propError) {
    return { error: { _form: [propError.message] } };
  }
  if (!updated) {
    return { error: { _form: ["Property not found or not yours to edit"] } };
  }

  // Update sensitive sibling row.
  const { error: sensError } = await supabase
    .from("property_sensitive_info")
    .update({
      wifi_ssid: wifi_ssid || null,
      wifi_password: wifi_password || null,
      door_code: door_code || null,
      gate_code: gate_code || null,
      address_line: address_line || null,
      postal_code: postal_code || null,
      parking_notes: parking_notes || null,
    })
    .eq("property_id", propertyId);

  if (sensError) {
    return { error: { _form: [sensError.message] } };
  }

  return { data: { id: propertyId } };
}

export async function getMyProperties() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("properties")
    .select("id, name, city, region")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return data || [];
}
