---
phase: 12-cross-platform-data-cache-and-recovery
plan: 06
subsystem: database
tags: [android, room, cache, offline, paging, privacy, migration]

# Dependency graph
requires:
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Android RED Room/cache contracts and the provider-neutral cache snapshot, paging, eviction, and identity rules from Plans 12-02 and 12-05
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: Safe shared-content metadata, canonical ordering, tombstone semantics, and 40+1 paging boundary
provides:
  - Android Room schema version 9 with owner/conversation-scoped shared-content cache entities
  - Forward-only 8→9 migration preserving all existing chat data and excluding delivery authority fields
  - Transactional cache-store hydration, accepted-page reconciliation, tombstone application, bounded pruning, and owner purge
affects: [12-08, 12-09, 12-10, 12-14, android-shared-content]

# Tech tracking
tech-stack:
  added: []
  patterns: [compound owner/conversation Room keys, safe metadata allowlist, transactional page-first eviction, provider-neutral cache store]

key-files:
  created:
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/RoomSharedContentCacheStore.kt
    - apps/android/data/chat/schemas/space.fishhub.android.data.chat.local.ChatDatabase/9.json
  modified:
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatEntities.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDatabase.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDao.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/local/ChatDatabaseMigrationTest.kt
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/local/ChatDaoTest.kt
    - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/RoomSharedContentCacheStoreTest.kt
    - .planning/phases/12-cross-platform-data-cache-and-recovery/deferred-items.md

key-decisions:
  - "Durable Room rows use compound owner/conversation identity and persist only safe metadata plus retained-history truth; delivery URLs, tokens, runtime references, errors, bytes, and action authority are absent."
  - "The newest page is protected to 40 items, while older explicitly browsed pages are evicted by inactivity and oldest-page order before protected newest metadata."
  - "Cache mutations enter Room through transaction methods that validate the whole owner/conversation batch before changing rows or boundaries."
  - "The application database builder registers MIGRATION_8_9 so upgraded installs cannot fall into destructive or missing-migration behavior."

patterns-established:
  - "RoomSharedContentCacheStore maps provider-neutral safe items to Room entities without importing feature or Supabase types."
  - "Hydration requires a nonblank verified owner and exact conversation; cache rows never grant authorization."
  - "Owner purge is a blocking primitive with a zero-row verification probe."

requirements-completed: [PRIV-03, OFF-01]

# Metrics
duration: 15min
completed: 2026-07-23
---

# Phase 12 Plan 6: Android bounded Room cache summary

**Android Room v9 now provides a private, bounded shared-content metadata cache with verified-owner hydration, retained-history truth, atomic reconciliation, and deterministic purge/eviction.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-23T12:29:18Z
- **Completed:** 2026-07-23T12:44:06Z
- **Tasks:** 2
- **Files modified:** 10 plus generated schema

## Accomplishments

- Added `SharedContentCacheOwnerEntity`, `SharedContentCachePageEntity`, and `SharedContentCacheItemEntity` with compound owner/conversation scope and no delivery or runtime-authority columns.
- Added `MIGRATION_8_9`, generated and committed Room schema 9, expanded migration evidence for unrelated chat rows, and registered the migration in the production database builder.
- Added DAO transaction methods and `RoomSharedContentCacheStore` for exact-owner hydration, newest-window replacement, browsed-page append, tombstones, 400/2,000 bounds, 30-day inactivity cleanup, and owner/conversation purge.
- Added direct Room DAO/store instrumentation coverage for namespace isolation, tombstones, pruning, and purge, while preserving the unrelated research cache files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the owner-scoped Room schema and 8→9 migration** - `191a8460` (`feat`)
2. **Task 2: Implement transactional hydration, reconciliation, eviction, and purge** - `df39bb13` (`feat`)

## Verification

- `scripts/android-gradle.sh :data:chat:compileDebugAndroidTestKotlin` — PASS.
- `pnpm build` — PASS.
- Schema 9 inspection — PASS: 10 total entities, 3 shared-content cache tables, zero forbidden authority columns.
- Backup checks — PASS: `android:allowBackup="false"` remains present and both extraction-rule files exclude the app root.
- Supabase migration diff — PASS: no Supabase migrations changed.
- Focused connected Android migration/cache/DAO execution — deferred because the environment reports `No connected devices!` after successful packaging.
- Full `:data:chat:testDebugUnitTest` — deferred with three pre-existing intentional RED guards owned by later Phase 12 plans (`SharedContentDeliveryRegistry`, `SharedContentThumbnailStore`, and `SharedContentIdentityCoordinator`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical migration registration] Registered the new Room migration in the app database builder.**

- **Found during:** Task 1/Task 2 integration review
- **Issue:** `ChatDataModule` registered migrations only through 7→8; a production upgrade to Room version 9 would not discover `MIGRATION_8_9`.
- **Fix:** Added the import and `.addMigrations(MIGRATION_8_9)` entry.
- **Files modified:** `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt`
- **Verification:** Android production and test Kotlin compilation passed.
- **Committed in:** `df39bb13`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required for safe production upgrades; no scope expansion.

## Issues Encountered

- No Android emulator/device was connected, so instrumentation tests could be compiled and packaged but not executed.
- Later-plan RED guards fail in the full JVM suite as expected; those production contracts were intentionally out of scope for Plan 12-06 and are recorded in `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None in files created or modified by this plan. Nullable entity fields are intentional safe-metadata omissions, not placeholder UI/data sources.

## Next Phase Readiness

Android Plan 12-08 can consume the provider-neutral cache store behind repository recovery. Plans 12-09/12-10 can add delivery behavior without changing the durable Room allowlist. Rerun migration and cache instrumentation on an attached Android emulator/device before release evidence is recorded.

## Self-Check: PASSED

- Summary file is present at the required phase path.
- Task commits `191a8460` and `df39bb13` exist in git history.
- Generated schema 9 exists and contains all existing entities plus exactly the three cache entities.
- All eight unrelated `.planning/research/.cache` files remain untracked and untouched.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*
