# Meal plan (v1.1, part 2) — design

**Date:** 2026-06-01
**Status:** Approved, ready for implementation plan
**Roadmap:** CLAUDE.md §4 v1.1 (meal plan half; packing list already shipped)

## Goal

A trip meal plan where any member adds meal slots (by day + meal type), multiple
guests volunteer to cook a slot, and everyone edits a shared menu/notes — all live
across devices. Reuses the realtime + TanStack Query infrastructure built for the
packing list.

## Decisions (from brainstorming)

- **Multiple cooks per meal** via a new `meal_cooks` table (mirrors
  `packing_claims`). A meal slot can have several volunteers.
- **Any member can create slots** (not host-only) — consistent with packing and
  §3.5 ("everyone can edit").
- **Shared, slot-level menu/notes**, editable by any member (not per-cook).
- **Manual slot creation** (pick a day + meal type + optional title) — no
  auto-generated grid.
- **Families/groups are explicitly deferred.** That concept is cross-cutting and
  Hearth-coupled (CLAUDE.md §10, v3.0). Multi-cook at the individual level keeps
  the door open: a future "family signs up together" is just multiple individual
  rows (or a later optional `group_id`), with no rework of the meal model.

## Data model — migration `0005_meal_cooks.sql`

`meal_slots` is empty (feature unbuilt), so restructure cleanly:

- **Alter `meal_slots`:**
  - Drop `cook_user_id` (replaced by `meal_cooks`).
  - Add `created_by_user_id uuid not null references public.users(id)` (for
    creator-or-host delete; mirrors `packing_items`).
  - Keep `day_date`, `meal_type` (check: breakfast/lunch/dinner/other), `title`,
    `menu`, `notes`, `sort_order`, timestamps.

- **New `meal_cooks`:**
  ```
  id          uuid pk default gen_random_uuid()
  slot_id     uuid not null references meal_slots(id) on delete cascade
  trip_id     uuid not null references trips(id) on delete cascade  -- denormalized for RLS + realtime filter
  user_id     uuid not null references users(id) on delete cascade
  created_at  timestamptz not null default now()
  unique (slot_id, user_id)
  ```
  Just a sign-up — no quantity/brought (meals don't need packing's surplus math),
  so no `updated_at`/trigger needed.

- **RLS (`meal_slots`)** — drop the host-only insert from migration 0002; replace
  with member insert. Keep member select/update. Add delete.
  - select: `is_trip_member(trip_id)` (unchanged)
  - insert: `is_trip_member(trip_id) AND created_by_user_id = auth.uid()`
  - update: `is_trip_member(trip_id)` (unchanged — shared menu/notes/title)
  - delete: `created_by_user_id = auth.uid() OR is_trip_host(trip_id)`

- **RLS (`meal_cooks`)** — uses `is_trip_member` / `is_trip_host`:
  - select: `is_trip_member(trip_id)`
  - insert: `is_trip_member(trip_id) AND user_id = auth.uid()`
  - delete: `user_id = auth.uid() OR is_trip_host(trip_id)`
  - (no update — a sign-up is immutable; you join or leave)

- **Realtime:** `alter publication supabase_realtime add table public.meal_cooks;`
  (`meal_slots` is already in the publication from 0001.)

## Realtime — generalize `lib/realtime/use-trip-channel.ts`

The hook currently hardcodes the packing tables. Parameterize it:
`useTripChannel(tripId, tables: string[], onChange)`, subscribing to
`postgres_changes` on each table filtered by `trip_id`. `tables` must be a stable
reference (module-level constant in each consumer). Update the existing packing
consumer (`packing-list.tsx`) to pass `["packing_items", "packing_claims"]`.
Meals passes `["meal_slots", "meal_cooks"]`. One channel per trip, unchanged
contract otherwise (CLAUDE.md §7).

## Schemas + types — `lib/schemas/meals.ts`

- `addMealSlotSchema`: `{ trip_id: uuid, day_date: string (ISO date), meal_type:
  enum(breakfast|lunch|dinner|other), title?: string<=200 }`.
- `updateMealSlotSchema`: `{ slot_id: uuid, title?: string<=200, menu?:
  string<=5000, notes?: string<=2000 }`.
- Shared types:
  ```ts
  interface MealCook { id: string; user_id: string; user_name: string; }
  interface MealSlot {
    id: string; day_date: string;
    meal_type: "breakfast" | "lunch" | "dinner" | "other";
    title: string | null; menu: string | null; notes: string | null;
    sort_order: number; created_by_user_id: string;
    cooks: MealCook[];
  }
  ```

## Grouping logic — `lib/meals/group.ts` (unit-tested)

Pure `groupMealSlots(slots: MealSlot[]): { day: string; slots: MealSlot[] }[]`:
- Days sorted ascending by `day_date`.
- Within a day, sort by meal type order (breakfast=0, lunch=1, dinner=2,
  other=3), then `sort_order`.
Covered by Vitest: empty, single day multi-meal ordering, multi-day ordering,
`other` sorts last.

## Server actions — `lib/actions/meals.ts`

- `getMeals(tripId)`: slots + cooks + cook display names (RLS-gated, member-only).
- `addMealSlot({ trip_id, day_date, meal_type, title? })`: member.
- `updateMealSlot({ slot_id, title?, menu?, notes? })`: member (shared fields).
- `deleteMealSlot(slotId)`: creator or host (RLS).
- `joinCook(slotId)`: insert the caller's `meal_cooks` row (reads `trip_id` from
  the slot first, like `claimItem`).
- `leaveCook(slotId)`: delete the caller's `meal_cooks` row.

## UI — `/trips/[id]/meals`

- Server route: `requireTripMembership`, initial `getMeals`, render client
  `MealsList`.
- `MealsList` (client): TanStack Query (`["meals", tripId]`, `initialData` +
  `initialDataUpdatedAt: 0`), `useTripChannel(tripId, MEAL_TABLES, invalidate)`,
  optimistic-free mutations with `onSettled` invalidate (consistent with packing).
  Add-slot form: date input (defaults to trip `starts_on` if set) + meal-type
  select + optional title. Renders `groupMealSlots` output as day sections.
- `MealSlotCard` (client): meal type + title header; the cooks signed up; an
  "I'll cook" / "Leave" toggle for the current user; shared menu/notes with an
  inline edit form (any member); creator-or-host delete.
- Empty state: `topo-bg` + sage icon nudging a member to add the first meal.
- Brand: `bg-card`, forest accents, Lucide icons, mobile-first 375px.
- Flip the FeatureTiles "Meals" tile from `soon` → link to `/trips/[id]/meals`.

## Testing

- **Vitest:** `groupMealSlots` (empty, single-day meal-type ordering, multi-day,
  `other` last).
- **Manual:** two browser sessions — add a slot, both volunteer to cook one meal,
  edit the menu in one and see it live in the other, confirm a guest can leave only
  their own cook sign-up.

## Non-goals

Families/groups (deferred, Hearth-era); per-cook dish assignments; auto-generated
slot grids; meal reminders/notifications; calendar export; recipe links;
drag reorder.
