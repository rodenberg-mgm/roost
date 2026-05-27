"use server";

import { createClient } from "@/lib/supabase/server";
import { createTripSchema, type CreateTripInput } from "@/lib/schemas/trip";
import { redirect } from "next/navigation";

export async function createTrip(input: CreateTripInput) {
  const parsed = createTripSchema.safeParse(input);
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

  // Insert trip
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      host_user_id: user.id,
      name: parsed.data.name,
      starts_on: parsed.data.starts_on,
      ends_on: parsed.data.ends_on,
      city: parsed.data.city || null,
      region: parsed.data.region || null,
      property_id: parsed.data.property_id || null,
    })
    .select("id")
    .single();

  if (tripError) {
    return { error: { _form: [tripError.message] } };
  }

  // Create host as trip member
  const { error: memberError } = await supabase
    .from("trip_members")
    .insert({
      trip_id: trip.id,
      user_id: user.id,
      role: "host",
      invited_email: user.email,
      joined_at: new Date().toISOString(),
    });

  if (memberError) {
    return { error: { _form: [memberError.message] } };
  }

  // Create trip_sensitive_info row (empty — host fills in later)
  await supabase.from("trip_sensitive_info").insert({ trip_id: trip.id });

  // If property linked, sync fields
  if (parsed.data.property_id) {
    await syncPropertyToTrip(supabase, trip.id, parsed.data.property_id);
  }

  redirect(`/trips/${trip.id}`);
}

export async function updateTrip(tripId: string, input: {
  name?: string;
  starts_on?: string | null;
  ends_on?: string | null;
  city?: string;
  region?: string;
  house_rules?: string;
  local_tips?: string;
  stocked_items?: string[];
  wifi_ssid?: string;
  wifi_password?: string;
  door_code?: string;
  gate_code?: string;
  address_line?: string;
  postal_code?: string;
  parking_notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { wifi_ssid, wifi_password, door_code, gate_code, address_line, postal_code, parking_notes, ...tripFields } = input;

  // Update trip (non-sensitive)
  const updateData: Record<string, unknown> = {};
  if (tripFields.name !== undefined) updateData.name = tripFields.name;
  if (tripFields.starts_on !== undefined) updateData.starts_on = tripFields.starts_on;
  if (tripFields.ends_on !== undefined) updateData.ends_on = tripFields.ends_on;
  if (tripFields.city !== undefined) updateData.city = tripFields.city;
  if (tripFields.region !== undefined) updateData.region = tripFields.region;
  if (tripFields.house_rules !== undefined) updateData.house_rules = tripFields.house_rules;
  if (tripFields.local_tips !== undefined) updateData.local_tips = tripFields.local_tips;
  if (tripFields.stocked_items !== undefined) updateData.stocked_items = tripFields.stocked_items;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("trips")
      .update(updateData)
      .eq("id", tripId);

    if (error) return { error: error.message };
  }

  // Update sensitive fields
  const sensitiveData: Record<string, unknown> = {};
  if (wifi_ssid !== undefined) sensitiveData.wifi_ssid = wifi_ssid;
  if (wifi_password !== undefined) sensitiveData.wifi_password = wifi_password;
  if (door_code !== undefined) sensitiveData.door_code = door_code;
  if (gate_code !== undefined) sensitiveData.gate_code = gate_code;
  if (address_line !== undefined) sensitiveData.address_line = address_line;
  if (postal_code !== undefined) sensitiveData.postal_code = postal_code;
  if (parking_notes !== undefined) sensitiveData.parking_notes = parking_notes;

  if (Object.keys(sensitiveData).length > 0) {
    const { error } = await supabase
      .from("trip_sensitive_info")
      .update(sensitiveData)
      .eq("trip_id", tripId);

    if (error) return { error: error.message };
  }

  return { success: true };
}

async function syncPropertyToTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  propertyId: string,
) {
  // Read property (non-sensitive)
  const { data: property } = await supabase
    .from("properties")
    .select("name, city, region, house_rules, local_tips, stocked_items")
    .eq("id", propertyId)
    .single();

  if (!property) return;

  // Read property sensitive info
  const { data: sensitive } = await supabase
    .from("property_sensitive_info")
    .select("*")
    .eq("property_id", propertyId)
    .single();

  // Copy non-sensitive fields to trip
  await supabase
    .from("trips")
    .update({
      city: property.city,
      region: property.region,
      house_rules: property.house_rules,
      local_tips: property.local_tips,
      stocked_items: property.stocked_items,
      property_synced_at: new Date().toISOString(),
      property_sync_overrides: {},
    })
    .eq("id", tripId);

  // Copy sensitive fields to trip_sensitive_info
  if (sensitive) {
    await supabase
      .from("trip_sensitive_info")
      .update({
        wifi_ssid: sensitive.wifi_ssid,
        wifi_password: sensitive.wifi_password,
        door_code: sensitive.door_code,
        gate_code: sensitive.gate_code,
        address_line: sensitive.address_line,
        postal_code: sensitive.postal_code,
        parking_notes: sensitive.parking_notes,
      })
      .eq("trip_id", tripId);
  }
}
