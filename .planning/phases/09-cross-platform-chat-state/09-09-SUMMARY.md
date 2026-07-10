---
phase: 09-cross-platform-chat-state
plan: "09"
subsystem: chat-state
tags: [zustand, react, vitest, chat-state, json-fixtures, composer]

# Dependency graph
requires:
  - phase: 09 (plans 01-08)
    provides: portable chat-state reducer/selectors, JSON fixture parity contract, Zustand web adapter, decomposed chat-client hooks
provides:
  - Conditional (draft-safe) failure recovery in markMessageFailed
  - New cross-platform parity fixture markMessageFailedPreservesNewerDraft
  - Removal of the use-chat-composer.ts post-failure draft clobber
  - Component tests proving both the restore-when-empty and preserve-when-newer paths
affects: [09-10, 09-11, chat-state-protocol consumers, future native Android/iOS chat-state implementations]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Reducer-owned local-state recovery: a hook must not duplicate or override a state transition the portable reducer already owns"]

key-files:
  created: []
  modified:
    - packages/core/src/chat-state/reducer.ts
    - packages/core/src/chat-state/fixtures/chat-state-vectors.json
    - packages/core/docs/chat-state-protocol.md
    - .planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md
    - apps/web/tests/chat-state-fixtures.test.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx

key-decisions:
  - "Conditional restore is keyed on conversation.composer.draft.length === 0, reusing the exact emptiness signal the prior unconditional code already relied on — no new state was needed to detect 'a newer edit happened'."
  - "The composer hook no longer clears the draft after a failure; the reducer is the single owner of post-failure draft recovery, closing the WR-01 review finding."

patterns-established:
  - "Reducer-owned recovery: draft/composer recovery after an event lives in the portable reducer only; platform hooks read the result, they do not also mutate the same field."

requirements-completed: [CSTATE-06]

coverage:
  - id: D1
    description: "markMessageFailed restores the failed body to composer.draft only when the draft is empty (conditional, draft-safe recovery), proven by a new cross-platform parity fixture"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays markMessageFailedPreservesNewerDraft"
        status: pass
      - kind: unit
        ref: "apps/web/tests/chat-state-fixtures.test.ts#replays markMessageFailed"
        status: pass
    human_judgment: false
  - id: D2
    description: "use-chat-composer.ts no longer clears the draft after a send failure; the composer shows the restored failed body and the failed message renders as a bubble with Retry"
    requirement: "CSTATE-06"
    verification:
      - kind: integration
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#restores the draft and offers retry when send fails"
        status: pass
    human_judgment: false
  - id: D3
    description: "A newer draft typed while a send is pending survives a delayed send failure untouched; the earlier failed message still shows its failed bubble with Retry"
    requirement: "CSTATE-06"
    verification:
      - kind: integration
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#preserves a newer draft when a delayed send failure arrives"
        status: pass
    human_judgment: false
  - id: D4
    description: "chat-state-protocol.md and the paired Phase 09 native chat-state notes document the conditional restore rule and the new fixture case name"
    verification: []
    human_judgment: true
    rationale: "Documentation prose correctness is not captured by an automated test assertion; confirming the wording accurately reflects the shipped conditional-restore behavior needs a brief human read."

duration: 9min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 09: Draft-Safe Send-Failure Recovery Summary

**Conditional (draft-safe) `markMessageFailed` recovery closes WR-01 — the composer hook no longer clobbers the reducer-restored or a newer in-progress draft**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-10T04:38:30Z
- **Completed:** 2026-07-10T04:46:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `markMessageFailed` now restores the failed body to `composer.draft` only when the draft is currently empty; a non-empty (newer) draft is left untouched, closing the data-loss race flagged as WR-01 in `09-REVIEW.md`.
- Added the `markMessageFailedPreservesNewerDraft` cross-platform parity fixture (18th case), proving the conditional-restore behavior is part of the executable, platform-neutral contract.
- Removed the `use-chat-composer.ts` unconditional post-failure `setDraft("")`, which previously clobbered both the reducer-restored body and any newer draft the user had already started typing.
- Two component tests now prove the fix end-to-end through `ChatClient`: the restore-when-empty path and the delayed-failure-preserves-newer-draft race.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the reducer restore drafts conditionally and add the parity fixture** - `b0f88bb7` (fix)
2. **Task 2: Remove the post-failure clobber and align component tests** - `84c0ed35` (fix)

**Plan metadata:** _pending_ (docs: complete plan commit follows this summary)

## Files Created/Modified
- `packages/core/src/chat-state/reducer.ts` - `markMessageFailed` restores `composer.draft` from the failed body only when `composer.draft.length === 0`; otherwise the draft is left untouched
- `packages/core/src/chat-state/fixtures/chat-state-vectors.json` - new `markMessageFailedPreservesNewerDraft` parity fixture (newer draft survives a failure unchanged)
- `packages/core/docs/chat-state-protocol.md` - `markMessageFailed` row documents the conditional restore; fixture-name list includes the new case
- `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md` - paired fixture-name list kept in sync with the protocol doc (contract-ownership pairing)
- `apps/web/tests/chat-state-fixtures.test.ts` - registers `markMessageFailedPreservesNewerDraft` in the expected fixture-order array
- `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts` - removes the unconditional post-failure `setDraft(chat.conversationId, "")` clobber inside the failure branch
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - realigns the failure test to expect the restored draft (scoped to the log to avoid a textarea/bubble text collision); adds the delayed-failure-preserves-newer-draft regression test

## Decisions Made
- Conditional restore is keyed on `conversation.composer.draft.length === 0` — the exact signal the prior (unconditional) code already used to decide "there's nothing else to lose" — so no new state or flag was introduced to detect "a newer edit happened while sending."
- The composer hook now defers entirely to the reducer for post-failure draft recovery; it only sets notice text and marks the message failed. This keeps recovery logic in one place instead of split across two layers that could disagree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Kept the paired native chat-state notes fixture-list in sync**
- **Found during:** Task 1
- **Issue:** `chat-state-protocol.md`'s own "Contract Ownership" section states that any fixture-case change must update the protocol doc and the paired Phase 09 native companion (`09-NATIVE-CHAT-STATE-NOTES.md`) together. The plan's `files_modified` list only named `chat-state-protocol.md`; leaving the native doc's "current fixture cases" enumeration stale after adding `markMessageFailedPreservesNewerDraft` would leave the two canonical documents disagreeing about the current fixture set, violating a documented invariant this same plan's Task 1 was already editing.
- **Fix:** Added `markMessageFailedPreservesNewerDraft` to the native notes' fixture-case list, in the same list position as the protocol doc.
- **Files modified:** `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md`
- **Verification:** Direct text review; no automated test asserts this file's prose (documentation-only correctness, tracked as coverage `D4`).
- **Committed in:** `b0f88bb7` (Task 1 commit)

**2. [Rule 1 - Bug] Scoped the restored-draft bubble assertion to the conversation log**
- **Found during:** Task 2
- **Issue:** Once the fix landed, the composer draft and the failed message body hold the same restored text ("Please keep this draft."). React keeps a controlled `<textarea>`'s child text node in sync with its live value (via the DOM `defaultValue` proxy semantics), so `screen.getByText("Please keep this draft.")` matched both the textarea and the failed bubble, throwing a "Found multiple elements" test failure.
- **Fix:** Scoped the failed-bubble text assertion to `within(screen.getByRole("log", { name: "Conversation messages" }))`, matching the existing log-scoped query convention already used elsewhere in this test file.
- **Files modified:** `apps/web/app/(authenticated)/chat/chat-client.test.tsx`
- **Verification:** `pnpm --filter @fish/web test "app/(authenticated)/chat/chat-client.test.tsx"` — 39/39 pass.
- **Committed in:** `84c0ed35` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical documentation parity, 1 bug/test-ambiguity fix)
**Impact on plan:** Both deviations were small, directly required for correctness/consistency with the plan's own stated contract, and introduced no scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CSTATE-06's "no lost drafts" guarantee is now fully closed for both the immediate-failure and delayed-failure-after-newer-draft races; WR-01 from `09-REVIEW.md` is resolved.
- `IN-01` (`mergeReadState` monotonic ordering in `selectors.ts`) remains intentionally deferred per this plan's `closing_notes` — a separate concern this plan does not touch.
- Full gate is green: `pnpm --filter @fish/web test` (450/450), `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass. Ready for the next gap-closure plan (09-10) or phase re-verification.

## Self-Check: PASSED

All 8 claimed files found on disk; both task commit hashes (`b0f88bb7`, `84c0ed35`) found in git history.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*
