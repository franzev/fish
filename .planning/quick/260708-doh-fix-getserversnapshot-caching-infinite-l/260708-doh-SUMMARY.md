---
quick_id: 260708-doh
description: Fix getServerSnapshot caching infinite loop in chat-store useChatStore
date: 2026-07-08
status: complete
commit: d56fc795
---

# Summary: Fix getServerSnapshot caching infinite loop

## What was wrong

React raised `The result of getServerSnapshot should be cached to avoid an
infinite loop` at `useChatStore` (`chat-store.ts:189`). zustand v5 wires each
selector straight into `useSyncExternalStore`, so the selector result IS the
server snapshot. `selectMessagesForConversation` and
`selectReadStatesForConversation` fell back to a fresh `[]` literal whenever a
conversation was absent from the store — which is always the case during SSR,
since the chat store hydrates client-side. Every snapshot call returned a new
array reference and React's loop guard fired.

## What changed

`apps/web/app/(authenticated)/chat/store/chat-selectors.ts`:
- Added module-level `emptyMessages` and `emptyReadStates` constants (same
  pattern as the pre-existing `emptyComposer`).
- Both selectors now return those stable references instead of `?? []`.

No other selector was affected: `selectComposerForConversation` already used a
hoisted constant, `selectRealtimeStatusForConversation` returns a string, and
the remaining `useChatStore` call sites select stable store functions.

## Verification

- `pnpm typecheck` — clean.
- `pnpm test` (vitest) — 49 files, 373 tests, all pass.
- Browser: signed in as seeded client (`client1@fish.dev`), loaded `/chat`,
  hard-reloaded to exercise SSR + hydration. Chat renders with messages; zero
  console warnings/errors; no server errors. The getServerSnapshot error no
  longer reproduces.

## Commit

- `d56fc795` — fix(quick-260708-doh): cache empty selector fallbacks so getServerSnapshot is stable
