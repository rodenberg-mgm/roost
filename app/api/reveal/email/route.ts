import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { tripId } = await request.json();

  if (!tripId) {
    return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify user is a trip member
  const { data: member } = await supabase
    .from("trip_members")
    .select("role, invited_email")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a trip member" }, { status: 403 });
  }

  // For guests: verify email matches invited_email
  if (member.role === "guest") {
    if (member.invited_email?.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "Email doesn't match invite" },
        { status: 403 }
      );
    }
  }

  // Upsert sensitive grant
  const { error: grantError } = await supabase
    .from("trip_grants")
    .insert({
      trip_id: tripId,
      user_id: user.id,
      level: "sensitive",
      source: "email-verify",
    });

  if (grantError && !grantError.message.includes("duplicate")) {
    return NextResponse.json({ error: grantError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
