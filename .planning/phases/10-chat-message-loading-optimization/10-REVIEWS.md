---
phase: 10
reviewers: [codex]
reviewed_at: 2026-07-09T21:26:08Z
plans_reviewed: [10-01-PLAN.md, 10-02-PLAN.md, 10-03-PLAN.md, 10-04-PLAN.md]
failed_reviewers:
  gemini: "Auth error — Gemini Code Assist free tier deprecated for gemini-cli 0.36.0; Google requires migrating to Antigravity (IneligibleTierError)"
  cursor: "Not authenticated — run 'cursor-agent login' or set CURSOR_API_KEY"
skipped_reviewers:
  claude: "Skipped for independence — review orchestrated from inside Claude Code"
---

# Cross-AI Plan Review — Phase 10

## Codex Review

## 10-01-PLAN.md

**Summary**  
Strong foundation plan. It correctly starts with the portable reducer/fixture contract before web wiring, and it matches the existing Phase 9 architecture. Main risk is around read-marker semantics and fixture churn, not scope.

**Strengths**
- Reuses the existing canonical merge/dedup path: `mergeChatMessage` already dedups by `id`, incoming `clientRequestId`, and local request id, then sorts by `createdAt/id` in `packages/core/src/chat-state/selectors.ts:16`.
- Correctly accounts for full-state fixture equality. The fixture test hardcodes case names and asserts `actual` equals `expectedState` at [apps/web/tests/chat-state-fixtures.test.ts:141](/Users/franz/Work/Personal/fish/apps/web/tests/chat-state-fixtures.test.ts:141) and [apps/web/tests/chat-state-fixtures.test.ts:176](/Users/franz/Work/Personal/fish/apps/web/tests/chat-state-fixtures.test.ts:176).
- Additive event strategy fits the current reducer switch in [packages/core/src/chat-state/reducer.ts:36](/Users/franz/Work/Personal/fish/packages/core/src/chat-state/reducer.ts:36) and avoids mutating existing `hydrateConversation` semantics.

**Concerns**
- **MEDIUM:** The read-marker fixture expectation is ambiguous. The plan says an out-of-window marker should make outgoing status `"sent"`, but later says the fixture should assert `"delivered"/"sent"`. Current status checks use the same `isAtOrAfterMessage` helper for both read and delivered in [selectors.ts:130](/Users/franz/Work/Personal/fish/packages/core/src/chat-state/selectors.ts:130), so an absent delivered marker will also resolve to `"sent"`.
- **LOW:** Adding required `pagination` to `ChatConversationState` will force all current expected states to change, as the plan notes. That is acceptable, but executors should avoid changing existing event inputs, because the fixture harness is intentionally strict.

**Suggestions**
- Make the out-of-window selector rule explicit in the protocol: “marker older than current window means no in-window outgoing message is delivered/read by that marker.”
- Add one selector-only fixture for delivered-marker-outside-window and one for read-marker-outside-window, so the two branches are not conflated.

**Risk Assessment: LOW-MEDIUM**  
The architecture is sound and well ordered. Risk is mostly semantic precision in read-state behavior.

---

## 10-02-PLAN.md

**Summary**  
This plan targets the right bottleneck: the current SSR load fetches all messages. The query and RLS direction are appropriate, but the plan misses one server capability needed by Plan 03’s reset-to-window fallback.

**Strengths**
- Correctly identifies the unbounded SSR query in [apps/web/lib/services/supabase/core.ts:706](/Users/franz/Work/Personal/fish/apps/web/lib/services/supabase/core.ts:706). It currently orders ascending with no `limit`.
- Existing DB support is real: `messages_conversation_created_id_idx` exists on `(conversation_id, created_at, id)` in [supabase/migrations/0010_chat.sql:26](/Users/franz/Work/Personal/fish/supabase/migrations/0010_chat.sql:26).
- Direct RLS reads fit the existing policy: authenticated members can read messages via [supabase/migrations/0010_chat.sql:79](/Users/franz/Work/Personal/fish/supabase/migrations/0010_chat.sql:79).
- Reusing `addReactionAggregates` and `addSenderDisplayNames` is right; both already exist in [apps/web/app/(authenticated)/chat/actions.ts:285](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/actions.ts:285) and [actions.ts:335](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/actions.ts:335).

**Concerns**
- **HIGH:** Plan 03 requires “reset to newest window” when backfill exceeds the bound, but Plan 02 does not add a bounded newest-window action. The only existing client-callable full conversation refresh is unbounded in [actions.ts:527](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/actions.ts:527), fetching all messages at [actions.ts:541](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/actions.ts:541). Without a `loadNewestWindowAction`, Plan 03 cannot implement the fallback without regressing CLOAD-01.
- **MEDIUM:** The composite `.or(...)` keyset syntax is implementation-sensitive. The current test stubs do not cover `.or`; `createChainStub` only supports `select`, `eq`, `in`, `order`, and `limit` in [core.test.ts:23](/Users/franz/Work/Personal/fish/apps/web/lib/services/supabase/core.test.ts:23). The action tests will need a realistic chain stub for `.or`.
- **LOW:** `ClientChatData.hasMoreOlder` and `oldestCursor` are planned as optional. That eases migration, but missing metadata can silently disable pagination unless hook tests assert the real page path includes both.

**Suggestions**
- Add `loadNewestMessagesAction({ conversationId, limit? })` returning `messages`, `readStates`, `hasMoreOlder`, and `oldestCursor`. Use it for reset fallback and possibly replace `refreshConversationAction` later.
- Add a unit test asserting no calls are made to `chat-command` for the new pagination reads; current `refreshConversationAction` explicitly posts to `chat-command` at [actions.ts:867](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/actions.ts:867).

**Risk Assessment: MEDIUM-HIGH**  
The bounded initial and older-page reads are good, but the missing reset-window read is a phase-level correctness gap.

---

## 10-03-PLAN.md

**Summary**  
This is the highest-risk plan. It correctly removes the triple full-history reconnect refresh, but the proposed “skip first subscribed” guard is insufficient with three channels, and the reset fallback depends on an action Plan 02 does not provide.

**Strengths**
- Correctly targets the current reconnect problem. `use-chat-realtime.ts` calls `refreshConversation()` from the messages, reads, and reactions subscriptions at [use-chat-realtime.ts:50](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:50), [use-chat-realtime.ts:74](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:74), and [use-chat-realtime.ts:86](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:86).
- Store extension follows the current reducer-backed Zustand adapter pattern in [chat-store.ts:96](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/store/chat-store.ts:96).
- Boundary testing is already present and useful: the store test rejects Supabase/auth imports in [chat-store.test.ts:54](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/store/chat-store.test.ts:54).

**Concerns**
- **HIGH:** A single shared `hasSubscribedOnceRef` will skip only the first of three initial `SUBSCRIBED` callbacks. The other two initial subscriptions will still trigger one backfill. The three subscription helpers all call `onReconnected` on `SUBSCRIBED`: messages at [realtime.ts:189](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/realtime.ts:189), reads at [realtime.ts:219](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/realtime.ts:219), reactions at [realtime.ts:258](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/realtime.ts:258).
- **HIGH:** `needsReset` has no bounded newest-window fetch to call. Falling back to the old `refreshConversationAction` would hit the unbounded path in [actions.ts:541](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/actions.ts:541).
- **MEDIUM:** The plan says backfill reuses `subscribeAfterAuth`, but that function is private inside [realtime.ts:68](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/realtime.ts:68). Server actions authenticate differently. That is probably fine, but the plan’s stated mitigation is inaccurate.
- **MEDIUM:** `createChatHydrationKey` currently includes only messages and read states in [chat-store.ts:67](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/store/chat-store.ts:67). If pagination metadata affects hydration behavior, the dependency/key strategy needs to be explicit.

**Suggestions**
- Track initial subscription readiness per channel, or suppress reconnect backfill until all three initial `SUBSCRIBED` callbacks have occurred.
- Add `loadNewestWindowAction` in Plan 02 and make `applyGapBackfill` call that on `needsReset`.
- Keep `refreshConversationAction` available only as a legacy fallback and assert reconnect no longer calls it in tests.

**Risk Assessment: HIGH**  
The desired direction is correct, but the reconnect guard and reset fallback need design fixes before execution.

---

## 10-04-PLAN.md

**Summary**  
The UX plan aligns with FISH’s calm interaction rules and correctly fixes the current prepend/stick-to-bottom bug. Execution risk is high because required wiring files are missing, the scroll-restore API is underspecified, and the offline state depends on realtime statuses the app does not currently set.

**Strengths**
- Correctly identifies the current prepend bug: `useStickToBottom` tracks only message count at [use-stick-to-bottom.ts:24](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts:24) and treats any length increase as a new tail message at [use-stick-to-bottom.ts:93](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts:93).
- Uses the existing `ScrollArea` viewport hook point in [chat-client.tsx:227](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/chat-client.tsx:227).
- The CSS plan fits existing animation conventions in [globals.css:274](/Users/franz/Work/Personal/fish/apps/web/app/globals.css:274) and the reduced-motion clamp at [globals.css:265](/Users/franz/Work/Personal/fish/apps/web/app/globals.css:265).

**Concerns**
- **HIGH:** The plan must modify `apps/web/app/(authenticated)/channels/[id]/page.tsx`, but it is not in `files_modified`. That page imports and passes the current chat actions at [page.tsx:5](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/channels/[id]/page.tsx:5) and [page.tsx:35](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/channels/[id]/page.tsx:35). Without changing it, `loadOlderMessagesAction` and `backfillMessagesAction` will not reach `ChatClient`.
- **HIGH:** Scroll restoration must wrap both sentinel and button-triggered loads. The plan says the quiet button calls `loadOlderMessages` directly, which risks bypassing the manual scrollHeight-diff restore. The existing “New messages” button directly calls `scrollToBottom` at [chat-client.tsx:511](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/chat-client.tsx:511), so this wiring needs care.
- **MEDIUM:** The IO mock design is incomplete if callbacks live in `vitest.setup.ts` and `triggerIntersection` lives in a separate file. The current setup file has only module-local stubs in [vitest.setup.ts:6](/Users/franz/Work/Personal/fish/apps/web/vitest.setup.ts:6); the helper needs shared state via `globalThis` or an exported shared module.
- **MEDIUM:** Offline/reconnect UI cannot work reliably yet. Realtime status is only set to `"connecting"` and `"connected"` in [use-chat-realtime.ts:44](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:44) and [use-chat-realtime.ts:51](/Users/franz/Work/Personal/fish/apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:51); no current code sets `"disconnected"`.
- **LOW:** The acceptance check `grep -c 'variant="primary"' chat-client.tsx` is misleading. The send button’s primary variant is implicit in `Composer`, where `Button` has no `variant` prop at [composer.tsx:91](/Users/franz/Work/Personal/fish/apps/web/components/chat/composer/composer.tsx:91). `chat-client.tsx` currently has zero `variant="primary"` strings.

**Suggestions**
- Add `apps/web/app/(authenticated)/channels/[id]/page.tsx` to Plan 04 files and acceptance criteria.
- Make `loadOlderMessages` return `Promise<void>` in Plan 03, and expose a single wrapped `loadOlderAndPreserveScroll` callback from the sentinel hook for both IO and button paths.
- Store the IntersectionObserver callback map on `globalThis` or in a shared test helper module imported by both setup and tests.
- Extend realtime subscription status handling for `CHANNEL_ERROR`, `TIMED_OUT`, and `CLOSED`, or keep offline UI out of this plan.

**Risk Assessment: HIGH**  
The intended UX is right, but missing wiring and scroll-restoration details could leave the feature nonfunctional or janky.

---

## Gemini Review

Gemini review failed: the installed gemini-cli (0.36.0) can no longer authenticate — Google deprecated Gemini Code Assist for individuals and requires migrating to the Antigravity suite (`IneligibleTierError: UNSUPPORTED_CLIENT`). To restore this reviewer, install the Antigravity CLI (`agy`) or authenticate gemini-cli with a paid tier / API key.

---

## Cursor Review

Cursor review failed: `cursor-agent` is installed but not authenticated. Run `cursor-agent login` or set `CURSOR_API_KEY`, then re-run `/gsd-review 10 --cursor`.

---

## Consensus Summary

Only one reviewer (Codex) completed successfully, so no multi-reviewer consensus is possible. The findings below are single-source but source-grounded (every concern cites repo `file:line` evidence), so treat the HIGH items as verified gaps rather than impressions.

### Key Strengths (Codex, source-verified)

- Correct wave ordering: portable reducer/fixture contract (10-01) lands before web wiring; additive events fit the existing reducer switch (`packages/core/src/chat-state/reducer.ts:36`) and reuse the canonical merge/dedup path (`packages/core/src/chat-state/selectors.ts:16`).
- The plans target the real bottlenecks: unbounded SSR query (`apps/web/lib/services/supabase/core.ts:706`), triple full-history reconnect refresh (`use-chat-realtime.ts:50/74/86`), and the count-based stick-to-bottom prepend bug (`use-stick-to-bottom.ts:93`).
- DB support already exists: keyset index `(conversation_id, created_at, id)` and RLS read policy in `supabase/migrations/0010_chat.sql:26/79` — no new migration needed, as planned.

### Top Concerns (HIGH severity)

1. **Missing bounded newest-window action (cross-plan gap).** Plan 03's `needsReset` fallback has nothing bounded to call — Plan 02 never adds a `loadNewestWindowAction`, and the only existing refresh is unbounded (`actions.ts:541`), which would regress CLOAD-01. Fix in Plan 02 before execution.
2. **Reconnect guard is insufficient for three channels.** A single shared `hasSubscribedOnceRef` skips only the first of three initial `SUBSCRIBED` callbacks (`realtime.ts:189/219/258`); the other two still trigger a spurious backfill. Track readiness per channel or gate until all three have subscribed once.
3. **Plan 04 omits required wiring file.** `apps/web/app/(authenticated)/channels/[id]/page.tsx` passes actions to `ChatClient` (`page.tsx:5/35`) but is not in Plan 04's `files_modified` — without it the new pagination actions never reach the client.
4. **Scroll restoration must wrap both trigger paths.** The quiet "load earlier" button calling `loadOlderMessages` directly can bypass the scrollHeight-diff restore; expose one wrapped callback used by both the IntersectionObserver sentinel and the button.

### Medium Concerns

- Read-marker-outside-window fixture semantics are ambiguous in Plan 01 ("sent" vs "delivered/sent"); both statuses share `isAtOrAfterMessage` (`selectors.ts:130`) — add separate fixtures for delivered-outside-window and read-outside-window.
- The `.or(...)` keyset syntax in Plan 02 isn't covered by existing test stubs (`core.test.ts:23` chain stub lacks `.or`).
- Offline UI in Plan 04 depends on a `"disconnected"` realtime status that no current code sets (`use-chat-realtime.ts:44/51`).
- IntersectionObserver mock design splits callback state across `vitest.setup.ts` and a helper file — needs a shared module or `globalThis`.

### Divergent Views

None — single reviewer.
