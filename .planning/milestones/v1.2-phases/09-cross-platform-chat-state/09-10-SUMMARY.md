---
phase: 09-cross-platform-chat-state
plan: 10
subsystem: chat
tags: [zustand, react-hooks, realtime, vitest, supabase-realtime]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state (plan 09)
    provides: "Composer draft-restore fix; both plans touch chat-client.test.tsx (file-ownership sequencing only, not a logical dependency)"
provides:
  - "Realtime status resets to idle when the message-subscription cleanup runs, so a revisit after unmount starts from an ordinary first connect instead of stale connected/reconnecting"
  - "Per-conversation reset of the first-subscribe tracker and backfill in-flight lock on conversationId change"
  - "Single dispatch path for realtime read-state payloads (mergeReadState only), removing the duplicate direct dispatchChatEvent call"
  - "Regression tests proving idle-on-cleanup, no false 'Reconnecting…' on revisit, and exactly one store transition per read payload"
affects: [chat-realtime, chat-store, phase-10-reconnect-coalescing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Message-subscription effect cleanup resets store realtime status to idle (only the message channel owns connected/disconnected/idle status), so a fresh mount never inherits a stale 'connected' reading as a reconnect"
    - "Per-conversation useEffect (keyed on conversationId) resets reconnect-tracking refs before the subscription effects run, isolating one conversation's reconnect history from the next"
    - "Realtime payload handlers route through exactly one store action call (no parallel direct dispatchChatEvent + injected-callback double dispatch)"

key-files:
  created: []
  modified:
    - "apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts"
    - "apps/web/app/(authenticated)/chat/chat-client.test.tsx"

key-decisions:
  - "Reset seenFirstSubscribeRef/backfillInFlightRef in a dedicated useEffect keyed on [chat.conversationId], placed before the subscription effects, rather than inline in the message effect — keeps the reset visible as its own concern and independent of which channel fires first."
  - "Only the message channel's cleanup writes 'idle' status; reads/reactions channels never call setRealtimeStatus, so the idle reset cannot falsely mark another surface as disconnected."
  - "Kept the injected mergeReadState callback as the sole read-state dispatch path (removed the direct dispatchChatEvent call) since it already routes through one store action; dispatchChatEvent remains used by the message effect for mergeRemoteMessage and stays in that effect's deps only."
  - "Added a local `latestSubscribeStatusCallback` test helper because channel.subscribe/client.channel mock call history accumulates across every test in the file (no clearMocks) — tests must search from the end to capture their own subscribe call, not an earlier test's."

requirements-completed: [CSTATE-03, CSTATE-06]

coverage:
  - id: D1
    description: "Message-subscription cleanup resets conversation realtime status to idle on unmount, so revisiting the same conversation is not mislabeled as 'Reconnecting…' on an ordinary first connect"
    requirement: "CSTATE-06"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#resets realtime status to idle on unmount so a revisit is not mislabeled as reconnecting"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-channel first-subscribe tracker and backfill in-flight lock reset when conversationId changes"
    requirement: "CSTATE-06"
    verification:
      - kind: other
        ref: "grep source assertion: useEffect keyed on [chat.conversationId] resets seenFirstSubscribeRef.current and backfillInFlightRef.current (per Task 1 acceptance criteria); pnpm --filter @fish/web typecheck && lint pass"
        status: pass
    human_judgment: true
    rationale: "Task 1's own acceptance criteria specified a source assertion (not a behavior test) for this item. No automated test in this plan exercises a live conversationId swap on an already-mounted instance (the new tests only cover unmount/remount, where a fresh useRef trivially starts empty regardless of the effect) — a human/reviewer should confirm the static proof is sufficient, or a future plan should add a targeted same-mount conversation-swap test."
  - id: D3
    description: "Each realtime read-state payload produces exactly one store transition (duplicate direct dispatch removed) while read state still merges correctly"
    requirement: "CSTATE-03"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#dispatches exactly one store transition per realtime read-state payload"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 10: Realtime Lifecycle Reset and Single Read-State Dispatch Summary

**Fixed two review-flagged realtime bugs in `useChatRealtime` (WR-05 stale connection status across mounts, WR-06 duplicate read-state dispatch) with two new regression tests, both of which were verified to fail against the pre-fix code.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-10T04:49:00Z (estimated)
- **Completed:** 2026-07-10T05:07:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- The message-subscription effect now captures its `unsubscribe` function and returns a cleanup that unsubscribes and then resets the conversation's realtime status to `"idle"` — so unmounting (or switching conversations) never leaves a stale `"connected"` status for the next mount to misread as a reconnect.
- A new `useEffect` keyed on `[chat.conversationId]`, declared before the subscription effects, resets `seenFirstSubscribeRef` and `backfillInFlightRef` so a new conversation's first subscribes are never mistaken for reconnects and its backfill is never suppressed by the previous conversation's in-flight lock.
- The read-state subscription callback now calls `mergeReadState(readState)` exactly once (the injected store-action path); the redundant direct `dispatchChatEvent({ type: "mergeReadState", ... })` call was removed, along with the now-unused `dispatchChatEvent` dependency on that effect.
- Added a lifecycle test (render, drive `SUBSCRIBED`, unmount, assert `idle`; remount and assert no false "Reconnecting…") and a single-dispatch test (subscribe a counter to the store, invoke the read handler once, assert the transition delta is exactly 1 and the read state merged).
- Verified both new tests actually catch the original bugs: temporarily reverted the Task 1 fix in place, reran the two tests (both failed with the expected pre-fix symptoms — `"connected"` instead of `"idle"`, and a transition delta of `2` instead of `1`), then restored the committed fix via `git checkout --` and confirmed the full suite is green again.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reset realtime lifecycle per conversation and dispatch read state once** - `03e30f21` (fix)
2. **Task 2: Test the lifecycle reset and single read-state transition** - `fd87b2ee` (test)

**Plan metadata:** (this commit) `docs(09-10): complete realtime lifecycle plan`

## Files Created/Modified
- `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` - Per-conversation ref reset effect; message-subscription cleanup now unsubscribes and resets status to idle; read-subscription callback dispatches `mergeReadState` once instead of twice
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Adds `latestSubscribeStatusCallback` test helper, an unmount/remount lifecycle test, and a single-store-transition-per-read-payload test

## Decisions Made
- Reset refs in a dedicated `useEffect` before the subscription effects, rather than inline, to keep the "new conversation resets reconnect history" concern independently visible and testable.
- Scoped the idle-reset to the message channel's cleanup only, since it is the sole owner of connected/disconnected/idle status — reads/reactions channels cannot be falsely marked disconnected by this change.
- Kept the injected `mergeReadState` callback as the one dispatch path for read-state payloads rather than the direct store event, since it already routes through the same store action.
- Added a small test-file helper (`latestSubscribeStatusCallback`) instead of reworking the shared `realtimeMock` harness, since `channel.subscribe`/`client.channel` mock call history accumulates across every test in the file (no `clearMocks` configured) — searching from the end is the only reliable way to capture a given test's own subscribe call.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. As an extra diligence step (not required by the plan's acceptance criteria, which only specify running the test command), the Task 1 fix was temporarily reverted in place and the two new tests were rerun to confirm they fail without it — this ruled out both tests being vacuously true (e.g., the "idle" fallback in `selectRealtimeStatusForConversation` also applies when a conversation entry is missing entirely, so the assertion needed to be checked against a genuinely fixed-vs-broken implementation, not just the selector's default). Both tests failed with the expected pre-fix symptoms, and the fix was restored via `git checkout -- apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` (a targeted single-file restore to the already-committed Task 1 state, not a blanket reset).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-05 and WR-06 from the Phase 09 code review (`09-REVIEW.md`) are closed. `09-11-PLAN.md` (the next gap-closure plan in this round) is unaffected by these changes and remains ready to execute.
- Full repo gates pass: `pnpm --filter @fish/web test` (452/452), `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- The Phase 10 reconnect-coalescing design (per-channel first-subscribe `Set` + single in-flight lock) is preserved unchanged; this plan only adds a per-conversation reset of those same refs and an idle cleanup.

## Self-Check: PASSED

- FOUND: `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts`
- FOUND: `apps/web/app/(authenticated)/chat/chat-client.test.tsx`
- FOUND: commit `03e30f21` (fix(09-10): reset realtime lifecycle per conversation and dispatch read state once)
- FOUND: commit `fd87b2ee` (test(09-10): cover realtime lifecycle reset and single read-state dispatch)
- All task `<acceptance_criteria>` re-verified: source assertions via grep, `pnpm --filter @fish/web typecheck`, `pnpm --filter @fish/web lint`, and the focused test command all pass.
- Plan-level `<verification>` re-run: `pnpm --filter @fish/web test` (452/452), `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*
