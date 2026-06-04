# Property Form: Address-First with Mapbox — Design Spec

**Date:** 2026-06-03
**Status:** Approved, pending implementation (next session)

## Goal

In the property form (used in the new-trip flow, `/properties/new`, and property edit), let the **street address lead** with Mapbox autocomplete, auto-filling city/state/zip — instead of typing city/region first and scrolling down to a plain address field.

## Why

The trip-**edit** form already does this well: `AddressAutocomplete` leads, and selecting a suggestion fills city/region/postal while the address stays private (`edit-form.tsx:108-167`). The property form is inconsistent — city/region sit up top in "Property details," and the address is a plain `<Input>` buried lower in "Sensitive info." Matt: *"it's an odd flow to enter the city and zip and then have to scroll down to enter the address."* This unifies the two forms on the better pattern.

## Current state (post list-fields merge)

`components/property-form.tsx`:
- Renders as a `<div ref={containerRef}>`; reads inputs on submit via `getInputValue(name)` = `containerRef.querySelector('[name]').value` (DOM read).
- "Property details": name, **City**, **Region**, then House rules / Local tips / Stocked items (ListEditors).
- "Sensitive info": **Address** + **Postal** (plain inputs), then wifi, door/gate codes, parking.
- City/region save to `properties` (non-sensitive); address_line/postal_code save to `property_sensitive_info`. (`createProperty`/`updateProperty` already split them correctly — unchanged by this work.)

`components/address-autocomplete.tsx` (reusable, already built):
- Props `{ id?, value, onChange(addressLine), onSelect({ addressLine, city, region, postalCode }), placeholder? }`. Controlled. Renders an internal `<Input name="address_line">`.
- Debounced Mapbox geocoding; on select, calls `onChange` (street line) + `onSelect` (city/region/postal). **Degrades to a plain text input when `NEXT_PUBLIC_MAPBOX_TOKEN` is unset.**

## Decisions

1. **Make the four location fields controlled.** `addressLine`, `city`, `region`, `postalCode` become `useState` in `PropertyForm` (seeded from `initialValues` for edit mode), mirroring `edit-form.tsx`. On submit, read these four from **state** (not `getInputValue`); keep `getInputValue`/`parseList` for everything else.
2. **New "Location" section, placed right after Property name** (above House rules), ordered: **Address (AddressAutocomplete, leads) → City / State-Region → Postal code**, with a helper line noting the street address is kept private. Remove the Address + Postal grid from "Sensitive info."
3. **City/Region stay non-sensitive** (saved to `properties`) and **Address/Postal stay sensitive** (saved to `property_sensitive_info`) — only their *form position* changes. The address visually leading the public city/state mirrors the trip-edit form exactly; it does not change where data is stored.
4. **`onSelect` autofill** sets city/region/postal from the picked suggestion; user can still edit them. Optional polish: a "filled from the address — edit if needed; shown publicly instead of your address" hint (as in edit-form), shown after an autofill.
5. **One component covers all entry points** — the new-trip flow (`PropertyPicker` → `PropertyForm inline`), `/properties/new`, and property edit all render `PropertyForm`, so a single change applies everywhere.

## Token dependency

`AddressAutocomplete` needs `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local` (a public `pk.*` token). Without it the component still renders as a plain address input (no suggestions, no autofill) — so this change is safe to ship token-less, but the autocomplete win only appears once the token is set. (Already a tracked pending item.)

## Out of scope

Changing how address/city are stored or their RLS; trip-create one-off location (separate form); reverse-geocoding; map preview.

## Acceptance

- In all three property entry points, the location section leads with the Mapbox address field; picking a suggestion fills city/state/zip; the street address sits at the top, labeled private; city/region remain editable.
- Saving still writes city/region to `properties` and address/postal to `property_sensitive_info` (no regression). Edit mode prefills all four. tsc/lint/build pass. Without the Mapbox token, it degrades to a plain input without error.
