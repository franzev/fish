---
phase: 10-chat-message-loading-optimization
reviewed: 2026-07-10T23:47:07Z
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
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-10T23:47:07Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

The new promise-identity check correctly prevents conversation A's late backfill completion from clearing conversation B's active lock, and the VR-01 regression proves that ownership sequence. The bounded queries, composite cursor ordering, reducer deduplication, and reset-window path remain intact.

One conversation-switch race remains at the callback boundary. Supabase channel removal is asynchronous, but callbacks from the old subscription are not generation-guarded. A queued A `SUBSCRIBED` callback can therefore mutate the shared first-subscribe tracker or start an A recovery after those refs have been reset for B.

## Critical Issues

### CR-01: A stale channel callback can claim the new conversation's reconnect tracker and lock

**File:** `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:135-173,176-256`

**Issue:** The conversation-change effect resets `seenFirstSubscribeRef` and `backfillInFlightRef`, but the three old subscription callbacks close over A's `handleReconnected` and have no active-generation or teardown guard. Cleanup calls `removeChannel` indirectly through `unsubscribe`, and that removal is intentionally fire-and-forget in `realtime.ts:91-99`; it cannot revoke an already queued status callback synchronously.

After switching A to B, one stale A `SUBSCRIBED` callback can run against B's freshly reset shared refs. If it runs before B's initial callback, it consumes the `messages` first-subscribe slot, causing B's ordinary initial `SUBSCRIBED` to be treated as a reconnect. If it runs after B's initial callback, it can start A's captured `applyGapBackfill`, place that A promise in the shared lock, and suppress B's genuine recovery callbacks until A settles. The new identity guard only controls which promise may release the lock; it does not control which stale callback may acquire it.

This violates the phase contract that each conversation skips its own first callback and that the active conversation owns its recovery. It can issue a bounded read for the conversation the user has already left and can delay a required B gap backfill, leaving B temporarily missing messages after reconnect.

**Fix:** Reject callbacks from torn-down subscription generations before they call `handleReconnected`. For example, keep an `active` boolean inside each subscription effect, set it to `false` before unsubscribe in cleanup, and guard every status callback; alternatively pass a generation token into `handleReconnected` and compare it with the current conversation generation. Preserve the promise-identity release check. Extend the VR-01 test by invoking the captured A status callback after rerendering B, then prove it neither consumes B's first-subscribe slot nor starts/blocks a recovery:

```tsx
let active = true;
const unsubscribe = subscribeToConversationMessages(
  chat.conversationId,
  onMessage,
  () => {
    if (!active) return;
    setRealtimeStatus(chat.conversationId, "connected");
    handleReconnected("messages");
  },
  onDisconnected
);

return () => {
  active = false;
  unsubscribe();
  setRealtimeStatus(chat.conversationId, "idle");
};
```

Apply the equivalent active-generation guard to reads and reactions so any old channel cannot consume their shared first-subscribe entries either.

## Scope Notes

- Reviewed the 30 Phase 10 source/test/protocol files at standard depth, plus `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, and Plan 10-07 artifacts as governing context.
- The new reconnect test reliably covers stale promise completion and active-owner release, but it never invokes A's captured status callback after the rerender, so it cannot detect CR-01.
- Initial, older-page, gap-backfill, and newest-reset message reads remain bounded. Composite `(created_at, id)` ordering and canonical reducer merge/dedup behavior remain consistent.
- No authorization bypass, unbounded active reconnect path, raw-hex/token violation, or user-facing design-rule regression was found.
- The user's unrelated uncommitted `apps/web/components/chat/index.ts` change was reviewed in place and not modified.

---

_Reviewed: 2026-07-10T23:47:07Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
