import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify host
  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", id)
    .eq("user_id", user.id)
    .single();

  if (!member || !["host", "co-host"].includes(member.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.require_pin_to_view !== undefined) {
    updateData.require_pin_to_view = body.require_pin_to_view;
  }

  if (body.pin) {
    // For MVP, store PIN as plain text. TODO: bcrypt in production.
    updateData.pin_hash = body.pin;
  }

  if (!body.require_pin_to_view) {
    updateData.pin_hash = null;
  }

  const { error } = await supabase
    .from("trips")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
