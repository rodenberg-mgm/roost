# Member Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give hosts a "Members" hub (folded into the invite page) to promote/demote co-hosts, remove members, and transfer the host role.

**Architecture:** A pure permission helper (`allowedMemberActions`) is the single source of truth for the guardrail rules, consumed by both the server actions and the UI. Server actions in `lib/actions/members.ts` enforce those rules and perform writes — role changes via the existing `trip_members_update` RLS, removal via service-role multi-table cleanup (mirroring `revokeInvite`), and host transfer via an atomic `security definer` Postgres function. The UI restructures the existing host-only invite page into a member list (per-row `⋯` menu + local confirm overlay, refetch via `router.refresh()` like the sibling `InviteList`) plus the unchanged invite form.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS + rpc), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-03-member-management-design.md`

---

## File Structure

**Create:**
- `lib/members/permissions.ts` — pure: `allowedMemberActions` + `MemberAction` type.
- `__tests__/lib/members/permissions.test.ts` — unit tests.
- `lib/actions/members.ts` — `getMembers`, `setMemberRole`, `removeMember`, `transferHost`.
- `components/member-list.tsx` — client member list (menu + confirm overlay).
- `supabase/migrations/0009_member_management.sql` — `trip_members` delete policy + `transfer_trip_host` function.

**Modify:**
- `app/(app)/trips/[id]/invite/page.tsx` — restructure into the "Members" hub (member list + existing invite form/list).

**Conventions to follow (read these first):**
- `lib/actions/invites.ts` — host/co-host check + `createServiceClient` for cross-RLS deletes (the `removeMember` template; note invites are stored lowercased).
- `components/invite-list.tsx` — client component using server actions + `router.refresh()` + `useTransition`/`useState` busy state (the `MemberList` template).
- `lib/actions/meals.ts` — `{ data } | { error }` returns and the `count: "exact"` blocked-write check.

---

## Task 1: Permission helper (pure, TDD)

**Files:**
- Create: `lib/members/permissions.ts`
- Test: `__tests__/lib/members/permissions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { allowedMemberActions } from "@/lib/members/permissions";

const target = (over = {}) => ({
  role: "guest" as const,
  isPrimaryHost: false,
  joined: true,
  isSelf: false,
  ...over,
});

describe("allowedMemberActions", () => {
  it("gives a guest actor no actions", () => {
    expect(
      allowedMemberActions({ actorRole: "guest", actorIsPrimaryHost: false, target: target() })
    ).toEqual([]);
  });

  it("never allows acting on the primary host", () => {
    expect(
      allowedMemberActions({
        actorRole: "host",
        actorIsPrimaryHost: true,
        target: target({ role: "host", isPrimaryHost: true }),
      })
    ).toEqual([]);
  });

  it("never allows acting on yourself", () => {
    expect(
      allowedMemberActions({
        actorRole: "co-host",
        actorIsPrimaryHost: false,
        target: target({ role: "co-host", isSelf: true }),
      })
    ).toEqual([]);
  });

  it("lets a host promote a guest to co-host (and remove)", () => {
    expect(
      allowedMemberActions({ actorRole: "host", actorIsPrimaryHost: true, target: target({ role: "guest" }) })
    ).toEqual(["make-co-host", "remove"]);
  });

  it("lets a host demote a co-host to guest (and remove)", () => {
    expect(
      allowedMemberActions({ actorRole: "host", actorIsPrimaryHost: true, target: target({ role: "co-host" }) })
    ).toEqual(["make-guest", "remove"]);
  });

  it("offers transfer-host only to the primary host on a joined target", () => {
    expect(
      allowedMemberActions({ actorRole: "host", actorIsPrimaryHost: true, target: target({ role: "co-host" }) })
    ).toContain("transfer-host");
    // a co-host (not primary host) cannot transfer
    expect(
      allowedMemberActions({ actorRole: "co-host", actorIsPrimaryHost: false, target: target({ role: "guest" }) })
    ).not.toContain("transfer-host");
    // not offered on a not-yet-joined member
    expect(
      allowedMemberActions({ actorRole: "host", actorIsPrimaryHost: true, target: target({ joined: false }) })
    ).not.toContain("transfer-host");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/members/permissions.test.ts`
Expected: FAIL — cannot resolve `@/lib/members/permissions`.

- [ ] **Step 3: Write the implementation**

```typescript
export type MemberRole = "host" | "co-host" | "guest";

export type MemberAction = "make-co-host" | "make-guest" | "remove" | "transfer-host";

export interface MemberTarget {
  role: MemberRole;
  isPrimaryHost: boolean;
  joined: boolean;
  isSelf: boolean;
}

export interface AllowedActionsInput {
  actorRole: MemberRole;
  actorIsPrimaryHost: boolean;
  target: MemberTarget;
}

/**
 * The set of member-management actions an actor may take on a target.
 * Single source of truth shared by the server actions and the UI so the
 * guardrail rules never drift.
 */
export function allowedMemberActions(input: AllowedActionsInput): MemberAction[] {
  const { actorRole, actorIsPrimaryHost, target } = input;

  // Only hosts/co-hosts manage members.
  if (actorRole !== "host" && actorRole !== "co-host") return [];
  // The primary host is untouchable; you can't manage yourself here.
  if (target.isPrimaryHost || target.isSelf) return [];

  const actions: MemberAction[] = [];
  if (target.role === "guest") actions.push("make-co-host");
  if (target.role === "co-host") actions.push("make-guest");
  actions.push("remove");
  if (actorIsPrimaryHost && target.joined) actions.push("transfer-host");
  return actions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/members/permissions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/members/permissions.ts __tests__/lib/members/permissions.test.ts
git commit -m "feat(members): permission helper for member-management actions"
```

---

## Task 2: Migration (delete policy + atomic transfer function)

**Files:**
- Create: `supabase/migrations/0009_member_management.sql`

**IMPORTANT scope:** create and commit the file ONLY. Do NOT apply it — the controller/user applies migrations to the live project via the Supabase dashboard (no CLI link in this environment). Skip any "apply"/"db push" step.

- [ ] **Step 1: Write the migration**

Confirm helper names against `0002` (`public.is_trip_host(p_trip_id uuid)`, `security definer stable`) before writing.

```sql
-- 0009_member_management.sql
-- Member management: allow host/co-host to delete a membership row, and add an
-- atomic host-transfer function.

-- ============================================================
-- 1. trip_members DELETE policy (none existed -> removal was denied)
-- ============================================================
drop policy if exists "trip_members_delete" on public.trip_members;
create policy "trip_members_delete"
  on public.trip_members for delete
  using (public.is_trip_host(trip_id));

-- ============================================================
-- 2. Atomic host transfer
--    Re-checks authority server-side (defense in depth beyond the action).
-- ============================================================
create or replace function public.transfer_trip_host(p_trip_id uuid, p_new_host uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_old_host uuid;
begin
  select host_user_id into v_old_host from public.trips where id = p_trip_id;
  if v_old_host is null then
    raise exception 'Trip not found';
  end if;
  -- Caller must currently be the primary host.
  if v_old_host is distinct from auth.uid() then
    raise exception 'Only the current host can transfer host';
  end if;
  -- Target must be a joined member of this trip.
  if not exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_new_host and joined_at is not null
  ) then
    raise exception 'New host must be a joined member';
  end if;

  update public.trips set host_user_id = p_new_host where id = p_trip_id;
  update public.trip_members set role = 'host'    where trip_id = p_trip_id and user_id = p_new_host;
  update public.trip_members set role = 'co-host' where trip_id = p_trip_id and user_id = v_old_host;
end;
$$;
```

- [ ] **Step 2: Commit (do not apply)**

```bash
git add supabase/migrations/0009_member_management.sql
git commit -m "feat(members): trip_members delete policy + atomic transfer_trip_host fn"
```

---

## Task 3: Server actions

**Files:**
- Create: `lib/actions/members.ts`

Mirrors `lib/actions/invites.ts` (host/co-host check; `createServiceClient` for cross-RLS deletes) and `lib/actions/meals.ts` (`{ data } | { error }`, `count: "exact"`).

- [ ] **Step 1: Write the implementation**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`transfer_trip_host` is called via `supabase.rpc(...)` with a string name — no generated-type dependency. If the generated DB types make `.rpc` reject the unknown function name, cast the name arg as needed and note it; the runtime call is correct.)

- [ ] **Step 3: Commit**

```bash
git add lib/actions/members.ts
git commit -m "feat(members): server actions (getMembers, setMemberRole, removeMember, transferHost)"
```

---

## Task 4: Member list component

**Files:**
- Create: `components/member-list.tsx`

Client component. Per-row `⋯` menu (actions from `allowedMemberActions`); destructive actions (`remove`, `transfer-host`) open a local confirm overlay. Refetch via `router.refresh()` after each mutation (matches `components/invite-list.tsx`). No new UI primitive — the menu and overlay are local JSX.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { allowedMemberActions, type MemberAction } from "@/lib/members/permissions";
import { setMemberRole, removeMember, transferHost, type Member } from "@/lib/actions/members";
import { Crown, Loader2, MoreVertical, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface MemberListProps {
  tripId: string;
  members: Member[];
  currentUserId: string;
  currentUserRole: "host" | "co-host" | "guest";
}

const ROLE_LABEL: Record<Member["role"], string> = {
  host: "Host",
  "co-host": "Co-host",
  guest: "Guest",
};

export function MemberList({ tripId, members, currentUserId, currentUserRole }: MemberListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: "remove" | "transfer-host"; member: Member } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actorIsPrimaryHost = members.some((m) => m.user_id === currentUserId && m.is_primary_host);

  async function run(p: Promise<{ error?: string } | { data: unknown }>) {
    setBusy(true);
    setError(null);
    const res = await p;
    setBusy(false);
    setOpenFor(null);
    setConfirm(null);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <ul className="space-y-2.5">
      {members.map((m) => {
        const actions = allowedMemberActions({
          actorRole: currentUserRole,
          actorIsPrimaryHost,
          target: {
            role: m.role,
            isPrimaryHost: m.is_primary_host,
            joined: m.joined,
            isSelf: m.user_id === currentUserId,
          },
        });
        const initial = (m.name || "?").charAt(0).toUpperCase();
        return (
          <li key={m.user_id} className="relative flex items-center gap-3 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sand font-display text-xs font-bold uppercase text-ink-light">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-ink">{m.name}</span>
              {m.email && <span className="block truncate text-xs text-ink-light">{m.email}</span>}
            </div>
            <span className="rounded-badge bg-sand/50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
              {m.is_primary_host ? "Host" : m.joined ? ROLE_LABEL[m.role] : "Invited"}
            </span>

            {actions.length > 0 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label={`Manage ${m.name}`}
                  onClick={() => setOpenFor(openFor === m.user_id ? null : m.user_id)}
                  className="flex h-8 w-8 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-sand/50 hover:text-forest"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {openFor === m.user_id && (
                  <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-card border bg-card shadow-card">
                    {actions.includes("make-co-host") && (
                      <MenuItem icon={UserPlus} label="Make co-host" disabled={busy}
                        onClick={() => run(setMemberRole(tripId, m.user_id, "co-host"))} />
                    )}
                    {actions.includes("make-guest") && (
                      <MenuItem icon={UserMinus} label="Make guest" disabled={busy}
                        onClick={() => run(setMemberRole(tripId, m.user_id, "guest"))} />
                    )}
                    {actions.includes("transfer-host") && (
                      <MenuItem icon={Crown} label="Make host" disabled={busy}
                        onClick={() => { setOpenFor(null); setConfirm({ action: "transfer-host", member: m }); }} />
                    )}
                    {actions.includes("remove") && (
                      <MenuItem icon={Trash2} label="Remove from trip" destructive disabled={busy}
                        onClick={() => { setOpenFor(null); setConfirm({ action: "remove", member: m }); }} />
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}

      {error && <p className="text-xs text-brick">{error}</p>}

      {confirm && (
        <ConfirmOverlay
          busy={busy || isPending}
          title={confirm.action === "remove" ? `Remove ${confirm.member.name}?` : `Make ${confirm.member.name} the host?`}
          body={
            confirm.action === "remove"
              ? "They lose access to this trip. Their packing claims and meal signups are freed up; their photos stay."
              : "They become the host and you become a co-host. This can only be undone by the new host."
          }
          confirmLabel={confirm.action === "remove" ? "Remove" : "Make host"}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            run(
              confirm.action === "remove"
                ? removeMember(tripId, confirm.member.user_id)
                : transferHost(tripId, confirm.member.user_id)
            )
          }
        />
      )}
    </ul>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: typeof UserPlus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-sand/40 disabled:opacity-50 ${
        destructive ? "text-brick" : "text-ink"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ConfirmOverlay({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-card border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-ink-light">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-button px-3 py-2 text-sm text-ink-light transition-colors hover:bg-sand/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-button bg-brick px-3 py-2 text-sm text-bone shadow-button transition-colors hover:bg-brick/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`Member` is imported from `lib/actions/members.ts` — a `"use server"` file; importing a type from it into a client component is fine since types are erased. If the bundler objects to importing a value-less type from a server-action module, move the `Member` interface to `lib/members/permissions.ts` and import it there instead, and note the change.)

- [ ] **Step 3: Commit**

```bash
git add components/member-list.tsx
git commit -m "feat(members): member list UI with per-row actions + confirm overlay"
```

---

## Task 5: Restructure the invite page into the "Members" hub + verify

**Files:**
- Modify: `app/(app)/trips/[id]/invite/page.tsx`

- [ ] **Step 1: Restructure the page**

Keep the host-only guard and the existing invite form/list; add the member list above them. Replace the file with:

```tsx
import { InviteForm } from "@/components/invite-form";
import { InviteList } from "@/components/invite-list";
import { MemberList } from "@/components/member-list";
import { getMembers } from "@/lib/actions/members";
import { requireTripMembership, isHostRole } from "@/lib/trip-access/check-membership";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface InvitePageProps {
  params: Promise<{ id: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { id } = await params;
  const membership = await requireTripMembership(id);

  if (!isHostRole(membership.role)) {
    redirect(`/trips/${id}`);
  }

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("name")
    .eq("id", id)
    .single();

  const members = await getMembers(id);

  const { data: invites } = await supabase
    .from("trip_invites")
    .select("id, email, consumed_at, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="mb-6">
        <Link
          href={`/trips/${id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-light transition-colors hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to trip
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink">Members</h1>
        <p className="mt-1 text-sm text-ink-light">
          Manage who&apos;s on {trip?.name || "your trip"} and invite more guests.
        </p>
      </header>

      <div className="space-y-4">
        <div className="rounded-card border bg-card p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">On this trip</h2>
          <MemberList
            tripId={id}
            members={members}
            currentUserId={membership.userId}
            currentUserRole={membership.role}
          />
        </div>

        <div className="rounded-card border bg-card p-6 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">Invite guests</h2>
          <InviteForm tripId={id} />
        </div>

        {invites && invites.length > 0 && (
          <div className="rounded-card border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold text-ink">Sent invites</h2>
            <InviteList invites={invites} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint, build**

Run: `npx tsc --noEmit; if ($?) { npm run lint; if ($?) { npm run build } }`
Expected: tsc clean; build succeeds. (Lint may still report the two known PRE-EXISTING errors in `components/saved-toast.tsx` and `components/address-autocomplete.tsx` — those are not part of this work. Confirm no NEW lint errors in the files this plan touches.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — existing suites plus the new `permissions` tests.

- [ ] **Step 4: Manual e2e (after the user applies migration 0009 to the live project)**

On a trip you host, open the Members hub (the invite page):
1. A guest row shows "Make co-host" → promote → badge flips to Co-host (page refreshes).
2. Demote that co-host back to guest.
3. The host's own row shows the Host badge and no `⋯` actions; confirm a co-host viewer can't see "Make host" on anyone.
4. Remove a member → confirm dialog → after removal: they lose trip access, a packing item they'd claimed is now unclaimed, their meal signup is gone, their uploaded photos remain, and their old invite link no longer admits them.
5. As the primary host, "Make host" on a joined member → confirm → ownership transfers, you become co-host, they become host (verify it's atomic — both role changes + host_user_id all applied).
6. 375px: rows, the `⋯` menu, and the confirm overlay are all usable.

Document the result of each step; fix before committing if any fail.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/trips/[id]/invite/page.tsx"
git commit -m "feat(members): Members hub on the invite page (member list + invites)"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** promote/demote (Tasks 1,3,4) · remove with cleanup incl. claims/signups release + photos kept (Task 3) · transfer host atomic (Tasks 2,3) · host+co-host authority, primary-host untouchable, no self-remove (Task 1 helper, enforced in Task 3) · Members hub on invite page (Tasks 4,5) · delete policy + rpc migration (Task 2). Out-of-scope items (leave-trip, property resync, soft-delete membership, realtime, email notifications) are absent by design.
- **Shared-rule integrity:** both `setMemberRole`/UI gating and the UI menu call `allowedMemberActions`; `removeMember`/`transferHost` enforce the primary-host/self/authority guards directly (the helper returns `[]` for those, and the actions also hard-check). The `transfer_trip_host` function re-checks authority server-side.
- **Type consistency:** `Member` (from `lib/actions/members.ts`) and `MemberAction`/`MemberRole` (from `lib/members/permissions.ts`) are the only shared shapes; action returns are `{ data } | { error }`, narrowed via `"error" in res`.
- **Service-role guard ordering:** in `removeMember`, all guards (`!ctx`, primary-host, self, role) run BEFORE any service-role delete — the trust boundary, since service-role bypasses RLS.
