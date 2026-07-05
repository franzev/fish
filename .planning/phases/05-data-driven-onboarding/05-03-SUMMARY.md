---
phase: 05-data-driven-onboarding
plan: 03
subsystem: web
tags: [server-actions, supabase, onboarding, route, rls]
requires:
  - phase: 05-data-driven-onboarding
    provides: 05-01 versioned onboarding schema, RPCs, RLS, and seed data
  - phase: 05-data-driven-onboarding
    provides: 05-02 shared field contracts, validation, and onboarding conversation components
provides:
  - Onboarding repository DTOs and Supabase implementation
  - Authenticated onboarding save/finalize Server Actions
  - Client onboarding route with persisted resume state
  - Assigned home start/continue entry
  - Repeatable onboarding RLS verification
affects: [phase-05-data-driven-onboarding, phase-06-tracker-engine]
tech-stack:
  added: []
  patterns: [server action re-authentication, config-aware action validation, RLS-backed repository, client flow wrapper]
key-files:
  created:
    - apps/web/app/(authenticated)/onboarding/actions.ts
    - apps/web/app/(authenticated)/onboarding/actions.test.ts
    - apps/web/app/(authenticated)/onboarding/page.tsx
    - apps/web/app/(authenticated)/onboarding/page.test.tsx
    - apps/web/app/(authenticated)/onboarding/onboarding-client-flow.tsx
  modified:
    - apps/web/lib/services/supabase/types.ts
    - apps/web/lib/services/supabase/core.ts
    - apps/web/lib/auth/server.ts
    - apps/web/app/(authenticated)/home/page.tsx
    - apps/web/app/(authenticated)/home/page.test.tsx
    - scripts/verify-rls.ts
key-decisions:
  - "Server Actions re-check getCurrentUser and never accept client_id or coach_id."
  - "Answer saves load the DB question config and validate the answer against it before calling the RPC."
  - "The client route uses a small client wrapper to update saved answers locally, then refreshes from Supabase."
  - "The home screen shows one assigned start/resume action only when an active onboarding assessment exists."
patterns-established:
  - "OnboardingRepository owns RLS-backed reads and RPC command calls behind the shared service container."
  - "Server route data helpers return role plus nullable onboarding/review data so pages keep the wrong-door redirect pattern."
  - "verify:rls clears its own onboarding attempt fixture before ONBD assertions so repeated runs stay meaningful."
requirements-completed: [ONBD-01, ONBD-02, ONBD-03, ONBD-06]
duration: ~26min
completed: 2026-07-05
---

# Phase 05: Data-Driven Onboarding Plan 03 Summary

**Onboarding Server Actions, persisted route state, home entry, and repeatable RLS verification**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-07-05T03:30:08Z
- **Completed:** 2026-07-05T03:49:02Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added `OnboardingRepository`, DTOs, and `SupabaseOnboardingRepository` for active assessment, resume state, validation question lookup, save, finalize, and coach review reads.
- Added `saveOnboardingAnswerAction` and `finalizeOnboardingAttemptAction` with session re-checks, zod payload parsing, config-aware answer validation, calm notice returns, and no trusted client/coach IDs.
- Added `/onboarding` with signed-out and coach wrong-door redirects, active-assessment loading, approved empty copy, and one-question-at-a-time rendering through `OnboardingConversation`.
- Added a client flow wrapper that updates saved answers/current question locally after a successful Server Action and refreshes from Supabase for exact persisted state.
- Added the assigned `/onboarding` start/continue entry on home and route tests for no chooser language, resume reassurance, one primary action, and wrong-door redirects.
- Made `pnpm verify:rls` repeatable by clearing its own onboarding attempt fixture before ONBD assertions.

## Task Commits

1. **Task 1: Add onboarding repository, server data access, and save/finalize Server Actions** - `2d61389` (feat)
2. **Task 2: Add `/onboarding` route and assigned home start/resume entry** - `1fdf95f` (feat)

Note: the home page source entry was already present in `HEAD` via intervening commit `637619b` before the Task 2 summary commit; the Task 2 tests and server data shape were committed in `1fdf95f`.

## Files Created/Modified

- `apps/web/lib/services/supabase/types.ts` - Onboarding repository interface and client/coach DTOs.
- `apps/web/lib/services/supabase/core.ts` - Supabase onboarding repository and service registration.
- `apps/web/lib/auth/server.ts` - Client onboarding and coach review server data helpers; home data now includes onboarding state.
- `apps/web/app/(authenticated)/onboarding/actions.ts` - Authenticated save/finalize Server Actions.
- `apps/web/app/(authenticated)/onboarding/actions.test.ts` - Session, validation, no trusted ID, save, and finalize action tests.
- `apps/web/app/(authenticated)/onboarding/page.tsx` - Client onboarding Server Component route.
- `apps/web/app/(authenticated)/onboarding/onboarding-client-flow.tsx` - Client-side action/result bridge around `OnboardingConversation`.
- `apps/web/app/(authenticated)/onboarding/page.test.tsx` - Route redirect, empty, resume, no-chooser, and source wiring tests.
- `apps/web/app/(authenticated)/home/page.tsx` - Assigned start/continue onboarding entry.
- `apps/web/app/(authenticated)/home/page.test.tsx` - Home entry and one-primary action tests.
- `scripts/verify-rls.ts` - Repeatable onboarding fixture reset before ONBD checks.

## Decisions Made

- Kept the Server Action boundary narrow: browser payloads include only `questionId` and `answer`; user identity and authorization come from the session and RLS/RPC functions.
- Validated answer/config compatibility in the action before persistence so invalid option ids, scale values, and text lengths never reach `save_onboarding_answer`.
- Used a route-local client wrapper instead of pushing persistence state into the reusable `OnboardingConversation`; the conversation component remains a config-driven UI primitive for Phase 6 reuse.
- Preserved the home screen's sparse shape: one assigned onboarding action, with `/profile` left as a quiet text link.

## Deviations from Plan

### Auto-fixed Issues

**1. [Verification repeatability] Reset onboarding verifier fixture before ONBD checks**

- **Found during:** Plan-level `pnpm verify:rls`
- **Issue:** A prior verifier run finalized client1's onboarding attempt. A second run then failed the self-save assertion because the SQL function correctly rejects saves after sharing.
- **Fix:** Added `resetOnboardingVerificationState()` to delete client1's prior onboarding attempt through the service-role verifier setup before ONBD checks.
- **Files modified:** `scripts/verify-rls.ts`
- **Verification:** `pnpm verify:rls` passed after the reset.
- **Committed in:** `1fdf95f`

---

**Total deviations:** 1 auto-fixed (verification repeatability)
**Impact on plan:** The security behavior stayed unchanged; the verifier now proves it reliably on repeated local runs.

## Issues Encountered

- Initial RED route/home tests failed because `/onboarding` and the home entry did not exist yet.
- TypeScript required explicit JSON-to-field casts in the repository DTO mapping layer.
- The first `verify:rls` run failed because the verifier was not idempotent across repeated local runs; fixed at the script setup layer.
- The worktree changed while staging: an intervening token-utility commit (`637619b`) appeared at `HEAD`. The final plan state includes that commit; unrelated remaining dirty files were left untouched.

## Verification

- `pnpm --filter @fish/web test -- --run 'apps/web/app/(authenticated)/onboarding/actions.test.ts' 'apps/web/app/(authenticated)/onboarding/page.test.tsx' 'apps/web/app/(authenticated)/home/page.test.tsx'` - passed.
- `pnpm --filter @fish/web typecheck` - passed.
- `pnpm build` - passed.
- `pnpm verify:rls` - passed.
- `rg -n 'getClientOnboardingData|OnboardingConversation|saveOnboardingAnswerAction|finalizeOnboardingAttemptAction' apps/web/app/'(authenticated)'/onboarding/page.tsx apps/web/app/'(authenticated)'/onboarding/onboarding-client-flow.tsx` - passed.
- `rg -n 'href="/onboarding"' apps/web/app/'(authenticated)'/home/page.tsx` - passed.
- `if rg -n 'client_id|coach_id' apps/web/app/'(authenticated)'/onboarding/actions.ts; then exit 1; else echo 'actions source is free of client_id/coach_id'; fi` - passed.
- `if rg -n 'assessment(s)?\\.map|template(s)?\\.map|plan(s)?\\.map|choose an assessment|pick an assessment|gallery' apps/web/app/'(authenticated)'/home/page.tsx apps/web/app/'(authenticated)'/onboarding/page.tsx apps/web/app/'(authenticated)'/onboarding/onboarding-client-flow.tsx; then exit 1; else echo 'no chooser/list UI patterns found'; fi` - passed.

## Self-Check: PASSED

- `/home` presents the assigned onboarding entry without adding assessment choices.
- `/onboarding` renders one DB-configured question at a time through the shared renderer path.
- Save/finalize go through authenticated, zod/config-validated Server Actions and SQL command functions.
- Resume position and saved answers come from persisted Supabase state.
- No client-facing score, grade, placement, recommendation, streak, or percentage-as-judgement was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-04 can add the coach read-only onboarding review surface and final release gates using `getCoachClientOnboardingReviewData(clientId)` plus the repository review DTOs already created here.

---
*Phase: 05-data-driven-onboarding*
*Completed: 2026-07-05*
