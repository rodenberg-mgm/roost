# Structured List Fields — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task with review between each. Steps use `- [ ]` checkboxes.

**Goal:** Convert `house_rules`, `local_tips`, `stocked_items` to string arrays on `properties` and `trips`, edited via one shared `ListEditor`; render as bulleted lists; plus surface the property-create address and harden the sensitive insert.

**Spec:** `docs/superpowers/specs/2026-06-03-structured-list-fields-design.md`

**Tech:** Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS), Tailwind v4 brand tokens, Vitest. No new deps.

---

## File map

**Create:**
- `components/ui/list-editor.tsx` — shared list input.
- `supabase/migrations/0010_list_fields_to_arrays.sql` — text→jsonb on both tables (file only; user applies).

**Modify:**
- `lib/schemas/property.ts`, `lib/schemas/trip.ts` — rules/tips → string arrays.
- `lib/actions/properties.ts` — array writes; harden `createProperty` sensitive insert + rollback.
- `lib/actions/trips.ts` — `updateTrip` array writes. (`syncPropertyToTrip` and `createTrip` unchanged — verify only.)
- `components/property-form.tsx` — ListEditors for rules/tips/stocked; surface address; parse JSON on submit.
- `app/(app)/trips/[id]/edit/edit-form.tsx` — ListEditors for rules/tips/stocked; parse JSON; type update.
- `app/(app)/trips/[id]/edit/page.tsx` — cast house_rules/local_tips to arrays in `initialData`.
- `app/(app)/trips/[id]/page.tsx` — rules/tips render as bulleted lists.
- `app/trip/[token]/page.tsx` — rules/tips render as bulleted lists.

**Conventions:** existing `<Input>` (`components/ui/input.tsx`), `<Label>`, brand tokens (`bg-sand`, `forest`, `bone`, `brick`, `rounded-input`, `border`), Lucide icons. Property form reads inputs via `containerRef.querySelector('[name]').value`; trip-edit reads via `FormData`.

---

## Task 1: `ListEditor` component

**Create:** `components/ui/list-editor.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { useState } from "react";

interface ListEditorProps {
  /** Name of the hidden input; its value is JSON.stringify(items). */
  name: string;
  initialItems?: string[];
  placeholder?: string;
  /** Used for the add input + button aria-labels, e.g. "Add a house rule". */
  addLabel?: string;
  maxItems?: number;
  maxItemLength?: number;
}

export function ListEditor({
  name,
  initialItems = [],
  placeholder,
  addLabel = "Add an item",
  maxItems = 50,
  maxItemLength = 200,
}: ListEditorProps) {
  const [items, setItems] = useState<string[]>(initialItems);
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || items.length >= maxItems) return;
    setItems((prev) => [...prev, v.slice(0, maxItemLength)]);
    setDraft("");
  }

  function removeAt(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(items)} readOnly />

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-input border bg-sand/30 px-3 py-2 text-sm text-ink"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest/50" />
              <span className="min-w-0 flex-1 break-words">{item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => removeAt(i)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={addLabel}
          maxLength={maxItemLength}
          className="flex-1"
        />
        <button
          type="button"
          aria-label={addLabel}
          onClick={add}
          disabled={!draft.trim() || items.length >= maxItems}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-forest text-bone transition-colors hover:bg-forest-dark disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` (confirm `<Input>` accepts `onKeyDown`/`aria-label`/`maxLength`; it forwards props — verify by reading `components/ui/input.tsx`). Confirm `bg-bone`, `hover:bg-forest-dark`, `bg-sand` exist (used elsewhere).
- [ ] **Step 3: Commit** — `feat(lists): reusable ListEditor input component`

---

## Task 2: Migration 0010 (file only — DO NOT apply)

**Create:** `supabase/migrations/0010_list_fields_to_arrays.sql`

**Scope:** create + commit the file ONLY. The user applies it via the Supabase dashboard. Skip any apply/db-push.

- [ ] **Step 1: Write the migration**

Convert `house_rules` and `local_tips` from `text` to `jsonb not null default '[]'` on both tables, backfilling existing text by splitting on newlines (trimmed, non-empty). `stocked_items` is already `jsonb` — leave it.

```sql
-- 0010_list_fields_to_arrays.sql
-- house_rules and local_tips become string arrays (jsonb) to match stocked_items.
-- Existing text is backfilled by splitting on newlines into trimmed, non-empty items.

create or replace function pg_temp.text_to_jsonb_lines(t text)
returns jsonb language sql immutable as $$
  select case
    when t is null or btrim(t) = '' then '[]'::jsonb
    else coalesce(
      (select jsonb_agg(btrim(line))
       from unnest(string_to_array(t, E'\n')) as line
       where btrim(line) <> ''),
      '[]'::jsonb
    )
  end;
$$;

-- properties
alter table public.properties alter column house_rules drop default;
alter table public.properties
  alter column house_rules type jsonb using pg_temp.text_to_jsonb_lines(house_rules);
alter table public.properties
  alter column house_rules set default '[]'::jsonb,
  alter column house_rules set not null;

alter table public.properties alter column local_tips drop default;
alter table public.properties
  alter column local_tips type jsonb using pg_temp.text_to_jsonb_lines(local_tips);
alter table public.properties
  alter column local_tips set default '[]'::jsonb,
  alter column local_tips set not null;

-- trips
alter table public.trips alter column house_rules drop default;
alter table public.trips
  alter column house_rules type jsonb using pg_temp.text_to_jsonb_lines(house_rules);
alter table public.trips
  alter column house_rules set default '[]'::jsonb,
  alter column house_rules set not null;

alter table public.trips alter column local_tips drop default;
alter table public.trips
  alter column local_tips type jsonb using pg_temp.text_to_jsonb_lines(local_tips);
alter table public.trips
  alter column local_tips set default '[]'::jsonb,
  alter column local_tips set not null;
```

Confirm `0010` is the next free number (latest is `0009`). The `alter column ... drop default` before the type change avoids the "default cannot be cast" error; a `pg_temp` helper keeps the SQL readable and self-cleans.

- [ ] **Step 2: Commit (do not apply)** — `feat(lists): migrate house_rules/local_tips to jsonb arrays`

---

## Task 3: Zod schemas

**Modify:** `lib/schemas/property.ts`, `lib/schemas/trip.ts`

- [ ] **Step 1: property.ts** — change house_rules/local_tips to arrays:

```typescript
  house_rules: z.array(z.string().max(200)).max(50).optional(),
  local_tips: z.array(z.string().max(200)).max(50).optional(),
  stocked_items: z.array(z.string().max(200)).max(50).optional(),
```

- [ ] **Step 2: trip.ts** — same three lines inside `updateTripSchema.extend({ ... })`:

```typescript
  house_rules: z.array(z.string().max(200)).max(50).optional(),
  local_tips: z.array(z.string().max(200)).max(50).optional(),
  stocked_items: z.array(z.string().max(200)).max(50).optional(),
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` will now surface every consumer that treated these as strings (the forms/actions handled in later tasks). Expect errors there until Tasks 4–6 land; confirm the schema files themselves are valid.
- [ ] **Step 4: Commit** — `feat(lists): type house_rules/local_tips/stocked_items as string arrays`

---

## Task 4: Server actions

**Modify:** `lib/actions/properties.ts`, `lib/actions/trips.ts`

- [ ] **Step 1: `createProperty`** (`lib/actions/properties.ts`) — write arrays and harden the sensitive insert.

In the `properties` insert, change:
```typescript
      house_rules: propertyFields.house_rules || null,
      local_tips: propertyFields.local_tips || null,
      stocked_items: propertyFields.stocked_items || [],
```
to:
```typescript
      house_rules: propertyFields.house_rules ?? [],
      local_tips: propertyFields.local_tips ?? [],
      stocked_items: propertyFields.stocked_items ?? [],
```

Then replace the unchecked sensitive insert:
```typescript
  // Insert sensitive info
  await supabase
    .from("property_sensitive_info")
    .insert({ ...fields... });

  return { data: { id: property.id } };
```
with an error-checked insert that rolls back the orphan property on failure:
```typescript
  // Insert sensitive info — if this fails we must not leave an orphan property
  // with no address/wifi/codes silently dropped.
  const { error: sensError } = await supabase
    .from("property_sensitive_info")
    .insert({
      property_id: property.id,
      wifi_ssid: wifi_ssid || null,
      wifi_password: wifi_password || null,
      door_code: door_code || null,
      gate_code: gate_code || null,
      address_line: address_line || null,
      postal_code: postal_code || null,
      parking_notes: parking_notes || null,
    });

  if (sensError) {
    // Best-effort rollback: soft-delete the just-created property.
    await supabase
      .from("properties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", property.id);
    return { error: { _form: [sensError.message] } };
  }

  return { data: { id: property.id } };
```
(Confirm `properties.deleted_at` exists — it's the soft-delete column used by `getProperty`/`getMyProperties` `.is("deleted_at", null)`. If the owner-update RLS doesn't permit setting `deleted_at`, note it; the error return is the essential part.)

- [ ] **Step 2: `updateProperty`** — house_rules/local_tips are arrays now, and the property form WILL collect stocked_items, so all three can be set unconditionally. Change:
```typescript
    house_rules: propertyFields.house_rules || null,
    local_tips: propertyFields.local_tips || null,
  };
  if (propertyFields.stocked_items !== undefined) {
    propertyUpdate.stocked_items = propertyFields.stocked_items;
  }
```
to:
```typescript
    house_rules: propertyFields.house_rules ?? [],
    local_tips: propertyFields.local_tips ?? [],
    stocked_items: propertyFields.stocked_items ?? [],
  };
```
(Remove the now-redundant conditional block.)

- [ ] **Step 3: `updateTrip`** (`lib/actions/trips.ts`) — house_rules/local_tips params are `string[]` now. Update the signature type and the `updateData` assignment so they're written as arrays (they're already conditionally set; just ensure the types are `string[]` not `string`, and default to `[]` if you coerce). Read the function and adjust the param types from `string` to `string[]` for house_rules/local_tips; the array assignment needs no logic change.

- [ ] **Step 4: Verify `syncPropertyToTrip` + `createTrip` unchanged** — `syncPropertyToTrip` copies `property.house_rules/local_tips/stocked_items` verbatim (array→array now); `createTrip` doesn't touch them. Confirm no edits needed.

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit`. The forms (Tasks 5–6) are the remaining consumers; action files should be clean.
- [ ] **Step 6: Commit** — `feat(lists): array writes + harden createProperty sensitive insert`

---

## Task 5: Property form — ListEditors + surface address

**Modify:** `components/property-form.tsx`

- [ ] **Step 1: Imports** — add `import { ListEditor } from "@/components/ui/list-editor";`.

- [ ] **Step 2: Replace the rules/tips textareas** (the "House rules" and "Local tips" blocks) with ListEditors, and add a new "Stocked items" block in the "Property details" section:
```tsx
        <div className="space-y-2">
          <Label>House rules</Label>
          <ListEditor name="house_rules" initialItems={initialValues?.house_rules}
            placeholder="No shoes inside" addLabel="Add a house rule" />
        </div>

        <div className="space-y-2">
          <Label>Local tips</Label>
          <ListEditor name="local_tips" initialItems={initialValues?.local_tips}
            placeholder="Best coffee: Blue Barn on the square" addLabel="Add a local tip" />
        </div>

        <div className="space-y-2">
          <Label>Stocked items</Label>
          <ListEditor name="stocked_items" initialItems={initialValues?.stocked_items}
            placeholder="Coffee" addLabel="Add a stocked item" />
        </div>
```
(`initialValues?.house_rules` etc. are now `string[] | undefined` — matches `ListEditor`'s `initialItems`.)

- [ ] **Step 3: Surface the address** — in the "Sensitive info" section, move the **Address + Postal code** grid (`prop-address` / `prop-postal`) to be the FIRST fields under the `<h3>Sensitive info</h3>` + helper `<p>`, above the wifi grid. Add a short helper under it: `<p className="text-xs text-ink-light">Where the place is. Kept private — only verified guests see it.</p>`. Keep the same inputs/names.

- [ ] **Step 4: Parse the list values on submit** — in `handleSubmit`, the three list fields now arrive as JSON strings from the hidden inputs. Change their lines in the `input` object from `getInputValue("house_rules") || undefined` etc. to a parse helper:
```typescript
    const parseList = (name: string): string[] => {
      try {
        const v = JSON.parse(getInputValue(name) || "[]");
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
      } catch {
        return [];
      }
    };
```
and set:
```typescript
      house_rules: parseList("house_rules"),
      local_tips: parseList("local_tips"),
      stocked_items: parseList("stocked_items"),
```

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit** — `feat(lists): property form uses ListEditor + surfaces address`

---

## Task 6: Trip-edit form — ListEditors

**Modify:** `app/(app)/trips/[id]/edit/edit-form.tsx`, `app/(app)/trips/[id]/edit/page.tsx`

- [ ] **Step 1: edit-form types** — in `EditFormProps.initialData`, change `house_rules: string | null` and `local_tips: string | null` to `house_rules: string[]` and `local_tips: string[]`.

- [ ] **Step 2: edit page initialData** (`edit/page.tsx`) — cast the two fields like stocked_items:
```tsx
          initialData={{
            ...trip,
            house_rules: (trip.house_rules as string[]) || [],
            local_tips: (trip.local_tips as string[]) || [],
            stocked_items: (trip.stocked_items as string[]) || [],
          }}
```

- [ ] **Step 3: edit-form fields** — add `import { ListEditor } from "@/components/ui/list-editor";`. Remove the `stockedInput` state (line ~39-41). Replace the three blocks (house_rules textarea, local_tips textarea, stocked_items comma Input) with:
```tsx
        <div className="space-y-2">
          <Label>House rules</Label>
          <ListEditor name="house_rules" initialItems={initialData.house_rules}
            placeholder="No shoes inside" addLabel="Add a house rule" />
        </div>

        <div className="space-y-2">
          <Label>Local tips</Label>
          <ListEditor name="local_tips" initialItems={initialData.local_tips}
            placeholder="Best coffee on the square" addLabel="Add a local tip" />
        </div>

        <div className="space-y-2">
          <Label>Stocked items</Label>
          <ListEditor name="stocked_items" initialItems={initialData.stocked_items}
            placeholder="Coffee" addLabel="Add a stocked item" />
        </div>
```

- [ ] **Step 4: edit-form submit** — the three fields now come from `FormData` as JSON strings. Replace their lines in the `updateTrip({...})` call:
```typescript
      house_rules: parseList(fd.get("house_rules")),
      local_tips: parseList(fd.get("local_tips")),
      stocked_items: parseList(fd.get("stocked_items")),
```
and add the helper above `handleSubmit` (or inline):
```typescript
  const parseList = (v: FormDataEntryValue | null): string[] => {
    try {
      const arr = JSON.parse((v as string) || "[]");
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
```
Remove the old `stockedInput.split(",")...` logic.

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit** — `feat(lists): trip-edit form uses ListEditor for rules/tips/stocked`

---

## Task 7: Render bulleted lists

**Modify:** `app/(app)/trips/[id]/page.tsx`, `app/trip/[token]/page.tsx`

- [ ] **Step 1: Trip guide** (`trips/[id]/page.tsx`) — for House Rules and Local Tips, replace the truthiness guards and `whitespace-pre-wrap` paragraphs with array-length guards and bulleted lists matching the existing Stocked Items treatment. E.g. House Rules:
```tsx
        {((trip.house_rules as string[])?.length > 0 || canEdit) && (
          <TripInfoSection
            icon={ScrollText}
            title="House Rules"
            action={(trip.house_rules as string[])?.length > 0 && canEdit ? <EditLink href={`/trips/${id}/edit`} /> : undefined}
          >
            {(trip.house_rules as string[])?.length > 0 ? (
              <ul className="space-y-1.5">
                {(trip.house_rules as string[]).map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest/40" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <AddPrompt href={`/trips/${id}/edit`} label="Add house rules" />
            )}
          </TripInfoSection>
        )}
```
Apply the same pattern to Local Tips (`Lightbulb`, "Add local tips"). Stocked Items already renders as a list — leave it.

- [ ] **Step 2: Public token view** (`trip/[token]/page.tsx`) — same: render house_rules and local_tips as bulleted `<ul>` (mirror the existing stocked_items block at lines ~168-176, using `space-y-1` or the 2-col grid as fits) guarded by `(trip.house_rules as string[])?.length > 0`.

- [ ] **Step 3: Typecheck, lint, build** — `npx tsc --noEmit; if ($?) { npm run lint; if ($?) { npm run build } }`. tsc clean; build succeeds. Lint: the two PRE-EXISTING errors in `components/saved-toast.tsx` and `components/address-autocomplete.tsx` are not part of this work — confirm no NEW lint errors in touched files.
- [ ] **Step 4: Commit** — `feat(lists): render house rules & local tips as bulleted lists`

---

## Task 8: Verify

- [ ] **Step 1: Full suite** — `npm test`. Expect existing suites to pass (no new tests added; ListEditor is presentational).
- [ ] **Step 2: Manual e2e (after the user applies migration 0010)** — on a trip you host:
  1. Property form (via trip-create recurring path **and** `/properties/new`): add several house rules / local tips / stocked items one at a time; remove one; the address field is visible near the top of Sensitive info; save → reopen edit → items persist.
  2. Trip edit: same three fields add/remove item-by-item; save → trip guide shows them as bulleted lists.
  3. Public `/trip/[token]` view: house rules, local tips, stocked items all render as bulleted lists.
  4. Existing LAKE WEEKEND content (if any rules/tips text existed) survived the migration as list items.
  5. 375px: rows, the add input + `+` button, and remove `✕` are all usable; Enter adds without submitting the form.
  6. Address hardening: (dev check) a property still saves address/wifi correctly; the sensitive insert is now error-checked.
- [ ] **Step 3: Commit** any fixes from e2e.

---

## Self-review notes (for the implementer)

- **Shape consistency:** all three fields are `string[]` end-to-end after Task 3; the migration (Task 2) makes the DB match. Don't leave any `whitespace-pre-wrap` paragraph render for rules/tips.
- **Form integration:** `ListEditor` writes JSON to a hidden input; both readers (`querySelector().value` in property-form, `FormData.get()` in trip-edit) parse it with the `parseList` helper. Enter must `preventDefault` (Task 1) so it never submits the trip-edit `<form>`.
- **Sync untouched:** `syncPropertyToTrip` copies arrays verbatim — copy-on-link (§3.3) preserved; no resync in scope.
- **Migration is file-only** — the user applies 0010 before the Task 8 e2e.
- **Pre-existing lint** in `saved-toast.tsx` / `address-autocomplete.tsx` is not ours — don't "fix" it.
