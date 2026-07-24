---
phase: 12-cross-platform-data-cache-and-recovery
plan: 04
subsystem: testing
tags: [ios, swift, testing, cache, privacy, recovery]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: deterministic shared-content ownership, paging, tombstone, and identity-purge semantics
provides:
  - iOS RED coverage for protected shared-content metadata persistence and owner-scoped reconciliation
  - iOS RED coverage for ephemeral delivery, displayed-only thumbnails, bounded recovery, and Low Data Mode
  - iOS RED coverage for generation-aware image loading and purge-before-bind identity transitions
affects: [12-07, 12-11, 12-12, 12-13, 12-15]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-neutral Swift contract fakes, deterministic bounded paging, explicit production-symbol RED guards]

key-files:
  created:
    - apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift
    - apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift
    - apps/ios/FishKit/Tests/ChatDataTests/SharedContentDeliveryStoreTests.swift
    - apps/ios/FishKit/Tests/ChatDataTests/SharedContentThumbnailStoreTests.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentIdentityCoordinatorTests.swift
  modified:
    - apps/ios/FishKit/Tests/PersonalChatTests/MessageImageLoaderTests.swift

key-decisions:
  - "Keep iOS Wave 0 suites provider-neutral and intentionally RED behind absent Phase 12 production contracts; implementation remains in later plans."
  - "Use opaque item keys and redacted operation categories so delivery values, owner identifiers, paths, bytes, and provider failures never become durable or diagnostic evidence."
  - "Make the 40+1 page contract explicit: retain indexes 0–39, derive the cursor from index 39, use index 40 only for hasMore, and never access index 41."

patterns-established:
  - "Protected-cache tests use deterministic owner/conversation/generation gates, atomic rollback, reopen, eviction, purge, and SQLite companion-file scans."
  - "Delivery and recovery tests cover 1/49/50/51 batching, 120-second freshness, one 401/403 refresh, visible-only constrained loading, attempts 0/1, and one manual retry."
  - "Identity tests observe revoke, hide, cancel, clear, purge, verify, bind, and publish order and reject stale callbacks after generation changes."

requirements-completed: [PRIV-02, PRIV-03, PAGE-03, OFF-01, OFF-02]

# Metrics
duration: 15min
completed: 2026-07-23
---

# Phase 12 Plan 04: iOS Wave 0 test contracts Summary

**Seven executable iOS RED suites now pin protected cache, ephemeral delivery, bounded recovery, image-loader ownership, and purge-before-bind behavior before Phase 12 production services are implemented.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-23T11:39:22Z
- **Completed:** 2026-07-23T11:54:27Z
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments

- Added protected-cache and repository tests for owner/conversation uniqueness, safe fields, complete file protection, backup exclusion, atomic rollback, reopen, eviction, purge, strict decoding, membership loss, generation rejection, and constrained delivery.
- Added delivery and thumbnail tests for 1/49/50/51 batching, short-lived lease freshness, one authorization refresh, ephemeral URL-session policy, lookahead memory-only behavior, displayed confirmation, protected atomic writes, pruning, and purge.
- Added personal-chat recovery, presentation-key, image-loader, and identity adversary tests while preserving every existing direct-chat `MessageImageLoaderTests` expectation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold protected cache and authoritative repository tests** - `8ae10011` (test)
2. **Task 2: Scaffold delivery, recovery, loader, and identity-purge tests** - `ba047fd2` (test)

**Plan metadata:** the final docs commit will capture this summary and STATE/ROADMAP updates.

## Files Created/Modified

- `apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift` - Protected model, hydration, transaction, eviction, reopen, purge, and sentinel RED coverage.
- `apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift` - Authoritative owner/reconciliation, strict RPC, request-generation, paging, and constrained-network RED coverage.
- `apps/ios/FishKit/Tests/ChatDataTests/SharedContentDeliveryStoreTests.swift` - Ephemeral delivery lease, batching, freshness, authorization refresh, and redaction RED coverage.
- `apps/ios/FishKit/Tests/ChatDataTests/SharedContentThumbnailStoreTests.swift` - Displayed-only thumbnail persistence, protection, pruning, containment, and purge RED coverage.
- `apps/ios/FishKit/Tests/PersonalChatTests/MessageImageLoaderTests.swift` - Existing direct-chat loader tests plus intent, Low Data Mode, generation, opaque identity, and purge cases.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift` - Coalesced recovery, bounded retry, cached presentation, and constrained delivery RED coverage.
- `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentIdentityCoordinatorTests.swift` - Account-transition matrix, exact purge order, stale callback rejection, restart sweep, and fail-closed RED coverage.

## Decisions Made

- Kept all new suites provider-neutral and used explicit `Issue.record` guards so they execute as RED coverage without introducing production models, adapters, stores, coordinators, routes, settings, or packages.
- Reused the canonical 40+1 pagination rule and opaque/redacted evidence pattern established by Phase 11 and Android Plan 12-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected repository fake state after a rejected strict decode**
- **Found during:** Task 1
- **Issue:** The test fake retained a prior redacted failure after a subsequent valid projection, causing a behavioral test to fail independently of the intended missing-production guard.
- **Fix:** Reset the fake failure category on successful strict decoding.
- **Files modified:** `apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift`
- **Verification:** Task 1 targeted suite passed all behavioral tests; only the two intended RED guards failed.
- **Committed in:** `8ae10011`

**2. [Rule 1 - Bug] Preserved displayed thumbnail bytes separately from full-content memory**
- **Found during:** Task 2
- **Issue:** The thumbnail fake stored only byte counts, so the selected-full-content test could not prove full bytes did not replace the displayed thumbnail.
- **Fix:** Added a test-only thumbnail byte map cleared by purge and pruning.
- **Files modified:** `apps/ios/FishKit/Tests/ChatDataTests/SharedContentThumbnailStoreTests.swift`
- **Verification:** Task 2 targeted suite passed all behavioral tests; only the five intended RED guards failed.
- **Committed in:** `ba047fd2`

**Total deviations:** 2 auto-fixed (Rule 1: 2).
**Impact on plan:** Both fixes corrected test-fixture behavior only; no production scope or architecture changed.

## Issues Encountered

- The plan’s `pnpm ios:test -- --only-testing:...` command forwards an extra `--` to `xcodebuild`, which treats it as an invalid build action. The equivalent direct `xcodebuild test ... -only-testing:...` command was used for verification.
- The combined simulator suite built successfully and all behavioral assertions passed. Its seven failures are the intentional RED guards for the seven absent Phase 12 production contracts.
- Existing unrelated compiler warnings in `MessageComposerTests.swift` remain unchanged and were not in this plan’s file scope.

## Authentication Gates

None.

## Known Stubs

None. The contract fakes are intentional RED test fixtures, not production stubs, and each suite has an explicit missing-production-contract guard.

## Threat Flags

None. This plan changed only test files and introduced no runtime endpoint, auth path, file-access production code, or schema surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 12-07, 12-11, 12-12, 12-13, and 12-15 can implement against concrete iOS RED contracts without weakening privacy, direct-chat-only, or provider-boundary rules.
- The seven RED guard failures are expected until those later production plans land.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*

## Self-Check: PASSED

- Summary file exists.
- All seven planned test files exist.
- Task commits `8ae10011` and `ba047fd2` exist in git history.
- Combined simulator verification reached all seven intentional RED guards with no compile errors or unrelated behavioral failures.
