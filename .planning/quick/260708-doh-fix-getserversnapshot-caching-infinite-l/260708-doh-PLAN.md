---
quick_id: 260708-doh
description: Fix getServerSnapshot caching infinite loop in chat-store useChatStore
date: 2026-07-08
mode: quick
---

# Quick Task 260708-doh: Fix getServerSnapshot caching infinite loop

## Problem

React throws `The result of getServerSnapshot should be cached to avoid an infinite loop`
at `useChatStore` (`apps/web/app/(authenticated)/chat/store/chat-store.ts:189`).

Root cause: zustand v5's `useStore` passes `() => selector(store.getState())` as
`getServerSnapshot` to `useSyncExternalStore`. During SSR the chat store has no
conversations, so `selectMessagesForConversation` and `selectReadStatesForConversation`
in `apps/web/app/(authenticated)/chat/store/chat-selectors.ts` hit their `?? []`
fallback and return a **new array literal on every call**. React sees a different
server-snapshot reference each time and raises the infinite-loop guard.

`selectComposerForConversation` already does this correctly via the hoisted
`emptyComposer` constant; `selectRealtimeStatusForConversation` returns a string
primitive — both stable.

## Tasks

1. **Hoist stable empty-array fallbacks in chat-selectors.ts**
   - Files: `apps/web/app/(authenticated)/chat/store/chat-selectors.ts`
   - Action: Add module-level `emptyMessages: ChatMessageState[]` and
     `emptyReadStates: ChatReadState[]` constants (frozen semantics like
     `emptyComposer`); return them from `selectMessagesForConversation` and
     `selectReadStatesForConversation` instead of `?? []`.
   - Verify: `pnpm typecheck` passes; chat store/selector tests pass; no other
     selector returns a fresh object/array per call.
   - Done: `getServerSnapshot` returns referentially stable values for empty
     conversations; the React error no longer reproduces.
