---
phase: 09-cross-platform-chat-state
plan: 01
subsystem: core
tags: [chat-state, reducer, fixtures, vitest, portability]

requires:
  - phase: 08-real-chat-route
    provides: live one-assigned-conversation chat behavior and existing web helper tests
provides:
  - Portable dependency-clean `@fish/core/chat-state` reducer, selectors, and types
  - Cross-platform JSON chat-state replay vectors
  - Web compatibility shim preserving current chat helper imports
  - Boundary and fixture replay tests for portable chat-state behavior
affects: [09-cross-platform-chat-state, web-chat, native-chat-contract]

tech-stack:
  added: []
  patterns:
    - "Portable event reducer in packages/core with web shim re-export"
    - "JSON fixture vectors replayed through Vitest"
    - "Static dependency-boundary test for shared core modules"

key-files:
  created:
    - packages/core/src/chat-state/index.ts
    - packages/core/src/chat-state/types.ts
    - packages/core/src/chat-state/reducer.ts
    - packages/core/src/chat-state/selectors.ts
    - packages/core/src/chat-state/fixtures/chat-state-vectors.json
    - apps/web/tests/chat-state-boundary.test.ts
    - apps/web/tests/chat-state-fixtures.test.ts
  modified:
    - packages/core/package.json
    - packages/core/src/index.ts
    - apps/web/app/(authenticated)/chat/chat-state.ts

key-decisions:
  - "The shared chat brain is exported as `@fish/core/chat-state`; the web helper file remains a compatibility shim."
  - "Fixture tests use plain JSON vectors with expected state or selector outputs so native clients can replay the same contract later."
  - "The portable local status union includes existing web `pending` plus fixture-backed `sending`, `sent`, and `failed` states."

patterns-established:
  - "Boundary guard: shared chat-state TypeScript files are scanned for platform, app, browser, Supabase, and native references."
  - "Reducer events are deterministic immutable transforms over `ChatState`; selectors preserve existing web helper behavior."

requirements-completed: [CSTATE-01, CSTATE-04, CSTATE-06]

duration: 8min
completed: 2026-07-06
---

# Phase 09 Plan 01: Portable Chat State Core Summary

**Portable chat-state reducer, selectors, JSON replay vectors, and web helper shim now live behind `@fish/core/chat-state`.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-06T23:35:36Z
- **Completed:** 2026-07-06T23:43:12Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added `@fish/core/chat-state` with dependency-clean types, selectors, reducer events, and package exports.
- Added ten JSON replay vectors covering hydration, optimistic send, confirmation, failure, remote merge, duplicate request reconciliation, read-state merge, unread count, deleted snippet, and reply preview.
- Preserved the existing web `./chat-state` import surface through a shim that re-exports the portable selectors.
- Added Vitest coverage for fixture replay and static portable-core boundary enforcement.

## Task Commits

1. **Task 1: Add fixture replay and dependency-boundary tests first** - `103abfb` (test)
2. **Task 2: Implement portable reducer, selectors, types, and package exports** - `d357e34` (feat)
3. **Task 3: Preserve web helper imports through a compatibility shim** - `03f503f3` (feat)

## Files Created/Modified

- `packages/core/src/chat-state/index.ts` - Public portable chat-state export surface.
- `packages/core/src/chat-state/types.ts` - Portable state, event, message, read-state, composer, and status types.
- `packages/core/src/chat-state/reducer.ts` - Deterministic immutable reducer and event replay helpers.
- `packages/core/src/chat-state/selectors.ts` - Message merge, read-state merge, status, unread, snippet, and reply-preview helpers.
- `packages/core/src/chat-state/fixtures/chat-state-vectors.json` - Cross-platform replay vectors with expected state or selector outputs.
- `packages/core/package.json` - Added `./chat-state` export.
- `packages/core/src/index.ts` - Re-exported chat-state from the package barrel.
- `apps/web/app/(authenticated)/chat/chat-state.ts` - Compatibility shim re-exporting portable helpers.
- `apps/web/tests/chat-state-boundary.test.ts` - Static dependency-boundary guard.
- `apps/web/tests/chat-state-fixtures.test.ts` - Fixture schema and replay tests.

## Decisions Made

- Kept the web helper filename and exported function names unchanged so existing route imports continue to work.
- Used synthetic fixture IDs and message text only; no real account data, JWTs, service-role values, or seeded credentials were added.
- Treated Zustand and native implementation as out of scope for this plan; this plan only establishes the portable contract and web shim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tightened dependency-boundary test to avoid `next` variable false positives**
- **Found during:** Task 2
- **Issue:** The first boundary regex flagged ordinary reducer variables named `next` as Next.js usage.
- **Fix:** Limited the Next.js pattern to package import/reference syntax while preserving the forbidden dependency list.
- **Files modified:** `apps/web/tests/chat-state-boundary.test.ts`
- **Verification:** `pnpm --filter @fish/web test tests/chat-state-boundary.test.ts tests/chat-state-fixtures.test.ts`
- **Committed in:** `d357e34`

**2. [Rule 3 - Blocking] Used path-corrected Vitest commands for `pnpm --filter @fish/web test`**
- **Found during:** Task 1
- **Issue:** Plan commands used root-relative `apps/web/...` paths, but `pnpm --filter @fish/web test` executes Vitest from `apps/web`, causing "No test files found" before reaching assertions.
- **Fix:** Ran the equivalent package-relative paths (`app/...` and `tests/...`) and additionally verified the same focused set through `pnpm --filter @fish/web exec vitest --config vitest.config.ts ...` from `apps/web`.
- **Files modified:** None.
- **Verification:** Corrected plan-level commands passed.
- **Committed in:** N/A

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking issue)
**Impact on plan:** Both deviations preserved the planned behavior and removed verification friction. No product scope was expanded.

## Issues Encountered

- The RED test first failed because the plan's root-relative Vitest paths are not valid under `pnpm --filter @fish/web test`; the package-relative command then produced the intended RED failure: `@fish/core` did not export `./chat-state`.

## Authentication Gates

None.

## Known Stubs

None.

## Verification

- `pnpm --filter @fish/web test tests/chat-state-boundary.test.ts tests/chat-state-fixtures.test.ts` - passed after Task 2.
- `pnpm --filter @fish/web test app/\(authenticated\)/chat/chat-state.test.ts tests/chat-state-boundary.test.ts tests/chat-state-fixtures.test.ts` - passed, 17 tests.
- `pnpm --filter @fish/web test app/\(authenticated\)/chat/chat-client.test.tsx` - passed, 17 tests.
- `pnpm --filter @fish/web exec vitest --config vitest.config.ts app/\(authenticated\)/chat/chat-state.test.ts tests/chat-state-boundary.test.ts tests/chat-state-fixtures.test.ts` - passed, 17 tests.
- `pnpm --filter @fish/web typecheck` - passed.
- `pnpm build` - passed before each task commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 09-02 can now extract focused web chat hooks against the stable helper shim. Plan 09-04 can document the JSON event/result contract using the fixture names and state shape created here.

## Self-Check: PASSED

- Created files exist on disk.
- Task commits found: `103abfb`, `d357e34`, `03f503f3`.
- No accidental tracked-file deletions were detected in task commits.
- Stub scan found no blocking placeholder UI/data stubs in files touched by this plan.
- Threat scan found no new network endpoints, auth paths, file access patterns, database schemas, or trust-boundary writes.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-06*
