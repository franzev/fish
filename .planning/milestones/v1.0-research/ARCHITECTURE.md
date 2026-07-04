# Architecture Research

**Domain:** Supabase-auth + role-based Next.js App Router web app, with a dual-theme CSS-first token system (Tailwind v4)
**Researched:** 2026-07-02
**Confidence:** HIGH (auth/middleware patterns verified via Context7 `/supabase/ssr` + official Supabase docs; Tailwind v4 theming verified via official docs + Tailwind team discussion thread)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │ Server        │  │ Client Components │  │ Inline theme script   │  │
│  │ Components    │  │ (forms, "use      │  │ (sync, in <head>,     │  │
│  │ (RSC, reads)  │  │  client")         │  │ sets data-theme       │  │
│  └──────┬───────┘  └────────┬──────────┘  │ before first paint)   │  │
│         │                    │             └───────────────────────┘  │
└─────────┼────────────────────┼──────────────────────────────────────┘
          │ cookies (sb-*)      │ createBrowserClient
          ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js Middleware (proxy layer)                  │
│  createServerClient(cookies) → supabase.auth.getClaims()/getUser()  │
│  Refreshes token → writes to request + response cookies              │
│  Redirects: signed-out → /login · role mismatch → role home          │
└─────────┬──────────────────────────────────────────────────────────┘
          │ verified session forwarded via cookies
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Next.js App Router — Server + Client                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────────────┐ │
│  │ layout.tsx  │ │ (client)/  │ │ (coach)/   │ │ Route Handlers /   │ │
│  │ role-aware  │ │ group      │ │ group      │ │ Server Actions     │ │
│  │ shell       │ │ (client    │ │ (coach     │ │ (mutations calling │ │
│  │             │ │ landing)   │ │ landing)   │ │ Edge Fns)          │ │
│  └────────────┘ └────────────┘ └────────────┘ └───────────────────┘ │
└─────────┬──────────────────────────────────────────────────────────┘
          │ supabase-js (RLS-scoped reads) / fetch (Edge Function writes)
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Supabase Backend                            │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────────────────────┐  │
│  │ auth.users │ │ profiles     │ │ coach_clients (relationship)   │  │
│  │ (managed)  │ │ (public,RLS) │ │ (public, RLS)                  │  │
│  └────────────┘ └──────────────┘ └───────────────────────────────┘  │
│  RLS policies use auth.uid() + SECURITY DEFINER helper fns           │
│  Edge Functions: command writes (send-message, assign-client)        │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Browser Supabase client | Client Component reads/writes, auth form submission (signInWithPassword, signUp, signOut) | `createBrowserClient` from `@supabase/ssr`, instantiated once per module, memoized |
| Server Supabase client | Server Component / Route Handler / Server Action reads, cookie-bound per request | `createServerClient` from `@supabase/ssr` with `cookies()` from `next/headers`; new instance **per request** (never a shared singleton) |
| Middleware | Token refresh, session validation, route protection, role-based redirect | `middleware.ts` at project root; calls `createServerClient`, then `getUser()` or `getClaims()`, writes refreshed cookies to both request and response |
| `profiles` table | Source of truth for role + display data, joined 1:1 with `auth.users` | Postgres table, `id uuid references auth.users(id)`, populated via trigger on `auth.users` insert |
| `coach_clients` table | Coach↔client relationship (who is assigned to whom) | Postgres table with `coach_id`, `client_id`, both FK to `profiles.id`; RLS scopes rows to the two parties |
| RLS policies + helper functions | Enforce "clients see own data, coaches see assigned clients' data" at the database layer, independent of app code | `SECURITY DEFINER` SQL functions (e.g. `is_coach_of(client_id)`) referenced inside policies to avoid recursive RLS lookups |
| Edge Functions | Command-style writes needing validation/side effects beyond RLS's reach (send message, assign client, moderation) | Deno functions in `supabase/functions/*`, invoked via `supabase.functions.invoke()` from server or client, `verify_jwt = true` |
| Theme token layer | Single source of truth for color/spacing/radius primitives, resolved per active theme without JS-driven restyle | Tailwind v4 `@theme inline` block mapping semantic tokens to CSS custom properties, overridden per `[data-theme]` selector |
| Theme bootstrap script | Sets `data-theme` on `<html>` before paint, reading cookie/localStorage preference, preventing flash | Inline synchronous `<script>` in root layout `<head>`, no external file |

## Recommended Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx                 # Root layout: fonts, theme bootstrap script, <html data-theme>
│   ├── globals.css                # @theme inline block + @layer theme (light/dark token overrides)
│   ├── (auth)/                    # Route group: unauthenticated flows
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── verify-email/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (client)/                  # Route group: client-role screens
│   │   ├── layout.tsx             # Client shell (nav, chrome) — assumes role already verified by middleware
│   │   └── page.tsx                # Client home/landing
│   ├── (coach)/                   # Route group: coach-role screens
│   │   ├── layout.tsx             # Coach shell
│   │   └── page.tsx                # Coach home — assigned clients list
│   ├── auth/
│   │   └── callback/route.ts      # Route Handler for email confirmation / OAuth callback exchange
│   └── kit/page.tsx                # UI kit demo page (every component, every state, both themes)
├── components/
│   ├── ui/                        # Button, Input, Card, Progress, + new primitives this milestone
│   └── shell/                     # AppShell, Nav, EmptyState (layout chrome, not form controls)
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createBrowserClient wrapper (Client Components)
│   │   ├── server.ts               # createServerClient wrapper (Server Components/Actions)
│   │   └── middleware.ts           # updateSession() helper used by middleware.ts
│   ├── theme.ts                    # getThemePreference()/theme cookie helpers (server-readable)
│   └── utils.ts                    # cn() — existing
├── middleware.ts                   # Root-level; calls lib/supabase/middleware.ts, applies redirects
└── ...
packages/
├── core/src/roles.ts                # UserRole — existing, unchanged
├── core/src/profile.ts              # NEW: Profile domain type (id, role, displayName)
├── core/src/coach-client.ts         # NEW: CoachClientRelationship domain type
├── tokens/                          # NEW (optional but recommended): platform-agnostic token source
│   └── src/tokens.json              # Semantic token values (light/dark) as plain data
└── supabase/src/
    ├── auth.ts                      # FishAuthClaims, authRedirects — existing
    └── database.types.ts            # Generated via `supabase gen types typescript`
supabase/
├── migrations/
│   ├── 0001_profiles.sql            # profiles table + trigger from auth.users
│   ├── 0002_coach_clients.sql       # relationship table
│   └── 0003_rls_policies.sql        # RLS + SECURITY DEFINER helper functions
└── functions/
    └── send-message/index.ts        # existing stub
```

### Structure Rationale

- **`lib/supabase/{client,server,middleware}.ts`:** This three-file split is the pattern Supabase's own docs and the `@supabase/ssr` package are built around — browser and server clients have different cookie-handling contracts (`document.cookie` vs `next/headers` `cookies()`), and mixing them causes session desync. Keeping them in `apps/web/lib/supabase/` (not `packages/supabase`) is correct because `createBrowserClient`/`createServerClient` are Next.js-runtime-bound (they need `next/headers`, `next/server`); `packages/supabase` stays framework-agnostic (types, redirect constants, claims shape) so it can eventually be imported by other runtimes (Edge Functions, future native bridges) without pulling in Next.js.
- **Route groups `(auth)`, `(client)`, `(coach)`:** Express role-based layout boundaries structurally. Each group's `layout.tsx` renders the correct shell without runtime role branching inside a single shared layout — this is how Next.js App Router idiomatically encodes "different chrome for different roles" and keeps the "assigned never chosen" rule enforceable at the routing layer, not just in a conditional.
- **`middleware.ts` at project root, thin, delegating to `lib/supabase/middleware.ts`:** Supabase's official Next.js guide structures it this way specifically so the cookie-refresh logic (verbose, easy to get wrong) is testable/reusable, while `middleware.ts` itself stays a short matcher + redirect decision.
- **`packages/tokens` (new, optional):** Given the explicit milestone requirement "token pipeline formalized so native iOS/Android can mirror tokens later," a plain-data token source (JSON) that both the CSS `@theme` layer and a future Swift/Kotlin generation script can read from is the standard cross-platform design-token pattern (same approach as Style Dictionary). This milestone doesn't need to build the generator, but placing raw token values in `packages/tokens/src/tokens.json` now — with `globals.css` treated as *generated from* or *hand-synced with* that source — avoids a rewrite when native starts. If this is too heavy for this milestone, at minimum keep the token *values* isolated in one clearly-delimited CSS block so they're easy to extract later.
- **`packages/core/src/profile.ts`, `coach-client.ts`:** Mirrors the existing pattern (`roles.ts`, `chat.ts`) — domain shapes with no implementation, consumed by both `apps/web` and any future Edge Function that needs to reason about coach-client pairs (e.g., assign-client, moderation).

## Architectural Patterns

### Pattern 1: Three-client Supabase setup (browser / server / middleware)

**What:** Separate `createBrowserClient` and `createServerClient` instances, each with cookie handling appropriate to their execution context, plus a middleware-specific wrapper that refreshes tokens and forwards cookies to both the outgoing request (so Server Components see the fresh session) and the response (so the browser gets the new cookie).

**When to use:** Any Next.js App Router app using Supabase Auth with SSR. This is not optional — using only the browser client breaks Server Components (no session), and skipping middleware causes silent session expiry after the JWT's short lifetime.

**Trade-offs:** More boilerplate than a single client, but it's the only supported pattern for SSR + Supabase since the `@supabase/auth-helpers-nextjs` package was deprecated in favor of `@supabase/ssr`. Do not attempt to hand-roll cookie handling — the `getAll`/`setAll` contract is easy to get subtly wrong (e.g., forgetting to write to both request and response cookies causes a one-request-behind session).

**Example (middleware):**
```typescript
// apps/web/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser()/getClaims() — never getSession() for authorization decisions
  const { data: { user } } = await supabase.auth.getUser()

  return { response, user }
}
```

### Pattern 2: Middleware-level route protection + role redirect, layout-level UI assumption

**What:** `middleware.ts` is the single place that decides "is this request allowed to reach this route" and issues redirects (signed-out → `/login`; client hitting a `/coach` route → client home; coach hitting a `/client` route → coach home). Layouts and pages inside `(client)`/`(coach)` route groups do **not** re-check auth — they assume middleware already gated access and can read the already-verified user/profile via a server-side helper for display purposes only.

**When to use:** Always, for this kind of role-split app. Middleware runs on the Edge before any rendering, so it's the cheapest and earliest point to block unauthorized access — and centralizing the redirect logic in one file avoids the classic bug where 8 different pages each implement a slightly different "if not logged in, redirect" check.

**Trade-offs:** Middleware can't easily do a full-fidelity role lookup if role lives only in a database table (an extra query per request) — this pushes toward storing role in JWT `app_metadata` (see Pattern 3) so middleware can decide from the JWT alone without hitting Postgres on every request. If role must come from `profiles`, cache the decision in a short-lived cookie set right after login/signup rather than querying on every middleware pass.

**Example (middleware.ts):**
```typescript
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const path = request.nextUrl.pathname

  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup')
  const isCoachRoute = path.startsWith('/coach')
  const isClientRoute = !isAuthRoute && !isCoachRoute

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user) {
    const role = user.app_metadata?.role // see Pattern 3
    if (isAuthRoute) {
      return NextResponse.redirect(new URL(role === 'coach' ? '/coach' : '/', request.url))
    }
    if (isCoachRoute && role !== 'coach') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    if (isClientRoute && role === 'coach') {
      return NextResponse.redirect(new URL('/coach', request.url))
    }
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg)$).*)'],
}
```

### Pattern 3: Role stored in `profiles` table AND mirrored to `app_metadata` via trigger

**What:** `profiles.role` is the source of truth (queryable, joinable, editable by admin tooling), but a Postgres trigger (or a Custom Access Token Auth Hook) copies the role into the user's `auth.users.raw_app_meta_data` so it rides along inside the JWT as `app_metadata.role`. RLS policies and middleware read the JWT claim (cheap, no DB round-trip); anything needing to *change* role or query relationally uses the `profiles` table.

**When to use:** This is the recommended pattern specifically because role rarely changes for a given user, changing it is an intentional admin act (matches "coach accounts are seed-only" constraint), and reading role from `app_metadata` in RLS/middleware avoids a query-per-request. Using `raw_user_meta_data` instead is a common mistake — that field is client-editable and must never be trusted for authorization.

**Trade-offs:** JWTs are not always fresh — if role changes, the change won't appear in `app.jwt()`/`app_metadata` claims until the user's token refreshes (next sign-in, or up to the token's expiry window). For this project (coach role is a rare, manual, seed-time act) this staleness window is a non-issue. If role changes needed to take effect instantly, you'd force a session refresh after the admin action.

**Example (RLS + helper function avoiding recursion):**
```sql
-- profiles table, 1:1 with auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'coach')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: user can read own row"
  on public.profiles for select
  using (id = auth.uid());

-- SECURITY DEFINER breaks RLS recursion when coach_clients policy needs to check profiles
create or replace function public.is_coach_of(target_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid() and client_id = target_client_id
  );
$$;

create table public.coach_clients (
  coach_id uuid not null references public.profiles(id),
  client_id uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (coach_id, client_id)
);

alter table public.coach_clients enable row level security;

create policy "coach_clients: coach reads own assignments"
  on public.coach_clients for select
  using (coach_id = auth.uid());

create policy "profiles: coach reads assigned clients"
  on public.profiles for select
  using (public.is_coach_of(id));
```

### Pattern 4: Two-layer CSS token indirection for dual theme, no-flash SSR

**What:** Tailwind v4's `@theme inline` block declares semantic utility-generating tokens (`--color-surface`, `--color-primary`, etc.) that point at plain CSS custom properties (`var(--surface)`). Those underlying custom properties are then defined once for `:root` (default/light) and redefined inside a `[data-theme="dark"]` selector block. Utilities like `bg-surface` compile once and resolve differently per active `data-theme` — no JS-driven re-render, no duplicate utility classes, no `dark:` variant sprinkled through every component.

**When to use:** Any Tailwind v4 project needing more than a binary light/dark toggle, or wanting the token layer to be swappable independent of component markup — exactly this project's "light and dark monochrome themes from day one" + "token pipeline for native" requirements.

**Trade-offs:** Slightly more indirection to read (`@theme inline` → `var(--surface)` → per-selector override) than the older `dark:` variant per-utility approach, but it's the only way to add a third or fourth theme later without touching component code, and it maps cleanly onto a token-export pipeline (the `:root`/`[data-theme]` blocks are just data).

**Example:**
```css
/* apps/web/app/globals.css */
@import "tailwindcss";

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-foreground: var(--foreground);
  --color-body: var(--body);
  --color-muted: var(--muted);
  --radius-card: var(--radius-card-value);
}

@layer theme {
  :root {
    --bg: oklch(0.99 0 0);
    --surface: oklch(0.96 0 0);
    --foreground: oklch(0.15 0 0);
    --body: oklch(0.4 0 0);
    --muted: oklch(0.6 0 0);
    --radius-card-value: 16px;
  }

  [data-theme="dark"] {
    --bg: oklch(0.12 0 0);
    --surface: oklch(0.18 0 0);
    --foreground: oklch(0.98 0 0);
    --body: oklch(0.75 0 0);
    --muted: oklch(0.55 0 0);
  }
}
```

```tsx
// apps/web/app/layout.tsx — inline script MUST run synchronously before paint
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var stored = localStorage.getItem('fish-theme');
                var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

**Note on true no-flash under SSR:** The inline script above prevents flash for client-side navigation and repeat visits (reads `localStorage` before paint). For zero-flash on the *very first* server-rendered response too, read the theme preference from a cookie (not just `localStorage`) in the root Server Component and set `data-theme` server-side as the initial attribute — then the inline script only needs to reconcile if `localStorage` disagrees with the cookie (e.g., user changed OS preference). `suppressHydrationWarning` on `<html>` is required either way since the attribute is set outside React's render.

## Data Flow

### Request Flow: Signup → Profile Creation → Role Check → Routing

```
[User submits signup form: email + password]
    ↓ (Client Component, "use client")
[supabase.auth.signUp({ email, password })]  — via createBrowserClient
    ↓
[Supabase Auth creates row in auth.users]
    ↓ (Postgres trigger: on_auth_user_created)
[Trigger inserts public.profiles row: id = new.id, role = 'client' (hardcoded default)]
    ↓ (same trigger, or separate hook)
[app_metadata.role synced onto auth.users.raw_app_meta_data]
    ↓
[Supabase sends confirmation email] — user must verify before session is fully trusted
    ↓
[User clicks email link → GET /auth/callback?code=...]
    ↓ (Route Handler, apps/web/app/auth/callback/route.ts)
[supabase.auth.exchangeCodeForSession(code)] — via createServerClient
    ↓
[Session cookies set on response] → redirect to role home
    ↓
[Subsequent request to any route] → middleware.ts intercepts
    ↓
[updateSession(): createServerClient(cookies) → supabase.auth.getUser()]
    ↓
[user.app_metadata.role read] → redirect decision (client home `/` vs coach home `/coach`)
    ↓
[Route group layout renders] — (client)/layout.tsx or (coach)/layout.tsx
    ↓
[Page Server Component fetches data] — e.g. coach home: supabase.from('coach_clients').select(...)
    (RLS scopes rows automatically to auth.uid() — no manual WHERE coach_id = ... needed)
```

### State Management

```
[Supabase session] (cookies, httpOnly, managed by @supabase/ssr)
    ↓ (read once per request in middleware + Server Components)
[Server Components] → render role-correct shell + initial data (no client fetch needed for first paint)
    ↓ (hydration)
[Client Components] ←→ [supabase.auth.onAuthStateChange listener] → local React state (signed-in/out UI reactivity)
    ↓
[Theme preference] (cookie + localStorage, read synchronously pre-paint)
    ↓
[data-theme attribute on <html>] ←→ [toggle control, Client Component] → writes cookie + localStorage + attribute
```

### Key Data Flows

1. **Auth session propagation:** Session lives in httpOnly cookies set by `@supabase/ssr`. Middleware refreshes and forwards it on every request; Server Components read it fresh per-request (no client-side global auth store needed for SSR correctness). Client Components subscribe to `onAuthStateChange` only for reactive UI (e.g., updating a nav avatar without a full page reload).
2. **Role-based routing:** Role is decided once, in middleware, from the JWT's `app_metadata.role` claim — not re-derived per-page. Route groups `(client)`/`(coach)` structurally separate the two experiences so no page needs an `if (role === ...)` branch for its overall shell.
3. **RLS-scoped reads:** Pages/Server Components call `supabase.from('table').select()` directly (per AGENTS.md API boundary) with no manual `.eq('coach_id', ...)` filtering — RLS policies using `auth.uid()` do that automatically and are the actual security boundary, not application code.
4. **Command writes via Edge Functions:** Anything beyond a simple authorized read (assigning a client to a coach, sending a message) goes through an Edge Function, which independently validates the JWT (`verify_jwt = true`) and can enforce cross-table invariants that RLS alone can't express cleanly (e.g., "a client can only be assigned to one coach at a time").
5. **Theme resolution:** Theme is decided pre-paint from cookie (SSR) reconciled with localStorage (CSR persistence), written to `data-theme` on `<html>`, and every token-driven utility class resolves against that attribute with zero JS re-render cost.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users (this milestone's actual scale) | Everything above as-is. Single Supabase project, no read replicas, no caching layer. Middleware matcher excludes static assets so it only runs on navigable routes. |
| 1k-10k users | Add a short-lived cookie cache for the role decision if middleware DB lookups become a bottleneck (shouldn't be needed if role stays in JWT `app_metadata` per Pattern 3). Consider `React.cache()`/request memoization for repeated `createServerClient` reads within one render pass. |
| 10k+ users | Revisit RLS policy performance (wrap `auth.uid()`/helper function calls so Postgres can use an initPlan instead of per-row evaluation — index `coach_id`/`client_id` columns). This is a database-tuning concern, not a structural rearchitecture; the client/coach/RLS boundary model doesn't change. |

### Scaling Priorities

1. **First bottleneck (RLS on `coach_clients`/`profiles` joins):** Mitigate now, cheaply, by indexing `coach_clients(coach_id)` and `coach_clients(client_id)` and keeping the `is_coach_of()` helper `SECURITY DEFINER` + `STABLE` so Postgres can cache it per statement. Not urgent at this milestone's scale, but free to do correctly from the first migration.
2. **Second bottleneck (middleware running on every request):** The `matcher` config excluding `_next/static`, images, and favicon is the standard mitigation and should be in place from day one — otherwise every asset request pays the cookie-refresh cost unnecessarily.

## Anti-Patterns

### Anti-Pattern 1: Trusting `getSession()` for authorization

**What people do:** Call `supabase.auth.getSession()` in middleware or Server Components and use its `user` object to decide access.

**Why it's wrong:** `getSession()` reads from the (possibly stale/tampered) cookie without revalidating against the Supabase Auth server. It is not a verified check — official Supabase guidance is explicit that this must never be trusted for authorization inside server code.

**Do this instead:** Use `getUser()` (or `getClaims()`, which locally verifies the JWT signature) — both of which involve real verification — anywhere an authorization decision is made. Reserve `getSession()` for cases where you only need to forward a token, not verify identity.

### Anti-Pattern 2: Role stored only in `raw_user_meta_data`

**What people do:** Store `role: 'coach'` in the user metadata passed to `signUp()`, which lands in `raw_user_meta_data`.

**Why it's wrong:** `raw_user_meta_data` is user-editable via the client SDK (`supabase.auth.updateUser({ data: { role: 'coach' } })`). Any signed-in client could self-promote to coach. This directly violates this project's "signup can only create clients; coach role granted manually" constraint.

**Do this instead:** Set role via `profiles` table (server-side default `'client'`) and mirror to `raw_app_meta_data` (not user-editable) via a trigger or Auth Hook for JWT claim access. Only server-side/admin code (never the client SDK's `updateUser`) should ever write `app_metadata`.

### Anti-Pattern 3: RLS policy on `profiles` that queries `profiles` again (naive recursion)

**What people do:** Write a policy like `using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'coach'))` directly on the `profiles` table itself.

**Why it's wrong:** Postgres RLS re-evaluates policies on every table touched inside a policy's own `USING` clause — a policy on `profiles` that queries `profiles` triggers the same policy again, either erroring on detected recursion or silently multiplying query cost per row.

**Do this instead:** Wrap the check in a `SECURITY DEFINER` helper function (runs as table owner, bypasses RLS for its internal query), as shown in Pattern 3's `is_coach_of()`. Keep such functions out of Postgres schemas exposed to the API if their unrestricted result would itself be a data leak.

### Anti-Pattern 4: Re-checking auth in every page/layout instead of centralizing in middleware

**What people do:** Add `const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login')` at the top of every protected page component.

**Why it's wrong:** Duplicated, drift-prone (someone forgets it on a new page), and wastes a round-trip that middleware already paid for. It also means role-based redirect logic (client hitting `/coach`) has to be re-implemented per page.

**Do this instead:** Middleware is the single gate. Route groups `(client)`/`(coach)` assume middleware has already verified access; pages only need `getUser()` when they need the *data* (e.g., displaying the user's name), not to re-decide *access*.

### Anti-Pattern 5: `dark:` variant sprinkled on every utility instead of semantic tokens

**What people do:** Write `className="bg-white dark:bg-black text-black dark:text-white"` throughout every component.

**Why it's wrong:** Doubles the class list on every element, makes a third theme (or a monochrome-specific "high contrast" mode) require touching every component file, and is exactly the "raw hex / ad hoc styling" anti-pattern this project's AGENTS.md already forbids in spirit (tokens should be the only styling vocabulary).

**Do this instead:** Define semantic tokens once (`bg-surface`, `text-foreground`) that resolve per-theme via the `@theme inline` + `[data-theme]` override pattern (Pattern 4). Components only ever reference the semantic token; the theme system, not the component, owns light/dark values.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `@supabase/ssr` (`createBrowserClient`/`createServerClient`) + middleware refresh | Confirmed current package; `@supabase/auth-helpers-nextjs` is the deprecated predecessor — do not add it. |
| Supabase Postgres (RLS) | Direct `supabase.from(...)` reads from Server Components, scoped by RLS | Matches AGENTS.md API boundary exactly: "Use Supabase directly for simple authorized reads protected by RLS." |
| Supabase Edge Functions | `supabase.functions.invoke('name', { body })` from server or client | Matches AGENTS.md: command-style writes (assign-client, send-message) go here, not through direct table writes from the client. |
| Supabase email (signup confirmation, password reset) | Configured via Supabase Dashboard Auth templates + `redirectTo` pointing at `/auth/callback` | Requires `NEXT_PUBLIC_SITE_URL` (or equivalent) env var so redirect links work correctly across local/staging/prod. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `apps/web/lib/supabase/*` ↔ `packages/supabase` | `lib/supabase` (Next.js-runtime clients) imports types/constants from `packages/supabase` (framework-agnostic) | One-way dependency, matches existing `@fish/supabase` → `@fish/core` direction; keeps `packages/supabase` importable from Edge Functions (Deno) without pulling Next.js. |
| Middleware ↔ Route groups | Redirect-only; no shared runtime state | Middleware never renders UI; it only decides whether the request proceeds and where it's redirected. Route groups render assuming middleware already gated them. |
| `apps/web/app/globals.css` ↔ future `packages/tokens` | CSS custom properties as the "compiled" output; JSON/data as the portable source | This milestone can keep tokens hand-written directly in `globals.css` if `packages/tokens` is deferred — but the `@theme inline` → `var(--x)` indirection (Pattern 4) is what makes a later extraction possible without a rewrite. |
| UI kit (`components/ui/`) ↔ pages | Import-only; kit has zero knowledge of routes/roles | Components accept props and render tokens; they never branch on role or fetch data themselves (keeps them reusable across `(client)` and `(coach)` route groups). |

## Suggested Build Order (dependency-driven)

1. **Token architecture first** (`@theme inline` + `[data-theme]` blocks in `globals.css`, theme bootstrap script in root layout) — nothing visual can be "hardened" or extended until the token contract is stable; retrofitting dual-theme onto components built against single-theme tokens is the costlier order.
2. **UI kit hardening + expansion, built against the new tokens** — component states (disabled/loading/error) and new primitives need the token system in place to be theme-correct from creation, not patched after.
3. **App shell / layout chrome** — depends on the kit being ready; establishes the route-group structure `(auth)`, `(client)`, `(coach)` that auth routing will target.
4. **Database schema + RLS** (`profiles`, `coach_clients`, policies, helper functions) — must exist before any auth UI can be meaningfully tested end-to-end (signup needs a `profiles` row to land somewhere).
5. **Supabase client setup** (`lib/supabase/{client,server,middleware}.ts`) — depends on schema existing (types can be generated) but is otherwise independent of UI; can be built in parallel with step 3.
6. **Auth UI (signup/login/logout/reset) wired to Supabase clients** — depends on 4 and 5.
7. **Middleware route protection + role redirect** — depends on 5 and 6 (needs working sessions to redirect against) and on 3 (route groups must exist to redirect into).
8. **Role-aware landing screens + coach's assigned-clients view** — depends on everything above; this is the final integration point proving the whole chain (signup → profile → role → routing → RLS-scoped read) works.

This order also matches the dependency logic already implied by AGENTS.md's global build order ("Auth + roles" before "Client profiles" before later features) — schema and auth plumbing precede any UI that depends on a signed-in, role-known user.

## Sources

- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence, official, verified file structure and `getUser()`/`getClaims()` vs `getSession()` guidance
- [Creating a Supabase client for SSR | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence, official
- Context7 `/supabase/ssr` (`createServerClient` API reference, middleware cookie pattern) — HIGH confidence, current package docs, confirms `getAll`/`setAll` cookie contract and per-request client instantiation requirement
- [Custom Claims & Role-based Access Control (RBAC) | Supabase Docs](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac) — HIGH confidence, official; confirms `app_metadata` vs `user_metadata` authorization rule
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence, official
- [Supabase RLS SECURITY DEFINER: Preventing Infinite Recursion in Admin Policies - DEV Community](https://dev.to/kanta13jp1/supabase-rls-security-definer-preventing-infinite-recursion-in-admin-policies-4go2) — MEDIUM confidence, community source, pattern consistent with official RLS docs' recursion guidance
- [Dark mode - Core concepts - Tailwind CSS](https://tailwindcss.com/docs/dark-mode) — HIGH confidence, official, verified `@custom-variant` and data-attribute selector syntax
- [Theming best practices in v4 · tailwindlabs/tailwindcss · Discussion #18471](https://github.com/tailwindlabs/tailwindcss/discussions/18471) — MEDIUM-HIGH confidence, Tailwind team/community discussion in the official repo; confirms `@theme inline` + `@layer theme` two-layer indirection pattern for multi-theme setups
- [Theme variables - Core concepts - Tailwind CSS](https://tailwindcss.com/docs/theme) — HIGH confidence, official
- [next-themes (pacocoursey) — GitHub](https://github.com/pacocoursey/next-themes) — MEDIUM confidence, widely-used community library; referenced for the inline-script no-flash pattern, though this project can implement the same technique without the dependency given the small token surface

---
*Architecture research for: Supabase-auth + role-based Next.js App Router systems, dual-theme CSS-first token architecture*
*Researched: 2026-07-02*
