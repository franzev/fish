---
phase: 09-cross-platform-chat-state
plan: 12
subsystem: ui
tags: [react, zustand, intersection-observer, vitest, pagination, accessibility]

# Dependency graph
requires:
  - phase: 10-chat-message-loading-optimization
    provides: "Cursor-based older-message loading, the shared scroll-preserving wrapper, and the IntersectionObserver sentinel"
provides:
  - "A failure-gated older-message sentinel that cannot re-fire indefinitely while it remains visible"
  - "A calm notice-tone manual retry affordance routed through the same scroll-preserving callback"
  - "Regression coverage for bounded failure, successful retry, continued pagination after success, and conversation changes"
affects: [09-UAT, chat-message-loading, community-room]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async pagination actions report loaded/failed/skipped outcomes so UI-only retry policy stays outside the portable reducer"
    - "A failed IntersectionObserver request disconnects automatic loading until the user retries or the conversation changes"

key-files:
  created: []
  modified:
    - apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
    - apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx

key-decisions:
  - "Keep olderPageLoadFailed retryable in the portable reducer; the web pagination hook owns the bounded automatic-retry gate"
  - "Both IntersectionObserver and manual retry continue through loadOlderAndPreserveScroll, preserving the single scroll-anchor restoration path"
  - "Reset a stale failure gate with a conditional render-time callback-identity comparison because the repository forbids synchronous setState inside effects"

patterns-established:
  - "Observer failure gate: one automatic request per visible-sentinel failure, then explicit user action before another request"
  - "Pagination failure UI replaces the ordinary load control with one notice-tone Alert plus one 56px ghost retry"

requirements-completed: [CSTATE-02, CSTATE-06]

coverage:
  - id: D1
    description: "Two sentinel intersections after one failed older-page load call loadOlderMessagesAction exactly once"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "app/(authenticated)/chat/chat-client.test.tsx#bounds automatic load earlier retries after a failure while the sentinel stays visible"
        status: pass
    human_judgment: false
  - id: D2
    description: "The failure state is a notice-tone Alert with one ghost Try again control and no duplicate Load earlier messages control"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "app/(authenticated)/chat/chat-client.test.tsx#shows a calm notice-tone load earlier failure affordance without a duplicate action"
        status: pass
    human_judgment: false
  - id: D3
    description: "Manual retry re-attempts the action, clears the notice after success, and renders recovered earlier history"
    requirement: "CSTATE-02"
    verification:
      - kind: unit
        ref: "app/(authenticated)/chat/chat-client.test.tsx#retries load earlier manually and clears the notice when earlier history loads"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 12: Older-Page Retry Storm Closure Summary

**Failed older-message pagination now stops after one automatic attempt, explains the failure with a calm notice, and recovers through one scroll-safe manual retry.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-10T06:18:16Z
- **Completed:** 2026-07-10T06:30:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Changed `loadOlderMessages` from a silent `Promise<void>` into explicit `loaded` / `failed` / `skipped` outcomes while preserving every existing store transition and the portable reducer unchanged.
- Added a local failure gate that disconnects the already-visible sentinel after one failed request, while leaving successful pagination and a newly selected conversation eligible for automatic loading.
- Added a notice-tone `load-older-error` state with one 56px ghost `Try again` button; successful retry clears the notice and prepends the recovered history through the existing scroll-preserving callback.
- Added regression tests covering the exact UAT failure sequence, manual recovery, continued multi-page loading after success, and conversation-change reset behavior.

## Task Commits

Each task followed the TDD RED/GREEN sequence:

1. **Task 1: Bound the sentinel auto-retry after a failed older-page load** - `ef5a6baf` (test, RED) -> `54babc13` (feat, GREEN)
2. **Task 2: Calm notice-tone failure affordance with manual retry** - `d3b17d8a` (test, RED) -> `fbccd071` (feat, GREEN)

**Plan metadata:** (this commit — docs: complete plan)

## TDD Gate Compliance

- Task 1 RED failed for the intended reason: the regression expected one action call but observed two after two intersections. GREEN passed the regression plus success/reset coverage.
- Task 2 RED failed because `load-older-error` did not exist. GREEN passed notice-tone, single-control, manual-retry, notice-clear, and recovered-history assertions.
- No separate REFACTOR commit was needed; the GREEN implementations remained focused and lint-clean.

## Files Created/Modified

- `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` - Defines `LoadOlderMessagesOutcome` and returns `loaded`, `failed`, or `skipped` from the existing pagination action path.
- `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts` - Owns the failure gate, observer disconnection, conversation reset, and the single scroll-preserving wrapper.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - Renders the calm notice-tone replacement state and its ghost manual retry.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Covers bounded automatic failure, notice presentation, recovery, successful continued pagination, and conversation changes.

## Decisions Made

- Kept `packages/core/src/chat-state/reducer.ts` byte-for-byte unchanged: retryability remains a portable state-machine capability, while the browser adapter decides when automatic observation may invoke it.
- Kept `loadOlderAndPreserveScroll` as the only callable UI path for both observer and button triggers, so the failure fix cannot bypass scroll restoration.
- Used the project-standard conditional render-time identity reset for conversation changes; it provides the plan's reset behavior without violating the enforced React lint rule against synchronous state writes inside effects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced the prescribed effect-based reset with the repository-safe render-time identity pattern**

- **Found during:** Task 1 (Bound the sentinel auto-retry after a failed older-page load)
- **Issue:** The plan explicitly requested an effect that synchronously calls `setHasOlderLoadError(false)`, but ESLint rejected it under `react-hooks/set-state-in-effect`.
- **Fix:** Track the previous `onLoadOlder` identity in local state and conditionally reset the gate during render, matching the existing React-documented pattern already used in `ChatClient`.
- **Files modified:** `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts`
- **Verification:** Focused ESLint passed; conversation-change regression passed; full `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed.
- **Committed in:** `54babc13`

---

**Total deviations:** 1 auto-fixed (1 blocking toolchain conflict).
**Impact on plan:** Behavior and scope are unchanged; the alternate reset mechanism is required for the repository's lint gate and is covered by a dedicated regression test.

## Issues Encountered

- The prescribed reset effect triggered `react-hooks/set-state-in-effect`; resolved through the documented deviation above. No remaining implementation issues.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm exec vitest run 'app/(authenticated)/chat/chat-client.test.tsx' -t 'bounds automatic load earlier retries|retries load earlier manually'` - 2/2 targeted acceptance tests passed.
- `cd apps/web && pnpm test -- run 'app/(authenticated)/chat/chat-client.test.tsx'` - 60 files, 468 tests passed.
- `pnpm typecheck` - all workspace typechecks passed.
- `pnpm lint` - web ESLint passed.
- `pnpm build` - core/supabase type builds and Next.js production build passed.
- `git diff --exit-code 93484b74..HEAD -- packages/core/src/chat-state/reducer.ts` - no reducer changes.

## Next Phase Readiness

- Plan 09-12 closes the diagnosed Phase 09 UAT Test 2 blocker in code and automated coverage.
- Manual UAT remains: force an older-page failure at `/channels/general`, confirm the calm notice replaces the flickering retry loop, then confirm `Try again` recovers.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*

## Self-Check: PASSED

All four task commits are present; all modified files exist; both task acceptance paths, the full chat-client suite, typecheck, lint, and production build pass; the portable reducer and the user's two unrelated SVG edits remain untouched by this plan.
