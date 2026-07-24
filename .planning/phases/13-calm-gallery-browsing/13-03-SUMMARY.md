---
phase: 13-calm-gallery-browsing
plan: "03"
subsystem: ios-shared-content-contracts
tags: [ios, swift-testing, core-data, navigationstack, accessibility, tdd]
dependency-graph:
  requires:
    - phase: 12-cross-platform-data-cache-and-recovery
      provides: iOS shared-content store, strict repository rows, Core Data cache, and identity lifecycle
    - plan: 13-01
      provides: Portable gallery projection and nullable-duration RED oracle
    - plan: 13-02
      provides: Android navigation, presentation, and visual parity oracle
  provides:
    - iOS gallery model and global earlier-paging RED contract
    - Strict 29-field nullable-duration repository and Core Data compatibility RED contract
    - Origin-preserving NavigationStack, focus, lifecycle, semantics, and visual-matrix RED contract
  affects:
    - 13-06
    - 13-08
    - 13-10
    - 13-12
tech-stack:
  added: []
  patterns:
    - Provider-neutral in-test contract harnesses paired with named missing-production-symbol guards
    - Explicit route-origin state with deterministic system Back and focus-restoration assertions
    - Semantic visual matrices covering SwiftUI-native state, geometry, accessibility, and scope
key-files:
  created:
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGalleryModelTests.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentNavigationTests.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGallerySnapshotTests.swift
  modified:
    - apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift
    - apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift
key-decisions:
  - "Use deterministic provider-neutral test harnesses for executable behavior, with one named RED guard per absent Phase 13 iOS production seam."
  - "Treat legacy missing duration as nil, never zero, while rejecting negative duration before repository acceptance or Core Data save."
  - "Keep Wave 0 gallery items non-actionable and test the approved visual matrix semantically until the production SharedContentGalleryScreen exists."
patterns-established:
  - "iOS Wave 0 suites isolate intentional production-seam RED failures from model, persistence, navigation, accessibility, and visual-contract behavior."
  - "Navigation state carries an explicit header or details origin and restores the correct focus target after the destination is removed."
requirements-completed: [DISC-01, DISC-02]
duration: 12 min
completed: 2026-07-24
---

# Phase 13 Plan 03: iOS Calm Gallery RED Contracts Summary

**iOS now has executable RED contracts for provider-neutral gallery projection, strict nullable duration storage, origin-preserving NavigationStack behavior, identity safety, accessibility, and the complete calm visual matrix.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-24T02:08:44Z
- **Completed:** 2026-07-24T02:20:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Defined canonical populated-category projection, first/retained/fallback selection, hidden one-option controls, per-category anchors, accepted realtime mutations, global earlier paging, duplicate suppression, and identity-revocation behavior.
- Required an exact 29-field repository row with nullable non-negative `duration_ms`, strict missing/extra/negative rejection, legacy nil compatibility, trusted Core Data round trips, and no persisted delivery authority fields.
- Exercised header and participant-details entry origins through visible and system Back, including 44pt targets, distinct accessible names, exactly-once opening, focus restoration, session-only state, pop close, and fail-closed owner changes.
- Locked a 12-scenario visual matrix spanning light/dark, RTL, accessibility Dynamic Type, one/four categories, all seven supported item kinds, loading, cached, stale, authoritative empty, offline unavailable, and earlier-page busy/failure states.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define iOS model, strict duration, Core Data legacy, and lifecycle RED behavior** - `b96ebc57` (test)
2. **Task 2: Define iOS two-origin navigation, focus, semantics, and snapshot RED behavior** - `74be75d5` (test)

## Files Created/Modified

- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGalleryModelTests.swift` - Provider-neutral gallery session, mutation, paging, and identity RED contract.
- `apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift` - Strict 29-field duration, request/cursor ownership, and private-boundary RED checks.
- `apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift` - Legacy nil duration, trusted round-trip, negative rejection, and no-authority persistence RED checks.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentNavigationTests.swift` - Explicit origin, Back, focus, semantics, lifecycle, and production-symbol RED checks.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGallerySnapshotTests.swift` - SwiftUI-native visual-state, category, item-kind, geometry, RTL, Dynamic Type, and reduced-motion contract.

## Decisions Made

- Paired executable local contract models with a single named missing-symbol assertion per production surface so behavioral regressions remain independently diagnosable.
- Preserved nil duration for legacy cache rows and asserted non-negative validation at both delivery and persistence boundaries.
- Kept participant details separate from the exact `Shared content` action and retained explicit route origins for deterministic return paths and focus restoration.
- Kept item presentation non-selectable and free of menus, preview, autoplay, export, deletion, search, filters, badges, dashboards, or other out-of-scope product surfaces.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `SharedContentGalleryModelTests.swift` contains a provider-neutral in-test gallery model because the production `SharedContentGalleryModel` is intentionally deferred to Plan 13-06.
- `SharedContentNavigationTests.swift` contains a test-only origin-bearing navigation host because the production destinations and details-sheet composition are intentionally deferred to Plan 13-08.
- `SharedContentGallerySnapshotTests.swift` contains a semantic visual harness because the production `SharedContentGalleryScreen` and recorded UI snapshots are intentionally deferred to Plan 13-10.

## Verification

- Model/repository/cache suite: 32 behavioral checks pass; exactly three named RED guards fail for the absent iOS gallery model, strict duration delivery seam, and nullable Core Data persistence seam.
- Navigation/visual suite: 15 behavioral checks pass; exactly two named RED guards fail for the absent origin-bearing NavigationStack composition and production gallery screen.
- Both focused `xcodebuild test` commands compile and exit 65 solely because of the five intentional named Phase 13 RED guards.
- `pnpm build`: passing before both task commits.
- `git diff --check`: passing for all five plan-owned Swift test files.

## Next Phase Readiness

- Plan 13-06 can implement the nullable-duration cache/repository seam and provider-neutral gallery model directly against the named RED contracts.
- Plans 13-08 and 13-10 can compose the production navigation and screen against fixed origin, focus, lifecycle, state, accessibility, geometry, and visual-matrix behavior.
- Plan 13-12 can verify complete iOS parity without introducing new gallery choices or expanding the native mobile product beyond direct-chat support.

## Self-Check: PASSED

- All five plan-owned iOS test artifacts and this summary exist.
- Task commits `b96ebc57` and `74be75d5` exist in git history.
- Every RED failure is a named absent Phase 13 production contract; behavioral checks and the production build pass.
