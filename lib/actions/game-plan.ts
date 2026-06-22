"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  addTaskSchema,
  setTaskNoteSchema,
  setTaskDueSchema,
  type GamePlanTask,
} from "@/lib/schemas/game-plan";

/** Fetch all Game Plan to-dos for a trip with owner name + helpers. */
export async function getGamePlan(tripId: string): Promise<GamePlanTask[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("game_plan_tasks")
    .select(
      "id, title, owner_user_id, note, due_date, done, created_by_user_id, source_kind, source_id, sort_order, owner:owner_user_id(display_name), helpers:game_plan_task_helpers(id, user_id, users:user_id(display_name))"
    )
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const owner = row.owner as unknown as { display_name: string } | null;
    return {
      id: row.id,
      title: row.title,
      owner_user_id: row.owner_user_id,
      owner_name: owner?.display_name ?? null,
      note: row.note ?? null,
      due_date: row.due_date ?? null,
      done: row.done,
      created_by_user_id: row.created_by_user_id,
      source_kind: row.source_kind ?? null,
      source_id: row.source_id ?? null,
      sort_order: row.sort_order,
      helpers: (row.helpers ?? []).map((h) => {
        const u = h.users as unknown as { display_name: string } | null;
        return { id: h.id, user_id: h.user_id, user_name: u?.display_name ?? "Someone" };
      }),
    };
  });
}

export async function addTask(input: {
  trip_id: string;
  title: string;
  due_date?: string | null;
  source_kind?: string | null;
  source_id?: string | null;
}) {
  const parsed = addTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { _form: ["Not authenticated"] } };

  const { data, error } = await supabase
    .from("game_plan_tasks")
    .insert({
      trip_id: parsed.data.trip_id,
      title: parsed.data.title,
      due_date: parsed.data.due_date ?? null,
      source_kind: parsed.data.source_kind ?? null,
      source_id: parsed.data.source_id ?? null,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: { _form: [error?.message ?? "Couldn't add to-do"] } };
  return { data: { id: data.id } };
}

/** True if the user is host/co-host of the trip (app-level check). */
async function isHostOfTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .single();
  return !!data && (data.role === "host" || data.role === "co-host");
}

/**
 * Claim an OPEN to-do (open -> you). Refuses if already owned by someone else.
 * The host-or-owner RLS update policy can't authorize a non-host claiming an
 * open task (owner is null, so its USING clause is false), so we verify
 * membership by reading the task with the user's RLS client, then perform the
 * owner write with the service client — guarding on owner_user_id IS NULL to
 * keep the claim atomic under a race. Mirrors lib/actions/members.ts.
 */
export async function claimTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Reading via the user's RLS client both fetches the row and proves the user
  // is a trip member (select policy is is_trip_member).
  const { data: task } = await supabase
    .from("game_plan_tasks")
    .select("owner_user_id")
    .eq("id", taskId)
    .single();
  if (!task) return { error: "To-do not found" };
  if (task.owner_user_id) return { error: "Someone already claimed this" };

  const service = await createServiceClient();
  const { error, count } = await service
    .from("game_plan_tasks")
    .update({ owner_user_id: user.id }, { count: "exact" })
    .eq("id", taskId)
    .is("owner_user_id", null);

  if (error) return { error: error.message };
  if (!count) return { error: "Someone already claimed this" };
  return { data: { ok: true } };
}

/**
 * Release a to-do back to open. Allowed for the current owner or a host.
 * Setting owner_user_id back to null fails the host-or-owner WITH CHECK for a
 * non-host owner, so we authorize in app code then write with the service
 * client. Mirrors lib/actions/members.ts.
 */
export async function releaseTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: task } = await supabase
    .from("game_plan_tasks")
    .select("trip_id, owner_user_id")
    .eq("id", taskId)
    .single();
  if (!task) return { error: "To-do not found" };

  const isOwner = task.owner_user_id === user.id;
  const isHost = await isHostOfTrip(supabase, task.trip_id, user.id);
  if (!isOwner && !isHost) return { error: "Only the owner or host can release this" };

  const service = await createServiceClient();
  let query = service
    .from("game_plan_tasks")
    .update({ owner_user_id: null })
    .eq("id", taskId);
  // A non-host releases only while still the owner — guards against releasing a
  // task that was re-claimed between our read and this write. Hosts may release
  // regardless of the current owner.
  if (!isHost) query = query.eq("owner_user_id", user.id);
  const { error } = await query;
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function setDone(input: { task_id: string; done: boolean }) {
  const supabase = await createClient();
  // RLS (owner_or_host_update) enforces who may write; count surfaces a blocked
  // write (0 rows) as an honest error instead of a false success.
  const { error, count } = await supabase
    .from("game_plan_tasks")
    .update({ done: input.done }, { count: "exact" })
    .eq("id", input.task_id);
  if (error) return { error: error.message };
  if (!count) return { error: "Only the owner or host can update this" };
  return { data: { ok: true } };
}

export async function setTaskNote(input: { task_id: string; note: string | null }) {
  const parsed = setTaskNoteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid note" };

  const supabase = await createClient();
  const trimmed = parsed.data.note?.trim();
  const { error, count } = await supabase
    .from("game_plan_tasks")
    .update({ note: trimmed ? trimmed : null }, { count: "exact" })
    .eq("id", parsed.data.task_id);
  if (error) return { error: error.message };
  if (!count) return { error: "Only the owner or host can update this" };
  return { data: { ok: true } };
}

export async function setTaskDue(input: { task_id: string; due_date: string | null }) {
  const parsed = setTaskDueSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid date" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("game_plan_tasks")
    .update({ due_date: parsed.data.due_date }, { count: "exact" })
    .eq("id", parsed.data.task_id);
  if (error) return { error: error.message };
  if (!count) return { error: "Only the owner or host can update this" };
  return { data: { ok: true } };
}

export async function joinAsHelper(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: task } = await supabase
    .from("game_plan_tasks")
    .select("trip_id")
    .eq("id", taskId)
    .single();
  if (!task) return { error: "To-do not found" };

  const { error } = await supabase.from("game_plan_task_helpers").upsert(
    { task_id: taskId, trip_id: task.trip_id, user_id: user.id },
    { onConflict: "task_id,user_id" }
  );
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function leaveAsHelper(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("game_plan_task_helpers")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  // RLS (game_plan_tasks_delete) restricts to creator or host.
  const { error } = await supabase.from("game_plan_tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}
