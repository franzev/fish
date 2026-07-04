---
phase: 03-role-aware-home
plan: 02
subsystem: client-home
tags: [nextjs, supabase, rls, app-router, server-components]

# Dependency graph
requires:
  - phase: 03-role-aware-home
    plan: 01
    provides: "(authenticated) route group + guard layout, AppShell, EmptyState, is_client_of RLS policy, profiles.email"
provides:
  - "apps/web/app/(authenticated)/home/page.tsx: real client home with wrong-door guard, coach-assignment read, first-name greeting, assigned/unassigned EmptyState"
affects: ["03-03 (coach home)", "03-04 (phase verification)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf-page wrong-door guard: each page under (authenticated) re-reads profiles.role for its own role check (D-03), rather than the shared layout knowing which leaf route it wraps"
    - "Keyed-by-table Supabase mock in tests: .from(table).select().eq().single()/.maybeSingle() resolve from per-table FIFO queues, letting one test script multiple sequential reads (profiles role, coach_clients assignment, profiles coach name) independently"

key-files:
  created:
    - apps/web/app/(authenticated)/home/page.tsx
    - apps/web/app/(authenticated)/home/page.test.tsx
  modified: []
  removed:
    - apps/web/app/home/page.tsx
    - apps/web/app/home/page.test.tsx

key-decisions:
  - "firstName is derived by splitting display_name on whitespace and taking the first token (single-word names fall through unchanged since split()[0] on a one-word string returns the whole string)"
  - "The page re-reads getUser() and profiles.role itself rather than trusting a value threaded down from the layout — matches RESEARCH.md Pitfall 5 and Plan 01's established layout precedent (Server Components re-execute per navigation; no cross-component caching)"
  - "No manual coach_id filtering beyond the client's own client_id lookup on coach_clients, and no manual filtering on the coach-name profiles read beyond .eq('id', assignment.coach_id) — RLS (is_client_of, from Plan 01) is the sole boundary, per AGENTS.md's API rule"

patterns-established:
  - "Empty-state branching pattern: a single EmptyState component parameterized by conditional children (coach-named copy vs. unassigned copy), decided server-side from a maybeSingle() read before render"

requirements-completed: [ROUT-02, SHEL-02]

coverage:
  - id: D1
    description: "A client visiting /home sees a calm first-name greeting and the correct empty state (unassigned reassurance, or assigned copy naming the coach)"
    requirement: "ROUT-02"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/home/page.test.tsx#ClientHomePage (unassigned-state test, assigned-state test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A coach visiting /home is silently redirected to /coach (D-03 wrong door)"
    requirement: "ROUT-02"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/home/page.test.tsx#ClientHomePage (coach wrong-door test asserting redirect('/coach'))"
        status: pass
    human_judgment: false
  - id: D3
    description: "The client home carries zero primary actions (logout in the shell is the only interactive element)"
    requirement: "SHEL-02"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/home/page.test.tsx#ClientHomePage (grep-gate: zero variant=\"primary\" occurrences in page.tsx)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The old flat placeholder page and test are removed with no dangling imports; full suite and build stay green"
    requirement: "ROUT-02"
    verification:
      - kind: unit
        ref: "pnpm --filter @fish/web test -- --run (161/161 passing)"
        status: pass
      - kind: integration
        ref: "pnpm build (0 errors; /home resolves through the route group as a dynamic route) + pnpm typecheck (0 errors, after clearing a stale .next dev-types cache)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-04
status: complete
---

# Phase 3 Plan 2: Real client home Summary

**Promoted the Phase 2 `/home` placeholder into the real client home: server-resolved wrong-door guard (coach → /coach), a first-name greeting, and an assigned/unassigned EmptyState that names the coach when a `coach_clients` row exists — all reading through Plan 01's `is_client_of` RLS policy with zero primary actions on the page.**

## Performance

- **Duration:** 8 min (single-task plan)
- **Started:** 2026-07-04T03:45:12Z (approx, immediately following 03-01 completion)
- **Completed:** 2026-07-04T03:53:12Z
- **Tasks:** 1 (auto, tdd="true")
- **Files modified:** 4 (2 created, 2 removed)

## Accomplishments

- `apps/web/app/(authenticated)/home/page.tsx` is the real client home: it re-reads `getUser()` + `profiles.role` (the layout already gated signed-out visitors; this page owns only the leaf-level wrong-door check), redirects a coach to `/coach` silently (D-03), derives `firstName` from `display_name`, reads the `coach_clients` assignment via `.maybeSingle()`, and — when assigned — reads the coach's `display_name` through Plan 01's `is_client_of` RLS policy with no manual coach-id filtering beyond the direct id lookup.
- Renders `<h1>Welcome back, {firstName}</h1>` followed by `EmptyState` with either "We're getting things ready for you." (unassigned) or "Your coach {name} is setting things up." (assigned, D-16) — both calm, sentence-case, zero actions.
- The old flat `apps/web/app/home/page.tsx` (Phase 2's neutral "You're signed in" placeholder) and its test are deleted; the page now truly lives only inside the `(authenticated)` route group.
- New test file covers all four required behaviors: coach wrong-door redirect, unassigned empty state + greeting, assigned empty state naming the coach, and a zero-`variant="primary"` grep gate — via a keyed-by-table Supabase mock supporting multiple sequential `.single()`/`.maybeSingle()` reads per test.

## Task Commits

1. **Task 1: Move /home into the (authenticated) group and build the real client home** - `42d0fbe` (feat)

## Files Created/Modified

- `apps/web/app/(authenticated)/home/page.tsx` - real client home: wrong-door guard, coach-assignment read, greeting, EmptyState branching
- `apps/web/app/(authenticated)/home/page.test.tsx` - 4 tests: coach redirect, unassigned state, assigned state naming the coach, zero-primary grep gate
- `apps/web/app/home/page.tsx` - deleted (Phase 2 placeholder, superseded)
- `apps/web/app/home/page.test.tsx` - deleted (superseded by the new test above)

## Decisions Made

- `firstName` is computed with `display_name.split(" ")[0]` — for a single-word display name this naturally returns the whole name (no special-casing needed), matching the plan's "fall back to the whole display_name if single-word" instruction.
- The page independently re-reads `getUser()` and `profiles.role` rather than accepting a role prop threaded from the layout — Server Components re-execute their full body per navigation, so this is the correct (not redundant) pattern per Plan 01's RESEARCH.md Pitfall 5, and keeps this leaf page self-contained for its own wrong-door check (D-03), matching Plan 01's stated design ("the per-page wrong-role check lives in each leaf page, not the shared layout").
- No manual `.eq("coach_id", ...)` beyond the client's own `client_id` lookup on `coach_clients`, and no manual filtering on the coach-name `profiles` read beyond `.eq("id", assignment.coach_id)` — RLS (`is_client_of`, shipped in Plan 01) is treated as the sole authorization boundary, per AGENTS.md's API rule and the pattern established in `scripts/verify-rls.ts`.

## Deviations from Plan

None — plan executed exactly as written. One transient build-tooling artifact was encountered and resolved without any source change:

- After deleting `apps/web/app/home/page.tsx`, `pnpm typecheck` initially failed on a stale generated file (`apps/web/.next/dev/types/validator.ts`) still referencing the deleted route — a leftover Next.js dev-type-generation artifact from before this task's `pnpm build` ran. Clearing `apps/web/.next` and re-running `pnpm build` (which the plan's own acceptance criteria already require) regenerated the file correctly and `pnpm typecheck` passed clean afterward. No source file was touched to fix this; it is not logged as a Rule 1/2/3 deviation since no code changed.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03 (coach home) can now proceed in parallel/next — it depends on Plan 01's shared spine (`(authenticated)` layout, `AppShell`, `EmptyState`), not on this plan's client-home page.
- `pnpm verify:rls` still intentionally exits 1 (2/6 stale pre-0006 assertions) per Plan 01's documented, user-approved carry-forward — Plan 03-03 owns the fix. Not in this plan's scope; unchanged by this plan.
- No blockers.

---
*Phase: 03-role-aware-home*
*Completed: 2026-07-04*

## Self-Check: PASSED

All 3 claimed files verified present on disk (`apps/web/app/(authenticated)/home/page.tsx`, `apps/web/app/(authenticated)/home/page.test.tsx`, `.planning/phases/03-role-aware-home/03-02-SUMMARY.md`); both deletions confirmed (`apps/web/app/home/page.tsx`, `apps/web/app/home/page.test.tsx` no longer exist); both commit hashes (`42d0fbe`, `04daad6`) verified present in git log.
