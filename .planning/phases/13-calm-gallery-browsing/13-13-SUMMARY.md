---
phase: 13-calm-gallery-browsing
plan: 13
subsystem: testing
tags: [android, ios, supabase, accessibility, snapshots, privacy, nyquist]

requires:
  - phase: 13-calm-gallery-browsing
    provides: Plans 01-12 gallery implementation and platform test coverage
provides:
  - Reproducible cross-platform gallery validation gate
  - Production entry-point and focus-lifecycle proof
  - Final Nyquist evidence for DISC-01 and DISC-02
affects: [phase-15-release-readiness]

tech-stack:
  added: []
  patterns:
    - Production surface render tests for navigation reachability
    - Modal focus request after SheetState reaches Expanded
    - Provider-neutral gallery privacy scan boundary

key-files:
  created:
    - .planning/phases/13-calm-gallery-browsing/13-13-SUMMARY.md
  modified:
    - .planning/phases/13-calm-gallery-browsing/13-VALIDATION.md
    - apps/android/data/chat/src/androidTest/kotlin/com/fish/data/chat/DefaultChatRepositoryTest.kt
    - apps/android/feature/chat/src/androidTest/kotlin/com/fish/feature/chat/ChatAccessibilityTest.kt
    - apps/android/feature/chat/src/androidTest/kotlin/com/fish/feature/chat/SharedContentNavigationTest.kt
    - apps/android/feature/chat/src/main/kotlin/com/fish/feature/chat/ChatComponents.kt
    - apps/android/feature/chat/src/main/kotlin/com/fish/feature/chat/ChatRoute.kt
    - apps/android/feature/chat/src/main/kotlin/com/fish/feature/chat/ChatScreen.kt
    - apps/android/feature/chat/src/main/kotlin/com/fish/feature/chat/ParticipantDetailsSheet.kt
    - apps/ios/Fish/Features/Chat/PersonalChatScreen.swift
    - apps/ios/Fish/Features/Chat/ConversationDetailsSheet.swift
    - apps/ios/Fish/Features/Chat/PersonalChatTopBar.swift
    - apps/ios/FishTests/SharedContentNavigationTests.swift

key-decisions:
  - Production-entry evidence must render the real controls rather than a faithful test harness
  - Gallery privacy scans exclude legacy direct-message attachment internals while broad-scan matches remain documented
  - Modal focus is requested only after the Android sheet reaches Expanded

requirements-completed: [DISC-01, DISC-02]

metrics:
  duration: 49m
  completed: 2026-07-24
---

# Phase 13 Plan 13: Cross-Platform Gallery Validation Summary

Reproducible Supabase, Android, and iOS gallery validation with production entry-point rendering, lifecycle-safe modal focus, exact payload coverage, and provider-neutral privacy evidence.

## Performance

- **Started:** 2026-07-24T05:25:07Z
- **Completed:** 2026-07-24T06:14:00Z
- **Duration:** 49 minutes
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Proved the exact backend and native gallery matrix across nullable values, trusted and untrusted metadata, negative duration handling, permissions, paging, media types, and send/upload privacy.
- Replaced harness-only navigation evidence with tests that render and activate the real Android and iOS production entry controls.
- Fixed Android modal focus timing so the details heading receives focus only after the Material sheet is expanded, while preserving return focus and exactly-once lifecycle behavior.
- Completed dependency drift, deferred-action, privacy, accessibility, snapshot, build, and full-suite audits and marked the Phase 13 Nyquist gate approved.

## Task Commits

Each task was committed atomically:

1. **Task 1: Execute the exact cross-platform validation matrix** - `6cbd87ce` (`test`)
2. **Task 2: Prove production reachability and close final evidence gaps** - `7ca776a9` (`fix`)

## Files Created/Modified

- `.planning/phases/13-calm-gallery-browsing/13-VALIDATION.md` - Records the exact commands, evidence, audit boundaries, and final approved Nyquist status.
- `apps/android/data/chat/src/androidTest/kotlin/com/fish/data/chat/DefaultChatRepositoryTest.kt` - Makes validation fixtures deterministic and covers the full repository matrix.
- `apps/android/feature/chat/src/androidTest/kotlin/com/fish/feature/chat/ChatAccessibilityTest.kt` - Corrects production-semantics accessibility assertions.
- `apps/android/feature/chat/src/androidTest/kotlin/com/fish/feature/chat/SharedContentNavigationTest.kt` - Renders real production entry surfaces and proves navigation, focus, and lifecycle behavior.
- `apps/android/feature/chat/src/main/kotlin/com/fish/feature/chat/ChatComponents.kt` - Exposes stable semantics for the production header entry.
- `apps/android/feature/chat/src/main/kotlin/com/fish/feature/chat/ChatRoute.kt` - Threads details-focus state through the route lifecycle.
- `apps/android/feature/chat/src/main/kotlin/com/fish/feature/chat/ChatScreen.kt` - Connects production focus state to the participant details sheet.
- `apps/android/feature/chat/src/main/kotlin/com/fish/feature/chat/ParticipantDetailsSheet.kt` - Requests heading focus after expansion and exposes explicit conversation-details semantics.
- `apps/ios/Fish/Features/Chat/PersonalChatScreen.swift` - Applies the production header entry accessibility identity.
- `apps/ios/Fish/Features/Chat/ConversationDetailsSheet.swift` - Applies the production details entry accessibility identity.
- `apps/ios/Fish/Features/Chat/PersonalChatTopBar.swift` - Defines distinct shared-content production entry identities.
- `apps/ios/FishTests/SharedContentNavigationTests.swift` - Renders production SwiftUI surfaces and validates activation, return, focus, and identity.

## Decisions Made

- Production-entry evidence renders real production controls; a structurally faithful test-only harness is insufficient proof of reachability.
- The gallery privacy boundary excludes pre-existing direct-message attachment internals, while the broad scan and blame evidence are retained in validation notes rather than silently ignored.
- Android modal focus is synchronized to `SheetState.Expanded` before requesting focus, avoiding races against composition of the modal subtree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected deterministic Android validation harness defects**
- **Found during:** Task 1
- **Issue:** Test-only expiry dates had become stale, manual-retry content entered the outbox path, and an ambiguous Compose matcher selected the wrong semantics node.
- **Fix:** Moved test expiries to a stable future date, used non-outbox retry content, corrected the matcher, and modeled copy-sheet dismissal with one Compose root.
- **Files modified:** Android repository and accessibility instrumentation tests.
- **Commit:** `6cbd87ce`

**2. [Rule 2 - Missing Critical Functionality] Added production reachability and lifecycle-safe modal focus**
- **Found during:** Task 2
- **Issue:** Existing navigation tests exercised a harness rather than real entry controls, and Android requested heading focus before the Material sheet subtree existed.
- **Fix:** Rendered actual production entry surfaces on both native platforms, assigned distinct accessible identities, and deferred Android focus until the sheet reports `Expanded`.
- **Files modified:** Android chat production/test files and iOS chat production/test files.
- **Commit:** `7ca776a9`

**3. [Rule 3 - Blocking Issue] Resolved an over-broad privacy locator without hiding matches**
- **Found during:** Task 2
- **Issue:** The plan-wide iOS locator matched legacy direct-message `storagePath` internals outside the gallery boundary, which would have produced a false failure.
- **Fix:** Used history evidence to classify the pre-existing matches, recorded them in validation notes, and ran the provider-neutral scan against the actual gallery production boundary.
- **Files modified:** `.planning/phases/13-calm-gallery-browsing/13-VALIDATION.md`
- **Commit:** `7ca776a9`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical functionality, 1 blocking issue)
**Impact on plan:** All fixes were necessary to make the prescribed evidence deterministic and production-representative. No feature scope was added.

## Issues Encountered

- No Android emulator was initially available, so the repository's Pixel 10 Pro XL AVD was booted before connected validation.
- A concurrent full iOS run restarted its test process while Android instrumentation was under load. Replacing window-host rendering with `ImageRenderer` and rerunning the full iOS suite in isolation produced a clean pass.

## User Setup Required

None. Validation used local Supabase and repository-owned native toolchains.

## Known Stubs

None. Default no-op callback seams and nullable test fixtures found by the scan are intentional APIs or test data, not rendered placeholders or unwired product behavior.

## Next Phase Readiness

- Phase 13 automated gallery validation is complete and reproducible.
- Phase 15 retains physical-device and human release-readiness checks; this plan does not claim unperformed manual approval.

## Self-Check: PASSED

- Summary file exists.
- Task commits `6cbd87ce` and `7ca776a9` exist in repository history.
- All key files listed above exist.
