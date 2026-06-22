# Game Plan — claimable trip to-dos

**Date:** 2026-06-22
**Status:** Approved (design)
**Phase:** v1.1-adjacent (ships alongside packing/meals)

## Goal

A trip "Game Plan": a claimable to-do list for actions someone needs to *do*
before or during a trip — book the Saturday tee time, buy excursion tickets,
make a dinner reservation. Each to-do has one owner (with optional helpers), an
optional due date, a done state, and a note. To-dos can also be created from
other pages (notably Meals) with a soft link back to their source.

This is a sibling of Packing and Meals, not a variation of them: Packing tracks
*quantities of things to bring*; Game Plan tracks *discrete actions to complete*.

## Naming

- Nav / tile label: **Game Plan** (warm, on-brand; "Tasks" reads corporate).
- Items are "to-dos" in UI copy. Tables use `task` for brevity.

## Ownership model

**One owner per to-do, plus optional helpers.**

- Exactly one owner is a structural invariant: `owner_user_id` is a single
  nullable column, so two people cannot both own a to-do (prevents two people
  both booking the same tee time).
- `owner_user_id is null` ⇒ the to-do is **Open** (unclaimed).
- Helpers ("I can help") are a separate join table, mirroring `meal_cooks`.

## States (derived, no status enum)

| State | Condition | UI |
|---|---|---|
| **Open** | `owner_user_id is null` | "I'll do this" button |
| **Claimed** | owner set, `done = false` | owner + helpers, note, due pill |
| **Done** | `done = true` | checked, muted, sinks to bottom |

Transitions: claim (open → you), release (→ open), join/leave as helper, toggle
done, edit note/due. Only the owner or host may toggle `done` and edit
note/due_date — matches the "cook can update the slot" rule in Meals.

## Data model

Two new tables. Conventions copied from `packing_claims` (0004) and
`meal_cooks` (0005): `trip_id` denormalized onto child rows for RLS, the shared
`set_updated_at` trigger, soft-delete is **not** used here (to-dos are hard
deleted by creator/host, consistent with packing_items/meal_slots).

### `game_plan_tasks`

| column | type | notes |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `trip_id` | uuid not null → `trips(id)` on delete cascade | |
| `title` | text not null, `char_length(title) between 1 and 200` | the action |
| `owner_user_id` | uuid null → `users(id)` on delete set null | null = Open |
| `note` | text null, `char_length(note) <= 280` | owner/host editable; carries confirmation numbers |
| `due_date` | date null | optional "needed by" |
| `done` | boolean not null default false | |
| `created_by_user_id` | uuid not null → `users(id)` on delete cascade | |
| `source_kind` | text null | soft ref, e.g. `'meal'`; **not** a FK |
| `source_id` | uuid null | soft ref; no cascade |
| `sort_order` | integer not null default 0 | matches packing |
| `created_at` | timestamptz not null default `now()` | |
| `updated_at` | timestamptz not null default `now()` | `set_updated_at` trigger |

Notes:
- `owner_user_id` is `on delete set null` (not cascade): if an owner's user row
  is removed, the to-do becomes Open rather than vanishing.
- `source_kind` / `source_id` are a **soft reference**, deliberately not a
  foreign key. If the linked meal slot is deleted, the to-do survives as a
  standalone item — "make a reservation" is still real work. The task stores its
  own `title`, so it remains meaningful with a dangling source.

### `game_plan_task_helpers`

Mirrors `meal_cooks` verbatim.

| column | type |
|---|---|
| `id` | uuid pk default `gen_random_uuid()` |
| `task_id` | uuid not null → `game_plan_tasks(id)` on delete cascade |
| `trip_id` | uuid not null → `trips(id)` on delete cascade |
| `user_id` | uuid not null → `users(id)` on delete cascade |
| `created_at` | timestamptz not null default `now()` |
| | `unique (task_id, user_id)` |

## RLS

Uses existing `is_trip_member(trip_id)` / `is_trip_host(trip_id)` helpers.
Members-only (anonymous viewers do not see Game Plan, consistent with
packing/meals).

`game_plan_tasks`:
- **select**: `is_trip_member(trip_id)`
- **insert**: `is_trip_member(trip_id) and created_by_user_id = auth.uid()`
- **update**: `is_trip_host(trip_id) or owner_user_id = auth.uid()`
- **delete**: `created_by_user_id = auth.uid() or is_trip_host(trip_id)`

`game_plan_task_helpers` (verbatim from `meal_cooks`):
- **select**: `is_trip_member(trip_id)`
- **insert**: `is_trip_member(trip_id) and user_id = auth.uid()`
- **delete**: `user_id = auth.uid() or is_trip_host(trip_id)`

**Claim wrinkle:** claiming an *Open* to-do means a non-owner sets
`owner_user_id` to themselves, but the update policy requires you to *already* be
the owner. Resolve this the same way packing separates `claimItem` from raw
updates: claim/release/done/note go through dedicated **server actions** that
read the row, verify membership, and enforce the specific transition. The RLS
update policy stays host-or-owner; a `claimTask` action permits the open→you
transition explicitly (and refuses if already owned by someone else).

## Realtime

Both tables added to the `supabase_realtime` publication. The Game Plan screen
subscribes through `lib/realtime/use-trip-channel.ts` — never raw Realtime —
consistent with packing/meals.

## Cross-page creation (Meals integration)

**One-directional coupling: Game Plan owns to-dos; other pages create into it
and may read from it, but never store to-do data.**

1. **Generic `addTask` server action** accepts optional prefilled `title` and an
   optional soft source `{ source_kind, source_id }`. Any page can call it.
2. **Meals entry point (the one concrete v1 integration):** when a meal slot is
   set to "dining out," show an inline **"Add reservation to Game Plan"** action
   that creates a to-do titled e.g. *"Reserve a table — Dinner, Sat"* with
   `source_kind='meal'`, `source_id=<slot_id>`.
3. **Read-only loop-closing:** the dining-out slot shows a status chip derived
   from the linked to-do — *"Reservation: needed"* → *"Reservation: Jake"* →
   *"Reservation ✓"*. Prevents duplicates and shows handled-status without
   leaving Meals. Meals **reads** Game Plan; Game Plan never reaches into Meals.
4. On the Game Plan side, a sourced to-do shows a **"↗ from Dinner, Sat"** chip
   that deep-links back to the Meals page.

**Packing entry points: out of scope for now.** No concrete use case yet.
Because `addTask({source_kind, source_id})` is generic, a future packing trigger
is a button calling the same action — **zero schema change**.

## UI — Game Plan screen

Mobile-first (375px), then verified at 768 / 1024 / 1440. Reuses the packing
visual language; **run `ui-ux-pro-max` before building the screen** (CLAUDE.md
§7). No pure white; cards `bg-card`, page `bg-page`; forest as the primary
interactive color; Lucide icons only (`ListChecks` for the tile/nav).

- **Section header**: stamp badge treatment, "GAME PLAN" (mono, uppercase).
- **Add to-do composer** at top: title input + optional due-date picker.
- **To-do row**:
  - Title + optional **due-date pill** — sage normally, brick when overdue/urgent.
  - **Owner**: avatar + name, or a forest **"I'll do this"** button when Open.
    A small **"+ help"** lets others join; helper avatars stack beside the owner.
  - **Note** line (italic, `text-ink-light`); inline edit for owner/host.
  - **Done** checkbox on the right (owner/host only).
  - **Source chip** "↗ from Dinner, Sat" when present, deep-links back.
- **Sort**: Open + soonest-due first; Done sinks to the bottom, muted.
- **Empty state**: `topo-bg` + sage icon, copy like "Nothing to plan yet —
  add the first to-do."
- **Realtime**: live claim/done/note updates across devices via
  `use-trip-channel`.

### Mobile layout specifics

- Single-column list; each row is a full-width `bg-card` with `border-subtle`.
- Title wraps to two lines max; due pill sits on the title's right, never pushed
  off-screen (title gets `min-w-0`, pill `shrink-0`).
- Owner/help controls live on a second line within the row on narrow widths to
  avoid horizontal crowding; collapse to a single line at `sm`+.
- Touch targets ≥ 44px for claim / done / help.
- Note edit opens inline (not a modal) to stay thumb-friendly.

## Out of scope (explicit)

- Helpers leaving their own notes (only the owner's note — avoids drifting into
  the v1.3 message board).
- A status enum / "in progress" beyond the derived Open/Claimed/Done.
- Packing entry points.
- Reminders / notifications on due dates (could come later; due_date is stored
  and sortable, which is the foundation).
- Anonymous-viewer visibility of Game Plan.

## Files (anticipated)

- `supabase/migrations/0012_game_plan.sql` — both tables, RLS, realtime.
- `lib/schemas/game-plan.ts` — zod schemas + shared types.
- `lib/actions/game-plan.ts` — `getGamePlan`, `addTask`, `claimTask`,
  `releaseTask`, `setDone`, `setTaskNote`, `setTaskDue`, `joinAsHelper`,
  `leaveAsHelper`, `deleteTask`.
- `lib/game-plan/` — any derive/sort helpers (mirrors `lib/packing/summarize.ts`).
- `app/(app)/trips/[id]/game-plan/page.tsx` + client components.
- Meals page: dining-out "Add reservation" action + status chip (reads tasks by
  source).
- `components/feature-tiles.tsx` — add Game Plan tile (replace a placeholder).
