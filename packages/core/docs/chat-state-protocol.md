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

## Contract Ownership

The TypeScript types, reducer, and selectors in
`packages/core/src/chat-state`, together with
`packages/core/src/chat-state/fixtures/chat-state-vectors.json`, are the
executable parity contract. This file is the canonical human-readable,
platform-neutral explanation of that contract.

`packages/core/docs/native-chat-state-notes.md` is the canonical current
Android/iOS architecture companion. Any change to the
portable event union, state shape, selector behavior, or fixture cases must
update this protocol and that native companion together. Native
implementations replay the JSON vectors idiomatically; they do not consume
generated TypeScript or import web state libraries.

## State Shape

`ChatState` is normalized by conversation id:

- `conversations`: record keyed by `ChatConversationId`.
- `ChatConversationState.conversationId`: stable conversation id.
- `ChatConversationState.messages`: sorted `ChatMessageState[]`.
- `ChatConversationState.readStates`: `ChatReadState[]`, one entry per user.
- `ChatConversationState.composer`: local draft, reply target, and edit target.
- `ChatConversationState.realtime.status`: `"idle"`, `"connecting"`,
  `"connected"`, or `"disconnected"`.
- `ChatConversationState.pagination`: `oldestLoadedCursor` (the oldest loaded
  message's `{ createdAt, id }` keyset cursor, or `null` before any window is
  loaded), `hasMoreOlder`, `isLoadingOlder`, and `hasLoadError` (whether the
  most recent older-page request failed; cleared atomically when a new request
  starts). Every conversation gets a well-formed default
  (`{ oldestLoadedCursor: null, hasMoreOlder: false, isLoadingOlder: false,
  hasLoadError: false }`).

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
| `hydrateConversation` | Replace a conversation's message/read snapshot with the incoming authoritative data, normalize incoming messages to `sent`, and sort by `createdAt` then `id` — but preserve any existing message whose `localStatus` is `pending`, `sending`, or `failed` and that no incoming row reconciles (no incoming row shares its `id` or `clientRequestId`). Preserved rows are folded in through `mergeChatMessage`, so a matching incoming row always supersedes the local placeholder instead of duplicating it. Create default composer/realtime state when absent. |
| `draftChanged` | Update only the local composer draft for the conversation. |
| `sendOptimisticMessage` | Merge a local outgoing message, normalize missing nullable fields, and mark it `sending`. Repeated `clientRequestId` values reconcile to one message. |
| `confirmSentMessage` | Merge the server-confirmed message, reconcile by `id`, incoming `clientRequestId`, or `localRequestId`, strip failure metadata, and mark it `sent`. |
| `markMessageFailed` | Mark the matching `clientRequestId` as `failed`, keep the failed body visible, and set the optional failure reason — but only when the matched row's `localStatus` is not already `sent`. A message already confirmed `sent` (by the authoritative send response, a realtime confirmation, or a later hydrate reconciliation) is monotonic: a late failure for that `clientRequestId` is ignored entirely — no status change, no failure reason, no draft restore. For `pending`/`sending`/`failed` rows, restore the failed body to the composer draft only when the draft is currently empty; a non-empty draft is a newer edit typed while the send was pending and is preserved untouched, never overwritten by the failed body. |
| `mergeRemoteMessage` | Merge a message received from refresh or realtime, reconcile by id/request id, strip failure metadata, and mark it `sent`. |
| `mergeReadState` | Upsert a user's read-state row by `userId`. |
| `setReplyTarget` | Set or clear the local reply target id. |
| `setEditTarget` | Set or clear the local edit target id. |
| `setRealtimeStatus` | Set the local realtime connection status for the conversation. |
| `clearComposer` | Reset the local draft, reply target, and edit target to empty values. |
| `hydrateWindow` | Replace a conversation's message/read snapshot exactly like `hydrateConversation`, including the same unresolved-local-send preservation rule (normalize incoming to `sent`, sort by `createdAt` then `id`, keep unreconciled `pending`/`sending`/`failed` rows), and additionally set `pagination` to the provided `hasMoreOlder`/`oldestCursor` with `isLoadingOlder` reset to `false`. |
| `olderMessagesRequested` | Set `pagination.isLoadingOlder` to `true` and atomically clear `hasLoadError`, so a retry always starts from a clean pagination-feedback state. A request dispatched while `isLoadingOlder` is already `true` is ignored. Nothing else changes. |
| `olderPageLoaded` | Merge each message in an older page through the same `mergeChatMessage` primitive used by every other message-touching event (dedup by `id`/`clientRequestId`, re-sort), then set `pagination.oldestLoadedCursor`/`hasMoreOlder` from the event and reset `isLoadingOlder` and `hasLoadError` to `false`. Re-delivering a message that is already loaded (page overlap, or a page racing a live insert) produces no duplicate. |
| `olderPageLoadFailed` | Atomically — in the same state update — reset `pagination.isLoadingOlder` to `false` and set `hasLoadError` to `true`. No intermediate state may exist where loading has stopped but the failure has not landed, or an auto-load trigger can observe the gap and fire a second automatic request. Ignored when no older-page load is in flight. `hasMoreOlder` and `oldestLoadedCursor` are left untouched so a retry (dispatching `olderMessagesRequested` again) is still possible. |

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
- A read or delivered marker id that is set but absent from the currently
  loaded (newest-anchored) window is treated as strictly older than the
  window — it marks no loaded message as delivered/read. The read and
  delivered markers are evaluated independently, so an out-of-window read
  marker never suppresses a still-in-window delivered marker, and
  `countUnreadMessages` falls back to counting every loaded
  other-participant message as unread until pagination loads back far
  enough to locate the real read marker.
- `getMessageSnippet` returns `Message deleted` for deleted messages, trims body
  text, and measures length in Unicode code points, never UTF-16 code units.
  A trimmed body of 96 or fewer code points is returned unchanged. A longer
  body truncates to its first 95 code points followed by a single-character
  ellipsis (U+2026, `…`), never splitting a surrogate pair, so the final
  result is always at most 96 code points.
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
- `markMessageFailedPreservesNewerDraft`
- `mergeRemoteMessage`
- `duplicateClientRequestIdReconciliation`
- `mergeReadState`
- `unreadCount`
- `deletedMessageSnippet`
- `replyPreview`
- `hydrateWindow`
- `olderPageLoaded`
- `olderPageDuplicateReconciliation`
- `gapBackfillOutOfOrder`
- `olderPageLifecycle`
- `deliveredMarkerOutsideWindow`
- `readMarkerOutsideWindow`
- `hydratePreservesUnresolvedSend`
- `hydrateWindowPreservesUnresolvedSend`
- `monotonicSentIgnoresLateFailure`
- `snippetLongAscii`
- `snippetEmojiBoundary`
- `olderPageRetryClearsError`

These fixtures prove parity for hydrate/send/confirm/fail/merge/read behavior,
unread derivation, deleted-message snippets, reply previews, keyset
pagination (initial window, older-page load, page/live-insert duplicate
reconciliation, request/failure/retry lifecycle including the atomic
`hasLoadError` set-on-failure and clear-on-retry rule), out-of-order/duplicate reconnect
backfill, the out-of-window read/delivered marker rule, hydrate/reconnect
preservation of unresolved local sends, monotonic send-status transitions,
and code-point-safe (surrogate-pair-safe) message snippet truncation. They
use synthetic ids and copy only; credentials, JWTs, service-role keys, and
seeded account passwords do not belong in fixture data.

## Adapter Rules

Web may keep a Zustand store as a React coordination/cache adapter keyed by
`conversationId`. The store may dispatch these events and expose narrow
selectors, but it must not store auth truth, role permission truth, assignment
decisions, direct Supabase clients, service-role data, or final persistence
decisions.
