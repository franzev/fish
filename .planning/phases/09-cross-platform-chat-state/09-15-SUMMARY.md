---
phase: 09-cross-platform-chat-state
plan: 15
subsystem: ui
tags: [react, hooks, zustand, pagination, race-condition, generation-token, vitest]

# Dependency graph
requires:
  - phase: 10-chat-message-loading-optimization (10-04)
    provides: "The cursor-based 'load earlier' pagination hooks (useChatMessages.loadOlderMessages, useLoadOlderMessages.loadOlderAndPreserveScroll) and their existing test coverage that this plan hardens against conversation switching."
  - phase: 09-cross-platform-chat-state (09-13, 09-14)
    provides: "The hardened portable chat-state reducer/selectors and auth-identity-bound Zustand store whose per-conversation dispatches (applyOlderPage/markOlderPageFailed) this plan's conversationId capture now correctly targets even after a late-settling request."
provides:
  - "Per-conversation in-flight lock (loadingOlderConversationsRef, a Set<ChatConversationId>) replacing the single hook-wide isLoadingOlderRef boolean in useChatMessages"
  - "Generation-token stale-completion guard (latestOnLoadOlderRef) in useLoadOlderMessages that drops a completion whose onLoadOlder identity is no longer current"
  - "Cancelled/re-guarded scroll-restore requestAnimationFrame so a pending rAF from a switched-away conversation never writes another conversation's viewport"
  - "Two regression tests proving A cannot suppress B's first load and A's late completion cannot corrupt B's error state or transcript"
affects: [09-UAT, 09-VERIFICATION gap-closure round 4, 09-cross-platform-chat-state milestone audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generation token via a ref written only inside an effect (never during render, per the active react-hooks/refs ESLint rule) and read only from callback/async continuations -- the sanctioned way to detect 'has my identity gone stale' from inside a stale closure."

key-files:
  created: []
  modified:
    - apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
    - apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx

key-decisions:
  - "loadingOlderConversationsRef is a Set<ChatConversationId>, not a second boolean ref, so an arbitrary number of conversations can independently be in flight without one blocking another."
  - "The generation-token ref (latestOnLoadOlderRef) is written exclusively inside a useEffect keyed on onLoadOlder, never in the render body, because eslint-plugin-react-hooks@7.1.1's recommended config (used by eslint-config-next 16.2.9) includes the 'refs' rule (error, Recommended preset) that flags any ref access during render; reads happen only inside the useCallback body and its nested rAF callback, which are not render."
  - "The scroll-restore rAF handle and the stale-completion check share one guard (compare latestOnLoadOlderRef.current against the requestCallback captured before the await), so both the scrollTop write and the setHasOlderLoadError call are dropped together for a stale completion -- no separate flag needed."

patterns-established:
  - "React Compiler's active refs/purity rules mean this codebase's 'latest value visible to a stale async closure' need must go through effect-writes + callback-reads, not direct render-body ref mutation -- matches the existing previousOnLoadOlder/previousRealtimeStatus 'adjust state during render' idiom used elsewhere for the synchronous case."

requirements-completed: [CSTATE-02, CSTATE-03, CSTATE-06]

coverage:
  - id: D1
    description: "The older-load in-flight lock is scoped per conversation: an in-flight load in conversation A does not block or suppress conversation B's first sentinel-triggered load after the mounted client switches"
    requirement: CSTATE-02
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#does not let an in-flight load earlier request from conversation A suppress B's first load, and drops A's failure after the switch (WR-01)"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts (loadingOlderConversationsRef Set<ChatConversationId> replacing isLoadingOlderRef)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A stale older-load completion from a conversation the client has switched away from never writes the currently-shown conversation's local error state, and its returned page is never merged into the currently-shown conversation's transcript"
    requirement: CSTATE-03
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#does not let an in-flight load earlier request from conversation A suppress B's first load, and drops A's failure after the switch (WR-01)"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#does not merge a deferred conversation-A page into B's transcript after the switch (WR-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A stale older-load completion's captured scroll delta is never written into the viewport of a conversation the client has switched to (the scrollTop write is gated by the same generation-token check proven by D2, and any already-scheduled rAF from the old conversation is cancelled on switch)"
    verification:
      - kind: other
        ref: "apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts (scrollTop write and setHasOlderLoadError share one `if (latestOnLoadOlderRef.current !== requestCallback) return;` guard; pendingRafRef is cancelled in the effect cleanup keyed on onLoadOlder)"
        status: unknown
    human_judgment: true
    rationale: "jsdom's scrollHeight/scrollTop are inert (always 0 in this test environment), so an automated assertion cannot independently observe a wrongful scrollTop write. The guard is code-path-identical to the D2 error-state check (verified by source inspection), but direct visual confirmation of scroll preservation across a live conversation switch needs a human/browser pass -- track alongside 09-UAT.md."

# Metrics
duration: 15min
completed: 2026-07-10
status: complete
---

# Phase 9 Plan 15: Conversation-scope the "load earlier" pagination race (WR-01 closure) Summary

**Per-conversation in-flight lock plus a generation-token stale-completion guard in the pagination hooks so an older-load in conversation A can no longer gate, error, scroll-corrupt, or leak its page into conversation B after a live conversation switch.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-10T08:49:59Z
- **Completed:** 2026-07-10T09:05:20Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Replaced the hook-wide `isLoadingOlderRef` boolean in `useChatMessages` with `loadingOlderConversationsRef`, a `Set<ChatConversationId>` guard, so `loadOlderMessages` captures its own `requestConversationId` once and only ever reads/writes/locks that conversation -- an in-flight A no longer blocks or unlocks B.
- Added a generation-token guard (`latestOnLoadOlderRef`) to `useLoadOlderMessages`: `loadOlderAndPreserveScroll` captures the `onLoadOlder` identity before awaiting, and drops the completion (no scrollTop write, no `setHasOlderLoadError`) if that identity is no longer current when the await resolves.
- Hardened the scroll-restore `requestAnimationFrame`: the handle is stored in a ref, any previous pending handle is cancelled before scheduling a new one, the rAF callback itself re-checks the generation token before writing `scrollTop`, and a cleanup effect keyed on `onLoadOlder` cancels a pending handle on conversation switch or unmount.
- Added two regression tests that start a deferred older-load in conversation A, rerender the same mounted `ChatClient` to conversation B while A is still unsettled, and prove (a) B's own sentinel load is not suppressed and (b) settling A afterward -- as either failure or success -- never touches B's error state or transcript. Verified empirically that both tests fail against the pre-fix hooks (temporarily restored via `git show`, then reverted via `git checkout --`) before finalizing them.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scope the older-load in-flight lock per conversation** - `135689d2` (fix)
2. **Task 2: Ignore stale older-load completions and cancel stale rAF in the scroll wrapper** - `3579e0d0` (fix)
3. **Task 3: Deferred A-to-B switch tests (success and failure after rerender)** - `a309bf77` (test)

**Plan metadata:** pending (docs: complete plan, committed after this SUMMARY)

## Files Created/Modified
- `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` - `loadOlderMessages` now captures `requestConversationId` and guards/locks/dispatches on it via a per-conversation `Set` instead of a single hook-wide boolean ref.
- `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts` - `loadOlderAndPreserveScroll` compares a captured `onLoadOlder` against a `latestOnLoadOlderRef` (updated only inside an effect) after the await, dropping stale scroll/error writes; the scroll-restore rAF handle is tracked, cancelled, and re-checked.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Two new deferred A-to-B switch tests (failure-after-switch, success-after-switch) covering HV-02.

## Decisions Made
- `loadingOlderConversationsRef` is a `Set<ChatConversationId>` (not a second boolean) so any number of conversations can be independently in flight.
- The generation-token ref in `useLoadOlderMessages` is written only inside a `useEffect` keyed on `onLoadOlder`, never in the render body: `eslint-plugin-react-hooks@7.1.1`'s `recommended` config (consumed by `eslint-config-next@16.2.9`, confirmed via `pnpm lint`) includes the `refs` rule at `error`/`Recommended` severity, which flags any `ref.current` access during render. Reads happen only inside the `useCallback` body and its nested `requestAnimationFrame` callback -- both execute after render, matching the codebase's existing `viewportRef.current` read pattern in the same function.
- The scrollTop write and the `setHasOlderLoadError` call share one early-return guard, so a stale completion drops both together rather than needing two separate staleness checks.

## Deviations from Plan

None - plan executed exactly as written. The lint-rule research above shaped *how* Task 2's "ref holding the latest onLoadOlder" was implemented (effect-write / callback-read, rather than a direct render-body assignment), but the resulting behavior matches the plan's `<action>` text exactly: a ref-based generation token compared after the await, a cancelled/re-checked rAF, and a cleanup effect on `onLoadOlder` change/unmount.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WR-01 is closed: the "load earlier" pagination path is conversation/generation-owned. HV-02 (09-VERIFICATION.md) is now satisfiable -- A cannot gate B, write B's error, suppress B's first load, or restore A's scroll into B.
- Full gate green: `pnpm --filter @fish/web test chat-client` (50/50, including the two new tests), `pnpm --filter @fish/web test` (485/485 across 61 files), `pnpm typecheck` (3 workspaces), `pnpm lint`, and `pnpm build` (3 workspaces, all 17 routes) all pass.
- The single-conversation happy path is unchanged: all pre-existing pagination tests (auto-load, skeleton, retry, failure-gate reset, button-driven load) stay green with no `chat-client.tsx` edit.
- D3's scroll-preservation claim (coverage above) still needs a human/browser pass since jsdom cannot observe `scrollTop` -- track alongside `09-UAT.md` and the milestone audit's remaining human-verify items.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 3 modified files confirmed present on disk. All 3 task commits (`135689d2`, `3579e0d0`, `a309bf77`) confirmed in `git log`. Full verification re-run: `pnpm --filter @fish/web test chat-client` 50/50 pass (including both new WR-01 tests), `pnpm --filter @fish/web test` 485/485 pass (61 files), `pnpm typecheck` clean (3 workspaces), `pnpm lint` clean, `pnpm build` succeeds (3 workspaces, all 17 routes). Both new tests independently verified to fail against the pre-fix hook implementations (restored via `git show <pre-Task-1-commit>`, re-run, then reverted via `git checkout --`).
