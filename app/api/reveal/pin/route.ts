import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { tripId, pin } = await request.json();

  if (!tripId || !pin) {
    return NextResponse.json(
      { error: "Missing tripId or pin" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Use service-role to check pin_hash (user can't see it via RLS directly)
  const serviceClient = await createServiceClient();
  const { data: trip } = await serviceClient
    .from("trips")
    .select("pin_hash, require_pin_to_view")
    .eq("id", tripId)
    .single();

  if (!trip || !trip.require_pin_to_view || !trip.pin_hash) {
    return NextResponse.json({ error: "PIN not configured" }, { status: 400 });
  }

  // Compare PIN (simple equality for MVP — pin_hash stores plain text for now)
  if (pin !== trip.pin_hash) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 403 });
  }

  // Upsert sensitive grant
  await supabase
    .from("trip_grants")
    .insert({
      trip_id: tripId,
      user_id: user.id,
      level: "sensitive",
      source: "pin-entry",
    });

  return NextResponse.json({ success: true });
}
