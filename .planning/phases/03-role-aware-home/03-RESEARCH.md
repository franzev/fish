# Phase 3: Role-aware home - Research

**Researched:** 2026-07-04
**Domain:** Next.js 16 App Router route protection + role-based redirects on Supabase SSR auth, RLS policy extension, app-shell composition from an existing monochrome kit
**Confidence:** HIGH

## Summary

This phase has no new external dependencies — it composes Next.js 16 App Router primitives (route groups, nested layouts), the already-integrated `@supabase/ssr` client factories, and the existing Phase 1 kit (`Button`, `Card`) on top of the real schema and seed data Phase 2 already shipped. The seed data is live and unconditional: `Coach Dana` (coach@fish.dev) with three assigned clients (`Alex Rivera`, `Sam Okafor`, `Priya Nair`), verified against `scripts/seed.ts` and `scripts/verify-rls.ts`.

The single most important finding from this research is a **gap between what STATE.md's accumulated pitfalls claim and what Phase 2's actual migrations shipped**: STATE.md says "role stored in profiles + mirrored to app_metadata via trigger," but grepping every migration file and `scripts/seed.ts` for `app_metadata`/`raw_app_meta_data` returns zero matches. `profiles.role` is the *only* place role lives today. This means the planner cannot read role from a JWT claim in `proxy.ts` — either the planner adds the missing mirroring trigger this phase (recommended, see Pitfall 1 below), or role-aware routing reads `profiles.role` via a database query at the point of decision (Server Component layout, not middleware). Both paths are viable; CONTEXT.md leaves this exact decision to Claude's discretion, and this research provides the concrete tradeoff so the planner can commit to one.

The second load-bearing finding: **D-16's client-reads-coach-name allowance does not exist in the current schema.** Migration `0004_rls_helpers.sql` only grants a coach the ability to read *their assigned clients'* profile rows (`is_coach_of()`); there is no reverse policy letting a client read their *own coach's* profile row. This phase must add a new migration with a new SECURITY DEFINER helper (`is_client_of()`, mirroring the existing `is_coach_of()` shape) plus a new SELECT policy on `profiles`.

**Primary recommendation:** Use Next.js 16 route groups (`(client)`/`(coach)`, or a single `(authenticated)` group with per-role subfolders) with one shared server-component `layout.tsx` that performs the auth+role check once via `getUser()` and a `profiles.role` query, and lets `proxy.ts` stay session-refresh-only (its documented, tested contract from Phase 2 — do not add authorization logic there per its own header comment). Add the missing `is_client_of()` RLS helper + policy in a new migration (`0006_client_reads_coach_name.sql`) before writing any client-home page that needs the coach's name.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signed-out redirect to `/login` | Frontend Server (SSR) | — | Enforced in a Server Component layout via `getUser()` — the same pattern already proven in `apps/web/app/home/page.tsx`; Next.js 16 middleware (`proxy.ts`) is explicitly reserved for session-refresh only per its own Phase 2 contract comment |
| Role-based redirect (client → `/home`, coach → `/coach`) | Frontend Server (SSR) | Database / Storage | Role must be resolved from `profiles.role` (DB read) unless a mirroring trigger is added; the redirect decision itself is an SSR concern (Server Component `redirect()`) |
| Coach's client list (own clients only) | Database / Storage | Frontend Server (SSR) | RLS (`coach_clients` + `is_coach_of()`) is the actual security boundary; the Server Component just calls `.select()` and trusts RLS to scope rows, per AGENTS.md's API boundary rule |
| App shell (nav bar + content column) | Frontend Server (SSR) | Browser / Client | Shell renders server-side (name, layout) with one client island for the logout button, mirroring the existing `/home` + `LogoutButton` pattern |
| Empty-state copy/icon | Browser / Client (render) | Frontend Server (SSR) | Pure presentational; the *condition* deciding which empty state shows (assigned vs. unassigned) is resolved server-side from the DB read |
| Client-reads-coach-name RLS allowance | Database / Storage | — | New SECURITY DEFINER helper + policy; must not be a bare `SELECT` inside its own policy (Pitfall 2, established in Phase 2) |
| Silent redirect on wrong-role URL / signed-in-visits-auth-page | Frontend Server (SSR) | — | Same layout-level check as role-based redirect; no separate mechanism needed — it's the same `role !== expectedRole` branch applied to more routes |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.12.0 `[VERIFIED: npm registry]` | Cookie-aware Supabase client factories (browser/server/proxy) | Already pinned and integrated in Phase 2; official Supabase SSR library, no alternative exists for this pattern |
| `@supabase/supabase-js` | 2.110.0 `[VERIFIED: npm registry]` | Underlying Supabase client (auth, postgrest) | Peer dependency of `@supabase/ssr`; already pinned |
| `next` | 16.2.9 `[VERIFIED: npm registry — installed version matches project]` | App Router, route groups, layouts, `proxy.ts` middleware rename | Locked stack (AGENTS.md); this phase uses only stable App Router features (route groups, nested layouts) unchanged since Next.js 13 |
| `@tabler/icons-react` | 3.44.0 `[VERIFIED: npm registry]` | Empty-state icon (D-17) | Already the sole icon source (TOKN-06, test-enforced by `tests/icon-source.test.ts`) |

No new packages are required for this phase — it is composed entirely from already-installed dependencies plus new application code (routes, a layout, one migration). A Package Legitimacy Audit table is not applicable; skipping per the "no external dependencies installed" condition.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` / `tailwind-merge` (via `cn()`) | 2.1.1 / 2.6.0 (existing) | Conditional classes for shell/list/empty-state components | Every new component, per existing convention |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Route-group layout for auth+role gating | `proxy.ts` middleware doing the redirect | Middleware runs on every navigable request including static-adjacent paths and cannot easily do a full RLS-respecting DB read without extra latency; it also already has a documented, tested, narrow contract ("session refresh only... route protection does NOT live here") from Phase 2 that a planner should not silently expand. Layout-level `getUser()` + `profiles` read matches the proven `/home` precedent and keeps `proxy.ts`'s existing test/contract surface unchanged. |
| DB read for role in a Server Component layout | JWT `app_metadata.role` claim read via `getClaims()`/`getUser()` | Requires adding the missing mirroring trigger (not yet present — see Pitfall 1) and accepting a staleness window (role changes don't reflect until next login). Given this project's scale (0-1k users, seed-only role changes) and the "no query-per-request bottleneck" note in `.planning/research/ARCHITECTURE.md`'s scaling table, either approach is acceptable; the DB-read path is zero-risk-of-staleness and requires no new trigger, so it is the safer default if the planner wants to minimize new surface area this phase. |

**Installation:** None required — no new packages.

**Version verification:** All four core packages confirmed live-installed and current via `npm view <pkg> version` (see table above); no drift from what `apps/web/package.json` already pins.

## Package Legitimacy Audit

Not applicable — this phase installs no new external packages. Skipping per the package-legitimacy-gate's own scope (audit is required "whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
[Browser navigates to any URL]
        |
        v
[proxy.ts matcher: all non-static routes]
        |
        v
[updateSession() — Phase 2's existing session-refresh-ONLY contract]
   - getClaims() runs, refreshes cookies on request + response
   - NO redirect/authorization logic added here this phase
        |
        v
[Route resolves to a Server Component tree]
        |
        +---> Public allowlist route (/login, /signup, /kit, ...)
        |         |
        |         v
        |     [Page reads getUser() itself if it needs to know
        |      "am I already signed in?" for D-05's silent redirect]
        |         |
        |         +--> signed in --> redirect(roleHome)
        |         +--> signed out --> render public page
        |
        +---> Protected route (/home, /coach, everything else by default-deny)
                  |
                  v
              [Authenticated layout/guard: getUser()]
                  |
                  +--> no user --> redirect('/login')   [ROUT-01]
                  |
                  v
              [Resolve role: query profiles.role for auth.uid()
               OR read mirrored app_metadata.role claim
               — planner picks ONE, see Pitfall 1]
                  |
                  +--> role === 'client' && path === '/coach'  --> redirect('/home')   [D-03]
                  +--> role === 'coach'  && path === '/home'   --> redirect('/coach')  [D-03]
                  |
                  v
              [Shell renders: top bar (logo, name, logout) + content column]
                  |
                  +---> /home (client)
                  |        |
                  |        v
                  |    [Query: does a coach_clients row exist for auth.uid()?]
                  |        |
                  |        +--> no   --> "We're getting things ready for you" empty state
                  |        +--> yes  --> read coach's display_name (NEW RLS policy)
                  |                       --> "Your coach [name] is setting things up"
                  |
                  +---> /coach (coach)
                           |
                           v
                       [Query: supabase.from('profiles').select() —
                        RLS scopes to own row + is_coach_of() rows automatically,
                        per AGENTS.md's "no manual .eq(coach_id,...)" API boundary]
                           |
                           +--> 0 client rows --> calm empty state
                           +--> N client rows --> alphabetical stacked list, Card + dividers
```

### Recommended Project Structure
```
apps/web/app/
├── (public)/                    # optional route group; OR keep flat if simpler —
│   ├── login/page.tsx           #   route groups are organizational only, add no URL segment
│   ├── signup/page.tsx
│   └── ...(existing auth screens, unchanged)
├── (authenticated)/              # NEW — route group, no URL segment added
│   ├── layout.tsx                 # NEW — the one auth+role guard + shell wrapper
│   ├── home/page.tsx              # PROMOTED from Phase 2 placeholder — real client home
│   └── coach/page.tsx             # NEW — coach home
├── page.tsx                      # REWRITTEN per D-02 — pure redirect, no rendered content
└── kit/page.tsx                   # unchanged, stays in the public allowlist (D-06)

apps/web/components/
├── shell/                         # NEW — naming/location is Claude's discretion (CONTEXT.md)
│   ├── app-shell.tsx               # top bar: logo + name + logout, content column wrapper
│   └── app-shell.test.tsx
├── coach/                         # NEW
│   ├── client-list.tsx             # Card + divide-y rows, alphabetical
│   └── client-list.test.tsx
├── home/                          # NEW — or co-locate in app/(authenticated)/home/
│   ├── empty-state.tsx             # shared shape for both empty states (icon + copy)
│   └── empty-state.test.tsx
└── auth/
    └── logout-button.tsx           # UNCHANGED, relocates into app-shell.tsx's usage site

supabase/migrations/
└── 0006_client_reads_coach_name.sql   # NEW — is_client_of() helper + profiles SELECT policy
```

**Note on route groups vs. flat structure:** Route groups (parenthesized folder names like `(authenticated)`) are a stable, unchanged Next.js App Router feature — a folder wrapped in parens is excluded from the URL path but can hold a shared `layout.tsx` that wraps every page nested inside it `[CITED: nextjs.org/docs/app/getting-started/layouts-and-pages — confirms nested layouts wrap children via the children prop; parenthesized route-group folders adding no URL segment is stable/long-standing Next.js App Router behavior, unchanged since introduction — ASSUMED not re-verified this session beyond the general layout-nesting mechanism, which WAS freshly confirmed against the official doc, lastUpdated 2026-06-23]`. This is Claude's discretion per CONTEXT.md — a flat `app/home/` + `app/coach/` structure with each page independently calling a shared `requireRole()` helper function works equally well and avoids introducing a new folder-naming concept if the planner prefers fewer moving parts. Recommendation: use the route group + shared layout — it structurally guarantees the guard runs exactly once and cannot be forgotten on a new route added later, which directly serves the default-deny model (D-06).

### Pattern 1: Server Component role guard in a shared authenticated layout

**What:** One `layout.tsx` inside `app/(authenticated)/` calls `getUser()`, redirects if absent, resolves role, and redirects on role/path mismatch — all before rendering `{children}`. Every page nested inside this group (both `/home` and `/coach`) is guaranteed protected without repeating the check.

**When to use:** Whenever two or more routes need the identical "signed in + correct role" precondition — exactly this phase's `/home` + `/coach` pair.

**Example:**
```typescript
// apps/web/app/(authenticated)/layout.tsx
// Source: pattern verified against apps/web/app/home/page.tsx's existing
// getUser()-then-redirect precedent (Phase 2), extended with a role read.
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(); // never getSession() — Pitfall (STATE.md, carried forward)

  if (!user) {
    redirect("/login");
  }

  // profiles.role query — see Pitfall 1 for the app_metadata alternative
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login"); // defensive: a session with no profile row should never happen
  }

  return (
    <AppShell displayName={profile.display_name}>{children}</AppShell>
  );
}
```

A route-level redirect for D-03's "wrong door opens the right room" needs the current pathname, which a layout does not receive directly. Two options, both compatible with the pattern above:
1. Read the pathname via `headers()` (`x-invoke-path` is not stable API — instead use `next/navigation`'s `usePathname()` in a small Client Component, or simpler:
2. Put the role/path mismatch check in each page (`/home`'s page redirects if `role === 'coach'`; `/coach`'s page redirects if `role === 'client'`) rather than the shared layout, since the layout doesn't cleanly know which leaf route it's wrapping. **Recommended: do the signed-out + role-resolution in the layout (shared), and the specific "wrong role for THIS page" check in each page itself** (two near-identical two-line guards, matching the existing repo's low-abstraction style rather than introducing a pathname-reading indirection for a two-route app).

### Pattern 2: RLS reverse-read policy for "client reads own coach's name" (D-16)

**What:** A new SECURITY DEFINER helper mirroring the existing `is_coach_of()` shape, plus a new SELECT policy on `profiles` granting a client read access to the specific coach row referenced by their own `coach_clients` assignment.

**When to use:** Exactly D-16's requirement — the existing `0004_rls_helpers.sql` only grants coach→client reads, not the reverse.

**Example:**
```sql
-- supabase/migrations/0006_client_reads_coach_name.sql
-- Source: mirrors the exact shape of private.is_coach_of() in 0004_rls_helpers.sql —
-- same recursion-safety discipline (never bare-SELECT the table a policy protects),
-- same SECURITY DEFINER + stable + search_path='' hardening.
create or replace function private.is_client_of(coach_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = coach_uuid
        and cc.client_id = (select auth.uid())
    );
$$;

-- profiles: a client can read their own assigned coach's row (D-16).
create policy "client reads own coach"
  on public.profiles
  for select
  to authenticated
  using (private.is_client_of(id));
```

Note this policy does NOT need the "and (select role from public.profiles where id = (select auth.uid())) = 'client'" caller-role check that `is_coach_of()` has, because `coach_clients.client_id` already can only reference a profile whose role is `'client'` (enforced by the existing `enforce_coach_client_roles` trigger in `0003_coach_clients.sql`) — the caller being the referenced `client_id` is sufficient. Symmetry with `is_coach_of()`'s extra role check is not required here since the trigger already guarantees row-shape integrity from the other direction.

### Pattern 3: Empty-state as a shared, config-driven component

**What:** One `EmptyState` component (icon + heading/body text), rendered inside the existing `Card`, parameterized per D-17/D-18 (icon + 1-2 sentences, zero actions).

**When to use:** Both the unassigned-client state and the zero-clients coach state — same visual shape, different icon/copy.

**Example:**
```typescript
// apps/web/components/home/empty-state.tsx
import { Card } from "@/components/ui/card";
import type { Icon } from "@tabler/icons-react";

interface EmptyStateProps {
  Icon: Icon;
  children: React.ReactNode;
}

/** D-17/D-18: one quiet icon + calm copy, zero actions — reassurance only. */
export function EmptyState({ Icon, children }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <Icon size={32} stroke={1.5} aria-hidden="true" className="text-muted" />
      <div className="text-body">{children}</div>
    </Card>
  );
}
```

### Pattern 4: Coach client list as stacked rows with hairline dividers (D-12, D-13, D-14, D-15)

**What:** One `Card` containing a `divide-y divide-border` list, each row showing name (primary) + email (muted), alphabetically sorted, inert (no hover/cursor affordances).

**Example:**
```typescript
// apps/web/components/coach/client-list.tsx
import { Card } from "@/components/ui/card";

interface Client {
  id: string;
  displayName: string;
  email: string;
}

/** D-12..15: one calm Card, hairline dividers, alphabetical, inert rows —
 *  nothing here is tappable yet (no destination exists this milestone). */
export function ClientList({ clients }: { clients: Client[] }) {
  const sorted = [...clients].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  return (
    <Card className="divide-y divide-border p-0">
      {sorted.map((client) => (
        <div key={client.id} className="flex flex-col gap-0.5 p-4">
          <span className="text-foreground">{client.displayName}</span>
          <span className="text-[14px] text-muted">{client.email}</span>
        </div>
      ))}
    </Card>
  );
}
```

**Important data-source caveat:** `profiles` has no `email` column (confirmed by grepping `0001_profiles.sql` and `scripts/verify-rls.ts`'s own comment: "profiles has no email column"). Email lives only on `auth.users`, which RLS does not protect and which the coach's client-side/server-side `.from('profiles')` read cannot join against directly. D-13 requires showing the client's email — the planner must resolve this data-access gap (see Open Questions).

### Anti-Patterns to Avoid
- **Expanding `proxy.ts` beyond session refresh:** Its own Phase 2 header comment states "Route protection does NOT live here — Phase 3 owns redirects; this phase is session refresh only (AUTH-05)." Adding authorization logic there works but silently breaks that documented contract and duplicates the single-response/cookie-write discipline risk (Pitfall 5 from Phase 2) across two files instead of one.
- **Trusting `getSession()` anywhere in this phase's new code:** Same hard grep-gate as Phase 2 — `getUser()` or `getClaims()` only.
- **Manually filtering coach's client list with `.eq('coach_id', ...)`:** RLS already scopes the `profiles` read to the caller's own row + `is_coach_of()` rows. Per AGENTS.md's API boundary and the existing `verify-rls.ts` precedent, the Server Component should call `.select()` with no manual coach-id filter and trust RLS — matching how `checkCoachBoundary()` in `scripts/verify-rls.ts` already proves this works ("sees own row plus 3 assigned clients" with zero client-side filtering).
- **Making the shell or list components hover/cursor-interactive "for future-proofing":** D-14 explicitly requires inert rows this milestone — adding `cursor-pointer`/`hover:` classes now that don't lead anywhere would violate "nothing on screen competes for attention" and D-14's stated rationale directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session-refresh cookie plumbing | A custom cookie-forwarding scheme in a new middleware layer | The existing `apps/web/lib/supabase/proxy.ts` `updateSession()` — unchanged | Already correct, tested, and documented against the exact `@supabase/ssr` failure mode (Pitfall 5); duplicating this logic anywhere risks the "two responses" bug |
| Role-based row-level security | Application-code filtering (`WHERE coach_id = ...` in JS) | RLS policies + `SECURITY DEFINER` helpers (`is_coach_of`, new `is_client_of`) | Already the project's proven security boundary (`verify-rls.ts` proves it with real anon-key sessions); app-code filtering is not a security boundary and is redundant work |
| Alphabetical sort / list rendering | Any list/table library | Plain `Array.prototype.sort` + `.map()` (Pattern 4 above) | Three-item seed list; no virtualization, pagination, or sorting complexity exists at this scale |
| Icon set | A second icon package "just for empty states" | `@tabler/icons-react`, already installed and test-enforced (TOKN-06) | Any second icon import fails `tests/icon-source.test.ts` |

**Key insight:** This phase's complexity is entirely in getting the *authorization* and *RLS* details right (who can see what, redirect on every wrong door), not in UI mechanics — every visual piece (Card, Button, empty state, list rows) is a thin composition of existing kit primitives per AGENTS.md's "extend rather than hand-roll" rule.

## Common Pitfalls

### Pitfall 1: `app_metadata.role` claim does not exist yet — STATE.md's pitfall note is aspirational, not shipped

**What goes wrong:** A planner reads STATE.md's "role mirrored to `app_metadata` via trigger" line, writes a `proxy.ts` or layout check that reads `user.app_metadata?.role` or a `getClaims()` custom claim, and it silently always returns `undefined` — every user gets treated as if they have no role, likely causing an infinite redirect loop or a fallback to the wrong home.

**Why it happens:** `.planning/research/ARCHITECTURE.md` (the milestone-level research, Pattern 3) recommended this mirroring trigger as the ideal pattern. It was never actually implemented — `grep -rn "app_metadata\|raw_app_meta_data" supabase/migrations/*.sql scripts/*.ts` returns zero matches across all five real migrations and both real scripts. `[VERIFIED: grep against apps/web, supabase/migrations, scripts — zero matches for app_metadata/raw_app_meta_data anywhere in the actual codebase]`. STATE.md's "Critical pitfalls to carry into planning" section describes the *intended* pattern, not a *shipped* one, and nothing in the phase transition caught the gap.

**How to avoid:** The planner has two legitimate paths, both fine at this project's scale (per `.planning/research/ARCHITECTURE.md`'s own scaling table — "1k-10k users: add a short-lived cookie cache... shouldn't be needed if role stays in JWT app_metadata"; below that, a per-request DB read is a non-issue):
1. **(Recommended — zero new surface area)** Query `profiles.role` directly in the shared authenticated layout via `supabase.from('profiles').select('role').eq('id', user.id).single()`. One extra query per protected-route navigation; trivial at this scale, and RLS already permits self-read (`"client reads own profile"` policy in `0001_profiles.sql`).
2. **(Matches original research intent)** Add a new migration mirroring `profiles.role` onto `raw_app_meta_data` — either via a trigger on `profiles` INSERT/UPDATE (`update auth.users set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', new.role) where id = new.id`, itself `security definer set search_path=''`), or accept that the *seed script's* `promoteToCoach()` needs an additional `supabase.auth.admin.updateUserById(userId, { app_metadata: { role: 'coach' } })` call alongside its existing `profiles` update. This path lets `getClaims()` in `proxy.ts` become the authoritative role source going forward, but it is genuinely new work this phase must scope, test, and the seed script's idempotency must be re-verified against it.

Either way, the planner must explicitly pick one and document it — do not let the plan silently assume the trigger already exists.

**Warning signs:** Any new code that reads `user.app_metadata.role` or a `getClaims()` custom claim without a corresponding new migration in this phase's file list.

### Pitfall 2: D-16's coach-name read has no RLS policy today

**What goes wrong:** The client-home page queries `coach_clients` (join) or attempts to read the assigned coach's `profiles.display_name` and gets either an empty result or a `permission denied` error, because the only `profiles` SELECT policies today are "client reads own profile" (`0001`) and "coach reads assigned clients" (`0004`) — neither lets a *client* read a *coach's* row.

**Why it happens:** Phase 2's RLS design was coach-reads-client only (the coach home's need); the reverse direction (client reads coach name) is new to this phase's D-16 and was correctly flagged in CONTEXT.md as needing "planner/researcher to pin the exact policy shape" — this research pins it (see Pattern 2 above).

**How to avoid:** Add the `0006_client_reads_coach_name.sql` migration (Pattern 2) before writing the client-home page's assigned-state branch. Verify with a real anon-key session as a seeded client (`client1@fish.dev`), matching the existing `scripts/verify-rls.ts` discipline — add a new assertion there (`checkClientReadsCoachName()`) rather than trusting it only via the UI.

**Warning signs:** A Supabase query returning `null`/empty for a row that should exist, or a `42501 permission denied for table profiles` error when testing the assigned-client empty state.

### Pitfall 3: `profiles` has no `email` column — D-13's list requirement needs a second data source

**What goes wrong:** The coach client-list component tries `client.email` off a `.from('profiles').select('*')` result and gets `undefined` for every row, because `profiles` was deliberately designed without an email column (confirmed: `0001_profiles.sql`'s full column list is `id, role, display_name, created_at, updated_at` — no email; `scripts/verify-rls.ts`'s own comment says "profiles has no email column and display names are seed-mutable").

**Why it happens:** Email lives on `auth.users`, a Supabase-managed table that RLS as configured here does not expose to `authenticated`-role queries from the client SDK the way `public.profiles` does — there is no public view or policy granting `authenticated` read access to `auth.users.email` in the current schema.

**How to avoid:** Three options, in order of preference:
1. Add `email` as a column on `public.profiles`, populated by extending `handle_new_user()`'s trigger to also copy `new.email`, with a migration or manual backfill for the three already-seeded accounts (`update public.profiles set email = (select email from auth.users where id = profiles.id)`). This is the cleanest fix and keeps the existing "coach reads assigned clients" RLS policy sufficient with no new grant.
2. Read email server-side via the service-role/admin API in the coach-home Server Component (`supabase.auth.admin.getUserById()` per client) — this requires the service-role key to be usable in a Server Component context (it already is, per the existing `.env.local` layout used by `scripts/seed.ts`, but using the *admin* client outside a script is new for this project and needs a deliberate service-role client factory, not the anon/RLS-scoped one).
3. Descope D-13's email display for this phase (name-only rows) and treat it as a fast-follow — **not recommended**, since D-13 is an explicit locked decision (CONTEXT.md), not discretion.

**Recommendation:** Option 1 (add `email` to `profiles` via the trigger). It's the smallest change, keeps the existing RLS model intact, and matches the project's established pattern of denormalizing exactly what's needed onto `profiles` (the file already does this for `display_name`).

**Warning signs:** `client.email` renders as `undefined`/blank in the coach's client list during manual verification.

### Pitfall 4: Silent redirect loops from an incomplete role/path matrix

**What goes wrong:** With four states to handle (signed-out, client-on-`/home`, client-on-`/coach`, coach-on-`/home`, coach-on-`/coach`, signed-in-on-auth-page) it's easy to write a guard that redirects `/coach` → `/home` for a client, but the client's own `/home` guard *also* redirects somewhere (e.g., if the profile query itself is written wrong and treats a valid client as roleless), producing a redirect loop the browser eventually errors on.

**Why it happens:** Each of the two pages (`/home`, `/coach`) needs its own two-line "if my role doesn't match this page, redirect to the role home" check (per Pattern 1's recommendation), and if both checks use the same buggy role-resolution helper, both bounce simultaneously.

**How to avoid:** Write the role-resolution query exactly once (in the shared layout, per Pattern 1), pass the resolved `role` down as a prop/context to both leaf pages rather than each page independently re-querying — this guarantees both pages see identical role data and removes the class of bug where they could disagree. Test explicitly: log in as `client1@fish.dev`, visit `/coach` directly, confirm exactly one redirect to `/home` (not a loop) — the existing D-03 behavior.

**Warning signs:** Browser "too many redirects" error during manual verification; Next.js dev server logging repeated identical navigations to the same two URLs.

### Pitfall 5: `getUser()` inside a shared layout runs on every navigation within the group — acceptable but worth naming

**What goes wrong:** Nothing breaks, but a planner unfamiliar with Next.js layout semantics might assume the layout-level `getUser()`/role-query only runs once per session; in fact Server Component layouts re-execute per request/navigation (they are not cached across navigations the way client-side layout state would be), so the auth+role check genuinely re-verifies on every page load within `(authenticated)`.

**Why it happens:** This is actually the *correct*, intended behavior (defense in depth — a revoked session is caught on the very next navigation, not just at initial login) — it's listed as a pitfall only so the planner doesn't try to "optimize" it away with a client-side cache that would reintroduce a stale/trusted-client-side role check (the exact anti-pattern PITFALLS.md warns against).

**How to avoid:** Do nothing — this is the desired behavior. Do not add `React.cache()`-based memoization or a client-side stored role value as a "fix"; the per-navigation DB/JWT check is the security boundary, not a performance bug.

**Warning signs:** A future PR that adds a `localStorage`/cookie-cached role value read instead of re-querying on each protected navigation — flag this in code review as reintroducing Pitfall 3 from `.planning/research/PITFALLS.md`.

## Code Examples

### Extending `authRedirects` for real role-based redirects (D-01)
```typescript
// packages/supabase/src/auth.ts
// Source: existing file (packages/supabase/src/auth.ts), extended per this
// phase's D-01 (clientHome -> /home, was /chat).
import type { UserRole } from "@fish/core/roles";

export interface FishAuthClaims {
  sub: string;
  role: UserRole;
}

export const authRedirects = {
  signedOut: "/login", // D-07: logout lands on plain /login, no confirmation banner
  home: "/home",
  clientHome: "/home", // D-01: was "/chat" — no URL promises a capability that doesn't exist yet
  coachHome: "/coach",
} as const;
```

### The `/` pure-redirect page (D-02)
```typescript
// apps/web/app/page.tsx
// Source: D-02 — root is never rendered content; signed-out -> /login,
// signed-in -> role home. Replaces the stale pre-monochrome showcase.
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { authRedirects } from "@fish/supabase/auth";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(authRedirects.signedOut);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(
    profile?.role === "coach" ? authRedirects.coachHome : authRedirects.clientHome
  );
}
```

### Coach home querying assigned clients (relies entirely on RLS, per AGENTS.md)
```typescript
// apps/web/app/(authenticated)/coach/page.tsx
// Source: pattern verified against scripts/verify-rls.ts's checkCoachBoundary()
// (existing, tested precedent — the same call already proven to return
// "own row plus 3 assigned clients" with zero manual filtering).
import { createClient } from "@/lib/supabase/server";
import { ClientList } from "@/components/coach/client-list";
import { EmptyState } from "@/components/home/empty-state";
import { IconUsers } from "@tabler/icons-react";

export default async function CoachHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS scopes this to: own row + every profile where is_coach_of(id) is true.
  // No manual .eq("coach_id", ...) — RLS is the boundary (AGENTS.md API rule).
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, display_name, email") // Pitfall 3: email requires a schema addition first
    .neq("id", user!.id); // exclude the coach's own row from the "client list"

  const clients = rows ?? [];

  return (
    <>
      <h1 className="mb-6 text-3xl">Your clients</h1>
      {clients.length === 0 ? (
        <EmptyState Icon={IconUsers}>
          <p>Clients you&apos;re assigned will show up here.</p>
        </EmptyState>
      ) : (
        <ClientList clients={clients} />
      )}
    </>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `middleware.ts` | `proxy.ts` (renamed function/file, identical `NextRequest`/`NextResponse` API) | Next.js 16 (already reflected in this codebase since Phase 2) | No new impact this phase — already adopted; just don't create a stray `middleware.ts` file by habit |
| `exchangeCodeForSession()` / legacy `ConfirmationURL` | `verifyOtp()` + `token_hash` | Already adopted in Phase 2 | Not directly relevant to Phase 3 (no new email flows), but the same "use current API, not the one training data remembers" discipline applies to any Supabase call this phase adds |
| `getSession()` for server-side authorization | `getUser()` (network-verified) or `getClaims()` (JWT-verified, network fallback on symmetric keys) `[CITED: supabase.com/docs/reference/javascript/auth-getclaims]` | Ongoing Supabase guidance, already the project's hard rule | Every new Server Component/layout this phase adds must follow this — already true of `apps/web/app/home/page.tsx` |

**Deprecated/outdated:** None specific to this phase's scope beyond the above (already-adopted) items.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next.js route groups (`(name)` folders) add no URL segment and support a shared `layout.tsx` for all nested pages — general mechanism confirmed via official docs this session, but the specific "parenthesized folder adds zero URL segment" behavior was described from training knowledge, not independently re-fetched this session | Recommended Project Structure, Pattern 1 | Low — this is one of the most stable, unchanged App Router features (present since Next.js 13); if wrong, the fallback (flat `app/home/` + `app/coach/` with a shared helper function instead of a shared layout) is explicitly offered as an equally valid alternative in the same section |
| A2 | Adding `email` to `public.profiles` (Pitfall 3, Option 1) is the correct fix for D-13, rather than using the admin API per-row | Common Pitfalls, Pitfall 3 | Medium — if the planner instead wants to avoid touching `handle_new_user()` again, Option 2 (admin API read) is a viable but more complex alternative; get user/planner confirmation on which approach before implementation, since it touches the DB-01-hardened trigger function |
| A3 | `is_client_of()` does not need the extra "caller's own role = client" check that `is_coach_of()` has, because the `enforce_coach_client_roles` trigger already guarantees `coach_clients.client_id` only ever references a client-role profile | Pattern 2 | Low-Medium — if this reasoning has a gap (e.g., a future migration removes or weakens that trigger), the simpler policy would need the symmetric role check added back; flag this as a follow-up code-review checkpoint when Pattern 2's migration is written |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Should Phase 3 add the `app_metadata` role-mirroring trigger, or read `profiles.role` directly per request?**
   - What we know: Neither is implemented today (Pitfall 1); both are viable at this project's scale; STATE.md's pitfall note describes the trigger as if it already exists, which it does not.
   - What's unclear: Whether the user/planner wants to close this gap now (extra migration + seed-script update this phase) or defer it, accepting a per-request DB read as the permanent pattern.
   - Recommendation: Default to the per-request `profiles.role` read (Pattern 1, option 1) unless the planner has a specific reason to add the trigger now — it's less new surface area and the scaling table in `.planning/research/ARCHITECTURE.md` confirms it's a non-issue below 1k users.

2. **How should D-13's "email quiet/muted" be sourced, given `profiles` has no email column?**
   - What we know: Three concrete options are laid out in Pitfall 3, with a recommendation (add `email` to `profiles` via the trigger).
   - What's unclear: Whether touching `handle_new_user()` again (a DB-01-hardened, already-verified trigger) is something the user wants to reopen this phase, versus preferring the admin-API-read alternative.
   - Recommendation: Confirm with the user/planner before implementation — this is exactly the kind of schema-touching decision CONTEXT.md's discretion list did not explicitly cover (it assumed the coach-name RLS shape was the only open schema question, but D-13's email requirement surfaces this second, related gap).

3. **Does the coach's own row need excluding from the "client list" query by client-side code, or should a dedicated RLS-scoped view/policy do it?**
   - What we know: The current `is_coach_of()` policy returns the coach's own row (self-read policy) PLUS assigned clients when the coach queries `profiles`, per `verify-rls.ts`'s own comment ("own row plus 3 assigned clients = 4").
   - What's unclear: Whether the coach-home page should filter out the coach's own row client-side (`.neq('id', user.id)`, shown in the Code Examples section) or whether a cleaner query shape (e.g., querying `coach_clients` joined to `profiles` instead of querying `profiles` directly) avoids the self-row inclusion entirely.
   - Recommendation: Query `coach_clients` (already RLS-scoped to the coach's own assignments via the `"coach reads own assignments"` policy in `0004_rls_helpers.sql`) joined/followed by a `profiles` read on the resulting `client_id`s — this sidesteps the self-row question entirely and is arguably the more correct data-shape ("give me my clients," not "give me my visible profile rows minus mine").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase stack (Docker + CLI) | New migration (`0006_client_reads_coach_name.sql`), manual RLS verification | Not probed this session (research phase; no `supabase`/`docker` commands run) — Phase 2's own research (02-01-PLAN.md) recorded `command not found: supabase` and a failing `docker info` in that prior session's environment | — | Confirm `supabase status` succeeds before starting execution; Phase 2 shipped successfully despite this gap at research time, so it is very likely resolved in the actual dev environment by now — treat as a pre-flight check for the executor, not a blocker for planning |
| Node.js / pnpm | `pnpm build`/`pnpm test` gates | Assumed available — every prior phase's build/test gates passed | — | — |

**Missing dependencies with no fallback:** None identified as blocking at plan time.

**Missing dependencies with fallback:** Local Supabase CLI/Docker availability should be re-confirmed at execution start (`supabase status`) since it was reported unavailable in a much earlier research session; if still unavailable, the executor needs Docker running before the new migration can be applied/tested.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing, `apps/web/package.json` `"test": "vitest"`) + `@testing-library/react` + `jsdom` |
| Config file | `apps/web/vitest.config.*` (existing — not re-read this session; inferred from `apps/web/tests/*.test.ts` and `apps/web/app/home/page.test.tsx` both already running under it) |
| Quick run command | `pnpm --filter web test -- <path-to-file>` or `pnpm --filter web test -- --run <pattern>` (existing convention, matches `apps/web/app/home/page.test.tsx`'s mock-and-render style) |
| Full suite command | `pnpm --filter web test` (152 passing tests per CONTEXT.md's code-context section) |

### Phase Requirement → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUT-01 | Signed-out visitor to `/home` or `/coach` redirects to `/login` | unit (mocked `getUser()` returning no user, assert `redirect` mock called with `/login`) | `pnpm --filter web test -- app/(authenticated)/layout.test.tsx` | ❌ Wave 0 |
| ROUT-02 | Client lands on `/home` after login | unit (mocked profile `role: 'client'`, assert no redirect away from `/home`) | `pnpm --filter web test -- app/(authenticated)/home/page.test.tsx` | ❌ Wave 0 (extends existing `apps/web/app/home/page.test.tsx`, which currently tests the Phase 2 placeholder shape and will need updating, not just a new file) |
| ROUT-03 | Coach lands on `/coach` after login | unit (mocked profile `role: 'coach'`, assert render) | `pnpm --filter web test -- app/(authenticated)/coach/page.test.tsx` | ❌ Wave 0 |
| ROUT-04 | Coach home lists only that coach's assigned clients | unit (mocked Supabase query response with fixed rows) + manual/scripted RLS check (extend `scripts/verify-rls.ts`) | `pnpm --filter web test -- coach/page.test.tsx` + `pnpm verify:rls` (existing script, extend with new assertion per Pitfall 2) | ❌ Wave 0 for the unit test; `verify-rls.ts` exists and should gain a new assertion, not a new file |
| SHEL-01 | At most one primary action per authenticated screen | unit (grep-gate pattern, matching existing `apps/web/app/home/page.test.tsx`'s `variant="primary"` count assertion) | `pnpm --filter web test -- app-shell.test.tsx` | ❌ Wave 0 (extends the exact existing grep-gate pattern already proven in `apps/web/app/home/page.test.tsx` lines 60-71) |
| SHEL-02 | Both empty states render calm copy, no alarming language | unit (render + `screen.getByText` assertions, no snapshot) | `pnpm --filter web test -- empty-state.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `pnpm --filter web test -- <file>` for the file(s) just touched
- **Per wave merge:** `pnpm --filter web test` (full suite, must stay green — currently 152 passing)
- **Phase gate:** Full suite green + `pnpm build` clean + `pnpm verify:rls` exit 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/app/(authenticated)/layout.test.tsx` — covers ROUT-01, the shared signed-out redirect
- [ ] `apps/web/app/home/page.test.tsx` — needs rewriting (not just extending) since the Phase 2 placeholder's "You're signed in" copy and behavior are being replaced entirely by the real client home (ROUT-02, SHEL-02's unassigned state)
- [ ] `apps/web/app/(authenticated)/coach/page.test.tsx` — new, covers ROUT-03/ROUT-04/SHEL-02's coach empty state
- [ ] `apps/web/components/shell/app-shell.test.tsx` — new, covers SHEL-01's one-primary-action grep gate at the shell level
- [ ] `apps/web/components/coach/client-list.test.tsx` — new, covers D-12/13/14/15's rendering contract (alphabetical order, no hover classes, name+email)
- [ ] `apps/web/components/home/empty-state.test.tsx` — new, covers SHEL-02/D-17/D-18
- [ ] `scripts/verify-rls.ts` extension — add a `checkClientReadsCoachName()` assertion for the new migration's policy (not a new file — extends the existing script per its own established pattern)
- [ ] Framework install: none — Vitest/RTL/jsdom already fully configured from Phase 1

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Indirect (session already established by Phase 2) | `getUser()`/`getClaims()` only, never `getSession()` — carried-forward hard rule |
| V3 Session Management | Indirect | Session/cookie refresh already handled by unchanged `proxy.ts`; this phase adds no new session mechanics |
| V4 Access Control | Yes — this phase's core concern | RLS policies (`is_coach_of()`, new `is_client_of()`) as the actual authorization boundary; layout-level role redirects are a UX convenience, not the security control |
| V5 Input Validation | Minimal (no new user-supplied input this phase — no forms) | N/A |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client forges/edits a role value client-side to view `/coach` | Elevation of Privilege | Server-side role resolution only (DB query or verified JWT claim), never a client-supplied value; RLS independently enforces the actual data boundary regardless of what the UI decided to render |
| A client attempts to read another client's profile or another coach's client list by guessing an ID | Information Disclosure | RLS policies (`is_coach_of`/`is_client_of`) scope every read to `auth.uid()`-derived relationships — already proven live by `scripts/verify-rls.ts`'s anon-key assertions; the new migration must be added to that same verification script, not left untested |
| New `is_client_of()` helper introduces RLS recursion (bare `SELECT` against `profiles` from inside a `profiles` policy) | Denial of Service (query failure `42P17`) | Mirror the exact `is_coach_of()` shape (SECURITY DEFINER, queries `coach_clients` only, never bare-selects `profiles` from within a `profiles` policy) — this is Pitfall 2 from Phase 2, carried forward, and `verify-rls.ts`'s `checkNoRecursion()` helper already exists to assert this — extend it to cover the new policy |

## Sources

### Primary (HIGH confidence)
- Existing codebase (read directly): `apps/web/proxy.ts`, `apps/web/lib/supabase/{proxy,server,client}.ts`, `apps/web/app/home/page.tsx` + its test, `apps/web/app/page.tsx`, `packages/supabase/src/auth.ts`, `packages/core/src/roles.ts`, `supabase/migrations/0001-0005*.sql`, `scripts/seed.ts`, `scripts/verify-rls.ts`, `apps/web/components/ui/{card,button,alert}.tsx`, `apps/web/app/globals.css`, `apps/web/app/kit/page.tsx`, `apps/web/tests/icon-source.test.ts`, `.planning/phases/02-secure-account-you-can-return-to/02-PATTERNS.md`, `.planning/phases/02-secure-account-you-can-return-to/02-CONTEXT.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`
- `npm view <pkg> version` — confirmed `@supabase/ssr@0.12.0`, `@supabase/supabase-js@2.110.0`, `@tabler/icons-react@3.44.0` all current and matching installed versions
- [Layouts and Pages | Next.js docs](https://nextjs.org/docs/app/getting-started/layouts-and-pages) — `lastUpdated: 2026-06-23`, version `16.2.10` (matches project's pinned 16.2.9); confirmed nested-layout mechanism (layouts wrap children via the `children` prop) fresh this session

### Secondary (MEDIUM confidence)
- [Custom Claims & Role-based Access Control (RBAC) | Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — via WebSearch summary, cross-referenced against the already-verified in-repo `.planning/research/ARCHITECTURE.md` citation of the same doc
- [getClaims() | Supabase JS Reference](https://supabase.com/docs/reference/javascript/auth-getclaims) — WebFetch confirmed the symmetric-key network-fallback behavior and `data`/`error` return shape
- WebSearch results confirming `raw_app_meta_data` → JWT `app_metadata` claim propagation happens automatically (no hook required) — cross-referenced against two independent search result summaries agreeing on this point

### Tertiary (LOW confidence)
- Route-group "adds no URL segment" specific mechanic — from training knowledge (long-stable Next.js feature since v13), not independently re-fetched this session beyond the general layout-nesting confirmation above (see Assumptions Log A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions verified live against npm registry and matching the already-installed, already-working project
- Architecture: HIGH — every pattern is either a direct extension of a proven in-repo precedent (`/home`'s `getUser()`-then-redirect, `is_coach_of()`'s RLS shape) or a freshly-confirmed official Next.js doc
- Pitfalls: HIGH — Pitfall 1 and 2 are not speculative; both were confirmed by directly grepping the actual migration/script files in this codebase, not inferred from documentation alone

**Research date:** 2026-07-04
**Valid until:** 30 days (stable stack, no fast-moving dependencies; re-verify if Next.js or `@supabase/ssr` receive a major version bump before planning executes)
