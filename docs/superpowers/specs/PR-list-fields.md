# PR: feat(lists): structured list fields + property-create address fixes

**Base:** `main` ← **Head:** `feat/list-fields`
**Create at:** https://github.com/rodenberg-mgm/roost/pull/new/feat/list-fields

---

## Summary

Turns the three "list-like" fields — **house rules**, **local tips**, **stocked items** — into real, structured lists edited one item at a time, instead of free-form text / a comma-separated string. Plus two property-create fixes: the address field is now prominent, and a silent-save gap is closed.

### Changes
- `components/ui/list-editor.tsx` — shared `ListEditor` (add/remove items; Enter or `+`; hidden-input + JSON so existing form-read patterns keep working; Enter `preventDefault`s so it never submits the form).
- `supabase/migrations/0010_list_fields_to_arrays.sql` — `house_rules`/`local_tips` `text`→`jsonb[]` on `properties` and `trips` (transaction-wrapped; existing text backfilled by newline split). `stocked_items` was already `jsonb`.
- `lib/schemas/{property,trip}.ts` — the three fields typed as `z.array(z.string().max(200)).max(50)`.
- `lib/actions/properties.ts` — array writes; `createProperty` sensitive-info insert now error-checked + rolls back the orphan property on failure (the address-hardening fix). `lib/actions/trips.ts` — `updateTrip` array types.
- `components/property-form.tsx` — three `ListEditor`s (gives `stocked_items` its first UI) + Address moved to the top of "Sensitive info" (the discoverability fix).
- `app/(app)/trips/[id]/edit/edit-form.tsx` + `edit/page.tsx` — three `ListEditor`s, replacing the textareas + comma input.
- `app/(app)/properties/[id]/edit/page.tsx` — seeds `stocked_items` into the form (prevents wipe-on-save).
- `app/(app)/trips/[id]/page.tsx`, `app/trip/[token]/page.tsx` — house rules & local tips render as bulleted lists.

### Caught during review
- **Data-loss bug fixed:** the property edit page omitted `stocked_items` from the form's initial values; with the now-unconditional write, re-saving a property would have wiped its stocked items.

## ⚠️ Apply the migration BEFORE deploying this code
`0010` must run before (or atomically with) this code going live. Until then, `house_rules`/`local_tips` are still `text` while the code treats them as arrays — which would crash the trip pages and corrupt writes. Apply it in the Supabase dashboard (same as prior migrations).

Numbering note: this branch is off `main`, so it carries `0010` but not member-management's `0009` (separate branch). Both are independent; apply order between them doesn't matter.

## Test Plan
- [x] `npx tsc --noEmit` clean; `npm run build` succeeds; `npm test` 31/31 pass
- [ ] After applying `0010`:
  - [ ] Property form (trip-create recurring path + `/properties/new` + property edit): add/remove house rules, local tips, stocked items one at a time; address is visible near the top of Sensitive info; save → reopen edit → all three persist (incl. stocked items — no wipe)
  - [ ] Trip edit: same three fields add/remove item-by-item; trip guide shows them as bulleted lists
  - [ ] Public `/trip/[token]` view: all three render as bulleted lists
  - [ ] Existing LAKE WEEKEND rules/tips text survived the migration as list items
  - [ ] 375px: rows, add input + `+`, remove `✕` usable; Enter adds without submitting the form

Pre-existing lint errors in `saved-toast.tsx` / `address-autocomplete.tsx` (and the pre-existing unused-`inline`-prop warning in `property-form.tsx`) are unrelated and left untouched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
