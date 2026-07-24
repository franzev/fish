---
phase: 12-cross-platform-data-cache-and-recovery
plan: 11
subsystem: ios-chat-data
tags: [swift, ios, supabase, core-data, low-data-mode, paging, privacy]

# Dependency graph
requires:
  - phase: 12-cross-platform-data-and-cache-foundations
    provides: provider-neutral shared-content state and safe Core Data cache primitives from plans 12-04, 12-05, and 12-07
provides:
  - provider-neutral iOS shared-content repository, cursor, page, request-token, and redacted failure contracts
  - strict authorized Supabase listing/category adapter with protected Core Data reconciliation
  - buffering-newest NWPath Low Data Mode policy monitor
affects: [phase-12-recovery-orchestration, phase-13-shared-content-gallery, phase-14-shared-content-actions]

# Tech tracking
tech-stack:
  added: []
  patterns: [strict JSON shape validation before decoding, verified-owner cache hydration, exact request acceptance gates, constrained-path lookahead suppression]

key-files:
  created:
    - apps/ios/FishKit/Sources/ChatData/Providers/SharedContentProviding.swift
    - apps/ios/FishKit/Sources/ChatData/Adapters/SupabaseSharedContentRepository.swift
    - apps/ios/FishKit/Sources/ChatData/Adapters/SharedContentNetworkPolicy.swift
  modified:
    - apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift

key-decisions:
  - "Keep provider and persistence details inside ChatData; expose only safe Codable repository values to later orchestration and UI layers."
  - "Treat Low Data Mode as an automatic constrained-path dimension: visible work remains usable while lookahead is suppressed."
  - "Validate the complete 28-field RPC row shape and reject duplicate or malformed ordered rows before any cache transaction."

patterns-established:
  - "A page request is accepted only when verified owner, identity generation, cycle/request token, cursor, and replace mode still match."
  - "The RPC uses p_limit 40, retains indexes 0–39, and treats only index 40 as a hasMore sentinel."

requirements-completed: [PRIV-03, OFF-01, OFF-02]

# Metrics
duration: 35min
completed: 2026-07-23
---

# Phase 12 Plan 11: iOS Authorized Repository Summary

**Provider-neutral iOS shared-content access with strict authorized paging, protected cache reconciliation, and automatic Low Data Mode policy.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-23T21:27:00+08:00
- **Completed:** 2026-07-23T22:02:27+08:00
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Added safe iOS repository contracts for normalized shared-content items, four-field cursors, pages, request tokens, typed redacted failures, and provider-neutral orchestration.
- Implemented verified-owner and authorized-conversation Supabase RPC access with exact 40+1 paging, strict 28-field row/category validation, ordering checks, duplicate rejection, and no mutation for denied or stale responses.
- Connected accepted replace/append results to the protected Core Data cache while preserving verified cache on transport/cache failure and purging on authority loss.
- Added a buffering-newest `NWPathMonitor` adapter where satisfied constrained paths remain usable and suppress only lookahead work.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement authorized iOS listing, cache reconciliation, and network policy** - `912888d3` (test, RED contract), `022e8485` (feat, GREEN implementation)

**Plan metadata:** `68a1e5db` (docs: complete plan, state, and roadmap metadata)

## Files Created/Modified

- `apps/ios/FishKit/Sources/ChatData/Providers/SharedContentProviding.swift` - Safe repository/page/cursor/request/failure contracts with no provider or persistence types.
- `apps/ios/FishKit/Sources/ChatData/Adapters/SupabaseSharedContentRepository.swift` - Authorized RPC adapter, strict wire validation, acceptance gates, and cache reconciliation.
- `apps/ios/FishKit/Sources/ChatData/Adapters/SharedContentNetworkPolicy.swift` - Low Data Mode-aware path policy and `NWPathMonitor` stream.
- `apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift` - RED/GREEN contract coverage for authorization, paging sentinels, stale requests, failure retention, idempotence, and constrained paths.

## Decisions Made

- Kept the existing ChatCore two-field delivery projection separate from the adapter's path facts (`usable`, `constrained`, and `expensive`) so provider-neutral orchestration does not import Network framework details.
- Encoded nullable RPC fields as required JSON keys and rejected unknown, omitted, malformed, mixed-conversation, duplicate, and over-limit rows before cache mutation.
- Used request identity as the browsed-page cache transaction identity so repeated accepted requests stay duplicate-free.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected non-throwing cancellation handling**
- **Found during:** Task 1 compilation
- **Issue:** An inner cache cancellation branch attempted to throw from the repository's non-throwing typed-result API.
- **Fix:** Returned the typed `requestSuperseded` failure instead.
- **Files modified:** `apps/ios/FishKit/Sources/ChatData/Adapters/SupabaseSharedContentRepository.swift`
- **Verification:** Focused repository tests and combined cache/repository tests pass.
- **Committed in:** `022e8485`

**2. [Rule 2 - Missing critical validation] Rejected duplicate item identifiers**
- **Found during:** Task 1 strict-response review
- **Issue:** Non-adjacent duplicate IDs could otherwise pass ordering validation and reach reconciliation.
- **Fix:** Reject any page whose item IDs are not unique before creating a cache transaction.
- **Files modified:** `apps/ios/FishKit/Sources/ChatData/Adapters/SupabaseSharedContentRepository.swift`
- **Verification:** Strict response validation remains green; all 19 combined tests pass.
- **Committed in:** `022e8485`

**3. [Rule 3 - Blocking] Made URLProtocol request capture stream-safe in tests**
- **Found during:** Task 1 verification
- **Issue:** Xcode's URLProtocol request exposed the encoded RPC body through `httpBodyStream`, causing the p_limit assertion to observe no body.
- **Fix:** Read either `httpBody` or the request input stream in the test transport.
- **Files modified:** `apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift`
- **Verification:** The exact `p_limit = 40` assertion passes.
- **Committed in:** `022e8485`

**Total deviations:** 3 auto-fixed (1 missing critical validation, 2 blocking implementation/test issues)
**Impact on plan:** All fixes directly strengthened or unblocked the planned strict repository contract; no scope expansion occurred.

## Issues Encountered

- The documented `pnpm ios:test -- --only-testing:...` wrapper currently forwards an extra separator argument in this workspace. The equivalent direct `xcodebuild test` invocation was used for the required iOS suites.
- Xcode emitted the existing empty-supported-platform warning and URLSession's expected simulated network-connection-lost log during the failure-retention test; neither affected the passing test result.

## TDD Gate Compliance

- RED gate: `912888d3 test(12-11): add failing iOS repository contract`
- GREEN gate: `022e8485 feat(12-11): implement iOS authorized shared-content repository`
- REFACTOR gate: not needed; the GREEN implementation remained readable and all verification stayed green.

## Known Stubs

None found in the files created or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Verification

- `xcodebuild test ... -only-testing:ChatDataTests/SharedContentRepositoryTests` — passed, 8 tests.
- `xcodebuild test ... -only-testing:ChatDataTests/SharedContentRepositoryTests -only-testing:ChatDataTests/CoreDataSharedContentCacheTests` — passed, 19 tests.
- `pnpm build` — passed for shared packages and web production build.
- Confirmed no Supabase migration, PersonalChat, ChatCore, UI, setting, or route files changed.
- Confirmed the public repository contract contains no Supabase or Core Data types and typed failure descriptions are redacted.

## Next Phase Readiness

The iOS repository seam is ready for recovery orchestration and later gallery presentation. Later phases can consume the safe page/snapshot stream and network policy without depending on Supabase, Core Data, signed URLs, or filesystem details.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*

## Self-Check: PASSED

- Summary file exists.
- RED and GREEN task commits `912888d3` and `022e8485` exist in git history.
- Stub scan found no placeholder implementation in plan-created or plan-modified files.
