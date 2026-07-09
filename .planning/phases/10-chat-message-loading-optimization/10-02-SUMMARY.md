---
phase: 10-chat-message-loading-optimization
plan: 02
subsystem: chat-data
tags: [supabase, postgrest, keyset-pagination, server-actions, zod, chat]

requires:
  - phase: 10-chat-message-loading-optimization
    provides: Portable pagination contract (hydrateWindow/olderMessagesRequested/olderPageLoaded/olderPageLoadFailed events, ChatPaginationState, ChatMessageCursor) from Plan 10-01
provides:
  - Bounded keyset SSR message window (chatInitialWindowSize = 40) with hasMoreOlder/oldestCursor on ClientChatData
  - loadOlderMessagesAction — cursor-based "load earlier" keyset page with an explicit hasMoreOlder
  - backfillMessagesAction — bounded newer-than-marker reconnect read with a needsReset flag
  - loadNewestMessagesAction — bounded newest-window read (the reconnect reset-fallback primitive Plan 03 needs)
  - All three are direct RLS-protected selects; chat-command Edge Function untouched (API boundary held)
affects: [10-03-chat-message-loading-optimization, 10-04-chat-message-loading-optimization]

tech-stack:
  added: []
  patterns:
    - "Bounded keyset window + N+1 probe: order DESC,DESC, limit(size+1), slice(0,size), reverse() to ascending — computes hasMoreOlder without a second round trip; identical shape in core.ts's SSR load and all three new actions.ts reads"
    - "Direct-select reads skip the Edge-Function-first branch entirely for pagination/backfill/reset — chat-command stays write-only, extending the existing refreshMessagesViaLocalRpc/refreshConversationViaLocalRpc local-rpc convention"
    - "PostgREST composite keyset cursor filter via .or('col.lt.X,and(col.eq.X,id.lt.Y)') for strict (created_at, id) tie-breaking across a page boundary"

key-files:
  created: []
  modified:
    - apps/web/lib/services/supabase/core.ts
    - apps/web/lib/services/supabase/types.ts
    - apps/web/lib/services/supabase/core.test.ts
    - apps/web/app/(authenticated)/chat/actions.ts
    - apps/web/app/(authenticated)/chat/actions.test.ts

key-decisions:
  - "Used z.iso.datetime() (zod v4's non-deprecated ISO datetime validator) for the new cursor/marker timestamp fields — no existing precedent in actions.ts to conflict with"
  - "Cursor is nullable().optional() (not just .nullable()) so both an explicit null and an absent key satisfy the plan's 'null/absent cursor' first-page case"
  - "backfillMessagesAction returns up to size+1 raw messages (not sliced to size, unlike loadOlderMessagesAction) — the plan's action text only specifies computing needsReset from the N+1 probe for backfill; the reset flag, not array length, is what Plan 03's reconnect handler is meant to act on"

patterns-established:
  - "Bounded keyset window + N+1 probe (order DESC,DESC, limit(size+1), slice+reverse) is the one page-read shape reused by the SSR load and every pagination/backfill/reset action"
  - "New read actions bypass the Edge-Function-first branch outright when the API boundary calls for a direct select (Pitfall #9) — not every server action needs a chat-command round trip attempt first"

requirements-completed: [CLOAD-01, CLOAD-03, CLOAD-06]

coverage:
  - id: D1
    description: "The SSR initial load (getAssignedConversation) fetches a bounded newest-messages window (40+1 keyset probe), never the full history, and reports hasMoreOlder/oldestCursor"
    requirement: "CLOAD-01"
    verification:
      - kind: unit
        ref: "apps/web/lib/services/supabase/core.test.ts#bounds the initial message window to 40 and reports hasMoreOlder for a long conversation"
        status: pass
      - kind: unit
        ref: "apps/web/lib/services/supabase/core.test.ts#returns every message and hasMoreOlder false for a short conversation"
        status: pass
    human_judgment: false
  - id: D2
    description: "loadOlderMessagesAction returns a bounded keyset older page (ascending, enriched) with an explicit hasMoreOlder, using a null/absent cursor for the first older page and a composite (created_at, id) filter otherwise"
    requirement: "CLOAD-03"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/actions.test.ts#returns a bounded older page ascending with hasMoreOlder true past the boundary"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/actions.test.ts#returns hasMoreOlder false when the older page is at or under the boundary"
        status: pass
    human_judgment: false
  - id: D3
    description: "backfillMessagesAction returns bounded newer-than-marker messages with an explicit needsReset flag when the gap exceeds the bound; loadNewestMessagesAction provides the bounded newest-window reset fallback with readStates/hasMoreOlder/oldestCursor"
    requirement: "CLOAD-06"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/actions.test.ts#sets needsReset true when more than the bound of newer messages exist during backfill"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/actions.test.ts#sets needsReset false when newer messages stay at or under the bound"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/actions.test.ts#returns the bounded newest window with read states for the reconnect reset fallback"
        status: pass
    human_judgment: false
  - id: D4
    description: "None of the three new actions add a read case to the chat-command Edge Function switch, and none of them post to it; a malformed cursor is rejected by zod before it ever reaches the query"
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/actions.test.ts#rejects a malformed cursor with a calm notice before ever touching the query"
        status: pass
      - kind: other
        ref: "git diff --stat HEAD -- supabase/functions/chat-command/ (empty — untouched); grep -c 'action:' supabase/functions/chat-command/index.ts unchanged at 6"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-07-09
status: complete
---

# Phase 10 Plan 02: Bounded Keyset Window + Pagination/Backfill/Reset Actions Summary

**Bounded 40+1 keyset SSR window plus loadOlderMessagesAction/backfillMessagesAction/loadNewestMessagesAction as direct RLS-protected selects — closes the Plan 02↔03 unbounded-reset gap the cross-AI review flagged HIGH.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-09T22:45:00Z (approx., first read after 1315db02)
- **Completed:** 2026-07-09T23:02:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Replaced the unbounded `getAssignedConversation` messages query with a DESC,DESC keyset read bounded to `chatInitialWindowSize + 1` (41), computing `hasMoreOlder` from the N+1 probe and `oldestCursor` from the oldest kept row — reuses the existing `messages_conversation_created_id_idx` index, no migration needed.
- Added `ClientChatData.hasMoreOlder`/`oldestCursor` as optional fields; every other construction site of `ClientChatData` stays untouched.
- Added `loadOlderMessagesAction` (cursor-based "load earlier", composite `.or()` keyset filter), `backfillMessagesAction` (bounded newer-than-marker reconnect read with `needsReset`), and `loadNewestMessagesAction` (bounded newest-window reset fallback with read states) — all three are direct-select reads that skip the Edge-Function-first branch entirely, so `chat-command` gains no new read case.
- Every new read reuses the existing `addReactionAggregates`/`addSenderDisplayNames` batched enrichment — no second enrichment path.
- Clamped every client-suppliable `limit` to `Math.min(limit ?? 40, 100)` and validated cursor/marker shape (`z.iso.datetime()` + `.uuid()`) before it reaches any query, per the plan's threat model (T-10-03/T-10-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: Bound the SSR message query with a keyset window and return hasMoreOlder + oldestCursor** - `3afb840f` (feat)
2. **Task 2: Add loadOlderMessagesAction, backfillMessagesAction, and loadNewestMessagesAction as direct-select reads** - `ad7745df` (feat)

**Plan metadata:** (pending — see final commit below)

## Files Created/Modified

- `apps/web/lib/services/supabase/core.ts` - Bounded keyset messages query (`chatInitialWindowSize = 40`) in `getAssignedConversation`; computes `hasMoreOlder`/`oldestCursor`
- `apps/web/lib/services/supabase/types.ts` - `ClientChatData.hasMoreOlder` / `oldestCursor` optional fields
- `apps/web/lib/services/supabase/core.test.ts` - Two new cases: a long conversation (`hasMoreOlder` true, 40-message window, `oldestCursor`) and a short one (`hasMoreOlder` false)
- `apps/web/app/(authenticated)/chat/actions.ts` - `chatOlderPageSize` const; `chatCursorInputSchema`/`loadOlderMessagesSchema`/`backfillMessagesSchema`/`loadNewestMessagesSchema`; `loadOlderMessagesViaLocalRpc`/`backfillMessagesViaLocalRpc`/`loadNewestMessagesViaLocalRpc`; exported `loadOlderMessagesAction`/`backfillMessagesAction`/`loadNewestMessagesAction`
- `apps/web/app/(authenticated)/chat/actions.test.ts` - `createChainStub`/`stubChatTables`/`paginationMessageRow` test helpers (extends the Supabase stub to support `.or(...)`); six new cases covering `hasMoreOlder` true/false, `needsReset` true/false, the bounded newest window, and malformed-cursor rejection — every new test asserts `fetchMock` was not called

## Decisions Made

- Used `z.iso.datetime()` (zod v4's non-deprecated ISO datetime validator) rather than the deprecated `z.string().datetime()` for the new timestamp fields — no existing precedent in `actions.ts` to conflict with.
- Made `cursor` `.nullable().optional()` (the plan's action text said `.nullable()` only) so both an explicit `null` and an absent key satisfy the `<behavior>` spec's "null/absent cursor" first-page case.
- `backfillMessagesAction` returns up to `size + 1` raw messages (not sliced to `size`, unlike `loadOlderMessagesAction`) — the plan's `<action>` text only specifies computing `needsReset` from the N+1 probe for backfill, not slicing; the reset flag, not array length, is what Plan 03's reconnect handler is meant to act on.
- Implemented the "slice to N when over the bound, else keep everything" instruction as the unconditional `rows.slice(0, size).reverse()` (slice with fewer elements than requested is a no-op copy) rather than an explicit `hasMoreOlder ? slice : rows` branch — identical behavior, one fewer conditional, used consistently in both `core.ts` and all three `actions.ts` reads.

## Deviations from Plan

None - plan executed exactly as written. All four cross-AI review incorporation items (HIGH: `loadNewestMessagesAction` added; MEDIUM: `.or(...)` added to the `actions.test.ts` stub; LOW: both `hasMoreOlder`/`oldestCursor` asserted on the real page path; Suggestion: every new test asserts `chat-command` was never called) were already folded into the plan text itself and implemented as specified — no separate deviation was needed to satisfy them.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan touches only the service/action layer (Supabase client queries + Next.js Server Actions); no new dependencies, no schema/migration, no environment variables.

## Next Phase Readiness

- `loadOlderMessagesAction`, `backfillMessagesAction`, and `loadNewestMessagesAction` are complete, tested, and ready for Plan 03 to wire into the Zustand store / `use-chat-messages` hook / reconnect handler against the `hydrateWindow`/`olderMessagesRequested`/`olderPageLoaded`/`olderPageLoadFailed` events Plan 01 already landed.
- The bounded SSR window (`getAssignedConversation`) is live — CLOAD-01 is fully satisfied without any client-side change; Plan 03/04 build purely on top of it.
- No blockers. `pnpm typecheck`, `pnpm build`, `pnpm lint`, and the full `apps/web` vitest suite (434 tests) are green at HEAD. `git status` confirms `supabase/migrations/` and `supabase/functions/chat-command/` are untouched — the plan's no-migration and API-boundary determinations both held.
- Plan 03 should route `backfillMessagesAction`'s `needsReset: true` case to `loadNewestMessagesAction` (not the old unbounded `refreshConversationAction`) — that is the exact HIGH-severity gap this plan's Task 2 closes.

---
*Phase: 10-chat-message-loading-optimization*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 5 modified files confirmed present via `[ -f ]`; both task commit hashes (`3afb840f`, `ad7745df`) confirmed via `git log --oneline --all`. Both plan-level verification commands re-run clean: `vitest run lib/services/supabase/core.test.ts "app/(authenticated)/chat/actions.test.ts"` (31/31 passed) and `pnpm typecheck` (all 3 workspace packages, no errors). `git status` confirms no changes under `supabase/migrations/` or `supabase/functions/chat-command/`.
