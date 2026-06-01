# Packing list (v1.1, part 1) — design

**Date:** 2026-06-01
**Status:** Approved, ready for implementation plan
**Roadmap:** CLAUDE.md §4 v1.1 (packing list half; meal plan is a separate chunk)

## Goal

A trip packing list where any member adds items, multiple guests claim
quantities of an item, mark them "packed," and everyone sees updates live across
devices. This is the **first realtime feature** and establishes the reusable
`lib/realtime/use-trip-channel.ts` hook and the TanStack Query client layer that
meals / photos / chat will reuse.

## Decisions (from brainstorming)

- **Multi-claim with optional target quantity.** Items may have a `target_quantity`
  (counted, e.g. "Wine — 3") or none (uncounted, e.g. "Bluetooth speaker").
- **Over-packing is positive, never an error.** Counted items show packed/claimed
  vs. needed with surplus as a positive (`5 of 3 · +2`). Uncounted items show who's
  bringing them (`Alex +1`).
- **Not stealable.** A member can only create/edit/delete their own claim (RLS).
- **Two claim states:** *claimed* (committing to bring N) → *brought* (checked when
  actually packed).
- **State layer:** Approach A — add TanStack Query + a provider; realtime via
  Supabase `postgres_changes` invalidates queries.

## Data model — migration `0004_packing_claims.sql`

`packing_items` is empty (feature unbuilt), so restructure cleanly:

- **Alter `packing_items`:**
  - Add `target_quantity int` (nullable; null = uncounted).
  - Drop `claimed_by_user_id`, `claimed_at`, `is_completed`, `quantity` (text) —
    replaced by the claims table + target_quantity.
  - Keep `title`, `notes`, `sort_order`, `created_by_user_id`, timestamps.

- **New `packing_claims`:**
  ```
  id          uuid pk default gen_random_uuid()
  item_id     uuid not null references packing_items(id) on delete cascade
  trip_id     uuid not null references trips(id) on delete cascade  -- denormalized for RLS + realtime filter
  user_id     uuid not null references users(id) on delete cascade
  quantity    int  not null default 1 check (quantity > 0)
  brought     boolean not null default false
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()
  unique (item_id, user_id)   -- one claim row per person per item
  ```
  - `set_updated_at` trigger.

- **RLS (`packing_claims`)** — uses existing `is_trip_member` / `is_trip_host`
  SECURITY DEFINER helpers (avoids recursion):
  - select: `is_trip_member(trip_id)`
  - insert: `is_trip_member(trip_id) AND user_id = auth.uid()`
  - update: `using (user_id = auth.uid()) with check (user_id = auth.uid())`
  - delete: `user_id = auth.uid() OR is_trip_host(trip_id)`

- **`packing_items` RLS:** keep existing member select/insert/update; **change
  delete** from host-only to creator-OR-host:
  `using (created_by_user_id = auth.uid() OR is_trip_host(trip_id))`.

- **Realtime:** `alter publication supabase_realtime add table public.packing_claims;`
  (`packing_items` is already in the publication.)

## Realtime infra — `lib/realtime/use-trip-channel.ts`

- One channel per trip: `trip:{tripId}`, created from the session-aware browser
  client (`lib/supabase/client.ts`). Anonymous viewers never subscribe (§8).
- Subscribes to `postgres_changes` (INSERT/UPDATE/DELETE) on `packing_items` and
  `packing_claims`, filtered `trip_id=eq.{tripId}`.
- On any event, calls a supplied `onChange` (the packing page passes
  `queryClient.invalidateQueries` for its keys). Hook is state-layer-agnostic so
  meals/photos/chat can reuse it.
- Manages subscribe on mount / `removeChannel` on unmount; one channel instance.

## State layer — TanStack Query

- Add `@tanstack/react-query`; add a `QueryClientProvider` (client component)
  wired into the `(app)` layout (or a dedicated providers component).
- `useQuery(['packing', tripId])` fetches items+claims+claimer names via a server
  action / route.
- Mutations (`useMutation`) are optimistic with rollback on error.
- `use-trip-channel`'s `onChange` invalidates `['packing', tripId]` so other
  clients refetch; the acting client already shows the optimistic result.

## Server actions — `lib/actions/packing.ts`

- `getPacking(tripId)` — items + their claims + claimer display names (RLS-gated;
  member-only). Returns shape the aggregation function consumes.
- `addPackingItem(tripId, { title, target_quantity? })` — member.
- `deletePackingItem(itemId)` — creator or host (RLS-enforced).
- `claimItem(itemId, quantity)` — upsert caller's claim row (insert or update
  quantity); `user_id = auth.uid()`.
- `unclaimItem(itemId)` — delete caller's claim.
- `setBrought(claimId, brought)` — update caller's own claim.

## Aggregation logic (unit-tested)

Pure function `summarizeItem(item, claims)` → `{ needed: number|null, claimed:
number, packed: number, surplus: number, contributors: {name, quantity,
brought}[] }`. This is the bit with real logic; cover with Vitest.

## UI — `/trips/[id]/packing`

- Server component: `requireTripMembership`, initial `getPacking`, hydrate the
  query cache, render client `PackingList`.
- `PackingList` (client): consumes `use-trip-channel`; renders add-item form (any
  member: title + optional target qty), and each item with progress, the
  who's-bringing list, the caller's claim controls (claim / adjust qty / unclaim,
  "packed" toggle), and a delete control for the creator/host.
- Empty state: `topo-bg` background + sage icon, nudging the host to seed items.
- Brand: cards `bg-card`, forest accents, Lucide icons, mobile-first 375px.
- Flip `FeatureTiles` "Packing" tile from `soon` → link to `/trips/[id]/packing`.

## Testing

- **Vitest:** `summarizeItem` aggregation (counted, uncounted, surplus, zero,
  multi-contributor, all-brought).
- **Manual:** two browser sessions on one trip — claim/adjust/mark-packed in one,
  confirm live update in the other; verify a guest can't edit another's claim.

## Non-goals

Categories/sections; meal plan (separate chunk); packing on the anonymous
`/trip/[token]` view (realtime needs auth, §8); reminders/notifications; drag
reordering (sort_order exists but no reorder UI yet).
