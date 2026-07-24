---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 09
subsystem: native-parity
tags: [android, kotlin, shared-content, fixtures, privacy, pagination]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: corrected portable request-sequenced reducer and version 2 canonical fixture corpus
  - phase: 11-shared-content-contract-and-privacy-boundary
    plan: 04
    provides: pure Android shared-content reducer and direct canonical fixture resource mapping
provides:
  - Android request-token and conversation-ownership parity for shared-content page and realtime events
  - strict complete-state replay of the canonical shared-content corpus
affects: [phase-12-cache-and-recovery, phase-13-gallery-browsing, phase-14-preview-actions]

# Tech tracking
tech-stack:
  added: []
  patterns: [serializable request tokens, whole-event ownership rejection, strict complete JSON projections]

key-files:
  created: []
  modified:
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt
    - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt

key-decisions:
  - "Android consumes a pending request only when request ID, exact cursor, and replace mode all match."
  - "Every page item is validated against the event and active conversation before any page mutation."
  - "Android parity projections preserve explicit null cursors and compare complete items, pages, capabilities, status, tombstones, and pending request state."

patterns-established:
  - "Native shared-content reducers reject mixed conversation payloads as whole-event no-ops."
  - "Canonical fixture lookup and projection handling throw with vector context rather than silently dropping drift."

requirements-completed: [PAGE-02, PAR-01]

# Metrics
duration: 10min
completed: 2026-07-22
---

# Phase 11 Plan 09: Android shared-content request and ownership parity Summary

**Android now mirrors the portable shared-content reducer with opaque request sequencing, whole-event conversation validation, tombstone-safe continuation, and strict complete canonical replay.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-22T15:35:21Z
- **Completed:** 2026-07-22T15:45:14Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added serializable `SharedContentPageRequest`, `pendingPageRequest`, `requestStarted`, and exact request fields on initial/page completion events.
- Ported whole-event page/realtime ownership validation, exact request ID/cursor/mode matching, one-time completion consumption, continuation updates, tombstone filtering, and identity purge behavior.
- Expanded Android parity replay to the version 2 corpus: fixed metadata counts, all request-sequencing vectors, throwing item/event lookups, exhaustive projection keys, and complete item/page/state equality.

## Task Commits

Each task was committed atomically with the required TDD RED/GREEN flow:

1. **Task 1 RED: Add strict Android shared-content replay assertions** - `e974933b` (test)
2. **Task 1 GREEN: Enforce Android shared-content request ownership** - `934f1217` (feat)
3. **Task 1 follow-up: Bind Android realtime state to its conversation** - `011d2b89` (fix)

## Files Created/Modified

- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt` - Android wire types and pure reducer for request sequencing, conversation ownership, tombstones, and continuation state.
- `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt` - direct canonical fixture replay with strict item, page, cursor, capability, status, request, and state projections.

## Verification

- `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentParityTest'` - passed; 2 tests.
- `node --experimental-strip-types --test packages/core/src/shared-content/shared-content.test.ts` - passed; 7 tests.
- `pnpm android:assemble` - passed; `assembleDebug`, 300 actionable tasks.
- `pnpm build` - passed; core, Supabase, and Next.js web build.
- `git diff --check` - passed.
- No Gradle/pnpm lockfile changes or tracked deletions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added exact cursor comparison helper**

- **Found during:** Task 1 GREEN focused parity compile
- **Issue:** The existing Kotlin reducer had no four-field cursor equality helper for the new pending-request contract.
- **Fix:** Added a pure null-safe comparison of `sourceCreatedAt`, `sourceMessageId`, `sourceRank`, and `itemId`.
- **Files modified:** `SharedContentState.kt`
- **Verification:** Focused Android parity test passed.
- **Committed in:** `934f1217`

**2. [Rule 1 - Bug] Matched canonical metadata count arithmetic**

- **Found during:** Task 1 GREEN replay
- **Issue:** The fixture's expected total intentionally counts request-sequencing cases in both the Task 1 subtotal and the state subtotal, while a direct group sum is lower.
- **Fix:** Mirrored the TypeScript canonical count calculation and asserted the fixed Task 1 count of 48.
- **Files modified:** `SharedContentParityTest.kt`
- **Verification:** Android and TypeScript fixture tests passed.
- **Committed in:** `934f1217`

**3. [Rule 1 - Bug] Preserved empty request-sequencing initial state**

- **Found during:** Task 1 GREEN replay
- **Issue:** Bootstrapping an empty request-sequencing vector created an extra empty page, diverging from the portable replay.
- **Fix:** Skip the bootstrap load for empty request-sequencing vectors, matching the canonical TypeScript harness.
- **Files modified:** `SharedContentParityTest.kt`
- **Verification:** All request-sequencing vectors passed.
- **Committed in:** `934f1217`

**4. [Rule 1 - Bug] Preserved explicit nulls in complete projections**

- **Found during:** Task 1 GREEN strict projection replay
- **Issue:** Kotlin serialization omits default null properties, but canonical projections require explicit `requestedCursor` and page `nextCursor` nulls.
- **Fix:** Materialized those projection objects explicitly while retaining normal omission of optional item fields.
- **Files modified:** `SharedContentParityTest.kt`
- **Verification:** Complete page and pending-request projections passed for all vectors.
- **Committed in:** `934f1217`

**5. [Rule 1 - Bug] Bound realtime initialization to the event conversation**

- **Found during:** Final reducer review
- **Issue:** A realtime item could populate an unbound state without recording its conversation ID.
- **Fix:** Set `conversationId` from the validated realtime event when state was previously unbound.
- **Files modified:** `SharedContentState.kt`
- **Verification:** Focused Android parity, assembly, and workspace build passed.
- **Committed in:** `011d2b89`

---

**Total deviations:** 5 auto-fixed (4 Rule 1 bugs, 1 Rule 3 blocking issue). **Impact:** All fixes were directly required for strict Android equivalence and introduced no new dependency, endpoint, storage, UI, or architectural surface.

## Known Stubs

None found in the files created or modified by this plan.

## Threat Surface Review

No new network endpoint, auth path, file-access path, or schema trust boundary was introduced. The reducer and replay checks strengthen the existing canonical-to-Kotlin and async completion boundaries defined by T-11-09-01 through T-11-09-04.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Android is ready for downstream cache, gallery, and preview work to consume the same conversation-owned, request-sequenced shared-content contract. The Android verification gates are runnable and green in this checkout.

---
*Phase: 11-shared-content-contract-and-privacy-boundary*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- RED commit `e974933b`, GREEN commit `934f1217`, and follow-up fix `011d2b89` exist in git history.
- Both planned source/test files exist and no generated artifacts or tracked deletions were introduced.
