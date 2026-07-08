# Chat State Protocol

This document is the platform-neutral contract for local chat state. The reducer
and selectors live in `packages/core/src/chat-state`; platform apps adapt the
same event/result rules through their own state containers.

The protocol is JSON-shaped and does not depend on React, Next.js, Zustand, or
Supabase clients, or browser APIs. Web Zustand is an adapter over this
contract, not the source of authorization, assignment, membership, writes,
persistence, or durable read state.

Supabase RLS, database functions, Edge Functions, and Next server actions remain
authoritative for auth, coach-client assignment, conversation membership, write
permission, message persistence, and durable read state.

## State Shape

`ChatState` is normalized by conversation id:

- `conversations`: record keyed by `ChatConversationId`.
- `ChatConversationState.conversationId`: stable conversation id.
- `ChatConversationState.messages`: sorted `ChatMessageState[]`.
- `ChatConversationState.readStates`: `ChatReadState[]`, one entry per user.
- `ChatConversationState.composer`: local draft, reply target, and edit target.
- `ChatConversationState.realtime.status`: `"idle"`, `"connecting"`,
  `"connected"`, or `"disconnected"`.

`ChatMessageState` carries the message id, conversation id, sender id and role,
body, `clientRequestId`, timestamps, reply target, reactions, local status, and
optional failure reason. `localStatus` is local UI state only:
`"pending"`, `"sending"`, `"sent"`, or `"failed"`.

`ChatReadState` carries the user id, delivered marker, delivered timestamp, read
marker, and read timestamp. Durable read-state writes still happen through the
server boundary.

## Events

Every adapter must be able to apply the current `ChatEvent` names:

| Event | Required behavior |
|-------|-------------------|
| `hydrateConversation` | Replace a conversation's message/read snapshot, normalize messages to `sent`, sort by `createdAt` then `id`, and create default composer/realtime state when absent. |
| `draftChanged` | Update only the local composer draft for the conversation. |
| `sendOptimisticMessage` | Merge a local outgoing message, normalize missing nullable fields, and mark it `sending`. Repeated `clientRequestId` values reconcile to one message. |
| `confirmSentMessage` | Merge the server-confirmed message, reconcile by `id`, incoming `clientRequestId`, or `localRequestId`, strip failure metadata, and mark it `sent`. |
| `markMessageFailed` | Mark the matching `clientRequestId` as `failed`, keep the failed body visible, set the optional failure reason, and restore that body to the composer draft. |
| `mergeRemoteMessage` | Merge a message received from refresh or realtime, reconcile by id/request id, strip failure metadata, and mark it `sent`. |
| `mergeReadState` | Upsert a user's read-state row by `userId`. |
| `setReplyTarget` | Set or clear the local reply target id. |
| `setEditTarget` | Set or clear the local edit target id. |
| `setRealtimeStatus` | Set the local realtime connection status for the conversation. |
| `clearComposer` | Reset the local draft, reply target, and edit target to empty values. |

`ChatResult` is the portable reducer result envelope: it contains the next
`state` and the `event` that produced it. Adapters may expose richer platform
results, but parity tests should compare the reducer state and selector outputs
defined here.

## Selectors

Adapters must preserve these selector expectations:

- `compareChatMessages` orders by parsed `createdAt`, then by `id`.
- `mergeChatMessage` reconciles messages by `id`, incoming
  `clientRequestId`, or explicit `localRequestId`.
- `mergeReadState` upserts read state by `userId`.
- `getOutgoingMessageStatus` returns `read` when the participant read marker is
  at or after the message, `delivered` when the delivered marker is at or after
  it, otherwise `sent`.
- `countUnreadMessages` counts messages after the current user's last read
  marker, excluding messages sent by the current user.
- `getMessageSnippet` returns `Message deleted` for deleted messages, trims body
  text, and truncates long snippets to the shared 96-character rule.
- `toReplyPreview` returns the message id, the current-user or participant
  author label, and the snippet.

## Fixture Contract

Cross-platform parity fixtures live at
`packages/core/src/chat-state/fixtures/chat-state-vectors.json`.

Each fixture case uses plain JSON:

- `name`: stable fixture case name.
- `initialState`: starting `ChatState`.
- `events`: ordered `ChatEvent[]` to replay.
- `expectedState`: expected reducer output for state-transition cases.
- `expectedSelectors`: expected selector output for selector-only cases.

Fixtures include expected output, not only input events. A platform adapter is
compatible only when it replays each fixture from `initialState`, applies every
event in order, and matches either `expectedState` or the named
`expectedSelectors` value.

The current fixture case names are:

- `hydrateConversation`
- `sendOptimisticMessage`
- `confirmSentMessage`
- `markMessageFailed`
- `mergeRemoteMessage`
- `duplicateClientRequestIdReconciliation`
- `mergeReadState`
- `unreadCount`
- `deletedMessageSnippet`
- `replyPreview`

These fixtures prove parity for hydrate/send/confirm/fail/merge/read behavior,
unread derivation, deleted-message snippets, and reply previews. They use
synthetic ids and copy only; credentials, JWTs, service-role keys, and seeded
account passwords do not belong in fixture data.

## Adapter Rules

Web may keep a Zustand store as a React coordination/cache adapter keyed by
`conversationId`. The store may dispatch these events and expose narrow
selectors, but it must not store auth truth, role permission truth, assignment
decisions, direct Supabase clients, service-role data, or final persistence
decisions.
