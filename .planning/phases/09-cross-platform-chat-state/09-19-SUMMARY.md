---
phase: 09-cross-platform-chat-state
plan: 19
subsystem: chat-state
tags: [zustand, vitest, intersection-observer, pagination, gap-closure, chat-state]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state (09-12, 09-15)
    provides: "The bounded one-automatic-attempt sentinel gate (09-12) and the per-conversation older-load lock/generation-token guard (09-15, WR-01) this plan's atomic-commit fix builds on without weakening either."
provides:
  - "ChatPaginationState.hasLoadError, a required field committed atomically with isLoadingOlder=false in the SAME reducer update on olderPageLoadFailed, and cleared atomically on a fresh olderMessagesRequested/olderPageLoaded/hydrateWindow."
  - "selectHasLoadErrorForConversation, threaded through use-chat-messages -> use-load-older-messages -> chat-client, replacing the hook's local hasOlderLoadError useState and callback-identity reset block."
  - "A browser-faithful IntersectionObserver test mock (setSentinelIntersecting) that auto-delivers an initial observation for a visible/already-observed sentinel, closing the coverage hole that let the double-fire regression reach UAT."
  - "olderPageRetryClearsError fixture vector proving a fresh request clears a prior failure in the same atomic update."
affects: [09-UAT, 09-VERIFICATION gap-closure round 5, 09-cross-platform-chat-state milestone audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A one-shot gate (loading -> error) that must never show an intermediate 'neither loading nor error' render belongs in ONE store-committed field set by the SAME reducer update as the flag it races against, not in local component state set from a separate async continuation."
    - "A browser-faithful test double for a browser API (IntersectionObserver) must model the real API's persistence semantics (element geometry survives observer disconnect/re-observe) even when that makes the mock's internal bookkeeping outlive any single observer instance — clearing shared mock state on disconnect() silently defeats regression tests that rely on a disconnect-then-re-observe sequence."

key-files:
  created: []
  modified:
    - packages/core/src/chat-state/types.ts
    - packages/core/src/chat-state/reducer.ts
    - packages/core/src/chat-state/fixtures/chat-state-vectors.json
    - apps/web/tests/chat-state-fixtures.test.ts
    - apps/web/app/(authenticated)/chat/store/chat-store.test.ts
    - apps/web/app/(authenticated)/chat/store/chat-selectors.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
    - apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/tests/intersection-observer.ts
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx

key-decisions:
  - "Task 2 deletes the hook's local hasOlderLoadError useState and the entire callback-identity reset block outright, rather than re-keying that reset block to conversationId as the raw UAT gap's 'missing' list suggested. Once the flag is store state read via a conversationId-scoped selector, there is no local state left to reset -- deleting is strictly simpler than re-keying and the plan's own <action> text for Task 2 directs the deletion."
  - "The IntersectionObserverMock's new intersectingTargets set is deliberately NOT cleared inside disconnect()/unobserve(), unlike observedCallbacks. Verified empirically with a throwaway vitest case before finalizing: wiring the clear into disconnect() (the literal first example in the plan's action text) made a disconnect-then-re-observe sequence on a still-visible sentinel stop auto-firing, which would make the new regression test pass identically whether the underlying atomic-commit fix is present or reverted -- a non-discriminating test. A hygiene-only resetIntersectingTargets() export (the plan's other offered alternative, 'a test afterEach helper') is provided instead, unwired, since every render() call already produces fresh DOM element objects with no cross-test identity collision risk."

patterns-established:
  - "Store selectors that gate an effect's re-attachment (hasMoreOlder/isLoadingOlder/hasLoadError) must all read from the SAME reducer-committed object so React's automatic batching guarantees one render reflects all of them together -- mixing a store-committed flag with a locally-set-later flag reopens exactly this kind of gap."

requirements-completed: [CSTATE-02, CSTATE-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "ChatPaginationState.hasLoadError is committed atomically with isLoadingOlder=false in the portable reducer on olderPageLoadFailed, and cleared atomically by a fresh request/successful load/hydrate -- proven by the fixture-vector replay contract every native client will share."
    requirement: CSTATE-02
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays olderPageLifecycle (terminal pagination.hasLoadError: true)"
        status: pass
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays olderPageRetryClearsError (new fixture: request after a failure yields hasLoadError: false)"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/store/chat-store.test.ts#leaves pagination retryable when an older page fails to load"
        status: pass
      - kind: other
        ref: "pnpm --filter @fish/core typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Web hooks read the store-backed, per-conversation hasLoadError via a selector instead of local state; the local hasOlderLoadError useState and callback-identity reset block are removed with zero behavior change to the rendered calm error affordance, bounded-retry, manual-retry, conversation-reset, and WR-01 cross-conversation isolation tests."
    requirement: CSTATE-06
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx (full file, 59/59 tests incl. bounded-retry, calm affordance, manual retry, conversation-reset, WR-01 x2)"
        status: pass
      - kind: other
        ref: "grep -c useState apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts (returns 0)"
        status: pass
      - kind: other
        ref: "pnpm --filter @fish/web typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "A browser-faithful IntersectionObserver mock (setSentinelIntersecting) auto-delivers an initial observation for a visible/already-observed sentinel, and a new regression test proves exactly one automatic older-page request fires after a failure -- closing the coverage hole that let the original double-fire UAT gap through undetected."
    requirement: CSTATE-06
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#makes exactly one automatic load earlier attempt after a failure (browser-faithful observer)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live confirmation in a real browser at /channels/general that a forced older-page failure now fires exactly one automatic request before settling into the calm retry region, matching the original UAT-01 method."
    verification: []
    human_judgment: true
    rationale: "This project's convention is verification via tests and build gates, not dev-server/browser preview (workflow.human_verify_mode=end-of-phase; user preference recorded in MEMORY.md). The plan's own <verification> section separately marks this check 'out-of-band'. Deferred to the Phase 9 end-of-phase UAT re-run (09-UAT.md HV-01), matching the 09-18 precedent for the same reason."

# Metrics
duration: 18min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 19: Older-Page Failure Flag Atomic Commit Summary

**Moved the older-page load failure flag from a hook-local `useState` into `ChatPaginationState.hasLoadError`, committed by the portable reducer in the SAME update as `isLoadingOlder=false`, and added a browser-faithful `IntersectionObserver` mock + regression test proving exactly one automatic retry after a failure -- closing UAT round-5 gap Test 2 (double-fire bug).**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-10T20:45:00Z
- **Completed:** 2026-07-10T21:02:41Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- `ChatPaginationState` gained a required `hasLoadError: boolean`; the reducer sets it `true` in the exact same object literal that clears `isLoadingOlder` on `olderPageLoadFailed`, and clears it (`false`) on `olderMessagesRequested`/`olderPageLoaded`/`hydrateWindow` -- eliminating the intermediate render where loading was false but the failure hadn't landed yet.
- `chat-state-vectors.json` threads `hasLoadError` through all 27 existing pagination occurrences (11 `initialState` + 16 `expectedState`) and adds a new `olderPageRetryClearsError` fixture proving `[olderMessagesRequested, olderPageLoadFailed, olderMessagesRequested]` yields `{ isLoadingOlder: true, hasLoadError: false }`.
- `selectHasLoadErrorForConversation` (mirroring the existing `isLoadingOlder` selector) threads the store-backed, per-conversation flag through `use-chat-messages` -> `use-load-older-messages` -> `chat-client`; the hook's local `hasOlderLoadError` `useState` and the `previousOnLoadOlder` callback-identity reset block are deleted entirely, since the store already scopes the flag per `conversationId`.
- `apps/web/tests/intersection-observer.ts` gained `setSentinelIntersecting`, an auto-fire-on-observe path that mirrors a real browser delivering an initial observation the moment a visible element starts being observed (or an already-observed element becomes visible) -- and a new chat-client test proves exactly one automatic `loadOlderMessagesAction` call fires after a failure, using this browser-faithful mock instead of the old manual-trigger-only one that could not see the original bug.

## Task Commits

Each task was committed atomically:

1. **Task 1: Move the older-page failure flag into portable pagination state and update the contract vectors/tests** - `d6e60276` (test)
2. **Task 2: Thread the store-backed failure flag through the selector and hooks; delete the local error flag and identity-reset block** - `db9ffe15` (fix)
3. **Task 3: Add a browser-faithful IntersectionObserver mock and a regression test asserting exactly one automatic attempt after failure** - `2a51a109` (test)

**Plan metadata:** (this commit) `docs(09-19): complete older-page failure flag atomic commit plan`

_Note: Task 1 is tagged `test` (its own commit message prefix) even though it touches the reducer/types, because its files list is dominated by the contract-vector/test updates that make the new field meaningful; Task 2 is the pure behavioral fix._

## Files Created/Modified
- `packages/core/src/chat-state/types.ts` - `ChatPaginationState` gains required `hasLoadError: boolean`.
- `packages/core/src/chat-state/reducer.ts` - `hasLoadError` set atomically with `isLoadingOlder` across `defaultPagination`, `hydrateWindow`, `olderMessagesRequested`, `olderPageLoaded`, `olderPageLoadFailed` (6 occurrences).
- `packages/core/src/chat-state/fixtures/chat-state-vectors.json` - `hasLoadError` threaded through all 27 existing pagination objects; new `olderPageRetryClearsError` fixture appended.
- `apps/web/tests/chat-state-fixtures.test.ts` - `olderPageRetryClearsError` appended to the exact-order fixture name list.
- `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` - pagination-keys assertion includes `hasLoadError`; failure-retryable test asserts it flips true on failure and false on a fresh request.
- `apps/web/app/(authenticated)/chat/store/chat-selectors.ts` - new `selectHasLoadErrorForConversation`.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` - reads and returns the store-backed `hasLoadError`.
- `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts` - takes `hasLoadError` as a prop; local `useState` and callback-identity reset block removed; observer guard and deps use the prop.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - threads `hasLoadError` from `useChatMessages` into `useLoadOlderMessages`.
- `apps/web/tests/intersection-observer.ts` - `setSentinelIntersecting` + auto-fire-on-observe; `resetIntersectingTargets` hygiene export.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - new "makes exactly one automatic load earlier attempt after a failure (browser-faithful observer)" regression test.

## Decisions Made
See `key-decisions` in frontmatter: (1) the local-state reset block was deleted rather than re-keyed, per the plan's own Task 2 action text; (2) the IntersectionObserver mock's `intersectingTargets` set is deliberately not cleared on `disconnect()`, verified empirically before finalizing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the IntersectionObserver mock's intersecting-target bookkeeping before it shipped a non-discriminating regression test**
- **Found during:** Task 3, while implementing `setSentinelIntersecting`
- **Issue:** The plan's Task 3 action text offers "mirror how `observedCallbacks` is cleared, e.g. in `disconnect`" as the first example for resetting the new `intersectingTargets` set between tests. Implementing it literally (clearing `intersectingTargets` inside `disconnect()`) is wrong: a real `IntersectionObserver`'s visibility delivery is a property of the DOM element's geometry, not of any one observer instance's subscription lifecycle. The failure-guard's re-attachment dance in this exact bug (disconnect the mount-time observer when `isLoadingOlder` flips true, then -- in the pre-fix code -- create a NEW observer and re-`observe()` the SAME still-visible sentinel during the gap render) means the mock must keep delivering for that same element across a disconnect+re-observe, or the test cannot tell fixed code from reverted code.
- **Fix:** Wrote a throwaway vitest case (`apps/web/tests/_tmp-verify-mock.test.ts`, deleted immediately after use, never committed) driving `IntersectionObserverMock` and `setSentinelIntersecting` directly: disconnect one observer instance and `observe()` the same still-marked-intersecting target from a second instance. With `intersectingTargets.clear()` inside `disconnect()`, the second `observe()` did not auto-fire (1 call, not the expected 2) -- proving the literal reading breaks the test's discriminating power. Removed the clear from `disconnect()`, documented why in code comments, and added an unwired `resetIntersectingTargets()` export as the plan's other offered alternative ("a test afterEach helper") for hygiene. Re-ran the same throwaway case: 2 calls, confirming the mock now correctly reproduces a disconnect-then-re-observe delivery.
- **Files modified:** `apps/web/tests/intersection-observer.ts` (the throwaway verification file itself was created and deleted within the same task, never staged or committed)
- **Verification:** Full chat-client suite (59/59), full web suite (499/499 across 61 files), `pnpm --filter @fish/web typecheck`, `pnpm lint`, `pnpm build` all green after the fix.
- **Committed in:** `2a51a109` (Task 3 commit; the throwaway file was removed before staging)

---

**Total deviations:** 1 auto-fixed (1 bug, discovered and fixed within the same task before any commit)
**Impact on plan:** No scope creep -- the fix is a 4-line removal (dropping `intersectingTargets.clear()` from `disconnect()`) plus documentation, and was necessary for the Task 3 deliverable to actually be the regression test the plan calls for. No existing tests were affected (only the new test uses `setSentinelIntersecting`).

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT round-5 gap Test 2 (severity: minor, "a failed older-page load makes exactly one automatic attempt, then waits calmly for manual retry") is closed at the code and automated-test level: the split-commit render gap the debug session (`older-load-double-retry.md`) identified as root cause no longer exists, and a browser-faithful regression test now covers exactly the scenario the original bounded-retry test (with its manual-trigger-only mock) could not see.
- All pre-existing pagination/WR-01 tests remain green with no behavior weakened: `pnpm --filter @fish/web exec vitest run chat-state-fixtures chat-store chat-client` (103/103), full web suite `pnpm --filter @fish/web exec vitest run` (499/499 across 61 files), `pnpm --filter @fish/core typecheck`, `pnpm --filter @fish/web typecheck`, `pnpm lint`, and `pnpm build` all pass clean.
- The plan's "Live instrumented check" (forcing a failure against a live dev server at `/channels/general`, the original HV-01 UAT method) was intentionally not run here, per this project's no-dev-server/no-browser-preview convention (matching the 09-18 precedent) -- it is the natural next step to move `09-UAT.md`'s HV-01 from "issue" to "pass", and STATE.md's existing "Next planned" note ("Re-run Phase 09 UAT Test 2 at `/channels/general`, then complete the milestone audit") already anticipates this.
- No architectural changes, no new dependencies, no new runtime files -- this was a pure state-commit-timing fix plus test-infrastructure hardening.

## Self-Check: PASSED

- FOUND: packages/core/src/chat-state/types.ts
- FOUND: packages/core/src/chat-state/reducer.ts
- FOUND: packages/core/src/chat-state/fixtures/chat-state-vectors.json
- FOUND: apps/web/tests/chat-state-fixtures.test.ts
- FOUND: apps/web/app/(authenticated)/chat/store/chat-store.test.ts
- FOUND: apps/web/app/(authenticated)/chat/store/chat-selectors.ts
- FOUND: apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
- FOUND: apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts
- FOUND: apps/web/app/(authenticated)/chat/chat-client.tsx
- FOUND: apps/web/tests/intersection-observer.ts
- FOUND: apps/web/app/(authenticated)/chat/chat-client.test.tsx
- FOUND: d6e60276 (Task 1 commit)
- FOUND: db9ffe15 (Task 2 commit)
- FOUND: 2a51a109 (Task 3 commit)
- CONFIRMED: apps/web/tests/_tmp-verify-mock.test.ts does NOT exist (throwaway file correctly removed before commit)

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*
