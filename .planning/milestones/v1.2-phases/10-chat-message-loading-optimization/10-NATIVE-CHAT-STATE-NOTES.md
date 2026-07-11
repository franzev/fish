# Native Chat State Notes (Phase 10 — Pagination History)

This file is a supplementary Phase 10 pagination delta and historical record. It captures why and
how keyset pagination extended the portable contract, but it is not an independently maintained
native contract and must not be treated as a second canonical source.

The canonical current documentation pair is:

- `packages/core/docs/chat-state-protocol.md` — the canonical human-readable platform-neutral
  protocol.
- `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md` — the canonical
  current Android/iOS architecture companion.

Future implementers should start with that pair. Any event, state, selector, or fixture change
updates the canonical pair together; this file remains supplementary history. The details below
record the Phase 10 pagination addition and retain its parity rationale.

These notes are architecture guidance only. Phase 10 did not modify Android or iOS production chat
flows, add native chat screens, or block web delivery on native implementation.

Native clients receive the same `ChatEvent`, `ChatState`, fixture names, state shape, and selector
expectations. They should implement the reducer behavior idiomatically in Kotlin or Swift and
verify it against `packages/core/src/chat-state/fixtures/chat-state-vectors.json`.

## Scope Boundary

No native production chat screen/source implementation is part of this phase. The existing Android
`AppShell.kt` and iOS `ChatPreviewScreen.swift` remain preview or shell context. They are not
upgraded into live chat flows here, and pagination/infinite-scroll UI is web-only this phase.

Native chat state must not import or depend on:

- Zustand
- React
- Next.js
- Supabase web clients
- TypeScript runtime code
- Web route modules from `apps/web`

Supabase RLS, Edge Functions, database functions, and server actions remain the authority for auth,
coach-client assignment, conversation membership, writes, persistence, and durable read state.
Native local state is a cache and UI state holder over authorized data — pagination cursors and
loading flags are cache/UI state, never an authorization decision.

## Shared Contract Inputs

Native implementations should mirror these protocol concepts:

- `ChatState`: conversations keyed by conversation id.
- `ChatConversationState`: messages, read states, composer state, realtime connection status, and
  (new this phase) pagination state for one conversation.
- `ChatMessageState`: ids, sender identity, body, `clientRequestId`, timestamps, reply target,
  reactions, local send status, and failure reason.
- `ChatReadState`: delivered/read markers and timestamps for a user.
- `ChatComposerState`: draft, reply target, and edit target.
- `ChatPaginationState` (new this phase): `oldestLoadedCursor` (a `{ createdAt, id }` keyset cursor,
  or absent before any window loads), `hasMoreOlder`, and `isLoadingOlder`. Every conversation gets
  a well-formed default with `oldestLoadedCursor` absent, `hasMoreOlder` false, `isLoadingOlder`
  false.
- `ChatEvent`: the event union applied to state.

The event names are `hydrateConversation`, `draftChanged`, `sendOptimisticMessage`,
`confirmSentMessage`, `markMessageFailed`, `mergeRemoteMessage`, `mergeReadState`, `setReplyTarget`,
`setEditTarget`, `setRealtimeStatus`, `clearComposer`, and, new this phase, `hydrateWindow`,
`olderMessagesRequested`, `olderPageLoaded`, and `olderPageLoadFailed`.

The fixture cases are `hydrateConversation`, `sendOptimisticMessage`, `confirmSentMessage`,
`markMessageFailed`, `mergeRemoteMessage`, `duplicateClientRequestIdReconciliation`,
`mergeReadState`, `unreadCount`, `deletedMessageSnippet`, `replyPreview`, and, new this phase,
`hydrateWindow`, `olderPageLoaded`, `olderPageDuplicateReconciliation`, `gapBackfillOutOfOrder`,
`olderPageLifecycle`, `deliveredMarkerOutsideWindow`, and `readMarkerOutsideWindow`.

## Android Mapping

Use a screen-scoped or conversation-scoped `ViewModel` as the state holder. The `ViewModel` should
expose immutable UI state through `StateFlow<ChatState>` or a small wrapper such as
`StateFlow<ChatUiState>`.

Recommended responsibilities:

- Load authorized conversation data from the native repository layer, then dispatch
  `hydrateWindow` for the initial bounded newest-message batch (not the full history).
- Dispatch `olderMessagesRequested` before an older-page repository call, then `olderPageLoaded` on
  success (with the new rows, `hasMoreOlder`, and the next `oldestCursor`) or
  `olderPageLoadFailed` on error — mirroring an `IntersectionObserver`-triggered "load earlier"
  affordance with a native scroll-position/sentinel equivalent.
- Expose `StateFlow` values for message rows, composer state, unread count, reply preview, outgoing
  status, connection status, and pagination (`hasMoreOlder`/`isLoadingOlder`, to drive a loading
  affordance and a "load earlier" control).
- Apply `ChatEvent` values through a pure reducer function before updating the `MutableStateFlow`.
- Use repository/service calls for sends, read-state writes, refreshes, older-page fetches, and
  realtime subscriptions; the `ViewModel` should not decide membership or persistence authority.
- Preserve `clientRequestId` reconciliation for optimistic sends, retries, and realtime
  confirmation — this must keep working unchanged with pagination active, including when an older
  page happens to overlap a still-pending optimistic send (same `clientRequestId`, different id).

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

Fixture verification should parse `chat-state-vectors.json`, replay each case from `initialState`,
dispatch the ordered `events`, and compare either `expectedState` or the expected selector result.

## iOS Mapping

Use SwiftUI observable model data as the state holder. The model may be scoped to the chat screen
or injected by the app shell later, but it should remain a thin native adapter over the shared
`ChatEvent`/`ChatState` contract.

Recommended responsibilities:

- Store `ChatState` in an `Observable` model.
- Provide derived properties for message rows, composer state, unread count, reply preview,
  outgoing status, realtime status, and pagination (`hasMoreOlder`/`isLoadingOlder`).
- Apply `ChatEvent` values through a pure reducer before publishing changes, including the four
  pagination events (`hydrateWindow`, `olderMessagesRequested`, `olderPageLoaded`,
  `olderPageLoadFailed`).
- Call service/repository functions for sends, read-state writes, refreshes, older-page fetches,
  and realtime subscriptions.
- Keep auth, membership, assignment, writes, persistence, and durable read-state authority outside
  the observable model.

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

Fixture verification should decode the JSON vectors, replay `events`, and compare `expectedState`
or `expectedSelectors`. The Swift model should use native enums and structs; it should not import
generated TypeScript or web state libraries.

## Selector Parity

Android and iOS should treat selectors as part of the protocol, not a web-only convenience. Native
implementations need parity for:

- message ordering by `createdAt` then `id`
- message merge by `id`, incoming `clientRequestId`, or explicit `localRequestId`
- read-state upsert by `userId`
- outgoing status derived from participant delivered/read markers
- unread count excluding the current user's own messages
- deleted-message snippet text
- reply preview author label and snippet
- **Pitfall #6 (new this phase):** a read or delivered marker id that is set but not present among
  the currently loaded (newest-anchored) messages must be treated as strictly older than
  everything loaded — it marks no loaded message as delivered/read. Evaluate the read and
  delivered markers independently: an out-of-window read marker must never suppress a delivered
  marker that IS among the loaded messages (native "outgoing status" derivation should resolve
  `delivered`, not silently fall back to `sent`, whenever the delivered marker is still resolvable
  even though the read marker isn't loaded yet). The unread count must fall back to counting every
  loaded other-participant message as unread when the read marker can't be located, rather than
  under-counting or throwing.

These rules keep future native screens aligned with the current one assigned conversation behavior
without adding conversation pickers, menus, or new client choices.

## Delivery Notes

Future native implementation can proceed after the web/core contract is stable. It should start
with native fixture replay tests, then add a `ViewModel` or observable model behind the existing
native design tokens and calm chat UI patterns. Production Android/iOS chat screens, generated
shared-code pipelines, offline queues, notifications, attachments, multi-conversation surfaces, and
native infinite-scroll/pagination UI are outside this phase — this phase is docs/fixtures only for
native, matching the CSTATE-05 discipline this file continues from Phase 9.
