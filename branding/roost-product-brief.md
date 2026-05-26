# Roost — Product Brief

## What it is

Roost is the shared brain for group stays. Whether you're hosting friends at your lake house, renting an Airbnb with 8 people for a bachelor party, or organizing a family reunion at a beach rental — Roost centralizes everything the group needs before, during, and after the trip.

It replaces the chaotic text message thread that currently does this job badly.

## The problem

Group trips today are coordinated across 4–6 fragmented tools:
- Text threads for "what should I bring?"
- A separate text for the wifi password (asked every visit)
- Calendar back-and-forth to find a free weekend
- Splitwise (or worse, a spreadsheet) for expenses
- AirDrop / a shared album for photos
- A Google Doc nobody updates for house rules

Information gets lost. The host re-explains everything to every guest. Nobody knows who's bringing what. Settle-up happens via awkward Venmo requests two weeks later.

## The user

**Primary:** the "organizer" — the person who owns the place OR booked the rental OR is wrangling the group.

**Secondary:** the guests — should be able to participate with zero friction. Ideally no account required to view trip details (magic link / web view), account required only to contribute (upload photos, log expenses).

## Core concepts (data model starting point)

- **User** — a person with an account
- **Property** (optional) — a recurring location someone owns or has access to. Stores persistent info (wifi, address, codes, house rules, what's stocked, local tips). One-off rentals don't need this; trips can exist without a property.
- **Trip** — the core object. Has dates, a host, guests, an optional Property link, and contains all the sub-modules below.
- **Guest** — a User attached to a Trip with a role (host, co-host, guest)
- **Expense** — logged against a Trip, with payer, amount, split rules
- **MealAssignment** — who's cooking which night
- **PackingItem** — assigned to a guest, marked done
- **Photo** — uploaded to a Trip's shared album
- **AvailabilityPoll** — for the "pick a free weekend" feature

## MVP feature set

Ship these in order. Don't build past MVP until the first three are validated.

### 1. Trip creation + info hub
- Create a trip: name, dates (or "TBD — let's pick"), location
- Invite guests via shareable link (no signup required to view)
- Info page: wifi, address, gate codes, parking, house rules, local tips
- If the trip is linked to a saved Property, this auto-fills from the Property record

### 2. Pre-trip coordination
- Packing list — host adds items, guests claim them ("I'll bring the cooler")
- Meal plan — assign cooks to nights, list what's already at the house so guests don't double up on condiments
- Group chat or message board (could be MVP'd as a simple comment thread per trip)

### 3. Expense splitting
- Log an expense: who paid, how much, what for, how to split (equal / custom / by-person)
- Running tally of who owes whom
- "Settle up" view at end of trip with suggested Venmo/Zelle amounts
- This is the Splitwise-killer for this context — keep it scoped to the trip, don't try to be a general expense tracker

### 4. Shared photo album
- Upload photos to the trip
- Everyone on the trip can view + add
- Download all at end of trip

### 5. Availability polling (the "Calendly for friends" piece)
- Host proposes 2–4 candidate weekends
- Guests mark which work
- Host picks the winner, trip dates lock in
- Stretch: integrate with Google/Apple Calendar to auto-detect conflicts

## Post-MVP (the "make it sticky" features)

- **Recurring Property templates** — your lake house remembers its wifi, rules, and house manual across every trip
- **Past trips archive** — "last summer with the Johnsons" with photos, expenses, who came
- **Hearth integration** — pull contacts, sync events, send memories back (see Integration section)
- **Smart suggestions** — "you forgot to assign Saturday breakfast" / "the wifi password hasn't been updated in 2 years"
- **House manual** — appliance instructions, "how to start the boat," check-out checklist

## Hearth integration (post-MVP, but design data model with this in mind)

Roost and Hearth are separate products that share data via opt-in integration. Build Roost standalone first; add integration as a 2.0 feature.

**Integration surface area:**
- **Contacts sync (Hearth → Roost):** import friend/family records with names, dietary restrictions, kids, allergies
- **Property sync (Hearth → Roost):** if a property is stored as a "place" entity in Hearth, Roost can read it when starting a trip there
- **Calendar sync (bidirectional):** a Roost trip auto-creates a Hearth event
- **Memories sync (Roost → Hearth):** trip photos and "last seen" data flow back to Hearth's relationship view
- **Auth:** OAuth flow, user explicitly approves Hearth ↔ Roost connection

**Build the API surface with this in mind from day one** — don't tightly couple internal models. Have a clean public API that Hearth (and eventually third parties) can consume.

## Non-goals (be ruthless about these)

- ❌ Not a booking platform. Not competing with Airbnb/Vrbo.
- ❌ Not a general-purpose expense tracker. Don't try to replace Splitwise for non-trip expenses.
- ❌ Not a social network. No public feeds, no "discover trips," no follower model.
- ❌ Not a property management system. Not for commercial hosts.
- ❌ Not a chat app. Messaging is a feature, not a pillar.

## Tech stack suggestions

(Adjust to your preferences — these are sensible defaults for a solo-dev MVP.)

- **Frontend:** Next.js + TypeScript + Tailwind. Mobile-first design.
- **Backend:** Next.js API routes initially; split to a separate service later if needed.
- **Auth:** Clerk or Auth.js. Magic-link guest access is essential — don't force signups on invitees.
- **DB:** Postgres (Supabase or Neon). Prisma or Drizzle for ORM.
- **File storage:** S3 / R2 / Supabase Storage for photos.
- **Payments / settle-up:** Don't process payments in v1. Just generate "Venmo me $42" links/QR codes.
- **Hosting:** Vercel for app, managed Postgres.
- **Push notifications:** Defer until native app stage. Use email for MVP.

## Design principles

- **Mobile-first.** Trip coordination happens on phones, in cars, at the grocery store.
- **Guest experience requires zero friction.** Magic-link view, no signup to see trip info.
- **Information should never need to be re-entered.** Recurring properties remember everything.
- **Warm, not corporate.** This is friends hosting friends, not enterprise software. Visual language should feel more like a Field Notes notebook than a SaaS dashboard.
- **Default to "everyone can edit."** This is a trust-based product. Permissioning kills the vibe.

## Phase 1 build order (suggested for Claude Code)

1. Auth + user accounts
2. Trip creation + invite via magic link
3. Trip info page (wifi, address, rules) — editable by host, viewable by guests
4. Packing list with claim-an-item flow
5. Expense logging with split + settle-up calculation
6. Photo upload + shared album
7. Meal plan assignments
8. Availability poll
9. Recurring Property templates
10. Past trips archive

Ship 1–3 to your own friends and use it on a real trip before building 4+. Real-world dogfooding will reveal which features actually matter.

## Open questions to resolve before building

- **Pricing model:** Free with paid tier for power hosts (recurring properties, unlimited photo storage)? Or fully free + Hearth-style paid integrations? Decide this before launch, not after.
- **Native app vs PWA:** PWA is faster to ship and good enough for MVP. Native app makes sense if push notifications and camera integration become critical.
- **Naming:** "Roost" is the working name. Check trademark and domain availability before committing. Backup names: Threshold, Stay, Lodge, Mooring.
