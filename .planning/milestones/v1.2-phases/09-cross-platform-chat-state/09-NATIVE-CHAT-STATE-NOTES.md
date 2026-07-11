# Native Chat State Notes

These notes are the canonical current Android/iOS architecture companion for
the chat-state contract in `packages/core/docs/chat-state-protocol.md`. They are
architecture guidance only. This phase does not modify Android or iOS
production chat flows, does not add native chat screens, and does not block web
delivery on native implementation.

Native clients receive the same `ChatEvent`, `ChatState`, fixture names, state
shape, and selector expectations. They should implement the reducer behavior
idiomatically in Kotlin or Swift and verify it against
`packages/core/src/chat-state/fixtures/chat-state-vectors.json`.

## Contract Ownership

The TypeScript types, reducer, and selectors in
`packages/core/src/chat-state`, together with the JSON vectors, are the
executable parity contract. `packages/core/docs/chat-state-protocol.md` is the
canonical human-readable platform-neutral explanation, and this file is the
canonical current native mapping. Any event, state, selector, or fixture change
must update both documents together.

## Scope Boundary

No native production chat screen/source implementation is part of this phase.
The existing Android `AppShell.kt` and iOS `ChatPreviewScreen.swift` remain
preview or shell context. They are not upgraded into live chat flows here.

Native chat state must not import or depend on:

- Zustand
- React
- Next.js
- Supabase web clients
- TypeScript runtime code
- Web route modules from `apps/web`

Supabase RLS, Edge Functions, database functions, and server actions remain the
authority for auth, coach-client assignment, conversation membership, writes,
persistence, and durable read state. Native local state is a cache and UI state
holder over authorized data.

## Shared Contract Inputs

Native implementations should mirror these protocol concepts:

- `ChatState`: conversations keyed by conversation id.
- `ChatConversationState`: messages, read states, composer state, realtime
  connection status, and pagination state for one conversation.
- `ChatMessageState`: ids, sender identity, body, `clientRequestId`,
  timestamps, reply target, reactions, local send status, and failure reason.
- `ChatReadState`: delivered/read markers and timestamps for a user.
- `ChatComposerState`: draft, reply target, and edit target.
- `ChatPaginationState`: `oldestLoadedCursor` (the oldest loaded message's
  `{ createdAt, id }` keyset cursor, or `null` before a window is loaded),
  `hasMoreOlder`, `isLoadingOlder`, and `hasLoadError` (whether the most
  recent older-page request failed; a new request clears it atomically).
  Every conversation starts with a well-formed default: no cursor, no known
  older page, no load in progress, and no load error.
- `ChatEvent`: the event union applied to state.

The current event names are `hydrateConversation`, `draftChanged`,
`sendOptimisticMessage`, `confirmSentMessage`, `markMessageFailed`,
`mergeRemoteMessage`, `mergeReadState`, `setReplyTarget`, `setEditTarget`,
`setRealtimeStatus`, `clearComposer`, `hydrateWindow`,
`olderMessagesRequested`, `olderPageLoaded`, and `olderPageLoadFailed`.

The current fixture cases are `hydrateConversation`, `sendOptimisticMessage`,
`confirmSentMessage`, `markMessageFailed`, `markMessageFailedPreservesNewerDraft`,
`mergeRemoteMessage`, `duplicateClientRequestIdReconciliation`, `mergeReadState`, `unreadCount`,
`deletedMessageSnippet`, `replyPreview`, `hydrateWindow`, `olderPageLoaded`,
`olderPageDuplicateReconciliation`, `gapBackfillOutOfOrder`,
`olderPageLifecycle`, `deliveredMarkerOutsideWindow`,
`readMarkerOutsideWindow`, `hydratePreservesUnresolvedSend`,
`hydrateWindowPreservesUnresolvedSend`, `monotonicSentIgnoresLateFailure`,
`snippetLongAscii`, `snippetEmojiBoundary`, and `olderPageRetryClearsError`.

Three contract clauses were hardened after the initial 18-fixture set and
must be mirrored exactly by native implementations:

1. **Hydrate/reconnect preserves unresolved local sends.** `hydrateConversation`
   and `hydrateWindow` replace the message snapshot with the incoming
   authoritative data, but they must first preserve any existing message
   whose local status is `pending`, `sending`, or `failed` and that no
   incoming row reconciles (no incoming row shares its id or
   `clientRequestId`). Preserved rows are folded into the incoming snapshot
   through the same merge-by-id/clientRequestId rule used elsewhere, so a
   matching incoming row always supersedes the local placeholder instead of
   duplicating it. Dropping an unresolved row on hydrate would delete the
   only copy of its body, leaving a later failure with nothing to restore
   into the composer draft.
2. **Send status is monotonic.** `markMessageFailed` must ignore a late
   failure for a `clientRequestId` whose row is already `sent` (confirmed by
   the authoritative send response, a realtime confirmation, or a later
   hydrate reconciliation): no status change, no failure reason, no draft
   restore. Only `pending`/`sending`/`failed` rows may transition to
   `failed`, and the empty-draft-only body-restore rule still applies to
   those.
3. **Message snippets are measured in Unicode code points, never UTF-16 code
   units.** A trimmed body of 96 or fewer code points is returned unchanged.
   A longer body truncates to its first 95 code points followed by a
   single-character ellipsis (U+2026, "…"), never splitting a surrogate
   pair (most emoji are a two-unit surrogate pair in UTF-16 but one code
   point), so the final result is always at most 96 code points.

## Android Mapping

Use a screen-scoped or conversation-scoped `ViewModel` as the state holder. The
`ViewModel` should expose immutable UI state through `StateFlow<ChatState>` or a
small wrapper such as `StateFlow<ChatUiState>`.

Recommended responsibilities:

- Load the authorized bounded newest-message window from the native repository
  layer, then dispatch `hydrateWindow` with `hasMoreOlder` and the next
  `oldestCursor`. Keep `hydrateConversation` for full-snapshot compatibility
  where that existing event is explicitly required.
- Before an older-page request, dispatch `olderMessagesRequested` (it also
  atomically clears `hasLoadError`, so a retry starts from a clean
  pagination-feedback state); on success, dispatch `olderPageLoaded` with the
  rows, `hasMoreOlder`, and next `oldestCursor`; on failure, dispatch
  `olderPageLoadFailed`. The failure event atomically clears the loading flag
  and sets `hasLoadError` in the same state update — never as two separate
  emissions, or an auto-load trigger can observe the gap and fire a duplicate
  request — while preserving the cursor and retry path. The
  `olderPageRetryClearsError` fixture proves this failure-then-retry
  lifecycle.
- Expose `StateFlow` values for message rows, composer state, unread count,
  reply preview, outgoing status, connection status, and pagination loading
  state. Map `isLoadingOlder` to a quiet loading affordance, `hasLoadError`
  to a calm manual-retry affordance (never an automatic retry loop), and
  `hasMoreOlder` to whether a native load-earlier trigger is available.
- Apply `ChatEvent` values through a pure reducer function before updating the
  `MutableStateFlow`.
- Use repository/service calls for sends, read-state writes, refreshes,
  older-page fetches, and realtime subscriptions; the `ViewModel` should not
  decide membership or persistence authority.
- Preserve `clientRequestId` reconciliation for optimistic sends, retries, and
  realtime confirmation. `olderPageLoaded` must use the same merge rule so a
  page overlap or a page racing a live insert cannot create a duplicate.

Kotlin implementation sketch:

```kotlin
data class ChatUiState(
    val state: ChatState,
    val activeConversationId: String
)

class ChatViewModel(
    private val repository: ChatRepository
) : ViewModel() {
    private val mutableState = MutableStateFlow(ChatUiState(ChatState.empty(), ""))
    val uiState: StateFlow<ChatUiState> = mutableState

    fun dispatch(event: ChatEvent) {
        mutableState.update { current ->
            current.copy(state = reduceChatState(current.state, event))
        }
    }
}
```

Fixture verification should parse `chat-state-vectors.json`, replay each case
from `initialState`, dispatch the ordered `events`, and compare either
`expectedState` or the expected selector result.

## iOS Mapping

Use SwiftUI observable model data as the state holder. The model may be scoped
to the chat screen or injected by the app shell later, but it should remain a
thin native adapter over the shared `ChatEvent`/`ChatState` contract.

Recommended responsibilities:

- Store `ChatState` in an `Observable` model.
- Provide derived properties for message rows, composer state, unread count,
  reply preview, outgoing status, realtime status, and pagination
  (`hasMoreOlder`, `isLoadingOlder`, and `hasLoadError`).
- Apply `ChatEvent` values through a pure reducer before publishing changes,
  including `hydrateWindow`, `olderMessagesRequested`, `olderPageLoaded`, and
  `olderPageLoadFailed`.
- Dispatch `olderMessagesRequested` before the service call, then
  `olderPageLoaded` or `olderPageLoadFailed` from its result. Keep cursor,
  loading, `hasLoadError`, and retry behavior identical to the portable
  contract: failure sets `hasLoadError` atomically with clearing the loading
  flag, and the next request clears it.
- Call service/repository functions for sends, read-state writes, refreshes,
  older-page fetches, and realtime subscriptions.
- Keep auth, membership, assignment, writes, persistence, and durable read-state
  authority outside the observable model.

Swift implementation sketch:

```swift
@Observable
final class ChatModel {
    private(set) var state: ChatState

    init(state: ChatState = .empty) {
        self.state = state
    }

    func dispatch(_ event: ChatEvent) {
        state = reduceChatState(state, event)
    }
}
```

Fixture verification should decode the JSON vectors, replay `events`, and
compare `expectedState` or `expectedSelectors`. The Swift model should use
native enums and structs; it should not import generated TypeScript or web
state libraries.

## Selector Parity

Android and iOS should treat selectors as part of the protocol, not a web-only
convenience. Native implementations need parity for:

- message ordering by `createdAt` then `id`
- message merge by `id`, incoming `clientRequestId`, or explicit
  `localRequestId`
- read-state upsert by `userId`
- outgoing status derived from participant delivered/read markers
- unread count excluding the current user's own messages
- deleted-message snippet text
- message snippet truncation measured in Unicode code points, never UTF-16
  code units: a body of 96 or fewer code points is unchanged; a longer body
  truncates to its first 95 code points plus a single-character ellipsis
  (U+2026), never splitting a surrogate pair, for a final result of at most
  96 code points
- reply preview author label and snippet
- a read or delivered marker id that is set but absent from the currently
  loaded newest-anchored window is strictly older than that window and marks no
  loaded message. Evaluate read and delivered markers independently: an
  out-of-window read marker must not suppress a still-in-window delivered
  marker. Until the real read marker is loaded, unread count conservatively
  includes every loaded message from the other participant.

These rules keep future native screens aligned with the current one assigned
conversation behavior without adding conversation pickers, menus, or new client
choices.

## Delivery Notes

Future native implementation can proceed after the web/core contract is stable.
It should start with native fixture replay tests, then add a `ViewModel` or
observable model behind the existing native design tokens and calm chat UI
patterns. Production Android/iOS chat screens, generated shared-code pipelines,
generated TypeScript consumption, native pagination UI, offline queues,
notifications, attachments, and multi-conversation surfaces are outside this
phase.
