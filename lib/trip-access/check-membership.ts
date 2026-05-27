import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type TripRole = "host" | "co-host" | "guest";

export interface TripMembership {
  userId: string;
  tripId: string;
  role: TripRole;
}

/**
 * Verify the current user is a member of the given trip.
 * Redirects to /dashboard if not authenticated or not a member.
 */
export async function requireTripMembership(tripId: string): Promise<TripMembership> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    redirect("/dashboard");
  }

  return {
    userId: user.id,
    tripId,
    role: member.role as TripRole,
  };
}

/**
 * Check if a role has host-level permissions (host or co-host).
 */
export function isHostRole(role: TripRole): boolean {
  return role === "host" || role === "co-host";
}
