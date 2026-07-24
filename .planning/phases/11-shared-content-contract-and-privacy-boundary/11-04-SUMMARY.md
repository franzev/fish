---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 04
subsystem: native-parity
tags: [android, ios, kotlin, swift, shared-content, fixtures, privacy]
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    plan: 03
    provides: Canonical shared-content contract and 54-case fixture corpus
provides:
  - Portable Android and iOS shared-content classification, ordering, pagination, permissions, and reducer contracts
  - Native parity tests replaying the canonical TypeScript fixture corpus
  - Automated iOS fixture-copy byte-drift verification
affects: [phase-12-cache-and-recovery, phase-13-gallery-browsing, phase-14-preview-actions]
tech-stack:
  added: []
  patterns: [pure native reducers, canonical JSON replay, byte-identical fixture synchronization]
key-files:
  created:
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt
    - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt
    - apps/ios/FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift
    - apps/ios/FishKit/Sources/TestSupport/Fixtures/SharedContentVectors.swift
    - apps/ios/FishKit/Sources/TestSupport/Resources/shared-content-vectors.json
    - apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift
  modified:
    - apps/android/feature/chat/build.gradle.kts
    - scripts/sync-ios-chat-vectors.mjs
decisions:
  - Native implementations replay the TypeScript-owned JSON corpus rather than maintaining platform-specific expected values.
  - Native reducers remain pure and preserve the canonical server ordering, pagination, identity purge, and deletion fan-out semantics.
  - GIF and sticker export remains explicitly rights-gated in both platform contracts.
metrics:
  duration: 20m
  completed: 2026-07-22
  tasks: 2
  files: 8
---

# Phase 11 Plan 04: Native Shared-Content Parity Summary

**Kotlin and Swift shared-content reducers replay the same 54-case TypeScript corpus with byte-governed fixtures and identity-safe deletion semantics.**

## Accomplishments

- Ported the shared-content data model, classification, deterministic ordering, pagination, permissions, gallery state, identity purge, and deletion fan-out reducer to Android.
- Ported the same contract to the Foundation-only iOS ChatCore target without UI, persistence, provider, or network dependencies.
- Added native tests that replay the canonical corpus, including the 38 Task 1 cases and the privacy-sensitive state transitions.
- Wired Android tests directly to the canonical fixture directory and added the iOS fixture copy to the existing sync script.
- Added byte-identical iOS fixture drift checks through `pnpm ios:chat-vectors:check`.

## Task Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 RED | `0032d18f` | Add failing Android shared-content parity test |
| 1 GREEN | `fa09135a` | Port shared-content contract to Android |
| 2 RED | `da5f53f0` | Add failing iOS shared-content parity test and fixture sync entry |
| 2 GREEN | `0432fb77` | Port shared-content contract to iOS |
| 2 follow-up | `072e4696` | Correct Swift parity projection assertions |

## Verification

- `node --experimental-strip-types --test packages/core/src/shared-content/shared-content.test.ts` — passed.
- Android focused parity test — passed.
- `pnpm android:assemble` — passed.
- `pnpm build` — passed.
- `pnpm ios:chat-vectors:check` — passed; all three fixture files are current.
- Full `pnpm ios:test` — passed, including `SharedContentContractTests`.
- Focused iOS simulator `xcodebuild` run for `SharedContentContractTests` — passed.
- `swiftc -typecheck` for the Foundation-only iOS contract — passed.
- Canonical TypeScript and iOS fixture files compare byte-for-byte.

The prescribed host-side `(cd apps/ios/FishKit && swift test --filter SharedContentContractTests)` command remains unavailable on this macOS package target because an existing DesignSystem source imports UIKit. The equivalent iOS simulator test target and full `pnpm ios:test` suite pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Normalized Android URI scheme checks**

- **Found during:** Task 1 focused parity verification
- **Issue:** Java `URI.scheme` returns `http`/`https` without the colon used by the TypeScript URL representation.
- **Fix:** Compared the parsed scheme against the normalized values `http` and `https`.
- **Files modified:** `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt`
- **Commit:** `fa09135a`

**2. [Rule 1 - Bug] Parenthesized Swift fixture projections**

- **Found during:** iOS simulator verification
- **Issue:** Swift operator precedence made the optional and collection projection assertions fail to compile in the test target.
- **Fix:** Parenthesized each expected-value comparison before comparing it with the projected state.
- **Files modified:** `apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift`
- **Commit:** `072e4696`

No architectural changes, package installs, authentication gates, or unrelated-file fixes were required.

## TDD Gate Compliance

- Android RED commit present: `0032d18f`.
- Android GREEN commit present: `fa09135a`.
- iOS RED commit present: `da5f53f0`.
- iOS GREEN commit present: `0432fb77`.

## Known Stubs

None. The native contracts consume real canonical fixture data and do not introduce placeholder state.

## Readiness

PAR-01 is implemented across TypeScript, Android, and iOS. The shared contract is ready for downstream cache, gallery, and preview work.

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- All five task commits are present in git history.
