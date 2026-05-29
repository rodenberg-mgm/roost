# CLAUDE.md — Roost

> **Working name:** *Roost — the shared brain for group stays.*
> Open to other names. See §9, Open Decision #3.

This file is the project's source of truth for vision, stack, phasing, rules, and the way Claude and Matt collaborate. Edit it as decisions get made. Don't let it rot.

---

## 1. The Vision

Roost centralizes everything a group needs before, during, and after a shared stay — whether that's a lake house with friends, a bachelor-party Airbnb, or a family reunion at a beach rental.

It replaces the chaotic text message thread that currently does this job badly: the one where the wifi password is asked for every visit, nobody knows who's bringing what, and the settle-up happens via awkward Venmo requests two weeks later.

**Target user:** the "organizer" — the person who owns the place OR booked the rental OR is wrangling the group. They're the one who re-explains everything to every guest, every trip. Roost makes that work disappear.

**Secondary user:** the guests — who should be able to participate with zero friction. No signup required to view a trip; account required only to contribute (upload photos, claim packing items, volunteer to cook).

**Origin:** Matt experienced the pain firsthand on a group trip the weekend of 2026-05-23/24. Friends repeatedly said "I wish there was a way to do this." Those moments are the source material for the MVP feature set.

**Relationship to Hearth:** Roost is a sibling product. Hearth is a household-operations platform; Roost is group-trip coordination. They share a brand sensibility (warm, anti-corporate) but are separate products with separate stacks, audiences, and repositories. Hearth integration is post-MVP (v3.0) — the data model and API surface anticipate it, but internal models are not coupled.

---

## 2. Where We Are Right Now

**Locked in:**
- Multi-tenant SaaS, scoped at the trip level
- Claude writes most of the code; Matt directs product and reviews
- Hosted on **Vercel + Supabase**
- Branding locked: see [brand-kit.png](branding/brand-kit.png) and [mockup.png](branding/mockup.png)
- Design spec approved: see [2026-05-26-roost-design.md](docs/superpowers/specs/2026-05-26-roost-design.md)

**Phase we're in:** pre-build. The mockup at [mockup.png](branding/mockup.png) is a visual prototype only — four screens (landing, trip dashboard, trip guide, settle-up) showing the target design language. The real app starts with a fresh Next.js scaffold (see §11).

**Open decisions:** see §9.

---

## 3. Design Principles

These are from the product brief and the brainstorm sessions. They bind every feature decision.

### 3.1 Mobile-first, always
Trip coordination happens on phones — in cars, at the grocery store, standing in the kitchen asking "what's the wifi?" Every screen is designed at 375px first and scales up. PWA from day one.

### 3.2 Guest experience requires zero friction
Magic-link view, no signup to see trip info. Account creation is contextual — it happens when a guest tries to *do* something (claim an item, upload a photo), not before. The prompt is "just need your name + email," not a registration form.

### 3.3 Information should never need to be re-entered
Recurring properties remember their wifi, rules, and house manual across every trip. Property-to-Trip sync is copy-on-link with explicit resync — smart templates, not live joins. Trip-level edits aren't clobbered by Property updates.

### 3.4 Warm, not corporate
This is friends hosting friends, not enterprise software. The visual language feels more like a Field Notes notebook than a SaaS dashboard. Kraft textures, stamp accents, hand-drawn-feeling iconography.

### 3.5 Default to "everyone can edit"
This is a trust-based product. Heavy permissioning kills the vibe. Roles (host, co-host, guest) exist, but guests can claim items, upload photos, and volunteer to cook without asking anyone. The host controls trip info and invites; everything else is collaborative.

### 3.6 Sensitive data earns its own gate
Wifi passwords, door codes, and addresses are real secrets. They live in separate database tables with separate RLS policies, render as `•••••• [tap to reveal]`, and require a verification step (email match or PIN) to view. A leaked invite link shows "Sonoma Weekend, May 16–18, 7 people" — annoying, not unsafe.

---

## 4. Phased Roadmap

Each phase ships a usable, testable thing. We do **not** build broad-but-shallow. We build narrow-and-finished, then expand.

### v0 — Foundations (1–2 weeks)
- Next.js 15 scaffold, Supabase auth, trip-scoped RLS, deploy pipeline
- PWA manifest + service worker shell
- App shell with bottom nav (mobile), only "My Trips" + "Settings" wired
- Resend wired for trip invite email template
- Empty state: "No trips yet — start one or join with an invite link"

### v1.0 — Trip creation + info hub (2–3 weeks)
- Create a trip: name, dates (or TBD), city, optional Property link
- Property CRUD: create/edit inline from trip creation + "My Properties" list
- Property-to-Trip sync: copy-on-link + "Review changes" resync mechanism
- Invite guests: host enters emails → Resend sends per-recipient token emails
- Trip info hub (the Trip Guide screen): dates, location, rules, tips, stocked items
- Sensitive fields: `••••••` with reveal flow (email-verify or PIN)
- Anonymous trip view: `/trip/[token]` for link-click viewing without an account
- Guest conversion: contextual "name + email" prompt → creates account + member + grant
- Optional PIN-to-view per trip (paranoid-host toggle)

### v1.1 — Packing list + meal plan (2–3 weeks)
- Packing list: host seeds items → guests claim → realtime updates → "brought it" checkbox
- Meal slots: host creates slots → guests volunteer → menu/notes
- Realtime via Supabase Realtime channels (live claim updates across all devices)

### v1.2 — Shared photo album (2–3 weeks)
- Upload via storage abstraction, EXIF date extraction
- Masonry grid, chronological or by-day grouping
- Realtime: uploads appear live for all members
- Bulk download as zip (Edge Function)
- Photo access: trip members only (not anonymous viewers)

### v1.3 — Group chat / message board (1–2 weeks)
- Simple chronological comment thread per trip (not a full chat system)
- Markdown-lite (bold, links, @mentions)
- Email digest for unread messages (Supabase Cron + Resend)

### v1.4 — Availability polling (2 weeks)
- Host proposes 2–4 candidate date ranges
- Guests mark which work / maybe / no
- Host picks winner → trip dates lock in

**Hard rule:** we do not start v1.1 until v1.0 is *actually usable on a real trip with real friends*. Dogfood before expanding.

---

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Same as Hearth; SSR for marketing, server actions for forms |
| Styling | **Tailwind CSS v4** + custom Roost design tokens | Brand-kit palette (Kraft/Forest/Brick/Bone/Sage/Sand/Ink) |
| UI primitives | **shadcn/ui** + custom Roost components | Headless, ownable |
| Icons | **Lucide** (SVG) — *never* emoji | Consistent with Hearth convention |
| Forms | **react-hook-form + zod** | Type-safe, performant |
| Server state | **TanStack Query** | Caching, refetch, optimistic updates |
| Realtime | **Supabase Realtime** | Live packing claims, photo uploads, presence |
| Database | **Supabase Postgres** with **Row Level Security** | Multi-tenant at trip scope; sensitive-info split tables |
| Auth | **Supabase Auth** + magic link | Guest conversion flow; no passwords |
| File storage | **Supabase Storage** (behind `lib/storage/` abstraction) | Photos; swappable to R2 later |
| Email | **Resend** | Trip invites, email digests, verification |
| Background jobs | **Supabase Cron + Edge Functions** | Email digests, cleanup jobs |
| Deploy | **Vercel** (app), **Supabase** (DB/auth/storage) | Preview branches per PR |
| Monitoring | **Sentry** + **Vercel Analytics** | Errors + basic product analytics |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Money math gets 100% coverage when expenses land |

**What we are not using and why:**
- **Clerk / Auth.js** — Supabase Auth handles magic-link natively; Clerk adds a vendor and a bill for no win
- **Prisma / Drizzle** — Raw SQL migrations + `@supabase/supabase-js`, matching Hearth; add Drizzle only if query complexity demands it
- **Mongo / NoSQL** — Trip data is relational; foreign keys matter
- **Redux / Zustand** for server data — TanStack Query handles it
- **Default Tailwind palettes** as brand color — Roost has its own palette from the brand kit

---

## 6. How Claude Works on This Project

Same collaboration contract as Hearth. Matt's explicit ask: *"I don't want to always have agreement. I want to go back and forth before shipping features."*

### 6.1 The collaboration contract

**Before any non-trivial feature, Claude does this — every time, no exceptions:**

1. **Restate the goal in one sentence.**
2. **Surface 2–3 approaches with tradeoffs.** Not "here's the answer." Options with costs and benefits.
3. **Make a recommendation.** With reasoning. Then wait for Matt's call.
4. **Flag adjacent features worth considering.** Even ones Matt didn't ask for.
5. **Only then start coding.**

**Pushback is mandatory, not optional.** When Matt proposes a feature or approach, Claude's first instinct should be to ask:
- Does this solve a *real* problem, or a *theoretical* one?
- What's the smallest version that proves the value?
- What's the next-best alternative we're rejecting?
- What does it cost in time / complexity / vendor lock-in?

If after pushback Matt still wants the original approach, defer to him. He owns product. Claude owns "raising the question."

### 6.2 Sycophancy is banned

No "Great question!" No "Excellent idea!" No padding. Direct, brief, technical. If Matt is wrong, say so with reasoning. If he's right, say "yes" and move on.

---

## 7. What To Do / What Not To Do

### Always
- **Invoke the `ui-ux-pro-max` skill before designing any UI.** Run the search script for each new screen.
- Use TypeScript end-to-end. No `any` without a `// reason` comment.
- Implement Postgres Row Level Security from the first table. No exceptions.
- Sensitive fields (wifi, codes, address, parking) **always** in `_sensitive_info` sibling tables with their own RLS policies. Never in the parent table.
- Soft-delete everything user-facing (`deleted_at` timestamptz). Hard delete is a separate, explicit operation.
- **All photo uploads go through `lib/storage/`** — never call Supabase Storage directly from components.
- **All realtime subscriptions go through `lib/realtime/use-trip-channel.ts`** — one channel per trip, one hook to manage it.
- Use Lucide icons. Always SVG, never emoji.
- Match the brand language exactly per the brand kit reference below (§14).
- Design mobile-first (375px). Test at 375 / 768 / 1024 / 1440.
- Surface 2–3 options before building a non-trivial feature (§6).
- Write tests for anything involving money (when expenses land in v2.0). Use integers + cents, never floats.
- **Property-to-Trip data flow is copy-on-link with explicit resync.** Never auto-propagate changes from Property to linked Trips.

### Never
- Add a feature, page, or module without explicit go-ahead from Matt.
- Auto-agree with Matt's plan. Push back, then defer.
- Use default Tailwind palettes (`bg-blue-500`, `bg-indigo-600`, etc.) as primary brand color.
- Use Inter, Roboto, Arial, or system-ui as the body font.
- Use emojis as UI icons.
- Use `transition-all` or animate `width`/`height`. Only `transform` and `opacity`.
- Use `scale()` hover effects that shift layout. Use `translateY(-2px)` if you need a lift.
- Store sensitive trip data (wifi, codes, address) in the `trips` table directly. Always use `trip_sensitive_info`.
- Call Supabase Storage directly from React components. Always use the `lib/storage/` abstraction.
- Touch the schema without a migration file. No `psql` edits on the prod DB ever.
- Ship a screen without checking it at 375px mobile width.
- Make trip roles a global account tier. Roles are always per-trip.
- Automatically propagate Property changes to linked Trips. Pull, never push.

---

## 8. Access Model (Option C+B)

This is important enough to have its own section in the CLAUDE.md because it affects every route and every RLS policy.

### Three tiers of access

1. **Anonymous viewer** — has a valid invite token in the URL + signed cookie. Sees non-sensitive trip fields. Cannot take actions. No Supabase session. Served via service-role on the `/trip/[token]` route.
2. **Authenticated member (view-level)** — has a Supabase session + `trip_members` row. Can claim packing items, upload photos, assign meals. Cannot see sensitive fields yet.
3. **Authenticated member (sensitive-level)** — trip member who has completed the reveal-verification step (email-match or PIN). Can see wifi, codes, address, parking. Host and co-host roles see sensitive fields by default.

### Key rules

- **Token consumption happens at conversion, not at first view.** Anonymous viewing doesn't burn the invite token.
- **Two access paths exist:** public token-gated (service-role + handler enforcement) and standard authenticated (Supabase session + RLS). They converge when the user converts.
- **PIN mode is per-trip, optional, off by default.** The `require_pin_to_view` flag in trip settings. Most hosts won't use it.
- **Realtime channels require authentication.** Anonymous viewers see a static snapshot. Subscribing to `trip:{trip_id}` requires a `trip_members` row.

---

## 9. Open Decisions

### #1 — Pricing model
Free with paid tier for power hosts (recurring properties, unlimited photo storage)? Or fully free + Hearth-style paid integrations? Decide before public launch, not before MVP.
**Status:** ⏳ Open (not blocking MVP)

### #2 — Native app vs PWA
PWA is faster to ship and good enough for MVP. Native makes sense if push notifications and camera integration become critical after dogfooding.
**Status:** ⏳ Open (revisit after v1.2)

### #3 — Product name
"Roost" is the working name. Trademark and domain availability need checking before public launch. Backup names: Threshold, Stay, Lodge, Mooring.
**Status:** ⏳ Open (not blocking MVP)

### #4 — iCloud calendar support
Google Calendar covers ~70% of users. iCloud via CalDAV is doable but rough onboarding. Punt to post-MVP.
**Status:** ⏳ Open (not blocking MVP)

### #5 — Legal / compliance
Handling user data + shared location info triggers obligations: privacy policy, ToS, breach notification. Before public beta, get reviewed by an attorney.
**Status:** ⏳ Open (blocking before public launch, not before MVP)

---

## 10. Features — Committed vs. Deferred vs. Cut

### Committed

| # | Feature | Phase |
|---|---|---|
| 1 | Trip creation + magic-link invite | v1.0 |
| 2 | Trip info hub (wifi, address, rules, tips, stocked items) | v1.0 |
| 3 | Property CRUD + Property-to-Trip sync | v1.0 |
| 4 | Anonymous trip view (token-gated, no signup) | v1.0 |
| 5 | Guest conversion (contextual, name + email) | v1.0 |
| 6 | Tiered visibility (sensitive fields behind reveal gate) | v1.0 |
| 7 | Optional PIN-to-view per trip | v1.0 |
| 8 | Packing list with claim-an-item + realtime | v1.1 |
| 9 | Meal plan with volunteer-to-cook + realtime | v1.1 |
| 10 | Shared photo album with upload + realtime + bulk download | v1.2 |
| 11 | Group message board (comment thread, not chat) | v1.3 |
| 12 | Availability polling (pick-a-weekend) | v1.4 |

### Deferred

| Feature | When | Why deferred |
|---|---|---|
| Expense splitting + settle-up | v2.0 | Coordination + photos is the wedge, not money |
| Recurring Property templates | v2.1 | Property exists in v1.0; templates are a refinement |
| Past trips archive | v2.1 | Needs expenses + photos to be meaningful |
| House manual (appliance guides) | v2.2 | Extension of Property |
| Hearth integration | v3.0 | Clean API surface designed from v1.0, actual integration post-MVP |
| Smart suggestions | v3+ | Needs enough trip data to train patterns |
| Native app | v3+ | PWA first |
| Google/Apple Calendar conflict detection | v2.0 | Requires OAuth |

### Cut

| Feature | Why cut |
|---|---|
| General-purpose expense tracker | Not a Splitwise competitor for non-trip expenses |
| Social network features (feeds, followers, discover) | Not that kind of app |
| Commercial property management | Not for Airbnb hosts |
| Full chat system (typing indicators, read receipts, threads) | Message board is a feature, not a pillar |

---

## 11. Project Structure

**Decision (2026-05-26):** Single Next.js app, not a monorepo. Same decision as Hearth — premature complexity for v0–v1. Package manager is **npm**.

```
roost/
├── app/                           # Next.js App Router
│   ├── (marketing)/              # Public landing, /about, /pricing later
│   ├── (auth)/                   # /login, /auth/callback
│   ├── trip/[token]/             # Token-gated public trip view (no auth required)
│   └── (app)/                    # Logged-in routes (dashboard, manage trip, etc.)
├── components/                    # Roost UI components
│   └── ui/                       # shadcn primitives
├── lib/
│   ├── supabase/                 # server.ts, client.ts, middleware.ts
│   ├── storage/                  # Abstraction layer (Supabase Storage today, R2 later)
│   ├── realtime/                 # use-trip-channel hook, channel helpers
│   ├── trip-access/              # Token validation, grant issuance, C+B logic
│   └── utils.ts                  # cn() helper
├── middleware.ts                  # Session refresh on every request
├── supabase/
│   └── migrations/               # Raw SQL, numbered (0001_init.sql, etc.)
├── branding/                     # Brief + brand kit + logos (not in build)
├── design-system/                # Auto-generated by ui-ux-pro-max (when invoked)
├── docs/
│   └── superpowers/
│       └── specs/                # Design spec lives here
├── .claude/
│   ├── skills/                   # ui-ux-pro-max
│   └── settings.json             # Tool permissions (gitignored)
├── components.json               # shadcn config
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── .env.local.example
├── .env.local                    # gitignored
├── .gitignore
├── .gitattributes                # LF line endings on Windows
└── CLAUDE.md                     # This file
```

**Conventions:**
- App routes use kebab-case folders, `page.tsx` for pages, `route.ts` for handlers
- Client components are colocated with their server parents
- Shared components live in `components/` (with `components/ui/` for shadcn primitives)
- Server-only code never imports from `lib/supabase/client.ts`
- Database changes are SQL migrations in `supabase/migrations/`, numbered
- All photo uploads go through `lib/storage/`, never Supabase Storage directly
- All realtime subscriptions go through `lib/realtime/`, never raw Supabase Realtime calls

---

## 12. Glossary

- **Trip** — the core object. Has dates, a host, guests, an optional Property link, and contains all coordination (packing, meals, photos, messages).
- **Property** — a recurring location someone owns or has access to. Stores persistent info (wifi, address, codes, rules, stocked items). Trips can exist without a Property (one-off rentals). Properties are smart templates; Trips are the source of truth for each stay.
- **User** / **Member** — a logged-in human. Always say "user" or "member" — never "account" — to avoid colliding with Property.
- **Guest** — a User attached to a Trip with `role='guest'`. Also used loosely to mean "someone invited to a trip."
- **Host** — a User attached to a Trip with `role='host'`. Per-trip, not a global account tier.
- **Co-host** — a Trip member with `role='co-host'`. Same permissions as host.
- **Invite** — a per-recipient single-use token emailed to a guest. Contains a link to `/trip/[token]`.
- **Grant** — a `trip_grants` row that records a user's access level (`view` or `sensitive`) for a specific trip. Expires after 30 days by default.
- **Sensitive field** — wifi password, door/gate codes, street address, parking instructions. Stored in `_sensitive_info` sibling tables, gated behind reveal-verification.
- **Reveal** — the act of verifying identity (email-match or PIN) to unlock sensitive fields on a trip page.
- **Property sync** — the one-way copy-on-link mechanism from Property to Trip. Pull-based, never automatic push. Respects per-field overrides.

---

## 13. Living Document Conventions

- Edits happen via PR with a brief note in the commit message.
- Open Decisions (§9) move to `decisions/NN-decision-name.md` once closed. Date stamp them.
- Sections 4 (roadmap) and 10 (feature triage) decay fastest; review at phase boundaries.
- Sycophancy creeping in? Delete it.

---

## 14. Brand Kit Reference (Authoritative)

**Source of truth:** `branding/brand-kit.png` — always consult this image before making visual decisions. The values below are extracted from that file and must not drift.

### 14.1 Color Palette (exact hex values)

| Token | Hex | Tailwind class | Use |
|---|---|---|---|
| Kraft | `#D9C9A8` | `bg-kraft` | Backgrounds, card textures, kraft paper areas |
| Forest | `#2F4A37` | `bg-forest` | Primary buttons, headings, active nav, links |
| Brick | `#A04A32` | `bg-brick` | Stamp badges, accent CTA, alert/error |
| Bone | `#F1EBDC` | `bg-bone` | Page background, card backgrounds (NOT white) |
| Sage | `#A7B49A` | `bg-sage` | Icons in empty states, secondary accents |
| Sand | `#E6D9BF` | `bg-sand` | Secondary backgrounds, role badges, dividers |
| Ink | `#2B2B2B` | `text-ink` | Body text, headings |
| Ink Light | `#5C4F44` | `text-ink-light` | Secondary text, captions, metadata |

**Critical rule:** Cards are `bg-card` (Bone Light `#F7F3E9`), NOT `bg-white`. The page background is `bg-page` (Bone `#F1EBDC`). There is no pure white anywhere in the Roost palette.

### 14.2 Typography

| Role | Font | Fallback Stack | Tailwind |
|---|---|---|---|
| Display | **Söhne Breit / Druk** | Impact, Arial Black, sans-serif | `font-display` |
| Body | **Roslindale / Untitled Serif** | Georgia, Times New Roman, serif | `font-body` |
| Mono accent | **CoFo Sans Mono** | ui-monospace, SF Mono, monospace | `font-mono` |

Display font is a **wide, heavy, condensed sans-serif** — used for headings, hero text, trip names. It is NOT a serif or a decorative script. If the custom font isn't loaded, the fallback should still feel bold and wide (Impact/Arial Black).

### 14.3 Component Tokens

| Token | Value | CSS variable |
|---|---|---|
| Button radius | `18px` | `--radius-button` |
| Card radius | `20px` | `--radius-card` |
| Input radius | `14px` | `--radius-input` |
| Stamp/badge radius | `6px` | `--radius-stamp` |
| Card shadow | `0 6px 18px rgba(47,74,55,.08)` | `--shadow-card` |
| Button shadow | `0 2px 12px rgba(47,74,55,.15)` | `--shadow-button` |
| Card border | `1px solid rgba(47,74,55,.12)` | `--border-subtle` |

### 14.4 Textures & Patterns

The brand has three signature textures (see §6 in brand-kit.png):

1. **Kraft paper texture** — Use CSS class `kraft-bg` for kraft-colored areas (dashboard header, promotional sections). Applied via inline SVG noise filter.
2. **Stamp distress** — Use CSS class `stamp` (or `stamp--forest`, `stamp--kraft` variants) for section labels like "THIS WEEKEND", "TRIP GUIDE". Mono font, uppercase, letter-spacing `.08em`.
3. **Topo line pattern** — Use CSS class `topo-bg` for empty state backgrounds. Subtle sage-colored topographic lines.

### 14.5 Visual Rules (never violate)

- Cards always have a visible border (`border border-subtle` or `border` class)
- Shadows use forest-green tinted rgba, never gray/neutral rgba
- Buttons use `shadow-button` drop shadow for depth
- Section headers on key screens use stamp badge treatment (brick or forest background)
- Empty states use `topo-bg` background + sage icon color
- The dashboard header area uses `kraft-bg` for a warm textured feel
- No pure white (`#FFFFFF`) — warmest white is Bone Light (`#F7F3E9`)
- Primary interactive color is always Forest, never a generic green/blue
