# Phase 2: Secure account you can return to - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 27 (new files this phase; greenfield Supabase integration — no existing Supabase client, auth route, or migration in the repo)
**Analogs found:** 27 / 27 (all resolve to in-repo analogs or the pinned official patterns in RESEARCH.md; codebase has zero prior Supabase/auth code, so many files share the same structural analog: `Button`/`Input`/`Card`/`Alert` for UI, `send-message/index.ts` for server-side validation voice, `packages/supabase/src/auth.ts` for typed contracts)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `apps/web/lib/supabase/client.ts` | service (factory) | request-response | none in-repo | no analog — RESEARCH.md Pattern 1 (official `@supabase/ssr` example) |
| `apps/web/lib/supabase/server.ts` | service (factory) | request-response | `apps/web/lib/supabase/client.ts` (sibling factory, same phase) | role-match — same factory shape, different runtime (cookies) |
| `apps/web/lib/supabase/proxy.ts` | middleware (session refresh helper) | request-response | none in-repo | no analog — RESEARCH.md Pattern 1 (`updateSession()`) |
| `apps/web/proxy.ts` | middleware (Next.js entry) | request-response | none in-repo (first middleware/proxy file) | no analog — RESEARCH.md Pattern 1 |
| `apps/web/app/signup/page.tsx` | route (form page) | request-response | `apps/web/app/page.tsx` (page structure) + `Button`/`Input`/`Card` (form controls) | role-match |
| `apps/web/app/login/page.tsx` | route (form page) | request-response | `apps/web/app/signup/page.tsx` (sibling auth form, same phase) | exact — near-identical shape |
| `apps/web/app/forgot-password/page.tsx` | route (form page) | request-response | `apps/web/app/login/page.tsx` (single-field auth form) | role-match |
| `apps/web/app/reset-password/page.tsx` | route (form page) | request-response | `apps/web/app/forgot-password/page.tsx` (single-field auth form, session-bound) | role-match |
| `apps/web/app/check-inbox/page.tsx` | route (calm single-action page) | request-response | `apps/web/app/expired-link/page.tsx` (sibling calm dead-end-free screen) | role-match |
| `apps/web/app/expired-link/page.tsx` | route (calm single-action page) | request-response | `apps/web/components/ui/alert.tsx` (tone/copy pattern) + `Card`/`Button` | role-match |
| `apps/web/app/home/page.tsx` | route (authenticated placeholder) | request-response | `apps/web/app/page.tsx` (existing showcase page structure) | role-match |
| `apps/web/app/auth/confirm/route.ts` | route (Route Handler) | request-response | `supabase/functions/send-message/index.ts` (only existing server-side request handler; validate → branch → respond shape) | partial — different runtime (Next.js Route Handler vs Deno Edge Function) but same validate/branch/respond shape |
| `apps/web/components/auth/*` (form components, if extracted) | component | request-response | `apps/web/components/ui/input.tsx` / `alert.tsx` (notice/error tiers) | role-match |
| `packages/supabase/src/auth.ts` (modified) | model (shared contract) | transform | itself (existing file, extended in place) | exact |
| `packages/supabase/src/database.types.ts` (regenerated) | model (generated types) | transform | itself (existing file, replaced by `supabase gen types`) | exact — generated, not hand-authored going forward |
| `supabase/migrations/<ts>_profiles.sql` | migration | CRUD (DDL) | none in-repo (first migration) | no analog — RESEARCH.md Pattern 3/4 (official Supabase trigger/RLS docs) |
| `supabase/migrations/<ts>_handle_new_user.sql` | migration (trigger) | event-driven | none in-repo | no analog — RESEARCH.md Pattern 3 |
| `supabase/migrations/<ts>_coach_clients.sql` | migration | CRUD (DDL) | `supabase/migrations/<ts>_profiles.sql` (sibling migration, same phase) | role-match once first migration exists |
| `supabase/migrations/<ts>_role_guard.sql` | migration (trigger) | event-driven | `supabase/migrations/<ts>_handle_new_user.sql` (sibling trigger migration) | role-match |
| `supabase/config.toml` (modified) | config | n/a | itself (existing file, extended in place) | exact |
| `supabase/templates/confirmation.html` | config (email template) | transform | none in-repo (first email template) | no analog — RESEARCH.md D-15 + Pitfall 6 |
| `supabase/templates/recovery.html` | config (email template) | transform | `supabase/templates/confirmation.html` (sibling template, same phase) | role-match |
| `scripts/seed.ts` (or `supabase/seed.ts`) | utility (admin script) | batch | `supabase/functions/send-message/index.ts` (closest existing "validate input, call Supabase-adjacent API, handle known error strings" shape) | partial — RESEARCH.md Code Examples has the authoritative skeleton |
| `apps/web/.env.local` / `.env.example` | config | n/a | none in-repo (first env files) | no analog — RESEARCH.md Code Examples (env var layout) |
| `apps/web/app/signup/page.test.tsx` (and sibling `*.test.tsx` for each screen) | test | request-response | `apps/web/components/ui/button.test.tsx` (RTL render + assert conventions) | role-match |
| `apps/web/app/home/page.test.tsx` | test | request-response | `apps/web/components/ui/button.test.tsx` | role-match |
| `.env.example` (root or `apps/web/`) | config | n/a | `supabase/config.toml` (existing checked-in config convention) | partial |
| `docs/deploy-checklist.md` (or similar, D-14 deliverable) | config (doc) | n/a | none in-repo | no analog — plain prose deliverable, no code pattern needed |

## Pattern Assignments

### `apps/web/lib/supabase/client.ts` (service, request-response) — NEW

**Analog:** none in-repo (first Supabase client factory). Use RESEARCH.md Pattern 1 verbatim; match this repo's import/export conventions on top of it.

**Official pattern (RESEARCH.md Pattern 1, pinned from `supabase/supabase` example repo):**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

**Repo conventions to apply on top of the official skeleton:**
- Named export (`export function createClient`), matching `apps/web/lib/utils.ts`'s `export function cn(...)` — never a default export (see Conventions table below).
- File sits in a new `apps/web/lib/supabase/` subdirectory, mirroring the existing single-purpose-file-per-concern convention already established by `apps/web/lib/utils.ts`.
- `Database` generic from `@fish/supabase/database.types` should type the client once that package is regenerated: `createBrowserClient<Database>(...)` — follow `packages/supabase/src/index.ts`'s `export type * from "./database.types"` re-export so the web app imports the type via `@fish/supabase`, not a relative path into `packages/`.

---

### `apps/web/lib/supabase/server.ts` (service, request-response) — NEW

**Analog:** sibling `client.ts` (same phase) for export shape; RESEARCH.md Pattern 1 for the cookie contract.

**Official pattern:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component; safe to ignore because
            // proxy.ts refreshes the session on the surrounding navigation.
          }
        },
      },
    }
  )
}
```

**Non-negotiable per RESEARCH.md Pitfall 1:** every server-side consumer of this client must call `getUser()` or `getClaims()`, never `getSession()`. This is a hard grep-gate, not a style preference — treat `.getSession(` anywhere in `apps/web/app/**` or `apps/web/lib/supabase/**` (outside `client.ts`, which is browser-only) as a review failure.

---

### `apps/web/proxy.ts` + `apps/web/lib/supabase/proxy.ts` (middleware, request-response) — NEW

**Analog:** none in-repo (first middleware). RESEARCH.md Pattern 1 is authoritative; Pitfall 5 is the exact failure mode to avoid.

**Official pattern (`apps/web/proxy.ts`, project root):**
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Critical constraint (Pitfall 5 — enforce during code review, not just implementation):** `updateSession()` must create exactly one `response` object, wire `getAll`/`setAll` to write to both `request.cookies` and `response.cookies`, call `getClaims()`/`getUser()` immediately with no logic in between, and return that exact same `response` — a second `NextResponse.next()`/`NextResponse.redirect()` construction anywhere in the function silently drops the refreshed cookie.

**Repo import convention:** use the `@/*` path alias (`@/lib/supabase/proxy`), matching every existing import in `apps/web/app/**` (see `apps/web/app/page.tsx`'s `@/components/ui/button` imports) — never a relative `../lib/...` path.

---

### `apps/web/app/signup/page.tsx` (route, request-response) — NEW

**Analog:** `apps/web/app/page.tsx` (page-level structure: single `<main>` wrapper, Server Component by default) + `apps/web/components/ui/button.tsx` / `input.tsx` / `card.tsx` (the only form controls to compose — D-03 bars hand-rolled controls).

**Imports pattern** (matches `apps/web/app/page.tsx` lines 1-5, swapping `Image`/`Progress` for the auth-specific pieces):
```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
```

**Core form pattern (client-side; D-03's one-Card, one-primary-Button contract):**
- Wrap the form in a centered `Card` (reuse `Card`'s existing elevation — `shadow-[var(--shadow-card)]`, `rounded-card`, `border-border` — do not add a competing shadow/border override).
- Exactly one `<Button variant="primary">` (signup submit) per D-03/AGENTS.md's "one primary action per screen" rule — the "New here? Create account"-style sibling link must NOT be a second `Button`; use `Button variant="ghost"` or a plain text `<a>`/`Link`, matching `apps/web/app/page.tsx`'s existing `Button variant="ghost" fullWidth={false}` idiom for low-emphasis actions (see `page.tsx` line 60-62).
- Three `Input` fields (email, password, name per D-04) — reuse `Input`'s existing `label`/`hint`/`notice`/`error` prop shape verbatim (see `input.tsx` lines 5-14); password field's `hint="At least 8 characters."` matches the exact copy already shown in `apps/web/app/page.tsx` line 73 — reuse this string, do not invent new copy for the same fact.
- This must be a Client Component (`"use client"`) since it holds controlled form state and calls `supabase.auth.signUp()` directly from the browser client — this is the first form-with-state component in the repo; the only prior `"use client"` precedent is `apps/web/components/kit/theme-toggle.tsx` (simple `useState`, no async call). Follow its `"use client"` placement (top of file, before imports) but expect real async/error-state handling here that `theme-toggle.tsx` doesn't need.

**Error/notice pattern:** form-level failures (e.g., signup API error) use `Alert tone="error"` or `tone="notice"` per `apps/web/components/ui/alert.tsx`'s existing tone-config pattern (lines 17-36); field-level failures use `Input`'s `notice`/`error` props — never both for the same failure. Copy must route through the calm-voice convention already established in `supabase/functions/send-message/index.ts` (see Shared Patterns below) — no "Error:", no exclamation points, sentence case.

---

### `apps/web/app/login/page.tsx` (route, request-response) — NEW

**Analog:** `apps/web/app/signup/page.tsx` (sibling auth form, same phase — nearly identical shape, two fields instead of three).

**Pattern:** same Card/Button/Input/Alert composition as signup; on `signInWithPassword()` returning an "email not confirmed" error, redirect to `/check-inbox` per D-05 — this is a routing decision inside the submit handler's error branch, not a new Alert tone. Reuse the exact submit-handler try/catch shape from signup once it exists (same phase, write signup first as the template).

---

### `apps/web/app/forgot-password/page.tsx` (route, request-response) — NEW

**Analog:** `apps/web/app/login/page.tsx` (single email-field form, same submit/Card/Button shape).

**Pattern:** one `Input` (email), one primary `Button`. Per D-07, the success branch and the "no such account" branch must render the identical `Alert tone="success"` (or route to the same confirmation state) — no account-enumeration. This is enforced at the call-site: never branch UI on whether `resetPasswordForEmail()` reports a real vs. non-existent account (Supabase's API itself does not leak this by default — the discipline is not adding a differentiating UI branch on top of it).

---

### `apps/web/app/reset-password/page.tsx` (route, request-response) — NEW

**Analog:** `apps/web/app/forgot-password/page.tsx` (single-field form) — this screen's field is `password`, not `email`, and it requires an active recovery session (established by `/auth/confirm` per D-08) rather than being reachable directly.

**Pattern:** one `Input type="password"` with the same `hint="At least 8 characters."` convention as signup; single primary `Button`. On success, `updateUser({ password })` followed by client-side redirect to `/home` (D-08 — already signed in via the recovery session, zero re-typing).

---

### `apps/web/app/check-inbox/page.tsx` and `apps/web/app/expired-link/page.tsx` (route, request-response) — NEW

**Analog:** each other (sibling "calm dead-end-free" screens, same phase) + `apps/web/components/ui/alert.tsx` for the tone/copy voice + `Card`/`Button` for structure.

**Pattern:** `Card` containing an `Alert tone="notice"` (never `error` — these are routing states, not failures, per the phase's "errors route rather than scold" principle) plus exactly one primary `Button` (resend, on both screens per D-05/D-06). No second action, no navigation menu — this is the strictest application of the "one primary action" rule in the phase since these screens by design have nowhere else to go.

**Shared implementation note:** both screens accept an email via query param/search param (`?email=...`) to pre-fill the resend target per D-06 ("email pre-filled when known") — read via `useSearchParams()` (Client Component) or the route's `searchParams` prop (Server Component), whichever the submit action needs; if resend requires a client-side Supabase call, this must be a Client Component like the form pages above.

---

### `apps/web/app/home/page.tsx` (route, request-response) — NEW

**Analog:** `apps/web/app/page.tsx` (existing single-`<main>`-wrapper showcase page structure — this is the closest structural precedent for "a simple authenticated page with minimal content").

**Pattern:** Server Component (no client state needed for D-01's "calm confirmation + logout" scope) that calls `createClient()` from `apps/web/lib/supabase/server.ts`, reads `getUser()` for the calm confirmation copy (e.g., display name), and renders one `Card` + one primary `Button` wired to a `signOut()` action (AUTH-06). The logout button likely needs a small Client Component island (`"use client"`) wrapping just the button + `signOut()` call, mirroring how `apps/web/app/kit/page.tsx` mounts `KitThemeToggle` as the one client island on an otherwise server-rendered page (see `01-PATTERNS.md`'s `kit/page.tsx` section) — do not mark the whole `/home` page `"use client"`.

---

### `apps/web/app/auth/confirm/route.ts` (route, request-response) — NEW

**Analog:** `supabase/functions/send-message/index.ts` (only existing server-side request handler in the repo — same "parse input, validate, branch, respond" shape, even though the runtime differs).

**Imports pattern to follow (repo convention: `@/*` alias, named type imports):**
```typescript
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
```

**Core pattern (RESEARCH.md Pattern 2, official Supabase docs):**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/home' // D-08: land signed-in at /home

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }
  // D-06: expired/used link -> dedicated calm expired-link screen, not an error page
  return NextResponse.redirect(new URL('/expired-link', request.url))
}
```

**Voice/error-handling parallel to `send-message/index.ts`:** that file's pattern of "validate input -> if invalid/failed, respond with a calm plain-language outcome, never a raw 500" is the same discipline here — except the "response" is a redirect to a full calm screen (`/expired-link`) rather than a JSON error body, because this is a browser navigation, not an API call. Both files share the underlying rule from `AGENTS.md`: never expose a raw/technical error to the end user.

---

### `packages/supabase/src/auth.ts` (model, transform) — MODIFIED

**Analog:** itself, extended in place.

**Current file (full):**
```typescript
import type { UserRole } from "@fish/core/roles";

export interface FishAuthClaims {
  sub: string;
  role: UserRole;
}

export const authRedirects = {
  signedOut: "/",
  clientHome: "/chat",
  coachHome: "/coach",
} as const;
```

**Extension pattern:** add `home: "/home"` to `authRedirects` (D-01's interim placeholder) alongside the existing `signedOut`/`clientHome`/`coachHome` keys — do not remove or rewire the existing keys (Phase 3 owns role-based redirects; this phase adds `/home` "alongside" per the canonical refs). Preserve the `as const` idiom and the flat key-to-path-string shape exactly; this is the only exported constant shape in the package, so any new redirect-adjacent value (e.g. a `checkInbox`/`expiredLink` path constant, if the planner wants one centralized) should follow the same flat `Record<string, string> as const` pattern, not a nested object.

---

### `supabase/migrations/<ts>_profiles.sql` (migration, CRUD/DDL) — NEW

**Analog:** none in-repo (first migration; `supabase/migrations/` does not yet exist). RESEARCH.md Pattern 3/4 and `packages/supabase/src/database.types.ts`'s existing hand-written `ProfileRow` shape (id/role/display_name/created_at/updated_at) are the two authoritative sources — the migration's column list must match `ProfileRow` exactly so regenerated types don't drift from the hand-written contract already consumed elsewhere.

**Existing hand-written shape to match (`packages/supabase/src/database.types.ts` lines 12-18):**
```typescript
export interface ProfileRow {
  id: string;
  role: UserRole;
  display_name: string;
  created_at: string;
  updated_at: string;
}
```
Use this as the column checklist for the `create table public.profiles (...)` statement — `role text not null default 'client'` (defense-in-depth per Pattern 3), `display_name text not null default ''`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.

**RLS + role storage pattern:** see RESEARCH.md Pattern 4 (SECURITY DEFINER helper, `profiles` policies) — copy verbatim, do not hand-roll a simpler bare-`SELECT` policy (Pitfall 2).

---

### `supabase/migrations/<ts>_handle_new_user.sql` (migration, event-driven) — NEW

**Analog:** none in-repo. RESEARCH.md Pattern 3 is authoritative and already cross-verified against official Supabase docs — copy verbatim:
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    'client',
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```
Non-negotiable per Pitfall 4: `security definer`, `set search_path = ''`, `on conflict (id) do nothing`, `coalesce()` around metadata — all four must be present, not a subset.

---

### `supabase/migrations/<ts>_coach_clients.sql` (migration, CRUD/DDL) — NEW

**Analog:** sibling `<ts>_profiles.sql` (same phase, same migration-file conventions: naming, RLS-enabled-by-default).

**Pattern:** `coach_id uuid references public.profiles(id)`, `client_id uuid references public.profiles(id) unique` (D-09's one-coach-per-client constraint), `assigned_at timestamptz not null default now()`. RLS policies route through the `private.is_coach_of()` helper from Pattern 4 — no bare `SELECT` against `coach_clients` inside its own policy.

---

### `supabase/migrations/<ts>_role_guard.sql` (migration, event-driven) — NEW

**Analog:** sibling `<ts>_handle_new_user.sql` (same phase, same trigger-migration shape).

**Pattern:** RESEARCH.md Pattern 5 verbatim (role-escalation guard trigger) — verify with the positive test noted in Pitfall 3/Assumption A3 (a direct `authenticated`-role `UPDATE profiles SET role=...` must fail; a `service_role` call must succeed, since the seed script's reassignment path depends on it).

---

### `scripts/seed.ts` (utility, batch) — NEW

**Analog:** `supabase/functions/send-message/index.ts` for the "validate then call the Supabase-adjacent API, treat known error strings as expected, not exceptional" discipline — but RESEARCH.md's Code Examples section has the authoritative skeleton for the actual Supabase Admin API call shape, which has no in-repo precedent.

**Skeleton (RESEARCH.md Code Examples, D-10/D-11):**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function upsertUser(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  })
  if (error && !error.message.includes('already been registered')) throw error
  return data?.user
}
```

**Repo convention overlay:** name the exported helper functions with the same camelCase-verb-first idiom as `send-message/index.ts`'s local variables (`command`, `body`) — no strict prior art for a script file's shape, so default to plain `async function main() { ... }` + top-level `await main()` invocation, matching Node ESM script conventions (package is `"type": "module"` for both `packages/core`/`packages/supabase`, so `.ts` scripts run under the same ESM assumption). Idempotency (D-11) is the load-bearing requirement — the `already been registered` string-match branch above is not optional.

---

## Shared Patterns

### Calm, plain-language error/notice copy — never a raw/technical message
**Source:** `supabase/functions/send-message/index.ts` lines 9-30 (existing, only prior server-side error-copy precedent), `AGENTS.md` "Copy never scolds" rule
```typescript
return Response.json(
  { error: "This message is a little long. Try sending it in two parts." },
  { status: 400, headers: jsonHeaders },
);
```
**Apply to:** every auth screen's Alert/Input error copy, every redirect-instead-of-error-page decision (`/auth/confirm` -> `/expired-link`), and the seed script's non-fatal "already registered" branch. The pattern is: identify the exact known failure, write one calm sentence explaining + guiding, never surface the underlying exception message or HTTP status text to the user.

### `cn()` class merging + `forwardRef`/`displayName` on any new focusable control
**Source:** `apps/web/lib/utils.ts`, `apps/web/components/ui/button.tsx` lines 27-72, `apps/web/components/ui/input.tsx` lines 16-63
**Apply to:** any new form component this phase introduces beyond composing existing `Button`/`Input`/`Card`/`Alert` (e.g., a shared `AuthCard` wrapper, if the planner extracts one) — must follow the exact `forwardRef<HTMLXElement, XProps>(...)` + `X.displayName = "X"` shape already established, no exceptions for auth-specific components.

### One primary action per screen (D-03 and every auth screen)
**Source:** `apps/web/components/ui/button.tsx` line 15 comment ("The ONE action on a screen. Use at most one primary per view."), `AGENTS.md` Design rule #1
**Apply to:** every route file in this phase — `signup`, `login`, `forgot-password`, `reset-password`, `check-inbox`, `expired-link`, `home`. Sibling-flow links ("New here? Create account") must use `variant="ghost"` or a plain anchor, never a second `variant="primary"` Button. This is a hard grep-gate: at most one `variant="primary"` (or bare `<Button>` with default variant) JSX usage per page file.

### Named exports only, no default exports on components/utilities
**Source:** every existing file in `apps/web/components/`, `apps/web/lib/utils.ts`, `packages/core`, `packages/supabase` (see Conventions table — 100% named-export rate outside Next.js's framework-mandated page/route `export default`)
**Apply to:** `apps/web/lib/supabase/{client,server,proxy}.ts` (`export function createClient` / `export async function updateSession`), any extracted auth form component. Next.js page files (`page.tsx`) and Route Handlers (`route.ts`) keep their framework-required `export default function Page()` / `export async function GET(...)` shape — this is the one sanctioned exception, already present in the codebase's only prior page file.

### `getUser()`/`getClaims()` only, server-side — never `getSession()`
**Source:** RESEARCH.md Pitfall 1 (no in-repo precedent yet since this phase creates the first server-side Supabase reads); enforced as a hard constraint alongside the repo's existing "server-side explicit checks on parsed input" convention already seen in `send-message/index.ts`
**Apply to:** `apps/web/lib/supabase/proxy.ts`, `apps/web/app/home/page.tsx`, `apps/web/app/auth/confirm/route.ts`, and any future Server Component/Route Handler reading auth state.

### `@/*` path-alias imports, never relative traversal
**Source:** `apps/web/app/page.tsx` lines 2-4, `apps/web/tsconfig.json`'s `paths: { "@/*": ["./*"] }`
**Apply to:** every new file under `apps/web/` — `@/components/ui/button`, `@/lib/supabase/server`, `@/lib/supabase/proxy`. Workspace package imports (`@fish/core`, `@fish/supabase`) stay bare package-name imports per `packages/supabase/src/auth.ts` line 1 (`import type { UserRole } from "@fish/core/roles"`).

## No Analog Found

Files with no close in-repo match — this is expected since Phase 2 is the project's first backend integration (zero prior Supabase client, migration, middleware, or email template). Planner should use RESEARCH.md's "Code Examples," "Pattern 1-5," and "Architecture Patterns" sections directly.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/lib/supabase/client.ts` | service | request-response | First Supabase client factory; use RESEARCH.md Pattern 1 official skeleton |
| `apps/web/lib/supabase/proxy.ts` | middleware | request-response | First session-refresh helper; RESEARCH.md Pattern 1, Pitfall 5 is the exact failure mode to test against |
| `apps/web/proxy.ts` | middleware | request-response | First Next.js `proxy.ts`/`middleware.ts`-equivalent file in the repo |
| `supabase/migrations/*.sql` (all four) | migration | CRUD / event-driven | `supabase/migrations/` directory does not exist yet; RESEARCH.md Patterns 3, 4, 5 are the authoritative, already-verified sources |
| `supabase/templates/{confirmation,recovery}.html` | config | transform | No email template exists yet; D-15 requires full FISH-voice rewrite pointing at `{{ .SiteURL }}/auth/confirm?token_hash=...` — RESEARCH.md Pitfall 6 documents the exact structure required |
| `scripts/seed.ts` | utility | batch | No prior seed/admin script exists; RESEARCH.md Code Examples has the full skeleton (Admin API `createUser`, idempotent upsert pattern) |
| `apps/web/.env.local` / `.env.example` | config | n/a | No env files exist yet anywhere in the repo; RESEARCH.md Code Examples documents the exact variable layout and the service-role-key-never-`NEXT_PUBLIC` constraint |
| `docs/deploy-checklist.md` (D-14 deliverable) | config (doc) | n/a | Plain prose deliverable, not a code pattern — write directly from D-14's requirements (hosted project link, Site URL, redirect allow-list, production email templates) |

## Conventions

**Derivation status:** the shared `gsd-tools.cjs verify conventions --derive` module was not available in this environment (no `gsd-plugin` cache directory under `~/.claude/plugins/cache/`, and no `CLAUDE_PLUGIN_ROOT` set) — convention derivation skipped (tool unavailable). Conventions below extend Phase 1's manually-derived table (`01-PATTERNS.md`) with the handful of files added since (button/input/alert hardening, `card.tsx`), still 100%-inspected, not sampled.

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| File-name casing | lowercase-with-hyphens (`button.tsx`, `alert.tsx`, `theme-toggle.tsx`, `send-message/index.ts`) | 11/11 existing source files (100%) | none — zero variants | named contract |
| Identifier casing | camelCase (vars/functions) + PascalCase (components/types/interfaces) | 11/11 (100%), no snake_case in TS/TSX (snake_case appears only in SQL/DB column names per `ProfileRow`'s `display_name`/`created_at`, which is the correct convention boundary — Postgres snake_case, TS camelCase at the type-property level where hand-mapped, but `database.types.ts` mirrors raw column names verbatim) | none | named contract |
| Export style | named exports only, except Next.js page/route framework-mandated `export default` | 10/11 (91%) — the one `export default function Home()` in `apps/web/app/page.tsx` is a Next.js App Router requirement, not an author choice | low (one framework-forced exception, zero true variants) | named contract |
| Import style | ESM `import { x } from "y"`, `@/*` alias for local `apps/web` files, bare package name for workspace/npm deps, relative-only inside `supabase/functions/` (Deno import map limitation: `"../../../packages/core/src"`) | 10/11 (91%) — Deno's `supabase/functions/send-message/index.ts` is the sole exception, forced by Deno's lack of the Next.js path-alias resolver | low (one runtime-forced exception) | named contract |

**Contested hotspots (author's choice):** none identified as genuinely contested — the two "exceptions" above (Next.js's `export default` requirement on `page.tsx`/`route.ts`, and Deno's relative-import requirement in `supabase/functions/`) are both externally forced by the runtime/framework, not author discretion, so they don't count as contested per this project's own precedent. This phase's new `supabase/migrations/*.sql` and `scripts/seed.ts` are the first non-TS/TSX, non-Deno source files in the repo — SQL migrations should follow Postgres/Supabase community convention (snake_case identifiers, lowercase SQL keywords per RESEARCH.md's own code examples) since no in-repo SQL precedent exists yet to contest with. For reference, this project's prototype "intentional-contested split" pattern (a CJS<->SDK dual resolver where `bin/lib/**` stays CJS `module.exports`/`require` while `sdk/src/**` stays ESM `export`/`import`, each internally consistent per-directory) does not apply to this repo: there is no CJS surface anywhere in `apps/web`, `packages/*`, or `supabase/functions/` — everything in scope is ESM TS/TSX, Deno TS, or (new this phase) SQL/plain scripts. If a future phase introduces CJS-only Node tooling, match that directory's local convention rather than forcing ESM uniformity, per Phase 1's same note.

## Metadata

**Analog search scope:** `apps/web/` (entire directory, 15 source files including Phase 1 additions), `packages/core/src/`, `packages/supabase/src/`, `supabase/` (config.toml, functions/send-message) — exhaustive, not sampled, given the repo's small size
**Files scanned:** 15 existing `apps/web` TS/TSX/CSS files + 6 `packages/*` TS files + `supabase/config.toml` + `supabase/functions/send-message/index.ts` + both root and `apps/web` `package.json`/`tsconfig.json` for tooling conventions + `01-PATTERNS.md` for Phase 1's already-derived component patterns
**Pattern extraction date:** 2026-07-03
