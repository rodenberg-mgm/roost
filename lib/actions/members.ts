"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { allowedMemberActions, type MemberRole } from "@/lib/members/permissions";
import { revalidatePath } from "next/cache";

export interface Member {
  user_id: string;
  name: string;
  email: string;
  role: MemberRole;
  joined: boolean;
  is_primary_host: boolean;
}

/** Load the actor's role + the trip's primary host. Returns null if the caller
 *  isn't authenticated or isn't a member. */
async function loadContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: trip } = await supabase
    .from("trips")
    .select("host_user_id")
    .eq("id", tripId)
    .single();
  if (!trip) return null;

  const { data: me } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!me) return null;

  return { userId: user.id, actorRole: me.role as MemberRole, hostUserId: trip.host_user_id as string };
}

/** All members of a trip with name/email/role/joined + primary-host flag. */
export async function getMembers(tripId: string): Promise<Member[]> {
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("host_user_id")
    .eq("id", tripId)
    .single();
  if (!trip) return [];

  const { data, error } = await supabase
    .from("trip_members")
    .select("user_id, role, joined_at, invited_email, users:user_id(display_name, email)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const u = row.users as unknown as { display_name: string | null; email: string | null } | null;
    return {
      user_id: row.user_id,
      name: u?.display_name ?? row.invited_email ?? "Member",
      email: u?.email ?? row.invited_email ?? "",
      role: row.role as MemberRole,
      joined: !!row.joined_at,
      is_primary_host: row.user_id === trip.host_user_id,
    };
  });
}

/** Promote/demote a member. Only 'co-host' | 'guest' are valid targets. */
export async function setMemberRole(
  tripId: string,
  userId: string,
  role: "co-host" | "guest"
) {
  if (role !== "co-host" && role !== "guest") return { error: "Invalid role" };

  const supabase = await createClient();
  const ctx = await loadContext(supabase, tripId);
  if (!ctx) return { error: "Not authorized" };

  // Evaluate the rules against the target's CURRENT role, not the desired one.
  const { data: targetRow } = await supabase
    .from("trip_members")
    .select("role, joined_at")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .single();
  if (!targetRow) return { error: "Member not found" };

  const allowed = allowedMemberActions({
    actorRole: ctx.actorRole,
    actorIsPrimaryHost: ctx.userId === ctx.hostUserId,
    target: {
      role: targetRow.role as MemberRole,
      isPrimaryHost: userId === ctx.hostUserId,
      joined: !!targetRow.joined_at,
      isSelf: userId === ctx.userId,
    },
  });
  const wanted = role === "co-host" ? "make-co-host" : "make-guest";
  if (!allowed.includes(wanted)) return { error: "You can't change that member" };

  // Existing trip_members_update RLS (is_trip_host) permits the write.
  const { error, count } = await supabase
    .from("trip_members")
    .update({ role }, { count: "exact" })
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  if (!count) return { error: "Couldn't update that member" };

  revalidatePath(`/trips/${tripId}/invite`);
  return { data: { ok: true } };
}

/** Remove a member: revoke access (membership + grants + unconsumed invites)
 *  and release their claims/signups; keep their photos. */
export async function removeMember(tripId: string, userId: string) {
  const supabase = await createClient();
  const ctx = await loadContext(supabase, tripId);
  if (!ctx) return { error: "Not authorized" };

  if (userId === ctx.hostUserId) return { error: "The host can't be removed — transfer host first" };
  if (userId === ctx.userId) return { error: "You can't remove yourself" };
  if (ctx.actorRole !== "host" && ctx.actorRole !== "co-host") return { error: "Not authorized" };

  // Need the member's email to clear their unconsumed invites (stored lowercased).
  const { data: target } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  // Service-role for the multi-table cleanup (these tables lack delete RLS for
  // this shape); the guards above are the trust boundary, same as revokeInvite.
  const svc = await createServiceClient();

  await svc.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", userId);
  await svc.from("trip_grants").delete().eq("trip_id", tripId).eq("user_id", userId);
  if (target?.email) {
    await svc
      .from("trip_invites")
      .delete()
      .eq("trip_id", tripId)
      .eq("email", target.email.toLowerCase())
      .is("consumed_at", null);
  }
  // Release their contributions so they reassign (keep photos).
  await svc
    .from("packing_items")
    .update({ claimed_by_user_id: null, claimed_at: null })
    .eq("trip_id", tripId)
    .eq("claimed_by_user_id", userId);
  await svc.from("meal_cooks").delete().eq("trip_id", tripId).eq("user_id", userId);

  revalidatePath(`/trips/${tripId}/invite`);
  return { data: { ok: true } };
}

/** Transfer the primary host role to another joined member (atomic rpc). */
export async function transferHost(tripId: string, newUserId: string) {
  const supabase = await createClient();
  const ctx = await loadContext(supabase, tripId);
  if (!ctx) return { error: "Not authorized" };

  if (ctx.userId !== ctx.hostUserId) return { error: "Only the host can transfer host" };
  if (newUserId === ctx.userId) return { error: "You're already the host" };

  const { error } = await supabase.rpc("transfer_trip_host", {
    p_trip_id: tripId,
    p_new_host: newUserId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/trips/${tripId}/invite`);
  return { data: { ok: true } };
}
