# Phase 09: Cross-platform Chat State - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 18 new/modified files
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/chat.ts` | model | request-response | `packages/core/src/chat.ts` | exact |
| `packages/core/src/index.ts` | config | transform | `packages/core/src/index.ts` | exact |
| `packages/core/package.json` | config | transform | `packages/core/package.json` | exact |
| `packages/core/src/chat-state/index.ts` | config | transform | `packages/core/src/index.ts` | role-match |
| `packages/core/src/chat-state/types.ts` | model | event-driven | `packages/core/src/chat.ts` | role-match |
| `packages/core/src/chat-state/reducer.ts` | utility | event-driven | `apps/web/app/(authenticated)/chat/chat-state.ts` | exact |
| `packages/core/src/chat-state/selectors.ts` | utility | transform | `apps/web/app/(authenticated)/chat/chat-state.ts` | exact |
| `packages/core/src/chat-state/fixtures/*.json` | test | event-driven | `apps/web/app/(authenticated)/chat/chat-state.test.ts` | role-match |
| `apps/web/app/(authenticated)/chat/chat-state.ts` | utility | transform | `apps/web/app/(authenticated)/chat/chat-state.ts` | exact |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` | hook | event-driven | `apps/web/app/(authenticated)/chat/chat-client.tsx` | exact |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts` | hook | request-response | `apps/web/app/(authenticated)/chat/chat-client.tsx` | exact |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` | hook | streaming | `apps/web/app/(authenticated)/chat/realtime.ts` | exact |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-presence.ts` | hook | streaming | `apps/web/app/(authenticated)/chat/chat-client.tsx` | exact |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts` | hook | request-response | `apps/web/app/(authenticated)/chat/chat-client.tsx` | exact |
| `apps/web/app/(authenticated)/chat/store/chat-store.ts` | store | event-driven | `apps/web/app/(authenticated)/chat/chat-client.tsx` | role-match |
| `apps/web/app/(authenticated)/chat/store/chat-selectors.ts` | store | transform | `apps/web/app/(authenticated)/chat/chat-state.ts` | role-match |
| `apps/web/app/(authenticated)/chat/chat-client.tsx` | component | event-driven | `apps/web/app/(authenticated)/chat/chat-client.tsx` | exact |
| `docs/chat-state-protocol.md` | config | event-driven | `apps/ios/FISH/Features/Chat/Models/ChatModels.swift` | partial |

## Pattern Assignments

### `packages/core/src/chat.ts` and `packages/core/src/chat-state/types.ts` (model, event-driven/request-response)

**Analog:** `packages/core/src/chat.ts`

**Imports and DTO pattern** (lines 1-6):
```typescript
import type { UserRole } from "./roles";

export type ConversationId = string;
export type MessageId = string;
export type UserId = string;
```

**Core model pattern** (lines 21-38):
```typescript
export interface ChatMessage {
  id: MessageId;
  conversationId: ConversationId;
  senderId: UserId;
  senderRole: UserRole;
  body: string;
  createdAt: string;
}

export interface SendMessageCommand {
  conversationId: ConversationId;
  body: string;
  clientRequestId?: string;
}
```

**Apply:** Keep portable chat-state DTOs in `@fish/core`, use explicit string IDs, and import only from sibling core modules. Do not import React, Next, Zustand, Supabase, DOM APIs, or web aliases.

### `packages/core/package.json` and `packages/core/src/index.ts` (config, transform)

**Analogs:** `packages/core/package.json`, `packages/core/src/index.ts`

**Package export pattern** (`packages/core/package.json` lines 6-10):
```json
"exports": {
  ".": "./src/index.ts",
  "./chat": "./src/chat.ts",
  "./roles": "./src/roles.ts"
}
```

**Barrel export pattern** (`packages/core/src/index.ts` lines 1-2):
```typescript
export * from "./chat";
export * from "./roles";
```

**Apply:** Add `./chat-state` to package exports and re-export chat-state from the core barrel only after the public API is stable.

### `packages/core/src/chat-state/reducer.ts` and `selectors.ts` (utility, event-driven/transform)

**Analog:** `apps/web/app/(authenticated)/chat/chat-state.ts`

**Imports to replace** (lines 1-5):
```typescript
import type {
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import type { MessageStatusValue } from "@/components/chat";
```

**Do not copy these imports into core.** Copy the behavior, but replace web types with `@fish/core` portable types.

**Deterministic merge pattern** (lines 15-34):
```typescript
export function mergeChatMessage<T extends ClientChatMessage>(
  current: T[],
  incoming: T,
  localRequestId = incoming.clientRequestId
): T[] {
  const existingIndex = current.findIndex(
    (message) =>
      message.id === incoming.id ||
      message.clientRequestId === incoming.clientRequestId ||
      message.clientRequestId === localRequestId
  );

  if (existingIndex === -1) {
    return [...current, incoming].sort(compareChatMessages);
  }

  const next = [...current];
  next[existingIndex] = { ...next[existingIndex], ...incoming };
  return next.sort(compareChatMessages);
}
```

**Status/read selector pattern** (lines 51-77):
```typescript
export function getOutgoingMessageStatus(
  message: ClientChatMessage,
  messages: ClientChatMessage[],
  participantReadState: ClientChatReadState | null | undefined
): Extract<MessageStatusValue, "sent" | "delivered" | "read"> {
  if (isAtOrAfterMessage(participantReadState?.lastReadMessageId, message.id, messages)) {
    return "read";
  }

  if (isAtOrAfterMessage(participantReadState?.lastDeliveredMessageId, message.id, messages)) {
    return "delivered";
  }

  return "sent";
}
```

**Unread/snippet/reply pattern** (lines 79-119):
```typescript
export function countUnreadMessages(
  messages: ClientChatMessage[],
  currentUserId: string,
  currentUserReadState: ClientChatReadState | null | undefined
): number {
  const lastReadIndex = currentUserReadState?.lastReadMessageId
    ? messages.findIndex((message) => message.id === currentUserReadState.lastReadMessageId)
    : -1;

  return messages.filter(
    (message, index) => index > lastReadIndex && message.senderId !== currentUserId
  ).length;
}

export function getMessageSnippet(message: ClientChatMessage): string {
  if (message.deletedAt) {
    return "Message deleted";
  }
  const body = message.body.trim();
  return body.length <= 96 ? body : `${body.slice(0, 95)}...`;
}
```

**Apply:** Reducer events should wrap these helpers: `hydrateConversation`, `sendOptimisticMessage`, `confirmSentMessage`, `markMessageFailed`, `mergeRemoteMessage`, `mergeReadState`, `setReplyTarget`, `setEditTarget`, and `clearComposer`.

### `apps/web/app/(authenticated)/chat/chat-state.ts` (utility shim, transform)

**Analog:** `apps/web/app/(authenticated)/chat/chat-state.ts`

**Apply:** Keep this file as a compatibility shim during migration. It should import/re-export from `@fish/core/chat-state` and perform any temporary web type adaptation. Preserve current exported function names until `chat-client.test.tsx` and `chat-state.test.ts` are updated.

### `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` (hook, event-driven)

**Analog:** `apps/web/app/(authenticated)/chat/chat-client.tsx`

**Local message normalization** (lines 93-110):
```typescript
function toLocalMessage(message: ClientChatMessage): LocalMessage {
  return {
    ...message,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    replyToMessageId: message.replyToMessageId ?? null,
    reactions: message.reactions ?? [],
    localStatus: "sent",
  };
}

function mergeMessage(
  current: LocalMessage[],
  incomingMessage: ClientChatMessage,
  localRequestId = incomingMessage.clientRequestId
): LocalMessage[] {
  return mergeChatMessage(current, toLocalMessage(incomingMessage), localRequestId);
}
```

**Refresh/backfill pattern** (lines 227-277):
```typescript
const refreshMessages = useCallback(async (messageIds: string[]) => {
  if (!refreshMessagesAction || messageIds.length === 0) {
    return;
  }

  const result = await refreshMessagesAction({
    messageIds: Array.from(new Set(messageIds)),
  }).catch(() => null);

  if (result?.status === "sent" && result.messages) {
    setMessages((current) =>
      result.messages!.reduce((next, message) => mergeMessage(next, message), current)
    );
  }
}, [refreshMessagesAction]);
```

**Apply:** Extract message hydration, merge, refresh-by-ids, and refresh-conversation logic first while still preserving visible route behavior.

### `apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts` (hook, request-response)

**Analog:** `apps/web/app/(authenticated)/chat/chat-client.tsx`

**Read-state merge pattern** (lines 112-124):
```typescript
function mergeReadState(
  current: ClientChatReadState[],
  incoming: ClientChatReadState
): ClientChatReadState[] {
  const existingIndex = current.findIndex((state) => state.userId === incoming.userId);
  if (existingIndex === -1) {
    return [...current, incoming];
  }

  const next = [...current];
  next[existingIndex] = incoming;
  return next;
}
```

**Mark-read effect pattern** (lines 419-447):
```typescript
const latestParticipantMessage = [...messages]
  .reverse()
  .find((message) => message.senderId !== chat.currentUserId);

if (!latestParticipantMessage) {
  return;
}

void markReadStateAction({
  conversationId: chat.conversationId,
  lastDeliveredMessageId: latestParticipantMessage.id,
  lastReadMessageId: latestParticipantMessage.id,
}).then((result) => {
  if (result.status === "sent" && result.readState) {
    setReadStates((current) => mergeReadState(current, result.readState!));
  }
}).catch(() => undefined);
```

**Apply:** The hook may call server actions, but durable read authority stays in server action/Edge Function/RLS.

### `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` (hook, streaming)

**Analog:** `apps/web/app/(authenticated)/chat/realtime.ts`

**Adapter imports** (lines 1-12):
```typescript
import type {
  ClientChatMessage,
  ClientChatPresenceSession,
  ClientChatReadState,
} from "@/lib/services";
import { createBrowserSupabaseClient } from "@/lib/services/supabase/browser";
import type { MessageReadRow, MessageRow } from "@fish/supabase";
```

**Message subscription pattern** (lines 104-151):
```typescript
export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: ClientChatMessage) => void,
  onReconnected?: () => void
): () => void {
  const supabase = createBrowserSupabaseClient();
  const channel = supabase
    .channel(`conversation:${conversationId}:messages`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      const message = toClientChatMessage(payload.new);
      if (message) {
        onMessage(message);
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onReconnected?.();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
```

**Typing/recording broadcast pattern** (lines 265-304):
```typescript
export function subscribeToConversationTyping(
  conversationId: string,
  currentUserId: string,
  onTypingChange: (typing: boolean) => void
): ConversationTypingSubscription {
  const supabase = createBrowserSupabaseClient();
  const channel = supabase
    .channel(`conversation:${conversationId}:typing`, {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: "typing" }, (event) => {
      const { userId, typing } = event.payload ?? {};
      if (typeof userId !== "string" || userId === currentUserId) {
        return;
      }
      if (typeof typing === "boolean") {
        onTypingChange(typing);
      }
    })
    .subscribe();
```

**Apply:** Keep Supabase browser client, channels, broadcasts, and DOM cleanup web-only. Convert subscription callbacks into portable reducer/store events.

### `apps/web/app/(authenticated)/chat/hooks/use-chat-presence.ts` (hook, streaming)

**Analogs:** `apps/web/app/(authenticated)/chat/chat-client.tsx`, `apps/web/app/(authenticated)/chat/realtime.ts`

**Presence session lifecycle** (`chat-client.tsx` lines 289-295):
```typescript
useEffect(() => {
  const presence = startPresenceSession(chat.currentUserId);

  return () => {
    presence.stop();
  };
}, [chat.currentUserId]);
```

**Browser activity pattern** (`realtime.ts` lines 395-423):
```typescript
writePresence(false);
const interval = setInterval(() => writePresence(false), 25000);
const activityEvents = ["pointerdown", "keydown", "focus"] as const;
activityEvents.forEach((eventName) => {
  window.addEventListener(eventName, markActive, { passive: true });
});

const stop = () => {
  if (stopped) {
    return;
  }
  stopped = true;
  clearInterval(interval);
  activityEvents.forEach((eventName) => {
    window.removeEventListener(eventName, markActive);
  });
  writePresence(true);
};
```

**Apply:** Presence is platform-specific and should not move into `packages/core/chat-state` except as a simple display input if needed.

### `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts` (hook, request-response)

**Analog:** `apps/web/app/(authenticated)/chat/chat-client.tsx`

**Draft/typing pattern** (lines 480-499):
```typescript
function handleDraftChange(value: string) {
  setDraft(value);
  setNotice(null);

  if (value.trim().length === 0) {
    stopLocalTyping();
    return;
  }

  sendLocalTyping(true);
  if (localTypingTimeoutRef.current) {
    clearTimeout(localTypingTimeoutRef.current);
  }
  localTypingTimeoutRef.current = setTimeout(() => {
    sendLocalTyping(false);
    localTypingTimeoutRef.current = null;
  }, 3000);
}
```

**Optimistic send pattern** (lines 501-568):
```typescript
const optimistic: LocalMessage = {
  id: clientRequestId,
  conversationId: chat.conversationId,
  senderId: chat.currentUserId,
  senderRole: chat.currentUserRole,
  body,
  clientRequestId,
  editedAt: null,
  deletedAt: null,
  replyToMessageId,
  reactions: [],
  createdAt: new Date().toISOString(),
  localStatus: "pending",
};

setMessages((current) => {
  const exists = current.some((message) => message.clientRequestId === clientRequestId);
  return exists
    ? current.map((message) => message.clientRequestId === clientRequestId ? optimistic : message)
    : [...current, optimistic];
});

if (result.status !== "sent" || !result.message) {
  setNotice(result.notice ?? "That did not send yet. Keep this open and try again.");
  setMessages((current) =>
    current.map((message) =>
      message.clientRequestId === clientRequestId ? { ...message, localStatus: "failed" } : message
    )
  );
  return;
}

setMessages((current) => mergeMessage(current, result.message, clientRequestId));
```

**Validation/calm notice pattern** (lines 595-612):
```typescript
if (trimmedDraft.length === 0) {
  setNotice("Add a message before sending.");
  return;
}

if (trimmedDraft.length > chatLimits.messageBodyMaxLength) {
  setNotice("This message is a little long. Try sending it in two parts.");
  return;
}
```

**Apply:** Composer hook should preserve cleared composer after failed send, failed bubble retry metadata, reply/edit targets, and one primary send action.

### `apps/web/app/(authenticated)/chat/store/chat-store.ts` and `chat-selectors.ts` (store, event-driven/transform)

**Analogs:** `apps/web/app/(authenticated)/chat/chat-client.tsx`, `apps/web/app/(authenticated)/chat/chat-state.ts`

**Current local store shape to migrate** (`chat-client.tsx` lines 140-168):
```typescript
const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
const [readStates, setReadStates] = useState<ClientChatReadState[]>(() => chat.readStates ?? []);
const [participantPresenceSessions, setParticipantPresenceSessions] = useState<ClientChatPresenceSession[]>(() => chat.participantPresence?.sessions ?? []);
const [draft, setDraft] = useState("");
const [search, setSearch] = useState("");
const [notice, setNotice] = useState<string | null>(null);
const [participantTyping, setParticipantTyping] = useState(false);
const [participantRecording, setParticipantRecording] = useState(false);
const [localRecording, setLocalRecording] = useState(false);
const [replyingToId, setReplyingToId] = useState<string | null>(null);
const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
```

**Selector inputs** (`chat-client.tsx` lines 170-201):
```typescript
const currentUserReadState = readStates.find((state) => state.userId === chat.currentUserId);
const participantReadState = readStates.find((state) => state.userId === chat.participant.id);
const unreadCount = countUnreadMessages(messages, chat.currentUserId, currentUserReadState);
const replyingTo = replyingToId
  ? messages.find((message) => message.id === replyingToId) ?? null
  : null;
const editingMessage = editingMessageId
  ? messages.find((message) => message.id === editingMessageId) ?? null
  : null;
```

**Apply:** Store state should be keyed by `conversationId`. Do not store auth truth, role permission truth, assignment decisions, Supabase clients, service-role data, or final persistence decisions.

### `apps/web/app/(authenticated)/chat/chat-client.tsx` (component, event-driven)

**Analog:** `apps/web/app/(authenticated)/chat/page.tsx`

**Server boundary pattern** (lines 16-43):
```typescript
export default async function ChatPage() {
  const data = await getChatPageData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (!data.chat) {
    return (
      <EmptyState
        title="No conversation yet"
        description="Your conversation will appear when your coach is ready."
      />
    );
  }

  return (
    <ChatClient
      chat={data.chat}
      sendMessageAction={sendMessageAction}
      markReadStateAction={markReadStateAction}
      refreshMessagesAction={refreshMessagesAction}
      refreshConversationAction={refreshConversationAction}
    />
  );
}
```

**Apply:** Keep the route server-owned for assigned conversation loading and actions. `ChatClient` should become mostly rendering plus focused hook/store calls, not a new data authority.

### `apps/web/app/(authenticated)/chat/actions.ts` (server action, request-response)

**Analog:** `apps/web/app/(authenticated)/chat/actions.ts`

**Validation imports and schemas** (lines 1-18):
```typescript
"use server";

import type { ClientChatMessage, ClientChatReadState } from "@/lib/services";
import { getPublicEnv } from "@/lib/services/env";
import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import { chatLimits } from "@fish/core/chat";
import { z } from "zod";

const sendMessageSchema = z.strictObject({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(chatLimits.messageBodyMaxLength),
  clientRequestId: z.string().trim().min(1).max(120),
  replyToMessageId: z.string().trim().min(1).nullable().optional(),
});
```

**Edge Function boundary** (lines 159-184):
```typescript
async function postEdgeFunction(
  functionName: "send-message" | "chat-command",
  accessToken: string,
  body: unknown
): Promise<Response> {
  const controller = new AbortController();
  const timeout = isLocalSupabaseUrl()
    ? setTimeout(() => controller.abort(), localEdgeTimeoutMs)
    : null;

  try {
    return await fetch(`${getPublicEnv().supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
```

**Send result pattern** (lines 561-581):
```typescript
if (!response.ok) {
  return {
    status: "notice",
    values: parsed.data,
    notice: payload?.error ?? sendNotice,
  };
}

return {
  status: "sent",
  values: parsed.data,
  message: toClientChatMessage(message),
};
```

**Apply:** Web hooks/store dispatch optimistic events, but server actions remain the write/read-state command boundary.

### `packages/core/src/chat-state/fixtures/*.json` and tests (test, event-driven)

**Analog:** `apps/web/app/(authenticated)/chat/chat-state.test.ts`

**Test factory pattern** (lines 10-28):
```typescript
const baseMessage = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  senderRole: "client" as const,
  createdAt: "2026-07-06T04:00:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  reactions: [],
};

function message(
  overrides: Partial<ClientChatMessage> & Pick<ClientChatMessage, "id" | "senderId" | "body">
): ClientChatMessage {
  return {
    ...baseMessage,
    clientRequestId: overrides.id,
    ...overrides,
  };
}
```

**Behavior assertions to preserve** (lines 31-62, 93-139):
```typescript
expect(merged.map((item) => item.id)).toEqual(["message-1", "message-2"]);
expect(merged[1].body).toBe("server copy");

expect(countUnreadMessages(messages, "me", readState)).toBe(2);

expect(toReplyPreview(messages[1], "me", "Coach Dana", "Alex")).toEqual({
  id: "m2",
  authorName: "Coach Dana",
  snippet: "Message deleted",
});
```

**Apply:** Convert these cases into portable fixture vectors containing `initialState`, `events`, and `expectedState`/`expectedSelectors`. Include hydration, optimistic send, confirmation, failure, duplicate `clientRequestId`, remote merge, read-state merge, unread count, deleted snippet, and reply preview.

### `apps/web/app/(authenticated)/chat/chat-client.test.tsx` (test, event-driven)

**Analog:** `apps/web/app/(authenticated)/chat/chat-client.test.tsx`

**Realtime mock pattern** (lines 6-48):
```typescript
const realtimeMock = vi.hoisted(() => {
  const messageHandlers: Array<(payload: { new: unknown }) => void> = [];
  const readHandlers: Array<(payload: { new: unknown }) => void> = [];
  const channel = { on: vi.fn(), send: vi.fn(), subscribe: vi.fn() };
  const client = { channel: vi.fn(), removeChannel: vi.fn(), from: vi.fn() };

  return { messageHandlers, readHandlers, channel, client };
});

vi.mock("@/lib/services/supabase/browser", () => ({
  createBrowserSupabaseClient: () => realtimeMock.client,
}));
```

**Regression expectations** (lines 204-308):
```typescript
expect(await screen.findByText("It felt steady.")).toBeInTheDocument();
await waitFor(() => expect(screen.getByLabelText("Sent")).toBeInTheDocument());
expect(screen.getByLabelText("Message")).toHaveValue("");

expect(await within(log).findByText("This should feel instant.")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();

expect(await screen.findByText("That did not send yet. Keep this open and try again.")).toBeInTheDocument();
expect(screen.getByText("Please keep this draft.")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
```

**Apply:** Keep these behavior tests green through hook and store refactors. Add focused tests around extracted hooks/store only after existing route tests pin behavior.

### `apps/web/e2e/chat-send.spec.ts` (test, request-response)

**Analog:** `apps/web/e2e/chat-send.spec.ts`

**Browser send smoke pattern** (lines 13-25):
```typescript
await page.goto("/chat");
await page.getByRole("textbox", { name: "Message", exact: true }).fill(body);
await page.getByRole("button", { name: "Send message" }).click();

const messageRow = page.locator("li", { hasText: body }).last();
await expect(messageRow).toBeVisible();
await expect(
  messageRow.getByRole("img", { name: /Sent|Delivered|Read/ })
).toBeVisible();
await expect(messageRow.getByText("Not sent yet")).toHaveCount(0);
```

**Apply:** This remains release-level proof that the state refactor did not break real browser send behavior.

### `docs/chat-state-protocol.md` and native notes (config, event-driven)

**Analog:** `apps/ios/FISH/Features/Chat/Models/ChatModels.swift`

**Native model style** (lines 3-23):
```swift
struct ChatParticipantView: Identifiable, Equatable {
    let id: String
    let name: String
    let role: String
}

enum MessageStatus: String, Equatable {
    case sending = "Sending"
    case sent = "Sent"
    case delivered = "Delivered"
    case read = "Read"
}
```

**Apply:** Protocol docs should describe event names, state shape, and fixture expectations in platform-neutral JSON. Native notes should map the contract to Android `ViewModel` + `StateFlow` and iOS observable model, without implementing production native chat.

## Shared Patterns

### Portable Dependency Boundary

**Source:** `packages/core/src/chat.ts`, `packages/core/package.json`
**Apply to:** all `packages/core/src/chat-state/*`

Only import sibling core files such as `./roles` or `../chat`. Add a dependency-boundary test or grep-style test that rejects `react`, `next`, `zustand`, `@supabase`, `@/`, `window`, `document`, Swift, and Kotlin imports in `packages/core/src/chat-state`.

### Server/Supabase Authority Boundary

**Source:** `apps/web/app/(authenticated)/chat/actions.ts`
**Apply to:** composer hook, read-state hook, store actions

Use server actions for `send-message`, `chat-command`, read state, edit, delete, reactions, and refresh. Zustand and hooks can cache and coordinate UI state but must not decide assignment, membership, authorization, or durable persistence.

### Calm Notice Handling

**Source:** `apps/web/app/(authenticated)/chat/actions.ts`, `apps/web/app/(authenticated)/chat/chat-client.tsx`
**Apply to:** composer hook and route component

Copy existing user-facing notices exactly unless product copy is deliberately reviewed:
```typescript
"That did not send yet. Keep this open and try again."
"This message is a little long. Try sending it in two parts."
"Add a message before sending."
```

### Realtime Cleanup

**Source:** `apps/web/app/(authenticated)/chat/realtime.ts`
**Apply to:** `use-chat-realtime.ts`, `use-chat-presence.ts`

Every subscription returns cleanup that removes the Supabase channel or stops the presence session. Hook effects should return those cleanup functions directly.

### Existing Behavior Contract

**Source:** `apps/web/app/(authenticated)/chat/chat-client.test.tsx`, `apps/web/e2e/chat-send.spec.ts`
**Apply to:** all web refactors

Preserve one assigned conversation, no inbox/conversation picker, no new primary action, optimistic sends while pending, failed-send retry, cleared composer behavior, reply IDs, edit/delete/reaction command behavior, read-state badge behavior, and typing/recording indicators.

## No Analog Found

No files are fully without analogs. The weakest analog is `docs/chat-state-protocol.md`: use existing native preview models for naming style, but the actual protocol structure should come from phase decisions and JSON fixtures.

## Metadata

**Analog search scope:** `packages/core/src`, `apps/web/app/(authenticated)/chat`, `apps/web/e2e`, `apps/ios/FISH/Features/Chat`, `apps/android/app/src/main/java`, `.planning/REQUIREMENTS.md`
**Files scanned:** 24
**Pattern extraction date:** 2026-07-07
**Project guidance:** `AGENTS.md`; no repo-local `.codex/skills` or `.agents/skills` were present.
