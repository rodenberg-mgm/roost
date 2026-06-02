# Meal "eating out" mode — design

**Date:** 2026-06-02
**Status:** Approved, ready for implementation plan
**Extends:** the meal plan (`docs/superpowers/specs/2026-06-01-meal-plan-design.md`)

## Goal

Let the host mark a meal slot as "eating out" — a meet-here-at-this-time reminder
(place + time) instead of a cook sign-up. No one cooks; the slot shows where and
when the group is meeting. Example: Friday dinner on the lake weekend = a Mexican
restaurant, "meet at 7:00 PM."

## Decisions (from brainstorming)

- **Host/co-host only** can mark a meal as eating-out and set its place/time.
- **App-layer host enforcement** (server actions check role) rather than a DB
  trigger. RLS can't gate a single column, and for a trust-based product (§3.5)
  with real security reserved for sensitive data (§3.6), the residual risk (a
  cook hitting Supabase directly to flip the flag) is acceptable for MVP. A DB
  trigger is the documented follow-up if a hard guarantee is ever needed.
- **Reuse existing fields:** `title` = place/restaurant name; `notes` = details.
  `menu` and cooks are hidden for dining-out slots (no new join table).

## Data model — migration `0006_meal_dining_out.sql`

Add two columns to `meal_slots`:
- `is_dining_out boolean not null default false`
- `meet_time text` (free text, e.g. "7:00 PM"; nullable)

No RLS changes. The existing `meal_slots_cook_update` (host-or-cook) stays as a
backstop; the host-only gate on the dining-out fields lives in the actions.

## Types — `lib/schemas/meals.ts`

- `MealSlot` gains `is_dining_out: boolean` and `meet_time: string | null`.
- `addMealSlotSchema` gains `is_dining_out: z.boolean().optional()` and
  `meet_time: z.string().max(100).nullable().optional()`.
- `updateMealSlotSchema` gains `is_dining_out: z.boolean().optional()` and
  `meet_time: z.string().max(100).nullable().optional()`.

## Server actions — `lib/actions/meals.ts`

- Add a private `isTripHostFor(supabase, tripId, userId)` helper (reads
  `trip_members.role`, returns true for host/co-host).
- `getMeals`: select the two new columns; map into `MealSlot`.
- `addMealSlot`: accept `is_dining_out` + `meet_time`. **If `is_dining_out` is
  true, verify the caller is host/co-host** (reject otherwise: "Only the host can
  set an eating-out meal"). Insert both columns (defaults: false / null).
  Date-range lock still applies.
- `updateMealSlot`: accept `is_dining_out` + `meet_time`. **If either is present
  in the input, verify host/co-host before writing** (the slot's `trip_id` is read
  to check role). Other fields (title/menu/notes) keep the existing host-or-cook
  RLS behavior. This is the path for editing dining-out details and for converting
  a slot back to cooking (`is_dining_out: false`).

## UI

### Add-meal form (`meals-list.tsx`)
- Host/co-host see a "Cooking / Eating out" segmented toggle (two buttons).
  Non-hosts don't see it (cooking only).
- **Eating out** selected: the form collects **Place** (→ `title`) and **Meet
  time** (→ `meet_time`) instead of just an optional title; still collects day +
  meal type. Submits with `is_dining_out: true`.
- **Cooking** selected (default): unchanged.

### Slot card (`meal-slot-card.tsx`)
- **Dining-out slot:** an "Eating out" badge (brand stamp style), the place name
  (title), a "Meet at {meet_time}" line (Lucide `MapPin`/`Clock` icon), notes.
  **No cooks list, no "I'll cook" button.** Host/co-host get an edit form (place,
  meet time, notes) plus a "Switch to cooking" action; creator-or-host delete.
- **Cook slot:** unchanged (cooks, menu, "I'll cook", host/cook edit).
- The card branches on `slot.is_dining_out`.

## Testing

- **Vitest:** `groupMealSlots` still orders a dining-out dinner into the dinner
  position (add a case mixing a dining-out and a cook slot on one day).
- **Manual:** as host, add an eating-out Friday dinner ("El Mexicano", "7:00 PM")
  → shows the place + meet time, no cook sign-up; a joined guest sees it read-only
  with no "I'll cook" and **no eating-out toggle** in their add form; host can edit
  it and switch it back to cooking.

## Non-goals

Map/geocoding for the place; reservation links; per-person RSVP to the outing;
calendar/time-zone handling on `meet_time` (free text); a DB trigger for hard
host enforcement (documented follow-up).
