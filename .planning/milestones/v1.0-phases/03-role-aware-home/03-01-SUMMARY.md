---
phase: 03-role-aware-home
plan: 01
subsystem: auth
tags: [nextjs, supabase, rls, app-router, route-groups, server-components]

# Dependency graph
requires:
  - phase: 02-secure-account-you-can-return-to
    provides: email/password auth loop, hardened profiles + coach_clients schema, SECURITY DEFINER RLS helpers, seed script, verify-rls script
provides:
  - "0006 migration: private.is_client_of() SECURITY DEFINER RLS helper + 'client reads own coach' SELECT policy on profiles"
  - "profiles.email column, populated by an extended handle_new_user trigger + one-time backfill"
  - "authRedirects as the single source of truth for redirect destinations (signedOut=/login, clientHome=/home, coachHome=/coach)"
  - "apps/web/app/page.tsx as a pure role-aware redirect Server Component (D-02)"
  - "apps/web/app/(authenticated)/layout.tsx: D-06 default-deny auth+role guard wrapping children in AppShell"
  - "AppShell component: slim top bar (logo + muted display name + ghost logout, D-09) over a single max-w-[640px] centered column (D-10)"
  - "EmptyState component: shared calm no-action primitive (icon + copy inside a Card)"
  - "LogoutButton flipped from variant=primary to variant=ghost (D-09) — screen-wide primary-action count is now zero (D-18)"
affects: ["03-02 (client home)", "03-03 (coach home)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component auth guard: getUser() -> redirect if absent -> resolve profiles.role/display_name -> render shell (never getSession())"
    - "Route-group-based default-deny: (authenticated)/layout.tsx wraps every route inside the group; public routes stay outside the group entirely rather than being allowlisted inside the guard"
    - "authRedirects as the single named-constant source of truth for all redirect destinations, imported by both Server Components and client components"
    - "SECURITY DEFINER reverse-read RLS helper (is_client_of) mirroring an existing helper (is_coach_of) shape exactly, scoped to (select auth.uid()), never bare-selecting the protected table from inside its own policy"

key-files:
  created:
    - supabase/migrations/0006_client_reads_coach_name.sql
    - apps/web/app/(authenticated)/layout.tsx
    - apps/web/app/(authenticated)/layout.test.tsx
    - apps/web/components/shell/app-shell.tsx
    - apps/web/components/shell/app-shell.test.tsx
    - apps/web/components/home/empty-state.tsx
    - apps/web/components/home/empty-state.test.tsx
  modified:
    - supabase/migrations/0002_handle_new_user.sql
    - packages/supabase/src/database.generated.ts
    - packages/supabase/src/auth.ts
    - apps/web/app/page.tsx
    - apps/web/app/login/page.tsx
    - apps/web/components/auth/logout-button.tsx
    - apps/web/app/home/page.test.tsx
    - apps/web/package.json

key-decisions:
  - "is_client_of omits the redundant caller-role re-check that is_coach_of carries, because the enforce_coach_client_roles trigger (0003) already guarantees coach_clients.client_id references a client-role profile"
  - "email column added with a NOT NULL DEFAULT '' + backfill UPDATE, rather than a nullable column, to keep the type non-optional (email: string, not string | null) in generated types"
  - "0006 also carries a CREATE OR REPLACE of the live handle_new_user function (not just editing 0002's source) because 0002 already ran against the live DB and editing it alone would only take effect on a fresh db reset"
  - "LogoutButton flips from variant=primary to variant=ghost (D-09) — this is a deliberate widening of D-18's 'at most one primary action' rule to include zero; the shell's chrome carries no primary action at all"
  - "AppShell and the (authenticated) layout diverge from the stale PATTERNS.md snippet (which still showed LogoutButton as variant=primary) — the plan's D-09 instruction, dated after PATTERNS.md, is authoritative"

patterns-established:
  - "Guard layout pattern: async Server Component layout does getUser()-then-redirect-then-profile-read-then-redirect-then-render, with no per-page role guard (that stays in each leaf page per D-03)"
  - "Grep-gate testing pattern for primary-action count: read component source files directly in a test and count variant=\"primary\" occurrences, now asserting zero across app-shell.tsx + logout-button.tsx"

requirements-completed: [ROUT-01, ROUT-02, ROUT-03, SHEL-01, SHEL-02]

coverage:
  - id: D1
    description: "Migration 0006 adds is_client_of() RLS helper + policy, profiles.email column + backfill, and extends handle_new_user; types regenerated"
    requirement: "ROUT-03"
    verification:
      - kind: manual_procedural
        ref: "Task 2 checkpoint: supabase db reset (0001-0006 apply clean) + pnpm seed + supabase gen types + pnpm verify:rls, user-approved"
        status: pass
    human_judgment: true
    rationale: "Live database schema application and RLS behavior against a running Supabase instance cannot be proven by a unit test alone — this was a human-verify checkpoint, already approved."
  - id: D2
    description: "A client can read their own assigned coach's profile row via RLS (is_client_of), without seeing other clients or other coaches"
    requirement: "ROUT-03"
    verification:
      - kind: manual_procedural
        ref: "Task 2 checkpoint: direct probe as client1 and client2 confirmed each sees exactly own row + assigned coach row, no cross-client/foreign-coach leak"
        status: pass
    human_judgment: true
    rationale: "Proven via a live RLS probe against seeded accounts (approved), not a hermetic unit test; verify-rls script assertions for this are added in plan 03-03."
  - id: D3
    description: "authRedirects is the single source of truth (signedOut=/login, clientHome=/home, coachHome=/coach); root / is a pure role-aware redirect; login routes through the constant"
    requirement: "ROUT-01"
    verification:
      - kind: unit
        ref: "apps/web/app/page.tsx + apps/web/app/login/page.tsx: grep-verified via task acceptance criteria (signedOut=/login, clientHome=/home present; no old-hue-token-a/old-hue-token-b/swatches remnants)"
        status: pass
      - kind: integration
        ref: "pnpm build (Next.js production build compiles / and /login as valid routes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "(authenticated) layout enforces D-06 default-deny: redirects signed-out visitors to /login, redirects sessions with no profile row to /login, renders AppShell for a valid profile"
    requirement: "ROUT-01"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/layout.test.tsx#AuthenticatedLayout (3 tests: no-user redirect, null-profile redirect, valid-profile renders)"
        status: pass
    human_judgment: false
  - id: D5
    description: "AppShell renders a slim top bar (logo + muted display name + ghost logout) over a single max-w-[640px] centered column for both roles, with zero primary-variant buttons"
    requirement: "SHEL-01"
    verification:
      - kind: unit
        ref: "apps/web/components/shell/app-shell.test.tsx#AppShell (muted name + logout button; single main with max-w-[640px]/mx-auto; grep gate for zero variant=\"primary\")"
        status: pass
    human_judgment: false
  - id: D6
    description: "EmptyState is a reusable calm no-action primitive (Tabler icon + copy inside a Card, zero buttons)"
    requirement: "SHEL-02"
    verification:
      - kind: unit
        ref: "apps/web/components/home/empty-state.test.tsx#EmptyState (renders icon + copy; zero buttons)"
        status: pass
    human_judgment: false
  - id: D7
    description: "LogoutButton flipped to variant=ghost (D-09); shared flat home/page.test.tsx updated so the wave stays green"
    requirement: "SHEL-01"
    verification:
      - kind: unit
        ref: "apps/web/app/home/page.test.tsx#HomePage (ghost-button assertion; grep gate now expects zero variant=\"primary\")"
        status: pass
      - kind: unit
        ref: "pnpm --filter @fish/web test -- --run (full suite, 160/160 passing including tests/icon-source.test.ts)"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-07-04
status: complete
---

# Phase 3 Plan 1: Role-aware routing + shell spine Summary

**RLS-backed reverse client-to-coach read (is_client_of) + profiles.email, a role-aware pure-redirect root page, authRedirects as the single redirect source of truth, and a D-06/D-09/D-10-compliant (authenticated) guard layout wrapping a ghost-logout AppShell.**

## Performance

- **Duration:** 42 min (Task 1 commit to Task 4 commit)
- **Started:** 2026-07-04T03:00:12Z
- **Completed:** 2026-07-04T03:41:57Z
- **Tasks:** 4 (2 auto, 1 checkpoint:human-verify [approved], 1 auto)
- **Files modified:** 15 (7 created, 8 modified)

## Accomplishments

- Migration `0006_client_reads_coach_name.sql` lands the reverse-read RLS helper (`private.is_client_of`), the `profiles.email` column with backfill, and an updated live `handle_new_user` function — applied clean via `supabase db reset`, reseeded, types regenerated, and RLS behavior proven live against seeded accounts (Task 2 checkpoint, user-approved).
- `authRedirects` is now the single source of truth for redirect destinations (`signedOut: "/login"`, `clientHome: "/home"`, `coachHome: "/coach"`), consumed by both the new root pure-redirect page and the login form.
- `apps/web/app/page.tsx` is now a pure role-aware Server Component redirect (D-02) — the stale pre-monochrome color/component showcase is deleted wholesale.
- `apps/web/app/(authenticated)/layout.tsx` enforces D-06 default-deny: any route inside the group requires a session (via `getUser()`, never `getSession()`), resolves `profiles.role`/`display_name`, and wraps children in the new `AppShell`.
- `AppShell` gives every authenticated screen a slim top bar (logo, muted display name, ghost logout) over one `max-w-[640px]` centered content column — the same width for both roles, no page title in the bar, and zero primary-variant buttons on screen (D-09/D-10/D-18).
- `EmptyState` is a new shared calm no-action primitive (Tabler icon + copy inside a `Card`) ready for the client-home and coach-home empty states in Plans 02/03.
- `LogoutButton` flips from `variant="primary"` to `variant="ghost"` (D-09); the still-present flat `apps/web/app/home/page.test.tsx` was updated in the same task so the wave-1 suite stays green through the flip.

## Task Commits

1. **Task 1: Migration 0006 — is_client_of helper + policy, email column + trigger extension + backfill; regenerate types** - `ce6a4e9` (feat)
2. **Task 2 [BLOCKING]: Apply schema, reseed, and prove RLS live** - checkpoint:human-verify, no code commit (user-approved "approved")
3. **Task 3: authRedirects rewire + root pure-redirect page + wire login to the constant** - `d3c8735` (feat)
4. **Task 4: AppShell + EmptyState components, the (authenticated) guard layout, and the logout ghost flip** - `a6dec52` (feat)

_Note: This plan is `tdd="true"` on Tasks 1 and 4; both followed the behavior/test-first structure described in each task's `<behavior>` block, though tests and implementation were committed together within each task's single commit (task-level atomicity, not separate RED/GREEN/REFACTOR commits)._

## Files Created/Modified

- `supabase/migrations/0006_client_reads_coach_name.sql` - is_client_of() SECURITY DEFINER helper, "client reads own coach" policy, email column + backfill, updated live handle_new_user
- `supabase/migrations/0002_handle_new_user.sql` - INSERT column list extended with email/new.email for fresh db reset parity
- `packages/supabase/src/database.generated.ts` - profiles Row/Insert/Update gain `email: string` (confirmed byte-identical to a fresh `supabase gen types` run)
- `packages/supabase/src/auth.ts` - authRedirects rewired: signedOut=/login, clientHome=/home, stale home key removed
- `apps/web/app/page.tsx` - rewritten as a pure role-aware redirect Server Component; stale showcase deleted
- `apps/web/app/login/page.tsx` - routes through authRedirects.clientHome instead of a literal path
- `apps/web/app/(authenticated)/layout.tsx` - new D-06 default-deny guard layout wrapping AppShell
- `apps/web/app/(authenticated)/layout.test.tsx` - 3 tests: no-user redirect, null-profile redirect, valid-profile render
- `apps/web/components/shell/app-shell.tsx` - new top bar + centered column shell component
- `apps/web/components/shell/app-shell.test.tsx` - muted name, logout button, D-10 column, D-09 zero-primary grep gate
- `apps/web/components/home/empty-state.tsx` - new shared calm empty-state primitive
- `apps/web/components/home/empty-state.test.tsx` - icon+copy render, zero-buttons assertion
- `apps/web/components/auth/logout-button.tsx` - variant primary -> ghost, fullWidth=false (D-09)
- `apps/web/app/home/page.test.tsx` - updated ghost-button assertion + grep gate (now expects zero variant="primary")
- `apps/web/package.json` - added missing `@fish/core` and `@fish/supabase` workspace dependencies (Rule 3 blocking fix)

## Decisions Made

- `is_client_of` intentionally omits the redundant caller-role re-check that `is_coach_of` carries — `enforce_coach_client_roles` (0003) already guarantees row-shape integrity, so the caller being the referenced `client_id` is sufficient (per RESEARCH.md Assumption A3, reviewed and confirmed, not a bug).
- `profiles.email` is `NOT NULL DEFAULT ''` with a backfill `UPDATE`, keeping the generated TypeScript type non-optional (`email: string`).
- 0006 re-creates the live `handle_new_user` function (not just editing 0002's source), because 0002 already ran against the live DB — editing its source alone would only take effect on a future `db reset`, not on `db push`/direct apply.
- `LogoutButton` flips to `variant="ghost"` (D-09), making the authenticated shell's primary-action count zero — a deliberate widening of D-18's "at most one primary action" rule to explicitly permit zero.
- `AppShell`/the guard layout follow the plan's D-09 instruction over the stale `PATTERNS.md` code snippet (which still showed `LogoutButton` as `variant="primary"` from before the D-09 decision was made) — the plan text is authoritative when it postdates a pattern-map draft.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `@fish/core`/`@fish/supabase` workspace dependencies to `apps/web/package.json`**
- **Found during:** Task 3 (root pure-redirect page + login rewire)
- **Issue:** `apps/web/package.json` never listed `@fish/core` or `@fish/supabase` as dependencies, even though `packages/supabase`'s `exports` map already defines a `./auth` subpath. No file in `apps/web` had previously imported either package, so the gap was latent. Task 3 is the first task to import `@fish/supabase/auth`, and `pnpm build` failed with "Module not found: Can't resolve '@fish/supabase/auth'" in both `apps/web/app/page.tsx` and `apps/web/app/login/page.tsx`.
- **Fix:** Added `"@fish/core": "workspace:*"` and `"@fish/supabase": "workspace:*"` to `apps/web/package.json` dependencies, then ran `pnpm install` (resolved entirely from the existing workspace — no new/external packages were fetched, so this is internal workspace wiring, not a package-legitimacy concern under the Rule 3 install exclusion).
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm build` exits 0 (all three workspace projects: `packages/core` typecheck, `packages/supabase` typecheck, `apps/web` Next.js build with `/` and `/login` compiling and generating correctly).
- **Committed in:** `d3c8735` (Task 3 commit)

**2. [Rule 1 - Bug] Cleared `redirectMock`/`getUserMock`/`singleMock` between tests in `layout.test.tsx`**
- **Found during:** Task 4 (guard layout test authoring)
- **Issue:** Module-level `vi.fn()` mocks accumulated call counts across the three tests in the same `describe` block, so the third test's `expect(redirectMock).not.toHaveBeenCalled()` failed against calls made by the first two tests, not the current one.
- **Fix:** Added an `afterEach` that clears `redirectMock`/resets `getUserMock`/`singleMock` between tests.
- **Files modified:** `apps/web/app/(authenticated)/layout.test.tsx`
- **Verification:** `pnpm --filter @fish/web test -- --run "app/(authenticated)/layout.test.tsx"` passes (3/3).
- **Committed in:** `a6dec52` (Task 4 commit)

**3. [Rule 1 - Bug] Mocked `next/navigation`'s `useRouter` in `app-shell.test.tsx`**
- **Found during:** Task 4 (app-shell test authoring)
- **Issue:** `AppShell` renders `LogoutButton`, which calls `useRouter()`. Without a mock, rendering threw "invariant expected app router to be mounted" (no Next.js app-router context in the Vitest/jsdom environment).
- **Fix:** Added a `next/navigation` mock (`useRouter: () => ({ push: vi.fn() })`) alongside the existing `@/lib/supabase/client` mock, mirroring the pattern already used in `home/page.test.tsx` and `layout.test.tsx`.
- **Files modified:** `apps/web/components/shell/app-shell.test.tsx`
- **Verification:** `pnpm --filter @fish/web test -- --run "components/shell/app-shell.test.tsx"` passes (3/3).
- **Committed in:** `a6dec52` (Task 4 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking dependency wiring, 2 test-harness bugs)
**Impact on plan:** All three were necessary for the plan's own acceptance criteria (`pnpm build` exits 0; the new test files pass) and directly caused by this plan's changes. No scope creep — no pre-existing unrelated issues were touched.

## Known planning defect — verify:rls exit code (documented, not fixed here)

Plan 03-03's Task 3 instructs "do not change the existing three assertions" AND requires "`pnpm verify:rls` exits 0" — these are mutually impossible after this plan's 0006 migration, because the new `is_client_of` policy (D-16) intentionally widens a client's read surface from "own row only" to "own row + assigned coach row" (2 rows instead of 1). At the end of this plan:

```
FAIL — DB-03 client boundary: sees exactly one row (own) (got 2 rows)
FAIL — DB-03 client boundary: no other accounts visible (row(s) with a foreign id returned)
PASS — DB-03 coach boundary: sees own row plus 3 assigned clients (got 4 rows)
PASS — DB-03 coach boundary: exactly one coach row, three client rows (coach=1 client=3)
PASS — DB-04 escalation: self-promotion to coach is rejected (role cannot be changed by this caller)
PASS — DB-04 safe-field update (display_name) succeeds
2 assertion(s) failed.
```

This is EXPECTED AND ALREADY APPROVED at the Task 2 checkpoint: a direct probe as client1 and client2 confirmed each sees exactly their own row + the assigned coach row, no cross-client leak, no foreign-coach leak. `scripts/verify-rls.ts` was deliberately left untouched in this plan (it belongs to Plan 03-03's `files_modified`) — Plan 03-03 owns updating `checkClientBoundary()` to expect exactly 2 rows (own + assigned coach) and restoring exit-0.

## Issues Encountered

None beyond the three auto-fixed deviations above.

## User Setup Required

None - no external service configuration required. (Task 2's `supabase db reset` / `pnpm seed` / `supabase gen types` / `pnpm verify:rls` sequence was already run and approved against the local Supabase stack before this continuation began.)

## Next Phase Readiness

- Plan 02 (client home) and Plan 03 (coach home) can now both build on: the `(authenticated)` route group + guard layout, `AppShell`, `EmptyState`, `authRedirects`, and the `is_client_of`/`profiles.email` schema additions.
- Plan 03-03 has one required follow-up: update `scripts/verify-rls.ts`'s `checkClientBoundary()` to assert 2 rows (own + assigned coach) instead of 1, restoring `pnpm verify:rls` to exit 0.
- No blockers.

---
*Phase: 03-role-aware-home*
*Completed: 2026-07-04*

## Self-Check: PASSED

All 16 claimed files verified present on disk; all 4 commit hashes (ce6a4e9, d3c8735, a6dec52, d5fecc5) verified present in git log.
