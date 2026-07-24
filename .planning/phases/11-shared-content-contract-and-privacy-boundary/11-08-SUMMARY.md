---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 08
subsystem: core-contract
tags: [typescript, shared-content, pagination, reducer, privacy, parity-fixtures]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: portable shared-content types, deterministic paging, tombstone-wins reducer, and canonical fixture corpus
provides:
  - conversation-owned shared-content payload validation
  - opaque request-sequenced page completion contract
  - strict complete-state canonical vectors for native replay
affects: [phase-11-native-parity, phase-12-cache-and-recovery, phase-13-gallery-browsing]

# Tech tracking
tech-stack:
  added: []
  patterns: [opaque request tokens with exact cursor/mode matching, whole-event payload ownership validation, complete JSON state projections]

key-files:
  created: []
  modified:
    - packages/core/src/shared-content/types.ts
    - packages/core/src/shared-content/state.ts
    - packages/core/src/shared-content/shared-content.test.ts
    - packages/core/src/shared-content/fixtures/shared-content-vectors.json

key-decisions:
  - "A request completion is accepted once only when its opaque ID, exact four-field cursor, and replace/append mode match the pending request."
  - "Conversation ownership is validated for every page and realtime item before any state mutation; mixed pages are rejected whole."
  - "Tombstones filter both visible items and retained page rows while preserving the server-provided continuation cursor."

patterns-established:
  - "Portable reducers copy pending cursors and return the original state object for stale or mismatched events."
  - "Canonical fixture replay uses throwing item lookup and exhaustive complete state projections."

requirements-completed: [PAGE-01, PAGE-02, PAR-01]

# Metrics
duration: 13min
completed: 2026-07-22
---

# Phase 11 Plan 08: Shared-content contract and privacy boundary Summary

**Conversation-owned shared-content state with opaque request sequencing, strict mixed-payload rejection, and complete canonical replay vectors.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-22T15:10:00Z
- **Completed:** 2026-07-22T15:22:59Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Added `SharedContentPageRequest`, `pendingPageRequest`, and `requestStarted`; initial/page completions now carry request IDs and exact requested cursors.
- Rejected cross-conversation page and realtime payloads as whole-event no-ops, and blocked stale, duplicate, wrong-cursor, and wrong-mode completions from changing continuation state.
- Expanded the canonical corpus to version 2 with explicit ownership, request sequencing, tombstone race, identity purge, terminal-page, and complete state-projection cases.
- Preserved server order and the row-40 cursor contract while filtering tombstones and stable-ID duplicates without client sorting.

## Task Commits

Each task was committed atomically with the required TDD RED/GREEN commits:

1. **Task 1 RED: Add strict shared-content sequencing vectors** - `8afa7f09` (test)
2. **Task 1 GREEN: Sequence shared-content page completions** - `e3afe1ce` (feat)

## Files Created/Modified

- `packages/core/src/shared-content/types.ts` - Public request-token, pending-request, and completion event contract.
- `packages/core/src/shared-content/state.ts` - Conversation-owned, request-sequenced reducer with tombstone-safe page retention.
- `packages/core/src/shared-content/shared-content.test.ts` - Throwing fixture materialization and exhaustive complete-state replay assertions.
- `packages/core/src/shared-content/fixtures/shared-content-vectors.json` - Version 2 canonical corpus with 64 total cases and 10 request-sequencing cases.

## Verification

- `node --experimental-strip-types --test packages/core/src/shared-content/shared-content.test.ts` - passed, 7 tests.
- `pnpm --filter @fish/core typecheck` - passed.
- `pnpm --filter @fish/web test run tests/module-boundaries.test.ts` - passed, 10 tests.
- `pnpm build` - passed for core, Supabase, and Next.js web.
- `git diff --check` - passed.

## TDD Gate Compliance

- RED gate committed as `8afa7f09`; the focused sequencing suite failed on the pre-existing reducer because `requestStarted` was unhandled.
- GREEN gate committed as `e3afe1ce`; the focused suite, typecheck, boundary test, and build passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Purged tombstoned rows from retained pages**

- **Found during:** Task 1 strict complete-state projection review
- **Issue:** Source deletion removed visible items but left deleted source rows in cached page projections.
- **Fix:** Filter deleted source-message siblings from every retained page while preserving the page continuation cursor.
- **Files modified:** `packages/core/src/shared-content/state.ts`, `packages/core/src/shared-content/fixtures/shared-content-vectors.json`
- **Verification:** Complete deletion and tombstone-race vectors pass; core typecheck, boundary test, and build pass.
- **Committed in:** `e3afe1ce`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing critical privacy invariant)
**Impact on plan:** The fix closes the same tombstone-wins privacy boundary and introduces no new API, dependency, or architectural surface.

## Issues Encountered

- `gsd-tools` was unavailable on `PATH` and no bundled CLI shim was present in the discovered locations. The required STATE/ROADMAP updates will be applied manually using the documented field changes.
- The first full build overlapped with a still-running Next.js build and hit the build lock; the existing build completed successfully, and a clean rerun passed.

## Known Stubs

None found in the files created or modified by this plan.

## Threat Surface Review

No new network endpoint, auth path, file-access path, or schema trust boundary was introduced. The reducer checks are defense in depth; server authorization remains the trusted boundary from the preceding Phase 11 plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The portable TypeScript contract is ready for the Android and iOS parity replay plans. Native ports can consume the version 2 fixture corpus unchanged and must preserve the exact request-token, cursor, ownership, tombstone, and complete-projection semantics.

---
*Phase: 11-shared-content-contract-and-privacy-boundary*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- RED commit `8afa7f09` and GREEN commit `e3afe1ce` exist in git history.
- All four planned source/fixture files exist, with no tracked deletions or untracked generated artifacts.
