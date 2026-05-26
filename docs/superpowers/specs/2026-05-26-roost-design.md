# Roost — Design Spec

> **Date:** 2026-05-26
> **Status:** Approved (pending final review)
> **Author:** Matt + Claude (collaborative brainstorm)

---

## 1. What Roost Is

Roost is the shared brain for group stays. Whether you're hosting friends at your lake house, renting an Airbnb with 8 people for a bachelor party, or organizing a family reunion at a beach rental — Roost centralizes everything the group needs before, during, and after the trip.

It replaces the chaotic text message thread that currently does this job badly.

**Target user:** the "organizer" — the person who owns the place OR booked the rental OR is wrangling the group. Secondary: the guests, who should participate with zero friction.

**Origin:** Matt experienced the pain firsthand on a group trip the weekend of 2026-05-23/24. Friends repeatedly said "I wish there was a way to do this" — those moments are the source material for the MVP feature set.

**Relationship to Hearth:** Roost is a sibling product. Both are built by Matt. Hearth is a household-operations platform; Roost is group-trip coordination. They share a brand sensibility (warm, anti-corporate) but are separate products with separate stacks and audiences. Hearth integration is post-MVP — the data model and API surface anticipate it, but internal models are not coupled.

---

## 2. Architecture

### 2.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Same as Hearth; SSR for marketing, server actions for forms |
| Styling | **Tailwind CSS v4** + custom Roost design tokens | Brand-kit palette, not Hearth's palette |
| UI primitives | **shadcn/ui** + custom Roost components | Headless, ownable |
| Icons | **Lucide** (SVG) — never emoji | Consistent with Hearth convention |
| Forms | **react-hook-form + zod** | Type-safe, performant |
| Server state | **TanStack Query** | Caching, refetch, optimistic updates |
| Database | **Supabase Postgres** with **Row Level Security** | Multi-tenant at trip scope |
| Auth | **Supabase Auth** + magic link | Lower friction than passwords; guest conversion flow |
| File storage | **Supabase Storage** (behind abstraction layer) | Photos, future document uploads |
| Realtime | **Supabase Realtime** | Live packing claims, photo uploads, presence |
| Email | **Resend** | Trip invites, email digests, verification |
| Deploy | **Vercel** (app) + **Supabase** (DB/auth/storage) | Preview branches per PR |
| Background jobs | **Supabase Cron + Edge Functions** | Email digests, cleanup |
| Monitoring | **Sentry** + **Vercel Analytics** | Errors + basic product analytics |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Money math gets 100% coverage when expenses land |

### 2.2 What we are NOT using

- **Clerk / Auth.js** — Supabase Auth handles magic-link natively; Clerk adds a vendor + bill for no win.
- **Prisma / Drizzle** — Raw SQL migrations + `@supabase/supabase-js`, matching Hearth. Add Drizzle only if query complexity demands it.
- **Mongo / NoSQL** — Trip data is relational; foreign keys matter.
- **Redux / Zustand** — TanStack Query handles server state.
- **Default Tailwind palettes** — Roost has its own brand-kit palette.

### 2.3 Three Roost-specific shape decisions (different from Hearth)

**1. Mobile-first PWA.** Every screen designed at 375px first, scales up. Web App Manifest + service worker + iOS "add to home screen" prompt in v0. Trip coordination happens on phones, in cars, at the grocery store.

**2. Realtime is first-class.** Supabase Realtime is wired into the data layer from day 1, not retrofitted. Live updates for: packing claims, meal assignments, photo uploads, presence. Free with Supabase; expensive to retrofit later.

**3. Storage abstraction layer.** All photo uploads and signed-URL generation go through a `lib/storage/` interface (`storage.put`, `storage.signedUrl`, `storage.delete`). Implementation is Supabase Storage today; swappable to R2 in one file later. React components never call Supabase Storage directly.

### 2.4 Cross-cutting concerns

- **Row-Level Security on every table.** Tenant scope is per-trip. A row is visible only to trip members OR holders of a valid `trip_grant`.
- **Storage-layer tenancy.** Photos are pathed `trips/{trip_id}/photos/{uuid}.jpg` with bucket policies equivalent to RLS.
- **Soft-delete everywhere user-facing.** `deleted_at` timestamptz column; default queries filter `WHERE deleted_at IS NULL`.
- **UUIDs for all PKs.** Better for distributed inserts and URL-safe IDs.

---

## 3. Data Model

### 3.1 Entity overview

```
users                    Profile data extending auth.users
properties               Recurring locations — non-sensitive fields
property_sensitive_info  1:1 with properties — wifi, codes, address
trips                    The core object — non-sensitive fields + sync metadata
trip_sensitive_info      1:1 with trips — wifi, codes, address, parking
trip_members             Junction: user x trip x role
trip_invites             Per-recipient single-use email tokens
trip_grants              Device/user verification state (powers tiered visibility)
packing_items            Claimable items per trip
meal_slots               One row per meal slot (Saturday dinner, etc.)
photos                   Metadata; actual files in Supabase Storage
```

**Deferred to later migrations:** `expenses`, `expense_splits`, `availability_polls`, `availability_responses`, `messages`.

### 3.2 The sensitive-info split

Postgres RLS works at the row level, not the column level. To enforce sensitive-field gating at the database (not in app code where it's easier to leak):

- **`trips`** contains: name, dates, city/state, host, member-visible info
- **`trip_sensitive_info`** (1:1 FK) contains: wifi_ssid, wifi_password, door_code, gate_code, address_line, postal_code, parking_notes

RLS policies:
- `trips` row visible to: trip members OR `trip_grants.level >= 'view'`
- `trip_sensitive_info` row visible to: trip members OR `trip_grants.level = 'sensitive'`

Same pattern mirrored for `properties` / `property_sensitive_info`.

### 3.3 Key tables

**trips**
```sql
id                            uuid pk
host_user_id                  uuid fk -> users
property_id                   uuid fk -> properties  (nullable)
name                          text                   -- "Sonoma Weekend"
starts_on, ends_on            date                   (nullable for TBD trips)
city, region                  text                   -- display location only
require_pin_to_view           boolean default false
pin_hash                      text                   (nullable; bcrypt'd)
property_synced_at            timestamptz            (nullable)
property_sync_overrides       jsonb default '{}'
details                       jsonb default '{}'
created_at, updated_at, deleted_at
```

**trip_grants**
```sql
id              uuid pk
trip_id         uuid fk
user_id         uuid fk          (nullable — anonymous viewers use signed cookies)
level           text             -- 'view' | 'sensitive'
source          text             -- 'magic-link' | 'pin-entry' | 'email-verify'
granted_at      timestamptz
expires_at      timestamptz      -- default +30 days
last_seen_at    timestamptz
```

**trip_invites**
```sql
id                    uuid pk
trip_id               uuid fk
email                 text
token                 text unique     -- random 32 bytes
expires_at            timestamptz     -- default +14 days
consumed_at           timestamptz     (nullable)
consumed_by_user_id   uuid fk         (nullable)
created_at
```

**trip_members**
```sql
id                uuid pk
trip_id           uuid fk
user_id           uuid fk
role              text                -- 'host' | 'co-host' | 'guest'
invited_email     text
joined_at         timestamptz         (nullable — null = invited, not yet converted)
created_at
```

**packing_items**
```sql
id                  uuid pk
trip_id             uuid fk
title               text
quantity            text                (nullable — "2x", "a few")
notes               text                (nullable)
claimed_by_user_id  uuid fk             (nullable)
claimed_at          timestamptz         (nullable)
is_completed        boolean default false
created_by_user_id  uuid fk
sort_order          integer default 0
created_at, updated_at
```

**meal_slots**
```sql
id              uuid pk
trip_id         uuid fk
day_date        date
meal_type       text              -- 'breakfast' | 'lunch' | 'dinner' | 'other'
title           text              (nullable — "Saturday dinner")
cook_user_id    uuid fk           (nullable)
menu            text              (nullable — what they're making)
notes           text              (nullable)
sort_order      integer default 0
created_at, updated_at
```

**photos**
```sql
id                  uuid pk
trip_id             uuid fk
storage_path        text              -- abstracted storage key
uploaded_by_user_id uuid fk
caption             text              (nullable)
taken_at            timestamptz       (nullable — EXIF)
mime_type           text
width, height       integer           (nullable — for layout)
file_size_bytes     bigint
created_at, deleted_at
```

**properties**
```sql
id              uuid pk
owner_user_id   uuid fk -> users
name            text              -- "Vineyard House"
city, region    text
house_rules     text              (nullable)
local_tips      text              (nullable)
stocked_items   jsonb default '[]'
details         jsonb default '{}' -- extensibility for future fields
created_at, updated_at, deleted_at
```

**property_sensitive_info**
```sql
id              uuid pk
property_id     uuid fk -> properties (unique)
wifi_ssid       text    (nullable)
wifi_password   text    (nullable)
door_code       text    (nullable)
gate_code       text    (nullable)
address_line    text    (nullable)
postal_code     text    (nullable)
parking_notes   text    (nullable)
created_at, updated_at
```

**trip_sensitive_info**
```sql
id              uuid pk
trip_id         uuid fk -> trips (unique)
wifi_ssid       text    (nullable)
wifi_password   text    (nullable)
door_code       text    (nullable)
gate_code       text    (nullable)
address_line    text    (nullable)
postal_code     text    (nullable)
parking_notes   text    (nullable)
created_at, updated_at
```

**users**
```sql
id              uuid pk (= auth.users.id)
display_name    text
email           text              -- cached from auth
avatar_url      text              (nullable)
created_at, updated_at
```

### 3.4 Property-to-Trip sync semantics

Properties are smart templates. Trips are the source of truth for each specific stay.

**On trip creation with property link:**
- Snapshot copy: Property's name, address, wifi, codes, rules, tips, stocked items -> corresponding Trip / trip_sensitive_info fields
- `trips.property_synced_at = now()`
- `trips.property_sync_overrides = '{}'`

**On trip-level edit of a synced field:**
- Trip column updates normally
- `property_sync_overrides.{field_name} = true` — marks "user has overridden; don't clobber on resync"

**On Property record change (host updates the master Property):**
- No automatic propagation. Pull, not push.
- Trip page detects `trip.property_synced_at < property.updated_at` and shows: "Vineyard House has updates available. [Review changes]"
- Review modal shows diff; overridden fields marked "you've edited this here — sync anyway?"
- User can sync all, sync selectively, or dismiss

### 3.5 Roles

Roles are **per-trip**, not global account tiers. A single user can be `host` of one trip and `guest` of another simultaneously. No "upgrade to host" flow — anyone with an account can create a trip and automatically becomes its host.

| Role | Can create/edit trip info | Can invite guests | Can manage packing/meals | Can upload photos | Can delete others' photos |
|---|---|---|---|---|---|
| host | Yes | Yes | Yes | Yes | Yes |
| co-host | Yes | Yes | Yes | Yes | Yes |
| guest | No (can suggest edits later) | No | Can claim/volunteer | Yes | No (own photos only) |

Future billing tiers (free vs paid) would gate trip *creation limits*, not in-trip permissions. That's a v2+ concern.

---

## 4. Access Model (Option C+B)

### 4.1 Three tiers of access

1. **Anonymous viewer** — has a valid invite token in the URL + signed cookie. Sees non-sensitive trip fields. Cannot take actions. No Supabase session.
2. **Authenticated member (view-level)** — has a Supabase session + `trip_members` row. Can claim packing items, upload photos, assign meals. Cannot see sensitive fields yet. (Note: `trip_grants` are for the anonymous-to-authenticated transition; once a user is a trip member, RLS checks `trip_members` directly — no separate grant needed for non-sensitive access.)
3. **Authenticated member (sensitive-level)** — trip member who has completed the reveal-verification step. `trip_grants.level = 'sensitive'` OR the host/co-host role (who see sensitive fields by default without a separate grant). Granted via email-match verification or PIN entry.

### 4.2 The guest journey

1. Host creates trip, enters guest emails, hits "Invite"
2. System creates `trip_invites` rows, sends emails via Resend
3. Guest clicks link in email -> lands on `/trip/[token]`
4. Server validates token (not expired, not consumed), sets signed httpOnly cookie
5. Trip page renders via service-role (bypasses RLS for anonymous read)
6. Guest sees: trip name, dates, city, guest list, rules, tips, packing list, meal plan
7. Sensitive fields render as `"•••••• [tap to reveal]"`
8. Guest tries to claim a packing item -> contextual auth prompt: "Just need your name + email"
9. Guest enters name + email -> Supabase Auth creates user via magic-link
10. Guest clicks confirmation email -> session established
11. System: consumes invite token, creates `trip_members` row (role='guest'), creates `trip_grants` (level='view')
12. Packing claim executes; realtime broadcasts to all trip members
13. Guest taps "reveal" on wifi -> email-match verification -> grant upgraded to 'sensitive'
14. `trip_sensitive_info` row now readable via RLS

**Key: token consumption happens at conversion (step 11), not at first view (step 4).** Anonymous viewing doesn't burn the invite.

### 4.3 PIN mode (paranoid-host variant)

When `trips.require_pin_to_view = true`:
- Anonymous view path adds a PIN step: click link -> "Enter the trip code to view" -> bcrypt compare -> cookie issued
- Sensitive reveal can also use PIN instead of email-match verification
- Per-trip setting, not a global default. Toggle lives in trip settings.

### 4.4 The anonymous viewing path (technical)

Guests clicking the invite link before account creation don't have a Supabase Auth session. RLS keys off `auth.uid()` which is null. So:

- `/trip/[token]` route runs server-side with the Supabase service-role key
- Route validates URL token against `trip_invites`, issues signed httpOnly cookie
- All reads on this route bypass RLS; access enforced in the route handler
- The moment the user converts (drops name + email), they get a real Supabase session + `trip_members` row + `trip_grants` row -> subsequent reads go through standard RLS

Two access paths: public token-gated (service-role + handler enforcement) and standard authenticated (Supabase session + RLS). They converge on conversion.

---

## 5. Realtime Model

### 5.1 Channel architecture

One Supabase Realtime channel per trip: `trip:{trip_id}`

Channel authorization: gated by `trip_members` membership via RLS. Only authenticated members can subscribe. Anonymous viewers see a static snapshot (no realtime).

### 5.2 Events by phase

| Event | Payload | Phase |
|---|---|---|
| `packing:claimed` | `{item_id, user_id, user_name}` | v1.1 |
| `packing:unclaimed` | `{item_id}` | v1.1 |
| `packing:completed` | `{item_id, user_id}` | v1.1 |
| `meal:assigned` | `{slot_id, user_id, user_name}` | v1.1 |
| `meal:updated` | `{slot_id, menu}` | v1.1 |
| `photo:uploaded` | `{photo_id, thumbnail_url, user_name}` | v1.2 |
| `photo:removed` | `{photo_id}` | v1.2 |
| `message:new` | `{message_id, user_name, preview}` | v1.3 |
| `presence:join` | `{user_id, user_name}` | v1.1 |
| `presence:leave` | `{user_id}` | v1.1 |
| `trip:updated` | `{fields_changed[]}` | v1.0 |

### 5.3 Client-side pattern

`lib/realtime/use-trip-channel.ts` — React hook that subscribes on mount, unsubscribes on cleanup. Returns dispatch for optimistic local updates + reconciles with server events.

Optimistic updates for packing claims (show claim instantly, reconcile on broadcast). Photo uploads show local preview with progress; `photo:uploaded` event replaces with real thumbnail.

---

## 6. Phased Build Sequence

### v0 — Foundations (1-2 weeks)
- Next.js 15 scaffold + Tailwind v4 + Roost design tokens
- Supabase project + auth (magic-link)
- First migration: all v1.0 tables with RLS
- PWA manifest + service worker shell
- Vercel deploy pipeline + preview branches
- App shell: bottom nav (mobile), "My Trips" + "Settings" wired
- Resend wired for trip invite email template
- Empty state dashboard

**Gate:** Deployable, magic-link login works, empty dashboard renders.

### v1.0 — Trip creation + info hub (2-3 weeks)
- Create trip: name, dates (or TBD), city, optional Property link
- Property CRUD: create/edit inline from trip creation + "My Properties" list
- Property-to-Trip sync: copy-on-link + "Review changes" resync
- Invite guests: enter emails -> Resend sends per-recipient token emails
- Trip info hub (the Trip Guide screen): dates, location, rules, tips, stocked items
- Sensitive fields: `••••••` with reveal flow (email-verify or PIN)
- Anonymous trip view: `/trip/[token]` service-role path
- Guest conversion: contextual "name + email" prompt -> account + member + grant
- Optional PIN-to-view per trip

**Gate:** Create a trip, invite 8 friends, they click email, see the guide, reveal wifi. Usable for a real trip.

### v1.1 — Packing list + meal plan (2-3 weeks)
- Packing list: host seeds items, guests claim, realtime updates, "brought it" checkbox
- Meal slots: host creates slots, guests volunteer, menu/notes, stocked-items reference
- Realtime: Supabase Realtime channels for claims + assignments
- Accessible to all members + view-granted guests

**Gate:** Coordinate a real trip's packing and meals through Roost instead of group text.

### v1.2 — Shared photo album (2-3 weeks)
- Upload via storage abstraction, EXIF date extraction
- Masonry grid album view, chronological or by-day
- Realtime: uploads appear live
- Bulk download as zip (Edge Function)
- Host can remove any photo; uploader can remove own
- Photo access: trip members only (not anonymous viewers)

**Gate:** Friends upload trip photos to Roost instead of AirDrop/shared album.

### v1.3 — Group chat / message board (1-2 weeks)
- Chronological comment thread per trip
- Markdown-lite (bold, links, @mentions)
- Realtime via Supabase Realtime
- Email digest for unread messages (Supabase Cron + Resend)

**Gate:** Trip decisions happen in Roost, not buried in a 200-message group text.

### v1.4 — Availability polling (2 weeks)
- Host proposes 2-4 candidate date ranges
- Guests mark: works / maybe / no
- Summary view: "Sept 12-14 works for 6/8 people"
- Host picks winner -> trip dates auto-fill
- Google Calendar conflict detection: stretch goal, only if OAuth is wired

**Gate:** Pick a trip weekend without a 30-message calendar back-and-forth.

### Deferred features

| Feature | When | Why deferred |
|---|---|---|
| Expense splitting + settle-up | v2.0 | Coordination + photos is the wedge, not money |
| Recurring Property templates (pre-fill from past trips) | v2.1 | Property exists in v1.0; templates are a refinement |
| Past trips archive | v2.1 | Needs expenses + photos to be meaningful |
| Hearth integration | v3.0 | Clean API surface designed from v1.0, actual integration post-MVP |
| House manual (appliance guides, "how to start the boat") | v2.2 | Extension of Property |
| Smart suggestions | v3+ | Needs enough trip data to train patterns |
| Native app | v3+ | PWA first; native only if push/camera prove critical |
| Google/Apple Calendar conflict detection | v2.0 | Requires OAuth; manual polling works for MVP |

### Non-goals

- Not a booking platform (not competing with Airbnb/Vrbo)
- Not a general expense tracker (scoped to trips when it lands)
- Not a social network (no public feeds, no follower model)
- Not a property management system (not for commercial hosts)
- Not a chat app (messaging is a feature, not a pillar)

---

## 7. Design Language

Established in the brand kit (`branding/brand-kit.png`). Locked for v1.

- **Style:** Warm, tactile, Field-Notes-meets-cabin aesthetic. Kraft paper textures, stamp/letterpress accents.
- **Display font:** Silene Brock / Desk
- **Body font:** Roslindale / Untitled Serif
- **Mono accent:** CoFo Sans Mono
- **Palette:** Kraft (#C2B8A3), Fern (#3F6A47), Birch (#A4B08E), Roost (#917E6C), Sage (#A4AD8E), Sand (#C8B99A), Ink (#3B3028)
- **UI tokens:** rounded cards, soft shadows, stamp-distress textures on accents, logo-line patterns for empty states
- **Mobile-first:** bottom nav, generous touch targets, chunked information
- **Never:** emoji as icons, default Tailwind palettes as brand color, corporate/SaaS visual language

---

## 8. Conscious Omissions

Things this design explicitly does NOT include, and why:

- **No push notifications.** PWA push is unreliable on iOS. Email digests are the notification channel until native app.
- **No offline support.** Service worker caches app shell; data requires connectivity. Offline-first sync layer isn't worth the complexity for v1.
- **No typing indicators or read receipts.** Message board is a comment thread, not a chat app.
- **No file attachments in messages.** Photos go in the album; messages are text-only.
- **No global account tiers.** Roles are per-trip. Billing tiers (free vs paid) are a v2+ concern.

---

## 9. Open Questions

### #1 — Pricing model
Free with paid tier for power hosts (recurring properties, unlimited photo storage)? Or fully free + Hearth-style paid integrations? Decide before public launch, not before MVP.
**Status:** Open (not blocking MVP)

### #2 — Native app vs PWA
PWA is faster to ship and good enough for MVP. Native makes sense if push notifications and camera integration become critical.
**Status:** Open (revisit after v1.2 dogfooding)

### #3 — Product name
"Roost" is the working name. Trademark and domain availability need checking before public launch. Backup names from the brief: Threshold, Stay, Lodge, Mooring.
**Status:** Open (not blocking MVP)

### #4 — iCloud calendar support
Google Calendar covers ~70% of users. iCloud via CalDAV is doable but rough onboarding. Punt to post-MVP.
**Status:** Open (not blocking MVP)

---

## 10. Project Structure

```
roost/
+-- app/                           # Next.js App Router
|   +-- (marketing)/              # Public landing, /about, /pricing later
|   +-- (auth)/                   # /login, /auth/callback
|   +-- trip/[token]/             # Token-gated public trip view
|   +-- (app)/                    # Logged-in routes (dashboard, manage trip, etc.)
+-- components/                    # Roost UI components
|   +-- ui/                       # shadcn primitives
+-- lib/
|   +-- supabase/                 # server.ts, client.ts, middleware.ts
|   +-- storage/                  # Abstraction layer (Supabase Storage today)
|   +-- realtime/                 # Channel subscription helpers, use-trip-channel hook
|   +-- trip-access/              # C+B logic: token validation, grant issuance
+-- supabase/
|   +-- migrations/               # Raw SQL, numbered
+-- branding/                     # Brief + brand kit (stays as-is)
+-- design-system/                # Auto-generated by ui-ux-pro-max (when invoked)
+-- docs/
|   +-- superpowers/
|       +-- specs/                # This file lives here
+-- .claude/
|   +-- skills/                   # ui-ux-pro-max
|   +-- settings.json
+-- CLAUDE.md
+-- package.json
+-- tsconfig.json
+-- next.config.ts
+-- postcss.config.mjs
+-- .env.local.example
+-- .env.local                    # gitignored
+-- .gitignore
+-- .gitattributes                # LF line endings on Windows
```
