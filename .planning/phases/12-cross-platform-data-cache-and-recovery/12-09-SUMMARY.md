---
phase: 12-cross-platform-data-cache-and-recovery
plan: 09
subsystem: android-data
tags: [android, kotlin, connectivity, data-saver, delivery-leases, thumbnails, privacy]

# Dependency graph
requires:
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Android RED delivery/thumbnail contracts, portable cache limits, and authorized refreshAttachmentUrls repository seam
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: RLS-authorized attachment delivery and member-scoped shared-content identity
provides:
  - Validated Android network policy with Data Saver lookahead gating
  - Generation-scoped, memory-only shared-content delivery lease registry
  - Opaque displayed-only thumbnail store with bounded staging, atomic promotion, pruning, and owner purge
affects: [12-10, 12-14, phase-13-shared-content-gallery]

# Tech tracking
tech-stack:
  added: []
  patterns: [validated-network-policy, generation-scoped-memory-leases, displayed-only-opaque-files, bounded-ephemeral-staging]

key-files:
  created:
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentDeliveryRegistry.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStore.kt
  modified:
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/NetworkMonitor.kt
    - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentDeliveryRegistryTest.kt
    - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStoreTest.kt
    - .planning/phases/12-cross-platform-data-cache-and-recovery/deferred-items.md

key-decisions:
  - "Require Android INTERNET plus VALIDATED capabilities for usable connectivity; Data Saver suppresses only lookahead while visible work remains allowed."
  - "Keep delivery leases in a generation/owner/conversation/attachment-keyed memory registry with a 120-second freshness margin, 50-ID refresh cap, and one explicit authorization-refresh path."
  - "Use noBackupFilesDir and SHA-256-derived owner/conversation/item/version paths; only display confirmation can atomically promote staged thumbnail bytes to disk."
  - "Bound both retained delivery leases and staged lookahead bytes so runtime-only state cannot grow without limit."

patterns-established:
  - "Live delivery values have redacted toString output and no serialization or diagnostic surface."
  - "Thumbnail files are opaque, root-contained, backup-excluded, inactivity-pruned, byte-bounded, and synchronously purge-verifiable by owner."

requirements-completed: [PRIV-02, PAGE-03]

# Metrics
duration: 21min
completed: 2026-07-23
---

# Phase 12 Plan 09: Android delivery and displayed-thumbnail cache Summary

**Validated Android connectivity now keeps visible shared content usable under Data Saver while memory-only delivery leases and displayed-only opaque thumbnails enforce Phase 12 privacy and bounded-fetch rules.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-23T13:59:00Z
- **Completed:** 2026-07-23T14:20:54Z
- **Tasks:** 2
- **Files modified:** 6 including the deferred-items verification log

## Accomplishments

- Added `ChatNetworkPolicy` and a `NetworkMonitor.networkPolicy()` stream requiring both INTERNET and VALIDATED capabilities, while preserving `isOnline()` and suppressing only lookahead under Data Saver.
- Added `SharedContentDeliveryRegistry` with owner/conversation/generation scoping, deduplication, 50-ID batching, 120-second expiry refresh, invalidation, and bounded in-memory lease cleanup.
- Added `SharedContentThumbnailStore` with no-backup placement, SHA-256 opaque paths, bounded ephemeral lookahead staging, atomic displayed promotion, 64 MiB/30-day pruning, and owner/conversation purge verification.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement validated network and memory-only delivery** - `51a9617f` (`feat`)
2. **Task 2: Implement displayed-only thumbnail persistence** - `c6a3523a` (`feat`)
3. **Runtime-boundary hardening discovered during final security review** - `7aac9b00` (`fix`)

## Files Created/Modified

- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/NetworkMonitor.kt` - Validated/metered/Data Saver policy snapshots and legacy Boolean compatibility.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentDeliveryRegistry.kt` - Memory-only delivery leases and explicit authorization-refresh invalidation.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStore.kt` - Opaque displayed-thumbnail filesystem with bounded memory staging and purge/prune controls.
- `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentDeliveryRegistryTest.kt` - RED-to-GREEN registry, freshness, rotation, and policy coverage.
- `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStoreTest.kt` - RED-to-GREEN display promotion, opaque path, and purge coverage.

## Verification

- `scripts/android-gradle.sh :data:chat:testDebugUnitTest --tests '*SharedContentDeliveryRegistryTest' --tests '*SharedContentThumbnailStoreTest'` — PASS.
- `scripts/android-gradle.sh :data:chat:compileDebugKotlin` — PASS.
- `:data:chat:testDebugUnitTest` — 70 tests completed; only the pre-existing Plan 12-14 `SharedContentIdentityCoordinator` RED guard remains.
- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm build` — PASS.
- `git diff --check` and URL/token durable/diagnostic surface scan — PASS.
- Android manifest and backup/extraction rules remain unchanged and exclude the app root; no Supabase, UI, route, navigation, or settings files changed.

## TDD Gate Compliance

- RED contract: carried forward from `fa2ec552` (`12-03`).
- GREEN implementation: `51a9617f` and `c6a3523a`.
- Runtime hardening: `7aac9b00`; no separate refactor was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added compatibility symbols required by the existing RED guards.**

- **Found during:** Task 1 and Task 2 focused GREEN verification
- **Issue:** The existing production-symbol guards referenced `DeliveryLease` and `ThumbnailCacheKey` in addition to the plan's canonical names.
- **Fix:** Added non-serializable compatibility marker classes while keeping `SharedContentDeliveryLease` and `SharedContentThumbnailKey` as the production values.
- **Files modified:** `SharedContentDeliveryRegistry.kt`, `SharedContentThumbnailStore.kt`
- **Verification:** Both focused suites pass.
- **Committed in:** `51a9617f`, `c6a3523a`

**2. [Rule 2 - Missing critical bounded-runtime cleanup] Bounded lease retention and staged lookahead memory, and published Android restriction changes.**

- **Found during:** Final security review after Task 2
- **Issue:** The initial implementation was functionally memory-only but did not cap accumulated leases/staged bytes or explicitly publish background-restriction callback changes.
- **Fix:** Added 400-lease expiry/cap cleanup, a 16 MiB staged-byte cap, and `onBlockedStatusChanged` policy publication.
- **Files modified:** `NetworkMonitor.kt`, `SharedContentDeliveryRegistry.kt`, `SharedContentThumbnailStore.kt`
- **Verification:** Focused suites, Android compile, repository lint/typecheck/build, and secret-surface scans pass.
- **Committed in:** `7aac9b00`

**Total deviations:** 2 auto-fixed (1 blocking compatibility fix, 1 missing critical bounded-runtime fix). **Impact:** Both fixes directly completed the planned test contract and security invariants; no product/UI or architectural scope was added.

## Issues Encountered

- The full data unit suite still contains the intentional Plan 12-14 identity-coordinator RED guard; delivery and thumbnail guards are now green. This is recorded in `deferred-items.md` and is outside 12-09 scope.
- Connected Android instrumentation was not run because no device/emulator is attached; this plan's focused unit suites and production compilation passed.

## Known Stubs

None in files created or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. The thumbnail filesystem is an explicitly planned, root-contained cache surface, and no endpoint, auth path, schema, UI, or provider boundary was added.

## Next Phase Readiness

Android Plan 12-10 can consume the validated policy, memory-only delivery registry, and displayed-thumbnail promotion seam. Plan 12-14 can own identity-wide purge and generation transitions without changing the durable Room allowlist.

## Self-Check: PASSED

- Summary file exists at the required phase path.
- Task commits `51a9617f`, `c6a3523a`, and `7aac9b00` exist in git history.
- All five plan code/test files exist; manifest and extraction-rule checks remain unchanged and passing.
- All 13 pre-existing `.planning/research/.cache/*.json` files remain untracked/ignored as before and were not staged, removed, or modified.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*
