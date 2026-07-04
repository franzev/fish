---
phase: 03-role-aware-home
verified: 2026-07-04T04:18:56Z
status: passed
score: 11/11 must-haves verified (programmatic); 1 end-to-end UAT item pending human execution
has_blocking_gaps: false
overrides_applied: 1
overrides:

  - must_have: "scripts/verify-rls.ts: do not change the existing three assertions (03-03-PLAN.md Task 3 instruction)"
    reason: "Migration 0006 (03-01) intentionally widened is_client_of's read surface so a client legitimately sees 2 profiles rows (own + assigned coach) instead of 1. The plan's own two acceptance criteria ('do not change existing assertions' AND 'verify:rls exits 0') were mutually impossible post-0006. This was flagged as a known planning defect in 03-01-SUMMARY.md, the live behavior was independently confirmed at the 03-01 Task 2 human-verify checkpoint (approved), and 03-03 explicitly documents the deviation as approved. Independently re-verified live in this session: pnpm verify:rls exits 0, 8/8 PASS."
    accepted_by: "orchestrator (per 03-01-SUMMARY.md 'Known planning defect' section + 03-03-SUMMARY.md 'Approved Deviation' section)"
    accepted_at: "2026-07-04T03:41:57Z"
human_verification:

  - test: "While logged in as client1@fish.dev, navigate to /login → confirm silent redirect to /home; navigate to /signup → confirm silent redirect to /home. While logged in as coach@fish.dev, navigate to /login → confirm silent redirect to /coach. Signed out, confirm /login and /signup still show the unchanged forms."
    expected: "Every case above resolves silently with no form flash, no error, no visible transition glitch — matching 03-04-PLAN.md's <verification> Manual section."
    why_human: "Requires an actual authenticated browser session navigating between routes and observing render timing/flash; the underlying redirect logic is unit-tested (redirect-if-signed-in.test.ts, 3/3 passing) but the end-to-end click-through has not been executed by a human per 03-04-SUMMARY.md's explicit human_judgment:true flag."

  - test: "Log in as client1@fish.dev in a browser → confirm landing on /home inside the shell with greeting 'Welcome back, Alex' and copy naming 'Coach Dana'. Log in as coach@fish.dev → hitting /home in the browser silently forwards to /coach."
    expected: "Client sees the assigned-state empty state naming their real coach; a coach hitting the client URL is invisibly forwarded, never seeing an error or flash."
    why_human: "03-02-PLAN.md's <verification> Manual section defers this exact check to phase-level UAT; it has not been executed in a running browser session (dev server was not started during this verification per environment constraints)."

  - test: "Log in as coach@fish.dev in a browser → confirm /coach lists Alex Rivera, Priya Nair, Sam Okafor alphabetically with their emails, no other coach's clients, and rows show no hover/cursor affordance. Log in as client1@fish.dev → hitting /coach silently forwards to /home."
    expected: "Exactly the three seeded clients render in alphabetical order with quiet emails; the list feels inert (no visual tap affordance); a client hitting the coach URL is invisibly forwarded."
    why_human: "03-03-PLAN.md's <verification> Manual section defers this exact check to phase-level UAT; visual/tactile 'inert' feel and real browser navigation cannot be fully proven by grep/unit tests alone."
---

# Phase 3: Role-aware home Verification Report

**Phase Goal:** After logging in, a person lands inside a calm app shell on the home that matches their role — a client on the client home, a coach on the coach home listing only their assigned clients — with signed-out users always redirected to login and empty states that guide rather than alarm.
**Verified:** 2026-07-04T04:18:56Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A signed-out person hitting any protected route is redirected to login | VERIFIED | `apps/web/app/(authenticated)/layout.tsx` calls `getUser()` → `redirect("/login")` when absent; `layout.test.tsx` asserts this (3/3 passing); route-group structure confirmed live — only `home` and `coach` sit inside `(authenticated)`, all public routes (`login`, `signup`, `forgot-password`, `reset-password`, `check-inbox`, `expired-link`, `auth`, `kit`) live structurally outside it |
| 2 | After login, a client lands on the client home and a coach lands on the coach home | VERIFIED | `apps/web/app/page.tsx` (pure redirect, role-branched); `apps/web/app/(authenticated)/home/page.tsx` redirects a coach to `/coach` (D-03 wrong-door); `apps/web/app/(authenticated)/coach/page.tsx` redirects a client to `/home`; all three paths unit-tested (layout.test.tsx, home/page.test.tsx, coach/page.test.tsx — 10 tests total) |
| 3 | The coach home lists that coach's assigned (seeded) clients and only theirs; no coach sees another coach's clients | VERIFIED | `coach/page.tsx` queries `coach_clients` (RLS-scoped, no manual `.eq("coach_id"` filter — confirmed absent via grep test); live `pnpm verify:rls` run in this session: 8/8 PASS including "DB-03 coach boundary: sees own row plus 3 assigned clients" and the new "D-16 client reads coach name: returns exactly the assigned coach's row" |
| 4 | Authenticated screens are wrapped by an app shell showing at most one primary action per screen | VERIFIED | `AppShell` renders logo + muted display name + ghost (secondary) `LogoutButton`; grep across `app-shell.tsx`, `logout-button.tsx`, `(authenticated)/home/page.tsx`, `(authenticated)/coach/page.tsx` for `variant="primary"` returns zero matches (independently re-run in this session); `app-shell.test.tsx` and page-level grep-gate tests assert this (all passing) |
| 5 | A client home before assignment shows a calm, guiding empty state (never alarming "no data" language) | VERIFIED | `(authenticated)/home/page.tsx` renders `EmptyState` with "We're getting things ready for you." when `coach_clients` `.maybeSingle()` returns null; unit-tested |
| 6 | A coach home with zero clients shows a calm, guiding empty state | VERIFIED | `(authenticated)/coach/page.tsx` renders `EmptyState` ("Clients assigned to you will show up here.") when the client list is empty; unit-tested |
| 7 | A signed-in client/coach visiting /login or /signup is silently redirected to their role home (D-05) | VERIFIED (unit level) / PENDING (browser UAT) | `redirectIfSignedIn()` unit-tested for all three branches (client→/home, coach→/coach, signed-out→no-op, 3/3 passing); `/login` and `/signup` route shells call it before rendering; `pnpm build` confirms both compile as dynamic routes. End-to-end browser click-through not yet performed by a human (see Human Verification below) |

**Score:** 7/7 truths hold at the programmatic level; 1 of them (#7) plus two related phase-level UAT checks (client/coach home visual correctness) still need a human to click through a live browser session.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0006_client_reads_coach_name.sql` | `is_client_of()` helper + policy, email column + backfill | VERIFIED | Present, applied live — `is_client_of` confirmed `security definer`/`stable` via live `pg_proc` query; `"client reads own coach"` SELECT policy confirmed via live `pg_policies` query; `profiles.email` populated for all 4 seeded accounts (live query) |
| `apps/web/app/(authenticated)/layout.tsx` | D-06 default-deny guard, wraps AppShell | VERIFIED | 25+ lines, `getUser()`-only, redirects on no-user and no-profile, renders `<AppShell displayName={...}>`; 3/3 tests passing |
| `apps/web/components/shell/app-shell.tsx` | Top bar + centered column, zero primary actions | VERIFIED | Exports `AppShell`, `max-w-[640px]`/`mx-auto` confirmed, zero `variant="primary"`, ghost `LogoutButton`; 3/3 tests passing |
| `apps/web/components/home/empty-state.tsx` | Calm no-action primitive | VERIFIED | Exports `EmptyState`, zero buttons, icon + copy inside `Card`; 2/2 tests passing |
| `apps/web/app/page.tsx` | Pure role-aware redirect | VERIFIED | No JSX, `redirect()` on every branch, imports `authRedirects`; `pnpm build` confirms `/` compiles as dynamic (ƒ) route |
| `packages/supabase/src/auth.ts` | `authRedirects` single source of truth | VERIFIED | `signedOut: "/login"`, `clientHome: "/home"`, `coachHome: "/coach"` — confirmed by direct read |
| `apps/web/app/(authenticated)/home/page.tsx` | Real client home | VERIFIED | 59 lines, wrong-door guard, coach-assignment read, greeting, EmptyState branching; 4/4 tests passing |
| `apps/web/app/(authenticated)/coach/page.tsx` | Coach home with RLS-scoped list | VERIFIED | 65 lines, wrong-door guard, no manual coach-id filter (confirmed absent), `ClientList`/`EmptyState` branching; 4/4 tests passing |
| `apps/web/components/coach/client-list.tsx` | Alphabetical, inert client rows | VERIFIED | Exports `ClientList`, `localeCompare` sort on a copy (non-mutating), single `Card` with `divide-y`, zero `hover:`/`cursor-pointer`; 5/5 tests passing |
| `scripts/verify-rls.ts` | `checkClientReadsCoachName()` assertion | VERIFIED | Present, called in `main()`; live run in this session: 8/8 PASS, exit 0 |
| `apps/web/lib/auth/redirect-if-signed-in.ts` | Shared signed-in guard | VERIFIED | Exports `redirectIfSignedIn`, `getUser()`-only, redirects by role, no-op signed-out; 3/3 tests passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `(authenticated)/layout.tsx` | `profiles` table | `.from("profiles").select("role, display_name").eq(...).single()` | WIRED | Confirmed present, exercised by 3 passing tests |
| `(authenticated)/layout.tsx` | `components/shell/app-shell.tsx` | renders `<AppShell displayName={...}>` | WIRED | Confirmed present and rendering with real display name in test |
| `login/page.tsx` | `packages/supabase/src/auth.ts` | `authRedirects` import + `redirectIfSignedIn` | WIRED | Confirmed — `login/page.tsx` and `login-form.tsx` both import/use `authRedirects`; server shell calls `redirectIfSignedIn()` |
| `0006_client_reads_coach_name.sql` | `coach_clients` table | `is_client_of()` checks `coach_clients` for `auth.uid()` | WIRED | Confirmed live: function body queries only `coach_clients`, never bare-selects `profiles`; live `pnpm verify:rls` proves the policy is in force with no 42P17 recursion |
| `(authenticated)/home/page.tsx` | `coach_clients` + `profiles` | `.maybeSingle()` then coach-name read via `is_client_of` | WIRED | Confirmed via source read + 3/3 relevant unit tests (unassigned/assigned/coach-redirect) |
| `(authenticated)/coach/page.tsx` | `coach_clients` → `profiles` embedded join | `.select("client_id, profiles:client_id(...)")`, RLS-scoped | WIRED | Confirmed via source read; FK `coach_clients_client_id_fkey` confirmed `isOneToOne: true` in generated types, backing the embedded-select shape; live `verify:rls` confirms coach sees exactly 4 rows (own + 3 clients) |
| `login/page.tsx` / `signup/page.tsx` | `lib/auth/redirect-if-signed-in.ts` | `await redirectIfSignedIn()` before rendering form | WIRED | Confirmed via source read on both files; `pnpm build` confirms both compile as dynamic server routes (not "use client") |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `(authenticated)/home/page.tsx` | `coachName` | `coach_clients.maybeSingle()` → `profiles.single()` via live `is_client_of` RLS policy | Yes — live query against seeded DB returns "Coach Dana" for client1 (confirmed via direct live SQL query in this session) | FLOWING |
| `(authenticated)/coach/page.tsx` | `clients` | `coach_clients` embedded-joined to `profiles`, RLS-scoped to `coach_id = auth.uid()` | Yes — live `verify:rls` confirms exactly 4 rows returned for the seeded coach (1 own + 3 clients) | FLOWING |
| `(authenticated)/layout.tsx` | `profile.display_name` | `profiles.select("role, display_name").eq("id", user.id).single()` | Yes — live query confirms `display_name` populated for all seeded accounts | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full web test suite passes | `pnpm --filter @fish/web test -- --run` | 173/173 tests passed, 21/21 files passed | PASS |
| Production build compiles all phase-03 routes | `pnpm build` | Exit 0; `/`, `/home`, `/coach`, `/login`, `/signup` all render as dynamic (ƒ) routes | PASS |
| Lint clean | `pnpm lint` | Exit 0, no errors | PASS |
| Typecheck clean (all 3 workspace projects) | `pnpm typecheck` | Exit 0 for `packages/core`, `packages/supabase`, `apps/web` | PASS |
| Live RLS boundary proof (8 assertions) | `pnpm verify:rls` | 8/8 PASS, exit 0 (independently re-run in this session, not just trusted from SUMMARY) | PASS |
| `profiles.email` populated live for all seeded accounts | Direct `supabase db query` against local Postgres | 4/4 rows have non-empty `email` matching seed script | PASS |
| `is_client_of()` is `security definer` + `stable` live | `pg_proc` query via `supabase db query` | Confirmed `prosecdef: true`, `provolatile: 's'` | PASS |
| `"client reads own coach"` SELECT policy exists live | `pg_policies` query via `supabase db query` | Confirmed present alongside 3 pre-existing profiles policies | PASS |
| Zero `variant="primary"` across shell/logout/home/coach files | `grep -rn 'variant="primary"'` across the 4 files | Zero matches | PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/placeholder) in any phase-03 file | `grep` across all tracked phase-03 files | Zero matches | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or phase-declared probes found in PLAN/SUMMARY files for this phase. SKIPPED (no probe-based verification declared; the phase uses `pnpm verify:rls` as its live-DB gate instead, which was run directly above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| ROUT-01 | 03-01 | Signed-out users are redirected to login from any protected route | SATISFIED | `(authenticated)/layout.tsx` default-deny guard, 3/3 tests passing, route-group structure confirmed |
| ROUT-02 | 03-01, 03-02, 03-04 | A client lands on the client home after login | SATISFIED | Root redirect + client home wrong-door guard + `redirectIfSignedIn`, all unit-tested; browser UAT still pending (see human_verification) |
| ROUT-03 | 03-01, 03-03, 03-04 | A coach lands on the coach home after login | SATISFIED | Root redirect + coach home wrong-door guard, unit-tested; live `verify:rls` proves the RLS boundary; browser UAT still pending |
| ROUT-04 | 03-03 | Coach home lists that coach's assigned (seeded) clients — and only theirs | SATISFIED | `ClientList` + RLS-scoped `coach_clients` join, unit-tested; live `verify:rls` confirms exactly 4 rows (1 coach + 3 clients) for the seeded coach |
| SHEL-01 | 03-01 | App shell wraps authenticated screens with at most one primary action visible per screen | SATISFIED | `AppShell` + zero `variant="primary"` confirmed by grep across all relevant files, independently re-verified |
| SHEL-02 | 03-01, 03-02, 03-03 | Client home before assignment and coach home with zero clients show calm, guiding empty states | SATISFIED | `EmptyState` component + both pages' branching logic, unit-tested |

No orphaned requirements — all 6 IDs declared across the phase's plans (`ROUT-01, ROUT-02, ROUT-03, ROUT-04, SHEL-01, SHEL-02`) match exactly the 6 IDs REQUIREMENTS.md maps to "Phase 3," and REQUIREMENTS.md's traceability table marks all 6 "Complete."

### Anti-Patterns Found

None. Scanned all phase-03 key files (`(authenticated)/layout.tsx`, `app-shell.tsx`, `empty-state.tsx`, `page.tsx`, `packages/supabase/src/auth.ts`, `(authenticated)/home/page.tsx`, `(authenticated)/coach/page.tsx`, `client-list.tsx`, `redirect-if-signed-in.ts`, `login/page.tsx`, `login-form.tsx`, `signup/page.tsx`, `signup-form.tsx`, `0006_client_reads_coach_name.sql`, `verify-rls.ts`, `logout-button.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|placeholder|coming soon|not yet implemented|not available` — zero matches. One `return null` found in `coach/page.tsx` line 44 is inside a `.map().filter()` null-guard for a malformed join row, not a stub — legitimate defensive code, not flagged.

### One documented, approved deviation (not a gap)

`03-03-SUMMARY.md` documents that `scripts/verify-rls.ts`'s `checkClientBoundary()` was updated to the post-0006 two-row invariant, overriding 03-03-PLAN.md's literal "do not change the existing three assertions" instruction — because migration 0006 (03-01) intentionally widened `is_client_of`'s read surface so a client legitimately sees their own row + their assigned coach's row (2 rows), not 1. This was flagged as a known, pre-approved planning defect in 03-01-SUMMARY.md's "Known planning defect" section, with the underlying live RLS behavior independently confirmed at 03-01's Task 2 human-verify checkpoint before 03-03 ever touched the script. Recorded as an override above; independently re-verified live in this session (`pnpm verify:rls` → 8/8 PASS, exit 0).

### Human Verification Required

Three browser-based end-to-end checks remain, all explicitly deferred to phase-level UAT by their respective plans' `<verification>` Manual sections, and explicitly flagged as not-yet-executed by 03-04-SUMMARY.md's `human_judgment: true` item. The underlying logic for all three is unit-tested and the data boundaries are live-RLS-verified — these three items are the final "does it actually behave this way in a live browser" checks, not logic gaps.

#### 1. Cross-role auth-page redirect (D-05)

**Test:** While logged in as client1@fish.dev, navigate to /login → confirm silent redirect to /home; navigate to /signup → confirm silent redirect to /home. While logged in as coach@fish.dev, navigate to /login → confirm silent redirect to /coach. Signed out, confirm /login and /signup still show the unchanged forms.
**Expected:** Every case resolves silently — no form flash, no error screen, no visible wrong-door moment.
**Why human:** Requires an authenticated live browser session and observing render/redirect timing; `redirect-if-signed-in.test.ts` proves the logic (3/3 passing) but not the live click-through experience.

#### 2. Client home visual/navigation correctness

**Test:** Log in as client1@fish.dev in a browser → confirm landing on /home inside the shell with greeting "Welcome back, Alex" and copy naming "Coach Dana." Log in as coach@fish.dev → hitting /home in the browser silently forwards to /coach.
**Expected:** Client sees the assigned-state empty state naming their real coach; a coach hitting the client URL is invisibly forwarded.
**Why human:** 03-02-PLAN.md defers this exact check to phase-level UAT; not executed in a running browser session during this verification pass (no dev server was started, per environment/spot-check constraints).

#### 3. Coach home visual/navigation correctness

**Test:** Log in as coach@fish.dev in a browser → confirm /coach lists Alex Rivera, Priya Nair, Sam Okafor alphabetically with their emails, no other coach's clients, and rows show no hover/cursor affordance. Log in as client1@fish.dev → hitting /coach silently forwards to /home.
**Expected:** Exactly the three seeded clients render alphabetically with quiet emails; the list feels inert; a client hitting the coach URL is invisibly forwarded.
**Why human:** 03-03-PLAN.md defers this exact check to phase-level UAT; the "feels inert" visual/tactile quality and live navigation cannot be fully proven by grep/unit tests.

### Gaps Summary

No blocking gaps. Every must-have truth, artifact, and key link checked against the actual codebase — not just SUMMARY claims — and independently re-verified in this session (full test suite re-run: 173/173; production build re-run: exit 0; lint/typecheck re-run: exit 0; live RLS script re-run against the local Supabase stack: 8/8 PASS; live SQL queries against `profiles`, `pg_proc`, and `pg_policies` confirming the migration is actually applied, not just written). The one documented deviation (verify-rls's `checkClientBoundary` two-row invariant) is a pre-approved, well-reasoned correction to an internally-inconsistent plan instruction, not an unresolved gap.

The phase goal is functionally, structurally, and behaviorally achieved at every level this verifier can check without a browser. The remaining work is three human click-through checks (all pre-identified by the phase's own plans as deferred UAT), which is why status is `human_needed` rather than `passed`.
