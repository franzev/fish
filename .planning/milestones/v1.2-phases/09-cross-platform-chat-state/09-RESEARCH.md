# Phase 09: Cross-platform Chat State - Research

**Researched:** 2026-07-07
**Domain:** Portable chat state machine, Next.js/React chat refactor, Zustand web adapter, native state-container contract
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Portable chat state
- **D-01:** The "chat brain" is a small portable state machine/event contract, not Zustand. The portable layer owns deterministic merge/status/read/snippet behavior and any reducer-like event transitions that must stay equivalent across web, Android, and iOS.
- **D-02:** Keep platform-specific state containers thin. Web may use Zustand; Android should later use `ViewModel` + `StateFlow`; iOS should later use an observable model. Native clients must not inherit web library choices.
- **D-03:** JSON fixtures are the cross-platform compatibility contract. At minimum, fixtures must cover hydration, optimistic send, send confirmation, send failure, remote message merge, duplicate `clientRequestId` reconciliation, read-state merge, unread count, deleted-message snippet, and reply preview behavior.
- **D-04:** Put portable TypeScript code in `packages/core` or a similarly shared package. Do not put React hooks, Zustand stores, Supabase clients, or Next.js server actions in the portable module.
- **D-05:** Preserve the existing server/Supabase authority boundary. Supabase RLS, Edge Functions, server actions, and database functions still decide auth, assignment, membership, write permission, persistence, and durable read state.

### Web refactor sequence
- **D-06:** Extract hooks before introducing Zustand: messages/read-state logic, realtime subscriptions, presence/typing/recording, and composer/send/edit/delete/reaction behavior should become focused units that can be tested or reasoned about independently.
- **D-07:** Zustand should be introduced after hook boundaries are clear. The web store may hold messages/read states by `conversationId`, drafts, reply/edit targets, local pending/failed send metadata, realtime connection status, and lightweight cached conversation summaries.
- **D-08:** Zustand must not store auth/session truth, role permissions, coach-client assignment decisions, direct Supabase clients, service-role data, or any security-sensitive decision that belongs to RLS/Edge Functions/server actions.
- **D-09:** The existing `ChatClient` route must keep the same visible behavior: one assigned conversation, one primary send action, calm notices, no conversation picker, no extra menus, no lost drafts, no duplicate optimistic messages, and no layout shift regression.
- **D-10:** If package dependencies change, add `zustand` only to `apps/web/package.json` via pnpm. Do not add Redux/Jotai or a second client state library.

### Native readiness
- **D-11:** This phase prepares Android/iOS with protocol docs and fixtures, not production native chat implementation. Native delivery should remain unblocked by web refactor details.
- **D-12:** Android/iOS parity should be expressed as event names, state shape, and fixture expectations rather than generated TypeScript consumption. Kotlin and Swift can later implement the same contract idiomatically.

### Verification
- **D-13:** Existing chat tests must remain green, and new reducer/fixture/store tests must prove optimistic-send reconciliation, read-state status, failure preservation, and fixture compatibility.
- **D-14:** Required gates include `pnpm --filter @fish/web test` or focused chat tests, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. If planner narrows verification to focused commands during implementation, final release verification still runs the repo gates from AGENTS.md.

### the agent's Discretion
- Exact hook file names and whether the portable reducer is one module or a small folder, provided dependency boundaries remain strict.
- Exact Zustand selector shape, provided components subscribe narrowly enough to avoid avoidable full-chat rerenders.
- Exact fixture JSON schema, provided it is simple for Kotlin/Swift to consume and includes expected output, not just input events.

### Deferred Ideas (OUT OF SCOPE)
- Multi-conversation inbox, conversation picker, notification center, coach assignment UI, offline-first send queue, native production chat screens, AI-assisted coaching, and learning mechanics.
- Native-generated shared code pipeline. For now, JSON fixtures and a written protocol are the stable cross-platform contract.
- Realtime product expansion beyond preserving current subscriptions and state handling.
</user_constraints>

## Summary

Phase 09 should be planned as a state-boundary refactor, not a product expansion. The durable chat behavior belongs in `packages/core` as a dependency-clean TypeScript event/result reducer with JSON fixtures; web then adapts that reducer through focused hooks and a Zustand store keyed by `conversationId`. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] [VERIFIED: local code grep]

The current web chat route is a single large client component that mixes message merging, optimistic send, read-state updates, realtime subscriptions, presence, typing, voice-recording, reply/edit/delete/reaction behavior, search, notices, and rendering. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx] The refactor should extract behavior seams before adding Zustand so the store coordinates shared web surfaces without becoming the source of authorization, assignment, persistence, or platform-neutral truth. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

**Primary recommendation:** Build `@fish/core/chat-state` first with fixture-backed reducer tests, then refactor web hooks around that contract, then add `zustand` as a thin web-only adapter. [VERIFIED: .planning/REQUIREMENTS.md] [CITED: https://github.com/pmndrs/zustand]

## Project Constraints (from AGENTS.md)

- Use pnpm workspaces; do not use npm or create npm lockfiles. [VERIFIED: AGENTS.md]
- Web stays Next.js App Router + React + TypeScript in `apps/web`. [VERIFIED: AGENTS.md]
- Tailwind is v4 CSS-first via `@theme` in `apps/web/app/globals.css`; do not create `tailwind.config.js`; keep `tailwindcss` and `@tailwindcss/postcss` aligned. [VERIFIED: AGENTS.md]
- Supabase remains the single backend service for auth, database, storage, realtime, and Edge Functions; do not add Express or a separate auth provider. [VERIFIED: AGENTS.md]
- Use direct Supabase reads protected by RLS and Edge Functions/server actions for command-style writes and sensitive logic. [VERIFIED: AGENTS.md]
- Preserve the product rule: coach-first, code-second, and do not add unvalidated learning features or client choice surfaces. [VERIFIED: AGENTS.md]
- For any touched web UI, reuse base UI components, use tokens instead of raw hex, keep one primary action, use 56px controls, and keep copy calm. [VERIFIED: AGENTS.md] [VERIFIED: docs/ui-ux-agent-guidelines.md]
- Native clients should mirror tokens in platform constants until a generated token pipeline exists. [VERIFIED: AGENTS.md]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CSTATE-01 | Extract chat merge/status/read/snippet helpers into a portable core module with no platform dependencies. | Put reducer/types/helpers under `packages/core/src/chat-state/*`; add a dependency-boundary test that rejects React, Next, Zustand, Supabase, DOM, Swift, and Kotlin imports. [VERIFIED: .planning/REQUIREMENTS.md] |
| CSTATE-02 | Split the web chat route into focused local hooks. | Current `ChatClient` mixes at least messages/read states/realtime/presence/typing/recording/composer/actions/rendering; plan hook extraction before store insertion. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx] |
| CSTATE-03 | Introduce Zustand on web only as a thin coordination/cache adapter. | Use `zustand` `5.0.14`; upstream docs support selectors and vanilla stores with React `useStore`; keep server/Supabase authority outside the store. [VERIFIED: npm registry] [CITED: https://github.com/pmndrs/zustand] |
| CSTATE-04 | Add cross-platform JSON fixtures and protocol docs. | Fixtures must contain initial state, event list, and expected state/result so Kotlin/Swift can replay the contract independently. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| CSTATE-05 | Add Android/iOS architecture notes without native production implementation. | Android notes should map to `ViewModel` + `StateFlow`; iOS notes should map to SwiftUI observable model data. [CITED: https://developer.android.com/topic/libraries/architecture/viewmodel] [CITED: https://developer.apple.com/videos/play/wwdc2023/10149/] |
| CSTATE-06 | Preserve current chat behavior and verification gates. | Existing chat tests, e2e send test, `pnpm build`, `pnpm lint`, and `pnpm typecheck` are the release gate. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.test.tsx] [VERIFIED: apps/web/e2e/chat-send.spec.ts] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Portable chat event/result reducer | Shared package (`packages/core`) | Web/native adapters | Deterministic state transitions must be portable and fixture-backed. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| Web chat UI rendering | Browser / Client | Frontend server for initial data | `ChatClient` is a client component, while `page.tsx` fetches assigned conversation server-side and redirects unauthenticated users. [VERIFIED: apps/web/app/(authenticated)/chat/page.tsx] |
| Web shared chat coordination | Browser / Client | `packages/core` reducer | Zustand should cache/coordinate React surfaces by `conversationId`, not decide durable permissions. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| Chat persistence and authorization | Supabase / Database / Edge Functions | Next server actions | `send-message`, `chat-command`, RPCs, and RLS own writes, membership, read state, and persistence. [VERIFIED: supabase/functions/send-message/index.ts] [VERIFIED: supabase/functions/chat-command/index.ts] |
| Realtime subscriptions | Browser / Client adapter | Supabase Realtime | `realtime.ts` creates Supabase browser channels and translates rows to client DTOs. [VERIFIED: apps/web/app/(authenticated)/chat/realtime.ts] |
| Android future implementation | Native UI state holder | Shared JSON fixtures | Android should later use `ViewModel`/`StateFlow`, not web libraries. [CITED: https://developer.android.com/topic/architecture/ui-layer/stateholders] |
| iOS future implementation | Native observable model | Shared JSON fixtures | SwiftUI should later use observable model data, not TypeScript or Zustand. [CITED: https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.3 | Portable chat-state types and reducer | `packages/core` already builds with strict TypeScript and no runtime framework dependency. [VERIFIED: package.json] [VERIFIED: packages/core/tsconfig.json] |
| `@fish/core` | workspace `0.1.0` | Shared chat DTOs, limits, and new reducer/event contract | Existing shared package already exports `./chat`; extending it avoids web-only imports in portable state. [VERIFIED: packages/core/package.json] [VERIFIED: packages/core/src/chat.ts] |
| React | 19.2.7 | Existing web rendering target | Current chat route is a React client component under Next App Router. [VERIFIED: apps/web/package.json] [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx] |
| Next.js | 16.2.9 | Existing web App Router and server action boundary | Current `/chat` route loads server data and passes server actions into the client component. [VERIFIED: apps/web/package.json] [VERIFIED: apps/web/app/(authenticated)/chat/page.tsx] |
| `zustand` | 5.0.14 | Web-only store/adapter keyed by `conversationId` | Locked by D-10; official docs support selector reads and vanilla-store integration with React. [VERIFIED: npm registry] [CITED: https://github.com/pmndrs/zustand] |
| Supabase JS | 2.110.0 | Existing auth/database/realtime client | Current actions and realtime adapters already use Supabase clients and Edge Function URLs. [VERIFIED: apps/web/package.json] [VERIFIED: apps/web/app/(authenticated)/chat/actions.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.9 | Unit tests for reducer fixtures, dependency boundary, store selectors, and hook seams | Use via existing `@fish/web` test runner to avoid adding a new test framework. [VERIFIED: apps/web/package.json] [VERIFIED: apps/web/vitest.config.ts] |
| Testing Library React | 16.3.2 | Regression tests for `ChatClient` visible behavior after refactor | Keep current route behavior tests and add focused hook/store tests as seams are extracted. [VERIFIED: apps/web/package.json] |
| Playwright | 1.61.1 | Browser send-flow smoke test | Keep `apps/web/e2e/chat-send.spec.ts` for release-level CSTATE-06 coverage. [VERIFIED: apps/web/package.json] [VERIFIED: apps/web/e2e/chat-send.spec.ts] |
| Zod | 4.4.3 | Server-action command validation | Continue using existing action schemas; do not move trust into the client store. [VERIFIED: apps/web/package.json] [VERIFIED: apps/web/app/(authenticated)/chat/actions.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zustand` web adapter | Redux or Jotai | Explicitly out by D-10; adding a second state library creates planning and migration noise. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| JSON fixtures | Generated Kotlin/Swift code from TypeScript | Explicitly deferred; fixtures are simpler and keep native idioms available later. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| Supabase Edge Functions/RLS | Express API | Forbidden by AGENTS.md unless product need proves it. [VERIFIED: AGENTS.md] |

**Installation:**

```bash
pnpm --filter @fish/web add zustand
```

**Version verification:** `pnpm view zustand version time.created time.modified repository.url homepage license scripts.postinstall` returned `5.0.14`, created `2019-04-09T13:47:37.089Z`, modified `2026-05-28T10:17:58.503Z`, upstream `git+https://github.com/pmndrs/zustand.git`, MIT license, and no `postinstall`. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `zustand` | npm | Since 2019-04-09 | 40,292,085/week for 2026-06-29..2026-07-05 | `github.com/pmndrs/zustand` | OK | Approved for web-only adapter. [VERIFIED: npm registry] |

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: package-legitimacy]
**Packages flagged as suspicious [SUS]:** none. [VERIFIED: package-legitimacy]

## Architecture Patterns

### System Architecture Diagram

```text
Initial /chat request
  -> Next server route loads assigned conversation via Supabase service
  -> ChatClient receives authorized DTOs and server-action functions
  -> Web hooks hydrate Zustand adapter by conversationId
  -> Zustand adapter dispatches portable chat-state events into @fish/core reducer
  -> React selectors render narrow slices of current conversation state

User send
  -> composer hook creates clientRequestId and dispatches sendOptimisticMessage
  -> UI renders pending local message immediately
  -> server action calls send-message Edge Function or local RPC fallback
  -> Supabase RPC persists or returns existing idempotent row
  -> confirmSentMessage or markMessageFailed event updates reducer state
  -> failed state preserves message body and retry reuses clientRequestId

Remote/realtime update
  -> Supabase Realtime adapter receives messages/read states/reaction changes
  -> web hook translates database rows to portable DTO events
  -> reducer merges by id/clientRequestId and stable createdAt/id ordering
  -> Zustand publishes selected slices to subscribed React components

Native future
  -> Android/iOS load same JSON fixtures and protocol docs
  -> native ViewModel/observable model implements same event/result contract
```

### Recommended Project Structure

```text
packages/core/src/
  chat.ts                         # existing DTOs/limits, extend or re-export state types
  docs/
    chat-state-protocol.md        # platform-neutral event/result contract
  chat-state/
    index.ts                      # public reducer/helper exports
    types.ts                      # portable ChatState, ChatEvent, ChatResult
    reducer.ts                    # deterministic event transitions
    selectors.ts                  # unread/status/snippet/reply-preview helpers
    fixtures/
      chat-state-vectors.json     # JSON compatibility vectors

apps/web/app/(authenticated)/chat/
  chat-state.ts                   # compatibility shim to @fish/core/chat-state during migration
  hooks/
    use-chat-messages.ts          # hydrate/merge/refresh messages
    use-chat-read-state.ts        # mark/merge read state
    use-chat-realtime.ts          # subscribe/unsubscribe and backfill callbacks
    use-chat-presence.ts          # presence/typing/recording adapter
    use-chat-composer.ts          # draft/reply/edit/send/retry behavior
  store/
    chat-store.ts                 # zustand vanilla store and actions
    chat-selectors.ts             # narrow selectors by conversationId
```

### Pattern 1: Portable Event Reducer

**What:** Model chat changes as typed events that return new immutable state plus optional result metadata. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

**When to use:** Any transition that must match across web, Android, and iOS, such as hydration, optimistic send, confirmation, failure, remote merge, read-state merge, unread count, snippets, and reply preview. [VERIFIED: .planning/REQUIREMENTS.md]

**Example:**

```typescript
// Source: Phase 09 context + current chat-state helpers.
type ChatEvent =
  | { type: "hydrateConversation"; conversationId: string; messages: ChatMessage[]; readStates: ChatReadState[] }
  | { type: "sendOptimisticMessage"; message: ChatMessage; clientRequestId: string }
  | { type: "confirmSentMessage"; message: ChatMessage; localRequestId: string }
  | { type: "markMessageFailed"; clientRequestId: string }
  | { type: "mergeRemoteMessage"; message: ChatMessage }
  | { type: "mergeReadState"; readState: ChatReadState };

export function reduceChatState(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "confirmSentMessage":
      return mergeMessageIntoState(state, event.message, event.localRequestId);
    case "mergeRemoteMessage":
      return mergeMessageIntoState(state, event.message);
    default:
      return state;
  }
}
```

### Pattern 2: Thin Zustand Adapter

**What:** Use Zustand as a React/web cache whose actions call the portable reducer; subscribe with narrow selectors instead of reading the whole chat state. [CITED: https://github.com/pmndrs/zustand]

**When to use:** Shared web surfaces need the same conversation state or draft/reply/edit metadata without prop-drilling through one large route component. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx]

**Example:**

```typescript
// Source: Zustand upstream README: createStore/useStore selector pattern.
import { createStore, useStore } from "zustand";
import { reduceChatState, type ChatEvent, type ChatState } from "@fish/core/chat-state";

type ChatStore = {
  conversations: Record<string, ChatState>;
  dispatch: (conversationId: string, event: ChatEvent) => void;
};

export const chatStore = createStore<ChatStore>()((set) => ({
  conversations: {},
  dispatch: (conversationId, event) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [conversationId]: reduceChatState(state.conversations[conversationId], event),
      },
    })),
}));

export function useConversationMessages(conversationId: string) {
  return useStore(chatStore, (state) => state.conversations[conversationId]?.messages ?? []);
}
```

### Pattern 3: Hook Extraction Before Store Introduction

**What:** Extract local hooks while behavior is still backed by React local state, then swap hook internals to Zustand after tests pin behavior. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

**When to use:** The current component has too many concerns to refactor and globalize state in one step. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx]

**Example:**

```typescript
// Source: Current ChatClient send lifecycle.
const composer = useChatComposer({
  conversationId: chat.conversationId,
  currentUser: { id: chat.currentUserId, role: chat.currentUserRole },
  sendMessageAction,
});

const messages = useConversationMessages(chat.conversationId);
```

### Anti-Patterns to Avoid

- **Portable core imports web aliases:** `@/lib/services`, React, Zustand, Supabase, DOM globals, or Next imports in `packages/core` break CSTATE-01. [VERIFIED: apps/web/app/(authenticated)/chat/chat-state.ts]
- **Zustand owns permissions:** Storing role/assignment truth in the web store bypasses the RLS/Edge Function authority boundary. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]
- **Fixture files without expected output:** Native teams cannot prove parity if fixtures only contain input events. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]
- **One-shot rewrite of `ChatClient`:** Existing tests cover many subtle UI behaviors; split hooks first so regressions are attributable. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.test.tsx]
- **New product surface while refactoring state:** Conversation pickers, menus, assignment UI, notifications, and learning mechanics are out of scope. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Web external-store subscription | Custom subscription hook around mutable globals | Zustand `useStore` selectors | React external-store snapshots must be stable; Zustand already integrates this pattern. [CITED: https://react.dev/reference/react/useSyncExternalStore] [CITED: https://github.com/pmndrs/zustand] |
| Authorization and assignment | Browser/store permission checks | Supabase RLS, RPCs, Edge Functions, server actions | Existing project boundary puts durable security on Supabase/server side. [VERIFIED: AGENTS.md] [VERIFIED: supabase/migrations/0013_realtime_chat_features.sql] |
| Cross-platform parity | Native clients importing web state library | JSON fixtures plus native containers | D-12 requires event names/state shape/fixture expectations, not generated TypeScript consumption. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| Message idempotency | Local de-dupe only | Existing `clientRequestId` plus database idempotency and reducer reconciliation | Phase 8 already verified idempotent sends at the write boundary. [VERIFIED: .planning/phases/08-real-chat-route-send-message-edge-function/08-VERIFICATION.md] |
| Command validation | Store-side validation as final authority | Existing Zod server-action schemas plus Edge Function/RPC checks | Current `actions.ts` validates command payloads before privileged writes. [VERIFIED: apps/web/app/(authenticated)/chat/actions.ts] |

**Key insight:** The store can optimize React coordination, but the portable reducer and Supabase boundary are the real contract; custom shortcuts in the store would make native parity and security harder. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Supabase tables store durable conversations, messages, message reads, message reactions, and presence sessions; this phase does not rename persisted columns or require schema changes by default. [VERIFIED: supabase/migrations/0010_chat.sql] [VERIFIED: supabase/migrations/0013_realtime_chat_features.sql] | No data migration unless planner deliberately changes fixture-only schema, which is not recommended. |
| Live service config | Supabase functions `send-message` and `chat-command` are configured in `supabase/config.toml`; source refactor does not automatically redeploy hosted functions. [VERIFIED: supabase/config.toml] | If action payload shapes change, update function code and include deploy/UAT notes; otherwise no live config change. |
| OS-registered state | No launchd/systemd/pm2/task scheduler files found in repo scan. [VERIFIED: local file scan] | None. |
| Secrets/env vars | `.env.local`/`.env.example` and Edge Functions use Supabase URL/key environment, not chat-state module names. [VERIFIED: apps/web/.env.example] [VERIFIED: supabase/functions/send-message/index.ts] | Do not rename env keys in this phase. |
| Build artifacts | `node_modules` exists; no source-owned build artifact migration is required. [VERIFIED: local file scan] | After adding `zustand`, run pnpm install/add through pnpm and let lockfile update; stale `.next` is regenerated by build/dev. |

## Common Pitfalls

### Pitfall 1: Portable Core Keeps Web Types

**What goes wrong:** The extracted reducer still imports `ClientChatMessage` from `@/lib/services` or `MessageStatusValue` from `@/components/chat`. [VERIFIED: apps/web/app/(authenticated)/chat/chat-state.ts]

**Why it happens:** The existing helper file is pure logic but typed through web aliases. [VERIFIED: apps/web/app/(authenticated)/chat/chat-state.ts]

**How to avoid:** Define portable DTOs/status values in `@fish/core`, then make web service types adapt to them or extend them. [VERIFIED: packages/core/src/chat.ts]

**Warning signs:** `packages/core` import graph contains `@/`, `react`, `next`, `zustand`, `@supabase/*`, `window`, or `document`. [VERIFIED: packages/core/tsconfig.json]

### Pitfall 2: Zustand Becomes the Chat Authority

**What goes wrong:** Store actions decide whether a user may send, read, assign, or persist chat data. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

**Why it happens:** A global store can look like the easiest place to centralize all decisions. [CITED: https://github.com/pmndrs/zustand]

**How to avoid:** Store only cache/coordination state; server actions, Edge Functions, RPCs, and RLS remain authoritative. [VERIFIED: AGENTS.md]

**Warning signs:** Store contains Supabase clients, service-role data, auth/session truth, or assignment logic. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

### Pitfall 3: Duplicate Optimistic Messages

**What goes wrong:** A pending local message and confirmed server row both render after realtime or send confirmation. [VERIFIED: apps/web/app/(authenticated)/chat/chat-state.test.ts]

**Why it happens:** Merge logic keys by only `id` and misses `clientRequestId` or local request id. [VERIFIED: apps/web/app/(authenticated)/chat/chat-state.ts]

**How to avoid:** Keep reconciliation by `id`, incoming `clientRequestId`, and explicit `localRequestId`; fixtures must cover duplicate `clientRequestId`. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

**Warning signs:** UI list key uses unstable server id for pending messages or retry creates a new request id. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx]

### Pitfall 4: Read Status Depends on Missing Ordering

**What goes wrong:** Delivered/read status is wrong when read marker IDs are absent from the current message array. [VERIFIED: apps/web/app/(authenticated)/chat/chat-state.ts]

**Why it happens:** Current helper compares marker and target indexes in the loaded message list. [VERIFIED: apps/web/app/(authenticated)/chat/chat-state.ts]

**How to avoid:** Fixture-test missing marker IDs, partial hydration, and monotonic merges; keep current behavior unless product requirements change. [VERIFIED: apps/web/app/(authenticated)/chat/chat-state.test.ts]

**Warning signs:** A remote read-state event arrives before its referenced message and status flips incorrectly. [VERIFIED: scripts/verify-chat-realtime.ts]

### Pitfall 5: Native Notes Overreach

**What goes wrong:** Phase plan starts implementing native chat screens or generated code. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

**Why it happens:** Android/iOS skeletons already have preview chat components, which can tempt production work. [VERIFIED: apps/android/app/src/main/java/space/fishhub/app/feature/app/AppShell.kt] [VERIFIED: apps/ios/FISH/Features/Chat/Screens/ChatPreviewScreen.swift]

**How to avoid:** Limit native work to architecture notes and fixture contract mapping. [VERIFIED: .planning/REQUIREMENTS.md]

**Warning signs:** Planner tasks modify native runtime chat flows instead of docs/tests/fixtures. [VERIFIED: .planning/REQUIREMENTS.md]

## Code Examples

Verified patterns from current code and official sources:

### Merge by ID and Client Request ID

```typescript
// Source: apps/web/app/(authenticated)/chat/chat-state.ts
const existingIndex = current.findIndex(
  (message) =>
    message.id === incoming.id ||
    message.clientRequestId === incoming.clientRequestId ||
    message.clientRequestId === localRequestId
);
```

### Selector-Based Zustand Consumption

```typescript
// Source: https://github.com/pmndrs/zustand
const messages = useStore(
  chatStore,
  (state) => state.conversations[conversationId]?.messages ?? []
);
```

### Android Future Mapping

```kotlin
// Source: https://developer.android.com/topic/architecture/ui-layer/stateholders
class ChatViewModel : ViewModel() {
    val uiState: StateFlow<ChatUiState> = TODO("replay JSON fixture events later")

    fun dispatch(event: ChatEvent) {
        TODO("apply native reducer equivalent")
    }
}
```

### iOS Future Mapping

```swift
// Source: https://developer.apple.com/videos/play/wwdc2023/10149/
@Observable
final class ChatModel {
    var state: ChatState

    func dispatch(_ event: ChatEvent) {
        state = reduce(state, event)
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One `ChatClient` owns all local chat state | Portable reducer plus thin platform adapters | Phase 09 target | Enables web/native parity without new UI choices. [VERIFIED: .planning/REQUIREMENTS.md] |
| React local state only | Zustand adapter for shared web surfaces | Phase 09 target | Allows multiple web surfaces to coordinate by `conversationId` while retaining Supabase authority. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| Web behavior tests only | JSON event/result fixtures | Phase 09 target | Native teams can later implement equivalent reducers in Kotlin/Swift. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| `ObservableObject`/Combine-style iOS model | Swift Observation `@Observable` model | Apple WWDC23 | Preferred architecture note for future SwiftUI model data. [CITED: https://developer.apple.com/videos/play/wwdc2023/10149/] |

**Deprecated/outdated:**
- Generated shared native code pipeline: explicitly deferred for this phase. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]
- New Express API layer: forbidden by AGENTS.md unless proven necessary later. [VERIFIED: AGENTS.md]

## Assumptions Log

All claims in this research were verified locally, checked against package tooling, or cited from official/upstream documentation.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| None | No `[ASSUMED]` claims. | All sections | None. |

## Open Questions (RESOLVED)

1. **Should edit/delete/reaction events enter the cross-platform fixture contract now?**
   - What we know: The current web route already implements edit/delete/reaction paths. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx]
   - Resolution: Edit, delete, and reaction events do not enter the required cross-platform fixture minimum in Phase 09. The portable fixture minimum remains the ten CSTATE/D-03 cases named in `09-01-PLAN.md`: `hydrateConversation`, `sendOptimisticMessage`, `confirmSentMessage`, `markMessageFailed`, `mergeRemoteMessage`, `duplicateClientRequestIdReconciliation`, `mergeReadState`, `unreadCount`, `deletedMessageSnippet`, and `replyPreview`.
   - Execution note: Existing web edit/delete/reaction behavior must still be preserved and tested through `apps/web/app/(authenticated)/chat/chat-client.test.tsx` and Plans 09-02/09-03, but it is not part of the native parity fixture contract unless a later phase expands that contract.

2. **Where should protocol docs live?**
   - What we know: `packages/core` is the portable contract owner and `apps/web` is the web adapter. [VERIFIED: packages/core/package.json]
   - Resolution: The human-readable protocol document lives at `packages/core/docs/chat-state-protocol.md`. Native implementation notes live at `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md`. The fixture JSON lives at `packages/core/src/chat-state/fixtures/chat-state-vectors.json`.
   - Execution note: Plans and implementation should link to those exact paths so web, Android, and iOS follow the same portable contract without moving protocol ownership into the web route.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | pnpm scripts, Next, Vitest | yes | v25.9.0 | Use project-supported Node if CI differs. [VERIFIED: local command] |
| pnpm | Workspace package install/test/build | yes | 11.7.0 | None; AGENTS forbids npm. [VERIFIED: local command] |
| Supabase CLI | Existing local DB/function verification | yes | 2.109.0 | Use focused unit tests if local Supabase is not started; release gates still need Supabase-backed checks when touching server boundary. [VERIFIED: local command] |
| Xcode | iOS architecture note context only | yes | 26.6 / build 17F113 | Not needed for Phase 09 implementation because native production work is out of scope. [VERIFIED: local command] |
| Java runtime | Android build/test | no | - | Not blocking because Android production implementation is out of scope; required only if planner adds Android tests, which it should not. [VERIFIED: local command] |
| Context7 CLI | Documentation lookup fallback | no | - | Used official/upstream web documentation instead. [VERIFIED: local command] |

**Missing dependencies with no fallback:**
- None for the planned web/core implementation. [VERIFIED: local command]

**Missing dependencies with fallback:**
- Java runtime is missing; avoid Android build/test tasks in this phase. [VERIFIED: local command]
- Context7 CLI is missing; official docs were used as fallback sources. [VERIFIED: local command]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 for focused unit/component tests; Playwright 1.61.1 for browser send smoke. [VERIFIED: apps/web/package.json] |
| Config file | `apps/web/vitest.config.ts`; `apps/web/playwright.config.ts`. [VERIFIED: local file scan] |
| Quick run command | `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/chat-state.test.ts apps/web/app/\\(authenticated\\)/chat/chat-client.test.tsx` |
| Full suite command | `pnpm --filter @fish/web test && pnpm typecheck && pnpm lint && pnpm build` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CSTATE-01 | Portable core has no forbidden imports and preserves merge/status/read/snippet behavior. | unit/static | `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/chat-state.test.ts` plus new dependency-boundary test | Partial - Wave 0 |
| CSTATE-02 | Chat route hook extraction preserves existing UI behavior. | component | `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/chat-client.test.tsx` | yes |
| CSTATE-03 | Zustand adapter stores only allowed web coordination state and selector updates are narrow. | unit | new `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` | no - Wave 0 |
| CSTATE-04 | JSON fixtures replay to expected event/result states. | unit/fixture | new fixture runner test importing `@fish/core/chat-state` | no - Wave 0 |
| CSTATE-05 | Android/iOS notes map events to native containers without native implementation. | docs/static | `rg -n "ViewModel|StateFlow|Observable|ChatEvent" .planning/phases/09-cross-platform-chat-state packages/core` | no - Wave 0 |
| CSTATE-06 | Current visible behavior, send flow, gates stay green. | component/e2e/build | `pnpm --filter @fish/web test && pnpm --filter @fish/web e2e && pnpm build && pnpm lint && pnpm typecheck` | yes |

### Sampling Rate

- **Per task commit:** `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/chat-state.test.ts apps/web/app/\\(authenticated\\)/chat/chat-client.test.tsx`
- **Per wave merge:** `pnpm --filter @fish/web test && pnpm typecheck && pnpm lint`
- **Phase gate:** `pnpm build`, `pnpm lint`, `pnpm typecheck`, focused chat tests, and browser chat send smoke before `$gsd-verify-work`. [VERIFIED: AGENTS.md] [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md]

### Wave 0 Gaps

- [ ] `packages/core/src/chat-state/*` - portable reducer/types/selectors for CSTATE-01/CSTATE-04.
- [ ] `packages/core/src/chat-state/fixtures/chat-state-vectors.json` - cross-platform event/result vectors for CSTATE-04.
- [ ] `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` - Zustand adapter constraints for CSTATE-03.
- [ ] Dependency-boundary test - rejects forbidden imports from portable core for CSTATE-01.
- [ ] Protocol/architecture notes - Android `ViewModel` + `StateFlow`, iOS observable model mapping for CSTATE-05.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes, existing | Next server route and Supabase session checks remain outside Zustand. [VERIFIED: apps/web/app/(authenticated)/chat/page.tsx] |
| V3 Session Management | yes, existing | Supabase auth/server services remain the session source; store must not cache session truth. [VERIFIED: apps/web/lib/services/supabase/types.ts] |
| V4 Access Control | yes | Supabase RLS, Edge Functions, and RPCs decide conversation membership and writes. [VERIFIED: supabase/migrations/0013_realtime_chat_features.sql] |
| V5 Input Validation | yes | Keep Zod server-action schemas and database checks; reducer fixtures do not replace validation. [VERIFIED: apps/web/app/(authenticated)/chat/actions.ts] |
| V6 Cryptography | limited | Use platform `crypto.randomUUID` only for local request ids; do not create custom auth or crypto. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Store tampering with role/assignment | Elevation of privilege | Never trust Zustand for auth/assignment; RLS and Edge Functions remain authoritative. [VERIFIED: .planning/phases/09-cross-platform-chat-state/09-CONTEXT.md] |
| Duplicate sends through retry/double tap | Repudiation / integrity | Preserve `clientRequestId` idempotency and reducer reconciliation. [VERIFIED: .planning/phases/08-real-chat-route-send-message-edge-function/08-SECURITY.md] |
| Message body injection | Tampering / XSS | Continue rendering message text as React text content, not `dangerouslySetInnerHTML`; keep command validation server-side. [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx] |
| Global web store leaks data across users or server renders | Information disclosure | Keep Zustand in client-only modules and do not use hook utility state in React Server Components. [CITED: https://github.com/pmndrs/zustand] |
| Stale realtime/read state | Integrity | Refresh conversation on reconnect and merge read states through reducer events. [VERIFIED: apps/web/app/(authenticated)/chat/realtime.ts] [VERIFIED: apps/web/app/(authenticated)/chat/chat-client.tsx] |

## Sources

### Primary (HIGH confidence)

- `AGENTS.md` - product, stack, design, package, and Supabase boundary constraints.
- `.planning/phases/09-cross-platform-chat-state/09-CONTEXT.md` - locked Phase 09 decisions and out-of-scope boundaries.
- `.planning/REQUIREMENTS.md` - CSTATE-01 through CSTATE-06.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - current route state and behavior.
- `apps/web/app/(authenticated)/chat/chat-state.ts` - current pure helper boundary and web type leaks.
- `apps/web/app/(authenticated)/chat/actions.ts` - server action validation and Edge Function/RPC boundary.
- `apps/web/app/(authenticated)/chat/realtime.ts` - Supabase browser realtime adapter.
- `packages/core/src/chat.ts` and `packages/core/package.json` - existing shared chat DTO package.

### Secondary (MEDIUM confidence)

- https://github.com/pmndrs/zustand - Zustand upstream README/API patterns, version release note, vanilla store and selector examples.
- https://zustand.docs.pmnd.rs/reference/hooks/use-store - Zustand `useStore` hook reference.
- https://react.dev/reference/react/useSyncExternalStore - React external-store subscription semantics.
- https://developer.android.com/topic/libraries/architecture/viewmodel - Android ViewModel state-holder guidance.
- https://developer.android.com/topic/architecture/ui-layer/stateholders - Android UI state holders and `StateFlow` examples.
- https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app - SwiftUI model data and Observation reference.
- https://developer.apple.com/videos/play/wwdc2023/10149/ - SwiftUI Observation/@Observable guidance.

### Tertiary (LOW confidence)

- None used for recommendations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package versions and local stack were verified from package files and registry/package-legitimacy checks.
- Architecture: HIGH - driven by locked CONTEXT decisions and current code inspection.
- Pitfalls: HIGH - derived from existing tests, route code, and locked phase boundaries.
- Native notes: MEDIUM - based on official Android/Apple docs, but native production implementation is out of scope.

**Research date:** 2026-07-07
**Valid until:** 2026-08-06 for local architecture; 2026-07-14 for package-version freshness.
