---
phase: 09-cross-platform-chat-state
plan: 16
subsystem: ui
tags: [react, hooks, zustand, realtime, pagination, layout-stability, css-tokens, vitest]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state (09-13, 09-15)
    provides: "The hardened portable chat-state reducer (mergeHydratedMessages hydrate-preserve, markMessageFailed monotonic guard) and the per-conversation older-load lock/generation-token guard this plan's web regressions and geometry fix build on."
provides:
  - "Conversation-scoped reset of participant/local realtime transients (typing, recording, local typing flag, pending timers) in useChatRealtime, via a previousConversationId render-time comparison"
  - "Per-conversation hasConnected/previousRealtimeStatus reset in ChatClient so a mounted conversation switch never mislabels the new conversation's ordinary first connect as a reconnect"
  - "A single reserved-height data-testid=\"load-older-slot\" container hosting the loading skeleton, error+retry affordance, and idle Load-earlier button, backed by a new --size-pagination-slot/--spacing-pagination-slot token pair"
  - "Web-layer regressions proving the 09-13 reducer fixes at the ChatClient UI layer: a pending optimistic row survives a reconnect-reset hydrateWindow (WR-02), and a realtime-confirmed sent row stays sent through a later stale failure (WR-03)"
affects: [09-UAT, 09-VERIFICATION gap-closure round 4, 09-cross-platform-chat-state milestone audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conversation-scoped STATE resets (participantTyping/participantRecording/localRecording, hasConnected) go through the render-time 'adjusting state when a prop changes' comparison already established for previousRealtimeStatus; conversation-scoped REF resets (localTypingRef, pending timeout refs) stay inside the existing per-conversation effect, since eslint-plugin-react-hooks' refs rule forbids ref reads/writes during render."
    - "Invariant-geometry regions (WR-07) use one reserved-height wrapper with a semantic @theme token, matching the Button component's existing 'no state change may alter the rendered size' convention."

key-files:
  created: []
  modified:
    - apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx
    - apps/web/app/globals.css

key-decisions:
  - "localTypingRef and the three pending typing/recording timeout refs reset inside the existing [chat.conversationId]-keyed effect, not in the render-time block alongside the three state resets, because the project's react-hooks/refs ESLint rule (error severity) forbids ref access during render; localTypingRef is never read during rendering (only inside event-handler-triggered callbacks), so a post-commit effect reset satisfies the behavioral intent without breaking pnpm lint."
  - "The pagination-feedback reserved height (104px) is sized to exactly fit the tallest existing state (the two-row loading skeleton: 48px + 8px gap + 48px), so the skeleton fills the slot exactly and the shorter error/button states are vertically centered within it via justify-center."
  - "The WR-02 web regression's loadNewestMessagesAction mock returns hasMoreOlder: true so the 'Load earlier messages' button appearing becomes an observable, poll-friendly (findByRole) proof that the async backfillMessagesAction -> loadNewestMessagesAction -> hydrateWindow chain actually landed, instead of counting microtask ticks."

patterns-established:
  - "Same-mounted-instance conversation-switch regressions use React Testing Library's rerender (not unmount+render) with a second conversationId on the same chat fixture, matching the WR-01 pattern from 09-15."

requirements-completed: [CSTATE-02, CSTATE-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Switching the mounted client from conversation A to B resets participant typing/recording, local recording, and the local typing flag/timers -- none bleed from A into B"
    requirement: CSTATE-02
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#resets the participant typing indicator when a mounted client switches conversations (WR-06)"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#resets every conversation-scoped realtime transient via a previousConversationId render-time comparison (WR-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "B's first realtime connect never reads as 'Reconnecting…' because of A's prior connected state"
    requirement: CSTATE-02
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#resets hasConnected per conversation so B's first connect never reads as a reconnect (WR-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The older-page feedback region holds an invariant height across idle, loading, failure, and retry-success states, so the transcript never shifts"
    requirement: CSTATE-06
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#keeps the same reserved-height load-older-slot across idle, loading, and error states (WR-07)"
        status: pass
    human_judgment: true
    rationale: "jsdom does not compute real CSS layout/pixel height, so the automated test proves the structural invariant (one persistent DOM node, one semantic min-height token class across all three states) but cannot independently measure that the transcript literally never shifts on screen. A real-browser/HV-01 pass (09-VERIFICATION.md, 09-UAT.md) remains the authority for the pixel-level claim."
  - id: D4
    description: "A pending optimistic row survives a reconnect reset (web), and a later send failure correctly marks it failed with the draft restored"
    requirement: CSTATE-06
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#keeps a pending optimistic row through a reconnect-reset hydrateWindow, then marks it failed on a later send failure (WR-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A late send-action failure after a realtime-confirmed sent leaves the row sent (web), proving the reducer's monotonic status guard at the UI layer"
    requirement: CSTATE-06
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#keeps a realtime-confirmed sent row sent when the original send action later settles as a failure (WR-03)"
        status: pass
    human_judgment: false

# Metrics
duration: 36min
completed: 2026-07-10
status: complete
---

# Phase 9 Plan 16: Conversation-scoped realtime reset, invariant pagination geometry, and WR-02/WR-03 web regressions Summary

**Render-time conversation-scoped resets close WR-06 (typing/recording/hasConnected bleed across a live conversation switch), a single reserved-height load-older-slot closes WR-07, and two new ChatClient tests prove the 09-13 portable-reducer fixes (WR-02/WR-03) hold at the web UI layer.**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-07-10T09:28:00Z
- **Completed:** 2026-07-10T10:04:07Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Closed WR-06 (transient bleed): `useChatRealtime` resets `participantTyping`/`participantRecording`/`localRecording` via a `previousConversationId` render-time comparison, and clears `localTypingRef` plus the three pending typing/recording timeout refs in the existing per-conversation effect, so a mounted client switching from conversation A to B never carries A's typing/recording activity into B.
- Closed WR-06 (hasConnected bleed): `ChatClient` now resets `hasConnected`/`previousRealtimeStatus` whenever `chat.conversationId` changes, so B's ordinary first "connecting" status is never mislabeled "Reconnecting…" just because A happened to be connected before the switch.
- Closed WR-07 (pagination layout shift): consolidated the loading skeleton, error+retry affordance, and idle "Load earlier messages" button into one `data-testid="load-older-slot"` wrapper with a new invariant `min-h-pagination-slot` (104px) reserved height, backed by new `--size-pagination-slot`/`--spacing-pagination-slot` `@theme` tokens in `globals.css` — no one-off numeric height utilities.
- Added the verifier's requested web-layer regressions on top of the 09-13 reducer fixes: a pending optimistic send survives a reconnect-reset `hydrateWindow` whose bounded window omits it (WR-02), and a realtime-confirmed sent row stays sent through a later stale send-action failure thanks to the reducer's monotonic status guard (WR-03).
- 6 new tests added to `chat-client.test.tsx` (56 total, up from 50); full web suite now 493/493 (up from 487); `pnpm build`, `pnpm lint`, `pnpm typecheck` all green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reset participant/local realtime transients on conversation change** - `e3a0f6ab` (fix)
2. **Task 2: Per-conversation hasConnected reset + invariant pagination-feedback geometry** - `ece26945` (fix)
3. **Task 3: Web regressions — pending survives reconnect reset (WR-02) and sent stays sent (WR-03)** - `a1752b52` (test)

**Plan metadata:** pending (docs: complete plan, committed after this SUMMARY)

## Files Created/Modified
- `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` - `previousConversationId` render-time reset of `participantTyping`/`participantRecording`/`localRecording`; `localTypingRef` and the three pending timeout refs cleared in the existing `[chat.conversationId]`-keyed effect.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - `previousConversationId`-gated `hasConnected`/`previousRealtimeStatus` reset; the pagination feedback region consolidated into one `min-h-pagination-slot` wrapper hosting skeleton/error/button.
- `apps/web/app/globals.css` - new `--size-pagination-slot` (104px) and `--spacing-pagination-slot` `@theme` tokens powering `min-h-pagination-slot`.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - 6 new tests: 1 source assertion (WR-06 reset pattern) + 5 behavioral (WR-06 typing reset, WR-06 hasConnected reset, WR-07 geometry, WR-02, WR-03).

## Decisions Made
- `localTypingRef` and the three pending typing/recording timeout refs reset inside the existing per-conversation effect rather than the render-time block, because the project's active `react-hooks/refs` ESLint rule forbids ref access during render; `localTypingRef` is never read during rendering, so an effect-based reset is behaviorally equivalent.
- The pagination-feedback reserved height (104px) exactly matches the tallest existing state (the two-row skeleton), so the skeleton fills the slot and the shorter error/button states are vertically centered within it.
- The WR-02 regression's `loadNewestMessagesAction` mock returns `hasMoreOlder: true` specifically so the "Load earlier messages" button appearing becomes an observable, `findByRole`-pollable proof that the async `backfillMessagesAction -> loadNewestMessagesAction -> hydrateWindow` chain has actually landed, avoiding fragile microtask-tick counting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved localTypingRef/timeout-ref resets from the render body into the existing per-conversation effect**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` text asked to reset `localTypingRef.current = false` inside the same render-time "adjusting state when a prop changes" block as the three state resets (`setParticipantTyping`, `setParticipantRecording`, `setLocalRecording`). This project's active ESLint rule (`eslint-plugin-react-hooks`'s `refs` rule, error severity — confirmed in the plan's own project notes and by the prior 09-15 plan's identical finding) forbids any ref read/write during render. Implementing the literal instruction would fail `pnpm lint`, which the plan's own `<verification>` block requires to stay green.
- **Fix:** Kept the three STATE resets in the render-time comparison exactly as specified, but moved `localTypingRef.current = false` plus the three pending-timeout-ref clears into the existing `[chat.conversationId]`-keyed `useEffect` (the same one already resetting `seenFirstSubscribeRef`/`backfillInFlightRef`). `localTypingRef` is never read during rendering (only inside event-handler-triggered callbacks), so the post-commit effect reset satisfies the WR-06 behavioral intent identically — every acceptance-criteria assertion (new WR-06 test, source assertion, "no react-hooks/set-state-in-effect violation") still passes.
- **Files modified:** `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts`
- **Verification:** `pnpm --filter @fish/web lint` clean (0 errors, 0 warnings); new WR-06 tests pass; full suite green.
- **Committed in:** `e3a0f6ab` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Placement-only adjustment (effect vs. render) required to keep the build/lint gate green; the resulting behavior matches the plan's stated intent exactly. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WR-06 and WR-07 are closed; WR-02/WR-03 now have web-layer regressions — matches the plan's `<success_criteria>` exactly.
- HV-01 (stable notice-tone retry region, no transcript movement) is now structurally satisfiable via the reserved `load-older-slot`; the pixel-level confirmation still needs a real-browser pass, since jsdom cannot measure layout — track alongside `09-UAT.md` and the milestone audit's other pending human-verify items (see D3 coverage rationale above).
- Full gate green: `pnpm --filter @fish/web test chat-client` (56/56, including all 6 new tests), `pnpm --filter @fish/web test` (493/493 across 61 files), `pnpm typecheck` (3 workspaces), `pnpm lint` (0 errors), `pnpm build` (3 workspaces, all 17 routes).
- No new client choice, no new primary action, and the 56px control floor is preserved throughout (`Button`'s base `min-h-control` is unchanged by the pagination-region restructuring).

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 4 modified files confirmed present on disk (`use-chat-realtime.ts`, `chat-client.tsx`, `chat-client.test.tsx`, `globals.css`). All 3 task commits (`e3a0f6ab`, `ece26945`, `a1752b52`) confirmed in `git log`. `chat-client.test.tsx` confirmed at 56 `it(...)` blocks (50 pre-existing + 6 new). Full verification re-run at the final commit state: `pnpm --filter @fish/web test chat-client` 56/56 pass, `pnpm --filter @fish/web test` 493/493 pass (61 files), `pnpm --filter @fish/web lint` clean (0 errors, 0 warnings), `pnpm --filter @fish/web typecheck` clean, `pnpm build` succeeds (3 workspaces, all 17 routes). Compiled CSS independently confirmed to contain `min-h-pagination-slot{min-height:var(--spacing-pagination-slot)}`.
