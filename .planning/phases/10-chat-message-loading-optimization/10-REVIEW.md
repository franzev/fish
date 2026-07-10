---
status: issues_found
phase: 10-chat-message-loading-optimization
depth: standard
files_reviewed: 30
files_reviewed_list:
  - "apps/web/app/(authenticated)/channels/[id]/page.tsx"
  - "apps/web/app/(authenticated)/chat/actions.test.ts"
  - "apps/web/app/(authenticated)/chat/actions.ts"
  - "apps/web/app/(authenticated)/chat/chat-client.test.tsx"
  - "apps/web/app/(authenticated)/chat/chat-client.tsx"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts"
  - "apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts"
  - "apps/web/app/(authenticated)/chat/realtime.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-selectors.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-store.test.ts"
  - "apps/web/app/(authenticated)/chat/store/chat-store.ts"
  - "apps/web/app/globals.css"
  - "apps/web/components/chat/index.ts"
  - "apps/web/components/chat/message-row/community-message-row-layout.tsx"
  - "apps/web/components/chat/message-row/index.ts"
  - "apps/web/components/chat/message-row/message-rows-skeleton.tsx"
  - "apps/web/lib/services/supabase/core.test.ts"
  - "apps/web/lib/services/supabase/core.ts"
  - "apps/web/lib/services/supabase/types.ts"
  - "apps/web/tests/chat-state-fixtures.test.ts"
  - "apps/web/tests/intersection-observer.ts"
  - "apps/web/vitest.setup.ts"
  - "packages/core/docs/chat-state-protocol.md"
  - "packages/core/src/chat-state/fixtures/chat-state-vectors.json"
  - "packages/core/src/chat-state/reducer.ts"
  - "packages/core/src/chat-state/selectors.ts"
  - "packages/core/src/chat-state/types.ts"
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
reviewed_at: "2026-07-10T22:21:05Z"
diff_base: e1ba19d1940d839b4c714da8959e9d7e330c532c
---

# Phase 10: Code Review Report

## Summary

The message keyset queries, reducer deduplication, per-conversation older-page lock, one-attempt failure gate, scroll restoration, calm loading UI, and accessibility semantics are internally consistent and well covered. The phase is not clean, however: reconnect recovery assumes that the last local row is an authoritative server cursor, and the bounded SSR message query still downloads every reaction in the conversation. Both defects become user-visible as conversations grow or reconnect at an empty/optimistic boundary.

No critical security or authorization issue was found in the reviewed changes. The new read actions validate input and continue to rely on authenticated Supabase reads protected by RLS.

## Warnings

### WR-01 — Reconnect backfill can skip missed messages when no authoritative server cursor exists

**Evidence:** `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts:301-315`; `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts:27-30`; `apps/web/app/(authenticated)/chat/actions.ts:67-73`; `apps/web/app/(authenticated)/chat/chat-client.test.tsx:2346-2410`.

`applyGapBackfill` takes the last element of the complete local message array and uses its `createdAt`/`id` as the server keyset marker. There are two unsafe states:

- If the transcript was empty before disconnect and its first messages arrived during the gap, line 307 returns without calling either backfill or `loadNewestMessagesAction`, so those messages remain absent until another independent refresh or page reload.
- The array also contains local `pending`, `sending`, and `failed` rows. If one is last, its client-generated timestamp/id is not an authoritative row ordering key. A syntactically valid UUID can make the query start after a local timestamp newer than the missed server messages; a non-UUID fallback is rejected by `backfillMessagesSchema`. In either case the bounded catch-up can silently return no messages.

The pending-send reconnect test does not cover this behavior: it mocks `backfillMessagesAction` to return `needsReset: true` regardless of the marker and never asserts which row supplied `afterCreatedAt`/`afterMessageId`.

**Impact:** A user can reconnect and never see messages sent while they were offline, especially in a newly empty conversation or while their own send is unresolved.

**Recommendation:** Search backward for the newest authoritative `localStatus === "sent"` server row and use only that row as the keyset marker. If no authoritative marker exists, call the already-bounded `loadNewestMessagesAction` and hydrate that window instead of returning. Add hook/component regressions for (1) empty transcript → missed message → reconnect and (2) authoritative row followed by an optimistic/failed local row → reconnect; assert the exact action input as well as the merged result.

### WR-02 — The bounded SSR window still fetches the conversation's complete reaction history

**Evidence:** `apps/web/lib/services/supabase/core.ts:713-743`; `apps/web/lib/services/supabase/core.ts:776-787`; `apps/web/lib/services/supabase/core.ts:87-111`; `apps/web/lib/services/supabase/core.test.ts:268-338`.

The new initial message query correctly limits the result to 41 rows and keeps 40. Immediately afterward, however, `fetchConversationReactions` filters only by `conversation_id` and paginates until every reaction row in the conversation has been downloaded. `toClientChatMessage` then uses only reactions belonging to the 40 retained messages, so reactions for every older unloaded message are pure overhead. The later page actions already show the bounded shape at `actions.ts:316-363`: query reactions only for the returned message ids in small batches.

The long-conversation test proves only that `result.data.messages` has length 40. Its chain stub returns a prebuilt empty reaction array and does not assert that the reaction query is restricted to the retained message ids, so it cannot detect this unbounded side query.

**Impact:** Initial SSR latency, memory, and transferred rows still grow with total conversation history (and can require multiple 1,000-row round trips), partially defeating the phase's bounded-loading objective.

**Recommendation:** Change `fetchConversationReactions` to accept the 40 retained message ids and filter with batched `.in("message_id", ids)` queries, or consolidate it with the bounded `addReactionAggregates` pattern used by pagination actions. Add a core service test that records query-builder calls and proves reactions are restricted to the retained window, including a history with reactions on an excluded 41st message.

## Scope and Verification

- Reviewed all 30 explicitly scoped files at standard depth against `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, the portable chat-state protocol, and Phase 10's bounded-pagination/UI contracts.
- Traced SSR window loading, composite cursor validation/querying, older-page request/error transitions, reconnect backfill/reset behavior, reducer deduplication, realtime coalescing, prepend scroll restoration, IntersectionObserver retry gating, skeleton geometry, reduced motion, focus behavior, and accessible busy/status semantics.
- Focused Vitest run passed: 6 files, 139 tests (`actions`, `chat-client`, `use-stick-to-bottom`, `chat-store`, Supabase core, and chat-state fixtures).
- `pnpm typecheck` passed across the configured workspace packages.
- `pnpm lint` passed.
- No source code was modified. The pre-existing uncommitted `.planning/config.json` change was preserved.

---

_Reviewed: 2026-07-10T22:21:05Z_
_Reviewer: gsd-code-reviewer_
_Completion: REVIEW_COMPLETE_
