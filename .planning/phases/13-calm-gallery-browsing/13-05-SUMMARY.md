---
phase: 13-calm-gallery-browsing
plan: "05"
subsystem: android-shared-content-data
tags: [android, kotlin, room, supabase, shared-content, duration, privacy]

# Dependency graph
requires:
  - phase: 13-calm-gallery-browsing
    plan: "02"
    provides: Android strict 29-field repository and Room 9-to-10 RED contracts
  - phase: 13-calm-gallery-browsing
    plan: "04"
    provides: Trusted nullable duration in the authorized shared-content RPC
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Owner-scoped Android repository, bounded Room cache, and request acceptance gates
provides:
  - Strict Android decoding and provider-neutral mapping for nullable non-negative duration
  - Room schema version 10 with a preserving nullable-duration migration
  - Owner/conversation-scoped offline duration metadata with legacy-null compatibility
affects: [13-07, 13-09, android-shared-content-gallery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Required nullable wire field with non-negative whole-page validation before cache mutation
    - Additive Room migration with no default and safe metadata-only cache mapping

key-files:
  created:
    - apps/android/data/chat/schemas/space.fishhub.android.data.chat.local.ChatDatabase/10.json
  modified:
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatRepository.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/SupabaseDtos.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/SupabaseChatRemoteDataSource.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatEntities.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDatabase.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/RoomSharedContentCacheStore.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt

key-decisions:
  - "Require duration_ms to be present in every strict Android RPC row while accepting an explicit null for legacy content."
  - "Add duration_ms to Room as nullable with no zero default so migrated legacy rows remain honestly unavailable."
  - "Validate duration at both repository acceptance and cache-store mutation boundaries before durable state can change."

patterns-established:
  - "Nullable duration follows RPC DTO → provider-neutral item → accepted repository page → safe stored item → Room entity."
  - "Room forward migrations add metadata without changing compound keys, foreign keys, pruning, tombstones, purge, or delivery authority."

requirements-completed: [DISC-02]

# Metrics
duration: 8 min
completed: 2026-07-24
---

# Phase 13 Plan 05: Android Trusted Duration and Room v10 Summary

**Android now carries trusted nullable voice duration through strict authorized rows and the owner-scoped Room cache without changing paging, delivery, or authorization boundaries.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-24T02:42:21Z
- **Completed:** 2026-07-24T02:50:19Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Extended the strict Android shared-content row from 28 to 29 fields and required `duration_ms` while preserving explicit null for legacy rows.
- Rejected negative duration during remote whole-page validation and again during repository acceptance before any Room transaction.
- Advanced Room from version 9 to 10 with one nullable integer column and no fabricated zero default.
- Preserved owner/conversation compound keys, 40+1 paging, request/cursor/replace gates, bounded pruning, tombstones, purge behavior, and memory-only delivery leases.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend strict Android RPC decoding and accepted repository items** - `8c07c828` (`feat`)
2. **Task 2: Add Room v10 nullable-duration persistence and legacy migration** - `cba9ccbd` (`feat`)

## Files Created/Modified

- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatRepository.kt` - Adds nullable duration to the provider-neutral accepted item.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/SupabaseDtos.kt` - Requires the 29th `duration_ms` wire field.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/SupabaseChatRemoteDataSource.kt` - Maps and validates duration before page acceptance.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt` - Revalidates accepted duration and maps it into the safe stored projection.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatEntities.kt` - Adds nullable duration to the shared-content Room item.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDatabase.kt` - Advances the database to version 10 and defines `MIGRATION_9_10`.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/RoomSharedContentCacheStore.kt` - Validates and maps duration on save and hydrate.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt` - Registers the forward migration in production composition.
- `apps/android/data/chat/schemas/space.fishhub.android.data.chat.local.ChatDatabase/10.json` - Canonical Room v10 schema.

## Decisions Made

- The nullable wire property has no Kotlin default, so a missing 29th field fails decoding while an explicit SQL null remains valid.
- The Room migration uses `ALTER TABLE ... ADD COLUMN duration_ms INTEGER` without a default, preserving legacy rows as null.
- Duration is display-safe metadata only; storage paths, signed URLs, tokens, capabilities, bytes, and runtime state were not added to the shared-content cache schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Started the configured Android emulator for connected verification**

- **Found during:** Task 1 RED verification
- **Issue:** The focused instrumentation command packaged successfully but reported no connected device.
- **Fix:** Started the existing `Pixel_10_Pro_XL` AVD and waited for Android to report a completed boot.
- **Files modified:** None
- **Verification:** All 37 combined repository, migration, and cache instrumentation tests passed.
- **Committed in:** N/A

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking environment issue).
**Impact on plan:** Verification environment only; production scope and behavior were unchanged.

## Issues Encountered

- Room generated schema 10 during the first post-change compile, after Android test assets had already been packaged. Re-running the focused connected suite packaged the generated schema and passed the migration validation.

## Verification

- Repository RED evidence failed only at the missing `SharedContentRowDto.durationMs` and `SharedContentDataItem.durationMs` symbols before implementation.
- Room RED evidence failed only at database version 9 and missing `MIGRATION_9_10` before implementation.
- Combined repository, migration, and Room cache instrumentation: 37/37 passing on `Pixel_10_Pro_XL`.
- `scripts/android-gradle.sh :data:chat:testDebugUnitTest`: passing.
- `pnpm build`: passing before both production commits.
- Room schema 10 inspection: `duration_ms` is nullable with no default, and shared-content cache tables contain no delivery URL, token, capability, or runtime-authority column.
- `git diff --check`: passing.

## Authentication Gates

None.

## Known Stubs

None. Null duration is intentional legacy-data behavior and will render as the approved `Duration unavailable` fallback at the presenter boundary.

## Threat Flags

None. The strict wire change and additive cache metadata column are the trust-boundary changes explicitly covered by the plan threat model.

## Next Phase Readiness

- Plan 13-07 can consume nullable duration from accepted Android items and cache snapshots without reaching into Supabase or Room types.
- No blocker remains for Android gallery presenter integration.

## Self-Check: PASSED

- All nine created or modified production artifacts exist.
- Task commits `8c07c828` and `cba9ccbd` exist in git history.
- Overall repository, migration, cache, JVM, schema privacy, and production build verification passed.
- The eight unrelated `.planning/research/.cache` files remain untracked and untouched.

---
*Phase: 13-calm-gallery-browsing*
*Completed: 2026-07-24*
