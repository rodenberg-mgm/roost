# v0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployable Next.js app with Supabase auth (magic-link), all v1.0 database tables with RLS, a mobile-first PWA shell, and Resend wired for trip invite emails. No trip features yet — just a working skeleton.

**Architecture:** Next.js 15 App Router + TypeScript on Vercel. Supabase Postgres with RLS for trip-scoped multi-tenancy. Supabase Auth with magic-link (no passwords). Tailwind v4 with custom Roost design tokens. Mobile-first PWA with bottom nav.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Auth + Storage), Resend, Vitest, Playwright

**Gate:** Deployable to Vercel, magic-link login works, empty "My Trips" dashboard renders on mobile.

---

## Prerequisites (manual, before Task 1)

1. **Create a Supabase project** at [supabase.com](https://supabase.com). Note the project URL and anon key.
2. **Create a Resend account** at [resend.com](https://resend.com). Note the API key.
3. **Have Node.js 20+** and **npm** installed.

---

## File Map

```
roost/
├── app/
│   ├── layout.tsx                    # Root layout: html, fonts (fallback stack), metadata, PWA meta
│   ├── page.tsx                      # Public landing splash
│   ├── globals.css                   # Tailwind v4 @theme + Roost design tokens
│   ├── manifest.ts                   # PWA web app manifest (Next.js Metadata API)
│   ├── icon.png                      # App icon (copy from branding/)
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.tsx              # Login page shell
│   │   │   └── login-form.tsx        # Client component: email input + magic-link submit
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts          # GET handler: exchange code for session
│   ├── (app)/
│   │   ├── layout.tsx                # Auth guard + bottom nav wrapper
│   │   ├── dashboard/
│   │   │   └── page.tsx              # "My Trips" — empty state for v0
│   │   └── settings/
│   │       └── page.tsx              # Settings placeholder
│   └── trip/
│       └── [token]/
│           └── page.tsx              # Public trip view — placeholder for v0
├── components/
│   ├── ui/                           # shadcn primitives (added via CLI)
│   ├── bottom-nav.tsx                # Mobile bottom navigation bar
│   └── empty-state.tsx               # Reusable empty-state illustration component
├── lib/
│   ├── utils.ts                      # cn() helper (shadcn standard)
│   ├── supabase/
│   │   ├── server.ts                 # createServerClient for RSC / Route Handlers
│   │   ├── client.ts                 # createBrowserClient for Client Components
│   │   └── middleware.ts             # refreshSession helper for middleware.ts
│   ├── storage/
│   │   └── index.ts                  # Storage abstraction interface (Supabase Storage impl)
│   └── email/
│       ├── resend.ts                 # Resend client singleton
│       └── templates/
│           └── trip-invite.tsx       # React Email template for trip invitations
├── middleware.ts                      # Root middleware: session refresh on every request
├── supabase/
│   └── migrations/
│       └── 0001_init.sql             # All tables + RLS policies
├── public/
│   ├── sw.js                         # Service worker shell (cache app shell)
│   └── icons/
│       ├── icon-192.png              # PWA icon 192x192
│       └── icon-512.png              # PWA icon 512x512
├── __tests__/
│   ├── lib/
│   │   ├── utils.test.ts
│   │   └── email/
│   │       └── trip-invite.test.tsx
│   └── components/
│       ├── bottom-nav.test.tsx
│       └── empty-state.test.tsx
├── .env.local.example
├── .env.local                        # gitignored
├── .gitignore
├── .gitattributes
├── components.json                   # shadcn/ui config
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── CLAUDE.md                         # Already exists
└── README.md                         # Minimal — just "how to run"
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `.gitattributes`, `.env.local.example`

- [ ] **Step 1: Create Next.js project**

Run from the `roost/` directory (which already has `branding/`, `CLAUDE.md`, `docs/`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack --yes
```

Note: This will scaffold into the existing directory. It may prompt about existing files — accept defaults. The `--src-dir=false` means app/ lives at root, not src/app/.

- [ ] **Step 2: Verify scaffold runs**

```bash
npm run dev
```

Expected: Dev server starts on `http://localhost:3000`, default Next.js page renders.

- [ ] **Step 3: Clean scaffold defaults**

Delete the default page content and replace `app/page.tsx` with a minimal placeholder:

```tsx
// app/page.tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Roost</h1>
    </main>
  );
}
```

Delete `app/favicon.ico` (we'll use our own icon).

- [ ] **Step 4: Create .gitattributes for LF line endings**

```
# .gitattributes
* text=auto eol=lf
*.{cmd,bat} text eol=crlf
```

- [ ] **Step 5: Create .env.local.example**

```bash
# .env.local.example

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend
RESEND_API_KEY=re_your-api-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 6: Create .env.local with real values**

Copy `.env.local.example` to `.env.local` and fill in the Supabase and Resend credentials from the prerequisites.

- [ ] **Step 7: Update .gitignore**

Ensure `.env.local` is in `.gitignore` (create-next-app should already include it). Also add:

```
# Append to .gitignore
.env.local
.env*.local
design-system/
```

- [ ] **Step 8: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js 15 project with TypeScript and Tailwind"
```

---

## Task 2: Tailwind v4 + Roost Design Tokens

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace globals.css with Roost design tokens**

Tailwind v4 uses CSS-based configuration via `@theme`. Replace the entire `app/globals.css`:

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* === Roost Color Palette (from brand kit) === */
  --color-kraft: #C2B8A3;
  --color-kraft-light: #D4CCBB;
  --color-kraft-dark: #A89E8B;

  --color-fern: #3F6A47;
  --color-fern-light: #5A8A63;
  --color-fern-dark: #2D4E33;

  --color-birch: #A4B08E;
  --color-birch-light: #BCC5AB;
  --color-birch-dark: #8A9A72;

  --color-roost: #917E6C;
  --color-roost-light: #AB9A8A;
  --color-roost-dark: #756453;

  --color-sage: #A4AD8E;
  --color-sage-light: #BCC3AB;
  --color-sage-dark: #8A9572;

  --color-sand: #C8B99A;
  --color-sand-light: #D9CDAF;
  --color-sand-dark: #B0A080;

  --color-ink: #3B3028;
  --color-ink-light: #5C4F44;
  --color-ink-dark: #261E17;

  --color-page: #F5F1EB;
  --color-card: #FFFFFF;
  --color-card-hover: #FAFAF8;

  /* === Typography === */
  --font-display: "Silene Brock", Georgia, "Times New Roman", serif;
  --font-body: "Roslindale", Georgia, "Times New Roman", serif;
  --font-mono: "CoFo Sans Mono", "SF Mono", "Fira Code", "Fira Mono", monospace;
  --font-sans: "Roslindale", Georgia, "Times New Roman", serif;

  /* === Spacing scale extensions === */
  --spacing-18: 4.5rem;
  --spacing-88: 22rem;

  /* === Border radius === */
  --radius-card: 1.5rem;
  --radius-button: 0.75rem;
  --radius-input: 0.5rem;
  --radius-badge: 9999px;

  /* === Shadows === */
  --shadow-card: 0 1px 3px rgba(59, 48, 40, 0.06), 0 1px 2px rgba(59, 48, 40, 0.04);
  --shadow-card-hover: 0 4px 12px rgba(59, 48, 40, 0.08), 0 2px 4px rgba(59, 48, 40, 0.04);

  /* === Transitions === */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}

/* === Base styles === */
@layer base {
  body {
    background-color: var(--color-page);
    color: var(--color-ink);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Tabular nums for any numeric display */
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

- [ ] **Step 2: Update root layout with font and metadata**

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roost — Your Shared Stay, All in One Place",
  description:
    "Roost centralizes everything your group needs for a shared stay: trip details, packing lists, meal plans, photos, and more.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3F6A47",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify tokens work**

Update `app/page.tsx` to use the tokens:

```tsx
// app/page.tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page">
      <div className="rounded-card bg-card p-8 shadow-card">
        <h1 className="font-display text-3xl font-bold text-fern">Roost</h1>
        <p className="mt-2 text-ink-light">
          Your shared stay, all in one place.
        </p>
      </div>
    </main>
  );
}
```

Run `npm run dev` and verify: card renders with Fern green heading, Kraft-ish page background, card shadow. Fonts will be system fallbacks until custom fonts are purchased and added to `public/fonts/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style: add Roost design tokens and Tailwind v4 theme"
```

---

## Task 3: Supabase Client Library

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create server client**

```ts
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  const { createClient: createSupabaseClient } = await import(
    "@supabase/supabase-js"
  );
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 3: Create browser client**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Create middleware helper**

```ts
// lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this is required for Server Components to read
  // an up-to-date session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users trying to access /dashboard or /settings
  const isAppRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/settings");

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 5: Create root middleware**

```ts
// middleware.ts
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sw.js, manifest, icons
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client library and auth middleware"
```

---

## Task 4: shadcn/ui Setup

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/` (via CLI)

- [ ] **Step 1: Install shadcn/ui dependencies**

```bash
npm install class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 2: Create utils.ts**

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 4: Add base shadcn components needed for v0**

```bash
npx shadcn@latest add button input label card
```

- [ ] **Step 5: Verify a component renders**

Update `app/page.tsx` to use a shadcn button:

```tsx
// app/page.tsx
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page">
      <div className="rounded-card bg-card p-8 shadow-card">
        <h1 className="font-display text-3xl font-bold text-fern">Roost</h1>
        <p className="mt-2 mb-4 text-ink-light">
          Your shared stay, all in one place.
        </p>
        <Button className="bg-fern text-white hover:bg-fern-dark">
          Start a Trip
        </Button>
      </div>
    </main>
  );
}
```

Run `npm run dev` and verify the button renders with Fern green background.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui with base components and Roost theming"
```

---

## Task 5: Testing Infrastructure

**Files:**
- Create: `vitest.config.ts`, `__tests__/lib/utils.test.ts`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create vitest config**

```ts
// vitest.config.ts
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to the `"scripts"` section of `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write first test — cn() utility**

```ts
// __tests__/lib/utils.test.ts
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates tailwind conflicts", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add Vitest infrastructure and cn() tests"
```

---

## Task 6: Database Migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

This is the largest single file in v0. It creates all tables needed through v1.2 (packing, meals, photos) with full RLS policies, so v1.0/v1.1/v1.2 can start building features without migration changes.

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0001_init.sql
-- Roost v0: All tables + RLS for trip-scoped multi-tenancy
-- Run in Supabase SQL Editor for v0; wire up Supabase CLI when migrations get frequent.

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- USERS (extends auth.users)
-- ============================================================
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can read any user (for displaying trip member names)
create policy "users_select_all"
  on public.users for select
  using (true);

-- Users can update their own profile
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id);

-- Users can insert their own row (on first login)
create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

-- ============================================================
-- PROPERTIES (recurring locations — non-sensitive fields)
-- ============================================================
create table public.properties (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name          text not null,
  city          text,
  region        text,
  house_rules   text,
  local_tips    text,
  stocked_items jsonb not null default '[]'::jsonb,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

alter table public.properties enable row level security;

-- Only the owner can see/edit their properties
create policy "properties_owner_select"
  on public.properties for select
  using (auth.uid() = owner_user_id and deleted_at is null);

create policy "properties_owner_insert"
  on public.properties for insert
  with check (auth.uid() = owner_user_id);

create policy "properties_owner_update"
  on public.properties for update
  using (auth.uid() = owner_user_id);

-- ============================================================
-- PROPERTY_SENSITIVE_INFO (wifi, codes, address)
-- ============================================================
create table public.property_sensitive_info (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null unique references public.properties(id) on delete cascade,
  wifi_ssid     text,
  wifi_password text,
  door_code     text,
  gate_code     text,
  address_line  text,
  postal_code   text,
  parking_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.property_sensitive_info enable row level security;

-- Only the property owner can see/edit sensitive info
create policy "prop_sensitive_owner_select"
  on public.property_sensitive_info for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.owner_user_id = auth.uid()
    )
  );

create policy "prop_sensitive_owner_insert"
  on public.property_sensitive_info for insert
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.owner_user_id = auth.uid()
    )
  );

create policy "prop_sensitive_owner_update"
  on public.property_sensitive_info for update
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIPS (core object — non-sensitive fields)
-- ============================================================
create table public.trips (
  id                      uuid primary key default gen_random_uuid(),
  host_user_id            uuid not null references public.users(id) on delete cascade,
  property_id             uuid references public.properties(id) on delete set null,
  name                    text not null,
  starts_on               date,
  ends_on                 date,
  city                    text,
  region                  text,
  house_rules             text,
  local_tips              text,
  stocked_items           jsonb not null default '[]'::jsonb,
  require_pin_to_view     boolean not null default false,
  pin_hash                text,
  property_synced_at      timestamptz,
  property_sync_overrides jsonb not null default '{}'::jsonb,
  details                 jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

alter table public.trips enable row level security;

-- Trip members can see the trip
create policy "trips_member_select"
  on public.trips for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = id
        and tm.user_id = auth.uid()
    )
  );

-- Host can update the trip
create policy "trips_host_update"
  on public.trips for update
  using (auth.uid() = host_user_id);

-- Any authenticated user can create a trip (they become the host)
create policy "trips_insert"
  on public.trips for insert
  with check (auth.uid() = host_user_id);

-- ============================================================
-- TRIP_SENSITIVE_INFO (wifi, codes, address — separate RLS)
-- ============================================================
create table public.trip_sensitive_info (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null unique references public.trips(id) on delete cascade,
  wifi_ssid     text,
  wifi_password text,
  door_code     text,
  gate_code     text,
  address_line  text,
  postal_code   text,
  parking_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.trip_sensitive_info enable row level security;

-- Only trip members with sensitive-level grants OR host/co-host can see
create policy "trip_sensitive_member_select"
  on public.trip_sensitive_info for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_sensitive_info.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
    or exists (
      select 1 from public.trip_grants tg
      where tg.trip_id = trip_sensitive_info.trip_id
        and tg.user_id = auth.uid()
        and tg.level = 'sensitive'
        and tg.expires_at > now()
    )
  );

-- Host/co-host can update sensitive info
create policy "trip_sensitive_host_update"
  on public.trip_sensitive_info for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_sensitive_info.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

-- Host can insert (created alongside trip)
create policy "trip_sensitive_insert"
  on public.trip_sensitive_info for insert
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id
        and t.host_user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIP_MEMBERS (who is on a trip + their per-trip role)
-- ============================================================
create table public.trip_members (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  role          text not null check (role in ('host', 'co-host', 'guest')),
  invited_email text,
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (trip_id, user_id)
);

alter table public.trip_members enable row level security;

-- Trip members can see other members of the same trip
create policy "trip_members_select"
  on public.trip_members for select
  using (
    exists (
      select 1 from public.trip_members my
      where my.trip_id = trip_members.trip_id
        and my.user_id = auth.uid()
    )
  );

-- Host/co-host can add members
create policy "trip_members_insert"
  on public.trip_members for insert
  with check (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
    -- OR the user is creating themselves as host of a new trip
    or (auth.uid() = user_id and role = 'host')
  );

-- Host can update member roles
create policy "trip_members_update"
  on public.trip_members for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
        and tm.role = 'host'
    )
  );

-- ============================================================
-- TRIP_INVITES (per-recipient single-use email tokens)
-- ============================================================
create table public.trip_invites (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips(id) on delete cascade,
  email               text not null,
  token               text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at          timestamptz not null default (now() + interval '14 days'),
  consumed_at         timestamptz,
  consumed_by_user_id uuid references public.users(id),
  created_at          timestamptz not null default now()
);

alter table public.trip_invites enable row level security;

-- Host/co-host can see invites for their trips
create policy "trip_invites_host_select"
  on public.trip_invites for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_invites.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

-- Host/co-host can create invites
create policy "trip_invites_host_insert"
  on public.trip_invites for insert
  with check (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_invites.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

-- ============================================================
-- TRIP_GRANTS (verification state for tiered visibility C+B)
-- ============================================================
create table public.trip_grants (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid references public.users(id) on delete cascade,
  level       text not null check (level in ('view', 'sensitive')),
  source      text not null check (source in ('magic-link', 'pin-entry', 'email-verify')),
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days'),
  last_seen_at timestamptz
);

alter table public.trip_grants enable row level security;

-- Users can see their own grants
create policy "trip_grants_own_select"
  on public.trip_grants for select
  using (auth.uid() = user_id);

-- Service role handles insert/update (grant issuance is server-side logic)
-- No insert/update policies for anon/authenticated — all grant mutations
-- go through server actions using the service role client.

-- ============================================================
-- PACKING_ITEMS
-- ============================================================
create table public.packing_items (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips(id) on delete cascade,
  title               text not null,
  quantity            text,
  notes               text,
  claimed_by_user_id  uuid references public.users(id),
  claimed_at          timestamptz,
  is_completed        boolean not null default false,
  created_by_user_id  uuid not null references public.users(id),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.packing_items enable row level security;

-- Trip members can see packing items
create policy "packing_items_member_select"
  on public.packing_items for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = packing_items.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- Trip members can add packing items
create policy "packing_items_member_insert"
  on public.packing_items for insert
  with check (
    auth.uid() = created_by_user_id
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = packing_items.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- Trip members can claim/unclaim and mark completed
create policy "packing_items_member_update"
  on public.packing_items for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = packing_items.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- Host can delete packing items
create policy "packing_items_host_delete"
  on public.packing_items for delete
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = packing_items.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

-- ============================================================
-- MEAL_SLOTS
-- ============================================================
create table public.meal_slots (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  day_date      date not null,
  meal_type     text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'other')),
  title         text,
  cook_user_id  uuid references public.users(id),
  menu          text,
  notes         text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.meal_slots enable row level security;

-- Trip members can see meal slots
create policy "meal_slots_member_select"
  on public.meal_slots for select
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = meal_slots.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- Host/co-host can create meal slots
create policy "meal_slots_host_insert"
  on public.meal_slots for insert
  with check (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = meal_slots.trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('host', 'co-host')
    )
  );

-- Trip members can update (volunteer to cook, add menu)
create policy "meal_slots_member_update"
  on public.meal_slots for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = meal_slots.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- PHOTOS
-- ============================================================
create table public.photos (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips(id) on delete cascade,
  storage_path        text not null,
  uploaded_by_user_id uuid not null references public.users(id),
  caption             text,
  taken_at            timestamptz,
  mime_type           text not null,
  width               integer,
  height              integer,
  file_size_bytes     bigint not null,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

alter table public.photos enable row level security;

-- Trip members can see photos (not soft-deleted)
create policy "photos_member_select"
  on public.photos for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = photos.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- Trip members can upload photos
create policy "photos_member_insert"
  on public.photos for insert
  with check (
    auth.uid() = uploaded_by_user_id
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = photos.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- Uploader can soft-delete own photos; host can soft-delete any
create policy "photos_delete"
  on public.photos for update
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = photos.trip_id
        and tm.user_id = auth.uid()
        and (
          auth.uid() = photos.uploaded_by_user_id
          or tm.role in ('host', 'co-host')
        )
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGER (reusable)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.property_sensitive_info
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.trip_sensitive_info
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.packing_items
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.meal_slots
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- REALTIME (enable for tables that need live updates)
-- ============================================================
alter publication supabase_realtime add table public.packing_items;
alter publication supabase_realtime add table public.meal_slots;
alter publication supabase_realtime add table public.photos;
alter publication supabase_realtime add table public.trip_members;
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

Go to your Supabase project dashboard → SQL Editor → paste the migration → Run.

Expected: All tables created, RLS enabled, triggers installed. No errors.

- [ ] **Step 3: Verify tables exist**

In Supabase dashboard → Table Editor, confirm these tables exist:
`users`, `properties`, `property_sensitive_info`, `trips`, `trip_sensitive_info`, `trip_members`, `trip_invites`, `trip_grants`, `packing_items`, `meal_slots`, `photos`

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database migration with all v1.0 tables and RLS policies"
```

---

## Task 7: Login Page (Magic Link)

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/login/login-form.tsx`

- [ ] **Step 1: Create login page (server component)**

```tsx
// app/(auth)/login/page.tsx
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold text-fern">Roost</h1>
          <p className="mt-2 text-ink-light">
            Sign in to manage your trips
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create login form (client component)**

```tsx
// app/(auth)/login/login-form.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-card bg-card p-6 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-fern/10">
          <Mail className="h-6 w-6 text-fern" />
        </div>
        <h2 className="text-lg font-semibold text-ink">Check your email</h2>
        <p className="mt-2 text-sm text-ink-light">
          We sent a magic link to <strong>{email}</strong>. Click it to sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-card p-6 shadow-card">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Button
          type="submit"
          className="w-full bg-fern text-white hover:bg-fern-dark"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send magic link"
          )}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Verify login page renders**

Run `npm run dev`, navigate to `http://localhost:3000/login`.

Expected: Roost logo, email input, "Send magic link" button. Submitting with a real email should send a magic-link email (if Supabase email is configured).

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/
git commit -m "feat: add magic-link login page"
```

---

## Task 8: Auth Callback Route

**Files:**
- Create: `app/(auth)/auth/callback/route.ts`

- [ ] **Step 1: Create the callback handler**

```ts
// app/(auth)/auth/callback/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code exchange fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

- [ ] **Step 2: Verify the full auth flow**

1. Go to `/login`
2. Enter your email
3. Click "Send magic link"
4. Check email, click the link
5. Should redirect to `/dashboard` (which will 404 for now — that's fine, we just need the redirect to work)

If Supabase email isn't configured yet, you can test with the Supabase Auth dashboard → Users → manually create a session.

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/auth/
git commit -m "feat: add auth callback route for magic-link code exchange"
```

---

## Task 9: Bottom Nav Component

**Files:**
- Create: `components/bottom-nav.tsx`
- Test: `__tests__/components/bottom-nav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/bottom-nav.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { BottomNav } from "@/components/bottom-nav";

describe("BottomNav", () => {
  it("renders My Trips and Settings links", () => {
    render(<BottomNav />);
    expect(screen.getByText("My Trips")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("highlights the active route", () => {
    render(<BottomNav />);
    const myTrips = screen.getByText("My Trips").closest("a");
    expect(myTrips?.className).toContain("text-fern");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/components/bottom-nav.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement BottomNav**

```tsx
// components/bottom-nav.tsx
"use client";

import { cn } from "@/lib/utils";
import { Map, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "My Trips", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sand bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                isActive ? "text-fern" : "text-ink-light"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run __tests__/components/bottom-nav.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/bottom-nav.tsx __tests__/components/bottom-nav.test.tsx
git commit -m "feat: add mobile bottom navigation component"
```

---

## Task 10: Empty State Component

**Files:**
- Create: `components/empty-state.tsx`
- Test: `__tests__/components/empty-state.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/empty-state.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/empty-state";
import { Map } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={Map}
        title="No trips yet"
        description="Start planning your next adventure."
      />
    );
    expect(screen.getByText("No trips yet")).toBeDefined();
    expect(screen.getByText("Start planning your next adventure.")).toBeDefined();
  });

  it("renders optional action button", () => {
    render(
      <EmptyState
        icon={Map}
        title="No trips yet"
        description="Start planning."
        action={{ label: "Start a Trip", href: "/trips/new" }}
      />
    );
    expect(screen.getByText("Start a Trip")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/components/empty-state.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement EmptyState**

```tsx
// components/empty-state.tsx
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sand/50">
        <Icon className="h-8 w-8 text-roost" />
      </div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-ink-light">{description}</p>
      {action && (
        <Button asChild className="mt-6 bg-fern text-white hover:bg-fern-dark">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run __tests__/components/empty-state.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/empty-state.tsx __tests__/components/empty-state.test.tsx
git commit -m "feat: add reusable empty-state component"
```

---

## Task 11: Authenticated Layout + Dashboard + Settings

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/settings/page.tsx`

- [ ] **Step 1: Create the authenticated layout**

```tsx
// app/(app)/layout.tsx
import { BottomNav } from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-page pb-20">
      <main className="mx-auto max-w-lg px-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Create the dashboard page (empty state)**

```tsx
// app/(app)/dashboard/page.tsx
import { EmptyState } from "@/components/empty-state";
import { Map } from "lucide-react";

export default function DashboardPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">My Trips</h1>
      </header>
      <EmptyState
        icon={Map}
        title="No trips yet"
        description="Start planning your next group stay, or join one with an invite link."
        action={{ label: "Start a Trip", href: "/trips/new" }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the settings page (placeholder)**

```tsx
// app/(app)/settings/page.tsx
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>
      </header>
      <div className="rounded-card bg-card p-4 shadow-card">
        <p className="text-sm text-ink-light">
          Signed in as <strong>{user?.email}</strong>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the full flow**

1. Run `npm run dev`
2. Go to `/login`, sign in with magic link
3. Should redirect to `/dashboard` — see "My Trips" heading + empty state
4. Tap "Settings" in bottom nav — see email display
5. Tap "My Trips" — back to dashboard
6. Bottom nav should highlight the active tab

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/
git commit -m "feat: add authenticated layout with dashboard and settings pages"
```

---

## Task 12: PWA Manifest + Service Worker

**Files:**
- Create: `app/manifest.ts`, `public/sw.js`

- [ ] **Step 1: Create PWA manifest**

```ts
// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Roost — Your Shared Stay",
    short_name: "Roost",
    description:
      "The shared brain for group stays. Trip details, packing, meals, photos — all in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F5F1EB",
    theme_color: "#3F6A47",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
```

- [ ] **Step 2: Create service worker shell**

```js
// public/sw.js
const CACHE_NAME = "roost-shell-v1";
const SHELL_URLS = ["/dashboard", "/settings"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first for navigation, cache-first for static assets
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
```

- [ ] **Step 3: Register service worker in root layout**

Add a script to register the SW. Update `app/layout.tsx`:

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roost — Your Shared Stay, All in One Place",
  description:
    "Roost centralizes everything your group needs for a shared stay: trip details, packing lists, meal plans, photos, and more.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3F6A47",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page text-ink antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create placeholder PWA icons**

For now, copy the Roost logo as placeholder icons. These will be replaced with properly sized versions from the brand kit.

```bash
mkdir -p public/icons
# Create placeholder icons from the logo (resize manually or use an online tool)
# For now, copy any square PNG as a placeholder:
cp branding/logo.png public/icons/icon-512.png
cp branding/logo.png public/icons/icon-192.png
```

- [ ] **Step 5: Verify PWA**

1. Run `npm run dev`
2. Open DevTools → Application → Manifest: should show "Roost" with theme color
3. Application → Service Workers: should show `sw.js` registered
4. On mobile Chrome: should see "Add to Home Screen" prompt (or manually add via browser menu)

- [ ] **Step 6: Commit**

```bash
git add app/manifest.ts public/sw.js public/icons/ app/layout.tsx
git commit -m "feat: add PWA manifest, service worker, and app icons"
```

---

## Task 13: Storage Abstraction Layer

**Files:**
- Create: `lib/storage/index.ts`

- [ ] **Step 1: Create the storage interface and Supabase implementation**

```ts
// lib/storage/index.ts
import { createClient } from "@/lib/supabase/server";

export interface StorageFile {
  path: string;
  signedUrl: string;
}

const BUCKET = "trip-photos";

/**
 * Upload a file to storage.
 * All photo uploads MUST go through this interface — never call
 * Supabase Storage directly from components.
 */
export async function put(
  tripId: string,
  fileName: string,
  file: Buffer | Blob,
  contentType: string
): Promise<string> {
  const supabase = await createClient();
  const path = `trips/${tripId}/photos/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return path;
}

/**
 * Generate a signed URL for a stored file.
 * Expires in 1 hour by default.
 */
export async function signedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);

  return data.signedUrl;
}

/**
 * Delete a file from storage.
 */
export async function remove(path: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
```

- [ ] **Step 2: Create the storage bucket in Supabase**

Go to Supabase dashboard → Storage → Create bucket:
- Name: `trip-photos`
- Public: **No** (private — all access via signed URLs)
- File size limit: 10MB
- Allowed MIME types: `image/jpeg, image/png, image/webp, image/heic`

- [ ] **Step 3: Commit**

```bash
git add lib/storage/
git commit -m "feat: add storage abstraction layer over Supabase Storage"
```

---

## Task 14: Resend Email Setup + Trip Invite Template

**Files:**
- Create: `lib/email/resend.ts`, `lib/email/templates/trip-invite.tsx`
- Test: `__tests__/lib/email/trip-invite.test.tsx`

- [ ] **Step 1: Install dependencies**

```bash
npm install resend @react-email/components
```

- [ ] **Step 2: Create Resend client**

```ts
// lib/email/resend.ts
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
```

- [ ] **Step 3: Write the failing test for the invite template**

```tsx
// __tests__/lib/email/trip-invite.test.tsx
import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";
import { TripInviteEmail } from "@/lib/email/templates/trip-invite";

describe("TripInviteEmail", () => {
  it("renders the trip name", async () => {
    const html = await render(
      <TripInviteEmail
        tripName="Sonoma Weekend"
        hostName="Matt"
        tripDates="May 16 – May 18, 2025"
        viewUrl="https://roost.app/trip/abc123"
      />
    );
    expect(html).toContain("Sonoma Weekend");
  });

  it("renders the host name", async () => {
    const html = await render(
      <TripInviteEmail
        tripName="Sonoma Weekend"
        hostName="Matt"
        tripDates="May 16 – May 18, 2025"
        viewUrl="https://roost.app/trip/abc123"
      />
    );
    expect(html).toContain("Matt");
  });

  it("renders the view trip URL", async () => {
    const html = await render(
      <TripInviteEmail
        tripName="Sonoma Weekend"
        hostName="Matt"
        tripDates="May 16 – May 18, 2025"
        viewUrl="https://roost.app/trip/abc123"
      />
    );
    expect(html).toContain("https://roost.app/trip/abc123");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/email/trip-invite.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create the trip invite email template**

```tsx
// lib/email/templates/trip-invite.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface TripInviteEmailProps {
  tripName: string;
  hostName: string;
  tripDates: string;
  viewUrl: string;
}

export function TripInviteEmail({
  tripName,
  hostName,
  tripDates,
  viewUrl,
}: TripInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {hostName} invited you to {tripName}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>You&apos;re invited to {tripName}</Heading>
          <Text style={text}>
            <strong>{hostName}</strong> has invited you to a trip on Roost.
          </Text>
          <Section style={detailsBox}>
            <Text style={detailsText}>
              <strong>Trip:</strong> {tripName}
            </Text>
            <Text style={detailsText}>
              <strong>When:</strong> {tripDates}
            </Text>
          </Section>
          <Section style={buttonSection}>
            <Button style={button} href={viewUrl}>
              View Your Trip
            </Button>
          </Section>
          <Text style={footerText}>
            You can view trip details, see the packing list, and more — no
            account needed. Create an account when you&apos;re ready to claim items
            or upload photos.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Inline styles (React Email doesn't support Tailwind in emails reliably)
const body = {
  backgroundColor: "#F5F1EB",
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const container = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "480px",
};

const heading = {
  color: "#3F6A47",
  fontSize: "24px",
  fontWeight: "bold" as const,
  marginBottom: "16px",
};

const text = {
  color: "#3B3028",
  fontSize: "16px",
  lineHeight: "24px",
};

const detailsBox = {
  backgroundColor: "#FFFFFF",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "24px 0",
};

const detailsText = {
  color: "#3B3028",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "4px 0",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#3F6A47",
  borderRadius: "8px",
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "12px 32px",
  textDecoration: "none",
};

const footerText = {
  color: "#5C4F44",
  fontSize: "13px",
  lineHeight: "20px",
  marginTop: "24px",
};
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run __tests__/lib/email/trip-invite.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/email/ __tests__/lib/email/
git commit -m "feat: add Resend client and trip invite email template"
```

---

## Task 15: Landing Page + Trip View Placeholder

**Files:**
- Create: `app/page.tsx` (replace existing), `app/trip/[token]/page.tsx`

- [ ] **Step 1: Create the public landing page**

```tsx
// app/page.tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-5xl font-bold text-fern">Roost</h1>
        <p className="mt-3 text-lg text-ink-light">
          Your shared stay, all in one place.
        </p>
        <p className="mt-6 text-sm text-ink-light">
          Trip details, packing lists, meal plans, photos, and
          more&thinsp;&mdash;&thinsp;so your group chat can go back to being
          fun.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="bg-fern text-white hover:bg-fern-dark">
            <Link href="/login">Get Started</Link>
          </Button>
          <Button asChild variant="outline" className="border-sand text-ink hover:bg-sand/20">
            <Link href="/login">Join with invite link</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create trip view placeholder**

This route will be fully implemented in v1.0. For now, it validates the URL shape and shows a placeholder.

```tsx
// app/trip/[token]/page.tsx
interface TripViewProps {
  params: Promise<{ token: string }>;
}

export default async function TripViewPage({ params }: TripViewProps) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl font-bold text-fern">Roost</h1>
        <p className="mt-2 text-ink-light">
          Trip view coming soon.
        </p>
        <p className="mt-4 font-mono text-xs text-ink-light/50">
          Token: {token.slice(0, 8)}...
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify both pages**

1. `http://localhost:3000` — landing page with "Get Started" and "Join with invite link" buttons
2. `http://localhost:3000/trip/abc123` — placeholder with truncated token

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/trip/
git commit -m "feat: add landing page and trip view placeholder"
```

---

## Task 16: Final Verification + Deploy

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass (cn utility, bottom nav, empty state, trip invite email).

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Note any warnings and fix if critical.

- [ ] **Step 3: Test the full flow locally**

1. `npm run dev`
2. Visit `/` — see landing page
3. Click "Get Started" — go to `/login`
4. Enter email, click "Send magic link"
5. Click link in email (or manually create session in Supabase)
6. Redirected to `/dashboard` — see empty state with bottom nav
7. Tap "Settings" — see email
8. Visit `/trip/anything` — see placeholder
9. Check DevTools → Application → Manifest + Service Worker

- [ ] **Step 4: Deploy to Vercel**

```bash
# If not already connected:
npx vercel link
# Deploy:
npx vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL` (set to your Vercel domain)

Update Supabase Auth settings:
- Add your Vercel domain to "Redirect URLs" in Authentication → URL Configuration

- [ ] **Step 5: Verify production deployment**

Visit the Vercel URL. Repeat the flow from Step 3 on the live site.

- [ ] **Step 6: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore: final v0 fixups and deploy configuration"
```

---

## v0 Gate Checklist

After Task 16, verify all of these:

- [ ] App deploys to Vercel without errors
- [ ] Magic-link login works end-to-end (send email → click → authenticated)
- [ ] Dashboard shows empty state with bottom nav on mobile
- [ ] Settings shows the logged-in user's email
- [ ] Bottom nav highlights the active route
- [ ] `/trip/[token]` route renders the placeholder
- [ ] PWA manifest is served at `/manifest.webmanifest`
- [ ] Service worker registers
- [ ] All database tables exist with RLS enabled
- [ ] `trip-photos` storage bucket exists (private)
- [ ] All tests pass
- [ ] Build succeeds

**When all gates pass: v0 is done. Next plan: v1.0 — Trip creation + info hub.**
