# Packing List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A trip packing list where any member adds items, multiple guests claim quantities and mark them packed, and all devices see updates live.

**Architecture:** Postgres `packing_items` + new `packing_claims` (multi-claim) with RLS. Realtime via Supabase `postgres_changes` through one reusable `use-trip-channel` hook. Client state via TanStack Query with optimistic mutations. UI at `/trips/[id]/packing`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres/RLS/Realtime), `@tanstack/react-query`, Tailwind v4, Lucide, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-packing-list-design.md`

---

## File Structure

- `supabase/migrations/0004_packing_claims.sql` — schema restructure, RLS, realtime (Task 1)
- `lib/schemas/packing.ts` — zod input schemas + shared TS types (Task 2)
- `lib/packing/summarize.ts` — pure aggregation function (Task 3)
- `__tests__/lib/packing/summarize.test.ts` — unit tests (Task 3)
- `lib/actions/packing.ts` — server actions (Task 4)
- `components/providers.tsx` — TanStack Query provider; wired into `app/(app)/layout.tsx` (Task 5)
- `lib/realtime/use-trip-channel.ts` — reusable realtime subscription hook (Task 6)
- `app/(app)/trips/[id]/packing/page.tsx` — server route (Task 7)
- `app/(app)/trips/[id]/packing/packing-list.tsx` — client container (Task 8)
- `app/(app)/trips/[id]/packing/packing-item-row.tsx` — one item's row + controls (Task 8)
- `components/feature-tiles.tsx` — flip Packing tile to a link (Task 9)

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0004_packing_claims.sql`

Note: migrations are applied manually in the Supabase SQL editor for now (see the header of `0001_init.sql`). There is no automated DB test; verification is running the SQL and a check query.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0004_packing_claims.sql`:

```sql
-- 0004_packing_claims.sql
-- Packing list v1.1: restructure packing_items for multi-claim + optional target,
-- add packing_claims, RLS, and realtime.

-- ============================================================
-- 1. RESTRUCTURE packing_items
-- packing_items is empty (feature unbuilt) so dropping columns is safe.
-- ============================================================
alter table public.packing_items
  add column if not exists target_quantity integer;

alter table public.packing_items
  drop column if exists claimed_by_user_id,
  drop column if exists claimed_at,
  drop column if exists is_completed,
  drop column if exists quantity;

-- ============================================================
-- 2. CREATE packing_claims
-- ============================================================
create table public.packing_claims (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.packing_items(id) on delete cascade,
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  brought     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.packing_claims enable row level security;

create trigger set_updated_at before update on public.packing_claims
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. RLS for packing_claims (uses existing is_trip_member / is_trip_host)
-- ============================================================
create policy "packing_claims_member_select"
  on public.packing_claims for select
  using (public.is_trip_member(trip_id));

create policy "packing_claims_own_insert"
  on public.packing_claims for insert
  with check (public.is_trip_member(trip_id) and user_id = auth.uid());

create policy "packing_claims_own_update"
  on public.packing_claims for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "packing_claims_delete"
  on public.packing_claims for delete
  using (user_id = auth.uid() or public.is_trip_host(trip_id));

-- ============================================================
-- 4. Loosen packing_items delete: creator OR host (was host-only in 0002)
-- ============================================================
drop policy if exists "packing_items_host_delete" on public.packing_items;

create policy "packing_items_delete"
  on public.packing_items for delete
  using (
    created_by_user_id = auth.uid()
    or public.is_trip_host(trip_id)
  );

-- ============================================================
-- 5. Realtime (packing_items already in the publication from 0001)
-- ============================================================
alter publication supabase_realtime add table public.packing_claims;
```

- [ ] **Step 2: Apply and verify**

Apply the SQL in the Supabase SQL editor. Then verify in the editor:

```sql
select column_name from information_schema.columns
where table_name = 'packing_items' and column_name in
  ('target_quantity','claimed_by_user_id','quantity');
-- Expected: only 'target_quantity'

select count(*) from public.packing_claims;  -- Expected: 0 (table exists)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_packing_claims.sql
git commit -m "feat(packing): migration for multi-claim packing list"
```

---

## Task 2: Schemas and shared types

**Files:**
- Create: `lib/schemas/packing.ts`

- [ ] **Step 1: Write the schemas and types**

Create `lib/schemas/packing.ts`:

```ts
import { z } from "zod";

export const addPackingItemSchema = z.object({
  trip_id: z.string().uuid(),
  title: z.string().min(1, "Item name is required").max(200),
  target_quantity: z.number().int().positive().max(9999).nullable().optional(),
});
export type AddPackingItemInput = z.infer<typeof addPackingItemSchema>;

export const claimItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().positive().max(9999),
});
export type ClaimItemInput = z.infer<typeof claimItemSchema>;

// Shared shapes returned by getPacking and consumed by summarize + UI.
export interface PackingClaim {
  id: string;
  user_id: string;
  user_name: string;
  quantity: number;
  brought: boolean;
}

export interface PackingItem {
  id: string;
  title: string;
  target_quantity: number | null;
  created_by_user_id: string;
  sort_order: number;
  claims: PackingClaim[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/packing.ts
git commit -m "feat(packing): zod schemas and shared types"
```

---

## Task 3: Aggregation logic (TDD)

**Files:**
- Create: `lib/packing/summarize.ts`
- Test: `__tests__/lib/packing/summarize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/packing/summarize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeItem } from "@/lib/packing/summarize";
import type { PackingItem } from "@/lib/schemas/packing";

function item(partial: Partial<PackingItem>): PackingItem {
  return {
    id: "i1",
    title: "Wine",
    target_quantity: null,
    created_by_user_id: "u0",
    sort_order: 0,
    claims: [],
    ...partial,
  };
}

describe("summarizeItem", () => {
  it("uncounted item with no claims", () => {
    const s = summarizeItem(item({ target_quantity: null }));
    expect(s.needed).toBeNull();
    expect(s.claimed).toBe(0);
    expect(s.packed).toBe(0);
    expect(s.surplus).toBe(0);
    expect(s.fullyPacked).toBe(false);
    expect(s.contributors).toEqual([]);
  });

  it("sums claimed and packed quantities", () => {
    const s = summarizeItem(
      item({
        target_quantity: 3,
        claims: [
          { id: "c1", user_id: "u1", user_name: "Alex", quantity: 2, brought: true },
          { id: "c2", user_id: "u2", user_name: "Bo", quantity: 1, brought: false },
        ],
      })
    );
    expect(s.needed).toBe(3);
    expect(s.claimed).toBe(3);
    expect(s.packed).toBe(2);
    expect(s.surplus).toBe(0);
    expect(s.fullyPacked).toBe(false);
  });

  it("treats overpacking as positive surplus, never negative", () => {
    const s = summarizeItem(
      item({
        target_quantity: 3,
        claims: [
          { id: "c1", user_id: "u1", user_name: "Alex", quantity: 3, brought: true },
          { id: "c2", user_id: "u2", user_name: "Bo", quantity: 2, brought: true },
        ],
      })
    );
    expect(s.packed).toBe(5);
    expect(s.surplus).toBe(2);
    expect(s.fullyPacked).toBe(true);
  });

  it("uncounted item never reports surplus and is fullyPacked once anyone brings it", () => {
    const s = summarizeItem(
      item({
        target_quantity: null,
        claims: [{ id: "c1", user_id: "u1", user_name: "Alex", quantity: 1, brought: true }],
      })
    );
    expect(s.surplus).toBe(0);
    expect(s.fullyPacked).toBe(true);
    expect(s.contributors).toHaveLength(1);
  });

  it("maps contributors preserving names, quantities, brought", () => {
    const s = summarizeItem(
      item({
        target_quantity: 2,
        claims: [{ id: "c1", user_id: "u1", user_name: "Alex", quantity: 2, brought: false }],
      })
    );
    expect(s.contributors).toEqual([
      { userId: "u1", name: "Alex", quantity: 2, brought: false },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/lib/packing/summarize.test.ts`
Expected: FAIL — cannot find module `@/lib/packing/summarize`.

- [ ] **Step 3: Write the implementation**

Create `lib/packing/summarize.ts`:

```ts
import type { PackingItem } from "@/lib/schemas/packing";

export interface ItemSummary {
  needed: number | null;
  claimed: number;
  packed: number;
  surplus: number;
  fullyPacked: boolean;
  contributors: { userId: string; name: string; quantity: number; brought: boolean }[];
}

export function summarizeItem(item: PackingItem): ItemSummary {
  const claimed = item.claims.reduce((sum, c) => sum + c.quantity, 0);
  const packed = item.claims.reduce((sum, c) => sum + (c.brought ? c.quantity : 0), 0);
  const needed = item.target_quantity;

  const surplus = needed != null ? Math.max(0, packed - needed) : 0;
  const fullyPacked =
    needed != null ? packed >= needed : item.claims.some((c) => c.brought);

  return {
    needed,
    claimed,
    packed,
    surplus,
    fullyPacked,
    contributors: item.claims.map((c) => ({
      userId: c.user_id,
      name: c.user_name,
      quantity: c.quantity,
      brought: c.brought,
    })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/lib/packing/summarize.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/packing/summarize.ts __tests__/lib/packing/summarize.test.ts
git commit -m "feat(packing): item summary aggregation with tests"
```

---

## Task 4: Server actions

**Files:**
- Create: `lib/actions/packing.ts`

These follow the established pattern in `lib/actions/trips.ts` (server actions, `createClient`, zod validation). RLS enforces authorization; actions return `{ error }` or data. No automated test (consistent with existing actions — no test DB); verified via the UI in Task 8.

- [ ] **Step 1: Write the actions**

Create `lib/actions/packing.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import {
  addPackingItemSchema,
  claimItemSchema,
  type PackingItem,
} from "@/lib/schemas/packing";

/** Fetch all packing items for a trip with their claims + claimer names. */
export async function getPacking(tripId: string): Promise<PackingItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("packing_items")
    .select(
      "id, title, target_quantity, created_by_user_id, sort_order, claims:packing_claims(id, user_id, quantity, brought, users:user_id(display_name))"
    )
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    target_quantity: row.target_quantity,
    created_by_user_id: row.created_by_user_id,
    sort_order: row.sort_order,
    claims: (row.claims ?? []).map((c) => {
      const u = c.users as unknown as { display_name: string } | null;
      return {
        id: c.id,
        user_id: c.user_id,
        user_name: u?.display_name ?? "Someone",
        quantity: c.quantity,
        brought: c.brought,
      };
    }),
  }));
}

export async function addPackingItem(input: {
  trip_id: string;
  title: string;
  target_quantity?: number | null;
}) {
  const parsed = addPackingItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { _form: ["Not authenticated"] } };

  const { error } = await supabase.from("packing_items").insert({
    trip_id: parsed.data.trip_id,
    title: parsed.data.title,
    target_quantity: parsed.data.target_quantity ?? null,
    created_by_user_id: user.id,
  });

  if (error) return { error: { _form: [error.message] } };
  return { data: { ok: true } };
}

export async function deletePackingItem(itemId: string) {
  const supabase = await createClient();
  // RLS (packing_items_delete) restricts to creator or host.
  const { error } = await supabase.from("packing_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  return { data: { ok: true } };
}

/** Create or update the caller's claim on an item (one row per user per item). */
export async function claimItem(input: { item_id: string; quantity: number }) {
  const parsed = claimItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid claim" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Need trip_id for the claim row; read it from the item.
  const { data: item } = await supabase
    .from("packing_items")
    .select("trip_id")
    .eq("id", parsed.data.item_id)
    .single();
  if (!item) return { error: "Item not found" };

  const { error } = await supabase.from("packing_claims").upsert(
    {
      item_id: parsed.data.item_id,
      trip_id: item.trip_id,
      user_id: user.id,
      quantity: parsed.data.quantity,
    },
    { onConflict: "item_id,user_id" }
  );

  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function unclaimItem(itemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("packing_claims")
    .delete()
    .eq("item_id", itemId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function setBrought(input: { claim_id: string; brought: boolean }) {
  const supabase = await createClient();
  // RLS (packing_claims_own_update) restricts to the claim owner.
  const { error } = await supabase
    .from("packing_claims")
    .update({ brought: input.brought })
    .eq("id", input.claim_id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If the Supabase nested-join type for `claims`/`users` is inferred as an array, the `as unknown as` cast in `getPacking` handles it — matches the pattern used in `app/(app)/trips/[id]/page.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add lib/actions/packing.ts
git commit -m "feat(packing): server actions for items and claims"
```

---

## Task 5: TanStack Query provider

**Files:**
- Create: `components/providers.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Install the dependency**

Run: `npm install @tanstack/react-query`
Expected: added to `package.json` dependencies.

- [ ] **Step 2: Create the provider component**

Create `components/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Wrap the app layout**

Modify `app/(app)/layout.tsx` — import `Providers` and wrap the returned tree. The new return:

```tsx
import { BottomNav } from "@/components/bottom-nav";
import { Providers } from "@/components/providers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Providers>
      <div className="min-h-screen bg-page pb-20">
        <main className="mx-auto max-w-lg px-4 pt-6">{children}</main>
        <BottomNav />
      </div>
    </Providers>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/providers.tsx "app/(app)/layout.tsx"
git commit -m "feat: add TanStack Query provider to app layout"
```

---

## Task 6: Realtime hook

**Files:**
- Create: `lib/realtime/use-trip-channel.ts`

- [ ] **Step 1: Write the hook**

Create `lib/realtime/use-trip-channel.ts`:

```ts
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

/**
 * Subscribe to live changes for one trip. One channel per trip (`trip:{id}`).
 * `onChange` fires on any insert/update/delete to the trip's packing tables;
 * pass a STABLE callback (wrap in useCallback) or the channel will resubscribe
 * on every render. State-layer-agnostic: consumers typically invalidate a query.
 *
 * Anonymous viewers must not call this — realtime requires an authenticated
 * session (CLAUDE.md §8).
 */
export function useTripChannel(tripId: string, onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "packing_items", filter: `trip_id=eq.${tripId}` },
        onChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "packing_claims", filter: `trip_id=eq.${tripId}` },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, onChange]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/realtime/use-trip-channel.ts
git commit -m "feat(realtime): reusable per-trip channel hook"
```

---

## Task 7: Packing route (server)

**Files:**
- Create: `app/(app)/trips/[id]/packing/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/(app)/trips/[id]/packing/page.tsx`:

```tsx
import { PackingList } from "./packing-list";
import { getPacking } from "@/lib/actions/packing";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PackingPageProps {
  params: Promise<{ id: string }>;
}

export default async function PackingPage({ params }: PackingPageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);
  const initialItems = await getPacking(id);

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/trips/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-light transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" />
          Trip Guide
        </Link>
        <h1 className="font-display text-2xl font-bold uppercase text-ink">Packing</h1>
        <p className="mt-1 text-sm text-ink-light">
          Claim what you&apos;ll bring. Updates appear live for everyone.
        </p>
      </header>

      <PackingList
        tripId={id}
        initialItems={initialItems}
        currentUserId={membership.userId}
        isHost={isHostRole(membership.role)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only about the not-yet-created `./packing-list` import (resolved in Task 8). Proceed.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/trips/[id]/packing/page.tsx"
git commit -m "feat(packing): trip packing route"
```

---

## Task 8: Packing list client components

**Files:**
- Create: `app/(app)/trips/[id]/packing/packing-list.tsx`
- Create: `app/(app)/trips/[id]/packing/packing-item-row.tsx`

- [ ] **Step 1: Write the item row**

Create `app/(app)/trips/[id]/packing/packing-item-row.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { summarizeItem } from "@/lib/packing/summarize";
import type { PackingItem } from "@/lib/schemas/packing";
import { Check, Minus, Plus, Trash2, X } from "lucide-react";

interface PackingItemRowProps {
  item: PackingItem;
  currentUserId: string;
  canDelete: boolean;
  onClaim: (itemId: string, quantity: number) => void;
  onUnclaim: (itemId: string) => void;
  onToggleBrought: (claimId: string, brought: boolean) => void;
  onDelete: (itemId: string) => void;
}

export function PackingItemRow({
  item,
  currentUserId,
  canDelete,
  onClaim,
  onUnclaim,
  onToggleBrought,
  onDelete,
}: PackingItemRowProps) {
  const s = summarizeItem(item);
  const myClaim = item.claims.find((c) => c.user_id === currentUserId);

  const progressLabel =
    s.needed != null
      ? `${s.packed} of ${s.needed} packed${s.surplus > 0 ? ` · +${s.surplus}` : ""}`
      : s.contributors.length > 0
        ? `${s.contributors.length} bringing it`
        : "Not claimed yet";

  return (
    <li className="rounded-card border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">{item.title}</span>
            {s.fullyPacked && (
              <Check className="h-4 w-4 shrink-0 text-forest" aria-label="Fully packed" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-light">{progressLabel}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            title="Remove item"
            aria-label={`Remove ${item.title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {s.contributors.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {s.contributors.map((c) => (
            <li key={c.userId} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-ink">
                {c.name}
                {s.needed != null && c.quantity > 1 ? ` × ${c.quantity}` : ""}
              </span>
              {c.userId === currentUserId && myClaim ? (
                <button
                  type="button"
                  onClick={() => onToggleBrought(myClaim.id, !c.brought)}
                  className={`flex items-center gap-1 rounded-badge px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider transition-colors ${
                    c.brought
                      ? "bg-forest/10 text-forest"
                      : "bg-sand/50 text-ink-light hover:text-forest"
                  }`}
                >
                  <Check className="h-3 w-3" />
                  {c.brought ? "Packed" : "Mark packed"}
                </button>
              ) : (
                <span className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
                  {c.brought ? "Packed" : "Claimed"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        {myClaim ? (
          <>
            {item.target_quantity != null && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => onClaim(item.id, Math.max(1, myClaim.quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-6 text-center text-sm text-ink">{myClaim.quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => onClaim(item.id, myClaim.quantity + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => onUnclaim(item.id)}
            >
              <X className="h-3.5 w-3.5" />
              Remove my claim
            </Button>
          </>
        ) : (
          <Button
            type="button"
            className="h-8 gap-1 bg-forest text-xs text-white hover:bg-forest-dark"
            onClick={() => onClaim(item.id, 1)}
          >
            <Plus className="h-3.5 w-3.5" />
            I&apos;ll bring this
          </Button>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Write the container**

Create `app/(app)/trips/[id]/packing/packing-list.tsx`:

```tsx
"use client";

import { PackingItemRow } from "./packing-item-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addPackingItem,
  claimItem,
  deletePackingItem,
  getPacking,
  setBrought,
  unclaimItem,
} from "@/lib/actions/packing";
import type { PackingItem } from "@/lib/schemas/packing";
import { useTripChannel } from "@/lib/realtime/use-trip-channel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus } from "lucide-react";
import { useCallback, useState } from "react";

interface PackingListProps {
  tripId: string;
  initialItems: PackingItem[];
  currentUserId: string;
  isHost: boolean;
}

export function PackingList({
  tripId,
  initialItems,
  currentUserId,
  isHost,
}: PackingListProps) {
  const queryClient = useQueryClient();
  const queryKey = ["packing", tripId];

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: () => getPacking(tripId),
    initialData: initialItems,
  });

  // Stable callback so the realtime channel doesn't resubscribe each render.
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    // queryKey is derived from tripId; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, tripId]);

  useTripChannel(tripId, invalidate);

  const refetch = () => queryClient.invalidateQueries({ queryKey });

  const claim = useMutation({
    mutationFn: (v: { itemId: string; quantity: number }) =>
      claimItem({ item_id: v.itemId, quantity: v.quantity }),
    onSettled: refetch,
  });
  const unclaim = useMutation({
    mutationFn: (itemId: string) => unclaimItem(itemId),
    onSettled: refetch,
  });
  const brought = useMutation({
    mutationFn: (v: { claimId: string; brought: boolean }) =>
      setBrought({ claim_id: v.claimId, brought: v.brought }),
    onSettled: refetch,
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => deletePackingItem(itemId),
    onSettled: refetch,
  });

  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("");
  const [adding, setAdding] = useState(false);

  const add = useMutation({
    mutationFn: () =>
      addPackingItem({
        trip_id: tripId,
        title: title.trim(),
        target_quantity: qty.trim() ? Number(qty) : null,
      }),
    onSettled: () => {
      setTitle("");
      setQty("");
      setAdding(false);
      refetch();
    },
  });

  return (
    <div className="space-y-4">
      {/* Add item */}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate();
          }}
          className="rounded-card border bg-card p-4 shadow-card"
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pack-title">Item</Label>
              <Input
                id="pack-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sunscreen, firewood, wine..."
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pack-qty">How many needed? (optional)</Label>
              <Input
                id="pack-qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Leave blank for a single grab-it item"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-forest text-white hover:bg-forest-dark"
                disabled={!title.trim() || add.isPending}
              >
                Add item
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
          Add packing item
        </Button>
      )}

      {/* List or empty state */}
      {items.length === 0 ? (
        <div className="topo-bg rounded-card border bg-card p-8 text-center">
          <Package className="mx-auto h-10 w-10 text-sage" />
          <h2 className="mt-3 font-semibold text-ink">Nothing on the list yet</h2>
          <p className="mt-1 text-sm text-ink-light">
            Add what the group needs to bring — everyone can claim items.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <PackingItemRow
              key={item.id}
              item={item}
              currentUserId={currentUserId}
              canDelete={isHost || item.created_by_user_id === currentUserId}
              onClaim={(itemId, quantity) => claim.mutate({ itemId, quantity })}
              onUnclaim={(itemId) => unclaim.mutate(itemId)}
              onToggleBrought={(claimId, b) => brought.mutate({ claimId, brought: b })}
              onDelete={(itemId) => remove.mutate(itemId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification (two sessions)**

Run: `npm run dev`. Open the trip's `/trips/<id>/packing` in two browsers (e.g. host + a joined guest):
- Add an item with a target of 3 → appears in both.
- Claim ×2 in one browser → the other shows it live; progress reads "0 of 3 packed".
- Mark packed → progress reads "2 of 3 packed".
- Over-claim past 3 → shows "+N" surplus, no error styling.
- Confirm a guest cannot mark another guest's claim packed (only their own row has the button).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/trips/[id]/packing/packing-list.tsx" "app/(app)/trips/[id]/packing/packing-item-row.tsx"
git commit -m "feat(packing): live packing list UI with claims"
```

---

## Task 9: Wire the Packing feature tile

**Files:**
- Modify: `components/feature-tiles.tsx`

- [ ] **Step 1: Make the Packing tile a link**

In `components/feature-tiles.tsx`, change the Packing tile entry from:

```tsx
    { label: "Packing", icon: Package, soon: true },
```

to:

```tsx
    { label: "Packing", icon: Package, href: `/trips/${tripId}/packing` },
```

(Leave Meals/Photos/Guestbook as `soon: true`.)

- [ ] **Step 2: Typecheck and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/feature-tiles.tsx
git commit -m "feat(packing): link the Packing tile from the trip guide"
```

---

## Self-Review notes

- **Spec coverage:** data model (Task 1), optional target + multi-claim (Tasks 1–3), over-pack surplus (Task 3 + row label), not-stealable RLS (Task 1), realtime hook (Task 6), TanStack Query (Task 5), actions (Task 4), route+UI+empty state (Tasks 7–8), tile wiring (Task 9), aggregation unit tests (Task 3). Creator-or-host delete (Task 1 RLS + Task 8 `canDelete`).
- **Deferred per spec (non-goals):** categories, meal plan, anonymous-view packing, reminders, drag reorder, `notes` in the add form.
- **Type consistency:** `PackingItem`/`PackingClaim` defined in Task 2 and used unchanged in Tasks 3, 4, 7, 8; `summarizeItem`→`ItemSummary` fields (`needed/claimed/packed/surplus/fullyPacked/contributors`) consumed in Task 8 row.
- **Optimistic note:** mutations use `onSettled`-invalidate (simple, correct). If the acting user's UI feels laggy in dogfooding, add `onMutate` cache patching as a follow-up — deliberately omitted now to keep the first realtime feature small.
