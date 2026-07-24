---
phase: 12-cross-platform-data-cache-and-recovery
plan: 07
subsystem: database
tags: [ios, swift, core-data, cache, offline, privacy, purge]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: Safe shared-content metadata, canonical ordering, tombstone semantics, and 40+1 paging boundary
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Portable safe snapshots, cache limits, owner gates, and iOS RED cache tests
provides:
  - Processed owner/conversation-scoped Core Data model for secret-free shared-content metadata
  - Provider-neutral iOS cache port with bounded policy and retained-history truth
  - Protected transactional Core Data adapter with hydration, reconcile, pruning, purge, sweep, and reopen coverage
affects: [12-08, 12-11, 12-12, 12-13, 12-15, ios-shared-content]

# Tech tracking
tech-stack:
  added: []
  patterns: [private NSManagedObjectContext transactions, compound owner/conversation constraints, page-first deterministic eviction, protected backup-excluded SQLite cache]

key-files:
  created:
    - apps/ios/FishKit/Sources/ChatData/Resources/SharedContentCache.xcdatamodeld/SharedContentCache.xcdatamodel/contents
    - apps/ios/FishKit/Sources/ChatData/Providers/SharedContentCaching.swift
    - apps/ios/FishKit/Sources/ChatData/Adapters/CoreDataSharedContentCache.swift
    - apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift
  modified:
    - apps/ios/FishKit/Package.swift

key-decisions:
  - "Persist only owner-scoped shared-content metadata and retained-history truth; delivery URLs, tokens, runtime state, bytes, paths, and action authority remain outside Core Data."
  - "Use Core Data uniqueness constraints for owner/conversation/page/item identity and a private context save boundary for every accepted mutation."
  - "Protect the newest 40 items, reclaim inactive and oldest browsed pages first, and enforce 400-per-conversation and 2,000-per-account limits with an injected clock."
  - "Require exact verified-owner hydration and make owner purge plus non-current-owner sweep explicit before a new identity can consume restored rows."

patterns-established:
  - "Provider-neutral DTOs keep ChatData persistence details out of ChatCore and PersonalChat."
  - "Core Data mutations validate the whole owner/conversation batch, roll back on typed failure, save once, and reapply backup exclusion after material operations."
  - "Focused tests inspect the compiled model, protection options, SQLite companion bytes, reopening, idempotence, eviction, rollback, and namespace purge."

requirements-completed: [PRIV-03, OFF-01]

# Metrics
duration: 32min
completed: 2026-07-23
---

# Phase 12 Plan 07: iOS Core Data cache Summary

**Protected, owner-isolated iOS Core Data cache for bounded shared-content metadata, retained-history truth, deterministic eviction, and verified identity cleanup.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-07-23T12:49:54Z
- **Completed:** 2026-07-23T13:21:42Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments

- Added the processed `SharedContentCache` model with exactly three entities and compound owner/conversation/page/item uniqueness, with no delivery or runtime-authority fields.
- Added `SharedContentCaching`, safe stored snapshot values, the shared 40/400/2,000/30-day policy, complete file protection, and backup-excluded store setup without adding a package.
- Implemented private-context transactional hydration, newest-window replacement, browsed-page reconciliation, tombstones, rollback, inactivity/cap pruning, persistent reopen, conversation/owner purge, and stale-owner sweep.
- Replaced the Wave 0 fake with 11 focused Core Data tests covering owner isolation, cache truth, atomicity, idempotence, eviction, protection, reopen, purge, and signed-token sentinel absence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the Core Data model, storage port, and protection contract** - `b2ae261f` (test), `80c56ef8` (feat)
2. **Task 2: Implement transactional hydration, reconciliation, eviction, and purge** - `66281785` (feat), `21f9a414` (fix)

## Files Created/Modified

- `apps/ios/FishKit/Package.swift` - Processes ChatData resources without adding dependencies.
- `apps/ios/FishKit/Sources/ChatData/Resources/SharedContentCache.xcdatamodeld/SharedContentCache.xcdatamodel/contents` - Defines owner, page, and item cache entities and safe attributes.
- `apps/ios/FishKit/Sources/ChatData/Providers/SharedContentCaching.swift` - Defines provider-neutral Sendable configuration, DTOs, failure categories, and cache port.
- `apps/ios/FishKit/Sources/ChatData/Adapters/CoreDataSharedContentCache.swift` - Owns protected SQLite/in-memory stores, private context work, reconcile transactions, pruning, and purge verification.
- `apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift` - Exercises the model and the complete adapter contract.

## Verification

- `xcodebuild test -scheme FishKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:ChatDataTests/CoreDataSharedContentCacheTests` — passed all 11 tests.
- `pnpm ios:chat-vectors:check` — passed; all three fixture files are synchronized.
- `pnpm build` — passed for shared packages and web production build.
- Model inspection — passed: exactly three entities, compound uniqueness constraints, and zero forbidden durable field names.
- Persistent reopen/protection — passed: complete file-protection option and backup exclusion remained true after saves and reopen.
- Scope check — passed: no Supabase migration changed; eight unrelated `.planning/research/.cache` files remained untracked and untouched.

## Decisions Made

- Kept Core Data private to `ChatData`; the public port carries only safe metadata and retained-history truth.
- Used page-first eviction so inactive and oldest browsed pages are reclaimed before protected newest metadata.
- Added a concrete-call overload that derives authoritative-empty truth from an empty newest response, matching the provider-neutral protocol default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated Core Data model XML for the installed Xcode modeler.**

- **Found during:** Task 1 verification
- **Issue:** Xcode 26 rejected the legacy `manual/none` code-generation value and discarded the initial uniqueness-constraint XML shape.
- **Fix:** Used the modeler-compatible default entity metadata and `uniquenessConstraint`/`constraint value` entries.
- **Files modified:** `apps/ios/FishKit/Sources/ChatData/Resources/SharedContentCache.xcdatamodeld/SharedContentCache.xcdatamodel/contents`
- **Verification:** Compiled-model tests passed with all three compound constraint sets.
- **Committed in:** `80c56ef8`

**2. [Rule 1 - Bug] Corrected the inactivity test fixture to create an old browsed page before advancing the injected clock.**

- **Found during:** Task 2 verification
- **Issue:** The first test version inserted the browsed page after advancing time, so it was correctly considered recently accessed.
- **Fix:** Inserted the page at the old timestamp, advanced the clock, and triggered pruning through an accepted newest-window replacement.
- **Files modified:** `apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift`
- **Verification:** Focused suite passed and retained only the protected newest 40 items.
- **Committed in:** `66281785`

**3. [Rule 1 - Bug] Made concrete adapter calls infer authoritative-empty truth when the flag is omitted.**

- **Found during:** Task 2 final review
- **Issue:** Swift cannot express the Kotlin-style default `items.isEmpty` directly in a default argument; the initial concrete overload defaulted to false.
- **Fix:** Added an overload that derives `authoritativeEmptyConfirmed` from `items.isEmpty` and delegates to the full transactional method.
- **Files modified:** `apps/ios/FishKit/Sources/ChatData/Adapters/CoreDataSharedContentCache.swift`
- **Verification:** Focused suite and `pnpm build` passed.
- **Committed in:** `21f9a414`

**Total deviations:** 3 auto-fixed (Rule 3: 1, Rule 1: 2).
**Impact on plan:** All fixes were required for model correctness or truthful cache behavior; no new dependency or architecture was introduced.

## Issues Encountered

- The documented `pnpm ios:test -- --only-testing:...` wrapper forwards the selector as an unsupported `xcodebuild` action in this repository. The direct `xcodebuild test ... -only-testing:...` equivalent was used, matching the prior Phase 12 verification pattern.

## Authentication Gates

None.

## Known Stubs

None. The implementation is complete for the planned Core Data cache boundary; delivery and presentation orchestration remain in later Phase 12 plans.

## Threat Flags

None. The introduced local persistence surface is the planned protected, backup-excluded Core Data cache and has exact owner predicates, typed failures, and sentinel tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- iOS recovery, delivery, thumbnail, and identity-coordinator plans can consume `SharedContentCaching` without importing Core Data or provider types.
- The adapter is ready for Plan 12-11/12-12/12-13/12-15 integration, with owner purge and stale-owner sweep available as fail-closed cleanup primitives.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*

## Self-Check: PASSED

- Summary file and all four planned iOS artifacts exist.
- Task commits `b2ae261f`, `80c56ef8`, `66281785`, and `21f9a414` exist in git history.
- Focused iOS tests, vector synchronization, and repository build passed.
- Eight unrelated `.planning/research/.cache` files remain untracked and untouched.
