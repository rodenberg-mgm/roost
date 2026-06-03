# Member Management ("Members" hub) — Design Spec

**Date:** 2026-06-03
**Phase:** v1.x host-controls (effort A of the "host controls" pair; effort B = property resync, separate spec)
**Status:** Approved for planning

---

## 1. Goal

Give hosts a place to manage the trip roster: promote/demote co-hosts, remove members, and transfer the host role. Today there is no UI for any of this — roles exist in the data (`trip_members.role`) but can't be changed, and the invite page only sends/lists invites.

This is effort **A** of a two-part "host controls" initiative. Effort **B** (property resync + per-trip sensitive overrides — the door-code scenario) is a separate spec and is **not** covered here.

---

## 2. Key decisions (settled during brainstorm)

| Decision | Choice |
|---|---|
| Actions | Promote/demote co-host, remove member, **transfer host** (all three) |
| Authority | **Host + co-hosts** manage members (matches existing RLS + CLAUDE.md §3.5). |
| Primary host protection | `trips.host_user_id` is untouchable by role-change/remove; ownership changes only via transfer-host. |
| Transfer-host authority | **Primary host only.** |
| Placement | Fold into the existing host-only invite page → a **"Members" hub** (member list + existing invite form). |
| Enforcement | Server actions own the fine-grained guardrails; reuse existing RLS where it already permits the write. |
| Remove cleanup | Revoke access (membership + grants + unconsumed invites) and **release** their packing claims / meal signups; **keep** their photos. |
| Transfer-host atomicity | Single `security definer` Postgres function (rpc) so the ownership swap is atomic. |

---

## 3. Existing schema/RLS this builds on (no change except §6)

- `trip_members (id, trip_id, user_id, role check in host/co-host/guest, invited_email, joined_at, created_at, unique(trip_id,user_id))` — **no `deleted_at`**; membership is a join row, removal is a hard delete.
- `trip_members_update` RLS: `using (is_trip_host(trip_id))` — host/co-host may update any member row (incl. `role`). No `with check`.
- `trips_host_update` RLS: `using (auth.uid() = host_user_id)` — only the primary host may update the `trips` row (so transfer-host's `host_user_id` rewrite is already permitted for the host).
- **No `trip_members` DELETE policy exists** → removal is currently denied by default; §6 adds one.
- `is_trip_host(trip_id)` / `is_trip_member(trip_id)` helper functions exist (`security definer stable`).
- A removed member's contributions reference `users`, not `trip_members`: `photos.uploaded_by_user_id` (cascade on user delete), `packing_items.claimed_by_user_id` (nullable FK), `meal_cooks.user_id` (cascade on user delete). Removing the membership row leaves all of these intact.

---

## 4. Server actions — `lib/actions/members.ts` (new)

All return `{ data } | { error }`, matching `lib/actions/meals.ts`. All guardrails enforced in-action via the shared permission helper (§5).

### `getMembers(tripId): Promise<Member[]>`
- User client (read). Caller must be a member (page already guards host-only, but the action also requires membership).
- Returns each member: `user_id, name (users.display_name), email, role, joined (bool), is_primary_host (user_id === trips.host_user_id)`.
- Reads `trips.host_user_id` once to compute `is_primary_host`.

### `setMemberRole(tripId, userId, role: 'co-host' | 'guest')`
- Reject `role` values other than `'co-host' | 'guest'` (never `'host'`).
- Load actor's role + `trips.host_user_id`. Guard via `allowedMemberActions` (§5): actor must be host/co-host; **reject if `userId === host_user_id`** ("The host can't be changed — transfer host first").
- Write via user client (existing `trip_members_update` RLS). Use `count: "exact"`; `!count` → "Couldn't update that member" (RLS-blocked).

### `removeMember(tripId, userId)`
- Guard: actor host/co-host; **reject if `userId === host_user_id`**; **reject self-removal** (`userId === actor`) → "You can't remove yourself."
- Cleanup runs via **service-role** (these tables lack delete policies; it's host-admin hygiene), after the guard:
  1. `delete from trip_members where trip_id and user_id` (executed via service-role, so it's unconditional after the in-action guard; the §6 delete policy is defense-in-depth, not the path used here).
  2. `delete from trip_grants where trip_id and user_id`.
  3. `delete from trip_invites where trip_id and email = <member email> and consumed_at is null`.
  4. `update packing_items set claimed_by_user_id = null, claimed_at = null where trip_id and claimed_by_user_id = userId`.
  5. `delete from meal_cooks where trip_id and user_id`.
  6. Photos: untouched.

### `transferHost(tripId, newUserId)` → calls rpc (§6)
- Guard: actor **must be the primary host** (`actor === host_user_id`); `newUserId` must be a **joined** member (`joined_at not null`) and not already the host.
- Invokes the `transfer_trip_host(p_trip_id, p_new_host)` Postgres function (atomic): rewrites `trips.host_user_id`, sets new member `role='host'`, sets old host `role='co-host'`.

---

## 5. Permission helper — `lib/members/permissions.ts` (new, pure, TDD)

Single source of truth for the rules; consumed by both the server actions and the UI so they never drift.

```
type MemberAction = 'make-co-host' | 'make-guest' | 'remove' | 'transfer-host';

allowedMemberActions(input: {
  actorRole: 'host' | 'co-host' | 'guest';
  actorIsPrimaryHost: boolean;
  target: { role: 'host' | 'co-host' | 'guest'; isPrimaryHost: boolean; joined: boolean; isSelf: boolean };
}): MemberAction[]
```

Rules:
- Actor not host/co-host → `[]`.
- `target.isPrimaryHost` → `[]` (untouchable).
- `target.isSelf` → `[]` (no self-management here).
- Otherwise: `target.role === 'guest'` → include `make-co-host`; `target.role === 'co-host'` → include `make-guest`; always include `remove`.
- `transfer-host` included only if `actorIsPrimaryHost && target.joined`.

---

## 6. Migration — `0009_member_management.sql`

1. **`trip_members` DELETE policy** (so removal can also be expressed via RLS / defense-in-depth; the action's service-role path still enforces the primary-host guard in code):
```sql
create policy "trip_members_delete" on public.trip_members for delete
  using (public.is_trip_host(trip_id));
```
2. **Atomic transfer-host function:**
```sql
create or replace function public.transfer_trip_host(p_trip_id uuid, p_new_host uuid)
returns void language plpgsql security definer as $$
declare v_old_host uuid;
begin
  select host_user_id into v_old_host from public.trips where id = p_trip_id;
  -- caller must currently be the primary host
  if v_old_host is distinct from auth.uid() then
    raise exception 'Only the current host can transfer host';
  end if;
  -- target must be a joined member
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
The function re-checks authority server-side (defense in depth beyond the action guard).

---

## 7. UI — restructure `app/(app)/trips/[id]/invite/page.tsx`

Host-only (unchanged guard). Header becomes **"Members"**. Two stacked cards:

### Members card (new client component `components/member-list.tsx`)
- Data via `getMembers` + TanStack Query (refetch on each mutation; no realtime — admin surface).
- Each row: initial avatar, name, email, role badge (Host / Co-host / Guest — reuse the sand-badge style from the trip-guide Guests list), joined-vs-invited status.
- Host/co-host viewers see a per-row **`⋯` dropdown** whose items come from `allowedMemberActions`:
  - `make-co-host` → "Make co-host"; `make-guest` → "Make guest" (immediate, no confirm).
  - `remove` → "Remove from trip" — **confirm dialog** stating: loses access, packing claims freed, meal signups removed, photos kept.
  - `transfer-host` → "Make host" — **confirm dialog**: "Makes [name] the host and you a co-host."
- The primary host's own row shows the Host badge and no actions.
- Brand: `bg-card`/`rounded-card`/`shadow-card`, Lucide icons (no emoji), forest accents, 375px-first (dropdown, not a wide menu).

### Invite card
- Existing `InviteForm` + sent-invites list, unchanged.

---

## 8. Out of scope (deliberate)

- "Leave trip" (a member removing themselves) — separate flow.
- Property resync / per-trip sensitive overrides — effort **B**, separate spec.
- Soft-delete of memberships (it's a join row; hard delete + cleanup is correct here).
- Realtime member updates (admin surface; refetch suffices).
- Email notifications on role change / removal.

---

## 9. Files

- Create: `lib/actions/members.ts`, `lib/members/permissions.ts`, `components/member-list.tsx`, `supabase/migrations/0009_member_management.sql`, `__tests__/lib/members/permissions.test.ts`.
- Modify: `app/(app)/trips/[id]/invite/page.tsx` (restructure into the Members hub; keep invite form/list).

---

## 10. Testing & verification

- **Unit (TDD):** `allowedMemberActions` — guest actor gets nothing; primary-host target untouchable; self untouchable; guest→make-co-host; co-host→make-guest; remove always present for valid targets; transfer-host only for primary-host actor on joined targets.
- **tsc/lint/build** clean.
- **Manual e2e:** promote/demote round-trip; remove → access revoked + their packing claim freed + meal signup gone + photos still present + their old invite link rejected; transfer host → ownership swaps atomically, old host becomes co-host; guardrails (primary host untouchable; co-host cannot transfer; can't self-remove).

---

## 11. Risks

- **Service-role removal must enforce the guard in code** — it bypasses RLS, so the primary-host and self-removal checks live in the action and must run before any delete. The `0009` delete policy is defense-in-depth, not the only gate.
- **Transfer-host rpc** uses `auth.uid()` inside a `security definer` function — confirm `auth.uid()` resolves under the function's invocation (it does for RLS helpers `is_trip_host`, which are also `security definer`).
- **Email match for invite cleanup** — uses the member's `users.email`; an invite sent to a different-cased or aliased address wouldn't be caught. Acceptable; normalize-compare lower(email) to reduce misses.
