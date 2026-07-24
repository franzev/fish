---
phase: 13-calm-gallery-browsing
plan: "11"
subsystem: android-ui
tags: [compose, room, lifecycle, accessibility, identity-safety]

# Dependency graph
requires:
  - phase: 13-09
    provides: Android shared-content store, presenter, safe gallery projections, and native screen
  - phase: 13-02
    provides: Android gallery navigation and lifecycle RED contracts
provides:
  - Exactly two Android Shared content entries with explicit full-screen origins
  - Verified owner/conversation/generation-bound production gallery composition
  - Synchronous route and identity revocation with private display confirmation
affects: [13-12, 13-13, phase-14-content-delivery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Route-entry-keyed Compose store and presenter ownership
    - Exact identity-generation binding from the data authority
    - Narrow data-module capability for delivery refresh and thumbnail confirmation
    - Canonical semantic gallery dimensions generated into Android FishTheme tokens
    - Strict nullable duration decoding with non-negative validation

key-files:
  created: []
  modified:
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatRoute.kt
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatComponents.kt
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ParticipantDetailsSheet.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt
    - apps/android/app/src/main/kotlin/space/fishhub/android/MainActivity.kt
    - design/tokens/fish.tokens.json
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt

key-decisions:
  - "Create the store and presenter only after an actual gallery entry has an eligible owner, active conversation, and exact verified generation."
  - "Keep URL refresh and displayed-thumbnail promotion behind a narrow ChatDataModule runtime so feature UI receives no delivery locators."
  - "Use explicit ConversationHeader and ConversationDetails origins to restore both navigation state and accessibility focus deterministically."

patterns-established:
  - "One route entry, one session: recomposition and lifecycle callbacks reuse the same store and never call open again."
  - "Revoke before pop: close the presenter/store synchronously before clearing the route or beginning identity cleanup."

requirements-completed: [DISC-01, DISC-02]

# Metrics
duration: 25min
completed: 2026-07-24
---

# Phase 13 Plan 11: Android Shared Content Navigation and Runtime Summary

**Two calm native gallery entries backed by one exact-generation Room-cached session with deterministic Back focus and revoke-before-pop lifecycle**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-24T04:26:46Z
- **Completed:** 2026-07-24T04:52:05Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- Added the quiet header gallery action and full-width Conversation details row, preserving the existing action order, 48dp targets, and exactly two entry points.
- Added a native full-screen destination with explicit header/details origins, exact Back paths, and focus restoration to the originating control.
- Composed one production store/presenter only for an eligible owner and active conversation, preserving the authority's exact generation and opening once per route entry.
- Forwarded connectivity, meaningful foreground, realtime, visibility, retry, earlier-content, and display confirmation to the same session while keeping delivery details private.
- Registered synchronous app-level revocation so pop, replacement, sign-out, account switch, and eligibility loss close old work before cleanup or late callbacks can expose it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add both Android entry points and explicit-origin full-screen navigation** - `660ccd76` (feat)
2. **Task 2: Compose one live verified-conversation store and enforce route lifecycle** - `dfa19efd` (feat)
3. **Task 2 follow-up: Keep the identity purge hook process-scoped across activity recreation** - `670b1159` (fix)
4. **Post-wave integration: Tokenize Android gallery dimensions** - `f1af8c60` (fix)
5. **Post-wave integration: Decode trusted gallery duration metadata** - `9bec0911` (fix)

## Files Created/Modified

- `ChatComponents.kt` - Adds the quiet header Shared content action in the approved order.
- `ParticipantDetailsSheet.kt` - Adds the full-width details entry below identity and before safety actions.
- `ChatScreen.kt` - Carries controlled details state, entry callbacks, and focus requesters.
- `ChatRoute.kt` - Owns explicit origins, one route-entry session, lifecycle forwarding, revocation, and focus restoration.
- `ChatDataModule.kt` - Exposes the existing repository plus private refresh/confirmation capabilities without delivery locators.
- `FishApplication.kt` and `MainActivity.kt` - Supply the production runtime and synchronously revoke the active store during identity cleanup.
- `SharedContentStore.kt` - Accepts the exact verified identity generation and privately tracks display versions.
- `SharedContentGalleryPresenter.kt` and `SharedContentGalleryScreen.kt` - Route safe displayed-item confirmation to the store-owned delivery port.
- `SharedContentStoreTest.kt` - Proves the verified generation is preserved in authority request tokens.
- Nine Android chat screenshot references - Record the approved header action.

## Decisions Made

- Store construction is route-scoped rather than activity-scoped: no store exists until the gallery is actually entered, and each new entry gets one fresh session.
- The app keeps only an atomic reference to the active store for synchronous identity purge; the feature route remains the owner of presenter and navigation state.
- Content versions remain an internal accepted-item field used only for displayed-thumbnail confirmation and are not projected into gallery UI models.
- Realtime message changes trigger recovery on the existing store; initial connection events and lifecycle focus never call `open()` again.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended the controlled chat-screen seam for exact origin focus**
- **Found during:** Task 1
- **Issue:** `ChatRoute` could not restore focus to the details row while the participant sheet owned its visibility internally.
- **Fix:** Added controlled details visibility, callbacks, and focus modifiers to `ChatScreen` while preserving its local fallback behavior.
- **Files modified:** `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatScreen.kt`
- **Verification:** Connected navigation tests passed 4/4 and screenshot validation passed.
- **Committed in:** `660ccd76`

**2. [Rule 2 - Missing Critical] Added exact-generation and private display-confirmation plumbing**
- **Found during:** Task 2
- **Issue:** The existing store generated its own integer generation and the screen had no safe way to confirm a displayed item through the private thumbnail store.
- **Fix:** Added exact `Long` generation binding, internal content-version tracking, presenter confirmation, the application runtime getter, and an exact-generation regression test.
- **Files modified:** `FishApplication.kt`, `SharedContentStore.kt`, `SharedContentGalleryPresenter.kt`, `SharedContentGalleryScreen.kt`, `SharedContentStoreTest.kt`
- **Verification:** Focused store/presenter suites, connected navigation tests, Android lint, screenshot validation, and workspace build passed.
- **Committed in:** `dfa19efd`

**3. [Rule 1 - Bug] Corrected stale progress values emitted by state tracking**
- **Found during:** Plan closeout
- **Issue:** `state.update-progress` reported 39 of 41 plans (95%) but persisted an invalid 40% frontmatter value and left the visible bar at 93%.
- **Fix:** Synchronized both STATE progress fields to the handler's disk-derived 95% result.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE now agrees with 39 completed summaries out of 41 total plans and ROADMAP reports 11/13 for Phase 13.
- **Committed in:** Plan metadata commit

**4. [Rule 1 - Bug] Prevented purge-hook accumulation across activity recreation**
- **Found during:** Final lifecycle audit
- **Issue:** Registering an anonymous purge hook from every `MainActivity` instance would retain obsolete activity-owned store references because the repository exposes no unregister operation.
- **Fix:** Moved the single active-store reference and purge-hook registration to process-scoped `FishApplication`; activities now only replace the application-owned active session.
- **Files modified:** `FishApplication.kt`, `MainActivity.kt`
- **Verification:** App debug compilation and the required workspace build passed after the move.
- **Committed in:** `670b1159`

**5. [Rule 1 - Bug] Replaced raw gallery dimensions with semantic design tokens**
- **Found during:** Post-wave aggregate Android verification
- **Issue:** The approved 88dp, 120dp, and 64dp gallery dimensions lived as raw values in the feature component, violating the repository's enforced token discipline.
- **Fix:** Added semantic shared-content size entries to the canonical token manifest, regenerated Android tokens, exposed them through `FishTheme.sizes`, and consumed them in the media grid, skeleton, and metadata rows.
- **Files modified:** `design/tokens/fish.tokens.json`, `DimensionTokens.kt`, `GeneratedTokens.kt`, `SharedContentGalleryComponents.kt`
- **Verification:** `pnpm android:verify-design` and the complete `pnpm android:check` gate passed.
- **Committed in:** `f1af8c60`

**6. [Rule 1 - Bug] Restored strict canonical duration parity decoding**
- **Found during:** Post-wave aggregate Android verification
- **Issue:** `SharedContentItem` rejected the canonical `durationMs` key as unknown even though downstream repository/store contracts already trusted nullable non-negative duration metadata.
- **Fix:** Added nullable `Long` duration decoding with production non-negative validation and explicit parity coverage for legacy null, zero, exact trusted, negative, and fractional fixtures.
- **Files modified:** `SharedContentState.kt`, `SharedContentParityTest.kt`
- **Verification:** Focused `SharedContentParityTest` and the aggregate Android unit/check pipeline passed without weakening strict JSON decoding.
- **Committed in:** `9bec0911`

---

**Total deviations:** 6 auto-fixed (4 bugs, 2 missing critical)
**Impact on plan:** Both additions were required to enforce the planned accessibility and trust-boundary guarantees. No new product surface, dependency, endpoint, or delivery action was added.

## TDD Gate Compliance

- **RED:** `d02ef798` and `f25c5017` established the Phase 13 Android navigation and lifecycle contracts in Plan 13-02.
- **GREEN:** `660ccd76`, `dfa19efd`, `670b1159`, `f1af8c60`, and `9bec0911` implement the entries, routing, verified composition, process-scoped purge ownership, semantic dimensions, and strict duration mapping.
- **Validation:** Store/presenter and canonical parity suites pass, connected navigation passes 4/4 on `Pixel_10_Pro_XL`, the complete `pnpm android:check` gate passes, module boundaries pass 10/10, and `pnpm build` passes.

## Known Stubs

None. The unconfigured runtime intentionally remains identity-ineligible, and Phase 13's static gallery presentation is the approved provider-neutral behavior rather than mock data.

## Issues Encountered

- Post-wave integration reproduced and resolved the raw-dimension design guard and strict canonical `durationMs` decoder failures. No Phase 13 issue remains deferred.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The real Android conversation can now reach DISC-02 through one identity-safe native session from either approved DISC-01 entry.
- Plans 13-12 and 13-13 can verify cross-platform route parity and phase completion.
- The complete Android check, release assembly, lint, unit, and screenshot pipeline is green.

## Self-Check: PASSED

- All key implementation and summary paths exist.
- Both task commits, all three integration follow-ups, and the inherited RED commits exist in git history.
- Connected navigation, focused store/presenter and canonical parity suites, complete Android checks, module boundaries, and workspace build passed.

---
*Phase: 13-calm-gallery-browsing*
*Completed: 2026-07-24*
