---
phase: 09-cross-platform-chat-state
plan: 13
subsystem: chat-state
tags: [chat-state, reducer, selectors, unicode, tdd, fixtures, cross-platform]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state (plans 09-01..09-12)
    provides: The portable @fish/core/chat-state reducer/selector contract, its JSON fixture runner, and the protocol/native-notes documentation this plan hardens
provides:
  - Hydrate-preserve of unresolved local sends through hydrateConversation and hydrateWindow (WR-02)
  - Monotonic send-status guard in markMessageFailed so a late failure can never downgrade an already-"sent" row (WR-03)
  - Code-point-safe, surrogate-pair-safe getMessageSnippet truncation, <=96 code points (WR-10)
  - Five new cross-platform JSON fixture vectors proving all three behaviors
  - Synchronized protocol doc and native (Android/iOS) architecture notes
affects: [09-14 (CR-01 auth-identity cache isolation), 09-15 (WR-01 pagination race), 09-16 (WR-06/WR-07, explicitly builds on these reducer fixes), future native Android/iOS chat-state implementations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hydrate-preserve merge: filter existing conversation.messages for unresolved localStatus (pending/sending/failed) not reconciled by any incoming row, then fold the incoming authoritative snapshot on top via mergeChatMessage (same primitive olderPageLoaded uses) so a matching incoming row always supersedes the local placeholder instead of duplicating it."
    - "Monotonic status guard: before any transition that could regress a message's finality (e.g. sent -> failed), check the current status first and no-op (return the same object reference) if the transition would be a regression."
    - "Code-point-safe string truncation: use Array.from(str) to iterate/slice by Unicode code point instead of .length/.slice() (UTF-16 code units), so a surrogate pair is never split mid-character."

key-files:
  created: []
  modified:
    - packages/core/src/chat-state/reducer.ts
    - packages/core/src/chat-state/selectors.ts
    - packages/core/src/chat-state/fixtures/chat-state-vectors.json
    - apps/web/tests/chat-state-fixtures.test.ts
    - packages/core/docs/chat-state-protocol.md
    - .planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md

key-decisions:
  - "Reused mergeChatMessage (the same primitive olderPageLoaded already uses) for the hydrate-preserve fold, rather than writing a bespoke reconciliation function, so dedup/supersede semantics stay identical across every message-touching event."
  - "getMessageSnippet's truncation length is named constants (MAX_SNIPPET_CODE_POINTS, SNIPPET_ELLIPSIS) rather than inline literals, which also satisfies the plan's grep gate against reintroducing the old slice(0, 95) pattern."
  - "markMessageFailed's monotonic guard returns the same conversation object reference (not a shallow copy) when the row is already sent, so updateConversation's reference-equality check correctly treats it as a true no-op."

patterns-established:
  - "Hydrate-preserve merge: never assign an authoritative snapshot directly over local conversation state; filter-preserve unresolved rows, then fold the snapshot on top through the shared merge primitive."
  - "Monotonic status guard: read-before-write on any state machine field that has a terminal/authoritative value, to make late/duplicate/out-of-order events safe no-ops instead of regressions."

requirements-completed: [CSTATE-01, CSTATE-04, CSTATE-05, CSTATE-06]

coverage:
  - id: D1
    description: "hydrateConversation and hydrateWindow preserve unresolved local sends (localStatus pending/sending/failed) not reconciled by the incoming snapshot, folding preserved rows through mergeChatMessage so a matching authoritative row still supersedes the local placeholder instead of duplicating it"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'hydratePreservesUnresolvedSend'"
        status: pass
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'hydrateWindowPreservesUnresolvedSend'"
        status: pass
    human_judgment: false
  - id: D2
    description: "markMessageFailed is monotonic: a late failure for a clientRequestId whose row is already localStatus 'sent' is ignored entirely (no status change, no failureReason, no draft restore)"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'monotonicSentIgnoresLateFailure'"
        status: pass
    human_judgment: false
  - id: D3
    description: "getMessageSnippet measures length in Unicode code points (Array.from), truncates to the first 95 code points plus a single-character ellipsis (U+2026), never splits a surrogate pair, and the final result is at most 96 code points"
    requirement: "CSTATE-04"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'snippetLongAscii'"
        status: pass
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays 'snippetEmojiBoundary'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Portable chat-state package boundary stays clean: no React/Next.js/Zustand/Supabase/browser-global/Swift/Kotlin token introduced by this plan's edits, and no new dependency was added"
    requirement: "CSTATE-01"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-boundary.test.ts#does not import platform or app-specific dependencies"
        status: pass
    human_judgment: false
  - id: D5
    description: "Protocol doc and native (Android/iOS) architecture notes are synchronized to the hardened hydrate-preserve, monotonic-status, and code-point-snippet contract, with all five new fixture names listed in both documents"
    requirement: "CSTATE-05"
    verification:
      - kind: other
        ref: "grep -Eiq 'code point' packages/core/docs/chat-state-protocol.md && grep -Eiq 'monotonic|already .?sent|ignore' packages/core/docs/chat-state-protocol.md && grep -q 'monotonicSentIgnoresLateFailure' .planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 13: Hydrate-preserve, monotonic send status, and code-point-safe snippets Summary

**Reducer/selector hardening closing WR-02, WR-03, and WR-10 in `@fish/core/chat-state`: authoritative hydration no longer deletes an unresolved local send, a late failure can no longer downgrade an already-sent message, and `getMessageSnippet` truncates by Unicode code point instead of UTF-16 code unit — proven by five new cross-platform JSON fixture vectors.**

## Performance

- **Duration:** 25 min
- **Started:** ~2026-07-10T07:53Z
- **Completed:** 2026-07-10T08:16:24Z
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments

- `hydrateConversation`/`hydrateWindow` no longer assign `event.messages` directly over conversation state. A new `mergeHydratedMessages()` helper preserves every unreconciled `pending`/`sending`/`failed` row, then folds the authoritative snapshot on top through `mergeChatMessage` — the same primitive `olderPageLoaded` already uses — so a matching authoritative row supersedes the local placeholder without duplication.
- `markMessageFailed` is now monotonic: it early-returns the conversation unchanged when the matched row's `localStatus` is already `"sent"`, closing the race where a stale failure callback could relabel a realtime-confirmed send as failed.
- `getMessageSnippet` measures length with `Array.from(body)` (Unicode code points, never UTF-16 units) and truncates to 95 code points plus a single-character ellipsis (U+2026), guaranteeing a final result of at most 96 code points that never splits a surrogate pair — replacing the old `body.slice(0, 95) + "..."` rule that could return 98 UTF-16 units and a malformed lone surrogate.
- Five new JSON fixture vectors (`hydratePreservesUnresolvedSend`, `hydrateWindowPreservesUnresolvedSend`, `monotonicSentIgnoresLateFailure`, `snippetLongAscii`, `snippetEmojiBoundary`) encode all three hardened behaviors for Android/iOS parity, extending the ordered fixture list from 18 to 23 cases.
- `packages/core/docs/chat-state-protocol.md` and `09-NATIVE-CHAT-STATE-NOTES.md` are re-synchronized: the stale "96-character rule" wording is gone, replaced by the precise code-point/ellipsis/surrogate-safety contract, and both documents list all 23 current fixture names.
- Directly re-ran the exact `09-VERIFICATION.md` "Executable Race/Contract Probes" against the fixed source (ad hoc, not committed as a permanent test) and confirmed all four portable-layer probes flip from FAIL to PASS.

## Task Commits

Each task followed RED -> GREEN TDD (Tasks 1-2) or a single docs commit (Task 3):

1. **Task 1: Preserve unresolved local sends through hydration and make send status monotonic**
   - `edbbbe87` (test) — add failing fixtures for hydrate-preserve and monotonic send status (RED: 3 new vectors fail against unfixed reducer)
   - `7116156d` (feat) — implement `mergeHydratedMessages` + monotonic guard in `markMessageFailed` (GREEN: all 24 tests pass)
2. **Task 2: Grapheme/surrogate-safe, <=96 code-point message snippet**
   - `9a7751dc` (test) — add failing fixtures for code-point-safe message snippet (RED: 2 new vectors fail against unfixed selector)
   - `2a13a75f` (feat) — rewrite `getMessageSnippet` to count Unicode code points (GREEN: all 26 tests pass)
3. **Task 3: Sync the protocol document and native notes to the hardened contract**
   - `9414c762` (docs) — update `chat-state-protocol.md` and `09-NATIVE-CHAT-STATE-NOTES.md`

**Plan metadata:** committed alongside this SUMMARY (see final commit).

## Files Created/Modified

- `packages/core/src/chat-state/reducer.ts` - `mergeHydratedMessages()` helper; hydrate-preserve in `hydrateConversation`/`hydrateWindow`; monotonic guard in `markMessageFailed`
- `packages/core/src/chat-state/selectors.ts` - `getMessageSnippet()` rewritten to count Unicode code points via `Array.from`, named `MAX_SNIPPET_CODE_POINTS`/`SNIPPET_ELLIPSIS` constants
- `packages/core/src/chat-state/fixtures/chat-state-vectors.json` - 5 new vectors appended (18 -> 23 total), exact order preserved
- `apps/web/tests/chat-state-fixtures.test.ts` - ordered fixture name list extended to match the JSON order exactly
- `packages/core/docs/chat-state-protocol.md` - hydrate/markMessageFailed/getMessageSnippet contract text updated; fixture list extended
- `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md` - mirrored contract clauses, extended fixture list, new Selector Parity bullet

## Decisions Made

- Reused `mergeChatMessage` (the primitive `olderPageLoaded` already uses) for hydrate-preserve reconciliation instead of a bespoke function, keeping dedup/supersede semantics identical across every message-touching event.
- Named the snippet truncation length/ellipsis as constants (`MAX_SNIPPET_CODE_POINTS`, `SNIPPET_ELLIPSIS`) rather than inline literals — self-documenting, and it satisfies the plan's `grep -c "slice(0, 95)"` regression gate by construction rather than by coincidental formatting.
- `markMessageFailed`'s monotonic guard returns the identical conversation object reference (not a copy) on the already-sent no-op path, matching `updateConversation`'s reference-equality short-circuit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - this plan touches only `packages/core/src/chat-state`, its fixture JSON, its test runner, and two documentation files. No UI, no data-fetching component, no new stub surface.

## User Setup Required

None - no external service configuration required. No new dependency was installed.

## Next Phase Readiness

- WR-02, WR-03, and WR-10 are closed at the portable-core layer, with executable fixture proof for future Android/iOS native parity — the `09-VERIFICATION.md` blocking gaps 3, 4, and 8 (snippet half) are addressed by this plan.
- `chat-state-boundary` test stays green; no new dependency; `pnpm build`, `pnpm typecheck` (all 3 packages), `pnpm --filter @fish/web lint`, and the full web suite (473/473 tests, up from 468) all pass at HEAD.
- Remaining `09-VERIFICATION.md` blocking gaps are scoped to later gap-closure plans already on disk: `09-14` (CR-01, auth-identity cache isolation), `09-15` (WR-01, pagination conversation-switch race), `09-16` (WR-06/WR-07, conversation-scoped realtime transients + pagination layout stability — explicitly builds on this plan's reducer fixes), `09-17` (WR-08, community send-lifecycle E2E), and `09-18` (WR-09, shell logo tap-target + stale `/chat` reference).
- Ready for `09-14-PLAN.md`.

## Self-Check: PASSED

All 7 key files confirmed present on disk (6 modified + this SUMMARY). All 5
task commits (`edbbbe87`, `7116156d`, `9a7751dc`, `2a13a75f`, `9414c762`)
confirmed present in `git log`. Plan-level `<verification>` re-run at
close-out: `pnpm --filter @fish/web test chat-state-fixtures
chat-state-boundary` (26/26 pass), `pnpm typecheck` (core/supabase/web all
clean), `pnpm build` (clean), `pnpm --filter @fish/web lint` (clean), full
web suite (473/473 pass). All 3 tasks' `<acceptance_criteria>` re-verified
via direct grep/behavioral assertions (see Task Commits section). All four
applicable `09-VERIFICATION.md` "Executable Race/Contract Probes" re-run
directly against the fixed source and confirmed PASS.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*
