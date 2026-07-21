# Android message search implementation plan

**Status:** Proposed

**Priority:** Implement before the iOS message-search plan

**Scope:** Search within the currently open authorized direct conversation, then return to and focus the selected message

## Goal

Add a calm native Android message-search flow that helps a client or coach recover an earlier phrase, correction, link, or piece of conversation context without leaving direct chat.

The first release is intentionally narrow:

- one search entry in the open conversation;
- text search over non-deleted message bodies;
- newest-first, cursor-paginated results;
- sender, date/time, and a short plain-text excerpt per result;
- selecting a result closes search, fetches the authoritative message when necessary, scrolls to it, and applies the existing focused-message treatment;
- complete initial, loading, results, empty, failure, loading-more, and offline behavior.

This plan does not add a global search destination, message filters, search history, local indexing, result counts, attachment-name search, or a new backend service.

## Why this is the next Android feature

Android already has the direct-chat foundations: authorized conversation routing, text and media messages, attachments, voice messages, replies, edits, reactions, typing, read state, push routing, presence, calls, account settings, Room caching, and a message-focus path. Search deepens the existing conversation instead of widening the mobile product surface.

The backend work is also already present. `supabase/migrations/0019_chat_search_filters.sql` provides `search_chat_messages`, body-search indexes, composite cursor ordering, deleted-message exclusion, and membership-protected reads. Android therefore needs a small provider-neutral data contract and native presentation, not a new database design.

## Existing behavior to reuse

- `ChatRepository` is the provider-neutral feature boundary. Keep Supabase types inside `data:chat`.
- `SupabaseChatRemoteDataSource` already owns authorized PostgREST/RPC reads.
- `ChatViewModel.focusCurrentMessage()` and `focusMessage()` already support notification and reply-preview navigation.
- The focus path calls `refreshMessages()` when the target is outside the current Room window, merges the authoritative row, publishes `focusedMessageId`, and lets `ChatTranscript` scroll and render the existing selected background.
- `MediaPickerViewModel` already demonstrates the repository's preferred cancellable request, generation-guard, debounce, and cursor-pagination pattern.
- `FishTopBar`, `FishIconButton`, `FishStateTextField`/`FishTextField`, `FishEmptyState`, `FishNotice`, `FishSkeleton`, `FishButton`, tokens, and semantic icons must be reused.

## Locked product and UX decisions

1. Search is conversation-scoped. It is available only after an authorized conversation is open.
2. The entry is a quiet search icon in the conversation top bar. It is not a primary button and does not compete with sending a message.
3. Search opens a focused full-screen surface. On expanded layouts, temporarily covering the conversation rail is acceptable because search is one task with one clear exit.
4. The field receives focus on entry. A trimmed non-empty query runs after a 300 ms pause; the keyboard Search action runs it immediately.
5. An empty query never calls the backend and shows guidance rather than all messages.
6. Results are newest first. A secondary `Show more results` action fetches the next keyset page. There is no infinite-scroll sentinel or numbered pagination in the first release.
7. Search results are lightweight and plain text. Do not hydrate GIFs, reactions, attachment URLs, Markdown rendering, or media previews for a search list.
8. Selecting a result uses the existing message-focus path. Do not create a second transcript or navigation stack.
9. Search does not mark every result as read. Normal transcript visibility remains responsible for read-state advancement after the selected message is shown.
10. Search queries and results are session-only. Do not write them to Room, DataStore, logs, analytics, or crash metadata.
11. Search failure uses the calm notice color and keeps the query available for retry. No alarming red state.
12. The Android and iOS user-visible scope should match, even if platform state ownership and presentation follow native conventions.

## User flow and state contract

1. The user opens an authorized direct conversation.
2. They activate `Search messages` in the top bar.
3. A focused search surface opens with the keyboard visible.
4. Before input, it says `Search this conversation.`
5. After a short typing pause, the current request is cancelled and a new search begins for the trimmed query.
6. The screen shows layout-stable loading content, then one of:
   - matching results;
   - `No messages match this search.`;
   - `Search is taking a little longer. Check your connection and try again.` with one retry action.
7. If another page exists, `Show more results` appears after the current results and preserves the existing list during its busy state.
8. Tapping a result closes search and calls the existing focus path for that message ID.
9. The transcript fetches the authoritative message if it is not loaded, scrolls to it, and shows the existing focused background. If it is no longer accessible, the existing calm `Earlier message unavailable` behavior is used.
10. System Back or the top-bar Back action closes search and returns to the unchanged conversation and draft.

### State model

Use one immutable feature state, for example:

```kotlin
data class MessageSearchUiState(
    val visible: Boolean = false,
    val query: String = "",
    val submittedQuery: String = "",
    val results: List<MessageSearchResultUiModel> = emptyList(),
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val nextCursor: MessageSearchCursor? = null,
    val notice: String? = null,
)
```

`submittedQuery` distinguishes an untouched/cleared field from a completed empty-result search. It does not need persistence across process death. Derived booleans should stay derived rather than being copied into the model.

### Search result presentation

Each result needs only:

- stable message ID;
- sender label (`You` or the known conversation participant);
- localized date/time label using the existing `ChatFormatter` conventions;
- the message body collapsed to a short, whitespace-normalized excerpt of at most three visual lines;
- a combined accessibility label containing sender, excerpt, and date/time.

Do not implement matched-substring highlighting in this release. Plain excerpts avoid another parser and still satisfy retrieval and navigation.

## Backend contract

Use the existing `public.search_chat_messages` RPC directly through the authenticated Supabase client. The native request should provide only the parameters this release needs:

```text
p_conversation_id     active authorized conversation ID
p_query               trimmed text
p_before_created_at   cursor timestamp, omitted on the first page
p_before_id           cursor message ID, omitted on the first page
p_limit               26 for a 25-result page plus one has-more probe
p_sort_direction      "desc"
```

All filter parameters continue using their database defaults. Do not call `count_chat_messages`; the mobile UI has no requirement for totals or numbered pages.

The adapter takes the first 25 rows. If row 26 exists, `nextCursor` is the `(created_at, id)` of the last retained row. This preserves the RPC's stable composite ordering without an offset or total-count query.

The RPC already excludes deleted messages and executes under the caller's authorization. Client-side conversation checks are still useful for correctness, but they are not the security boundary.

## Lean architecture

```text
Chat top-bar search action
  -> MessageSearchViewModel (feature:chat, session-only state)
      -> ChatRepository.searchMessages(...)
          -> DefaultChatRepository failure mapping
              -> ChatRemoteDataSource.searchMessages(...)
                  -> Supabase search_chat_messages RPC under RLS

Search result selected
  -> close search
  -> ChatViewModel.focusCurrentMessage(messageId)
      -> existing refreshMessages/Room merge when needed
      -> existing ChatTranscript scroll + focused treatment
```

Add no Gradle module, Room table, DAO, migration, use-case class, service locator, navigation library, or search-specific cache. A small search state owner is warranted because cancellation, pagination, retry, and UI state are independent of the already large conversation `ChatViewModel`; it should depend directly on the existing `ChatRepository` contract.

## Ordered incremental implementation steps

### Step 1 — Add the provider-neutral search contract and Supabase adapter

**Goal:** Make Android able to request one page of authorized message search results without adding UI or local persistence.

**Why necessary:** Presentation should not know RPC parameter names or Supabase response shapes. A narrow repository method keeps the current feature/data boundary intact.

**Dependencies and assumptions:**

- Migration `0019_chat_search_filters.sql` is deployed in the development and target Supabase projects.
- Message IDs are UUID strings and `created_at` values use the existing ISO timestamp representation.
- Search is body-only for this release; attachment names, sticker phrases, GIF descriptions, and voice transcription are not searchable.
- The existing `ChatResult`/`FailureCategory` model remains sufficient; no new error hierarchy is needed.

**Focused implementation actions:**

- Add small domain values in `data:chat`: `MessageSearchCursor(createdAt, id)`, `MessageSearchHit(id, conversationId, senderId, body, createdAt)`, and `MessageSearchPage(items, nextCursor)`.
- Add `searchMessages(conversationId, query, cursor?, limit = 25)` to `ChatRepository` and the internal remote boundary.
- In `DefaultChatRepository`, verify that the requested conversation exists in the authorized local directory, trim the query, reject blank input locally, clamp the requested page size to `1..99` (the extra probe must still fit under the RPC's 100-row cap), call the remote source, and map failures to `Search is taking a little longer. Check your connection and try again.`
- In `SupabaseChatRemoteDataSource`, call `search_chat_messages` with the minimal parameters above. Decode the existing base message fields into a lightweight row; do not call GIF, reaction, or attachment hydration.
- Fetch `limit + 1`, return at most `limit`, and derive the next composite cursor from the last retained item when the probe row exists.
- Add the method to `UnconfiguredChatRepository` and test fakes with the existing calm configuration failure/default empty behavior.
- Ensure diagnostics record only operation, outcome, duration, and failure category. Never record query text, result bodies, IDs, or result counts.

**Likely files:**

- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatRepository.kt`
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt`
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDiagnostics.kt`
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt`
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/ChatRemoteDataSource.kt`
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/SupabaseChatRemoteDataSource.kt`
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/SupabaseDtos.kt`
- corresponding `data:chat` unit tests/fakes

**Verification:**

- Contract test exact RPC field names, omitted first-page cursor, second-page cursor, descending sort, and the 26-row probe.
- Repository tests cover trim/blank handling, authorization lookup, limit bounding, calm failure mapping, and cursor propagation.
- Confirm no Room schema version changes.
- Run `pnpm android:test`.

**Working-state completion criteria:** The repository returns a deterministic first and second page from a fake/fixture and the existing app builds with no search UI.

### Step 2 — Add a focused search state owner

**Goal:** Manage query, cancellation, retry, pagination, and presentation mapping independently from the transcript.

**Why necessary:** Network search has meaningful lifecycle state. Keeping it out of composables prevents duplicated requests, while keeping it out of the conversation reducer avoids mixing transient search with message truth.

**Dependencies and assumptions:**

- Follow the existing `MediaPickerViewModel` approach instead of adding Flow-use-case abstractions.
- Search state is cleared on close and conversation change. Process restoration of an open search is not required.
- The active `AuthorizedConversation` already provides both participant identity and the current user ID/name needed for sender labels.

**Focused implementation actions:**

- Add `MessageSearchViewModel` in `feature:chat`, injected with `ChatRepository` and the existing `ChatFormatter` or a minimal formatting seam already used by `ChatViewModel` tests.
- Expose a single `StateFlow<MessageSearchUiState>`.
- Implement `open(conversation)`, `close()`, `updateQuery(value)`, `retry()`, and `loadMore()`.
- Cancel the prior request and increment a generation whenever the query or conversation changes. After 300 ms, search only if the trimmed query is non-empty.
- Let the IME Search action call an immediate submit method that cancels the pending debounce.
- Clear stale results immediately when the trimmed query changes; never show results for an older query under new field text.
- Preserve current results while loading more, deduplicate by message ID, and prevent concurrent pagination calls.
- Treat coroutine cancellation as cancellation, not failure. Publish only when the generation still matches.
- Map raw hits to the small UI result model; normalize line breaks/whitespace but do not mutate or interpret Markdown.

**Likely files:**

- new `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/MessageSearchViewModel.kt`
- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatModels.kt` or search models colocated with the state owner
- new `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/MessageSearchViewModelTest.kt`
- app composition in `apps/android/app/src/main/kotlin/space/fishhub/android/MainActivity.kt`

**Verification:**

- Unit tests cover initial state, blank input, 300 ms debounce, immediate submit, stale-response suppression, replacement on a new query, retry, append/deduplicate, end-of-results, and close/conversation reset.
- Use coroutine test time; do not add sleeps or instrumentation for state-owner behavior.
- Run `pnpm android:test`.

**Working-state completion criteria:** A host can drive complete search states from the state owner with a fake repository; the production UI is still unchanged.

### Step 3 — Build the accessible search surface

**Goal:** Present one calm search task using the shared Android design system.

**Why necessary:** The data capability is useful only when users can enter a query, understand progress and failures, and select a result without added choice or visual noise.

**Dependencies and assumptions:**

- Reuse `FishTopBar`, `FishIconButton`, the shared text field, empty/notice/skeleton/button components, semantic colors, typography, radii, and spacing tokens.
- If the current design-system text field cannot accept a leading search icon, IME Search action, and autofocus cleanly, extend that base control minimally rather than hand-rolling a Material field.
- The existing `FishIcons` search asset is available; if not, add the shared semantic Tabler search asset through the normal design-system pipeline.

**Focused implementation actions:**

- Add a `Search messages` quiet icon action to `ChatTopBar` and thread one `onOpenMessageSearch` callback through `ChatScreen`/`ChatAdaptiveLayout`.
- Create `MessageSearchScreen` in `feature:chat` with a Back action, title `Search messages`, autofocus field, and a single scrollable result region.
- Render each result as one full-width 44 dp-minimum button with sender/date metadata and a three-line excerpt. Use semantic text hierarchy and divider/spacing tokens; do not create decorative cards.
- Initial state: `Search this conversation.`
- Loading state: layout-stable skeleton rows or calm progress copy.
- Empty state: `No messages match this search.`
- Failure state: `FishNotice` plus one `Try again` action. Keep the field editable.
- Pagination: show `Show more results` as a secondary action. While loading more, keep existing results visible and make the action busy/disabled.
- Add clear semantics: field label `Search messages`; result label combines sender, excerpt, and date; loading and failure announcements use polite live regions; Back closes search.
- Respect 200% font scale, RTL, dark/light themes, screen readers, keyboard/IME, and reduced motion. Do not animate result insertion beyond existing reduced-motion-safe primitives.

**Likely files:**

- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatComponents.kt`
- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatScreen.kt`
- new `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/MessageSearchScreen.kt`
- `apps/android/feature/chat/src/main/res/values/strings.xml`
- shared design-system field/icon only if a real missing capability is confirmed
- chat screenshot and accessibility tests

**Verification:**

- Screenshot fixtures for initial, loading, results, empty, failure, loading-more, dark, 200% font, RTL, and expanded width.
- Compose accessibility tests verify the 44 dp targets, labels, traversal, Back behavior, keyboard Search, result activation, and no duplicate primary actions.
- Run `pnpm android:verify-design`, `pnpm android:screenshots`, and `pnpm android:instrumented` on API 33+.

**Working-state completion criteria:** Search can be opened, queried, paginated, retried, and closed against a fake state owner without changing transcript behavior.

### Step 4 — Wire result selection to the existing focus path

**Goal:** Make a search result return the user to the authoritative transcript message.

**Why necessary:** Search is retrieval, not a parallel message reader. Reusing the focus path preserves replies, media, reactions, read state, and message actions in one canonical transcript.

**Dependencies and assumptions:**

- `ChatViewModel.focusCurrentMessage()` remains the single entry for focusing a message in the open conversation.
- `refreshMessages()` remains limited to authorized IDs and returns current message truth.
- Fetching only the target message is sufficient for the first release; a guaranteed surrounding context window is explicitly deferred.

**Focused implementation actions:**

- In `ChatRoute`, collect search state and render `MessageSearchScreen` above/replacing chat while it is visible.
- On a result tap, capture the ID, close/clear search, then call `chatViewModel.focusCurrentMessage(id)`.
- Preserve the current draft, staged media/attachments, playback state policy, active conversation, and pagination state while search is open.
- Keep the existing transcript scroll and `focused-message` treatment. Do not duplicate scroll logic inside search.
- Ensure a message edited or deleted after the search response is reconciled by the focus refresh. If the target has become unavailable, use the existing calm notice and leave the user in the conversation.
- Ensure Android system Back closes media/participant sheets first when present, then search, then follows the existing conversation back behavior.

**Likely files:**

- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatRoute.kt`
- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatScreen.kt`
- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatViewModel.kt` only if a tiny public focus/reset adjustment is required
- route/ViewModel and instrumentation tests

**Verification:**

- Test selecting an already loaded result.
- Test selecting an older result that requires `refreshMessages()`.
- Test an inaccessible/deleted target.
- Test selecting the same result after reopening search.
- Test that draft text and staged attachments survive open, close, and selection.
- Test that search selection does not mark unrelated search hits read.
- Run `pnpm android:test` and `pnpm android:instrumented`.

**Working-state completion criteria:** A real result closes search, focuses the matching transcript row, and leaves all unrelated conversation state intact.

### Step 5 — Validate the deployed contract and release behavior

**Goal:** Prove search works with realistic long conversations and the target authorization rules before shipping.

**Why necessary:** Unit fixtures cannot prove RLS visibility, deployed RPC availability, real keyboard behavior, or acceptable search latency.

**Dependencies and assumptions:**

- A target-like Supabase project contains two authorized test accounts and a sufficiently long direct conversation.
- Test data includes repeated phrases, punctuation, edited messages, deleted messages, same-timestamp IDs, and an older message outside the initial Room window.
- Search text is private content and must not appear in logs or analytics.

**Focused implementation actions:**

- Add a small local contract verification for `search_chat_messages` if the existing Supabase verification scripts can accept it without creating a new framework.
- Verify authorized client and coach searches return only their conversation; an unrelated account cannot search it.
- Verify full-word and partial matching, deleted exclusion, stable newest-first order, no duplicate/omitted row across a composite cursor, and safe empty/whitespace handling.
- On physical Android devices, verify IME Search, keyboard dismissal, font scaling, TalkBack, RTL, dark/light, rotation, background/resume, network loss/retry, and an old-result jump.
- Measure only if a realistic query feels slow. Do not add caching, client indexes, or query analytics preemptively.
- Update `apps/android/README.md` to include message search in the shipped capability summary and any target-environment validation command.

**Verification:**

- `pnpm android:verify-design`
- `pnpm android:test`
- `pnpm android:screenshots`
- `pnpm android:instrumented`
- `pnpm android:check`
- `pnpm build` because repository policy requires it before a commit
- manual two-account target-project and physical-device matrix

**Completion criteria:** Search is authorized, stable across pages, accessible, calm in every meaningful state, able to focus an older message, free of private query logging, and green in the full Android/repository verification suite.

## Test matrix

| Area | Required cases |
| --- | --- |
| Query | untouched, whitespace, one character, words, punctuation, mixed case, long query, rapid replacement |
| Results | one, many, repeated text, same timestamps, edited body, deleted exclusion, no match |
| Pagination | exactly 25, 26, multiple pages, last page, repeated load-more tap, stale second page |
| Focus | already loaded, fetched by ID, unavailable after result, same result twice, very old message |
| Lifecycle | Back, rotation, background/resume, conversation switch, sign-out, process recreation defaults closed |
| Network | offline before search, disconnect during initial load, disconnect during load more, retry |
| Accessibility | TalkBack order/labels, 44 dp targets, 200% font, RTL, dark/light contrast, keyboard action, reduced motion |
| Privacy/security | authorized member, unrelated account, deleted message, no query/body/ID logs |

## Assumptions and tradeoffs

- **Assumption:** The deployed `search_chat_messages` signature and RLS behavior match migration `0019`. If deployment drift exists, repair deployment rather than adding a mobile-only endpoint.
- **Tradeoff:** The native MVP searches message bodies only. This is enough to recover coaching language; media/file discovery waits for evidence.
- **Tradeoff:** Search fetches no total count. A has-more cursor satisfies mobile pagination with one RPC instead of search plus count.
- **Tradeoff:** Search results are not cached. This avoids incomplete-history truth problems, private query storage, and a Room migration.
- **Tradeoff:** Selecting an unloaded result fetches the target message but does not guarantee adjacent context. The user still reaches the canonical transcript; add a bounded context-window contract only if pilot use shows the isolated target is confusing.
- **Tradeoff:** Search state does not survive process death. Persisting a private transient query is not required for the first release.
- **Assumption:** A 300 ms debounce is consistent with existing native picker behavior and adequate for the indexed RPC. Revisit only with measured latency or rate evidence.

## Explicitly deferred until concrete need

- sender, role, date, content-type, mention, channel, and pinned filters;
- the web search query language and saved/recent searches;
- global search across conversations;
- result counts and numbered pages;
- match highlighting and in-message occurrence navigation;
- attachment filename/OCR, voice transcription, sticker phrase, GIF metadata, and link-preview search;
- offline/local full-text indexing and search-result caching;
- guaranteed surrounding context windows;
- search analytics containing terms or result content;
- search suggestions, autocomplete, and ranking changes;
- tablet-specific persistent search panes;
- a new backend function or Edge Function while the current RLS RPC satisfies the requirement.

## Definition of done

Android message search is done when an authorized user can open search from a direct conversation, type a text query, understand every loading/empty/failure state, page through stable newest-first results, select one, and return to the focused authoritative message without losing their draft or exposing search content—and all Android, design, accessibility, build, and target-project checks pass.
