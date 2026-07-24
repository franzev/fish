---
phase: 12-cross-platform-data-cache-and-recovery
plan: 01
subsystem: testing
tags: [shared-content, cache, recovery, parity, android, ios]

requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: TypeScript-owned shared-content corpus, native parity harnesses, and 40+1 paging contract
provides:
  - Executable RED corpus for Phase 12 cache, recovery, delivery-intent, URL non-persistence, and identity-generation behavior
  - Strict Kotlin and Swift parity decoding against synchronized canonical fixture bytes
affects: [12-02 through 12-16, shared-content production contracts]

tech-stack:
  added: []
  patterns: [TypeScript-owned JSON contract, strict native decoding, RED-first production contract tests]

key-files:
  created: []
  modified:
    - packages/core/src/shared-content/fixtures/shared-content-vectors.json
    - packages/core/src/shared-content/shared-content.test.ts
    - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt
    - apps/ios/FishKit/Sources/TestSupport/Fixtures/SharedContentVectors.swift
    - apps/ios/FishKit/Sources/TestSupport/Resources/shared-content-vectors.json
    - apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift

key-decisions:
  - "Keep the canonical fixture at version 3 with 16 ordered groups and exactly 92 literal cases, including all eight Phase 12 groups."
  - "Preserve the 40+1 paging invariant with p_limit 40, retained rows 0-39, and row 40 as a continuation sentinel only."
  - "Keep Phase 12 production exports absent so Node, Kotlin, and Swift suites fail only at intentional RED contract guards."
  - "Synchronize the iOS resource only through pnpm ios:chat-vectors; the copied bytes remain identical to the TypeScript fixture."

requirements-completed: [PRIV-02, PRIV-03, PAGE-03, OFF-01, OFF-02]

duration: 26min
completed: 2026-07-23
---

# Phase 12 Plan 01 Summary

**Canonical 92-case cache, recovery, delivery-intent, URL non-persistence, and identity-generation RED corpus shared by Node, Kotlin, and Swift**

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-23T18:39:00+08:00
- **Completed:** 2026-07-23T19:05:50+08:00
- **Tasks:** 2
- **Files modified:** 6 including the synchronized iOS resource

## Accomplishments

- Added eight Phase 12 fixture groups covering memory-only delivery evidence, bounded 50-ID batching, truthful cache state, two-attempt recovery, and identity-generation rejection.
- Preserved and executable-checked the exact `p_limit = 40` / 40+1 paging contract across portable and native tests.
- Added strict Kotlin and Swift decoders and complete per-case projection-shape checks against the TypeScript-owned bytes without adding production shims.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the failing portable Phase 12 corpus** - `e2977a49` (test)
   - Paging request-bound correction: `0f94a40c` (test)
2. **Task 2: Make Kotlin and Swift fail against the same corpus** - `54584eca` (test)

**Plan metadata:** `6b251c43` (docs: complete plan; superseded by the final metadata correction commit)

## Files Created/Modified

- `packages/core/src/shared-content/fixtures/shared-content-vectors.json` - Version 3 canonical corpus with 92 cases and Phase 12 projections.
- `packages/core/src/shared-content/shared-content.test.ts` - RED Node assertions for missing Phase 12 exports, constants, and behaviors.
- `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt` - Strict Kotlin DTOs and projection checks.
- `apps/ios/FishKit/Sources/TestSupport/Fixtures/SharedContentVectors.swift` - Strict Swift Phase 12 decoding and pagination decoding.
- `apps/ios/FishKit/Sources/TestSupport/Resources/shared-content-vectors.json` - Byte-synchronized iOS fixture resource.
- `apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift` - Swift corpus and intentional production-contract RED guard.

## Verification

- Node: 8 existing Phase 11 tests pass; 4 Phase 12 tests fail only for absent `hydrateSharedContentCache`, cache limits, recovery, and delivery exports.
- Android: focused test compiles and strict replay passes; one intentional RED test fails for the missing production contract.
- iOS: focused suite compiles; three fixture/legacy tests pass and one intentional RED test fails for the missing production contract.
- `pnpm ios:chat-vectors:check` passes and the canonical and iOS resource files are byte-identical.
- Corpus validation confirms 16 groups, 92 cases, and no pagination fixture over 41 rows.
- No production reducer, adapter, route, component, or provider authority was changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected native assertion wiring and complete projection checks**
- **Found during:** Task 2 native verification
- **Issue:** Initial Kotlin assertion argument ordering prevented compilation, and the first native projection guard grouped fields across cases instead of checking each canonical case shape.
- **Fix:** Corrected JUnit assertion signatures and switched Kotlin/Swift checks to exact per-case expected-key sets.
- **Files modified:** Android parity test and Swift contract test
- **Verification:** Android and Swift strict replay pass before their intentional RED guards.
- **Committed in:** `54584eca`

**2. [Rule 3 - Blocking] Used the direct xcodebuild equivalent for focused Swift verification**
- **Found during:** Task 2 verification
- **Issue:** The plan's `pnpm ios:test -- --only-testing:...` wrapper forwarded the selector as an unsupported xcodebuild action.
- **Fix:** Ran `xcodebuild test ... -only-testing:ChatCoreTests/SharedContentContractTests` directly from `apps/ios/FishKit`.
- **Verification:** The focused Swift suite compiled and reached only the intentional RED contract failure.
- **Committed in:** `54584eca`

**Total deviations:** 2 auto-fixed (Rule 1: 1, Rule 3: 1)
**Impact on plan:** No scope expansion; both fixes ensured the planned native RED evidence was test/fixture-shape clean.

## Issues Encountered

The wrapper-specific iOS selector invocation was incompatible with the repository script; the direct equivalent provided the required verification. Existing `.planning/research/.cache` files were preserved and not staged.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The failing production-contract guards are intentional RED tests, not production implementations or placeholder behavior.

## Next Phase Readiness

Phase 12 production plans can now implement against one executable cross-platform contract. The suites will turn green only when the named cache, recovery, delivery, and identity-generation exports satisfy the canonical projections.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- Task commits `e2977a49` and `54584eca` are present in git history.
- The unrelated `.planning/research/.cache` files remain untracked and untouched.
