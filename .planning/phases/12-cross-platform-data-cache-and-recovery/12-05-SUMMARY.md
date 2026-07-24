---
phase: 12-cross-platform-data-cache-and-recovery
plan: 05
subsystem: cross-platform shared-content contract
tags: [cache, recovery, delivery, identity-generation, typescript, android, ios]
requires:
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Wave 0 canonical RED corpus with 92 ordered contract cases
provides:
  - Portable cache limits, safe snapshot schema, recovery state machine, delivery planning, and identity-generation contracts
  - Strict TypeScript, Kotlin, and Swift parity implementations against the canonical fixture
affects: [12-06, 12-07, 12-09, 12-10, 12-11, 12-12, 12-13, 12-14, 12-15]
tech-stack:
  added: []
  patterns: [provider-neutral pure functions, canonical JSON replay, owner-and-generation gating, URL-free durable snapshots]
key-files:
  created: []
  modified:
    - packages/core/src/shared-content/types.ts
    - packages/core/src/shared-content/state.ts
    - packages/core/src/shared-content/shared-content.test.ts
    - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt
    - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt
    - apps/ios/FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift
    - apps/ios/FishKit/Sources/TestSupport/Fixtures/SharedContentVectors.swift
    - apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift
decisions:
  - Keep the existing version-3 fixture and its exact 16-group, 92-case ordering as the cross-platform boundary.
  - Durable cache snapshots carry only owner-scoped metadata and cache truth; delivery URLs, tokens, temporary references, filesystem paths, and UI/request state are excluded.
  - Identity generation is mandatory on production events and gates every callback; identity changes accept only strictly newer generations and purge prior state.
metrics:
  duration: approximately 45 minutes
  completed: 2026-07-23
---

# Phase 12 Plan 5: Portable cache, recovery, delivery, and identity contract summary

One provider-neutral contract now defines the bounded shared-content cache, truthful offline/recovery presentation, intent-prioritized delivery batching, durable-data redaction boundary, and owner-plus-generation callback safety for Android and iOS.

## Accomplishments

- Added the shared TypeScript contract and reducer support for cache hydration, truth projection, eviction limits, recovery retries, delivery batches, URL redaction, and identity generation.
- Mirrored the contract in Android Kotlin with strict fixture replay and no Android, Room, Supabase, or UI coupling.
- Mirrored the contract in Swift with strict fixture decoding and parity replay; the iOS vector resource remains synchronized with the canonical fixture.
- Kept the durable snapshot surface free of delivery URLs/tokens, temporary references, pending/error state, preview bytes, capabilities, and filesystem paths.

## Task Commits

1. `cd0c906b` — `feat(12-05): establish portable cache and recovery contract`
2. `922e9c7d` — `feat(12-05): mirror cache recovery contract in Kotlin`
3. `1cc950cd` — `fix(12-05): cover eviction vectors in TypeScript parity`
4. `75a7fc91` — `feat(12-05): mirror cache recovery contract in Swift`

## Verification

- `node --test packages/core/src/shared-content/shared-content.test.ts` — 13 passed.
- `pnpm --filter @fish/core typecheck` — passed.
- `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests 'space.fishhub.android.feature.chat.sharedcontent.SharedContentParityTest'` — passed.
- `pnpm ios:chat-vectors && pnpm ios:chat-vectors:check` — synchronized and up to date.
- `xcodebuild test -scheme FishKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:ChatCoreTests/SharedContentContractTests` — passed.

## TDD Gate Compliance

The Wave 0 RED corpus established the failing contract boundary before this plan. The implementation commits above provide the GREEN parity surfaces for all three platforms; the canonical fixture remains unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Missing parity coverage] Added the TypeScript eviction replay assertion.**

- **Found during:** Task 1 verification
- **Issue:** The TypeScript suite implemented eviction projections but did not yet exercise the three eviction vectors.
- **Fix:** Added the eviction corpus replay and committed it separately.
- **Files modified:** `packages/core/src/shared-content/state.ts`, `packages/core/src/shared-content/shared-content.test.ts`
- **Commit:** `1cc950cd`

**2. [Rule 1 - Cross-runtime numeric decoding] Accepted JSON numbers represented as Swift `Double` in the Foundation parity bridge.**

- **Found during:** Task 3 iOS test execution
- **Issue:** Foundation conversion exposed fixture integers as `Double`, causing recovery and identity projections to fail at runtime.
- **Fix:** Added lossless integer conversion for Swift dictionary inputs and reran the targeted iOS suite.
- **Files modified:** `apps/ios/FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift`
- **Commit:** `75a7fc91`

## Known Stubs

None.

## Threat Flags

None. No network endpoint, authentication path, file-access path, or schema migration was introduced.

## Deferred Issues

None related to this plan. Eight unrelated untracked `.planning/research/.cache` files were preserved untouched.

## Self-Check: PASSED

- Summary file exists at the required phase path.
- Task commits `cd0c906b`, `922e9c7d`, `1cc950cd`, and `75a7fc91` exist in git history.
- No tracked files were deleted by the task commits.
