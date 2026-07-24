---
phase: 12-cross-platform-data-cache-and-recovery
plan: 02
subsystem: testing
tags: [android, room, repository, cache, offline, paging, privacy]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: Authoritative shared-content ordering, ownership, tombstone, and 40+1 paging contracts
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Canonical Phase 12 cache truth, eviction, recovery, and identity-generation vectors
provides:
  - Android RED migration and DAO contract coverage for owner-scoped Room cache persistence
  - Android RED cache-store coverage for hydration, truthful state, atomic reconciliation, eviction, purge, reopen, and sentinel absence
  - Android RED repository coverage for strict authoritative 40+1 paging, request gates, denial, idempotence, retention, and diagnostics
affects: [12-06 Android Room cache implementation, 12-08 Android repository implementation]

# Tech tracking
tech-stack:
  added: []
  patterns: [instrumented Room contract tests, provider-neutral fake ports, intentional RED production guards]

# Key files
key-files:
  created:
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/RoomSharedContentCacheStoreTest.kt
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentRepositoryTest.kt
    - .planning/phases/12-cross-platform-data-cache-and-recovery/deferred-items.md
  modified:
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/local/ChatDatabaseMigrationTest.kt
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/local/ChatDaoTest.kt

key-decisions:
  - "Keep the Android suites intentionally RED only at absent Phase 12 Room/store/repository production contracts, matching the Phase 12-01 native parity pattern."
  - "Use private provider-neutral fake ports to exercise repository acceptance semantics without importing Room or Supabase types into test contracts."
  - "Treat rows 0–39 as the only retained/rendered page, row 40 as the continuation sentinel, and row 41 as never accessed."

requirements-completed: [PRIV-03, OFF-01, OFF-02]

# Metrics
duration: 17min
completed: 2026-07-23
---

# Phase 12 Plan 02: Android persistence and repository RED coverage

**Owner-scoped Room/cache and authoritative repository tests for truthful offline hydration, atomic reconciliation, bounded eviction, purge, and exact 40+1 paging.**

## Accomplishments

- Extended migration coverage with an 8→9 contract guard, unrelated chat-row preservation, empty cache-table assertions, owner/conversation scope checks, and forbidden authority-column checks.
- Extended DAO coverage with the required owner-scoped read, reconcile, tombstone, prune, and purge method contract names.
- Added deterministic cache-store scenarios for exact-owner hydration, wrong/missing/unresolved owners, stale/incomplete truth, authoritative empty, crash-atomic updates, duplicate-free tombstones, newest-window protection, inactivity eviction, namespace purge, reopen behavior, backup scope, and signed-token sentinel absence.
- Added repository scenarios for `p_limit = 40`, retained indexes 0–39, index 39 cursor derivation, index 40 continuation-only behavior, no index 41 access, strict whole-response rejection, exact owner/generation/request/cursor/replace acceptance, membership denial, idempotent reconciliation, failure retention, and redacted diagnostics.
- Preserved all unrelated `.planning/research/.cache` files and made no production, Supabase migration, route, or UI changes.

## Task Commits

1. `18704c13` — `test(12-02): scaffold Android Room cache contract tests`
2. `b93478a2` — `test(12-02): scaffold Android repository reconciliation tests`

## Verification

- `scripts/android-gradle.sh :data:chat:compileDebugAndroidTestKotlin` — PASS.
- `scripts/android-gradle.sh :data:chat:testDebugUnitTest` — PASS.
- Focused connected Android commands reached Gradle packaging but could not launch because the environment has no connected devices; this is recorded in `deferred-items.md`.
- `pnpm build` remains blocked by the pre-existing `packages/core/src/shared-content/shared-content.test.ts:151` fixture-union TypeScript error, outside Plan 12-02 files; it is recorded in `deferred-items.md` and was not changed.

## Deviations from Plan

### Deferred Issues

**1. Pre-existing workspace build error**

- **Found during:** Overall verification
- **Issue:** The existing Phase 12-01 TypeScript test infers a fixture union whose `cases` property is unavailable at line 151.
- **Action:** Did not modify unrelated portable-contract work; recorded it in `deferred-items.md`.

**2. Connected Android device unavailable**

- **Found during:** Focused instrumented verification
- **Issue:** Gradle reported `No connected devices!` after successful test APK compilation.
- **Action:** Verified compilation and the available JVM Android data suite; recorded the environment limitation.

**Total deviations:** 0 auto-fixed; 2 deferred verification issues. **Impact:** Planned RED test artifacts are committed and compile; device execution and the unrelated workspace build remain for a later environment/owning-plan pass.

## Known Stubs

None. The missing production symbols are intentional RED guards required by the Wave 0 plan, not production placeholders.

## Next Phase Readiness

Plans 12-06 and 12-08 can implement against the committed Android migration/cache-store/repository test contracts. The connected suites should be rerun on an emulator/device after those production contracts are added.

## Self-Check: PASSED

- Summary and deferred-items files exist at the expected phase path.
- Task commits `18704c13` and `b93478a2` are present in git history.
- The unrelated `.planning/research/.cache` files remain untracked and untouched.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*
