# Property edit + visible Property↔Trip link — design

**Date:** 2026-06-01
**Status:** Approved, ready to implement
**Branch:** `fix/v1-access-spine` (continuing) or a fresh branch

## Goal

On a trip linked to a Property, show host/co-hosts a "Linked to [Property]" chip on
the trip guide, with an "Edit property" link (property owner only) to a new
property-edit page. This completes the surfacing half of the v1.0 Property↔Trip
story and closes the missing v1.0 **Property edit** CRUD item.

## Constraints / principles

- **Resync is deferred.** No "Review changes" mechanism in this work.
- **Pull, never push (§3.3).** Editing a Property does NOT propagate to linked
  trips. After a property edit we route to the property list, not back to the
  trip, so the host isn't misled into thinking the trip changed.
- **Host/co-host only** see the chip. Guests never see it (§3.5 — host controls
  trip info; guests don't manage properties).
- **No schema change.** All tables and RLS policies already exist. `properties`
  and `property_sensitive_info` are owner-only under RLS.

## Pieces

### 1. `updateProperty(propertyId, input)` — `lib/actions/properties.ts`
- Verify auth; ownership is enforced by RLS (owner-only update on `properties` /
  `property_sensitive_info`), but also guard explicitly for a clean error.
- Update non-sensitive fields on `properties`; update the `property_sensitive_info`
  sibling row.
- Reuse `createPropertySchema` for validation (same field set).
- Return `{ error }` or `{ data: { id } }`, mirroring `createProperty`.

### 2. Extend `PropertyForm` — `components/property-form.tsx`
- Add optional props: `propertyId?: string`, `initialValues?: Partial<CreatePropertyInput>`.
- Inputs/textareas render `defaultValue` from `initialValues` (uncontrolled
  pattern is preserved).
- On submit: if `propertyId` is set → call `updateProperty(propertyId, input)`
  and button reads "Save changes"; else `createProperty` (unchanged).
- Backward-compatible: existing inline trip-creation usage passes neither new
  prop and behaves exactly as today.

### 3. `app/(app)/properties/[id]/edit/page.tsx` (server) + client wrapper
- Auth required. Fetch the property and its sensitive row via the RLS client.
- If not found / not owner (RLS returns nothing) → `redirect("/properties")`.
- Render a small client wrapper (mirrors `properties/new/property-page-content.tsx`)
  that shows the prefilled `PropertyForm`; `onSuccess` → `router.push("/properties")`.

### 4. Trip-guide chip — `app/(app)/trips/[id]/page.tsx`
- When viewer is host/co-host AND `trip.property_id` is set: fetch
  `id, name, owner_user_id` for the property via the **service client** already
  present on this page (RLS is owner-only, so a co-host couldn't read the name
  through the normal client).
- Render `PropertyLinkChip` under the header. Show the "Edit property →" link
  only when `owner_user_id === membership.userId` (a non-owner co-host would be
  bounced by the edit page's RLS anyway).

### 5. `components/property-link-chip.tsx` (presentational)
- Small Bone/Sand chip: home icon + "Linked to [name]", optional
  "Edit property →" link to `/properties/[id]/edit`. Brand-aligned (forest text,
  subtle border, no pure white).

## Non-goals
Resync / "Review changes"; auto-propagation; guest visibility of the chip;
property delete; Mapbox autocomplete on the property address (the create form
doesn't have it — stay consistent).

## Verification
- `tsc --noEmit` clean.
- Manual: host on a property-linked trip sees the chip → "Edit property" opens
  the prefilled edit page → save → lands on `/properties` with values persisted.
  Confirm the linked trip's copied fields are unchanged (no propagation).
- Manual: a guest on the same trip sees no chip.
