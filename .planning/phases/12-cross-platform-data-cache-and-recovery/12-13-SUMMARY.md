---
phase: 12-cross-platform-data-cache-and-recovery
plan: 13
subsystem: ios-personal-chat
tags: [swift, ios, recovery, visibility, low-data-mode, privacy]

# Dependency graph
requires:
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: 12-04 iOS RED contract and test seams
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: 12-05 portable ChatCore state, events, and delivery planning
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: 12-11 provider-neutral shared-content repository contracts
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: 12-12 iOS media delivery and thumbnail services
provides:
  - MainActor Observable iOS shared-content recovery and visibility store
  - Closed provider-neutral presentation contract with truthful cache/recovery states
  - Bounded recovery retry, identity generation gating, and <=50-item visibility batches
affects: [phase-12, phase-13, phase-15, ios-personal-chat]

# Tech tracking
tech-stack:
  added: []
  patterns: [injected timing and task seams, ChatCore event/reducer routing, displayed-only thumbnail promotion]

key-files:
  created:
    - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentStore.swift
  modified:
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift

key-decisions:
  - "Use a 500ms trailing trigger coalescer and a five-minute meaningful-foreground threshold."
  - "Limit each recovery cycle to attempts 0 and 1, with a deterministic one-second delay plus injected jitter capped by the shared contract."
  - "Expose only the closed presentation contract; provider paths, URLs, tokens, and request diagnostics remain internal."
  - "Keep lookahead memory-only and make confirmDisplayed the only thumbnail persistence promotion."

patterns-established:
  - "Recovery is provider-neutral: PersonalChat creates request tokens and routes state through ChatCore events."
  - "Identity generation and cycle IDs gate every asynchronous result; unusable connectivity cancels pending work while retaining cache truth."
  - "Visibility planning delegates to the portable ChatCore planner and applies Low Data Mode only to lookahead."

requirements-completed: [PRIV-03, PAGE-03, OFF-01, OFF-02]

# Metrics
duration: 40min
completed: 2026-07-23
---

# Phase 12 Plan 13: iOS shared-content recovery and visibility store Summary

**Provider-neutral iOS shared-content recovery with bounded retry, truthful cache state, closed presentation, and Low Data Mode-aware visibility batching**

## Performance

- **Duration:** 40 min
- **Started:** 2026-07-23T14:52:30Z
- **Completed:** 2026-07-23T15:32:30Z
- **Tasks:** 1 completed with RED/GREEN TDD commits
- **Files modified:** 2 implementation/test files

## Accomplishments

- Added `@MainActor @Observable SharedContentStore` with injected provider, clock, jitter, sleeper, and task factory seams.
- Implemented trailing 500ms trigger coalescing, five-minute foreground gating, generation-bound attempts 0/1, deterministic retry plus injected jitter, cancellation on unusable connectivity, cache preservation, and manual retry only after the second failure.
- Routed hydration and refreshes through ChatCore events and portable delivery planning; visibility batches are capped at 50, Low Data Mode suppresses only lookahead, and `confirmDisplayed` is the only thumbnail persistence promotion.
- Added focused tests for recovery timing, retries, cancellation, cache/authority distinctions, visibility batching, persistence promotion, and presentation-key closure.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement provider-neutral shared-content recovery and visibility orchestration** - `db2d7f67` (test RED), `28db246d` (feat GREEN)

**Plan metadata:** final documentation commit created after state and roadmap updates.

## Files Created/Modified

- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentStore.swift` - MainActor recovery lifecycle, identity/cycle gating, closed presentation projection, ChatCore event routing, visibility planning, and displayed-only thumbnail confirmation.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift` - Focused deterministic provider, clock, sleeper, and thumbnail tests for the complete plan contract.

## Decisions Made

- Inject all time, jitter, sleeping, and task creation so recovery behavior is deterministic and testable without background loops.
- Keep presentation fields provider-neutral and closed rather than exposing repository/private values or diagnostics.
- Preserve cached content through failures and offline transitions while keeping authoritative empty, offline unavailable, stale/incomplete, loading, and manual-retry states distinct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bridged ChatCore Codable models without widening the ChatCore API**
- **Found during:** Task 1 GREEN implementation
- **Issue:** The public ChatCore event/page/item types expose Codable conformance but no public memberwise initializers, blocking PersonalChat from routing provider values through the required portable events.
- **Fix:** Added private Codable/JSON bridge helpers inside `SharedContentStore.swift`; no ChatCore, ChatData, UI, or route changes were made.
- **Files modified:** `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentStore.swift`
- **Verification:** Focused iOS suite and iOS package build pass.
- **Committed in:** `28db246d`

**2. [Rule 1 - Bug] Made the asynchronous provider fake race-safe**
- **Found during:** Task 1 focused test verification
- **Issue:** The Sendable provider fake’s result and call arrays were read by the test actor while the recovery task mutated them, causing an intermittent XCTest crash in the polling helper.
- **Fix:** Added synchronized fake bookkeeping and deterministic result replacement; removed an unnecessary async warning from the sleeper release helper.
- **Files modified:** `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift`
- **Verification:** All 8 focused `SharedContentStoreTests` pass.
- **Committed in:** `28db246d`

**Total deviations:** 2 auto-fixed (1 blocking port issue, 1 test race bug)
**Impact on plan:** Both fixes were directly required for the planned provider-neutral implementation and deterministic verification; no scope expansion.

## TDD Gate Compliance

- RED gate: `db2d7f67` added failing recovery-store tests before the implementation existed.
- GREEN gate: `28db246d` implemented the store and made all focused tests pass.
- No refactor commit was needed.

## Verification

- `xcodebuild test -scheme FishKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:PersonalChatTests/SharedContentStoreTests -quiet` — passed, 8 tests.
- `pnpm ios:test -- --only-testing=PersonalChatTests/SharedContentStoreTests` — wrapper ran the full package suite because its script inserts an extra `--`; the new focused tests passed, while the full suite reported the unrelated pre-existing `SharedContentIdentityCoordinatorTests.identityCoordinatorProductionContractIsAwaitingPhase1215()` failure.
- `pnpm ios:build` — passed.
- `pnpm ios:chat-vectors:check` — passed; 3 fixture files up to date.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm build` — passed.
- `git diff --check` — passed.
- Changed-file audit — implementation commit contains only the two requested files; no prohibited UI, route, navigation, settings, strings, Supabase, URLSession, or diagnostics changes.

## Known Stubs

None in the production implementation. The provider, clock, sleeper, and thumbnail fakes are intentionally test-only seams.

## Threat Flags

None. This plan adds no endpoint, authentication path, schema, or new persistence surface; it uses the existing provider and Plan 12-12 thumbnail service boundaries.

## Issues Encountered

- Xcode emitted the existing “Supported platforms for the buildables in the current scheme is empty” destination warning; the direct focused run still passed.
- The repository `pnpm ios:test` wrapper’s argument forwarding caused a full-suite run; the unrelated identity-coordinator contract test remains deferred to its planned phase.
- All pre-existing `.planning/research/.cache/*.json` files were preserved and left untracked.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The iOS PersonalChat recovery and visibility seam is ready for later UI/identity integration without exposing provider/private values. The unrelated identity coordinator production-contract test remains owned by Phase 12.15.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*

## Self-Check: PASSED

- Summary, implementation, and test files exist.
- RED and GREEN task commits `db2d7f67` and `28db246d` exist in git history.
- `git diff --check` passed.
