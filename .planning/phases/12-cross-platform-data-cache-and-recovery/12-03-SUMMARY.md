---
phase: 12-cross-platform-data-cache-and-recovery
plan: 03
subsystem: testing
tags: [android, kotlin, junit, recovery, identity, privacy, cache]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: deterministic shared-content ownership, paging, tombstone, and identity-purge semantics
provides:
  - Android RED contracts for bounded signed-delivery leasing and secret non-persistence
  - Android RED contracts for displayed-only thumbnail persistence, pruning, containment, and owner purge
  - Android RED contracts for coalesced recovery, Data Saver behavior, retry bounds, and provider-neutral state
  - Android RED contracts for purge-before-bind identity transitions and stale callback rejection
affects: [12-05, 12-09, 12-10, 12-14, 12-16]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-neutral Kotlin contract fakes, deterministic clocks and filesystem probes, production-symbol RED guards]

key-files:
  created:
    - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentDeliveryRegistryTest.kt
    - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStoreTest.kt
    - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStoreTest.kt
    - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinatorTest.kt
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentitySecurityTest.kt
  modified: []

key-decisions:
  - "Keep all five suites provider-neutral and intentionally RED behind absent production-symbol guards; implementation belongs to Plans 12-09, 12-10, and 12-14."
  - "Use opaque item keys and safe zero-count sentinel assertions so delivery values, owner IDs, paths, and content bytes cannot enter durable or diagnostic evidence."
  - "Make identity teardown observable as an exact revoke, hide, cancel, clear, purge, verify, bind, and publish order."

patterns-established:
  - "Delivery tests use deterministic 15-minute leases with a 120-second freshness margin, <=50 request batches, and one 401/403 refresh."
  - "Recovery tests model one coalesced cycle with attempts 0/1, connectivity cancellation, Data Saver lookahead suppression, and a single manual retry."

requirements-completed: [PRIV-02, PRIV-03, PAGE-03, OFF-02]

# Metrics
duration: 11min
completed: 2026-07-23
---

# Phase 12 Plan 03: Android delivery, recovery, and identity RED contracts Summary

**Five deterministic Android test suites now pin delivery privacy, displayed-only thumbnails, bounded recovery, and purge-before-bind identity security before their production services are implemented.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-23T11:24:33Z
- **Completed:** 2026-07-23T11:35:32Z
- **Tasks:** 2 completed
- **Files modified:** 5 created

## Accomplishments

- Added delivery-registry tests covering 1/49/50/51-ID batching, duplicate removal, 120-second lease freshness, opaque identity, one authorization refresh, and secret-sentinel scans.
- Added thumbnail-store tests covering lookahead memory-only behavior, displayed confirmation, selected full-content non-persistence, atomic failure cleanup, containment, backup exclusion, 64 MiB/30-day pruning, and owner purge.
- Added recovery and identity adversary tests covering trigger coalescing, attempts 0/1, Data Saver, stale cached presentation, A→B/signed-out/unresolved transitions, stale callbacks, restart/purge failure, and safe zero-count scans.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold delivery and displayed-thumbnail security tests** - `fa2ec552` (test)
2. **Task 2: Scaffold recovery and purge-before-bind adversary tests** - `9d6bb871` (test)

## Files Created/Modified

- `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentDeliveryRegistryTest.kt` - Delivery lease freshness, batching, auth refresh, opaque keys, and non-persistence contract.
- `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStoreTest.kt` - Displayed-only thumbnail filesystem and pruning contract.
- `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStoreTest.kt` - Recovery-cycle, Data Saver, retry, and presentation-state contract.
- `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinatorTest.kt` - Unit identity transition and purge-order contract.
- `apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentitySecurityTest.kt` - Instrumented identity adversary and durable-secret scan contract.

## Verification

- `:data:chat:testDebugUnitTest --tests '*SharedContentDeliveryRegistryTest' --tests '*SharedContentThumbnailStoreTest'`: RED with 11 tests completed and only the two absent Plan 12-09 production guards failing.
- `:feature:chat:testDebugUnitTest --tests '*SharedContentStoreTest'`: RED with 6 tests completed and only the absent Plan 12-10 production guard failing.
- `:data:chat:testDebugUnitTest --tests '*SharedContentIdentityCoordinatorTest'`: RED with 6 tests completed and only the absent Plan 12-14 production guard failing.
- `:data:chat:compileDebugAndroidTestKotlin`: passed; no emulator/device was available for a connected instrumented run.
- All five target files exist, and only test files changed in the two task commits.

## TDD Gate Compliance

RED gates are satisfied by `fa2ec552` and `9d6bb871`. GREEN implementation commits are intentionally absent because this Wave 0 plan creates only failing tests; the corresponding production services are explicitly deferred to Plans 12-09, 12-10, and 12-14.

## Decisions Made

- Followed the existing Phase 12 provider-neutral fake/production-symbol guard pattern so the suites compile and fail only on missing production contracts.
- Kept instrumented identity coverage free of provider, route, UI, or sign-in-blocking dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected test fixture filesystem sizing API**
- **Found during:** Task 1 (thumbnail security tests)
- **Issue:** `java.io.File` does not expose `setLength`, preventing the unit suite from compiling.
- **Fix:** Used `RandomAccessFile.setLength` for sparse deterministic cache fixtures.
- **Files modified:** `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStoreTest.kt`
- **Verification:** Focused data unit suite compiled and reached the intended two RED guards.
- **Committed in:** `fa2ec552`

**2. [Rule 3 - Blocking] Added the missing recovery fake limit property**
- **Found during:** Task 2 (recovery store tests)
- **Issue:** The test asserted the one automatic-attempt limit without exposing that deterministic fake value.
- **Fix:** Added `automaticAttemptLimit = 1` to the private recovery contract.
- **Files modified:** `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStoreTest.kt`
- **Verification:** Focused feature unit suite compiled and reached only the intended missing-store RED guard.
- **Committed in:** `9d6bb871`

**3. [Rule 1 - Bug] Corrected contract fixtures that were asserting the wrong test behavior**
- **Found during:** Task 1 and Task 2 focused verification
- **Issue:** The 51-ID case supplied only 50 unique IDs, the sentinel mock wrote delivery bytes durably, and a purge test confirmed an unstaged thumbnail.
- **Fix:** Added the true 51-ID duplicate case, kept delivery sentinel values live-only, staged thumbnail bytes before confirmation, and corrected cycle-count expectations.
- **Files modified:** `SharedContentDeliveryRegistryTest.kt`, `SharedContentThumbnailStoreTest.kt`, `SharedContentStoreTest.kt`
- **Verification:** All non-guard contract assertions pass; only absent production symbols fail.
- **Committed in:** `fa2ec552`, `9d6bb871`

---

**Total deviations:** 3 auto-fixed (2 blocking test compilation fixes, 1 test-fixture bug correction)
**Impact on plan:** Fixes were limited to making the planned RED suites compile and accurately express the specified contracts; no production scope was added.

## Issues Encountered

- No emulator/device was attached, so `SharedContentIdentitySecurityTest` was compile-verified rather than executed on-device.
- Unrelated untracked `.planning/research/.cache` files were preserved as required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Android Wave 0 evidence is ready for Plan 12-05’s portable contract and the later Android delivery, recovery, and identity implementations. The four intentional RED production guards should turn green only when those corresponding services are implemented.

## Self-Check: PASSED

- Summary file exists at the planned path.
- Task commits `fa2ec552` and `9d6bb871` exist in git history.
- All five planned Android test files exist.
- Stub scan found no placeholder or incomplete implementation patterns in the created test files.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*
