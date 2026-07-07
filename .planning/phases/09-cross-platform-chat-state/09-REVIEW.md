---
phase: 09-cross-platform-chat-state
reviewed: 2026-07-07T00:35:51Z
depth: standard
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
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-07-07T00:35:51Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the portable chat-state reducer/selectors/fixtures, web Zustand adapter, extracted hooks, chat route wiring, protocol documentation, and focused tests. The main risk is that the chat route now renders from an initially empty singleton store while current server-provided chat data is only copied into that store from an effect, which can produce an empty or stale first render. I also found a stale-presence edge case when the assigned participant props change without remounting the component.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: [BLOCKER] Store-backed chat renders before current chat props are hydrated

**File:** `apps/web/app/(authenticated)/chat/chat-client.tsx:91`

**Issue:** `ChatClient` renders messages exclusively from the singleton Zustand store at lines 91-93, but the current `chat.messages` snapshot is copied into that store only later from `useChatMessages`' effect at `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts:69`. Effects run after the initial render, so a cold store first renders "No messages yet" for an assigned conversation that already has messages. If the singleton store already contains older data for the same `conversationId`, the first render can show stale message content until the effect overwrites it. That violates the phase requirement to preserve the current one-conversation behavior without layout shift regressions, and it creates a real stale-data risk around navigation/remounts.

**Fix:**

Render the current prop snapshot synchronously until the store has been explicitly hydrated for that snapshot, or initialize the store before the first render path reads from it. One concrete shape is to make `useChatMessages` expose a prop-backed fallback when the store conversation is absent/stale, then keep the effect as cache synchronization:

```tsx
const conversation = useChatStore((state) =>
  selectConversationState(state, chat.conversationId)
);
const propMessages = useMemo(
  () => chat.messages.map(toLocalMessage),
  [chat.messages]
);
const messages = (conversation?.messages ?? propMessages) as LocalMessage[];
```

If stale same-id data is possible, track a small hydration key in the store, such as joined message ids plus read-state ids/timestamps, and use the prop snapshot until the key matches the current props.

## Warnings

### WR-01: [WARNING] Presence sessions are not reset when participant props change

**File:** `apps/web/app/(authenticated)/chat/hooks/use-chat-presence.ts:19`

**Issue:** `participantPresenceSessions` is initialized from `chat.participantPresence?.sessions` only once. The subscription effect changes when `chat.participant.id` changes, but the local sessions array is not reset for the new participant. If the assigned conversation or participant changes while `ChatClient` remains mounted, the new header can derive its "Active now" / last-seen label from the previous participant's sessions until a realtime event arrives.

**Fix:**

Reset the local presence snapshot whenever the participant identity or provided presence snapshot changes:

```tsx
useEffect(() => {
  setParticipantPresenceSessions(chat.participantPresence?.sessions ?? []);
  setNow(new Date());
}, [chat.participant.id, chat.participantPresence?.sessions]);
```

Keep the existing realtime subscription effect after this reset so live updates still merge into the correct participant's session list.

---

_Reviewed: 2026-07-07T00:35:51Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
