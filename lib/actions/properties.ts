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
      house_rules: propertyFields.house_rules || null,
      local_tips: propertyFields.local_tips || null,
      stocked_items: propertyFields.stocked_items || [],
    })
    .select("id")
    .single();

  if (propError) {
    return { error: { _form: [propError.message] } };
  }

  // Insert sensitive info
  await supabase
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

  return { data: { id: property.id } };
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
