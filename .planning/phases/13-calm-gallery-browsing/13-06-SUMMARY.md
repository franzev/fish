---
phase: 13-calm-gallery-browsing
plan: "06"
subsystem: ios-shared-content-data
tags: [ios, swift, core-data, supabase, shared-content, duration, privacy]

# Dependency graph
requires:
  - phase: 13-calm-gallery-browsing
    plan: "03"
    provides: iOS strict 29-field repository and Core Data legacy-duration RED contracts
  - phase: 13-calm-gallery-browsing
    plan: "04"
    provides: Trusted nullable duration in the authorized shared-content RPC
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Owner-scoped iOS repository, protected Core Data cache, and request acceptance gates
provides:
  - Strict iOS decoding and provider-neutral mapping for nullable non-negative duration
  - Backward-compatible Core Data duration persistence with legacy nil migration
  - Transactional negative-duration rejection that preserves prior cache snapshots
affects: [13-08, 13-10, ios-shared-content-gallery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Exact required nullable wire key with whole-page validation before cache mutation
    - Additive optional Core Data metadata with inferred lightweight migration
    - Production RED guards replaced by behavior-level repository and legacy-store assertions

key-files:
  created: []
  modified:
    - apps/ios/FishKit/Sources/ChatData/Providers/SharedContentProviding.swift
    - apps/ios/FishKit/Sources/ChatData/Adapters/SupabaseSharedContentRepository.swift
    - apps/ios/FishKit/Sources/ChatData/Providers/SharedContentCaching.swift
    - apps/ios/FishKit/Sources/ChatData/Adapters/CoreDataSharedContentCache.swift
    - apps/ios/FishKit/Sources/ChatData/Resources/SharedContentCache.xcdatamodeld/SharedContentCache.xcdatamodel/contents
    - apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift
    - apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift

key-decisions:
  - "Require duration_ms in every strict iOS RPC row while accepting an explicit null for legacy content."
  - "Persist duration as an optional Integer64 with inferred lightweight migration so pre-Phase-13 rows hydrate as nil."
  - "Validate duration at both repository acceptance and cache mutation boundaries before durable state can change."

patterns-established:
  - "Nullable duration follows strict RPC wire → safe data item → accepted stored item → protected Core Data record."
  - "Legacy-store tests remove the new model attribute, seed real SQLite data, then prove inferred migration and nil hydration."

requirements-completed: [DISC-02]

# Metrics
duration: 10 min
completed: 2026-07-24
---

# Phase 13 Plan 06: iOS Trusted Duration and Core Data Compatibility Summary

**iOS now carries trusted nullable voice duration through exact authorized rows and the protected owner-scoped Core Data cache while preserving legacy nil values and privacy gates.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-24T02:54:53Z
- **Completed:** 2026-07-24T03:05:21Z
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments

- Extended the iOS shared-content wire contract from 28 to exactly 29 required fields and exposed only nullable, non-negative duration through the safe ChatData item.
- Preserved verified-owner, authorized-directory, request token, cursor/mode, duplicate, ordering, category/kind, and 40+1 acceptance gates before reconciliation.
- Added optional Integer64 duration metadata to the existing protected Core Data model with explicit automatic/inferred migration compatibility.
- Proved a real pre-duration SQLite store migrates with nil duration, trusted values survive append and reopen, and negative values leave the prior snapshot unchanged.
- Kept delivery URLs, tokens, storage paths, provider errors, capabilities, bytes, and runtime authority out of persistence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend strict iOS RPC decoding and safe ChatData items** - `9a4533ef` (`feat`)
2. **Task 2: Persist nullable duration in protected Core Data with legacy compatibility** - `dd727f5b` (`feat`)

## Files Created/Modified

- `apps/ios/FishKit/Sources/ChatData/Providers/SharedContentProviding.swift` - Adds safe nullable duration to the provider-neutral item.
- `apps/ios/FishKit/Sources/ChatData/Adapters/SupabaseSharedContentRepository.swift` - Requires and validates the 29th wire field and maps accepted duration into storage.
- `apps/ios/FishKit/Sources/ChatData/Providers/SharedContentCaching.swift` - Adds nullable duration to the safe stored item.
- `apps/ios/FishKit/Sources/ChatData/Adapters/CoreDataSharedContentCache.swift` - Validates, persists, hydrates, and migrates optional duration without changing cache authority.
- `apps/ios/FishKit/Sources/ChatData/Resources/SharedContentCache.xcdatamodeld/SharedContentCache.xcdatamodel/contents` - Adds one optional Integer64 duration attribute.
- `apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift` - Converts the repository RED guard into production nullable/negative duration coverage.
- `apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift` - Converts the cache RED guard into real legacy SQLite migration, append, reopen, and rollback coverage.

## Decisions Made

- A missing `duration_ms` key fails strict decoding, while an explicit JSON null remains valid and honest for legacy content.
- Non-negative validation runs once before repository reconciliation and again before any private-context cache transaction.
- The existing Core Data model remains a single additive model; inferred lightweight migration handles the optional metadata field without a parallel cache or new authority surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced the unconditional repository RED guard with production behavior assertions**

- **Found during:** Task 1 verification
- **Issue:** The Wave 0 RED suite ended with an unconditional `Issue.record`, so implementing the production seam alone could never make the required suite green.
- **Fix:** Kept every strict helper assertion and replaced only the terminal guard with repository-level trusted, null, and negative-duration behavior checks.
- **Files modified:** `apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift`
- **Verification:** All 12 focused repository tests passed.
- **Committed in:** `9a4533ef`

**2. [Rule 3 - Blocking] Replaced the unconditional cache RED guard with real migration and rollback assertions**

- **Found during:** Task 2 verification
- **Issue:** The Core Data Wave 0 suite also ended with an unconditional failure and did not exercise production SQLite migration.
- **Fix:** Replaced the guard with a legacy-model SQLite seed, inferred migration, nil/trusted reopen, append, protection, model-shape, and invalid-value rollback checks.
- **Files modified:** `apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift`
- **Verification:** All 27 combined repository and cache tests passed.
- **Committed in:** `dd727f5b`

**3. [Rule 3 - Blocking] Applied the progress value returned by the GSD state handler**

- **Found during:** Plan closeout
- **Issue:** `state.update-progress` correctly returned 34/41 and 83% but did not persist either visible percentage field in the current STATE format.
- **Fix:** Updated the STATE frontmatter percentage and visible progress bar to the handler's returned 83%.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE now records 34 completed plans and 83% consistently.
- **Committed in:** Plan metadata commit

---

**Total deviations:** 3 auto-fixed (Rule 3 blocking verification/tracking issues).
**Impact on plan:** The RED-contract changes strengthened production evidence and the tracking fix kept GSD state internally consistent; no behavior, dependency, or product scope was expanded.

## Issues Encountered

None.

## TDD Gate Compliance

- RED evidence: `b96ebc57 test(13-03): define iOS duration and gallery model RED contracts`
- GREEN repository: `9a4533ef feat(13-06): extend strict iOS duration decoding`
- GREEN cache: `dd727f5b feat(13-06): persist nullable duration in protected iOS cache`
- REFACTOR: not needed; the production changes stayed limited to the existing repository and cache seams.

## Verification

- Focused repository RED run failed only at the named missing production duration seam before implementation.
- Focused cache RED run failed only at the named missing production Core Data duration seam before implementation.
- `xcodebuild test ... -only-testing:ChatDataTests/CoreDataSharedContentCacheTests -only-testing:ChatDataTests/SharedContentRepositoryTests` — passed all 27 tests.
- `pnpm ios:build` — FishKit package build succeeded.
- `pnpm build` — shared TypeScript packages and the Next.js production build succeeded before both commits.
- Core Data inspection confirmed one optional Integer64 `durationMs` attribute and no delivery/private-authority field.
- `git diff --check` passed; no sending, upload, delivery, web, dashboard, or unrelated app surface changed.

## Authentication Gates

None.

## Known Stubs

None. Nil duration is intentional legacy-data behavior and remains distinguishable from a real zero duration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later iOS gallery plans can consume duration from accepted online and offline safe items without importing Supabase or Core Data types.
- No blocker remains for iOS gallery model, navigation, or presentation integration.

---
*Phase: 13-calm-gallery-browsing*
*Completed: 2026-07-24*

## Self-Check: PASSED

- All seven created or modified implementation/test artifacts and this summary exist.
- Task commits `9a4533ef` and `dd727f5b` exist in git history.
- Focused RED evidence, 27-test GREEN verification, iOS package build, workspace build, model privacy scan, and diff checks completed successfully.
- The eight unrelated `.planning/research/.cache` files remain untracked and untouched.
