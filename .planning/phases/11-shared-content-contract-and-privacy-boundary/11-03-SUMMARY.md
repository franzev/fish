---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 03
subsystem: core-contract
tags: [typescript, shared-content, pagination, reducer, parity-fixtures, privacy]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: persisted shared-content eligibility and deletion semantics
provides:
  - portable @fish/core/shared-content wire types and package exports
  - canonical cross-platform classification, ordering, paging, capability, state, and deletion vectors
  - pure identity-safe, tombstone-wins reducer
affects: [phase-12-cache-and-recovery, phase-13-gallery-browsing, phase-14-preview-actions]

# Tech tracking
tech-stack:
  added: []
  patterns: [JSON-friendly closed unions, server-order-preserving page merges, identity-scoped tombstone guards]

key-files:
  created:
    - packages/core/src/shared-content/types.ts
    - packages/core/src/shared-content/classification.ts
    - packages/core/src/shared-content/ordering.ts
    - packages/core/src/shared-content/state.ts
    - packages/core/src/shared-content/index.ts
    - packages/core/src/shared-content/shared-content.test.ts
    - packages/core/src/shared-content/fixtures/shared-content-vectors.json
  modified:
    - packages/core/src/index.ts
    - packages/core/package.json
    - packages/core/tsconfig.json

key-decisions:
  - "Use the database-normalized descriptor as the only classifier input; the client contract is parity logic, not an authorization substitute."
  - "Use the four-field descending cursor and keep the 41st row as a non-rendered sentinel; the cursor always comes from retained row 40."
  - "Persist source-message tombstones and purge identity-bound state synchronously before accepting the next verified identity."
  - "Keep GIF and sticker browsing available while canExport remains false until redistribution rights are verified."

patterns-established:
  - "Canonical fixture corpus: TypeScript tests replay explicit JSON vectors so native ports can use the same source of truth."
  - "Reducer ownership: events must match the verified identity and conversation; stale or cross-owner events are ignored."

requirements-completed: [DISC-03, PAGE-01, PAGE-02, PAR-01]

# Metrics
duration: 12min
completed: 2026-07-22
---

# Phase 11 Plan 03: Shared-content contract and privacy boundary Summary

**Portable shared-content types, canonical parity vectors, deterministic sentinel paging, and an identity-safe tombstone-wins reducer for `@fish/core/shared-content`.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-22T10:20:05Z
- **Completed:** 2026-07-22T10:31:55Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Defined the closed seven-kind/four-category contract, hardened persisted-source classifier, typed payloads, capabilities, cursor, page, and gallery status vocabulary.
- Added explicit 54-case JSON corpus covering eligibility, ordering, pagination, permissions, gallery states, identity purge, sibling deletion fan-out, stale resurrection, and repeated tombstones.
- Implemented stable-ID deduplication with server-order preservation, cursor-from-last-retained-row paging, tombstone guards, and synchronous identity purge.
- Exported the complete surface from `@fish/core/shared-content` and the root core barrel without framework/provider dependencies.

## Task Commits

1. **Task 1: Define classification, ordering, page, and fixture contracts** - `c03dd226` (feat; preceded by RED `dcfa49a3`)
2. **Task 2: Implement tombstone-wins and purge-before-expose state** - `e2e8ce20` (feat)

## Files Created/Modified

- `packages/core/src/shared-content/types.ts` - portable wire, page, state, and event unions/interfaces.
- `packages/core/src/shared-content/classification.ts` - exact eligibility classifier for seven supported kinds.
- `packages/core/src/shared-content/ordering.ts` - deterministic reference ordering and 40-plus-sentinel paging.
- `packages/core/src/shared-content/state.ts` - identity ownership, stable-ID merge, tombstone fan-out, and purge reducer.
- `packages/core/src/shared-content/fixtures/shared-content-vectors.json` - canonical explicit parity corpus.
- `packages/core/src/shared-content/shared-content.test.ts` - direct fixture replay and fixed case-count assertions.
- `packages/core/src/shared-content/index.ts`, `packages/core/src/index.ts`, `packages/core/package.json` - complete public barrels and subpath exports.
- `packages/core/tsconfig.json` - allows direct `.ts` imports required by the exact Node strip-types fixture command.

## Decisions Made

- Source classification remains a pure parity check over hardened server descriptors; server authorization remains authoritative.
- Client paging never sorts fetched rows and never stores the sentinel; reducer page merges append only unseen stable IDs.
- Tombstones are keyed by source message ID so deleting one message removes every normalized sibling and blocks stale pages/realtime inserts.
- Identity changes return a clean new-owner state immediately, including empty pages, cursors, categories, references, errors, and tombstone guards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enabled direct TypeScript-extension imports for the mandated Node test command**

- **Found during:** Task 1 GREEN verification
- **Issue:** Node 25’s exact `node --experimental-strip-types --test ...` command requires `.ts` import specifiers, while the core compiler rejected them without the corresponding option.
- **Fix:** Added `allowImportingTsExtensions: true` to `packages/core/tsconfig.json`; public barrels retain extensionless `export *` paths for Next.js compatibility.
- **Files modified:** `packages/core/tsconfig.json`, `packages/core/src/shared-content/shared-content.test.ts`, direct shared-content source imports.
- **Verification:** Focused Node test, core typecheck, module-boundary test, and full `pnpm build` all pass.
- **Committed in:** `c03dd226`.

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking compatibility)
**Impact on plan:** Required only to make the mandated focused test command and web build coexist; no architectural or dependency changes.

## Issues Encountered

- The first full build rejected `.ts` extensions in the public barrel; the barrel was corrected to the repository’s extensionless `export *` convention and the build passed.
- `gsd-tools` was unavailable in the execution environment, so state and roadmap metadata require the equivalent manual update below.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`@fish/core/shared-content` is ready for direct Kotlin/Swift parity ports and the Phase 12 private cache/recovery work. The canonical corpus already states the identity purge and tombstone behavior those implementations must preserve.

---
*Phase: 11-shared-content-contract-and-privacy-boundary*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Summary and all seven planned shared-content source/fixture artifacts exist.
- Task RED/GREEN commits `dcfa49a3`, `c03dd226`, and `e2e8ce20` are present in git history.
- No missing files or unexpected tracked deletions were found.
