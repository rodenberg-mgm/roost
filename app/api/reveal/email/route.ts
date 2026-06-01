import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  // Issue the sensitive grant via service-role: trip_grants has no INSERT
  // RLS policy by design — this verified handler is the only path to a grant.
  const serviceClient = await createServiceClient();

  // Skip if a live sensitive grant already exists (avoids duplicate rows).
  const { data: existingGrant } = await serviceClient
    .from("trip_grants")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("level", "sensitive")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!existingGrant) {
    const { error: grantError } = await serviceClient
      .from("trip_grants")
      .insert({
        trip_id: tripId,
        user_id: user.id,
        level: "sensitive",
        source: "email-verify",
      });

    if (grantError) {
      return NextResponse.json({ error: grantError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
