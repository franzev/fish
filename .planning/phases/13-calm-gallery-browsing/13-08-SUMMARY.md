---
phase: 13-calm-gallery-browsing
plan: "08"
subsystem: ios-shared-content-gallery
tags: [swift, observation, shared-content, paging, privacy]

requires:
  - phase: 13-03
    provides: Executable gallery contracts and RED acceptance guards
  - phase: 13-06
    provides: iOS repository, recovery, persistence, delivery, and presentation foundations
provides:
  - Safe accepted-item projection and global earlier-page state in the iOS store
  - Weakly attached live-store identity revocation
  - Provider-neutral MainActor gallery session, category, anchor, and formatting model
affects: [13-10, 13-12, 13-13]

tech-stack:
  added: []
  patterns:
    - Exact owner, conversation, generation, request, and cursor acceptance fencing
    - Allowlisted presentation values without provider delivery authority
    - Memory-only per-category anchors with deterministic fallback

key-files:
  created:
    - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentGalleryModel.swift
  modified:
    - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentStore.swift
    - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentIdentityCoordinator.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentIdentityCoordinatorTests.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGalleryModelTests.swift

key-decisions:
  - "Accepted iOS items expose only allowlisted display metadata; owner, sender, dates, raw URLs, storage paths, and delivery authority remain outside the presentation boundary."
  - "Earlier paging is one global single-flight append stream, accepted only for the exact identity generation and requested cursor while visible content survives failure."
  - "Gallery category selection and anchors are route-memory state, and item selection remains disabled unless a caller explicitly supplies a selection callback."

patterns-established:
  - "Safe projection: map stored records into closed presentation enums before UI code can observe them."
  - "Generation fencing: revoke route state synchronously before asynchronous account-transition work."

requirements-completed: [DISC-02]

duration: 12min
completed: 2026-07-24
---

# Phase 13 Plan 08: iOS Gallery Store and Model Summary

**A provider-neutral iOS gallery model backed by safe accepted items, generation-fenced global paging, localized metadata, and memory-only category anchors**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-24T03:27:16Z
- **Completed:** 2026-07-24T03:39:10Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended the existing iOS store with privacy-safe accepted items, one global earlier-page state, exact stale-completion rejection, and failure behavior that preserves visible content.
- Added weak live-store attachment to the identity coordinator so sign-out and account changes revoke route state before transition callbacks can publish.
- Added a SwiftUI-native `@MainActor` gallery model with canonical populated-only categories, stable server ordering, localized safe row metadata, deterministic per-category anchors, and no Phase 14 item actions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add accepted items, global earlier paging, and live-store revocation** - `57fbda6e` (feat)
2. **Task 2: Add provider-neutral iOS gallery session model** - `c9cbe9c6` (feat)

## Files Created/Modified

- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentGalleryModel.swift` - Projects safe store values into gallery categories, rows, anchors, and explicit intents.
- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentStore.swift` - Owns accepted safe items, exact request fencing, and the global earlier-page lifecycle.
- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentIdentityCoordinator.swift` - Weakly attaches and revokes the live route store during identity transitions.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift` - Covers safe projection, single-flight paging, stale completions, failure retention, and confirmation boundaries.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentIdentityCoordinatorTests.swift` - Covers weak attachment, replacement, sign-out revocation, and generation dominance.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGalleryModelTests.swift` - Retains the contract harness and verifies the production model's categories, formatting, anchors, privacy, and session clearing.

## Decisions Made

- The accepted-item boundary is deliberately narrower than persistence records: it admits only display-safe identifiers and metadata, never provider delivery information.
- Earlier-page responses append globally regardless of the currently selected category, but only after the complete request identity and cursor tuple matches.
- File sizes use locale-aware `ByteCountFormatStyle`, voice durations use locale-aware number formatting, and missing legacy duration stays an explicit non-actionable label.
- Category switching reports visibility but never starts recovery, while close clears anchors and delegates full session revocation to the store.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced the Wave 0 gallery RED guard with production acceptance coverage**

- **Found during:** Task 2 (provider-neutral gallery model)
- **Issue:** The inherited test file deliberately recorded an unconditional RED issue, which would keep the focused suite failing after the production model existed.
- **Fix:** Replaced only the unconditional guard with a production-model test while preserving all seven executable contract-harness tests.
- **Files modified:** `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGalleryModelTests.swift`
- **Verification:** The focused suite passed 28 tests across the store, coordinator, and gallery model.
- **Committed in:** `c9cbe9c6`

**2. [Rule 3 - Blocking] Added production tests omitted from the plan file list**

- **Found during:** Task 1 (store and identity coordination)
- **Issue:** The plan required exact stale-result, privacy, weak-lifetime, and single-flight proofs but listed only production files for modification.
- **Fix:** Extended the existing store and identity coordinator suites with direct production coverage for every new boundary.
- **Files modified:** `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift`, `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentIdentityCoordinatorTests.swift`
- **Verification:** The plan-specific suite passed, including stale owner completion rejection, weak deallocation, and paging failure retention.
- **Committed in:** `57fbda6e`

**3. [Rule 1 - Bug] Corrected inconsistent generated progress metadata**

- **Found during:** Plan closeout
- **Issue:** `state.update-progress` reported 36/41 plans as 88% but wrote `40` in frontmatter and left the readable progress bar at 85%.
- **Fix:** Corrected both representations to the handler's computed 88% value.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Frontmatter, progress bar, completed-plan count, current plan, and roadmap summary now agree.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 2 Rule 3 blocking issues)
**Impact on plan:** Both changes supplied required executable proof without expanding the product surface.

## TDD Gate Compliance

- **RED:** `b96ebc57` established the failing iOS gallery contract guard in Plan 13-03.
- **GREEN:** `57fbda6e` and `c9cbe9c6` implement the store, identity, and model behavior and make the focused suite pass.

## Verification

- `xcodebuild test ... SharedContentStoreTests ... SharedContentIdentityCoordinatorTests ... SharedContentGalleryModelTests` — 28 tests passed.
- `pnpm ios:build` — passed.
- `pnpm build` — passed for core, Supabase, and Next.js workspaces.
- Privacy and deferred-action scans found no signed URLs, storage paths, provider errors, preview/open/download/share/delete actions, or other delivery authority in the presentation models.
- `git diff --check` — passed.

## Known Stubs

None. Empty collections are intentional cleared-session state, and “Duration unavailable” is the safe legacy-data presentation required by the plan.

## Issues Encountered

The first store verification exposed that existing direct thumbnail confirmation must remain available for exact current-generation keys even before an accepted-item projection exists. The direct key path now preserves that Phase 12 contract, while the item-based overload remains accepted-item-only.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The iOS UI can bind to a closed provider-neutral model without gaining access to delivery authority.
- Later route and UI plans can attach the live store, render safe rows, restore anchors, and add explicit Phase 14 actions without changing this session boundary.
- No blockers remain.

## Self-Check: PASSED

- All six created or modified implementation/test files exist.
- Task commits `57fbda6e` and `c9cbe9c6` exist in repository history.
- The plan-specific iOS suite and both required builds pass.

---
*Phase: 13-calm-gallery-browsing*
*Completed: 2026-07-24*
