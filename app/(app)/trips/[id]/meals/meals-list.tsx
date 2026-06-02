"use client";

import { MealSlotCard } from "./meal-slot-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMealSlot,
  deleteMealSlot,
  getMeals,
  joinCook,
  leaveCook,
  updateMealSlot,
} from "@/lib/actions/meals";
import { groupMealSlots } from "@/lib/meals/group";
import { MEAL_TYPES, type MealSlot, type MealType } from "@/lib/schemas/meals";
import { useTripChannel } from "@/lib/realtime/use-trip-channel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

const MEAL_TABLES = ["meal_slots", "meal_cooks"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  other: "Other",
};

interface MealsListProps {
  tripId: string;
  initialSlots: MealSlot[];
  currentUserId: string;
  isHost: boolean;
  startsOn: string | null;
  endsOn: string | null;
}

export function MealsList({
  tripId,
  initialSlots,
  currentUserId,
  isHost,
  startsOn,
  endsOn,
}: MealsListProps) {
  const queryClient = useQueryClient();

  const { data: slots = [] } = useQuery({
    queryKey: ["meals", tripId],
    queryFn: () => getMeals(tripId),
    initialData: initialSlots,
    initialDataUpdatedAt: 0,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["meals", tripId] });
  }, [queryClient, tripId]);
  useTripChannel(tripId, MEAL_TABLES, invalidate);

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["meals", tripId] });

  const join = useMutation({ mutationFn: (slotId: string) => joinCook(slotId), onSettled: refetch });
  const leave = useMutation({ mutationFn: (slotId: string) => leaveCook(slotId), onSettled: refetch });
  const save = useMutation({
    mutationFn: (v: {
      slotId: string;
      fields: {
        title?: string;
        menu?: string;
        notes?: string;
        meet_time?: string | null;
        is_dining_out?: boolean;
      };
    }) => updateMealSlot({ slot_id: v.slotId, ...v.fields }),
    onSettled: refetch,
  });
  const remove = useMutation({ mutationFn: (slotId: string) => deleteMealSlot(slotId), onSettled: refetch });

  const datesTBD = !startsOn || !endsOn;

  const [adding, setAdding] = useState(false);
  const [day, setDay] = useState(startsOn ?? "");
  const [mealType, setMealType] = useState<MealType>("dinner");
  const [title, setTitle] = useState("");
  const [diningOut, setDiningOut] = useState(false);
  const [meetTime, setMeetTime] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      const res = await addMealSlot({
        trip_id: tripId,
        day_date: day,
        meal_type: mealType,
        title: title.trim() || undefined,
        is_dining_out: diningOut,
        meet_time: diningOut ? meetTime.trim() || null : undefined,
      });
      if ("error" in res && res.error) {
        const err = res.error as unknown;
        const msg =
          typeof err === "string"
            ? err
            : (err as { _form?: string[] })._form?.[0] ?? "Couldn't add meal";
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      setTitle("");
      setMealType("dinner");
      setDay(startsOn ?? "");
      setDiningOut(false);
      setMeetTime("");
      setAdding(false);
      setAddError(null);
    },
    onError: (e: Error) => setAddError(e.message),
    onSettled: refetch,
  });

  const formatDay = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  if (datesTBD) {
    return (
      <div className="topo-bg rounded-card border bg-card p-8 text-center">
        <CalendarOff className="mx-auto h-10 w-10 text-sage" />
        <h2 className="mt-3 font-semibold text-ink">Set your trip dates first</h2>
        <p className="mt-1 text-sm text-ink-light">
          Meals are planned by day, so add a start and end date to the trip.
        </p>
        <Link
          href={`/trips/${tripId}/edit`}
          className="mt-4 inline-block rounded-button bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-forest-dark"
        >
          Edit trip dates
        </Link>
      </div>
    );
  }

  const groupedDays = groupMealSlots(slots);

  return (
    <div className="space-y-4">
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (day) add.mutate();
          }}
          className="rounded-card border bg-card p-4 shadow-card"
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="meal-day">Day</Label>
              <Input
                id="meal-day"
                type="date"
                min={startsOn ?? undefined}
                max={endsOn ?? undefined}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meal-type">Meal</Label>
              <select
                id="meal-type"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="w-full rounded-input border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MEAL_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            {isHost && (
              <div className="space-y-1.5">
                <Label>This meal</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDiningOut(false)}
                    className={`flex-1 rounded-button border px-3 py-2 text-sm transition-colors ${
                      !diningOut
                        ? "border-forest bg-forest/10 text-forest"
                        : "border-subtle text-ink-light hover:text-forest"
                    }`}
                  >
                    Cooking
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiningOut(true)}
                    className={`flex-1 rounded-button border px-3 py-2 text-sm transition-colors ${
                      diningOut
                        ? "border-forest bg-forest/10 text-forest"
                        : "border-subtle text-ink-light hover:text-forest"
                    }`}
                  >
                    Eating out
                  </button>
                </div>
              </div>
            )}

            {diningOut ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="meal-place">Place</Label>
                  <Input
                    id="meal-place"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="El Mexicano"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meal-meet-time">Meet time</Label>
                  <Input
                    id="meal-meet-time"
                    value={meetTime}
                    onChange={(e) => setMeetTime(e.target.value)}
                    placeholder="7:00 PM"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="meal-title">Title (optional)</Label>
                <Input
                  id="meal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Taco night"
                />
              </div>
            )}
            {addError && <p className="text-sm text-brick">{addError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAdding(false);
                  setAddError(null);
                  setDiningOut(false);
                  setMeetTime("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-forest text-white hover:bg-forest-dark"
                disabled={!day || add.isPending}
              >
                Add meal
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full gap-1.5 bg-forest text-white hover:bg-forest-dark"
        >
          <Plus className="h-4 w-4" />
          Add a meal
        </Button>
      )}

      {slots.length === 0 ? (
        <div className="topo-bg rounded-card border bg-card p-8 text-center">
          <UtensilsCrossed className="mx-auto h-10 w-10 text-sage" />
          <h2 className="mt-3 font-semibold text-ink">No meals planned yet</h2>
          <p className="mt-1 text-sm text-ink-light">
            Add a meal and volunteer to cook — everyone can pitch in.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedDays.map((group) => (
            <section key={group.day}>
              <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-ink-light">
                {formatDay(group.day)}
              </h2>
              <ul className="space-y-3">
                {group.slots.map((slot) => (
                  <MealSlotCard
                    key={slot.id}
                    slot={slot}
                    currentUserId={currentUserId}
                    isHost={isHost}
                    onJoin={(slotId) => join.mutate(slotId)}
                    onLeave={(slotId) => leave.mutate(slotId)}
                    onSaveDetails={async (slotId, fields) => {
                      const res = await save.mutateAsync({ slotId, fields });
                      return "error" in res && res.error ? { error: res.error } : {};
                    }}
                    onDelete={(slotId) => remove.mutate(slotId)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
