---
phase: 10-chat-message-loading-optimization
plan: 03
subsystem: chat-web-state
tags: [zustand, react-hooks, supabase-realtime, chat-state, pagination, reconnect]

# Dependency graph
requires:
  - phase: 10-chat-message-loading-optimization
    provides: Portable pagination contract (hydrateWindow/olderMessagesRequested/olderPageLoaded/olderPageLoadFailed events, ChatPaginationState, ChatMessageCursor) from Plan 10-01
  - phase: 10-chat-message-loading-optimization
    provides: loadOlderMessagesAction/backfillMessagesAction/loadNewestMessagesAction direct-select reads and the bounded SSR window (ClientChatData.hasMoreOlder/oldestCursor) from Plan 10-02
provides:
  - Zustand store pagination dispatch wrappers (hydrateWindow, requestOlderMessages, applyOlderPage, markOlderPageFailed) plus selectors (selectHasMoreOlderForConversation, selectIsLoadingOlderForConversation, selectOldestCursorForConversation)
  - useChatMessages gains a guarded, Promise-returning loadOlderMessages and an applyGapBackfill callback; SSR/initial hydration now flows through hydrateWindow
  - useChatRealtime coalesces all three realtime channels' reconnects behind one per-channel first-subscribe tracker + shared in-flight lock, replacing three concurrent full-history refetches with one bounded backfill
  - The messages realtime channel emits a "disconnected" store status on CHANNEL_ERROR/TIMED_OUT/CLOSED (the signal Plan 04's calm offline UI renders)
  - Extended CSTATE-03 authority-boundary test coverage proving pagination state carries only client-cache values
affects: [10-04-chat-message-loading-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reconnect coalescing: a per-channel first-subscribe Set (keyed by channel identity, not a single shared boolean) plus one shared in-flight Promise ref, so N duplicated full-refetch-on-reconnect call sites collapse to exactly one bounded backfill regardless of how many channels resubscribe together"
    - "Deep-fallback optional prop: a new bounded callback (applyGapBackfill) is added as optional and preferred over the pre-existing required callback (refreshConversation), which stays wired as the fallback for callers that haven't migrated yet — avoids a synchronized rename across a file outside the plan's own scope"

key-files:
  created: []
  modified:
    - apps/web/app/(authenticated)/chat/store/chat-store.ts
    - apps/web/app/(authenticated)/chat/store/chat-selectors.ts
    - apps/web/app/(authenticated)/chat/store/chat-store.test.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
    - apps/web/app/(authenticated)/chat/realtime.ts

key-decisions:
  - "UseChatRealtimeOptions keeps refreshConversation required and adds applyGapBackfill as a new OPTIONAL prop, rather than renaming/replacing refreshConversation outright. chat-client.tsx (out of scope for this plan — Plan 04 wires the UI) still only passes refreshConversation; a hard rename would have broken its typecheck/build. handleReconnected picks applyGapBackfill ?? refreshConversation, so the bounded path is already preferred wherever a page injects backfillMessagesAction into useChatMessages, with zero changes required to any caller until Plan 04 does the UI wiring."
  - "Placed the createChatHydrationKey WHY-comment (documenting that pagination metadata deliberately rides outside the hydration hash) in chat-store.ts during Task 1, not Task 2 — chat-store.ts is Task 1's file, and the comment belongs next to the function it documents."
  - "loadOlderMessages derives the new oldest cursor from the first row of a non-empty returned page; on an empty page it keeps the previous cursor rather than resetting to null, so a defensive edge case (hasMoreOlder stale but a page returns nothing) can't accidentally erase a valid resume point."
  - "applyGapBackfill returns early when the conversation has no locally-known newest message (empty conversation), avoiding an avoidable round trip to backfillMessagesAction with an undefined afterCreatedAt/afterMessageId (the server action's zod schema would reject it gracefully either way, but skipping the call is more direct)."

patterns-established:
  - "One shared LoadOlderMessagesActionState interface (RefreshMessagesActionState extended with hasMoreOlder?/needsReset?/oldestCursor?/readStates?) covers all three bounded pagination/backfill/reset action props, instead of three near-identical interfaces — each real action populates only the subset it returns."

requirements-completed: [CLOAD-02, CLOAD-03, CLOAD-05, CLOAD-06]

coverage:
  - id: D1
    description: "Zustand store exposes hydrateWindow/requestOlderMessages/applyOlderPage/markOlderPageFailed dispatch wrappers and selectHasMoreOlderForConversation/selectIsLoadingOlderForConversation/selectOldestCursorForConversation selectors; an overlapping applyOlderPage page merges (dedups) through the single reducer path and a failed page load stays retryable"
    requirement: "CLOAD-03"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/store/chat-store.test.ts#pages older history through hydrateWindow/applyOlderPage without duplicating an overlapping page"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/store/chat-store.test.ts#leaves pagination retryable when an older page fails to load"
        status: pass
    human_judgment: false
  - id: D2
    description: "The CSTATE-03 authority boundary holds for pagination state: after hydrateWindow/applyOlderPage the conversation's pagination object contains only oldestLoadedCursor/hasMoreOlder/isLoadingOlder, no auth/role/assignment/token/service-role fields"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/store/chat-store.test.ts#keeps pagination as plain client-cache values with no auth/role/assignment/token authority"
        status: pass
    human_judgment: false
  - id: D3
    description: "useChatMessages' initial/SSR hydration flows through hydrateWindow carrying ClientChatData.hasMoreOlder/oldestCursor (falling back to false/null), preserving the existing hydration-key re-entry caching so a fresh server snapshot still wins over a stale cached one"
    requirement: "CLOAD-03"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx#uses the current server snapshot when the chat store has stale cached messages"
        status: pass
    human_judgment: false
  - id: D4
    description: "useChatMessages exposes a guarded, Promise-returning loadOlderMessages that dispatches requestOlderMessages, fetches an older keyset page via the injected loadOlderMessagesAction, and dispatches applyOlderPage or markOlderPageFailed; a second call while a load is already in flight is a no-op"
    requirement: "CLOAD-03"
    verification: []
    human_judgment: true
    rationale: "loadOlderMessages is not called by any current automated test — it is not yet wired into chat-client.tsx (that wiring is Plan 04's scope) and no renderHook-style harness was added for useChatMessages in isolation. Verified by pnpm typecheck (structural contract) and code review only; Plan 04's scroll-to-load-older UI and its tests are where this becomes end-to-end observable."
  - id: D5
    description: "applyGapBackfill merges a bounded backfill page through the single mergeRemoteMessage dispatch path, or on needsReset resets to the bounded newest window via loadNewestMessagesAction + hydrateWindow — never the unbounded refreshConversationAction; refreshConversation now routes through applyGapBackfill whenever a backfill action is injected"
    requirement: "CLOAD-06"
    verification: []
    human_judgment: true
    rationale: "applyGapBackfill and its needsReset branch are not exercised by any current automated test — no test simulates a reconnect gap or injects backfillMessagesAction/loadNewestMessagesAction into ChatClient. Verified by pnpm typecheck plus the grep-based structural checks in the plan's own acceptance criteria (needsReset -> loadNewestMessagesAction -> hydrateWindow, never refreshConversationAction); genuine behavioral proof needs either a dedicated reconnect-simulation test or Plan 04's end-to-end wiring."
  - id: D6
    description: "useChatRealtime coalesces all three channels' reconnects behind a per-channel first-subscribe tracker and one shared in-flight lock: each channel's first post-mount SUBSCRIBED is treated as an initial subscribe (no backfill), and a near-simultaneous re-subscribe across channels triggers exactly one bounded backfill instead of three full refreshConversation() calls"
    requirement: "CLOAD-06"
    verification: []
    human_judgment: true
    rationale: "The chat-client.test.tsx supabase mock's channel.subscribe.mockReturnValue(...) never invokes the status callback with SUBSCRIBED/CHANNEL_ERROR/TIMED_OUT/CLOSED, so the first-subscribe-skip and coalescing logic (and the pre-existing 'connected' emission it wraps) is proven only by static analysis: grep -c \"refreshConversation()\" is 0, pnpm typecheck passes, and the plan's own acceptance-criteria greps for handleReconnected/backfillInFlightRef all resolve. No current test drives the mock through a reconnect sequence to observe the coalescing empirically."
  - id: D7
    description: "The messages realtime channel surfaces CHANNEL_ERROR/TIMED_OUT/CLOSED via a new onDisconnected callback, flipping the store's realtime status to 'disconnected'; SUBSCRIBED still restores 'connected' and the live-insert mergeRemoteMessage path is unchanged"
    requirement: "CLOAD-02"
    verification:
      - kind: other
        ref: "grep -q CHANNEL_ERROR apps/web/app/(authenticated)/chat/realtime.ts; grep -n '\"connected\"|\"disconnected\"|\"connecting\"' apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts"
        status: pass
    human_judgment: true
    rationale: "No test drives the mocked channel's subscribe callback with a terminal status, so the 'disconnected' emission (and the pre-existing 'connected' emission it sits beside) is proven by static grep/typecheck, not runtime observation. Plan 04's calm offline/reconnect UI is the first consumer that will make this end-to-end testable."
  - id: D8
    description: "No regression to existing send/optimistic-message/realtime-merge/composer/reactions/read-state behavior; the full apps/web suite, build, lint, and typecheck stay green"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/chat-client.test.tsx (32 tests, full file)"
        status: pass
      - kind: other
        ref: "pnpm --filter @fish/web exec vitest run (437/437 tests); pnpm build; pnpm lint; pnpm typecheck"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-07-09
status: complete
---

# Phase 10 Plan 03: Wire the Pagination/Reconnect Brain into the Web Chat State Layer Summary

**Zustand pagination dispatch wrappers + selectors, a guarded loadOlderMessages/applyGapBackfill pair on the message hook, and one per-channel-guarded coalesced reconnect backfill replacing three concurrent full-history refetches in the realtime hook — closes the CLOAD-02/CLOAD-06 unbounded-reconnect gap the cross-AI review flagged HIGH.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-09T23:10:30Z (approx., first read after e1cfbb57)
- **Completed:** 2026-07-09T23:27:08Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `hydrateWindow`/`requestOlderMessages`/`applyOlderPage`/`markOlderPageFailed` dispatch wrappers to the Zustand `ChatStoreState`, plus `selectHasMoreOlderForConversation`/`selectIsLoadingOlderForConversation`/`selectOldestCursorForConversation` selectors — extended the CSTATE-03 authority-boundary test to prove pagination state is plain client-cache data (no auth/role/assignment/token/service-role fields) and that an overlapping older page dedups through the existing reducer merge path.
- Switched `useChatMessages`' SSR/initial hydration from `hydrateConversation` to `hydrateWindow`, carrying `ClientChatData.hasMoreOlder`/`oldestCursor` (defaulting to `false`/`null`), while leaving `createChatHydrationKey` keyed on messages + read states only (documented with a WHY comment — pagination metadata rides the same SSR payload, so it needs no place in the hash).
- Added a guarded, Promise-returning `loadOlderMessages` (in-flight ref guard, no-ops when `hasMoreOlder` is false) that requests, fetches, and applies an older keyset page through the store's pagination wrappers, and an `applyGapBackfill` that merges a bounded backfill page through the single `mergeRemoteMessage` path or — on `needsReset` — resets to the bounded newest window via `loadNewestMessagesAction` + `hydrateWindow`, never the unbounded `refreshConversationAction`.
- Consolidated the realtime hook's three duplicated `refreshConversation()`-on-reconnect call sites into one shared `handleReconnected(channelKey)`, guarded by a **per-channel** first-subscribe tracker (not a single shared boolean, since all three channels each fire their own initial post-mount `SUBSCRIBED`) plus one shared in-flight lock — a near-simultaneous reconnect across all three channels now produces exactly one bounded backfill.
- `subscribeToConversationMessages` gained an `onDisconnected` callback firing on `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`, wired to flip the store's realtime status to `"disconnected"` — the calm offline signal Plan 04's UI will render; `SUBSCRIBED` still restores `"connected"` and the live-insert merge path is untouched.
- Zero new dependencies; `supabase/migrations/` and `supabase/functions/chat-command/` untouched; `chat-client.tsx` untouched (its UI wiring is Plan 04's scope) and continues to typecheck/build/test green against the new, backward-compatible hook/store surface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pagination dispatch wrappers + selectors to the Zustand adapter and extend the web-only boundary test** - `dee99a03` (feat)
2. **Task 2: Add loadOlderMessages + applyGapBackfill (with loadNewest reset fallback) to the message hook and switch initial hydration to hydrateWindow** - `a641556e` (feat)
3. **Task 3: Consolidate the triplicated reconnect refetch into one per-channel-guarded coalesced backfill and emit a "disconnected" status** - `60ae081c` (feat)

**Plan metadata:** (pending — see final commit below)

## Files Created/Modified

- `apps/web/app/(authenticated)/chat/store/chat-store.ts` - `hydrateWindow`, `requestOlderMessages`, `applyOlderPage`, `markOlderPageFailed` methods; WHY comment on `createChatHydrationKey`
- `apps/web/app/(authenticated)/chat/store/chat-selectors.ts` - `selectHasMoreOlderForConversation`, `selectIsLoadingOlderForConversation`, `selectOldestCursorForConversation`
- `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` - Extended authority-boundary describe block with a pagination-shape/no-authority-leak test; new tests proving `applyOlderPage` dedup and failed-page retry-ability
- `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` - `LoadOlderMessagesActionState` interface; `loadOlderMessagesAction`/`backfillMessagesAction`/`loadNewestMessagesAction` option props; `loadOlderMessages`/`applyGapBackfill` callbacks; `hydrateWindow`-based SSR hydration; `refreshConversation` re-pointed to `applyGapBackfill` with the old full-refetch action retained as a deep fallback
- `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` - `ReconnectChannelKey`, `seenFirstSubscribeRef`, `backfillInFlightRef`, shared `handleReconnected(channelKey)`; optional `applyGapBackfill` option; `onDisconnected` wiring on the messages channel
- `apps/web/app/(authenticated)/chat/realtime.ts` - `subscribeToConversationMessages` gained an `onDisconnected?` parameter, invoked on `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`

## Decisions Made

- **Kept `refreshConversation` required, added `applyGapBackfill` as optional** on `UseChatRealtimeOptions` rather than renaming/replacing the option outright — `chat-client.tsx` (Plan 04's scope, not this plan's) still only passes `refreshConversation`, and a hard rename would have broken its typecheck. `handleReconnected` picks `applyGapBackfill ?? refreshConversation`, so the bounded path activates automatically the moment a caller injects `backfillMessagesAction` into `useChatMessages` (which already re-points its own returned `refreshConversation` to `applyGapBackfill` internally) — zero changes required to any out-of-scope caller before Plan 04 does the UI wiring.
- **`createChatHydrationKey`'s WHY comment landed in Task 1's commit** (chat-store.ts), not Task 2 — the file is Task 1's, and the comment belongs beside the function it documents.
- **`loadOlderMessages`'s new oldest cursor** falls back to the previous cursor (not `null`) when a fetched page happens to be empty, so a defensive edge case can't erase a valid resume point.
- **`applyGapBackfill` no-ops on an empty conversation** (no locally-known newest message) before calling `backfillMessagesAction`, avoiding an unnecessary round trip.
- See frontmatter `key-decisions` for the full list with rationale.

## Deviations from Plan

None - plan executed exactly as written. All five cross-AI review incorporation items called out in the plan's `<review_incorporation>` (per-channel first-subscribe tracking; `loadNewestMessagesAction` reset fallback instead of the unbounded refetch; the corrected `subscribeAfterAuth` threat-model wording; `createChatHydrationKey` staying keyed on messages/read-states only; `refreshConversationAction` retained as a deep fallback with reconnect no longer calling it in the normal path) were implemented exactly as specified — no separate deviation was needed to satisfy them. The interpretive decisions above (documented under Decisions Made, not here) were resolving genuinely underspecified implementation details, not corrections to broken plan text; every acceptance-criteria grep and verification command in the plan passed on the first run for every task, with no bugs discovered mid-execution.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan touches only the Zustand store, two hooks, and one realtime helper module in `apps/web`; no new dependencies, no schema/migration, no environment variables.

## Next Phase Readiness

- `loadOlderMessages`, `applyGapBackfill`, `hasMoreOlder`, and `isLoadingOlder` are returned from `useChatMessages` but intentionally not yet consumed by `chat-client.tsx` — that UI wiring (scroll-to-load-older affordance, the calm offline/reconnect banner reading `selectRealtimeStatusForConversation`'s new `"disconnected"` value, and threading `loadOlderMessagesAction`/`backfillMessagesAction`/`loadNewestMessagesAction` down from the page component) is Plan 04's explicit scope ("this is the behavior 'brain' — Plan 04 renders it"). This is a deliberate wave boundary, not a stub: the hook/store surface is fully implemented, typechecked, and structurally verified; it is simply unrendered until Plan 04.
- Three coverage deliverables (D4/D5/D6/D7) are marked `human_judgment: true` because no current automated test drives the mocked realtime channel through a reconnect sequence or calls `loadOlderMessages`/`applyGapBackfill` directly — `chat-client.test.tsx`'s `subscribe.mockReturnValue(...)` never invokes the status callback. Plan 04 should either add a dedicated reconnect-simulation test when it wires the UI, or accept manual/UAT verification (toggling network, scrolling to load older history) as the closing proof for CLOAD-02/CLOAD-03/CLOAD-06 at the phase level.
- No blockers. `pnpm typecheck`, `pnpm build`, `pnpm lint`, and the full `apps/web` vitest suite (437 tests, up from 434 at baseline) are green at HEAD. `git status` confirms no changes outside the six files this plan declared, and no package.json/pnpm-lock.yaml changes (zero new dependencies).

---
*Phase: 10-chat-message-loading-optimization*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 6 modified files confirmed present via `[ -f ]`; all 3 task commit hashes (`dee99a03`, `a641556e`, `60ae081c`) confirmed in `git log --oneline --all`. Plan-level verification re-run clean: `vitest run "app/(authenticated)/chat"` (74/74 passed), `pnpm typecheck` (all 3 workspace packages), `pnpm build`, `pnpm lint`, and the full `apps/web` suite (437/437 passed). `git diff --stat` confirms exactly the 6 files this plan declared were touched, with no `package.json`/`pnpm-lock.yaml` changes.
