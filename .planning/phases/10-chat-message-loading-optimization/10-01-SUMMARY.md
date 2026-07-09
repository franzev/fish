---
phase: 10-chat-message-loading-optimization
plan: 01
subsystem: chat-state
tags: [chat-state, reducer, typescript, pagination, fixtures, cross-platform]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state
    provides: portable reducer/selectors library (packages/core/src/chat-state), JSON fixture-vector discipline, protocol doc, native parity notes
provides:
  - Four additive ChatEvent variants (hydrateWindow, olderMessagesRequested, olderPageLoaded, olderPageLoadFailed)
  - ChatMessageCursor / ChatPaginationState types and a required pagination field (with default) on ChatConversationState
  - olderPageLoaded dedup reusing the existing mergeChatMessage primitive (no second dedup path)
  - Documented, fixture-proven out-of-window read/delivered marker rule in isAtOrAfterMessage
  - 7 new fixture vectors (17 total) covering pagination, dedup, out-of-order/duplicate reconnect backfill, and the marker rule
  - Updated chat-state-protocol.md and a new 10-NATIVE-CHAT-STATE-NOTES.md
affects: [10-02-chat-message-loading-optimization, 10-03-chat-message-loading-optimization, 10-04-chat-message-loading-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive ChatEvent variant: new union member + reducer case + protocol-doc table row + fixture-name-array entry, four files move together (continued from Phase 9 CSTATE-04 discipline)"
    - "Pagination as a nested sub-object on ChatConversationState (oldestLoadedCursor/hasMoreOlder/isLoadingOlder), mirroring the composer/realtime nesting convention"
    - "Out-of-window selector marker handling: markerIndex === -1 is a distinct, commented branch from '!markerMessageId' (no marker at all) so read/delivered markers stay independently evaluable"

key-files:
  created:
    - .planning/phases/10-chat-message-loading-optimization/10-NATIVE-CHAT-STATE-NOTES.md
  modified:
    - packages/core/src/chat-state/types.ts
    - packages/core/src/chat-state/reducer.ts
    - packages/core/src/chat-state/selectors.ts
    - packages/core/src/chat-state/fixtures/chat-state-vectors.json
    - apps/web/tests/chat-state-fixtures.test.ts
    - packages/core/docs/chat-state-protocol.md

key-decisions:
  - "Reworded new selector comments to avoid the standalone word 'window' after it tripped the chat-state-boundary.test.ts browser-globals guard (naive whole-word text scan, not semantic) — no behavior change."
  - "Added the pagination default to four pre-existing fixtures' initialState (confirmSentMessage, markMessageFailed, duplicateClientRequestIdReconciliation, mergeReadState) in addition to their expectedState, since those four pre-seed a conversation object directly and the reducer's default-pagination fallback only applies when a conversation is absent from the record — verified empirically that expectedState-only edits would have broken those four previously-passing tests."

patterns-established:
  - "Task 1 (behavior/reducer) and Task 2 (fixture vectors that exercise it) can land as two tdd=true tasks in sequence when the fixtures need the same JSON file touched for both new cases and a pre-existing-fixture retrofit — the pair is verified together, not each task in isolation."

requirements-completed: [CLOAD-03, CLOAD-05, CLOAD-06]

coverage:
  - id: D1
    description: "Portable reducer applies four new additive events (hydrateWindow, olderMessagesRequested, olderPageLoaded, olderPageLoadFailed)"
    requirement: "CLOAD-03"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'hydrateWindow', replays 'olderPageLoaded', replays 'olderPageLifecycle'"
        status: pass
    human_judgment: false
  - id: D2
    description: "olderPageLoaded prepends an older page deduplicated by id/clientRequestId and re-sorted, with no duplicate across optimistic/realtime/paginated sources"
    requirement: "CLOAD-05"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'olderPageDuplicateReconciliation', replays 'gapBackfillOutOfOrder'"
        status: pass
    human_judgment: false
  - id: D3
    description: "ChatConversationState carries a pagination field { oldestLoadedCursor, hasMoreOlder, isLoadingOlder } with a well-formed default on every conversation"
    requirement: "CLOAD-03"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'hydrateConversation' (default pagination via getConversation fallback)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Read-state selectors return the correct outgoing status and unread count when the read/delivered marker references a message outside the loaded window"
    requirement: "CLOAD-06"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'deliveredMarkerOutsideWindow', replays 'readMarkerOutsideWindow'"
        status: pass
    human_judgment: false
  - id: D5
    description: "hydrateConversation event semantics are unchanged; all ten original fixtures plus the seven new fixtures replay green (17 total)"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts (all 19 tests: 2 base + 17 replays)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Protocol doc and phase-10 native notes record the new pagination contract for future native implementers"
    verification:
      - kind: other
        ref: "grep -c for the four event names in chat-state-protocol.md (6) and 10-NATIVE-CHAT-STATE-NOTES.md (8); file existence and out-of-scope statement checks"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-07-10
status: complete
---

# Phase 10 Plan 01: Portable Chat-State Pagination Contract Summary

**Four additive ChatEvent variants plus a pagination state slice in `packages/core/src/chat-state`, proven by 7 new JSON fixture vectors (17 total) reusing the existing mergeChatMessage dedup primitive — no new client-facing code, no new dependencies.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-10T06:14:00Z (approx., first read after 50ff7a40)
- **Completed:** 2026-07-10T06:35:05Z
- **Tasks:** 3 (plus 1 auto-fixed regression, documented below)
- **Files modified:** 7 (6 modified, 1 created)

## Accomplishments

- Extended the portable `ChatEvent` union with `hydrateWindow`, `olderMessagesRequested`, `olderPageLoaded`, and `olderPageLoadFailed`, plus a required `pagination: ChatPaginationState` field (`oldestLoadedCursor`, `hasMoreOlder`, `isLoadingOlder`) on `ChatConversationState` with a well-formed default in every conversation.
- `olderPageLoaded`'s reducer case loops the existing `mergeChatMessage` primitive over the incoming page — no second dedup implementation — proven by fixtures that overlap on both `id` and `clientRequestId` (the latter modeling an older page racing an in-flight optimistic send).
- Made the out-of-window read/delivered marker rule explicit and documented in `isAtOrAfterMessage`: a marker id absent from the currently loaded window is strictly older than the window, and the read/delivered branches are proven independent (an out-of-window read marker does not suppress an in-window delivered marker).
- Authored 7 new fixture vectors (17 total, all replay green) and retrofitted the pagination default onto every pre-existing `expectedState`/relevant `initialState`.
- Updated `chat-state-protocol.md` (Events table, State Shape, Selectors rule, fixture-name list) and created `10-NATIVE-CHAT-STATE-NOTES.md` for Android/iOS parity guidance.
- `hydrateConversation`'s existing case is byte-for-byte unchanged (confirmed via `git diff`, additive lines only around it).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pagination state shape, four additive events, reducer cases, and the read-marker-outside-window selector fix** - `1e5e9282` (feat)
2. **Auto-fixed regression (Rule 1): reword comments to clear the boundary-purity guard** - `837e7f8a` (fix)
3. **Task 2: Author seven new fixture vectors, add the pagination default to all ten existing expectedState blocks, and update the fixture-name array** - `48ce0e40` (test)
4. **Task 3: Document the new events in the protocol doc and record native parity notes for phase 10** - `629f9eea` (docs)

**Plan metadata:** (pending — see final commit below)

_Note: Task 1 and Task 2 both carry `tdd="true"`; see "TDD sequencing" under Decisions Made for why they land as implementation-then-fixtures rather than a single-task RED/GREEN pair._

## Files Created/Modified

- `packages/core/src/chat-state/types.ts` - `ChatMessageCursor`, `ChatPaginationState`, four new `ChatEvent` variants, `pagination` field on `ChatConversationState`
- `packages/core/src/chat-state/reducer.ts` - `defaultPagination`, four new `case` handlers, `pagination` added to `getConversation`'s fallback
- `packages/core/src/chat-state/selectors.ts` - `isAtOrAfterMessage` explicit out-of-window branch; WHY comment on `countUnreadMessages`'s existing `-1` fallback (no signature/behavior change)
- `packages/core/src/chat-state/fixtures/chat-state-vectors.json` - 7 new fixture cases (17 total); pagination default retrofitted onto 7 pre-existing cases' `expectedState` (4 of those also in `initialState`, see Deviations)
- `apps/web/tests/chat-state-fixtures.test.ts` - extended the hardcoded fixture name-array assertion to all 17 names
- `packages/core/docs/chat-state-protocol.md` - Events table rows, State Shape note, Selectors out-of-window rule, fixture-name list
- `.planning/phases/10-chat-message-loading-optimization/10-NATIVE-CHAT-STATE-NOTES.md` - new file, phase-09 structure, updated event/fixture lists, new Selector Parity Pitfall #6 bullet

## Decisions Made

- **TDD sequencing across Task 1/Task 2:** Task 1 (tdd="true") implements the reducer/selector behavior with no dedicated test file of its own (the plan's `files_modified` scopes Task 1 to `types.ts`/`reducer.ts`/`selectors.ts` only); Task 2 (also tdd="true") authors the fixture vectors that exercise it, in the same JSON file the pre-existing 10 cases already live in. Running Task 1's verify command in isolation intentionally left 3 of 10 pre-existing fixtures red (missing the new required `pagination` field in their old `expectedState`) — this is the plan's own documented design ("green once Task 2 lands the vectors"), not a bug. Confirmed via test run before proceeding.
- See frontmatter `key-decisions` for the two auto-fixed deviations (boundary-purity wording, initialState pagination consistency).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] New selector comments tripped the chat-state boundary-purity test**
- **Found during:** Task 2 (running the full `apps/web` vitest suite, not just `chat-state-fixtures`, to verify no regressions)
- **Issue:** `apps/web/tests/chat-state-boundary.test.ts` scans every `.ts` file under `packages/core/src/chat-state` for standalone occurrences of `window`/`document` (a naive whole-word regex meant to catch accidental browser-global dependencies) and fails on ANY match, including inside comments. Task 1's new `isAtOrAfterMessage`/`countUnreadMessages` comments used the English word "window" to describe the loaded-message range ("outside the currently loaded (newest-anchored) window"), which matched the guard and failed `chat-state-boundary.test.ts > does not import platform or app-specific dependencies`.
- **Fix:** Reworded both comments to say "currently loaded (newest-anchored) messages" / "everything loaded" instead of "window" — identical meaning, zero behavior change.
- **Files modified:** `packages/core/src/chat-state/selectors.ts`
- **Verification:** `grep -rn "\bwindow\b\|\bdocument\b" packages/core/src/chat-state/ --include="*.ts"` returns nothing; full `apps/web` vitest suite (426 tests) passes.
- **Committed in:** `837e7f8a`

**2. [Rule 1 - Bug] Plan's "expectedState only" fixture instruction would have broken 4 previously-passing tests**
- **Found during:** Task 2 (authoring the pagination-default retrofit)
- **Issue:** The plan's Task 2 action text says to add the pagination default to `expectedState` only, never `initialState`. Four pre-existing cases (`confirmSentMessage`, `markMessageFailed`, `duplicateClientRequestIdReconciliation`, `mergeReadState`) pre-seed a full conversation object directly in their `initialState` (rather than starting from `{ conversations: {} }`). Since the reducer's new `pagination` default only applies inside `getConversation`'s `??` fallback — which never triggers when the conversation id is already present in the record — those four cases' actual runtime output would never gain a `pagination` field. Adding `pagination` to only their `expectedState` would make actual (no field) diverge from expected (has field), breaking 4 tests that passed before this plan. Verified empirically: ran the fixture suite with Task 1's reducer changes and the original (unedited) fixtures first, confirming exactly which 3 of 10 cases failed (the ones starting from an empty `initialState`) and which 7 passed trivially (including these 4) before making any Task 2 edits.
- **Fix:** Added the identical pagination-default block to these four cases' `initialState` conversation object as well as their `expectedState` — a mechanical field addition (not a change to `events` or message/read content), consistent with the spirit of "don't alter substantive test setup" while keeping both sides of the equality check in sync with the now-required `ChatConversationState.pagination` field.
- **Files modified:** `packages/core/src/chat-state/fixtures/chat-state-vectors.json`
- **Verification:** All 19 tests in `chat-state-fixtures.test.ts` pass (2 base + 17 replays), including these 4 cases.
- **Committed in:** `48ce0e40`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs found via full-suite verification, not scope creep)
**Impact on plan:** Both fixes were necessary for a genuinely green suite; neither changes any case's events, message content, or read-state content — only mechanical wording/field additions.

## Issues Encountered

None beyond the two deviations above (both resolved within the same task's fix-attempt budget).

## User Setup Required

None - no external service configuration required. This plan touches only `packages/core` (framework-free TypeScript) and one web test file; no new dependencies, no schema/migration, no environment variables.

## Next Phase Readiness

- The pagination event/result contract (`hydrateWindow`, `olderMessagesRequested`, `olderPageLoaded`, `olderPageLoadFailed`, `ChatPaginationState`) is finished and fixture-proven — Plans 10-02/10-03/10-04 can now build the Supabase bounded-window read, the `actions.ts` pagination/backfill functions, the `use-chat-messages`/`use-chat-realtime` hook wiring, the Zustand store dispatch wrappers, and the `chat-client.tsx` sentinel/affordance UI against a stable, already-tested core.
- No blockers. `pnpm typecheck`, `pnpm build`, `pnpm lint`, and the full `apps/web` vitest suite (426 tests) are green at HEAD.
- Downstream plans should route pagination-during-live-insert overlaps through `mergeChatMessage` exactly as `olderPageLoaded`'s reducer case does (no second dedup function) — the `olderPageDuplicateReconciliation` fixture is the reference scenario.

---
*Phase: 10-chat-message-loading-optimization*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 7 modified/created files confirmed present; all 4 task/deviation commit hashes (1e5e9282, 837e7f8a, 48ce0e40, 629f9eea) confirmed in git log.
