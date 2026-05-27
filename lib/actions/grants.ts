// lib/actions/grants.ts
"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Consume an invite token: create trip_members + trip_grants rows.
 * Called after the user has authenticated (magic-link callback).
 */
export async function consumeInviteAndJoin(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Use service-role to read and update invite (no RLS for the guest yet)
  const serviceClient = await createServiceClient();

  const { data: invite } = await serviceClient
    .from("trip_invites")
    .select("id, trip_id, email, consumed_at, expires_at")
    .eq("token", token)
    .single();

  if (!invite) {
    return { error: "Invalid invite" };
  }

  if (invite.consumed_at) {
    // Already consumed — check if user is already a member
    const { data: existing } = await serviceClient
      .from("trip_members")
      .select("id")
      .eq("trip_id", invite.trip_id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return { data: { tripId: invite.trip_id, alreadyMember: true } };
    }
  }

  if (new Date(invite.expires_at) < new Date() && !invite.consumed_at) {
    return { error: "Invite expired" };
  }

  // Create trip member
  const { error: memberError } = await serviceClient
    .from("trip_members")
    .insert({
      trip_id: invite.trip_id,
      user_id: user.id,
      role: "guest",
      invited_email: invite.email,
      joined_at: new Date().toISOString(),
    });

  if (memberError && !memberError.message.includes("duplicate")) {
    return { error: memberError.message };
  }

  // Create view-level grant
  await serviceClient
    .from("trip_grants")
    .insert({
      trip_id: invite.trip_id,
      user_id: user.id,
      level: "view",
      source: "magic-link",
    });

  // Mark invite consumed
  await serviceClient
    .from("trip_invites")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_by_user_id: user.id,
    })
    .eq("id", invite.id);

  return { data: { tripId: invite.trip_id, alreadyMember: false } };
}
