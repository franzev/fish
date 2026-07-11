---
phase: 09-cross-platform-chat-state
plan: 11
subsystem: ui
tags: [react, vitest, tailwind, chat, community-room, accessibility]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state
    provides: "Plan 09-10's committed chat-client.test.tsx state (file-ownership sequencing)"
provides:
  - "Pure, unit-tested belongsToSameMessageGroup predicate (same sender + same calendar day + 5-minute gap)"
  - "Community room avatar/MessageMeta reappearance after a long same-sender run or day boundary (closes WR-02)"
  - "Truthful offline banner copy with no promise of an offline queue (closes WR-03)"
  - "56px touch-safe message-action controls with a pointer-coarse reveal (closes WR-04)"
affects: [10-chat-message-loading-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grouping predicates live as pure functions in dedicated modules (message-grouping.ts) rather than inline booleans in the component, so the presentation rule is independently unit-testable"

key-files:
  created:
    - apps/web/app/(authenticated)/chat/message-grouping.ts
    - apps/web/app/(authenticated)/chat/message-grouping.test.ts
  modified:
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx
    - .claude/skills/sketch-findings-fish/references/states.md

key-decisions:
  - "MESSAGE_GROUP_GAP_MS fixed at 5 minutes (300000ms), documented as a short, defensible cutoff distinct from senderId-only grouping"
  - "Offline copy changed to 'You're offline. Reconnect, then try again.' — never promises automatic/background send since no offline queue exists"
  - "Message action controls resized from size-10 (40px) to min-h-control/min-w-control (56px), with a pointer-coarse: reveal alongside the existing hover/focus-within reveal so touch users reach actions without hover"

patterns-established:
  - "Presentation predicates that gate identity/time visibility (avatar, MessageMeta) are pure, imported, and unit-tested rather than inlined comparisons"

requirements-completed: [CSTATE-06]

coverage:
  - id: D1
    description: "Pure belongsToSameMessageGroup predicate groups only same sender + same calendar day + <=5min gap; five behavior cases unit-tested"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "app/(authenticated)/chat/message-grouping.test.ts#belongsToSameMessageGroup"
        status: pass
    human_judgment: false
  - id: D2
    description: "Community room avatar and MessageMeta (author name) reappear on a same-sender message after the grouping gap, instead of staying suppressed indefinitely"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "app/(authenticated)/chat/chat-client.test.tsx#re-shows the author name and avatar on a same-sender community message after the grouping gap"
        status: pass
    human_judgment: false
  - id: D3
    description: "Offline banner shows calm, truthful copy ('Reconnect, then try again.') and no longer promises automatic/background send"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "app/(authenticated)/chat/chat-client.test.tsx#shows a calm notice-tone offline state (never an error tone) when the realtime status is disconnected"
        status: pass
    human_judgment: false
  - id: D4
    description: "Message action controls (reply, react, edit, delete) meet the 56px touch floor (min-h-control/min-w-control, not size-10) and reveal on coarse pointers without hover"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "app/(authenticated)/chat/chat-client.test.tsx#sizes revealed message-action controls to the 56px touch floor, not the old 40px size"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 11: Community Presentation Warnings Closure Summary

**Same-sender message grouping now requires a same-day, <=5-minute gap (not senderId alone), the offline banner no longer promises an automatic queued send, and message-action controls meet the 56px touch floor with a pointer-coarse reveal.**

## Performance

- **Duration:** 6 min (commit span 13:24:38 -> 13:30:30, 2026-07-10)
- **Started:** 2026-07-10T13:24:38+08:00
- **Completed:** 2026-07-10T13:30:30+08:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Extracted a pure `belongsToSameMessageGroup(previous, current)` predicate (`MESSAGE_GROUP_GAP_MS = 300000`) requiring same sender, same calendar day, and a <=5-minute gap; wired into `chat-client.tsx` in place of the senderId-only comparison, restoring avatar/`MessageMeta` visibility after a long same-sender run or a day boundary in the community room (closes WR-02, the user's missing avatar/time UAT report)
- Replaced the offline banner's "Messages will send when you're back." with truthful "You're offline. Reconnect, then try again." and updated `states.md` to match, adding a note that no offline queue exists — a failed send stays a real, manual Retry (closes WR-03)
- Resized the four message-action controls (Reply, react, Edit, Delete) from `size-10` (40px) to `min-h-control min-w-control` (56px) and added a `pointer-coarse:` reveal alongside the existing hover/focus-within reveal, so touch/coarse-pointer users reach actions without hovering (closes WR-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the pure message-grouping predicate and unit tests** - `e0c18da6` (test, RED) -> `7988958c` (feat, GREEN)
2. **Task 2: Wire grouping, fix offline copy, and restore 56px touch-safe actions** - `5a9f7727` (fix)
3. **Task 3: Component tests for grouping, offline copy, and action sizing** - `ca903044` (test)

**Plan metadata:** (this commit — docs: complete plan)

_Note: Task 1 is TDD (test -> feat); Tasks 2-3 are single commits._

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the RED/GREEN gate sequence in git log order:
- RED: `e0c18da6` `test(09-11): add failing test for message-grouping predicate`
- GREEN: `7988958c` `feat(09-11): implement pure message-grouping predicate`

Both gates present in the correct order. No REFACTOR commit was needed.

## Files Created/Modified
- `apps/web/app/(authenticated)/chat/message-grouping.ts` - Pure `belongsToSameMessageGroup` predicate + `MESSAGE_GROUP_GAP_MS` (5 min)
- `apps/web/app/(authenticated)/chat/message-grouping.test.ts` - Five behavior-case unit tests (within cutoff, outside cutoff, cross-day, different sender, no previous)
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - Grouping wired to the shared predicate; truthful offline copy; 56px touch-safe action controls with `pointer-coarse:` reveal
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Fixed the stale offline-copy assertion (was asserting the retired "will send when you're back" text) and added grouping-reappearance and action-sizing tests
- `.claude/skills/sketch-findings-fish/references/states.md` - Offline copy corrected to match; note added that no offline queue exists so future work does not re-seed the overpromise

## Decisions Made
- Kept the 5-minute grouping gap and same-calendar-day rule as documented constants (`MESSAGE_GROUP_GAP_MS`) rather than a magic number inline, so the cutoff is discoverable and independently testable
- Chose "Reconnect, then try again." over any wording implying automatic retry — the design skill's `states.md` and the code now share one source of truth for this copy
- Applied the 56px floor as the non-negotiable design constraint per AGENTS.md, superseding the sketch reference's compact hover-only bar (documented in-code as a design-tension comment); kept the hover reveal as a fine-pointer enhancement alongside the new `pointer-coarse:` reveal

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 (message-grouping predicate + wiring/copy/sizing) were already completed and committed (`e0c18da6`, `7988958c`, `5a9f7727`) before this execution session began; this session verified those commits, then completed Task 3 (component tests), fixing one pre-existing stale test assertion in `chat-client.test.tsx` (the offline-copy test still asserted the retired "will send when you're back" text after Task 2's copy change) as part of Task 3's explicit scope — updating that assertion is exactly what Task 3's acceptance criteria call for, not a deviation from it.

## Issues Encountered
- The pre-existing offline-copy test in `chat-client.test.tsx` (added before this plan) asserted the old promise-laden copy and would fail against the already-wired truthful copy from Task 2. Fixed as part of Task 3 (in scope for this task's acceptance criteria: "the offline banner text contains 'Reconnect' and not 'will send when you're back'").
- Initial draft of the grouping-reappearance test used `getByLabelText` to assert the avatar reappeared, but `Avatar` renders initials as `aria-hidden` (no accessible name) when no image `src` is provided. Adjusted the assertion to check for the visible initials text ("SO"), matching the existing avatar-assertion pattern already used elsewhere in this test file (`getByText("CD")`).

## Next Phase Readiness
- Full verification suite green: `pnpm --filter @fish/web test` (460/460), `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
- All three community-presentation warnings (WR-02, WR-03, WR-04) from the Phase 09 code review are closed.
- Phase 09 has no more planned plans (09-01 through 09-11 complete); next planned work is Phase 10 (chat-message-loading-optimization), already scoped and ready per STATE.md.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files found on disk; all task and metadata commit hashes (`e0c18da6`, `7988958c`, `5a9f7727`, `ca903044`, `65d8217d`) verified present in git log.
