"use server";

import { createClient } from "@/lib/supabase/server";
import {
  addMealSlotSchema,
  updateMealSlotSchema,
  type MealSlot,
} from "@/lib/schemas/meals";

/** True if the user is host/co-host of the trip. Used to gate the dining-out
 *  fields, which RLS can't restrict per-column. */
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

/** Fetch all meal slots for a trip with their cooks + cook names. */
export async function getMeals(tripId: string): Promise<MealSlot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meal_slots")
    .select(
      "id, day_date, meal_type, title, menu, notes, is_dining_out, meet_time, sort_order, created_by_user_id, cooks:meal_cooks(id, user_id, users:user_id(display_name))"
    )
    .eq("trip_id", tripId)
    .order("day_date", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    day_date: row.day_date,
    meal_type: row.meal_type as MealSlot["meal_type"],
    title: row.title,
    menu: row.menu,
    notes: row.notes,
    is_dining_out: row.is_dining_out,
    meet_time: row.meet_time,
    sort_order: row.sort_order,
    created_by_user_id: row.created_by_user_id,
    cooks: (row.cooks ?? []).map((c) => {
      const u = c.users as unknown as { display_name: string } | null;
      return {
        id: c.id,
        user_id: c.user_id,
        user_name: u?.display_name ?? "Someone",
      };
    }),
  }));
}

export async function addMealSlot(input: {
  trip_id: string;
  day_date: string;
  meal_type: string;
  title?: string;
  is_dining_out?: boolean;
  meet_time?: string | null;
}) {
  const parsed = addMealSlotSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { _form: ["Not authenticated"] } };

  // Only host/co-host may create an eating-out meal.
  if (parsed.data.is_dining_out) {
    const isHost = await isHostOfTrip(supabase, parsed.data.trip_id, user.id);
    if (!isHost) {
      return { error: { _form: ["Only the host can set an eating-out meal"] } };
    }
  }

  // Lock the slot to the trip's date range (server-side; can't be bypassed).
  const { data: trip } = await supabase
    .from("trips")
    .select("starts_on, ends_on")
    .eq("id", parsed.data.trip_id)
    .single();
  if (!trip) return { error: { _form: ["Trip not found"] } };
  if (!trip.starts_on || !trip.ends_on) {
    return { error: { _form: ["Set the trip dates first"] } };
  }
  if (parsed.data.day_date < trip.starts_on || parsed.data.day_date > trip.ends_on) {
    return { error: { _form: ["That date is outside the trip"] } };
  }

  const { error } = await supabase.from("meal_slots").insert({
    trip_id: parsed.data.trip_id,
    day_date: parsed.data.day_date,
    meal_type: parsed.data.meal_type,
    title: parsed.data.title || null,
    is_dining_out: parsed.data.is_dining_out ?? false,
    meet_time: parsed.data.meet_time || null,
    created_by_user_id: user.id,
  });

  if (error) return { error: { _form: [error.message] } };
  return { data: { ok: true } };
}

export async function updateMealSlot(input: {
  slot_id: string;
  title?: string | null;
  menu?: string | null;
  notes?: string | null;
  is_dining_out?: boolean;
  meet_time?: string | null;
}) {
  const parsed = updateMealSlotSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = await createClient();

  // The dining-out fields are host-only (RLS can't gate a single column).
  const touchesDiningFields =
    parsed.data.is_dining_out !== undefined || parsed.data.meet_time !== undefined;
  if (touchesDiningFields) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };
    const { data: slot } = await supabase
      .from("meal_slots")
      .select("trip_id")
      .eq("id", parsed.data.slot_id)
      .single();
    if (!slot) return { error: "Meal not found" };
    if (!(await isHostOfTrip(supabase, slot.trip_id, user.id))) {
      return { error: "Only the host can change eating-out details" };
    }
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title || null;
  if (parsed.data.menu !== undefined) patch.menu = parsed.data.menu || null;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes || null;
  if (parsed.data.meet_time !== undefined) patch.meet_time = parsed.data.meet_time || null;
  if (parsed.data.is_dining_out !== undefined) {
    patch.is_dining_out = parsed.data.is_dining_out;
    // Switching back to cooking clears a stale meet time.
    if (!parsed.data.is_dining_out) patch.meet_time = null;
  }
  if (Object.keys(patch).length === 0) return { data: { ok: true } };

  // RLS (meal_slots_cook_update) restricts writes to the host or a signed-up cook.
  // A blocked write affects 0 rows with no error, so check the count and report it.
  const { error, count } = await supabase
    .from("meal_slots")
    .update(patch, { count: "exact" })
    .eq("id", parsed.data.slot_id);

  if (error) return { error: error.message };
  if (!count) return { error: "Only the host or a cook on this meal can edit it" };
  return { data: { ok: true } };
}

export async function deleteMealSlot(slotId: string) {
  const supabase = await createClient();
  // RLS (meal_slots_delete) restricts to creator or host.
  const { error } = await supabase.from("meal_slots").delete().eq("id", slotId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function joinCook(slotId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: slot } = await supabase
    .from("meal_slots")
    .select("trip_id")
    .eq("id", slotId)
    .single();
  if (!slot) return { error: "Meal not found" };

  const { error } = await supabase.from("meal_cooks").upsert(
    { slot_id: slotId, trip_id: slot.trip_id, user_id: user.id },
    { onConflict: "slot_id,user_id" }
  );

  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function leaveCook(slotId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("meal_cooks")
    .delete()
    .eq("slot_id", slotId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}
