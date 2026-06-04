# PR: feat(members): Members hub — promote/demote, remove, transfer host

**Base:** `main` ← **Head:** `feat/member-management`
**Create at:** https://github.com/rodenberg-mgm/roost/pull/new/feat/member-management

---

## Summary

Adds a **Members** hub (folded into the existing host-only invite page) so hosts can manage who is on a trip:

- **Promote / demote** guests ↔ co-hosts
- **Remove** a member (revokes access + frees their packing claims and meal signups; keeps their photos)
- **Transfer host** to another joined member (atomic — ownership + both role changes in one DB function)

A single pure helper, `allowedMemberActions` (`lib/members/permissions.ts`), is the source of truth for the guardrail rules and is consumed by both the UI (menu gating) and the server actions (re-check). Authority is enforced at three layers that agree: UI → server action → RLS / `security definer` rpc.

### Changes
- `lib/members/permissions.ts` + tests — pure permission helper (8 tests)
- `lib/actions/members.ts` — `getMembers`, `setMemberRole`, `removeMember`, `transferHost`
- `components/member-list.tsx` — client list: per-row `⋯` menu + confirm overlay (outside-click/Escape dismissal)
- `supabase/migrations/0009_member_management.sql` — `trip_members` DELETE policy (primary-host-protected) + atomic `transfer_trip_host` function
- `app/(app)/trips/[id]/invite/page.tsx` — restructured into the Members hub

### Notable correctness fixes during review
- `removeMember` now frees claims from the real `packing_claims` table (the plan targeted pre-0004 dropped columns, so claims were silently never released).
- `getMembers` gained a membership guard (was an unguarded exported server action).
- `removeMember` surfaces errors on the security-critical access-revocation deletes instead of reporting false success.
- `transfer_trip_host` rejects self-transfer; the delete policy excludes the primary host.

## ⚠️ Before this works: apply the migration
`supabase/migrations/0009_member_management.sql` must be applied to the live Supabase project via the dashboard (same as 0007/0008). `removeMember` and `transferHost` depend on the delete policy and the rpc.

## Test Plan
- [x] `npm test` — 39/39 pass (incl. 8 new permission tests)
- [x] `npx tsc --noEmit` clean; `npm run build` succeeds
- [ ] After applying 0009, manual e2e on a hosted trip:
  - [ ] Promote a guest → badge flips to Co-host; demote back
  - [ ] Host's own row shows Host badge, no `⋯`; a co-host viewer sees no "Make host"
  - [ ] Remove a member → loses access, their packing claim is freed, meal signup gone, photos remain, old invite link no longer admits them
  - [ ] Transfer host → ownership + both role changes apply atomically
  - [ ] 375px: rows, menu, and confirm overlay all usable

Pre-existing lint errors in `saved-toast.tsx` / `address-autocomplete.tsx` are unrelated and left untouched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
