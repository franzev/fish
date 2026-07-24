---
phase: 13-calm-gallery-browsing
plan: "12"
subsystem: ios-ui
tags: [swiftui, navigationstack, supabase, core-data, identity-lifecycle]

# Dependency graph
requires:
  - phase: 13-03
    provides: Failing iOS navigation, focus-restoration, exactly-once route, and snapshot contracts
  - phase: 13-08
    provides: Provider-neutral gallery model with memory-only category anchors and route lifecycle
  - phase: 13-10
    provides: Native full-screen gallery surface over safe display projections
  - phase: 12
    provides: Authorized Supabase repository, protected Core Data cache, thumbnail store, recovery store, and identity coordinator
provides:
  - Exactly two accessible iOS Shared content entries in the conversation header and details route
  - Explicit owner/conversation/origin navigation intents with deterministic focus restoration
  - Live verified repository-cache-store-model composition scoped to one native gallery route
  - Synchronous route revocation across pop, conversation replacement, sign-out, and identity replacement
affects: [13-13, phase-14-content-delivery, ios-personal-chat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Explicit-origin NavigationStack destinations scoped by verified owner and conversation
    - Persistent protected storage dependencies with one ephemeral store/model pair per route
    - Generation-token checks around asynchronous route, network, and realtime callbacks

key-files:
  created:
    - apps/ios/FishKit/Sources/PersonalChat/Views/ConversationDetailsSheet.swift
  modified:
    - apps/ios/FishKit/Sources/PersonalChat/Views/PersonalChatTopBar.swift
    - apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentNavigationTests.swift
    - apps/ios/App/Sources/FishApp.swift

key-decisions:
  - "Keep protected cache and thumbnail dependencies app-owned, but create exactly one repository, store, and provider-neutral model for each retained gallery route."
  - "Fail closed by withholding both Shared content entries until persistent storage and the exact signed-in owner are eligible."
  - "Carry the header or details origin in the destination value so native Back restores the real source control without inferring sheet state."
  - "Construct the Phase 13 gallery model without an item-selection callback so Phase 14 actions remain absent."

patterns-established:
  - "Route-first authority: verify owner and conversation, attach the store to identity coordination, bind, then publish the route model."
  - "Revoke-before-replace: cancel route observers, clear gallery state, detach identity authority, then transition account or conversation state."

requirements-completed: [DISC-01, DISC-02]

# Metrics
duration: 16min
completed: 2026-07-24
---

# Phase 13 Plan 12: iOS Shared-Content Entry and Live Composition Summary

**Two calm native entry points now push one verified, route-scoped Phase 12 shared-content pipeline with explicit origin Back paths and focus restoration**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-24T05:03:51Z
- **Completed:** 2026-07-24T05:19:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added exactly two `Shared content` controls: a quiet 44-point photo icon in the existing conversation header action cluster and a full-width 44-point row directly below participant identity in Conversation details.
- Introduced typed header/details origins carrying exact owner and conversation identity, with a native `NavigationStack` that returns details-origin galleries through details and restores focus to the actual originating control.
- Composed the real `SupabaseSharedContentRepository`, protected `CoreDataSharedContentCache`, `SharedContentThumbnailStore`, `SharedContentStore`, and `SharedContentGalleryModel` only after verified identity eligibility.
- Routed scene, connectivity, realtime, visibility, retry, earlier-page, and display-confirmation behavior through the same route store while rejecting stale route callbacks.
- Closed and detached gallery authority before custom pop, conversation replacement, sign-out, or account replacement, without exposing provider locators or adding Phase 14 item actions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add both iOS entries and explicit-origin navigation intents** - `27c4b843` (feat)
2. **Task 2: Compose the live iOS gallery destination and enforce identity-safe lifecycle** - `b67ff138` (feat)

## Files Created/Modified

- `apps/ios/FishKit/Sources/PersonalChat/Views/PersonalChatTopBar.swift` - Adds the distinct photo-icon entry while preserving the existing conversation actions and participant-details target.
- `apps/ios/FishKit/Sources/PersonalChat/Views/ConversationDetailsSheet.swift` - Adds participant identity followed by the full-width Shared content row and optional safety content.
- `apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift` - Defines the two explicit entries, owner/conversation-scoped intents, and source-specific focus hooks.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentNavigationTests.swift` - Replaces the inherited RED guard with production entry, origin, target-size, and focus assertions.
- `apps/ios/App/Sources/FishApp.swift` - Owns the native destination path and the real verified Phase 12 repository/cache/store/model lifecycle.

## Decisions Made

- Retained the protected cache, thumbnail store, and network monitor at app scope because they participate in purge and reconnect authority, while keeping each gallery store/model pair route-scoped and discardable.
- Used one typed `NavigationStack` destination enum instead of another sheet, keeping Conversation details below its gallery destination and preventing background conversation accessibility from remaining in the active hierarchy.
- Made entry availability depend on successful persistent-storage creation plus coordinator eligibility for the current session owner; unavailable authority produces no fake route or fallback data source.
- Left `SharedContentGalleryModel` item selection unset, so the live route exposes browsing only and cannot render fake or premature preview/download/share actions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced the inherited unconditional RED guard**
- **Found during:** Task 1 (navigation production contract)
- **Issue:** The planned implementation files could not make the focused navigation suite pass while its Wave 0 test intentionally failed unconditionally.
- **Fix:** Updated the existing navigation test with assertions against the real two-entry public contract, exact labels, 44-point targets, origins, and focus targets.
- **Files modified:** `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentNavigationTests.swift`
- **Verification:** Focused navigation and snapshot tests and the complete FishKit suite passed.
- **Committed in:** `27c4b843`

**2. [Rule 1 - Bug] Corrected the Conversation details avatar size token**
- **Found during:** Task 1 (native build)
- **Issue:** The first details implementation referenced an unavailable `.lg` avatar size.
- **Fix:** Switched to the existing semantic `.profile` avatar size used by the native design system.
- **Files modified:** `apps/ios/FishKit/Sources/PersonalChat/Views/ConversationDetailsSheet.swift`
- **Verification:** `pnpm ios:build` and `pnpm build` passed before the task commit.
- **Committed in:** `27c4b843`

**3. [Rule 1 - Bug] Prevented an older route preparation from detaching a newer store**
- **Found during:** Task 2 (route-generation audit)
- **Issue:** A superseded async bind could reach its rejection branch after a newer route attached and detach that newer store.
- **Fix:** The stale route now closes only its own store and detaches coordinator authority only when its route generation is still current.
- **Files modified:** `apps/ios/App/Sources/FishApp.swift`
- **Verification:** Real app build, focused lifecycle suites, complete FishKit suite, and monorepo build passed.
- **Committed in:** `b67ff138`

**4. [Rule 1 - Bug] Corrected stale progress values emitted by state tracking**
- **Found during:** Plan closeout
- **Issue:** `state.update-progress` reported 40 of 41 plans (98%) but persisted the completed-plan count as the percentage and left the visible progress line at 95%.
- **Fix:** Synchronized STATE frontmatter and the visible progress line to the handler's disk-derived 98% result.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE now agrees with 40/41 completed plans and ROADMAP's 12/13 Phase 13 count.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking)
**Impact on plan:** All fixes were required to make the inherited TDD contract executable and preserve generation-safe production behavior. No product scope, dependency, or Phase 14 action was added.

## TDD Gate Compliance

- **RED:** `74be75d5` established the failing Phase 13 navigation production guard; the pre-implementation focused run failed only on that expected guard.
- **GREEN:** `27c4b843` implemented the two production entries and typed intents; `b67ff138` implemented the live route and lifecycle composition.
- **Validation:** Focused navigation/snapshot and navigation/store/identity/model suites passed, followed by `pnpm ios:build`, `pnpm ios:app:build`, the complete `pnpm ios:test` suite, provider-boundary and Phase 14 action scans, and `pnpm build`.

## Known Stubs

None. Entry availability fails closed when protected storage or identity authority is unavailable, and the live route uses no null provider, fake data, or placeholder action.

## Issues Encountered

- The first focused command used an unsupported `xcodebuild -packagePath` option. Re-running from the FishKit package directory with the plan's command shape passed.
- An initial Phase 14 source scan matched the word `share` inside `sharedContent`; narrowing the guard to the actual `onSelectItem:` composition hook passed and confirmed no item action was supplied.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 13-13 can complete cross-platform verification against the live iOS route and its exact two-entry navigation contract.
- Phase 14 may later add explicitly authorized item delivery actions; this route currently remains direct-chat browsing only.
- No blockers remain.

## Self-Check: PASSED

- All five implementation/test paths and this summary exist.
- The inherited RED commit and both atomic task commits exist in git history.
- The production entry enum contains exactly two cases.

---
*Phase: 13-calm-gallery-browsing*
*Completed: 2026-07-24*
