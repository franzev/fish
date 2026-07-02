# Phase 2: Secure account you can return to - Research

**Researched:** 2026-07-03
**Domain:** Supabase Auth (email/password, SSR) + Postgres RLS + Next.js 16 App Router, on a greenfield monorepo with no Supabase dependencies or migrations yet installed
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth screens & post-login landing**
- **D-01:** Post-login destination this phase is ONE neutral authenticated placeholder (`/home`): a calm "you're signed in" confirmation plus the log out action. It proves session persistence (AUTH-05) and logout (AUTH-06). Phase 2 does NOT stub `/chat` or `/coach` and does no role-based redirects — Phase 3 owns those.
- **D-02:** Top-level human-friendly routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`. The only namespaced route is the machine endpoint `/auth/confirm` required by the token-hash email verification flow.
- **D-03:** Auth screens are a centered Card from the Phase 1 kit: Fraunces heading, form fields, exactly one primary Button, and a quiet text link to the sibling flow ("New here? Create account"). Reuses Card's elevation treatment as shown on `/kit`.
- **D-04:** Signup asks for email + password + name. `profiles.display_name` gets a real value from day one so Phase 3's coach home lists clients by name, not raw emails. Three fields is still a calm form.

**Verification & recovery edge cases**
- **D-05:** An unverified user attempting login is routed back to the same calm "check your inbox" screen from signup, whose single action is resend. One screen owns the not-verified-yet state; login never scolds, it just routes.
- **D-06:** Expired or already-used email links (verify AND reset) land on one dedicated calm expired-link screen with a single action: send a fresh link (email pre-filled when known). Explains and guides, never blames.
- **D-07:** Password reset never reveals account existence: the same calm success message shows whether or not the email has an account ("If that address has an account, a reset link is on its way"). No account-enumeration, no dead-end error state.
- **D-08:** Successful email links land the person signed in at `/home` — both email verification and reset-plus-new-password create a session directly. Fully linear: sign up → click link → you're in. Zero credential re-typing.

**Coach-client schema & seed script**
- **D-09:** Relationship is a `coach_clients` join table (`coach_id`, `client_id`, `assigned_at`) with a UNIQUE constraint on `client_id` — one coach per client enforced by the database today; multiple coaches or history later is a constraint change, not a remodel. RLS reads go through SECURITY DEFINER helpers (avoids policy recursion).
- **D-10:** Seed creates one coach account plus ~3 pre-verified client accounts already assigned to that coach, all with fixed, documented dev credentials — Phase 3's coach home has real rows on day one, and any account can be logged into to test RLS boundaries.
- **D-11:** The seed is a TypeScript admin script (pnpm script) using the service-role key and `supabase.auth.admin.createUser` with email pre-confirmed — users pass through the real auth machinery so the DB-01 profile trigger fires exactly as in production. Idempotent; works against local and hosted. NOT raw inserts into `auth.users` via seed.sql.
- **D-12:** Reassignment replaces: `coach_clients` always holds exactly the current truth (one live row per client, `assigned_at` the only timestamp). No history/audit table this milestone — reassignment is seed/manual-only anyway.

**Supabase environment & email delivery**
- **D-13:** Development runs against local Supabase via the CLI (`supabase start`, Docker). Migrations and seed run locally; the bundled mail-catcher (Mailpit) captures every verification/reset email — no real email sending, no rate limits during dev.
- **D-14:** Local only this phase. Creating/linking the hosted project, Site URL, redirect allow-list, and production email templates become a documented deploy-time checklist (deliverable of this phase as a doc, executed when the app first deploys).
- **D-15:** Both email templates (verify + reset) are rewritten in full FISH voice: calm sentence-case copy, plain single-column layout, one clear action link, expiry stated as fact not threat. They must be edited anyway to point at `{{ .SiteURL }}/auth/confirm` with `token_hash` — the voice pass rides along.
- **D-16:** Password minimum is 8 characters, configured in Supabase and stated upfront in the signup field's hint ("at least 8 characters"). No complexity rules (no forced symbols/uppercase). Strength meters/breach checks stay v2 (AUTH-V2-01).

### Claude's Discretion
- Env var and secret layout (`.env.local`, committed `.env.example`, service-role key confined to the seed script's environment — never `NEXT_PUBLIC`).
- Exact screen and email copy — drafted in FISH voice (sentence case, plain verbs, never scolds), reviewed at phase verification.
- pnpm script names wrapping the local Supabase workflow (start/reset/seed).
- RLS policy structure and SECURITY DEFINER helper details, following the pinned pitfalls in STATE.md research notes.
- Session/cookie refresh mechanics per the pinned `@supabase/ssr` pattern (Next.js 16 `proxy.ts`, `getUser()` server-side, cookies written to both request and response).
- Exact `profiles` columns beyond id / role / display_name / timestamps.

### Deferred Ideas (OUT OF SCOPE)
- **Custom SMTP provider (e.g. Resend)** — deferred until real users onboard / deliverability matters; local dev uses the mail-catcher, and the hosted checklist notes the built-in sender's rate limits.
- **Assignment history / audit trail** (append-with-active-flag on `coach_clients`) — deferred until a real need appears; schema chosen so it's a constraint/column addition, not a remodel.
- Pre-existing v2 items reaffirmed in passing: AUTH-V2-01 (password strength/breach feedback), COAC-01/02 (in-app assignment, coach signup), THEM-01/02 (theme toggle, token pipeline).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|---------------------|
| AUTH-01 | User can sign up with email and password; signup always creates a client account | Pattern 3 (`handle_new_user` hard-codes `role='client'`); Standard Stack (Supabase Auth `signUp()`); Security Domain V2 |
| AUTH-02 | User receives a verification email after signup and lands on a calm single-action "check your inbox" screen | Pattern 2 (`/auth/confirm` + `verifyOtp`); Pitfall 6 (email template `token_hash` requirement); D-05/D-15 in User Constraints |
| AUTH-03 | User can log in with email and password | Pattern 1 (three-client setup); Pitfall 1 (`getUser()`/`getClaims()` discipline) |
| AUTH-04 | User can reset their password via an email link that lands on a single-field "set new password" screen | Pattern 2 (shared `/auth/confirm` handler, `type=recovery`); D-06/D-07/D-08 in User Constraints |
| AUTH-05 | User session persists across browser refresh and restart | Pattern 1 (`proxy.ts` cookie refresh contract); Pitfall 5 (dropped-cookie failure mode); Validation Architecture (manual-only test) |
| AUTH-06 | User can log out from any authenticated screen | Architectural Responsibility Map (`/home` owns logout per D-01); Don't Hand-Roll (Supabase `signOut()`) |
| DB-01 | A profile row is created automatically and reliably on signup (hardened trigger — a failing trigger must not silently block signups) | Pattern 3 (full trigger SQL + hardening rationale); Pitfall 4 |
| DB-02 | A coach-client relationship table exists with a seed script that creates a coach account and assigns clients to it | Code Examples (seed script skeleton); Don't Hand-Roll (admin API vs raw insert); D-09/D-10/D-11 in User Constraints |
| DB-03 | RLS is enabled on every table: a client can only read their own data; a coach can only read their own assigned clients | Pattern 4 (SECURITY DEFINER helper + example policies); Pitfall 2; Validation Architecture (manual role-switch SQL test) |
| DB-04 | Role is stored and enforced server-side; an authenticated user cannot escalate themselves to coach (coach role is seed/manual-only) | Pattern 5 (role-escalation guard trigger); Pitfall 3; Security Domain (Elevation of Privilege row) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No Express/Node API service** — Supabase directly for RLS-protected reads; Edge Functions only for command-style writes/sensitive logic. Auth itself is Supabase's own service, not a custom API, so this phase doesn't need an Edge Function for signup/login/logout — only future command-style operations (message sending, assignment) get Edge Functions.
- **pnpm only** — `pnpm add @supabase/supabase-js@2.110.0 @supabase/ssr@0.12.0` from `apps/web`; lockfile is `pnpm-lock.yaml`, never `npm install`.
- **`pnpm build` must pass before any commit** — includes shared package typechecks (`packages/core`, `packages/supabase`); regenerated `database.types.ts` must typecheck cleanly against real migrations.
- **No `tailwind.config.js`** — not directly implicated by this phase (no new Tailwind config needed), but any auth screen styling stays in `apps/web/app/globals.css` `@theme` tokens, never a new config file.
- **Reuse `apps/web/components/ui/` kit** — `Button`, `Input`, `Card`, `Alert` from Phase 1; auth screens extend these, never hand-roll new form controls (D-03 in User Constraints reinforces this).
- **Named exports, `forwardRef` + `displayName` on focusable controls** — any new auth-screen component follows the exact `Button`/`Input` convention documented in `01-PATTERNS.md`.
- **`cn()` helper for conditional classes** — from `apps/web/lib/utils.ts`, already established.
- **Coach-first, code-second** — not directly applicable to this phase (no learning feature being built), but the seed script (D-10/D-11) exists specifically so Phase 3's coach-facing UI has real data to validate against, consistent with this rule's spirit.
- **One primary action per screen; assigned never chosen; big tap targets; progress never a grade; gamification reward-only; copy never scolds** — directly govern every auth screen in this phase (D-03, D-05, D-06, D-07, D-16 in User Constraints already encode these); no screen in this phase may show more than one `Button variant="primary"`, and error/notice copy must route through `Input`'s notice/error tiers or `Alert`, never raw red/alarming language.
- **Security: signup can only create clients; coach role granted manually; every table gets RLS** — this is DB-04's exact text and Pattern 3/Pattern 5/Pitfall 3 above are the direct technical answer to it.

## Summary

This phase wires the project's first real backend: Supabase Auth (email/password only) plus a hardened `profiles` + `coach_clients` schema with RLS, consumed by a fully linear Next.js App Router auth flow. Nothing Supabase-related exists in the repo yet — no `@supabase/*` packages installed, no migrations, no `supabase/config.toml` auth section, no `apps/web/lib/supabase/` client factories, no auth routes. This phase creates all of it from a clean slate, which is favorable: there is no legacy pattern to reconcile, only the official current pattern to apply correctly the first time.

The milestone-level research already completed at `.planning/research/{STACK,PITFALLS,ARCHITECTURE,SUMMARY}.md` is HIGH confidence, verified against npm registry, official Supabase docs, and the official `supabase/supabase` example repo as of 2026-07-02 (one day before this research). This document does not re-derive that research — it **applies and narrows** it to Phase 2's exact scope (AUTH-01..06, DB-01..04) and layers in the CONTEXT.md decisions (D-01..D-16) that were locked during `/gsd:discuss-phase`. Where this document's guidance differs from general Supabase tutorials, prefer this document and the pinned milestone research — both were verified specifically against this project's Next.js 16 / `@supabase/ssr` combination, which is newer than most tutorial content in the training-data corpus.

**Critical environment gap found during this research:** the Supabase CLI is not installed in this environment, and Docker (present at `/usr/local/bin/docker`) is not running. D-13 requires local Supabase via `supabase start` for migrations, the seed script, and Mailpit email capture. This blocks any task that runs `supabase start`, `supabase db reset`, or `supabase gen types --local` until both are available. See Environment Availability below — this is the single most important planning input from this research.

**Primary recommendation:** Install `@supabase/supabase-js@2.110.0` + `@supabase/ssr@0.12.0`, build the three-client pattern (`browser.ts`, `server.ts`, `proxy.ts`) exactly as the official Supabase Next.js example ships it, write migrations with `SECURITY DEFINER` + `search_path = ''` for both the `handle_new_user` trigger and the RLS helper functions, and treat the six pitfalls pinned in STATE.md as non-negotiable acceptance checks, not optional hardening.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signup / login / reset forms | Browser / Client | Frontend Server (SSR) | Client Components (`"use client"`) for controlled form state and calm inline validation feedback; submit calls Supabase directly via browser client (Supabase Auth is the "backend" here, not a custom API) |
| Session cookie issuance & refresh | Frontend Server (SSR) | — | `apps/web/proxy.ts` runs on every navigation (Next.js 16 Node.js runtime), refreshes the Supabase session, writes cookies to both request and response |
| Email verification / password reset token exchange | Frontend Server (SSR) | — | `/auth/confirm` Route Handler calls `verifyOtp({ token_hash, type })` server-side, then issues a session cookie — must run server-side because it consumes a single-use token and needs to set httpOnly cookies |
| Role storage & enforcement | Database / Storage | Frontend Server (SSR, read-only) | `profiles.role` is the source of truth; RLS policies (Postgres) are the actual enforcement boundary. Server reads role for display/redirect only — never trusts a client-asserted role |
| `profiles` row creation on signup | Database / Storage | — | `handle_new_user` trigger (`SECURITY DEFINER`) on `auth.users` insert — must live in Postgres, not app code, so it fires even for signups Bypassing the web app (e.g. the seed script) |
| Coach-client relationship + seed data | Database / Storage | — | `coach_clients` table + RLS; seed script is a one-off Node/TS script using the service-role key (`Frontend Server`-adjacent tooling, not a runtime request path) |
| RLS policy evaluation | Database / Storage | — | Postgres enforces every read/write boundary; this is the only tier that cannot be bypassed by a modified client request |
| Auth emails (verify, reset) | Database / Storage (GoTrue config) | — | Supabase Auth's built-in mailer (local: Mailpit; hosted: built-in sender per D-14) renders and sends the templates configured in `supabase/config.toml` |

**Why this matters for planning:** Every AUTH-* requirement touches at least two tiers (client form UX + server session handling); every DB-* requirement lives entirely in the Database tier and must be provably correct there (RLS tested as each role) before any UI is built on top, per D-09's SECURITY DEFINER requirement and Pitfall 2.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `2.110.0` | Core Supabase JS client — auth, database, admin API (used by seed script) | Official client; confirmed `latest` dist-tag via `npm view` 2026-07-03. `3.0.0-next.*` exists but is a prerelease line — do not adopt. [VERIFIED: npm registry] |
| `@supabase/ssr` | `0.12.0` | Cookie-aware `createBrowserClient` / `createServerClient` factories for the App Router SSR pattern | Official successor to deprecated `@supabase/auth-helpers-*`; confirmed `latest` dist-tag via `npm view` 2026-07-03. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/auth-js` types (bundled) | via `@supabase/supabase-js` | `User`, `Session`, `AuthError`, `AuthApiError` types | Do not install separately — re-export/wrap in `packages/supabase` for `FishAuthClaims` and form error typing |
| Supabase CLI | not yet installed (see Environment Availability) | Local Postgres, migrations, `supabase gen types typescript --local`, Mailpit-backed local email | Required for D-13's local-only workflow this phase; must be installed before any migration/seed task can execute |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` cookie pattern | `@supabase/auth-helpers-nextjs` | Never for new code — explicitly deprecated, consolidated into `@supabase/ssr`, no longer receives fixes |
| Service-role TypeScript seed script (D-11) | Raw SQL `seed.sql` inserting into `auth.users` | Rejected by D-11 explicitly: raw inserts into `auth.users` bypass GoTrue's own logic (password hashing internals, trigger firing order) and can silently produce accounts that don't behave like real signups — the DB-01 trigger must fire exactly as production, which only happens through the real auth API |
| `getClaims()` for route gating in `proxy.ts` | `getUser()` in `proxy.ts` | `getUser()` is correct where the phase needs an unconditionally fresh record (rare here); `getClaims()` is officially preferred for ordinary "is this request authenticated" gating — verifies the JWT locally against JWKS instead of a network round-trip every navigation |

**Installation:**
```bash
# From apps/web
pnpm add @supabase/supabase-js@2.110.0 @supabase/ssr@0.12.0
```

**Version verification:** confirmed via `npm view @supabase/supabase-js version` → `2.110.0` and `npm view @supabase/ssr version` → `0.12.0`, both matching `dist-tags.latest`, checked 2026-07-03. `@supabase/supabase-js` published 2020-01-17 (long-lived, 770+ published versions); `@supabase/ssr` published 2023-09-06. Both under the official `supabase` GitHub org, MIT licensed, no `postinstall` scripts. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|--------------|-----------|-------------|
| `@supabase/supabase-js` | npm | 6 yrs (since 2020-01-17) | very high (official SDK, org-wide dependency) | github.com/supabase/supabase-js | not run — see below | Approved |
| `@supabase/ssr` | npm | 2.8 yrs (since 2023-09-06) | high (official Next.js/SSR SDK) | github.com/supabase/ssr | not run — see below | Approved |

**slopcheck unavailable:** `pip` is not present in this environment (`command not found: pip`), so `slopcheck` could not be installed and no `slopcheck install` run was possible. Per the graceful-degradation protocol, both packages are marked `[ASSUMED]` for the slopcheck-specific check, but the disposition above is still "Approved" because both were independently verified through a stronger signal: they are the **exact packages named in official Supabase documentation and the official `supabase/supabase` GitHub example repo**, not merely a package that happens to exist on the registry. This satisfies the package-name-provenance rule (official-docs-sourced, not WebSearch/training-only) at a higher bar than slopcheck would provide. The planner should still gate the initial `pnpm add` behind a `checkpoint:human-verify` per the degradation protocol, since the automated tool itself did not run.

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck did not run)
**Packages flagged as suspicious [SUS]:** none — both packages carry official-docs provenance independent of slopcheck

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │  Browser (Client Component forms)         │
                    │  /signup /login /forgot-password           │
                    │  /reset-password                            │
                    └───────────────┬─────────────────────────┘
                                    │ createBrowserClient()
                                    │ supabase.auth.signUp() / signInWithPassword()
                                    │ / resetPasswordForEmail() / updateUser()
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │  Supabase Auth (GoTrue) — hosted service   │
                    │  - creates auth.users row                   │
                    │  - fires handle_new_user trigger            │
                    │  - sends verify/reset email (Mailpit local) │
                    └───────────────┬─────────────────────────┘
                                    │ email link:
                                    │ {{SiteURL}}/auth/confirm?token_hash=...&type=...
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │  apps/web/app/auth/confirm/route.ts        │
                    │  (Route Handler, Node runtime)              │
                    │  supabase.auth.verifyOtp({token_hash,type}) │
                    │  → sets session cookie → redirect /home     │
                    └───────────────┬─────────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────────┐
                    │  apps/web/proxy.ts (every navigation)      │
                    │  createServerClient() + getClaims()         │
                    │  refresh cookies on request AND response    │
                    └───────────────┬─────────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────────┐
                    │  Server Components / Route Handlers         │
                    │  createServerClient() (apps/web/lib/        │
                    │  supabase/server.ts) + getUser()             │
                    │  reads profiles.role for display only        │
                    └───────────────┬─────────────────────────┘
                                    │ every query
                                    ▼
                    ┌─────────────────────────────────────────┐
                    │  Postgres (local Supabase / hosted)         │
                    │  auth.users (managed)                       │
                    │  ├─ trigger: handle_new_user (SECURITY      │
                    │  │  DEFINER) → INSERT public.profiles        │
                    │  public.profiles (RLS: own row only)         │
                    │  public.coach_clients (RLS via SECURITY      │
                    │  │  DEFINER helper fns, no recursion)         │
                    └─────────────────────────────────────────┘

Separate offline path (not a request-time flow):
    scripts/seed.ts (Node, service-role key)
      → supabase.auth.admin.createUser({ email_confirm: true })
      → same handle_new_user trigger fires (real auth machinery)
      → INSERT public.coach_clients (service role bypasses RLS)
```

A reader can trace: form submit -> GoTrue -> email -> `/auth/confirm` -> session cookie -> `/home`, and separately: seed script -> admin API -> same trigger -> `coach_clients` rows, all before this phase ships.

### Recommended Project Structure

```
apps/web/
├── app/
│   ├── login/page.tsx                 # D-02: top-level route
│   ├── signup/page.tsx                # D-02: top-level route
│   ├── forgot-password/page.tsx       # D-02: top-level route
│   ├── reset-password/page.tsx        # D-02: single-field "set new password"
│   ├── home/page.tsx                  # D-01: interim authenticated placeholder
│   ├── check-inbox/page.tsx           # D-05: shared by signup AND unverified-login (Claude's discretion: exact path)
│   ├── expired-link/page.tsx          # D-06: shared by verify AND reset expired/used links
│   └── auth/
│       └── confirm/route.ts           # D-02: the ONLY namespaced route — token_hash verifyOtp handler
├── lib/
│   └── supabase/
│       ├── client.ts                  # createBrowserClient — Client Components
│       ├── server.ts                  # createServerClient — Server Components/Route Handlers
│       └── proxy.ts                   # updateSession() helper consumed by proxy.ts
├── proxy.ts                           # Next.js 16 middleware rename, project root
supabase/
├── config.toml                        # gains [auth], [auth.email], password min length, SMTP (local = Mailpit default)
├── migrations/
│   ├── <ts>_profiles.sql              # table + RLS
│   ├── <ts>_handle_new_user.sql       # trigger, SECURITY DEFINER
│   ├── <ts>_coach_clients.sql         # table + UNIQUE(client_id) + RLS via SECURITY DEFINER helpers
│   └── <ts>_role_guard.sql            # blocks client-initiated role escalation
├── templates/
│   ├── confirmation.html              # D-15: FISH voice, token_hash link
│   └── recovery.html                  # D-15: FISH voice, token_hash link
└── seed.ts (or scripts/seed.ts)       # D-11: TypeScript admin script, pnpm script wrapper
packages/supabase/src/
├── auth.ts                            # FishAuthClaims, authRedirects (+/home per D-01)
└── database.types.ts                  # regenerated from real schema (supabase gen types)
```

### Pattern 1: Three-client Supabase setup (browser / server / proxy)

**What:** Three separate factory files, each scoped to its runtime context, sharing the cookie-aware `@supabase/ssr` contract.
**When to use:** Every Supabase read/write in this app — no ad-hoc `createClient()` calls outside these three factories.
**Example (browser client):**
```typescript
// Source: official supabase/supabase examples/auth/nextjs, verified via gh api 2026-07-02 (pinned in milestone STACK.md)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```
**Example (server client, Server Components / Route Handlers):**
```typescript
// Source: official supabase/supabase examples/auth/nextjs
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
**Example (`proxy.ts`, project root — Next.js 16 rename of `middleware.ts`):**
```typescript
// Source: official Next.js Proxy docs (nextjs.org/docs/app/getting-started/proxy) +
// official Supabase example lib/supabase/proxy.ts pattern
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
The `updateSession()` helper must: create `response` first, wire `getAll`/`setAll` to write to **both** `request.cookies` and `response.cookies`, call `getClaims()` immediately (no logic in between), and return that exact same `response` object (Pitfall 5).

### Pattern 2: Token-hash email verification (`/auth/confirm`, not `/auth/callback`)

**What:** A Route Handler that consumes `token_hash` + `type` query params and calls `verifyOtp()`, distinct from OAuth's `exchangeCodeForSession(code)` pattern (which this phase does not need — no OAuth).
**When to use:** Both signup verification (`type=email`, formerly `signup`) and password reset (`type=recovery`) route through this single handler — D-02 designates `/auth/confirm` as the only namespaced route.
**Example:**
```typescript
// Source: Supabase official docs "Email-based Auth with PKCE Flow for SSR"
// https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  // D-06: expired/used link → dedicated calm expired-link screen, not an error page
  return NextResponse.redirect(new URL('/expired-link', request.url))
}
```
This is the mechanism behind D-08 (email links land signed-in at `/home`) and D-06 (expired/used links route to the calm expired-link screen, since `verifyOtp` returns an error for an already-consumed or expired `token_hash`).

### Pattern 3: `handle_new_user` trigger — hardened, never blocks signup

**What:** A Postgres trigger on `auth.users` (`AFTER INSERT`) that creates the matching `public.profiles` row, hard-coding `role = 'client'` regardless of any client-supplied metadata.
**When to use:** DB-01's exact requirement — this is the only mechanism that fires for every signup path, including the web form AND the seed script's `admin.createUser()` calls (D-11 depends on this).
**Example:**
```sql
-- Source: Supabase official docs "Managing User Data" (User Management guide),
-- cross-verified against Supabase troubleshooting doc "Database error saving new user"
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
    'client', -- AUTH-01/D-04/DB-04: signup ALWAYS creates a client, never trust metadata for role
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing; -- idempotency: re-running signup logic never fails on a duplicate
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```
**Why "a failing trigger never silently blocks the signup" (phase success criterion 3) needs explicit handling:** a raw exception inside this trigger aborts the entire `auth.users` insert transaction (Postgres triggers run in the same transaction as the triggering statement) — there is no way to "catch and continue" a trigger failure while still creating the `auth.users` row, because trigger and row-insert are atomic. The correct hardening is therefore **prevention, not recovery**: `on conflict do nothing` for idempotency, a `display_name` that tolerates `null`/missing metadata via `coalesce`, `security definer` + `search_path = ''` so grants never fail, and a `NOT NULL` constraint on `profiles.role` with a `DEFAULT 'client'` as a second line of defense. Test this by signing up with minimal/malformed metadata against a real local Supabase instance (Pitfall 4) — not by trying to make the trigger recover from an exception after the fact, since there is no such recovery point.

### Pattern 4: `SECURITY DEFINER` RLS helper to avoid recursion on `coach_clients`

**What:** A `STABLE SECURITY DEFINER` function in a private (non-API-exposed) schema that looks up the coach-client relationship, called from RLS policies instead of a bare `SELECT` against the RLS-protected table itself.
**When to use:** Any policy on `profiles` or `coach_clients` that needs "is the current user the coach assigned to this client" (D-09).
**Example:**
```sql
-- Source: Supabase official RLS docs (row-level-security guide) +
-- Supabase GitHub discussion #1138 (infinite recursion pattern), cross-verified
create schema if not exists private;

create or replace function private.is_coach_of(client_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_clients cc
    where cc.client_id = client_uuid
      and cc.coach_id = (select auth.uid())
  );
$$;

-- profiles: a coach can read their assigned clients' rows
create policy "coach reads assigned clients"
  on public.profiles
  for select
  to authenticated
  using ( private.is_coach_of(id) );

-- profiles: a client reads only their own row
create policy "client reads own profile"
  on public.profiles
  for select
  to authenticated
  using ( id = (select auth.uid()) );
```
Wrap `auth.uid()` in `(select auth.uid())` inside every policy (init-plan caching, Pitfall/RLS-performance note) — do this from the first migration, not as a later optimization pass, since `messages`/`conversations` (next phase's foundation) will inherit this same pattern.

### Pattern 5: Role escalation guard (DB-04)

**What:** A trigger or `WITH CHECK` clause on `profiles` UPDATE that rejects any attempt by the row's own user to change their `role` column, while still allowing the service-role key (used by the seed script and any future admin tooling) to write it.
**When to use:** DB-04's exact requirement — "an authenticated user cannot escalate themselves to coach."
**Example:**
```sql
-- Approach: BEFORE UPDATE trigger that blocks role changes from non-service-role callers.
-- Service role bypasses RLS entirely by default, but an UPDATE policy alone does not
-- distinguish "changed every column except role" from "changed role" — a trigger does.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed by this caller';
  end if;
  return new;
end;
$$;

create trigger prevent_role_change
  before update on public.profiles
  for each row
  when (auth.role() = 'authenticated') -- service_role calls bypass this trigger's WHEN clause
  execute function public.prevent_role_self_escalation();
```
Verify with a **positive test**, not just code review: attempt a direct `profiles` UPDATE (or a raw `signUp` with `role: 'coach'` in metadata) as an authenticated client and confirm rejection — both the trigger above and the `handle_new_user` trigger hard-coding `'client'` must independently block escalation (defense in depth, per SUMMARY.md pitfall #3).

### Anti-Patterns to Avoid

- **`getSession()` anywhere server-side:** reads the cookie without server verification — a forged cookie passes. Use `getUser()` or `getClaims()` in `proxy.ts`, Server Components, and Route Handlers. Grep for `.getSession(` outside Client Components as an explicit review gate.
- **Bare `SELECT` against `profiles`/`coach_clients` inside their own RLS policies:** triggers "infinite recursion detected in policy for relation" (Postgres error `42P17`). Always route through a `SECURITY DEFINER` helper in a private schema.
- **Trusting `user_metadata` for role/authorization:** it is user-writable via `supabase.auth.updateUser()`. Role lives only in `profiles.role` (server-writable, RLS-protected) — never read `raw_user_meta_data` in an RLS policy or server authorization check.
- **Default `{{ .ConfirmationURL }}` email template:** implicit-flow tokens land in the URL fragment, invisible server-side. Every email template in this phase must point at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...`.
- **Second `NextResponse` construction in `proxy.ts` after the Supabase client's cookie handlers were wired to the first one:** silently drops the refreshed session cookie, causing random logouts. Create `response` once, return that exact object.
- **Raw SQL inserts into `auth.users` for the seed script:** explicitly barred by D-11 — bypasses GoTrue's own logic and the `handle_new_user` trigger's real firing conditions. Use `supabase.auth.admin.createUser({ email_confirm: true })`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Password hashing/storage | Custom bcrypt/argon2 wrapper | Supabase Auth (`auth.users`, managed by GoTrue) | AGENTS.md: "one backend service, no separate auth provider"; GoTrue already handles this correctly and is the system of record |
| Email verification token generation/expiry | Custom token table + expiry cron | Supabase Auth's built-in `token_hash` + `verifyOtp()` | Reinventing this reintroduces exactly the security surface (timing attacks, expiry races) Supabase Auth already handles |
| Session refresh / rotating cookies | Custom JWT refresh middleware | `@supabase/ssr`'s `getAll`/`setAll` cookie contract in `proxy.ts` | The exact cookie-write-to-both-request-and-response discipline is easy to get subtly wrong (Pitfall 5); the official package has already solved it |
| Role-based row filtering | Application-layer `WHERE user_id = ?` checks only | Postgres RLS policies | App-layer-only filtering is bypassable by any client that modifies its own request; RLS is enforced at the only tier the client cannot control (Database) |
| "Which coach owns this client" lookup inside a policy | Direct `SELECT` on the protected table from within its own policy | `SECURITY DEFINER STABLE` helper function in a private schema | Direct lookups recurse (Pitfall 2); this is a one-time correct pattern already documented above |
| Test user creation for seeding | Raw `INSERT INTO auth.users` | `supabase.auth.admin.createUser()` via service-role key | Raw inserts skip GoTrue's internal invariants and won't fire triggers identically to production signups (D-11) |

**Key insight:** every "don't hand-roll" item in this phase exists because Supabase Auth + Postgres RLS already solve it correctly, and every documented pitfall in this domain is a story of someone bypassing the official mechanism (via `getSession()`, `user_metadata`, raw SQL, or a policy that queries itself) rather than the mechanism being insufficient.

## Common Pitfalls

### Pitfall 1: Trusting `getSession()` server-side
**What goes wrong:** Middleware/Server Components read `getSession()` (or raw cookie/`user_metadata`) and treat it as verified identity — a forged cookie can pass.
**Why it happens:** `getSession()` is the first autocomplete result and works fine client-side; copy-pasted into server code without noticing the trust-boundary difference.
**How to avoid:** `getUser()` or `getClaims()` only, server-side, everywhere. No exceptions.
**Warning signs:** any `.getSession(` call inside `proxy.ts`, a Server Component, or a Route Handler.
[CITED: supabase.com/docs/guides/auth/server-side/nextjs — "Do not use getSession() for authorization decisions"]

### Pitfall 2: RLS policy recursion on `profiles`/`coach_clients`
**What goes wrong:** A policy queries the same (or another RLS-protected) table inside its own `USING` clause → Postgres error `42P17` "infinite recursion detected in policy for relation."
**Why it happens:** Role/relationship data naturally lives in the exact tables RLS protects — this is the default shape of a coach/client check, not an edge case.
**How to avoid:** Every role/relationship lookup used inside a policy goes through a `SECURITY DEFINER STABLE` function in a private (non-API) schema (Pattern 4 above).
**Warning signs:** a bare subquery against `profiles` or `coach_clients` inside their own policy definitions.
[CITED: supabase.com/docs/guides/database/postgres/row-level-security; GitHub discussion supabase/supabase#1138]

### Pitfall 3: Role trusted client-side / stored in `user_metadata`
**What goes wrong:** App code or RLS reads `user_metadata`/`raw_user_meta_data` for authorization — user-writable via `updateUser()`, so a client can self-promote to coach.
**Why it happens:** Role is needed in the UI immediately; it's tempting to treat the same client-visible value as the enforcement mechanism.
**How to avoid:** Role lives only in `profiles.role` (server-writable). `handle_new_user` hard-codes `'client'` regardless of signup metadata (Pattern 3). A role-change guard trigger blocks self-escalation (Pattern 5). Verify with a positive test: attempt self-registration/self-update as coach via direct API call, confirm rejection at both layers.
**Warning signs:** any RLS policy or server check referencing `auth.jwt() -> 'user_metadata'` or `raw_user_meta_data`.
[CITED: supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac]

### Pitfall 4: `handle_new_user` trigger blocks all signups
**What goes wrong:** If the trigger isn't `SECURITY DEFINER`, lacks grants, or violates a constraint, the *entire signup transaction* fails — "Database error saving new user," nobody can sign up.
**Why it happens:** `auth.users` is owned by `supabase_auth_admin`, which has minimal grants outside `auth` by design; tutorials often omit `security definer`/`search_path` hardening.
**How to avoid:** `security definer`, `set search_path = ''`, `on conflict (id) do nothing` for idempotency, `coalesce()` around any optional metadata field, `NOT NULL DEFAULT 'client'` on `profiles.role` as defense in depth (Pattern 3). Test signup against a real local Supabase instance, not a mocked client — this failure mode is invisible to pure frontend testing.
**Warning signs:** "Database error saving new user" from `signUp()`; any migration creating the trigger function without `security definer`.
[CITED: supabase.com/docs/guides/troubleshooting/database-error-saving-new-user-RU_EwB]

### Pitfall 5: `proxy.ts` drops the refreshed session cookie
**What goes wrong:** A second `NextResponse` is constructed after cookies were written to the first one (or logic runs between client creation and the verification call), silently detaching the refresh from what's actually returned — users get randomly logged out after token expiry.
**Why it happens:** The `getAll`/`setAll` contract requires writing to *both* `request.cookies` and `response.cookies`; it's easy to accidentally short-circuit this with an early return for a "public route" check placed above the auth call.
**How to avoid:** Create `response` once, wire cookie handlers to both request and response immediately, call `getClaims()`/`getUser()` with no logic in between, return that exact `response` object (Pattern 1).
**Warning signs:** more than one `NextResponse.next()`/`NextResponse.redirect()` construction in `proxy.ts`, or any logic between client creation and the verification call.
[CITED: official Next.js/Supabase SSR middleware example, pinned in milestone STACK.md]

### Pitfall 6: Email verification/reset breaks via `{{ .ConfirmationURL }}` / `/auth/callback` confusion
**What goes wrong:** Default Supabase templates use `{{ .ConfirmationURL }}` (implicit flow, tokens in URL fragment — unreadable server-side). Building only an OAuth-style `/auth/callback` expecting a `code` param while the email sends `token_hash` means every confirmation/reset link errors.
**Why it happens:** Most "Supabase + Next.js" tutorial content covers OAuth (`/auth/callback`) since it's the flashier flow; email/password verification gets less coverage despite being what this project needs first.
**How to avoid:** Update both templates (confirmation, recovery) to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...`. Implement only `/auth/confirm` (Pattern 2) — no OAuth callback needed this phase. Handle the "already consumed" case (email link-scanners can pre-fetch and burn the token) gracefully via D-06's expired-link screen, never a raw error.
**Warning signs:** confirmation link lands showing `#access_token=` in the URL bar with no session; "link is invalid or expired" reported by users confident they clicked promptly.
[CITED: supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr]

### Pitfall 7: Supabase CLI / Docker unavailable blocks the entire phase's dev loop
**What goes wrong:** D-13 requires `supabase start` (local Postgres + Auth + Mailpit) for every migration, seed, and manual verification task in this phase. If the CLI isn't installed or Docker isn't running, no task that touches the database can execute.
**Why it happens:** This is a fresh environment — neither the Supabase CLI nor a running Docker daemon were present when this research ran (verified directly, see Environment Availability).
**How to avoid:** Treat CLI + Docker installation/startup as an explicit Wave 0 / setup task, not an assumed precondition. Verify `supabase --version` and `docker info` succeed before any migration task is attempted.
**Warning signs:** `supabase start` fails with a Docker connection error; `command not found: supabase`.
**Phase to address:** must be resolved before any DB-01..04 task begins — this is the literal first blocking dependency of the phase.

## Code Examples

### Env var layout (Claude's discretion per CONTEXT.md — recommended pattern)
```bash
# apps/web/.env.local (gitignored)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local anon/publishable key from `supabase status`>

# Seed script only — NEVER prefixed NEXT_PUBLIC_, never committed
SUPABASE_SERVICE_ROLE_KEY=<local service_role key from `supabase status`>
```
```bash
# apps/web/.env.example (committed)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Confirm at implementation time whether the local Supabase instance issues the new-style `sb_publishable_...` keys or legacy `anon` keys (`supabase status` output shows current key) — the milestone STACK.md flags this as unresolved until checked against the actual linked/local project. [ASSUMED — see Assumptions Log A1]

### Seed script skeleton (D-10, D-11)
```typescript
// Source: pattern per D-11 + Supabase official admin API docs
// (supabase.com/docs/reference/javascript/admin-api), cross-verified via WebSearch 2026-07-03
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role — bypasses RLS, admin API only
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function upsertUser(email: string, password: string, displayName: string) {
  // Idempotent: look up by email first: admin.listUsers() + filter, or
  // catch the "already registered" error and fetch existing user id.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pre-verified — no email round-trip needed for seed accounts
    user_metadata: { display_name: displayName },
  })
  if (error && !error.message.includes('already been registered')) throw error
  return data?.user
}
```
`email_confirm: true` marks the seed accounts pre-verified without sending a confirmation email — confirmed via Supabase's official Admin API reference. [VERIFIED: WebSearch cross-checked against supabase.com/docs/reference/javascript/admin-api]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | consolidated, `auth-helpers-*` no longer receives fixes | Any tutorial referencing `auth-helpers-nextjs` is stale; use `@supabase/ssr` |
| `middleware.ts` | `proxy.ts` (Next.js 16) | Next.js 16 rename | `middleware.ts` still works but is deprecated and runs on Edge runtime vs. `proxy.ts`'s Node runtime |
| `{{ .ConfirmationURL }}` default email template | `{{ .SiteURL }}/auth/confirm?token_hash=...&type=...` + `verifyOtp()` | PKCE/SSR guidance | Fragment-based tokens are unreadable server-side; every email template in this phase must be rewritten (also required by D-15's voice pass) |
| `getUser()` everywhere server-side | `getClaims()` for routine gating, `getUser()` reserved for cases needing a guaranteed-fresh record | Oct 2025 (asymmetric JWT signing keys, Supabase blog "Introducing JWT Signing Keys") | `getClaims()` verifies locally against JWKS (no round trip); still never use `getSession()` for either |

**Deprecated/outdated:**
- `@supabase/auth-helpers-*` (all framework variants) — explicitly superseded by `@supabase/ssr`.
- Legacy `anon`/`service_role` key naming is being phased out in favor of `sb_publishable_...`/`sb_secret_...`, though both work simultaneously during the transition — confirm which format the actual local instance issues before locking env var names (Assumptions Log A1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Local Supabase instance issues `sb_publishable_...`/new-style keys (vs legacy `anon` key) | Code Examples (env vars) | Low — env var *value* differs, not the pattern; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` naming works for both per the official example repo's `.env.example`, confirm against actual `supabase status` output at implementation time |
| A2 | `email_confirm: true` on `admin.createUser()` does not trigger a confirmation email send | Code Examples (seed script) | Low — confirmed via WebSearch against Supabase's own admin API reference language; if wrong, seed accounts would receive an unwanted email in local dev (Mailpit-only, no real send) — cosmetic, not a security or correctness risk |
| A3 | The role-escalation guard trigger's `when (auth.role() = 'authenticated')` clause correctly excludes `service_role`-key calls (used by the seed script for any future role reassignment) | Pattern 5 | Medium — if the `WHEN` clause doesn't correctly distinguish service-role calls, the seed script's reassignment path (D-12 "reassignment replaces") could be blocked by its own guard; verify with a direct test during implementation (attempt a service-role `UPDATE profiles SET role = ...` and confirm it succeeds) before relying on this pattern in the seed script |

**Note:** the vast majority of this research inherits `[CITED]`/`[VERIFIED]` status directly from the milestone-level `.planning/research/{STACK,PITFALLS,ARCHITECTURE,SUMMARY}.md`, which was independently verified via Context7, official docs WebFetch, and `gh api` against the official `supabase/supabase` example repo on 2026-07-02 (HIGH confidence per that research's own Metadata section). This document's `[ASSUMED]` tags are limited to the small set of details (exact key-naming format on this specific project's instance, seed-script trigger interaction) that could not be verified without a running local Supabase instance, which was unavailable in this research session (see Environment Availability).

## Open Questions

1. **Exact Supabase key format issued by this project's local instance**
   - What we know: both legacy `anon`/`service_role` and new-style `sb_publishable_.../sb_secret_...` key formats work simultaneously during Supabase's migration window; the official example repo's `.env.example` uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` naming regardless of which format the actual key value takes.
   - What's unclear: which format `supabase start` on this machine will actually issue, since the CLI wasn't installed at research time.
   - Recommendation: resolve trivially at implementation time by running `supabase status` after `supabase start` and reading the printed key — do not block planning on this, it's a copy-paste detail, not a design decision.

2. **Whether `packages/supabase/src/database.types.ts` should be regenerated immediately after each migration or once at the end of the DB work**
   - What we know: `supabase gen types typescript --local` is the standard command (STACK.md); the file currently has hand-written types for `profiles`/`conversations`/`messages` that don't yet match the real schema this phase creates.
   - What's unclear: whether the plan should treat type generation as one task per migration (safer, more commits) or one task after all migrations land (fewer redundant regenerations).
   - Recommendation: planner's call — either is correct, but the final task before auth screens consume `packages/supabase` types must include a fresh `supabase gen types` run against the actual final schema, otherwise TypeScript will not catch schema drift.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Supabase CLI | Local migrations, `supabase gen types`, seed script execution, Mailpit email capture (D-13) | ✗ | — | None — must be installed before any DB-01..04 task. Install via `brew install supabase/tap/supabase` (macOS) or npm one-off `npx supabase@latest` per official docs; confirm exact command at Wave 0 |
| Docker | Backing runtime for `supabase start` (local Postgres, GoTrue, Mailpit, etc.) | Binary present (`/usr/local/bin/docker`), daemon **not running** | — | None — Docker Desktop (or Colima/OrbStack equivalent) must be started manually before `supabase start` will succeed. This is a machine-level action outside what any task script can automate reliably; flag as a human prerequisite step |
| Node.js | Seed script execution, Next.js dev/build | ✓ | v25.9.0 | — |
| npm registry access | Installing `@supabase/supabase-js`, `@supabase/ssr` | ✓ | — | — |
| `pip`/`slopcheck` | Package legitimacy automated check | ✗ | — | Both recommended packages independently verified via official-docs provenance instead (see Package Legitimacy Audit) — no functional fallback needed for this phase's two packages, but any *additional* package considered during planning/execution should get a manual npm-registry + GitHub-repo check since slopcheck remains unavailable |

**Missing dependencies with no fallback:**
- Supabase CLI — blocks every DB-01..04 task and the seed script until installed. This must be an explicit early task/checkpoint in the plan, not assumed.
- Running Docker daemon — blocks `supabase start`. The plan should include a `checkpoint:human-verify` (or equivalent) step asking the user to start Docker Desktop before migration tasks proceed, since this cannot be scripted reliably across machines/sandboxes.

**Missing dependencies with fallback:**
- `slopcheck`/`pip` — no fallback needed for the two packages already verified in this research; future package additions during execution should get a manual check (npm registry + GitHub repo + official docs mention) in lieu of the automated tool.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x (already installed per Phase 1, `apps/web/package.json`) |
| Config file | `apps/web/vitest.config.ts` (exists from Phase 1) |
| Quick run command | `pnpm --filter @fish/web test -- <pattern>` |
| Full suite command | `pnpm --filter @fish/web test` (must keep the existing 71 passing tests green) |

**Important scope note:** Vitest + jsdom + RTL is the correct tool for **UI-layer** tests (form validation states, Alert/Input rendering on auth screens) but **cannot** exercise real Supabase Auth flows, RLS policies, or Postgres triggers — those require a running local Supabase instance and are NOT unit-testable in the jsdom sandbox. This phase's most important verifications (Pitfall 2's recursion check, Pitfall 4's trigger hardening, DB-04's escalation guard) are **manual/SQL verification steps against local Supabase**, not Vitest tests. Do not force these into the Vitest suite — plan them as explicit manual verification tasks instead (see Wave 0 Gaps).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| AUTH-01 | Signup form validates + always creates client role | unit (form) | `pnpm --filter @fish/web test -- signup` | ❌ Wave 0 |
| AUTH-02 | Verification email sent, check-inbox screen renders single action | unit (screen render) + manual (email delivery via Mailpit) | `pnpm --filter @fish/web test -- check-inbox` | ❌ Wave 0 |
| AUTH-03 | Login form validates, submits, redirects | unit (form) | `pnpm --filter @fish/web test -- login` | ❌ Wave 0 |
| AUTH-04 | Password reset email + single-field set-new-password screen | unit (screen render) + manual (email + link click via Mailpit) | `pnpm --filter @fish/web test -- reset-password` | ❌ Wave 0 |
| AUTH-05 | Session persists across refresh/restart | manual (browser test: refresh, close/reopen browser, confirm still authenticated) | none automatable in Vitest/jsdom | N/A — manual only |
| AUTH-06 | Logout from authenticated screen | unit (button renders + calls signOut) + manual (confirm redirect + cookie cleared) | `pnpm --filter @fish/web test -- home` | ❌ Wave 0 |
| DB-01 | Profile row auto-created on signup, trigger never blocks signup | manual (SQL: real signup against local Supabase, verify `profiles` row exists; malformed-metadata signup attempt) | `supabase db reset` + manual signup via UI or curl | N/A — manual/SQL only |
| DB-02 | `coach_clients` table + seed script creates coach + assigns clients | manual (run seed script, query `coach_clients` for expected rows) | `pnpm seed` (script name per Claude's discretion) then SQL check | N/A — manual/SQL only |
| DB-03 | RLS on every table — client sees own data only, coach sees own assigned clients only | manual (SQL: run identical `SELECT` as three different authenticated roles — client A, client B, coach — confirm boundary) | manual `psql` or Supabase Studio SQL editor with role-switching | N/A — manual/SQL only |
| DB-04 | Role stored/enforced server-side, no self-escalation | manual (attempt direct API `signUp` with `role: 'coach'` metadata; attempt authenticated `UPDATE profiles SET role='coach'`; both must fail) | manual API call (curl/Postman) or a small verification script | N/A — manual/SQL only |

### Sampling Rate
- **Per task commit:** `pnpm --filter @fish/web test -- <affected pattern>` for UI-layer changes; for DB migrations, `supabase db reset` (re-applies all migrations + seed cleanly) as the equivalent "quick run"
- **Per wave merge:** full `pnpm --filter @fish/web test` suite (all 71+ existing tests plus new auth-screen tests) AND a full manual pass of the RLS/trigger/role-escalation checks above
- **Phase gate:** all four "must be TRUE" success criteria manually walked end-to-end (signup → verify email via Mailpit → land at /home; login → refresh → restart browser → still in; logout; forgot-password → reset link → land at /home; seed script run; RLS boundary checks as each of the 4 seeded accounts) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/app/signup/page.tsx` + test — no auth screens exist yet
- [ ] `apps/web/app/login/page.tsx` + test
- [ ] `apps/web/app/forgot-password/page.tsx` + test
- [ ] `apps/web/app/reset-password/page.tsx` + test
- [ ] `apps/web/app/home/page.tsx` + test
- [ ] `apps/web/app/check-inbox/page.tsx` (or chosen path) + test
- [ ] `apps/web/app/expired-link/page.tsx` (or chosen path) + test
- [ ] `apps/web/app/auth/confirm/route.ts` — Route Handler, cannot be unit-tested in jsdom (no Route Handler test harness in current Vitest config) — plan a manual verification step instead
- [ ] `apps/web/lib/supabase/{client,server,proxy}.ts` — no test harness exists for these; Supabase client factories are typically verified via the manual DB-01..04 checks above, not unit tests
- [ ] Supabase CLI install + `supabase start` — blocking prerequisite, see Environment Availability
- [ ] First migration files — none exist; `supabase/migrations/` directory does not yet exist in the repo

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | yes | Supabase Auth (GoTrue) — email/password, 8-char minimum (D-16), no custom auth logic |
| V3 Session Management | yes | `@supabase/ssr` cookie-based sessions, `getUser()`/`getClaims()` server-side verification, `proxy.ts` refresh discipline (Pattern 1) |
| V4 Access Control | yes | Postgres RLS on every table (DB-03), `SECURITY DEFINER` helpers (Pattern 4), role-escalation guard trigger (Pattern 5) |
| V5 Input Validation | yes | Supabase Auth's own email/password validation server-side; client-side form validation via Input's notice/error tiers is UX only, never the security boundary |
| V6 Cryptography | yes | Password hashing entirely delegated to GoTrue — never hand-rolled (Don't Hand-Roll table) |

### Known Threat Patterns for Supabase Auth + Next.js SSR

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Cookie/session forgery via `getSession()` trust | Spoofing | `getUser()`/`getClaims()` only, server-side (Pitfall 1) |
| RLS policy recursion → query failure or accidental policy bypass during a fix-under-pressure | Denial of Service / Elevation of Privilege | `SECURITY DEFINER STABLE` helper functions in a private schema (Pattern 4) |
| Client self-escalation via `user_metadata`/`updateUser()` | Elevation of Privilege | Role lives only in `profiles.role`; role-change guard trigger (Pattern 5); `handle_new_user` hard-codes `'client'` (Pattern 3) |
| Account enumeration via differing forgot-password responses | Information Disclosure | D-07: identical success message regardless of whether the email has an account |
| Email link pre-fetch by scanners burning single-use tokens | Denial of Service (self-inflicted UX failure, not an attacker) | D-06: expired/used link lands on a calm dedicated screen with a resend action, never a raw error |
| Session cookie leak via CDN/ISR caching | Information Disclosure | No caching configured on auth-cookie-setting routes this phase (no CDN/ISR in scope yet — flag for when caching is added later) |

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/SUMMARY.md` — milestone-level research, independently verified via Context7 (`/supabase/ssr`), `gh api` against `supabase/supabase` example repo, and official docs WebFetch on 2026-07-02. HIGH confidence per that research's own Metadata section.
- `npm view @supabase/supabase-js version` / `dist-tags.latest` / `time.created` — direct registry query, 2026-07-03, confirms `2.110.0`, published 2020-01-17
- `npm view @supabase/ssr version` / `dist-tags.latest` / `time.created` — direct registry query, 2026-07-03, confirms `0.12.0`, published 2023-09-06
- Direct filesystem inspection: `apps/web/app/globals.css`, `packages/supabase/src/{auth,database.types}.ts`, `packages/core/src/roles.ts`, `supabase/config.toml`, `package.json` files — confirms current repo state (no Supabase deps, no migrations, no auth routes) as of 2026-07-03

### Secondary (MEDIUM confidence)
- [Supabase User Management guide](https://supabase.com/docs/guides/auth/managing-user-data) — `handle_new_user` trigger pattern, `security definer set search_path = ''`, via WebSearch cross-referencing official docs content, 2026-07-03
- [Supabase Admin API reference](https://supabase.com/docs/reference/javascript/admin-api) — `admin.createUser({ email_confirm: true })` behavior, via WebSearch, 2026-07-03
- [Seeding your database — Supabase Docs](https://supabase.com/docs/guides/local-development/seeding-your-database) — seed.sql vs TypeScript admin script tradeoff, via WebSearch, 2026-07-03, confirms D-11's approach

### Tertiary (LOW confidence)
- None used directly in this document — all WebSearch findings above were cross-verified against official Supabase docs URLs returned in the same search and are consistent with the already-HIGH-confidence milestone research, so none remain at LOW confidence.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions directly confirmed via `npm view` this session, patterns inherited from HIGH-confidence milestone research verified against official example repo
- Architecture: HIGH — three-client pattern, trigger pattern, and RLS helper pattern all sourced from official Supabase docs/examples, cross-checked this session
- Pitfalls: HIGH — all six pitfalls inherited from milestone PITFALLS.md (cross-verified against official docs + GitHub discussions), plus one new environment-specific pitfall (Supabase CLI/Docker unavailability) discovered and verified directly in this session

**Research date:** 2026-07-03
**Valid until:** 30 days (Supabase Auth/RLS patterns are stable; re-verify package versions if execution starts more than ~2 weeks after this date, since `@supabase/supabase-js` ships frequent minor releases)
