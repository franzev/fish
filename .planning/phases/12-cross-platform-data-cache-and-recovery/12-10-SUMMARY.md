---
phase: 12-cross-platform-data-cache-and-recovery
plan: 10
subsystem: android-shared-content
tags: [android, recovery, cache-truth, visibility, data-saver, provider-neutral]

# Dependency graph
requires:
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Android authorized shared-content repository, cache reconciliation, validated network policy, delivery leases, and displayed-thumbnail promotion
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: provider-neutral shared-content ordering, ownership, request sequencing, and tombstone semantics
provides:
  - Android provider-neutral recovery store with coalesced lifecycle triggers and one automatic retry
  - Presentation contract for cached, stale, incomplete, unavailable, authoritative-empty, and identity-ineligible truth
  - Typed visible/lookahead/selected delivery batching with Data Saver lookahead suppression
affects: [12-13, 12-14, phase-13-shared-content-gallery]

# Tech tracking
tech-stack:
  added: []
  patterns: [injected coroutine recovery policy, generation-and-cycle-bound requests, closed presentation vocabulary, typed visibility port]

key-files:
  created:
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt
  modified:
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt
    - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStoreTest.kt
    - .planning/phases/12-cross-platform-data-cache-and-recovery/deferred-items.md

key-decisions:
  - "Keep recovery in the feature layer behind ChatRepository and provider-neutral visibility ports; ChatData owns the explicit Room cache dependency and existing delivery authority."
  - "Use a trailing 500ms coalescing window, five-minute meaningful foreground threshold, and exactly attempts 0 and 1 with a one-second injected-jitter delay."
  - "Expose only the existing closed presentation keys and retain cached item identity through refresh and failure; displayed-thumbnail promotion remains reachable only through confirmThumbnailDisplayed."

patterns-established:
  - "Lifecycle, reconnect, and realtime triggers share one owner/conversation/generation-bound cycle; manual retry starts a genuinely new cycle."
  - "Visibility is planned through SharedContentDeliveryBatch and submitted through an injected port; every batch is deduplicated and capped at 50 IDs."

requirements-completed: [PRIV-03, PAGE-03, OFF-01, OFF-02]

# Metrics
duration: 12min
completed: 2026-07-23
---

# Phase 12 Plan 10: Android recovery and presentation orchestration Summary

**Android now has a provider-neutral shared-content recovery store that coalesces lifecycle work, preserves truthful offline cache state, bounds delivery visibility, and exposes a single calm retry contract without adding a gallery surface.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-23T22:52:00+08:00
- **Completed:** 2026-07-23T23:05:00+08:00
- **Tasks:** 1 completed
- **Files modified:** 4 implementation/test/planning files

## Accomplishments

- Added `SharedContentStore` with bind/open/foreground/reconnect/realtime/connectivity/visibility/display-confirm/retry/close orchestration, injected clock/jitter/scope/dispatcher, generation-bound repository tokens, and no background retry loop.
- Implemented the 500ms trailing trigger window, five-minute meaningful foreground gate, one automatic retry at 1,000ms plus bounded jitter, cancellation when connectivity becomes unusable, and manual retry only after the second failure.
- Derived provider-neutral presentation state with cache preservation, stale plus incomplete truth, offline-no-cache versus authoritative-empty distinction, identity-ineligible hiding, and typed ≤50 visible/lookahead/selected delivery batches.
- Replaced the production-symbol RED guard with focused recovery/visibility tests and explicitly wired `RoomSharedContentCacheStore` in `ChatDataModule`.

## Task Commits

Each TDD task was committed atomically:

1. **Task 1 RED: Add Android recovery store contract tests** - `2502daee` (`test`)
2. **Task 1 GREEN: Implement Android recovery and presentation orchestration** - `b14abc16` (`feat`)
3. **Task 1 hardening: Route visibility through the repository delivery port** - `1969dc9d` (`fix`)

## Files Created/Modified

- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt` - Provider-neutral recovery state machine, presentation flow, visibility planning/submission, and explicit display-confirmation boundary.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt` - Explicitly constructs and injects the Room shared-content cache store into the repository.
- `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStoreTest.kt` - TDD coverage for coalescing, retry/cancellation, cache truth, identity eligibility, authoritative empty, and Data Saver batching.
- `.planning/phases/12-cross-platform-data-cache-and-recovery/deferred-items.md` - Records pre-existing feature fake and connected-device verification limitations.

## Verification

- `scripts/android-gradle.sh :feature:chat:compileDebugKotlin :data:chat:compileDebugKotlin` — PASS.
- `scripts/android-gradle.sh :data:chat:testDebugUnitTest --tests '*SharedContent*'` — 20 tests completed; the sole failure is the pre-existing intentional Plan 12-14 `SharedContentIdentityCoordinator` RED guard.
- `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentStoreTest'` — the new test source compiles, but execution is blocked by pre-existing `ChatViewModelTest` and `MessageSearchViewModelTest` fakes missing Plan 12-08 shared-content methods; those unrelated files were not changed.
- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm build` — PASS.
- `git diff --check` and prohibited-scope/privacy scan — PASS; no route, screen, navigation, settings, string, Supabase, URL/path, WorkManager, or gallery changes.
- Connected Android instrumentation — not run because no emulator or device is attached; production compilation completed.

## TDD Gate Compliance

- RED gate: `2502daee` added failing behavior tests before the store existed.
- GREEN gate: `b14abc16` implemented the store and explicit cache wiring.
- Hardening: `1969dc9d` routed default repository delivery through the existing provider-neutral port without widening the presentation surface.

## Decisions Made

- Kept the store provider-free and injected delivery/display ports so Plan 13 can compose native presentation later without moving URLs, paths, provider errors, cache limits, or retry counters into the presentation contract.
- Kept identity generation and cycle/request tokens on every refresh attempt; repository acceptance remains authoritative and cached rows never authorize access.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] Routed default repository visibility through the existing delivery seam**

- **Found during:** Task 1 GREEN review
- **Issue:** A no-op default visibility port would have made the production store plan intents but not invoke the existing repository delivery authority.
- **Fix:** Added a provider-neutral delivery method to the recovery repository port and mapped the `ChatRepository` adapter to `refreshAttachmentUrls`; displayed-thumbnail persistence remains behind explicit confirmation only.
- **Files modified:** `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt`
- **Verification:** Android feature production compilation passed; visibility tests retain injected fake submission assertions.
- **Committed in:** `1969dc9d`

**Total deviations:** 1 auto-fixed (Rule 1). **Impact:** Correctness hardening stayed within the planned store/port boundary and did not add a UI or provider surface.

## Issues Encountered

- The feature unit test task cannot execute because two pre-existing repository fakes outside this plan omit the methods introduced by Plan 12-08. The new store tests themselves compile; the issue is recorded in `deferred-items.md` for the owning test maintenance work.
- No connected Android device/emulator was available for instrumentation. This is a verification limitation only; no device setup or background service was added.

## Known Stubs

- `NoOpSharedContentVisibilityPort` is an explicit test/configuration adapter. Production `SharedContentStore` defaults delivery submission to the repository-backed port; displayed-thumbnail persistence is intentionally available only through the explicit `confirmThumbnailDisplayed` port until later native presentation composition.

## Authentication Gates

None.

## Threat Flags

None. No endpoint, auth path, schema migration, filesystem path, or user-facing route was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Android recovery and presentation state are ready for the paired iOS orchestration and later gallery composition. Plan 12-14 still owns full identity purge-before-bind enforcement, and the pre-existing feature test fake updates remain deferred.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*

## Self-Check: PASSED

- Summary file exists at the required phase path.
- TDD RED/GREEN/hardening commits `2502daee`, `b14abc16`, and `1969dc9d` exist in git history.
- All planned Android production/test files exist.
- Plan commits contain no changes to `.planning/research/.cache/*.json`.
