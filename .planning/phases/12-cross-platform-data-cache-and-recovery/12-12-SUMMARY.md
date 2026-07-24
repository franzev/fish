---
phase: 12-cross-platform-data-cache-and-recovery
plan: 12
subsystem: ios-shared-content
tags: [ios, swift, privacy, caching, generation-gating, thumbnails]
requires: [12-04, 12-05, 12-11]
provides: [ios-ephemeral-delivery, ios-displayed-thumbnail-store, generation-aware-image-loader]
affects: [12-13, 12-15, phase-13]
tech-stack:
  added: []
  patterns: [actor-isolated-runtime-leases, ephemeral-urlsession, opaque-sha256-cache-keys, owner-generation-gates]
key-files:
  created:
    - apps/ios/FishKit/Sources/ChatData/Adapters/SharedContentDeliveryStore.swift
    - apps/ios/FishKit/Sources/ChatData/Adapters/SharedContentThumbnailStore.swift
  modified:
    - apps/ios/FishKit/Sources/PersonalChat/ViewModels/MessageImageLoader.swift
    - apps/ios/FishKit/Tests/ChatDataTests/SharedContentDeliveryStoreTests.swift
    - apps/ios/FishKit/Tests/ChatDataTests/SharedContentThumbnailStoreTests.swift
    - apps/ios/FishKit/Tests/PersonalChatTests/MessageImageLoaderTests.swift
decisions:
  - Signed delivery URLs remain non-Codable actor-memory leases with 50-ID batching, 120-second freshness, and one authorization refresh.
  - Only explicitly displayed thumbnails cross the protected opaque file boundary; lookahead and selected-full bytes remain ephemeral.
  - Shared image identity includes owner generation and content version, never the rotating signed URL.
metrics:
  duration: 25 minutes
  completed: 2026-07-23
---

# Phase 12 Plan 12: iOS Ephemeral Shared Content Summary

Implemented the iOS half of Wave 4: privacy-preserving delivery leases, displayed-only thumbnail persistence, and owner-generation-aware shared-content image loading.

## What Changed

- Added `SharedContentDeliveryStore`, an actor-scoped ephemeral lease registry keyed by owner, generation, conversation, and attachment. It deduplicates and chunks refreshes at 50 IDs, reuses leases until the 120-second freshness boundary, and permits one 401/403 refresh without durable URL state.
- Added `SharedContentThumbnailStore` under `Library/Caches` with opaque SHA-256 paths, backup exclusion, protected atomic writes, containment checks, owner purge, 64 MiB/30-day pruning, and intent-aware durability. Lookahead and selected-full content do not persist.
- Extended `MessageImageLoader` with `LoadContext`, owner-generation gates around every awaited fetch/decode/persistence/publication boundary, opaque content-version cache identity, ephemeral shared sessions, refresh-once behavior, and generation-addressable cleanup while preserving direct-chat loading.
- Replayed the requested delivery, thumbnail, URL rotation, intent, generation, purge, and sentinel behaviors in the corresponding ChatData and PersonalChat tests.

## TDD Gate Compliance

- RED: `fbd91664` and `9c347d03` add failing delivery/thumbnail and loader contracts.
- GREEN: `2d5d400c` and `d953173f` implement the contracts and pass the focused suites.

## Verification

- `xcodebuild test -scheme FishKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:ChatDataTests/SharedContentDeliveryStoreTests -only-testing:ChatDataTests/SharedContentThumbnailStoreTests -only-testing:PersonalChatTests/MessageImageLoaderTests -quiet` — passed.
- `pnpm ios:build` — passed.
- `pnpm ios:chat-vectors:check` — passed; 3 fixture files current.
- `pnpm lint` — passed.
- `pnpm build` — passed.
- `pnpm typecheck` — passed when run serially after the Next build generated `.next/types`.
- `git diff --check` and the signed-sentinel surface scan — passed.

The plan's `pnpm ios:test -- --only-testing=...` forwarding form was not used for the final focused run because the wrapper forwards the separator/arguments incompatibly; equivalent targets were run directly with `xcodebuild`. Xcode emitted the existing “Supported platforms for the buildables in the current scheme is empty” diagnostic while still completing successfully.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test setup bug] Adjusted thumbnail pruning fixture sizes**
- **Found during:** Task 1 GREEN verification
- **Issue:** The first pruning fixture exceeded the store's per-stage size limit before exercising the account cap.
- **Fix:** Used bounded 8 MiB fixture files so the test reaches the intended 64 MiB account pruning behavior.
- **Files modified:** `SharedContentThumbnailStoreTests.swift`
- **Commit:** `2d5d400c`

**2. [Rule 3 - Blocking compile cleanup] Removed unavailable Xcode file-protection resource API and hardened generation cleanup iteration**
- **Found during:** Task 1/Task 2 GREEN verification
- **Issue:** The current SDK does not expose the attempted URL resource protection key, and generation cleanup must not mutate a set while iterating it.
- **Fix:** Kept protection on the supported atomic write option and filtered identities before subtracting them.
- **Files modified:** `SharedContentThumbnailStore.swift`, `MessageImageLoader.swift`
- **Commits:** `2d5d400c`, `d953173f`

### Environment / Deferred Items

- The transient concurrent workspace typecheck failure was caused by the build regenerating `.next/types`; the required serial rerun passed.
- Existing Xcode destination and unrelated concurrency warnings remain outside this plan's scope.

## Auth Gates

None.

## Known Stubs

None found in the files created or modified by this plan.

## Threat Flags

None. The plan's existing threat model covers the ephemeral URL/session boundary, protected thumbnail files, stale completion rejection, and bounded cache behavior.

## Self-Check: PASSED

- All six planned iOS files exist.
- RED/GREEN task commits `fbd91664`, `2d5d400c`, `9c347d03`, and `d953173f` exist in history.
- The working diff is whitespace-clean and no plan-created stub patterns were found.
