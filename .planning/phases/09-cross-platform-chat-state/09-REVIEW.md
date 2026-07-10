---
phase: 09-cross-platform-chat-state
reviewed: 2026-07-10T02:39:33Z
depth: standard
status: issues_found
files_reviewed: 22
files_reviewed_list:
  - apps/web/app/(authenticated)/chat/chat-client.test.tsx
  - apps/web/app/(authenticated)/chat/chat-client.tsx
  - apps/web/app/(authenticated)/chat/chat-state.ts
  - apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts
  - apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
  - apps/web/app/(authenticated)/chat/hooks/use-chat-presence.ts
  - apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts
  - apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
  - apps/web/app/(authenticated)/chat/store/chat-selectors.ts
  - apps/web/app/(authenticated)/chat/store/chat-store.test.ts
  - apps/web/app/(authenticated)/chat/store/chat-store.ts
  - apps/web/package.json
  - apps/web/tests/chat-state-boundary.test.ts
  - apps/web/tests/chat-state-fixtures.test.ts
  - packages/core/docs/chat-state-protocol.md
  - packages/core/package.json
  - packages/core/src/chat-state/fixtures/chat-state-vectors.json
  - packages/core/src/chat-state/index.ts
  - packages/core/src/chat-state/reducer.ts
  - packages/core/src/chat-state/selectors.ts
  - packages/core/src/chat-state/types.ts
  - packages/core/src/index.ts
findings:
  critical: 1
  warning: 6
  info: 1
  total: 8
---

# Phase 09: Code Review Report

## Summary

The portable reducer boundary and web adapter remain structurally sound, but the committed implementation has one cross-account privacy defect, six user-visible or contract-impacting defects, and one low-frequency ordering risk. The most urgent issue is that the module-global Zustand store preserves composer state across a soft logout/login and keys it only by conversation id. The fixed community conversation makes that state reusable by a different signed-in account.

The reported missing avatar/time behavior is confirmed as `WR-02`: community grouping is based only on adjacent sender id, so a same-sender run can suppress identity and timestamp metadata indefinitely. This is a presentation defect and does not explain or resolve the separate realtime-delivery diagnosis from Plan 09-05.

Scope isolation was preserved. The committed `HEAD` versions of `chat-client.test.tsx` and `use-chat-messages.ts` were reviewed with `git show`; their unrelated uncommitted pagination hunks were neither reviewed nor reported. `.planning/config.json` was excluded. No production source was changed.

## Critical

### CR-01 — Composer state can leak between accounts in the shared conversation

**Files:** `apps/web/app/(authenticated)/chat/store/chat-store.ts:132`, `apps/web/app/(authenticated)/chat/store/chat-store.ts:157`, `apps/web/app/(authenticated)/chat/store/chat-store.ts:257`, `packages/core/src/chat-state/reducer.ts:138`

`chatStore` is a module-global singleton keyed only by `conversationId`. Both hydration reducers spread the existing conversation before replacing server data, deliberately preserving `composer`; `clearConversation` is only exercised by tests and has no production caller. Logout and login use soft Next navigation, so the JavaScript module and Zustand singleton survive. If account A leaves an unsent draft in the fixed community conversation and account B signs in in the same tab, account B receives the same conversation id and sees account A's draft, with the ability to send it under account B's identity. Pending/failed local message state can also flash before post-mount hydration when the server hydration key matches.

**Recommendation:** clear all user-scoped chat cache on the auth sign-out/session transition, or namespace volatile composer/local-send state by both user and conversation without treating the client key as authorization truth. Add a regression test that drafts as account A, performs the same soft logout/login lifecycle used by the app, and asserts account B starts with an empty composer and no account-A local messages.

## Warnings

### WR-01 — The send-failure hook erases the draft that the portable protocol restores

**Files:** `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts:123`, `apps/web/app/(authenticated)/chat/chat-client.test.tsx:630`, `packages/core/src/chat-state/reducer.ts:222`, `packages/core/docs/chat-state-protocol.md:67`

`markMessageFailed` restores the failed body to `composer.draft`, as required by the reducer fixture and protocol, but `sendWithRequestId` immediately calls `setDraft(..., "")` for normal sends. The component test explicitly expects this contradictory behavior. Worse, the async failure can arrive after the user has already typed a new message; the reducer first replaces that newer text with the failed body and the hook then clears it, losing both drafts.

**Recommendation:** make failure recovery conditional and atomic: retain any newer composer edit, otherwise restore the failed body. Remove the unconditional clear and update the component test to match the portable contract. Cover a delayed failure after the user starts a second draft.

### WR-02 — Same-sender community grouping suppresses avatar and time without a cutoff

**File:** `apps/web/app/(authenticated)/chat/chat-client.tsx:324`

`groupedWithPrevious` and `groupedWithNext` compare only `senderId`. `startsCommunityGroup` therefore stays false for every consecutive message by one sender, regardless of elapsed time or a calendar-day boundary. Since both the `Avatar` and `MessageMeta` timestamp render only at a group start, a later same-sender message can have neither identity nor time even after hours or immediately below a day divider. This matches the reported missing avatar/time symptom.

**Recommendation:** define one shared grouping predicate that requires the same sender, the same day, and a documented short time gap; use it for previous/next grouping and bubble radii. Add committed tests for a same-sender message inside the cutoff, outside it, and on the next day. This UI finding is independent of realtime message delivery.

### WR-03 — Offline copy promises an automatic queue that does not exist

**File:** `apps/web/app/(authenticated)/chat/chat-client.tsx:606`

The alert says, “Messages will send when you're back,” but offline-first queuing is explicitly out of scope and the composer continues to call the server action immediately. A failed offline send becomes a manual `Retry`; nothing automatically sends on reconnect. The current copy therefore makes a false product promise.

**Recommendation:** use accurate calm copy such as “You're offline. Reconnect, then try again,” and prevent an offline submit or clearly preserve it as a manual retry. Do not promise background delivery until an actual queue exists.

### WR-04 — Message action controls violate the 56px interaction floor

**File:** `apps/web/app/(authenticated)/chat/chat-client.tsx:491`

Reply, reaction, edit, and delete use `size-10` (40px) inside an opacity-hidden, hover-revealed toolbar. This violates the project's non-negotiable minimum control size and its token-only spacing rule, and it leaves touch users with small, poorly discoverable actions.

**Recommendation:** use `min-h-control min-w-control` (or a token-backed equivalent) and provide a coarse-pointer/touch presentation that does not depend on hover. Preserve the existing keyboard labels and focus behavior.

### WR-05 — Realtime lifecycle state survives unmount and is not conversation-scoped within the hook

**Files:** `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:64`, `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:90`, `apps/web/app/(authenticated)/chat/chat-client.tsx:170`

The message subscription sets the store to `connected`/`disconnected`, but cleanup never returns it to an inactive state. Revisiting the same conversation can initialize `hasConnected` from stale `connected`, then the mount effect sets `connecting`, causing an ordinary first connection for the new component instance to be labeled “Reconnecting…”. Separately, `seenFirstSubscribeRef` and `backfillInFlightRef` are never reset when `conversationId` changes, so the first subscriptions for a new conversation can be mistaken for reconnects or have their backfill suppressed by the prior conversation.

**Recommendation:** scope connection-history/backfill refs to the current conversation and reset them on id change. Model subscription cleanup without letting one surface falsely disconnect another; at minimum, make the “has connected in this mount” decision hook-local rather than deriving it from stale cached status. Add unmount/remount and prop-change tests.

### WR-06 — The same realtime read-state payload is dispatched twice

**Files:** `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts:113`, `apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts:69`

The read subscription calls `dispatchChatEvent({ type: "mergeReadState" })` and then calls `mergeReadState(readState)`, which dispatches the same event again through the store action. Equality checks usually make the second dispatch a no-op, but every read update still performs redundant store work and obscures which adapter path is canonical.

**Recommendation:** keep one dispatch path—prefer the injected `mergeReadState` callback or the direct store event, not both—and assert one store transition per realtime payload.

## Info

### IN-01 — Read-state replacement can regress on an out-of-order stale row

**Files:** `packages/core/src/chat-state/selectors.ts:50`, `packages/core/docs/chat-state-protocol.md:69`

`mergeReadState` replaces an existing user's row wholesale whenever any field differs. The database command advances markers monotonically, but action responses, reconnect refreshes, and multi-tab realtime delivery can complete out of order at the client. A late older row can temporarily move delivered/read markers backward and downgrade message statuses until another refresh. Existing fixtures cover only a forward replacement.

**Recommendation:** specify the ordering rule in the portable protocol and reject older marker timestamps/rows (while merging delivered and read dimensions independently). Add parity vectors for a newer row followed by a stale row and for independently advancing delivered/read markers.

## Verification Notes

- Reviewed all 22 listed committed source artifacts at standard depth.
- Read `AGENTS.md` and `docs/ui-ux-agent-guidelines.md` before reviewing `ChatClient`.
- Used committed `HEAD` content for the two dirty pagination files; no finding above depends on their uncommitted changes.
- This review is source-based. Tests were not rerun against the dirty working tree because that would mix the explicitly excluded pagination edits into the evidence.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
