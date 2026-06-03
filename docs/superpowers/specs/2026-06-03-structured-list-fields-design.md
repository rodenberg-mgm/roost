# Structured List Fields — Design Spec

**Date:** 2026-06-03
**Status:** Approved (scope B + address fix), pending implementation

## Goal

Turn the three "list-like" trip/property fields — **house rules**, **local tips**, and **stocked items** — into real, structured lists edited one item at a time, instead of free-form text (rules/tips) or a comma-separated string (stocked items). Plus two adjacent fixes to the property-create flow: surface the **address** field and harden a **silent-save gap**.

## Why

- House rules and local tips are inherently itemized ("No shoes inside", "Quiet after 10pm") but are stored as a single `text` blob and edited in a textarea. Comma/newline conventions are inconsistent and render as one paragraph.
- `stocked_items` is *already* a `jsonb` array on both tables but has **no UI on the property form** (only a comma-separated `Input` on the trip-edit form), so it's rarely populated and round-trips through fragile `split(",")` parsing.
- Address: the property-create form's address field is buried at the bottom under "Sensitive info," so users miss it and add the address later via edit. And `createProperty` never checks whether the sensitive-info insert succeeded — a failed write silently drops address/wifi/codes.

## Decisions

1. **Data model:** `house_rules` and `local_tips` become `jsonb not null default '[]'` on both `properties` and `trips` (matching the existing `stocked_items` shape). All three are string arrays end to end.
2. **One shared editor:** a new `ListEditor` client component is the single input used for all three fields, in both the property form and the trip-edit form. Form integration via a hidden `<input>` carrying `JSON.stringify(items)` so the existing two read patterns (DOM `querySelector().value` and `FormData.get()`) keep working.
3. **Migration backfill:** existing `text` values are split on newlines into list items (non-empty, trimmed); null/empty → `[]`. Tiny data volume (one real trip + any properties).
4. **Sync unchanged:** `syncPropertyToTrip` already copies these fields verbatim — array→array needs no change. Copy-on-link semantics (CLAUDE.md §3.3) are preserved; no resync work in scope.
5. **Address:** keep it architecturally in `*_sensitive_info` (it *is* a sensitive field, §3.6) but move the Address + postal inputs to the **top** of the "Sensitive info" section in the property form so they're the first thing seen there, with a short helper line. Harden `createProperty` to error-check the sensitive insert and roll back the orphan property on failure (mirrors the invite-rollback pattern).

## Component: `ListEditor` (`components/ui/list-editor.tsx`)

Controlled client component.

**Props:** `name: string` (hidden-input name), `initialItems?: string[]`, `placeholder?: string`, `addLabel?: string` (aria-label for the draft input + add button), `maxItems?` (default 50), `maxItemLength?` (default 200).

**Behavior:**
- Local state `items: string[]` + `draft: string`.
- Add: Enter in the draft input (with `e.preventDefault()` so it never submits the parent form) **or** the `+` button → trim, skip empty, skip if at `maxItems`, push, clear draft, keep focus.
- Remove: per-row `✕` button.
- Renders a hidden `<input type="hidden" name={name} value={JSON.stringify(items)} />`.

**Markup / tokens (mobile-first, brand-consistent):**
- Item rows: `<ul className="space-y-1.5">`, each `<li className="flex items-center gap-2 rounded-input border bg-sand/30 px-3 py-2 text-sm text-ink">` with a forest bullet (`<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest/50" />`), the text `min-w-0 flex-1 break-words`, and a remove `<button aria-label={`Remove ${item}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick">` with Lucide `X` (`h-4 w-4`).
- Add row: `<div className="flex items-center gap-2">` → reuse `<Input>` (`flex-1`, draft value, `onKeyDown` Enter, `maxLength={maxItemLength}`, `aria-label`) + `<button type="button" aria-label={addLabel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-forest text-bone transition-colors hover:bg-forest-dark disabled:opacity-50" disabled={!draft.trim()}>` with Lucide `Plus`.
- States: **empty** = just the add row + placeholder; **with items** = rows above the add row; **focus** = the reused `<Input>`'s existing focus ring. Only `transition-colors` (no transforms).
- a11y: every icon-only button has an `aria-label`; the draft input is labeled; 44px-class tap targets on add/remove.

## Render changes

- **Trip guide** (`app/(app)/trips/[id]/page.tsx`) and **public token view** (`app/trip/[token]/page.tsx`): render house_rules and local_tips as bulleted `<ul>` lists (same treatment as stocked_items) instead of `whitespace-pre-wrap` paragraphs. Empty/host-prompt checks switch from truthiness to `(x as string[])?.length > 0`.

## Out of scope

Drag-reordering, per-item checkboxes (packing already owns claim/bring semantics), property→trip resync, realtime on these fields, rich text.

## Acceptance

- House rules, local tips, stocked items are each added/removed one item at a time in both the property form and the trip-edit form; saved as arrays; rendered as bulleted lists on the trip guide and the public token view.
- The property create form shows the address prominently; a failed sensitive insert returns an error (no silent drop) and leaves no orphan property.
- Existing text content survives the migration as list items. `tsc`, lint (no new), build, and the full test suite pass.
