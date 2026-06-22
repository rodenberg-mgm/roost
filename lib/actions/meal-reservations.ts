"use server";

import { createClient } from "@/lib/supabase/server";
import { taskState } from "@/lib/game-plan/derive";
import type { GamePlanTask } from "@/lib/schemas/game-plan";

export interface MealReservation {
  taskId: string;
  ownerName: string | null;
  state: "open" | "claimed" | "done";
}

/**
 * Map of meal-slot id -> its linked reservation to-do status. Game Plan is the
 * source of truth; Meals only reads it (one-directional coupling).
 */
export async function getMealReservations(
  tripId: string
): Promise<Record<string, MealReservation>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("game_plan_tasks")
    .select(
      "id, source_id, owner_user_id, done, owner:owner_user_id(display_name)"
    )
    .eq("trip_id", tripId)
    .eq("source_kind", "meal");

  if (error || !data) return {};

  const out: Record<string, MealReservation> = {};
  for (const row of data) {
    if (!row.source_id) continue;
    const owner = row.owner as unknown as { display_name: string } | null;
    // Reuse the shared derive with a minimal task shape.
    const state = taskState({
      done: row.done,
      owner_user_id: row.owner_user_id,
    } as GamePlanTask);
    out[row.source_id] = {
      taskId: row.id,
      ownerName: owner?.display_name ?? null,
      state,
    };
  }
  return out;
}
