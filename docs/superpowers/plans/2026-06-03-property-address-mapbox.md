# Property Form Address-First (Mapbox) — Implementation Plan

> Execute with superpowers:subagent-driven-development on a branch off `main` (e.g. `feat/property-address-mapbox`). Small — one component refactor + verify.

**Goal:** Make the property form lead with a Mapbox address field that auto-fills city/state/zip, matching the trip-edit form.

**Spec:** `docs/superpowers/specs/2026-06-03-property-address-mapbox-design.md`

**Prereq for the full effect (Matt):** set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local` (public `pk.*`). Without it the field degrades to a plain input (no error). Implementation/verification can proceed token-less.

---

## Task 1: Refactor `components/property-form.tsx` to controlled location + Location section

**Modify:** `components/property-form.tsx`

Read first: the current file, plus `app/(app)/trips/[id]/edit/edit-form.tsx:108-167` (the address-leads pattern to mirror) and `components/address-autocomplete.tsx` (props: `value`, `onChange`, `onSelect({ addressLine, city, region, postalCode })`).

- [ ] **Step 1: Imports + controlled state**

Add: `import { AddressAutocomplete } from "@/components/address-autocomplete";`

Inside `PropertyForm`, add controlled state (seeded from `initialValues`), mirroring edit-form:
```tsx
  const [addressLine, setAddressLine] = useState(initialValues?.address_line || "");
  const [city, setCity] = useState(initialValues?.city || "");
  const [region, setRegion] = useState(initialValues?.region || "");
  const [postalCode, setPostalCode] = useState(initialValues?.postal_code || "");
  const [prefilledFromAddress, setPrefilledFromAddress] = useState(false);
```

- [ ] **Step 2: Read the four location fields from state on submit**

In `handleSubmit`, change the `input` object so these four come from state instead of `getInputValue`:
```tsx
      city: city || undefined,
      region: region || undefined,
      address_line: addressLine || undefined,
      postal_code: postalCode || undefined,
```
(Leave `name`, the three `parseList(...)` lists, wifi/door/gate/parking as `getInputValue` — unchanged.)

- [ ] **Step 3: Add a "Location" block right after the Property name field** (inside "Property details", before House rules), and REMOVE the old City/Region grid from its current spot:

```tsx
        {/* Location — address leads and auto-fills the public city/state/zip */}
        <div className="space-y-2">
          <Label htmlFor="prop-address">Address</Label>
          <AddressAutocomplete
            id="prop-address"
            value={addressLine}
            onChange={setAddressLine}
            onSelect={({ city: c, region: r, postalCode: pc }) => {
              if (c) setCity(c);
              if (r) setRegion(r);
              if (pc) setPostalCode(pc);
              if (c || r) setPrefilledFromAddress(true);
            }}
          />
          <p className="text-xs text-ink-light">
            Start here — we&apos;ll fill in city, state &amp; zip. Kept private; only verified guests see the full address.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-city">City</Label>
            <Input id="prop-city" name="city" value={city}
              onChange={(e) => { setCity(e.target.value); setPrefilledFromAddress(false); }}
              placeholder="Sonoma" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prop-region">State / Region</Label>
            <Input id="prop-region" name="region" value={region}
              onChange={(e) => setRegion(e.target.value)} placeholder="California" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prop-postal">Postal code</Label>
            <Input id="prop-postal" name="postal_code" value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)} placeholder="95476" />
          </div>
        </div>
        {prefilledFromAddress && (
          <p className="-mt-1 text-xs text-ink-light">
            City &amp; state filled from the address — edit if needed. Shown publicly instead of your address.
          </p>
        )}
```

Notes:
- The old City/Region grid (currently the `grid grid-cols-2` right after Property name with `name="city"`/`name="region"` and `defaultValue`) is REPLACED by the controlled versions above — delete the old one.
- These inputs are now **controlled** (`value=...`), so their `defaultValue` props are gone. `AddressAutocomplete` renders its own internal `<Input name="address_line">`, but submit reads `addressLine` from state, so the name attr is irrelevant to our read.

- [ ] **Step 4: Remove Address + Postal from the "Sensitive info" section**

Delete the `grid grid-cols-2` block in "Sensitive info" containing `prop-address`/`name="address_line"` and `prop-postal`/`name="postal_code"`, AND the helper line directly under it ("Where the place is. Kept private…"). The Sensitive info section now starts with its "stored separately" helper, then goes straight to the **wifi** grid. (Address now lives in the Location block at the top.)

- [ ] **Step 5: Typecheck, lint, build**

`npx tsc --noEmit; npm run lint; npm run build`
- tsc/build clean.
- Lint: only the known pre-existing errors (`saved-toast.tsx`, `address-autocomplete.tsx`); no new ones in `property-form.tsx`. (Note: there's a pre-existing unused-`inline`-prop warning in this file — leave it; or, if trivially correct, you MAY remove the unused `inline` prop and its destructure since you're already in the file, but only if it doesn't require touching `PropertyPicker` — it passes `inline`, so likely leave it.)

- [ ] **Step 6: Commit** — `feat(property): address-first Mapbox location in property form`

---

## Task 2: Verify

- [ ] **Step 1:** `npm test` — suite still passes (no unit tests touch this form).
- [ ] **Step 2: Manual e2e** (set `NEXT_PUBLIC_MAPBOX_TOKEN` first for the autocomplete; without it, confirm graceful plain-input fallback):
  1. New-trip flow → "A place you host or stay at often" → "Add new property": the Location block leads with the address field; typing shows Mapbox suggestions; picking one fills city/state/zip; address sits at top labeled private.
  2. `/properties/new`: same.
  3. Property edit (`/properties/[id]/edit`): all four location fields prefill from the saved property; editing + save persists; city/region still save to `properties`, address/postal to `property_sensitive_info` (no regression — verify the saved trip/property shows them correctly).
  4. Token unset: the address field is a plain input, no suggestions, no error; manual city/zip entry still saves.
  5. 375px: the Location block and the suggestions dropdown are usable.
- [ ] **Step 3:** Commit any fixes.

---

## Notes for the implementer

- This mirrors `edit-form.tsx` almost exactly — when in doubt, copy its controlled-location pattern.
- Don't change `lib/actions/properties.ts` — `createProperty`/`updateProperty` already split city/region (→ `properties`) from address/postal (→ `property_sensitive_info`); moving the fields in the form doesn't change where they save.
- `initialValues?.address_line` / `postal_code` come from the property edit page (`getProperty` returns the sensitive sibling); they're already passed in edit mode.
