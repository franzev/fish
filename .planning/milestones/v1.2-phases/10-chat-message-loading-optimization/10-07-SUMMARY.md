---
phase: 10-chat-message-loading-optimization
plan: 07
subsystem: chat
tags: [react, supabase-realtime, reconnect, concurrency, vitest]

requires:
  - phase: 10-chat-message-loading-optimization
    provides: bounded reconnect backfill, per-channel first-subscribe suppression, and shared in-flight coalescing
provides:
  - Promise-identity-owned release for the shared realtime reconnect lock
  - Deferred overlapping A-to-B reconnect regression for VR-01
affects: [phase-10-reverification, chat-reconnect, realtime-coalescing]

tech-stack:
  added: []
  patterns:
    - Shared async lock entries may be released only by the exact promise currently stored in the lock ref

key-files:
  created: []
  modified:
    - apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx

key-decisions:
  - "Keep the conversation-id effect's explicit lock reset so conversation B can recover independently, and guard only each promise's finally release by identity."

patterns-established:
  - "Promise-owned ref release: compare the current ref to the locally captured promise before clearing a shared async lock."

requirements-completed: [CLOAD-06]

duration: 4 min
completed: 2026-07-10
---

# Phase 10 Plan 07: Reconnect Lock Ownership Summary

**Realtime reconnect recovery now prevents a stale conversation A completion from releasing conversation B's active bounded-backfill lock.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-10T23:36:42Z
- **Completed:** 2026-07-10T23:41:05Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added the exact VR-01 sequence on one mounted `ChatClient`: A pending, switch to B, B pending, A settles, then B resubscribes.
- Proved A's late settlement cannot launch a second B recovery while B still owns the lock.
- Proved B's own settlement releases the lock so a later genuine B reconnect can start one new bounded recovery.
- Preserved per-channel first-subscribe suppression, the conversation-change reset, all three reconnect channel keys, and `applyGapBackfill ?? refreshConversation`.

## TDD Execution

- **RED:** `41f4329c` added the deferred overlapping-recovery regression. It failed on the intended assertion because the current implementation launched a third recovery after only A settled.
- **GREEN:** `b549cef1` captured the active backfill promise and cleared the ref only when that exact promise still owned it. The focused regression and surrounding suite pass.
- **REFACTOR:** No separate refactor commit was needed; the final form uses a typed local promise and a single identity guard.

## Task Commits

1. **Task 1 RED: overlapping reconnect lock regression** - `41f4329c` (test)
2. **Task 1 GREEN: promise-owned reconnect lock release** - `b549cef1` (fix)

## Files Created/Modified

- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Drives public realtime status callbacks and deferred bounded-backfill actions across an A-to-B conversation switch.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` - Releases the reconnect lock only when the settling promise still matches the lock ref.

## Decisions Made

- Retained the conversation-id effect's unconditional reset. B must start recovery without waiting for A; ownership safety belongs in each promise's `finally`, not in the cross-conversation reset.
- Kept the shared lock and per-channel first-subscribe `Set` unchanged. The fix narrows release semantics without changing subscription, pagination, UI, or authority boundaries.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first GREEN verification exposed a `prefer-const` lint error and a test-mock unused-parameter warning. The typed promise was converted to `const`, and the mock now validates its public input shape; focused tests, lint, typecheck, and build passed afterward.

## Verification

- RED proof: focused test file failed 1/62 at the intended call-count assertion (`expected 2`, received `3`).
- Focused chat-client tests: **62/62 passed**.
- Surrounding chat tests: **122/122 passed across 7 files**.
- Full web suite: **502/502 passed across 61 files**.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed across all workspace packages.
- `pnpm build`: passed, including the Next.js production build.
- Source/acceptance review: identity comparison is present; the conversation reset, three channel keys, and bounded callback preference remain unchanged.
- Security gate: no high-severity STRIDE/ASVS L1 issue remains; this is client-side request coalescing only, with no new read path, token, schema, dependency, or authority change.

## Known Stubs

None. The scanned empty arrays and null assignments are intentional test collections, subscription cleanup, timeout cleanup, and lock state—not user-facing placeholders.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- VR-01/CLOAD-06 is closed at source and regression-test level.
- Phase 10 is ready for re-verification. HV-01 remains the existing human-only real-browser scroll/skeleton geometry check.

## Self-Check: PASSED

- Both modified files exist.
- RED commit `41f4329c` and GREEN commit `b549cef1` are present in git history in the required order.
- All task acceptance criteria and plan-level automated verification gates pass.
- Existing unrelated changes to `10-VERIFICATION.md`, `apps/web/components/chat/index.ts`, and `09-SECURITY.md` remain outside plan commits.

---
*Phase: 10-chat-message-loading-optimization*
*Completed: 2026-07-10*
