---
phase: 03-role-aware-home
plan: 03
subsystem: coach-home
tags: [nextjs, supabase, rls, app-router, server-components]

# Dependency graph
requires:
  - phase: 03-role-aware-home
    plan: 01
    provides: "(authenticated) route group + guard layout, AppShell, EmptyState, is_client_of RLS policy, profiles.email"
provides:
  - "apps/web/app/(authenticated)/coach/page.tsx: coach home with role guard (client→/home), own-clients read via coach_clients join, ClientList or EmptyState"
  - "apps/web/components/coach/client-list.tsx: alphabetical, inert, single-Card client list (name + muted email)"
  - "scripts/verify-rls.ts: checkClientReadsCoachName() (D-16) assertion; checkClientBoundary() updated to the post-0006 two-row invariant, restoring verify:rls to exit 0"
affects: ["03-04 (phase verification)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coach home reads coach_clients (already RLS-scoped to caller's own coach id) joined to profiles via embedded-resource select (profiles:client_id(...)), avoiding both a manual coach-id filter and the self-row edge case a bare profiles select would hit"
    - "verify-rls.ts assertions resolve foreign ids the same legitimate way the RLS policy under test permits (coach_clients read), rather than hard-coding seed ids, so the assertion tracks the real authorization path"

key-files:
  created:
    - apps/web/components/coach/client-list.tsx
    - apps/web/components/coach/client-list.test.tsx
    - apps/web/app/(authenticated)/coach/page.tsx
    - apps/web/app/(authenticated)/coach/page.test.tsx
  modified:
    - scripts/verify-rls.ts

key-decisions:
  - "ClientList sorts a shallow copy of the clients prop (never mutates it) using localeCompare on displayName (D-15)"
  - "Coach home queries coach_clients embedded-joined to profiles (profiles:client_id(id, display_name, email)) rather than querying profiles directly and excluding the coach's own row — resolves RESEARCH.md Open Question 3 and sidesteps the self-row edge case entirely"
  - "checkClientBoundary() updated to the post-0006 invariant (approved deviation): a client now legitimately sees exactly 2 profiles rows (own + assigned coach) since the is_client_of policy landed in 03-01, not 1; the coach id is resolved via the same coach_clients read a client is authorized to make, and the leak check now flags any row outside {ownId, coachId}"

patterns-established:
  - "Grep-gate wording discipline for RLS-boundary tests: comments describing 'no manual filter' policies must avoid the literal method-call substring being grep-gated (e.g. describe intent in prose, not as a fake code snippet), so documentation doesn't accidentally trip its own acceptance gate"

requirements-completed: [ROUT-03, ROUT-04, SHEL-02]

coverage:
  - id: D1
    description: "ClientList renders one calm Card of alphabetical, inert name+email rows with hairline dividers"
    requirement: "ROUT-04"
    verification:
      - kind: unit
        ref: "apps/web/components/coach/client-list.test.tsx#ClientList (alphabetical order, name+email render, no-mutation, D-14 grep gate, single-Card D-12 gate)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Coach home guards clients to /home, lists exactly the coach's own assigned clients via RLS-scoped coach_clients (no manual filter), and shows a calm empty state at zero"
    requirement: "ROUT-03"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/coach/page.test.tsx#CoachHomePage (wrong-door redirect, 3-client render, empty-state render, no-manual-filter grep gate)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A coach with zero assigned clients sees a calm empty state, no primary action anywhere on the page"
    requirement: "SHEL-02"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/coach/page.test.tsx#CoachHomePage (empty-state test); manual source review confirms no variant=\"primary\""
        status: pass
    human_judgment: false
  - id: D4
    description: "verify:rls proves a client can read only their own coach's name via is_client_of, and the pre-existing client-boundary assertion is restored to the post-0006 two-row invariant"
    requirement: "ROUT-03"
    verification:
      - kind: integration
        ref: "pnpm verify:rls run live against the seeded local Supabase stack — 8/8 assertions PASS, process exits 0"
        status: pass
    human_judgment: true
    rationale: "RLS behavior against a live database cannot be proven by a unit test alone; this is a scripted live-DB gate, run and confirmed exit 0 in this session."
  - id: D5
    description: "Full web test suite and production build stay green after all three tasks"
    requirement: "ROUT-03"
    verification:
      - kind: unit
        ref: "pnpm --filter @fish/web test -- --run (170/170 passing, up from 161 at plan start)"
        status: pass
      - kind: integration
        ref: "pnpm build (0 errors; /coach compiles as a dynamic route); pnpm --filter @fish/web typecheck (0 errors)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-04
status: complete
---

# Phase 3 Plan 3: Coach home Summary

**Coach home at `/coach`: a role-guarded server page listing exactly the coach's own assigned clients (alphabetical, inert, name + muted email) via an RLS-scoped `coach_clients` join, with a calm empty state at zero — plus a live `verify-rls.ts` fix that restores `pnpm verify:rls` to exit 0 by updating the client-boundary assertion to the post-0006 two-row invariant and adding the new D-16 client-reads-coach-name proof.**

## Performance

- **Duration:** ~15 min (Task 1 through Task 3, single continuous session)
- **Started:** 2026-07-04T03:58:00Z (approx)
- **Completed:** 2026-07-04T04:02:56Z
- **Tasks:** 3 (2 auto tdd="true", 1 auto)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- `apps/web/components/coach/client-list.tsx` renders one calm `Card` (`divide-y divide-border p-0`) of alphabetically sorted (localeCompare, non-mutating copy), inert rows — display name + muted email, no dates, no `hover:`/`cursor-pointer` anywhere in the source (D-12 through D-15).
- `apps/web/app/(authenticated)/coach/page.tsx` re-reads `getUser()` + `profiles.role` for its own wrong-door guard (client → `/home`, D-03), then reads the coach's own clients by querying `coach_clients` (RLS-scoped to the caller's own coach id by the existing "coach reads own assignments" policy) embedded-joined to `profiles` — resolving RESEARCH.md's Open Question 3 without a manual coach-id filter and without the self-row edge case a bare `profiles` select would hit. Renders `<h1>Your clients</h1>` plus `ClientList` when clients exist, or a calm `EmptyState` (`IconUsers`, "Clients assigned to you will show up here.") at zero. No `variant="primary"` on the page.
- `scripts/verify-rls.ts` gained `checkClientReadsCoachName()` (D-16): signs in as `client1`, resolves the assigned coach id via the `coach_clients` read a client is legitimately authorized to make, then reads that coach's `profiles.display_name` — asserting no recursion, exactly one row (the scoping proof), and a non-empty name.
- **Approved deviation applied:** `checkClientBoundary()` was updated to the post-0006 invariant — a client now legitimately sees exactly 2 `profiles` rows (own + assigned coach), not 1, because the `is_client_of` policy (landed in 03-01) intentionally widened the read surface. The function now resolves the assigned coach id via the same `coach_clients` read the new D-16 assertion uses, asserts `rows.length === 2`, and flags any row whose id is outside `{ownId, coachId}` as a leak. The stale "profiles has no email column" comment was replaced.
- `pnpm verify:rls` run live against the seeded local Supabase stack: **8/8 assertions PASS, exit code 0** (verified explicitly via `echo $?` after the run).
- Full web test suite: 170/170 passing (up from 161 at plan start — 9 new tests across the two new test files). `pnpm build` and `pnpm --filter @fish/web typecheck` both exit 0; `/coach` compiles as a dynamic route.

## Task Commits

1. **Task 1: ClientList component (alphabetical, inert rows) + its test** - `f350988` (feat)
2. **Task 2: Coach home page (role guard, own-clients read, list/empty state)** - `8795441` (feat)
3. **Task 3: Extend verify-rls.ts with the client-reads-coach-name assertion (+ approved deviation)** - `09e6200` (feat)

## Files Created/Modified

- `apps/web/components/coach/client-list.tsx` - alphabetical, inert, single-Card client list (name + muted email)
- `apps/web/components/coach/client-list.test.tsx` - 5 tests: alphabetical order, name+email render, no-mutation, D-14 grep gate, single-Card D-12 gate
- `apps/web/app/(authenticated)/coach/page.tsx` - coach home: role guard, coach_clients→profiles read, ClientList/EmptyState branching
- `apps/web/app/(authenticated)/coach/page.test.tsx` - 4 tests: wrong-door redirect, populated list render, empty-state render, no-manual-filter grep gate
- `scripts/verify-rls.ts` - added `checkClientReadsCoachName()` (D-16); updated `checkClientBoundary()` to the post-0006 two-row invariant; wired the new check into `main()`

## Decisions Made

- `ClientList` sorts a shallow copy (`[...clients].sort(...)`) rather than the prop array itself, per D-15's explicit non-mutation requirement.
- The coach home queries `coach_clients` embedded-joined to `profiles` (`profiles:client_id(id, display_name, email)`) instead of querying `profiles` directly and excluding the coach's own row with `.neq("id", ...)` — this was RESEARCH.md's recommended resolution to Open Question 3, confirmed compatible with the generated types (the `coach_clients_client_id_fkey` FK is `isOneToOne: true` against `profiles`, so `tsc --noEmit` passed clean against the embedded-select shape without a fallback).
- The code comment describing "no manual coach-id filter" was deliberately phrased in prose rather than as a literal `.eq("coach_id", ...)` snippet, because the page's own acceptance-criteria grep gate (`not.toMatch(/\.eq\("coach_id"/)`) would otherwise trip on its own explanatory comment — a documentation-wording adjustment, not a behavior change.
- `checkClientBoundary()`'s post-0006 invariant (approved deviation, see below) resolves the coach id via a live `coach_clients` read rather than hard-coding a seed id, keeping the assertion's authorization path identical to what a real client session can do.

## Deviations from Plan

### Approved Deviation (user-approved at 03-01 Task 2 checkpoint)

**[Approved Deviation] Updated `checkClientBoundary()` to the post-0006 two-row invariant, per explicit user approval**

- **Found during:** Task 3 (extending `verify-rls.ts`)
- **Issue:** The plan's Task 3 instructed "do not change the existing three assertions" while also requiring the acceptance criterion "`pnpm verify:rls` exits 0 (all assertions pass against the live seeded DB)". These were mutually impossible: migration 0006 (landed in Plan 03-01) added the `is_client_of` policy, so a signed-in client's `select * from profiles` now legitimately returns exactly TWO rows (own + assigned coach), not one. The existing `checkClientBoundary()` asserted `rows.length === 1` and treated any foreign id as a leak — an assertion that can never pass again post-0006. This was already documented and flagged as a known planning defect in the 03-01 SUMMARY, with the live behavior independently verified at that checkpoint (client1 and client2 each see exactly own row + coach row, no cross-client or foreign-coach leak).
- **Fix (as explicitly instructed by the orchestrator/user-approved deviation):** Updated `checkClientBoundary()` to resolve the assigned coach id via `.from("coach_clients").select("coach_id").eq("client_id", ownId).single()` (the 0003 policy permits this read), then assert the client sees exactly 2 `profiles` rows whose id set equals `{ownId, coachId}` — any row outside that set is reported as a leak. Replaced the stale "profiles has no email column" comment. Left `checkCoachBoundary()` and `checkEscalationRejected()` untouched, per the deviation's explicit scope.
- **Files modified:** `scripts/verify-rls.ts`
- **Verification:** `pnpm verify:rls` run live against the seeded local Supabase stack — all 8 assertions (6 pre-existing + 2 new/updated `checkClientBoundary` reports + the new D-16 pair) PASS; process exit code confirmed as `0` via explicit `echo $?` after the run.
- **Committed in:** `09e6200` (Task 3 commit)

No other deviations. Tasks 1 and 2 executed exactly as written.

---

**Total deviations:** 1 (approved architectural correction to Task 3, resolving a documented planning defect from Plan 03-01)
**Impact on plan:** Restores the plan's own acceptance criterion ("`pnpm verify:rls` exits 0") to an achievable state, consistent with the live RLS behavior already proven and approved during 03-01's Task 2 checkpoint. No scope creep beyond the explicitly approved fix.

## Issues Encountered

- A code comment in the coach home page initially contained the literal substring `.eq("coach_id"` as part of its prose explanation of "no manual filter" — this tripped the page's own grep-gate test (`not.toMatch(/\.eq\("coach_id"/)`). Reworded the comment to describe the same intent without the literal matched substring; no behavior change, test then passed. Not logged as a Rule 1-3 deviation since it was a same-task authoring correction, not a discovered defect in prior work.

## User Setup Required

None — the local Supabase stack was already running, reset, and seeded from Plan 03-01's Task 2 checkpoint; no additional setup was needed to run `pnpm verify:rls` live in this plan.

## Next Phase Readiness

- Plan 03-04 (phase verification) can now proceed: `/coach` and `/home` both exist under the `(authenticated)` group, `pnpm verify:rls` exits 0 (all 8 assertions, including D-16), the full test suite is green (170/170), and `pnpm build` compiles both routes.
- No blockers.

---
*Phase: 03-role-aware-home*
*Completed: 2026-07-04*

## Self-Check: PASSED

All 5 claimed files verified present on disk (`apps/web/components/coach/client-list.tsx`, `apps/web/components/coach/client-list.test.tsx`, `apps/web/app/(authenticated)/coach/page.tsx`, `apps/web/app/(authenticated)/coach/page.test.tsx`, `scripts/verify-rls.ts`); all 4 commit hashes (`f350988`, `8795441`, `09e6200`, `d8477d4`) verified present in git log.
