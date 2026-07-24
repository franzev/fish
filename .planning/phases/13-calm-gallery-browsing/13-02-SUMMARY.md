---
phase: 13-calm-gallery-browsing
plan: "02"
subsystem: android-shared-content-contracts
tags: [android, compose, room, screenshot, accessibility, tdd]
dependency-graph:
  requires:
    - phase: 12-offline-shared-content-cache-delivery
      provides: Android shared-content store, strict repository rows, Room cache, and identity lifecycle
    - plan: 13-01
      provides: Portable gallery projection and nullable-duration RED oracle
  provides:
    - Android gallery presenter and global earlier-paging RED contract
    - Room 9-to-10 nullable-duration migration and strict 29-field repository RED contract
    - Origin-preserving Compose navigation, focus, lifecycle, and screenshot RED contract
  affects:
    - 13-05
    - 13-07
    - 13-09
    - 13-11
tech-stack:
  added: []
  patterns:
    - Provider-neutral in-test contract harnesses paired with named missing-production-symbol guards
    - Explicit route-origin state with deterministic Back and focus restoration assertions
    - Screenshot-first state matrices with normal and accessibility media geometry
key-files:
  created:
    - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryPresenterTest.kt
    - apps/android/feature/chat/src/androidTest/kotlin/space/fishhub/android/feature/chat/SharedContentNavigationTest.kt
  modified:
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/local/ChatDatabaseMigrationTest.kt
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentRepositoryTest.kt
    - apps/android/feature/chat/src/screenshotTest/kotlin/space/fishhub/android/feature/chat/ChatScreenshotTest.kt
    - .gitignore
key-decisions:
  - "Use deterministic provider-neutral test harnesses for executable behavior, then keep one explicit production-symbol guard RED until the Phase 13 presenter, origin, and screen exist."
  - "Keep all Wave 0 screenshot items non-actionable and leave only the 12 new Shared content references absent, preserving Phase 14 selection scope."
patterns-established:
  - "Android Wave 0 suites isolate intentional RED failures from behavioral, emulator, compilation, and existing-screenshot failures."
  - "Back-stack tests carry an explicit Header or Details origin and verify restoration only after the destination is composed."
requirements-completed: [DISC-01, DISC-02]
duration: 21 min
completed: 2026-07-24
---

# Phase 13 Plan 02: Android Calm Gallery RED Contracts Summary

**Android now has executable RED contracts for provider-neutral gallery projection, strict nullable duration storage, origin-preserving navigation, lifecycle safety, accessibility, and a 12-state visual matrix.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-24T01:39:09Z
- **Completed:** 2026-07-24T02:00:27Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Defined canonical populated-category projection, retained/fallback selection, per-category anchors, accepted realtime mutations, global earlier paging, duplicate suppression, honest Phase 12 states, and identity-revocation behavior.
- Required an exact 29-field repository row with nullable non-negative `duration_ms`, legacy-null compatibility, Room database version 10, and a preserving 9-to-10 migration without cached authority fields.
- Exercised header and participant-details entry origins through visible and system Back, including 48dp targets, non-modal full-screen presentation, exactly-once opening, focus restoration, and fail-closed stale/cross-conversation callbacks.
- Added 12 Shared content screenshot references spanning light/dark, RTL, large text, one/four categories, all supported item kinds, loading, cached, stale, authoritative empty, offline unavailable, and earlier-page busy/failure states with 88dp and 120dp media geometry.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define Android presenter, strict duration, and Room 9→10 RED behavior** - `d02ef798` (test)
2. **Task 2: Define Android origin navigation, accessibility, focus, and screenshot RED behavior** - `f25c5017` (test)
3. **Generated-state cleanup: Ignore Android Kotlin compiler sessions** - `4f255fb9` (chore)

## Files Created/Modified

- `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryPresenterTest.kt` - Provider-neutral gallery session, mutation, paging, and identity RED contract.
- `apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/local/ChatDatabaseMigrationTest.kt` - Room version 10 and preserving 9-to-10 nullable-duration RED checks.
- `apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentRepositoryTest.kt` - Strict 29-field duration and legacy fallback RED checks.
- `apps/android/feature/chat/src/androidTest/kotlin/space/fishhub/android/feature/chat/SharedContentNavigationTest.kt` - Origin, Back, focus, accessibility, lifecycle, and production-symbol RED checks.
- `apps/android/feature/chat/src/screenshotTest/kotlin/space/fishhub/android/feature/chat/ChatScreenshotTest.kt` - Shared content visual-state and item-kind matrix.
- `.gitignore` - Excludes generated Android `.kotlin` compiler session state.

## Decisions Made

- Paired executable local contract models with a single named missing-symbol assertion per surface so behavioral regressions fail independently while production remains intentionally absent.
- Kept the details identity target separate from the exact `Shared content` action and retained a single quiet action contract in each origin.
- Used screenshot-only, non-clickable items and structure-matched loading geometry so Wave 0 defines presentation without entering Phase 14 selection behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Started the configured Android emulator for connected RED verification**

- **Found during:** Task 1
- **Issue:** The connected repository and migration suite initially had no available device, preventing the planned assertion audit.
- **Fix:** Started the existing `Pixel_10_Pro_XL` AVD and reran both connected suites, then kept it available for the navigation contract.
- **Files modified:** None
- **Commit:** N/A

**2. [Rule 3 - Blocking] Ignored generated Kotlin compiler session state**

- **Found during:** Task 2 verification
- **Issue:** Android compilation created an untracked `.kotlin/sessions/*.salive` runtime marker.
- **Fix:** Added `.kotlin/` to the repository ignore rules so compiler sessions cannot pollute subsequent task commits.
- **Files modified:** `.gitignore`
- **Commit:** `4f255fb9`

## Known Stubs

- `SharedContentGalleryPresenterTest.kt` contains a provider-neutral in-test session model because the production presenter and accepted-item/earlier-page seams intentionally do not exist until later Phase 13 plans.
- `SharedContentNavigationTest.kt` contains a test-only route contract because `SharedContentOrigin` and `SharedContentGalleryScreen` intentionally remain absent.
- `ChatScreenshotTest.kt` uses a non-actionable test-only visual contract and intentionally has no production data source; Plans 13-05, 13-07, 13-09, and 13-11 will replace these RED seams and record the reference images.

## Verification

- Presenter suite: 7 behavioral tests pass; the sole expected RED failure names `SharedContentGalleryPresenter`, `SharedContentStore.loadEarlier`, and `SharedContentStore.acceptedItems`.
- Repository/migration connected suite: 22 tests pass; the three expected RED failures name Room version/migration 10 and the missing wire/provider duration fields.
- Navigation connected suite: 3 behavioral tests pass; the sole expected RED failure names `SharedContentOrigin` and `SharedContentGalleryScreen`.
- Screenshot validation: all 34 existing references pass; exactly 12 new Shared content references are missing.
- Web module-boundary suite: 10/10 passing with zero loose component implementations and zero component folders missing an index.
- `pnpm build`: passing before each task/cleanup commit.
- `git diff --check`: passing for all plan-owned Kotlin changes.

## Next Phase Readiness

- Plans 13-05 and 13-07 can implement the Android duration/cache and provider-neutral session seams directly against named RED failures.
- Plans 13-09 and 13-11 can compose the production route and visual surface against the fixed origin, focus, lifecycle, state, and screenshot matrix.
- No dependency, provider API, message-send input, upload input, search, filter, count, menu, preview, autoplay, export, deletion, global gallery, dashboard, or web surface was introduced.

## Self-Check: PASSED

- All five plan-owned Android test artifacts exist.
- Task commits `d02ef798`, `f25c5017`, and cleanup commit `4f255fb9` exist in git history.
- Every RED failure is a named absent Phase 13 contract; behavioral checks, existing screenshots, module boundaries, and production build pass.
