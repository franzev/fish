---
phase: 13-calm-gallery-browsing
plan: "07"
subsystem: android-shared-content-gallery
tags: [android, kotlin, coroutines, stateflow, shared-content, privacy]

dependency-graph:
  requires:
    - phase: 12-offline-shared-content-cache-delivery
      provides: Android owner-scoped store, bounded recovery, visibility planning, and closed presentation truth
    - plan: 13-02
      provides: Android gallery projection and global paging RED contract
    - plan: 13-05
      provides: Trusted nullable duration in accepted Android repository and Room items
  provides:
    - Display-safe accepted item StateFlow over the existing Android shared-content store
    - Single-flight global earlier-page orchestration with exact stale callback rejection
    - Route-scoped gallery presenter with canonical categories, deterministic selection, anchors, and localized safe display models
  affects: [13-09, 13-11, android-shared-content-gallery]

tech-stack:
  added: []
  patterns:
    - Allowlisted store DTO strips provider, delivery, cache, action-authority, URL, and path fields before feature presentation
    - One exact append token gates global earlier paging while failures retain accepted content
    - Route-scoped presenter keeps selection and per-category anchors memory-only

key-files:
  created:
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryPresenter.kt
  modified:
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt

key-decisions:
  - "Expose one allowlisted SharedContentAcceptedItem model rather than repository or Room values, excluding raw URLs, paths, delivery authority, sender/date preview context, and Phase 14 actions."
  - "Keep earlier paging global and single-flight; exact owner, conversation, generation, pending request, cursor-bearing token, and append mode gate every completion."
  - "Keep category selection and anchors route-scoped in the presenter, with canonical Media, Files, Links, Voice fallback only when the selected category empties."

patterns-established:
  - "Accepted refresh, cache, and append values converge on the same display-safe StateFlow while the repository remains the only persistence and network authority."
  - "Category switching reports visibility but never reopens recovery or issues category-specific requests."

requirements-completed: [DISC-02]

duration: 12 min
completed: 2026-07-24
---

# Phase 13 Plan 07: Android Gallery Store and Presenter Summary

**Android now projects accepted owner-scoped shared content into deterministic, localized gallery sessions with one globally gated earlier-page command and no provider or Phase 14 action leakage.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-24T03:10:44Z
- **Completed:** 2026-07-24T03:22:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended the existing Phase 12 store with allowlisted accepted items and explicit `Hidden`, `Ready`, `Loading`, `Failed`, and `Offline` earlier-page truth.
- Added one global append request with duplicate suppression, owner/conversation/generation/request/mode gating, global page acceptance, failure retention, and synchronous bind/close clearing.
- Added a provider-neutral gallery presenter that preserves server order, projects populated categories in canonical order, retains valid selection and per-category anchors, and falls back deterministically.
- Produced safe Media, File, Link, and Voice display models with friendly file types, locale-aware sizes and duration digits, direction-isolation metadata, and honest `Duration unavailable` fallback.
- Kept optional item selection disabled unless a real Phase 14 destination callback is supplied.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the existing store with accepted safe items and global earlier-page orchestration** - `1af896df` (`feat`)
2. **Rule 1 correction: Reject stale display confirmation and duplicate cache snapshots** - `bd2a5e97` (`fix`)
3. **Task 2: Implement Android gallery session projection and localized display models** - `ca6c29b6` (`feat`)

## Files Created/Modified

- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt` - Adds accepted safe items, global earlier state/request handling, strict callback clearing, and fail-closed thumbnail confirmation.
- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryPresenter.kt` - Adds canonical category/session projection, anchors, safe localized item models, and typed gallery intents.

## Decisions Made

- Derived retained paging cursors from already accepted ordered items rather than exposing encoded cache cursor storage.
- Used a closed enum for global earlier truth and kept manual recovery truth in the existing Phase 12 presentation contract.
- Preserved a valid selected category across accepted mutations; only an emptied selected category falls back to the first populated canonical category.
- Used safe presenter metadata only: raw URLs, MIME fallback strings, paths, provider failures, sender/date preview context, delivery credentials, and action authority never enter UI state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Closed stale display-confirmation and duplicate-snapshot gaps**

- **Found during:** Task 2 lifecycle review
- **Issue:** The existing direct display-confirmation method could still reach its port after close, and duplicate cached item IDs were not rejected as a whole snapshot.
- **Fix:** Required a current bound accepted item before confirmation, cleared background session time across bind/close, and rejected duplicate snapshot item IDs before publication.
- **Files modified:** `SharedContentStore.kt`
- **Verification:** Focused store/presenter suite and `pnpm build` passed after the correction.
- **Commit:** `bd2a5e97`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug).
**Impact on plan:** The correction tightened the plan's existing lifecycle and privacy boundary without adding scope or changing the presentation contract.

## Authentication Gates

None.

## Known Stubs

- `SharedContentGalleryPresenter` defaults `onSelectItem` to absent and publishes `itemSelectionEnabled = false`. This is an intentional Phase 13 scope gate; Phase 14 supplies a real preview destination before item selection can become interactive.

## Verification

- Wave 0 RED baseline failed only at the named missing `SharedContentGalleryPresenter`, `SharedContentStore.loadEarlier`, and `SharedContentStore.acceptedItems` production guard.
- Final focused Android store/presenter suite: 15/15 passing; the Wave 0 production guard is green without changing its behavior tests.
- Existing Phase 12 store tests remain green, including bounded retry, truthful cache/offline/empty states, visibility batching, and rebind cancellation.
- Store and presenter compile successfully in the Android feature module.
- `pnpm build`: passing before every production commit and at final verification.
- Privacy scan found no signed URL, storage path, cache locator, provider error, raw URL, sender/date preview context, or Phase 14 action authority in presenter state.
- `git diff --check`: passing.

## Threat Flags

None. Accepted-item allowlisting, exact append gating, and route-session clearing are the trust-boundary changes explicitly covered by the plan threat model.

## Next Phase Readiness

- Plan 13-09 can render category-specific Android gallery components directly from the presenter state without reaching into repository or cache types.
- Plan 13-11 can construct one verified route-scoped store/presenter and wire exact open/close/realtime/visibility lifecycle events.
- No provider dependency, category-specific request, automatic pagination, persisted session choice, Phase 14 item action, global gallery, or non-chat mobile surface was introduced.

## Self-Check: PASSED

- Both plan-owned production artifacts exist.
- Commits `1af896df`, `bd2a5e97`, and `ca6c29b6` exist in git history.
- All plan acceptance and final verification commands pass.
- The eight unrelated `.planning/research/.cache` JSON files remain untracked and untouched.

---
*Phase: 13-calm-gallery-browsing*
*Completed: 2026-07-24*
