// lib/trip-access/validate-token.ts
import { createServiceClient } from "@/lib/supabase/server";

export interface TokenValidation {
  valid: boolean;
  tripId?: string;
  email?: string;
  error?: string;
}

/**
 * Validate an invite token. Uses service-role to bypass RLS
 * because anonymous viewers have no Supabase session.
 */
export async function validateInviteToken(token: string): Promise<TokenValidation> {
  const supabase = await createServiceClient();

  const { data: invite, error } = await supabase
    .from("trip_invites")
    .select("id, trip_id, email, expires_at, consumed_at")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return { valid: false, error: "Invalid invite link" };
  }

  if (invite.consumed_at) {
    // Token consumed — still show the trip (user already has access)
    return { valid: true, tripId: invite.trip_id, email: invite.email };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { valid: false, error: "This invite link has expired" };
  }

  return { valid: true, tripId: invite.trip_id, email: invite.email };
}
