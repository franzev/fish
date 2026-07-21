# iOS message search implementation plan

**Status:** Proposed

**Sequence:** Implement after the Android message-search plan is complete and its shared behavior is validated

**Scope:** Search within the currently open authorized direct conversation, then dismiss search and focus the selected transcript message

## Goal

Add a calm native iOS message-search flow with the same user-visible capability as Android:

- one search entry in an open direct conversation;
- text search over non-deleted message bodies;
- newest-first, cursor-paginated results;
- sender, date/time, and a short plain-text excerpt per result;
- selection returns to the canonical transcript, fetches the current message when needed, scrolls to it, and applies a focused treatment;
- complete initial, loading, results, empty, failure, loading-more, offline, and dismissal behavior.

The implementation should follow the existing Swift package boundaries and SwiftUI patterns. It must not copy Android class structure mechanically, create a new package target, or widen native mobile beyond direct conversation support.

## Why Android comes first

Both apps use the same database RPC and should present the same small feature. Android already has a working focus-by-message-ID route used by notifications and reply previews, so it is the lower-risk place to validate the product flow, result copy, page size, backend cursor behavior, and physical-device usability.

After Android validation, iOS should adopt the proven visible contract. iOS still requires its own focused-message state and fetch-by-ID behavior because `PersonalChatTranscript` currently scrolls only to reply targets already present in the active message window.

Android completion is not a dependency for compiling the iOS work, but it is a sequencing dependency for product validation. If Android testing changes user-visible copy, page size, or selection behavior, update this plan before implementing iOS so the two apps do not drift.

## Existing behavior to reuse

- `ChatMessagingProviding` is the provider-neutral read/send boundary consumed by `ConversationStore`.
- `RestChatMessaging` already owns authenticated RLS-protected REST reads, base message decoding, composite cursors, bounded page sizes, cancellation, and `messages(ids:)` authoritative fetches.
- `ConversationStore` already owns one live conversation, reducer state, message merging, paging, read acknowledgement, and presentation mapping.
- `ChatStateReducer` already supports merging a remotely fetched message; search does not need a parallel message store.
- `PersonalChatTranscript` already uses `ScrollViewReader`, stable message IDs, and lazy rows.
- `PersonalChatScreen` already provides a trailing top-bar slot and uses sheets for focused secondary chat tasks.
- `GifSearchModel` provides the established observable-state pattern for a 300 ms cancellable query, generation guards, cursor paging, deduplication, retry, and deterministic tests.
- `Icon.search`, `IconButton`, `TopBar`, `InputField`, `EmptyState`, `Notice`, `Skeleton`, `ActionButton`, semantic palette values, type styles, and spacing tokens already exist.

## Locked cross-platform behavior

1. Search is scoped to the currently open authorized conversation.
2. A quiet `Search messages` icon in the conversation top bar is the only entry.
3. iOS presents search as a large sheet containing a focused search screen. The underlying conversation remains the canonical destination.
4. The search field receives focus when the sheet opens.
5. A trimmed non-empty query runs after a 300 ms pause. The keyboard Search action runs immediately.
6. Empty/whitespace input never calls the backend and never returns the whole conversation.
7. Results are newest first and load the next keyset page through one secondary `Show more results` action.
8. Results show sender, localized date/time, and a plain three-line excerpt. No media hydration, Markdown rendering, or match highlighting.
9. Selecting a result dismisses search and focuses that message in the transcript. It does not open a separate message-detail view.
10. Search state is session-only and cleared on dismissal, conversation close, conversation switch, and sign-out.
11. Search does not mark result rows read. The existing transcript visibility callback remains responsible after a focused row appears.
12. Search terms, result bodies, IDs, and counts are not persisted or logged.
13. Android and iOS use the same page size, copy, backend parameters, empty behavior, failure behavior, and deferrals unless a documented platform accessibility need requires a difference.

## User flow and state contract

1. The user opens a direct conversation.
2. They activate the quiet top-bar action labeled `Search messages`.
3. A large sheet opens to a screen titled `Search messages`; the field is focused and the keyboard is visible.
4. Before input, the screen says `Search this conversation.`
5. Typing schedules the query after 300 ms. A newer query cancels and supersedes the older request.
6. The results region shows stable loading content, matches, `No messages match this search.`, or the calm failure notice `Search is taking a little longer. Check your connection and try again.`
7. If another cursor exists, a secondary `Show more results` action appears. It keeps existing results visible while busy.
8. Selecting a result dismisses the sheet and asks `ConversationStore` to focus the message ID.
9. If the row is not in reducer state, the store calls the existing `messages(ids:)` provider method, verifies the returned conversation ID, merges the current row, and then publishes focus.
10. `PersonalChatTranscript` scrolls the focused ID to the center and renders a quiet `Palette.chatActive` focus container. Normal row behavior and accessibility remain available.
11. If the row is deleted or inaccessible by selection time, the sheet dismisses and the conversation shows `Earlier message unavailable` in the existing calm notice area.
12. Swipe dismissal or Close clears the query/results and returns to the unchanged conversation and composer draft.

### Search state

Use a small `@MainActor @Observable` model, shaped approximately as:

```swift
@MainActor @Observable
public final class MessageSearchModel {
    public enum Status: Equatable, Sendable {
        case initial
        case loading
        case ready
        case empty
        case notice
    }

    public private(set) var status: Status = .initial
    public private(set) var results: [MessageSearchResultUiModel] = []
    public private(set) var isLoadingMore = false
    public private(set) var isPresented = false
    public private(set) var notice: String?
    public var query = ""
}
```

Keep the next cursor, generation, scheduled task, provider, and identity mapping private. A value projection such as `MessageSearchScreenState` is useful only if it keeps screenshot views deterministic, following `GifPanelState`; do not add it if the observable model can already be passed cleanly to tests.

### Result presentation

Each row needs only:

- stable message ID;
- `You` or the known participant name;
- a localized date/time label using existing `ChatDayLabel` and Foundation format styles;
- whitespace-normalized message body limited to three visual lines;
- one combined VoiceOver label containing sender, excerpt, and date/time.

The result does not render reactions, delivery status, reply preview, sticker/GIF media, attachments, or Markdown. Those belong to the transcript after selection.

## Backend contract

Use the existing `public.search_chat_messages` RPC from `supabase/migrations/0019_chat_search_filters.sql`. `RestChatMessaging` should POST to `rest/v1/rpc/search_chat_messages` through its existing authenticated request helper with only:

```text
p_conversation_id     active authorized conversation ID
p_query               trimmed text
p_before_created_at   cursor timestamp, omitted on the first page
p_before_id           cursor message ID, omitted on the first page
p_limit               26 for a 25-result page plus one has-more probe
p_sort_direction      "desc"
```

All unused filter arguments keep their database defaults. Do not call `count_chat_messages`; native needs only whether another cursor exists.

Decode the RPC rows with the existing `ChatMessageWire`/`ChatWireDecoder`, but map only base values into lightweight search hits. Do not call `RestChatMessaging.enrich`, attachment hydration, GIF reads, or reaction summaries for the search list.

Take the first 25 rows. If row 26 exists, set the next cursor to `(created_at, id)` from the last retained row. The database already excludes deleted rows and enforces conversation membership; the client still verifies conversation identity before focus/merge as a correctness safeguard.

## Lean architecture

```text
Conversation top-bar search action
  -> ConversationStore.messageSearch.open()
      -> MessageSearchModel (PersonalChat, observable session state)
          -> ChatMessagingProviding.searchMessages(...)
              -> RestChatMessaging
                  -> search_chat_messages RPC under RLS

Result selected
  -> dismiss/clear MessageSearchModel
  -> ConversationStore.focusMessage(id)
      -> existing messages(ids:) when target is not loaded
      -> existing ChatStateReducer merge
      -> PersonalChatUiModel.focusedMessageId
      -> PersonalChatTranscript ScrollViewReader + quiet focus treatment
```

Extend the existing `ChatMessagingProviding` and `RestChatMessaging`; do not add `ChatSearchData`, another package product, a use-case layer, an app-level repository, local persistence, or a second Supabase client. Search is another authorized message read and fits the existing provider.

`MessageSearchModel` should be owned by `ConversationStore` because both have the same conversation/session lifetime. Keeping query/paging state in its own observable object avoids bloating the reducer with transient search UI while requiring no new dependency-injection system.

## Ordered incremental implementation steps

### Step 1 — Add the lightweight search models and provider method

**Goal:** Expose one cursor-paginated message-search read through the existing provider-neutral ChatData API.

**Why necessary:** PersonalChat must not know RPC names, request JSON keys, access tokens, or raw wire rows.

**Dependencies and assumptions:**

- Android has validated the 25-result page size, user-visible copy, and cursor behavior, or any resulting changes have been incorporated here.
- Migration `0019_chat_search_filters.sql` is deployed to the development and target Supabase projects.
- The existing `ChatCommandFailure`/network mapping is sufficient for a calm search failure; no search-specific error hierarchy is required.
- Search is body-only in this release.

**Focused implementation actions:**

- Add `ChatMessageSearchCursor(createdAt, id)`, `ChatMessageSearchHit(id, conversationId, senderId, body, createdAt)`, and `ChatMessageSearchPage(hits, nextCursor)` to ChatData, near existing paging models.
- Add `searchMessages(conversationId:query:before:limit:)` to `ChatMessagingProviding`.
- Implement it in `RestChatMessaging` using the existing authenticated POST helper and a private `Encodable` request with exact `p_*` coding keys.
- Trim/reject blank query input at the feature model and defensively reject it in the adapter rather than allowing the RPC to return every row.
- Clamp `limit` to `1...99` so the `limit + 1` probe stays under the RPC's 100-row cap, decode base message rows only, and derive the next cursor from the last retained hit.
- Keep cancellation behavior identical to other messaging reads.
- Update the single PersonalChat test fake and any Catalog fixture conformance. Do not add a default production implementation that silently returns no results.

**Likely files:**

- `apps/ios/FishKit/Sources/ChatData/Models/ChatPaging.swift` or a small same-domain `ChatMessageSearch.swift`
- `apps/ios/FishKit/Sources/ChatData/Providers/ChatMessagingProviding.swift`
- `apps/ios/FishKit/Sources/ChatData/Adapters/RestChatMessaging.swift`
- `apps/ios/FishKit/Tests/ChatDataTests/ChatLiveDataTests.swift`
- `apps/ios/FishKit/Tests/PersonalChatTests/ConversationStoreTests.swift` fake
- Catalog fake/store setup if its initializer requires the new method

**Verification:**

- URLProtocol tests assert RPC path, POST method, exact JSON keys, omitted first-page cursor, second-page cursor, `desc` direction, access headers, and 26-row probe.
- Tests cover trim/blank rejection, malformed/error responses, cancellation, exactly 25/26 rows, stable cursor, and no enrichment requests.
- Run `pnpm ios:test` and `pnpm ios:guard`.

**Working-state completion criteria:** A provider test can retrieve deterministic first and second lightweight pages; no production UI changes yet.

### Step 2 — Add the observable message-search model

**Goal:** Own presentation state, cancellation, debounce, pagination, retry, and identity/date mapping for one conversation.

**Why necessary:** SwiftUI views should render values and send intents, not coordinate stale async requests. Search state is transient UI state and does not belong in the shared chat reducer.

**Dependencies and assumptions:**

- Follow `GifSearchModel`'s generation/task pattern and injectable `Clock<Duration>` for deterministic tests.
- The model lifetime equals its `ConversationStore`; no process restoration or persistence is required.
- The current user/participant names available to `ConversationStore` are sufficient for direct-chat sender labels.

**Focused implementation actions:**

- Add `MessageSearchModel` under `PersonalChat/ViewModels`, injected with conversation ID, current user ID/name, participant name, `ChatMessagingProviding`, clock, now/calendar/locale seams where required for deterministic formatting, and a 300 ms default debounce.
- Implement `open()`, `close()`, `retry()`, `submitImmediately()`, and `loadMore()` plus query observation.
- `open()` starts in `.initial` with an empty query. `close()` cancels the task, increments generation, clears results/cursor/query, and sets `isPresented = false`.
- On query change, cancel the previous task, increment generation, clear stale results, and either return to `.initial` for trimmed blank text or schedule a first-page load.
- Publish only if the generation still matches. Treat `CancellationError` as cancellation, not `.notice`.
- Append and ID-deduplicate later pages; block concurrent pagination; preserve existing results on load-more failure and show a retryable calm state near the pagination action.
- Normalize result whitespace and produce sender/date/accessibility labels without parsing Markdown or highlighting.
- Let `ConversationStore` own `public let messageSearch`, initialized from its existing messaging provider and identity values; call `messageSearch.close()` from `stop()`.

**Likely files:**

- new `apps/ios/FishKit/Sources/PersonalChat/ViewModels/MessageSearchModel.swift`
- new or colocated `MessageSearchResultUiModel`
- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift`
- new `apps/ios/FishKit/Tests/PersonalChatTests/MessageSearchModelTests.swift`

**Verification:**

- Swift Testing cases cover initial/open/close, blank query, 300 ms debounce, immediate submit, stale-response suppression, cancellation, retry, append/deduplicate, final page, load-more failure, and store stop.
- Inject a test clock; do not use wall-clock sleeps.
- Run `pnpm ios:test`.

**Working-state completion criteria:** The model exposes every search state from a fake provider and is cleared with the conversation lifecycle, without a UI entry.

### Step 3 — Add reusable focus-by-message-ID behavior

**Goal:** Give iOS one canonical way to fetch, merge, scroll to, and visually focus a message that may be outside the current window.

**Why necessary:** Search results can point to old messages, while the current reply-preview scroll closure works only when the target is already rendered. Building focus now also removes the need for search-specific transcript mutation.

**Dependencies and assumptions:**

- `ChatMessagingProviding.messages(ids:)` remains the authoritative bounded fetch.
- `ChatStateReducer.mergeRemoteMessage` remains the canonical merge operation.
- Fetching the target alone is acceptable for the first release; guaranteed adjacent context is deferred.

**Focused implementation actions:**

- Add `focusedMessageId: String?` to `ConversationStore` presentation state and `PersonalChatUiModel`, defaulting to nil in fixtures/call sites.
- Add `ConversationStore.focusMessage(_ id: String) async`. If the message is absent, call `messaging.messages(ids: [id])`, require one row with the active conversation ID, and merge it through the reducer. Then publish the focus ID.
- Add `clearFocusedMessage()` and clear focus when search opens, the conversation stops, or another conversation replaces the store. This also lets selecting the same result on a later search create a new focus change.
- On missing/deleted/unauthorized response, keep transcript state intact and publish `Earlier message unavailable` through the current calm notice.
- Pass `focusedMessageId` into `PersonalChatTranscript`.
- In the existing `ScrollViewReader`, react to focus changes and scroll the matching stable row ID to center. Apply a token-based `Palette.chatActive` rounded focus container outside `MessageBubble`; do not modify incoming/outgoing bubble colors.
- Reuse this method for reply-preview taps where the preview has a target ID, replacing the current loaded-only closure when practical. Do not broaden notification payload work in this slice.
- Respect Reduce Motion: scrolling/focus should be immediate when reduced motion is active and may use the existing quiet transition otherwise.

**Likely files:**

- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift`
- `apps/ios/FishKit/Sources/PersonalChat/Models/PersonalChatUiModel.swift`
- `apps/ios/FishKit/Sources/PersonalChat/Views/PersonalChatTranscript.swift`
- `apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift`
- `apps/ios/FishKit/Sources/TestSupport/Fixtures/PersonalChatFixtures.swift`
- ConversationStore, transcript, and snapshot tests

**Verification:**

- Test focus for a loaded message, an ID fetched through `messages(ids:)`, a wrong-conversation row, an empty response, a deleted/inaccessible row, and the same target after clearing.
- Verify reducer order and paging state are not reset by merging one target.
- Snapshot focused message in light/dark, Accessibility XL, and RTL.
- Verify VoiceOver reaches the focused row and normal `onVisibleMessage` read acknowledgement still runs only through visibility.
- Run `pnpm ios:test` and `pnpm ios:guard`.

**Working-state completion criteria:** A host/test can request any authorized message ID and the canonical transcript fetches, scrolls, and focuses it without search UI.

### Step 4 — Build the accessible search sheet

**Goal:** Present the same focused query/results task validated on Android using native iOS controls and existing FISH components.

**Why necessary:** Users need a predictable way to enter a query, understand state, page, retry, dismiss, and select a result.

**Dependencies and assumptions:**

- `Icon.search` and `IconButton` already provide the semantic 44-point top-bar action.
- Reuse `TopBar`, `InputField`, `EmptyState`, `Notice`, `Skeleton`, and `ActionButton`.
- If `InputField` cannot support search keyboard submission and first-open focus, extend it with narrowly optional `submitLabel`, `onSubmit`, and initial-focus inputs. Do not build a separate unshared field style.

**Focused implementation actions:**

- Add public `MessageSearchScreen`, rendering `MessageSearchModel` state and intents.
- Use `TopBar(title: "Search messages", onBack: close)` or an equivalent sheet header with one quiet Close/Back action.
- Place `InputField(label: "Search messages", ...)` first, use `.submitLabel(.search)`, autofocus once on open, and route submit to the immediate search method.
- Render one scrollable result list. Each result is a full-width button with a minimum 44-point target, sender/date metadata, and a three-line excerpt. Use spacing and dividers, not decorative cards.
- Initial: `Search this conversation.`
- Loading: stable skeleton result rows or calm `Searching messages…` progress.
- Empty: `No messages match this search.`
- Failure: `Notice` plus one `Try again` action; preserve and refocus the field.
- Pagination: secondary `Show more results`; keep existing results during progress and expose an accessibility busy value.
- Add polite accessibility announcements for result completion, no result, and failure; avoid announcing every keystroke or skeleton row.
- Support swipe dismissal through `onDisappear`/presentation binding cleanup without double requests.
- Test light/dark, portrait/landscape, iPad sheet width, Accessibility XL, RTL, VoiceOver order, keyboard Search, and Reduce Motion.

**Likely files:**

- new `apps/ios/FishKit/Sources/PersonalChat/Screens/MessageSearchScreen.swift`
- optional small result-row view colocated under a same-purpose file/folder following current iOS conventions
- `apps/ios/FishKit/Sources/UIComponents/Fields/InputField.swift` only for confirmed search submission/autofocus needs
- new search screen and snapshot tests under `PersonalChatTests`

**Verification:**

- Snapshot initial, loading, results, empty, notice, loading-more, dark, Accessibility XL, RTL, and iPad width.
- View/accessibility tests verify 44-point controls, field label, keyboard Search, single retry action, result combined labels, and dismiss behavior.
- Run `pnpm ios:test`, `pnpm ios:guard`, and `pnpm ios:catalog` if Catalog examples are added.

**Working-state completion criteria:** The search sheet can render and drive all states against a fake provider without app-shell integration.

### Step 5 — Integrate search into the production conversation

**Goal:** Wire the top-bar entry, sheet lifecycle, result selection, and transcript focus through the real app composition.

**Why necessary:** This connects the independently working provider, state model, search view, and focus path while preserving one canonical conversation store.

**Dependencies and assumptions:**

- `ConversationStore` owns `messageSearch` and `focusedMessageId`.
- `PersonalChatScreen`'s existing `trailingContent` slot remains the supported host for a quiet conversation action.
- Search remains available while Realtime is reconnecting; an RPC failure handles true offline state rather than hiding the entry.

**Focused implementation actions:**

- In `ConversationView`, supply an `IconButton(.search, accessibilityLabel: "Search messages")` through the existing `trailingContent` slot. Its action clears prior focus and opens `store.messageSearch`.
- Present `MessageSearchScreen` from the observable `isPresented` binding with a large detent and visible drag indicator; keep sheet content within the shared maximum width on iPad.
- On selection, close/clear the search model and call `await store.focusMessage(id)`. Ensure dismissal and focus ordering is deterministic for repeated selections.
- Preserve draft, composer context, staged uploads, selected media, active voice state policy, Realtime subscription, and conversation paging while the sheet is open.
- In `stopConversation()`/sign-out, ensure the store closes search and cancels pending requests before references are released.
- Do not add an App Router-equivalent route, deep-link query format, notification payload change, or global inbox search.

**Likely files:**

- `apps/ios/App/Sources/FishApp.swift`
- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift`
- `apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift` only if its trailing/sheet seam needs a small adjustment
- app and PersonalChat integration tests

**Verification:**

- Select an already loaded result and an older result requiring `messages(ids:)`.
- Select a result edited/deleted after search response and verify authoritative reconciliation/unavailable copy.
- Verify draft, staged attachment, reply/edit context, and Realtime messages survive open/close/selection.
- Verify sheet swipe dismissal cancels requests and clears private state.
- Verify sign-out and conversation switch cannot publish a late result into a new session.
- Run `pnpm ios:test` and `pnpm ios:app:build`.

**Working-state completion criteria:** Production iOS can open search from direct chat, query and page real results, dismiss, and focus the authoritative transcript row with no unrelated state loss.

### Step 6 — Validate parity, deployed authorization, and physical-device behavior

**Goal:** Prove iOS matches the validated Android behavior and works against the deployed target environment.

**Why necessary:** Unit and snapshot tests cannot prove target RLS, real keyboard/sheet behavior, VoiceOver focus transfer, or acceptable physical-device latency.

**Dependencies and assumptions:**

- Use the same target-like two-account dataset and edge cases used for Android.
- Android's final visible copy/page behavior is recorded and available for comparison.
- No query/body content may enter telemetry or logs.

**Focused implementation actions:**

- Run the same Supabase authorization and pagination checks: authorized coach/client, unrelated account denial/empty visibility, deleted exclusion, partial/full-word match, punctuation, same-timestamp ordering, and cursor page boundaries.
- Compare Android and iOS for initial copy, loading/empty/failure copy, result fields/order, page size, load-more behavior, and target-unavailable behavior.
- On physical iPhone and iPad, test software/hardware keyboard Search, VoiceOver, Dynamic Type accessibility sizes, RTL, dark/light, Reduce Motion, sheet swipe, rotation/multitasking, network loss/retry, background/resume, and a result outside the initial message window.
- Measure only if realistic search is slow. Do not add caching, local indexing, prefetching, or analytics without observed evidence.
- Update `apps/ios/App/README.md` to include conversation search in the production chat host summary and target-environment validation notes.

**Verification:**

- `pnpm ios:tokens:check`
- `pnpm ios:chat-media:check`
- `pnpm ios:chat-vectors:check`
- `pnpm ios:guard`
- `pnpm ios:test`
- `pnpm ios:app:build`
- `pnpm build` before commit under repository policy
- manual two-account target-project and physical-device parity matrix

**Completion criteria:** iOS search is authorized, stable across pages, accessible, visually calm, behaviorally aligned with Android, able to focus an older authoritative message, free of private search logging, and green in package/app/repository verification.

## Test matrix

| Area | Required cases |
| --- | --- |
| Query | untouched, whitespace, one character, words, punctuation, mixed case, long query, rapid replacement |
| Results | one, many, repeated text, same timestamps, edited body, deleted exclusion, no match |
| Pagination | exactly 25, 26, multiple pages, last page, repeated Show more, stale later page |
| Focus | already loaded, fetched by ID, wrong conversation, unavailable after result, same result twice, very old message |
| Presentation | sheet open/close/swipe, keyboard focus, software/hardware Search, iPhone/iPad, rotation/multitasking |
| Lifecycle | background/resume, conversation switch, sign-out, late task completion, process restart defaults closed |
| Accessibility | VoiceOver order/focus, 44-point targets, Accessibility XL, RTL, dark/light contrast, Reduce Motion |
| Privacy/security | authorized member, unrelated account, deleted row, no query/body/ID persistence or logging |

## Assumptions and tradeoffs

- **Assumption:** Android validates the shared visible contract first; iOS follows it unless native accessibility behavior requires a documented deviation.
- **Assumption:** The deployed RPC signature and RLS match migration `0019`. Deployment drift is fixed at deployment, not hidden by a mobile-only endpoint.
- **Tradeoff:** Search extends `ChatMessagingProviding` instead of adding a new provider. It is an authorized message read and can reuse `RestChatMessaging` transport/decoding with less surface area.
- **Tradeoff:** Search is body-only. This solves the current retrieval need without building transcription, OCR, or metadata indexing.
- **Tradeoff:** No total count is fetched. The sheet only needs a next cursor.
- **Tradeoff:** Search results are lightweight and not enriched. Media and message actions appear after returning to the canonical transcript.
- **Tradeoff:** Search state is not restored after process termination. This avoids persisting private transient terms.
- **Tradeoff:** Focusing an unloaded result merges the target message only and does not guarantee surrounding rows. Add a bounded context-window contract only if pilot testing shows the isolated row is confusing.
- **Assumption:** A large sheet is the calmest familiar iOS presentation and keeps dismissal obvious. Revisit only if physical-device testing shows focus transfer or iPad presentation problems.
- **Assumption:** A 300 ms debounce remains appropriate after Android validation and matches the existing iOS GIF search pattern.

## Explicitly deferred until concrete need

- sender, role, date, content-type, mention, channel, and pinned filters;
- web query-language parity and saved/recent searches;
- global search across conversations;
- result totals and numbered pages;
- match highlighting and next/previous occurrence navigation;
- attachment filename/OCR, voice transcription, sticker phrase, GIF metadata, and link-preview search;
- offline/local full-text indexing, Core Data/SQLite search storage, or result caching;
- guaranteed surrounding context windows;
- notification message-ID deep links and new URL formats;
- search analytics containing terms, IDs, counts, or content;
- search suggestions, autocomplete, ranking, and typo correction;
- iPad persistent sidebars or multi-column search layouts;
- a new package target, Supabase client, Edge Function, or backend RPC while the existing message-search RPC satisfies the requirement.

## Definition of done

iOS message search is done when an authorized user can open search from a direct conversation, type a query, understand every state, page through stable newest-first results, select one, and return to the focused authoritative transcript message without losing draft/composer state or exposing search content—and its behavior matches the validated Android feature across accessibility, authorization, device, and build checks.
