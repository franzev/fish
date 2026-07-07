# Native Chat State Notes

These notes describe how Android and iOS should later implement the chat-state
contract from `packages/core/docs/chat-state-protocol.md`. They are architecture
guidance only. This phase does not modify Android or iOS production chat flows,
does not add native chat screens, and does not block web delivery on native
implementation.

Native clients receive the same `ChatEvent`, `ChatState`, fixture names, state
shape, and selector expectations. They should implement the reducer behavior
idiomatically in Kotlin or Swift and verify it against
`packages/core/src/chat-state/fixtures/chat-state-vectors.json`.

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
- `ChatConversationState`: messages, read states, composer state, and realtime
  connection status for one conversation.
- `ChatMessageState`: ids, sender identity, body, `clientRequestId`,
  timestamps, reply target, reactions, local send status, and failure reason.
- `ChatReadState`: delivered/read markers and timestamps for a user.
- `ChatComposerState`: draft, reply target, and edit target.
- `ChatEvent`: the event union applied to state.

The current event names are `hydrateConversation`, `draftChanged`,
`sendOptimisticMessage`, `confirmSentMessage`, `markMessageFailed`,
`mergeRemoteMessage`, `mergeReadState`, `setReplyTarget`, `setEditTarget`,
`setRealtimeStatus`, and `clearComposer`.

The current fixture cases are `hydrateConversation`, `sendOptimisticMessage`,
`confirmSentMessage`, `markMessageFailed`, `mergeRemoteMessage`,
`duplicateClientRequestIdReconciliation`, `mergeReadState`, `unreadCount`,
`deletedMessageSnippet`, and `replyPreview`.

## Android Mapping

Use a screen-scoped or conversation-scoped `ViewModel` as the state holder. The
`ViewModel` should expose immutable UI state through `StateFlow<ChatState>` or a
small wrapper such as `StateFlow<ChatUiState>`.

Recommended responsibilities:

- Load authorized conversation data from the native repository layer, then
  dispatch `hydrateConversation`.
- Expose `StateFlow` values for message rows, composer state, unread count,
  reply preview, outgoing status, and connection status.
- Apply `ChatEvent` values through a pure reducer function before updating the
  `MutableStateFlow`.
- Use repository/service calls for sends, read-state writes, refreshes, and
  realtime subscriptions; the `ViewModel` should not decide membership or
  persistence authority.
- Preserve `clientRequestId` reconciliation for optimistic sends, retries, and
  realtime confirmation.

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
  reply preview, outgoing status, and realtime status.
- Apply `ChatEvent` values through a pure reducer before publishing changes.
- Call service/repository functions for sends, read-state writes, refreshes,
  and realtime subscriptions.
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
- reply preview author label and snippet

These rules keep future native screens aligned with the current one assigned
conversation behavior without adding conversation pickers, menus, or new client
choices.

## Delivery Notes

Future native implementation can proceed after the web/core contract is stable.
It should start with native fixture replay tests, then add a `ViewModel` or
observable model behind the existing native design tokens and calm chat UI
patterns. Production Android/iOS chat screens, generated shared-code pipelines,
offline queues, notifications, attachments, and multi-conversation surfaces are
outside this phase.
