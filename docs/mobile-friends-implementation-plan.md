# Mobile friends implementation plan — add by username + request review

Status: Planned (2026-07-29). Platform order: Android first. Scope: the existing native direct-chat apps only.

> **For agentic workers:** execute task-by-task with superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

## Outcome

Let a mobile client add a friend by exact username and review incoming friend requests, so a direct conversation can come into existence without visiting the web app. Accepting a request already creates the pair's one persistent conversation server-side (`ensure_friend_conversation` trigger, `supabase/migrations/0039_friend_call_chat.sql:99-116`); this plan makes that conversation *appear* in the mobile inbox and gives the request lifecycle a calm native surface.

**No backend work.** Every RPC, Edge Function action, realtime broadcast, and error string this plan consumes is deployed and already exercised by `apps/web/features/friends/`. The mobile apps ship dark behind a build-time flag that mirrors the server's fail-closed `FRIENDS_ENABLED` gate.

The smallest implementation that satisfies the product is:

- one new data + feature module pair per platform (`data/friends` + `feature/friends` on Android, mirroring the presence pair; `FriendsData` + `Friends` on iOS, mirroring `PresenceData`/`Presence`);
- two client surfaces per platform: **Add a friend** (username → one candidate → one action) and **Friend requests** (list → one-request review with Accept/Decline);
- inbox entry points: a top-bar action, a quiet requests row when requests exist, and a friends-aware zero-conversation empty state;
- one `friends:user:{userId}` realtime subscription per signed-in session that refreshes the request count and the conversation directory — closing the gap where a newly created conversation never appears without restart;
- no navigation framework changes, no new third-party dependencies, no server changes.

## Current-state audit

### Backend + web (the deployed contract)

- `search_friend_candidate(p_username) → jsonb` (`supabase/migrations/0021_friendships.sql:208-287`): exact-username lookup, strips `@`, requires `^[a-z0-9_]{3,64}$`. Self, coaches, blocked pairs, unknown handles, and 7-day decline-cooldown targets **all collapse into `{"status":"unavailable"}`** — the privacy contract the mobile copy must respect. Other statuses: `none`, `friends`, `outgoing_pending`, `incoming_pending` (the pending ones carry `request_id`); all non-unavailable carry `profile {id, display_name, username}`.
- `list_incoming_friend_requests(p_cursor_created_at, p_cursor_id, p_limit)` → rows `(request_id, sender_id, display_name, username, created_at)` (`0024_friend_request_pagination.sql:7-38`); `count_incoming_friend_requests()` → integer (`0024:69`); `get_incoming_friend_request(p_request_id)` (`0024:42`). All `security definer`, client-role-gated via `private.require_client_caller()`.
- Edge Function `friend-command` (`supabase/functions/friend-command/index.ts`): actions `send-request {targetId, clientRequestId}`, `respond-request {requestId, response: "accept"|"decline"}`, `cancel-request`, `remove-friend`, `block-user`, `unblock-user`, `mark-notifications-read`. Payload keys are **camelCase**. Errors return `{code, error}` with calm copy authored server-side (`index.ts:66-131`). The function fails closed unless env `FRIENDS_ENABLED=true` (`index.ts:147-153`). **Reads (the RPCs) are not behind that env flag** — only commands are.
- Idempotent send: the web mints one `clientRequestId` per found candidate and reuses it on retry (`apps/web/features/friends/components/add-friend-form/add-friend-form.tsx:82-86`); the server may replay an earlier request for the same key, so clients **trust the returned `status`** (an immediately `accepted` replay means "already friends").
- Realtime: triggers broadcast `friends.changed` on private topic `friends:user:{userId}` for both parties (`0021:778-840`). Payloads are **wake-up hints only** (`{requestId|friendshipId, reason, occurredAt}`; reasons `request_created`, `request_accepted`, `request_declined`, `request_cancelled`, `friendship_created`, `friendship_removed`); clients always refetch through the list RPCs. A decline is **never** broadcast to the sender. RLS on `realtime.messages` scopes each topic to its own user (`0021:850+`).
- Web gates its friends nav behind env `FRIENDS_ENABLED` and `role === "client"` (`apps/web/features/friends/server/page-data.ts:21-23`, `apps/web/components/shell/user-menu/user-menu.tsx:111`).
- There is **no push notification for friend events** anywhere in the backend; `push-command` is device registration only.

### Android

- The app is conversation-first; there is no persistent inbox. `ConversationListScreen` (`apps/android/feature/chat/.../screens/ConversationListScreen.kt:30-97`) is a secondary destination and `ChatViewModel.showConversationList()` **returns early when `conversations.size <= 1`** (`viewmodels/ChatViewModel.kt:265-266`) — with zero or one friend the list is unreachable. `PersonalChatScreen` shows back only when `model.hasPreviousDestination` (`screens/PersonalChatScreen.kt:148`).
- The zero-conversation state renders `ChatUnavailable` (`PersonalChatScreen.kt:290-311`) with copy written for coach-assigned chat: title `conversation_unavailable_title` = "This conversation isn't available", description "Go back and open an assigned conversation." (`feature/chat/src/main/res/values/strings.xml:46-47`). For a friends-capable client with no friends yet, this copy is wrong and there is nothing to go back to.
- `SupabaseChatRemoteDataSource` already calls `friend-command` for `remove-friend`/`block-user`/`unblock-user` via a private `friendCommand()` helper (`data/chat/.../remote/SupabaseChatRemoteDataSource.kt:500-523`) and parses `{code, error}` bodies with `readError()` (`:1093-1095`); fallback constant `DefaultFriendError` = "Friends is taking a break. Chat still works." (`:1103-1112`). RPCs go through `client.postgrest.rpc(...).decodeList<Dto>()` (`:504-507`). Auth headers are injected by supabase-kt; no manual token work.
- Realtime subscriptions are strictly per-conversation (`SupabaseChatRemoteDataSource.realtime`, `:644-746`). `listAuthorizedConversations()` runs only on sign-in (`ChatViewModel.kt:829-864`) and on entering the conversation list (`:274-291`). **A conversation created by an accepted friend request will not appear until process restart or list re-entry.** The private-broadcast template to copy is presence: channel `presence:user:$userId` (`data/presence/.../SupabasePresenceRemoteDataSource.kt:94-104`).
- DI is manual: `FishApplication` composes `*DataModule.create(...)` (`FishApplication.kt:37-58`), `MainActivity` builds `viewModelFactory` blocks (`MainActivity.kt:339-385`). Navigation is `when (routeState)` in `ChatRoute.kt:327-583` plus boolean flags; the full-screen precedent is message search (`ChatRoute.kt:452-465`, `views/MessageSearchScreen.kt:65-180`), the sheet precedent is account settings (`ChatRoute.kt:142`, `:643-679`).
- Design system: `FishButton`, `FishStateTextField`, `FishAvatar` (initials; images via Coil painter resolved through the `avatar-command` Edge Function, `SupabaseChatRemoteDataSource.resolveAvatarUrls()` `:546-570`), `FishModalBottomSheet`, `FishEmptyState`, `FishNotice`, `FishIconButton`, `FishTopBar`. `FishIcons` has **no add-person icon** (33 hand-authored `ImageVector`s, `core/designsystem/.../Icons.kt`).
- Tests: JUnit4 + `kotlinx-coroutines-test` with hand-written fakes per test file (`ChatViewModelTest.kt:1056+`), per-module `*AccessibilityTest` (`feature/settings/src/androidTest/.../AccountSettingsAccessibilityTest.kt:19-47`), `@PreviewTest` screenshot matrix light/dark/compact/2× font/RTL fed by a `*PreviewContent` composable. `pnpm android:instrumented` and `pnpm android:screenshots` **enumerate modules explicitly in `package.json:13-17`** — a new module must be added there.

### iOS

- The inbox always exists: `FishRoot` → `ChatSplitLayout` → `InboxView` → stateless `ConversationListScreen` (`apps/ios/App/Sources/InboxView.swift:17-38`, `FishKit/Sources/PersonalChat/Screens/ConversationListScreen.swift`). The top bar takes exactly **one** trailing action, currently Account settings (`InboxView.swift:28-32`; `UIComponents/Navigation/TopBar.swift:22-66`).
- Empty state: `EmptyState(title: "No conversations yet", message: "Your assigned conversations will appear here.")` (`ConversationListScreen.swift:37-49`); `EmptyState` already supports `actionLabel`/`isPrimaryAction` (`UIComponents/Feedback/EmptyState.swift:12-24`) — unused by the inbox today.
- `ConversationDirectoryStore.start()` captures the conversation ids it fetched and subscribes only to those `attention:conversation:{id}` channels (`PersonalChat/ViewModels/ConversationDirectoryStore.swift:38-53`; `ChatData/Adapters/ChatLive.swift:300-340`). **A brand-new conversation cannot arrive by realtime today**; it appears only via `FishAppModel.refreshDirectory()` (`FishAppModel.swift:715-718`), `closeConversation()`, or relaunch.
- Networking: provider-neutral adapters hand-roll `URLSession` against `rest/v1/rpc/{name}` and `functions/v1/{fn}` with `apikey` + `Bearer` headers from `ChatBackendConfiguration.accessToken` (`RestConversationDirectory.swift:42-81`, `EdgeFunctionAttachmentCommands.swift:105-145`). Wire structs are `Decodable` with snake_case `CodingKeys` and a `.domain` computed property; `{code, error}` failure bodies decode via the `chatFailure(...)`-style helpers (`RestChatMessaging.swift:459-477`). `friend-command` is currently unused from iOS (account-settings unblock calls the `unblock_user` RPC directly, `ChatLive.swift:218-226`).
- Module convention: data/feature pairs (`PresenceData`/`Presence`, `ChatData`/`PersonalChat`) with a module doc file, `Models/Logic/ViewModels/Views/Adapters/Providers` folders, feature modules never importing Supabase. New modules must be added to **both** `FishKit/Package.swift` and `App/project.yml` (`Presence`/`PresenceData` are wired into Catalog only — do not repeat that for Friends).
- App shell: inbox-level sheets are presented from `FishRoot.swift:101-130` bound to `FishAppModel` flags; the model-trigger convention is `showAccountSettings()` (`FishAppModel.swift:407-412`). Async commands use the in-flight-guard + `accountSettingsGeneration` staleness-token pattern (`:499-564`).
- Adjacent observed fact (not fixed here): on iPad two-pane the rail's account action can be tapped while `phase == .conversation`, but `showAccountSettings()` guards `phase == .inbox`, so it silently no-ops. The friends triggers below deliberately guard on *signed-in* instead; apply the same fix to account settings separately if desired.
- Design system: `ActionButton` (`.primary` reserved for the screen's single main action), `InputField` (reserved support row, `submitLabel`/`onSubmit`), `Avatar` (**initials only — no remote avatar loading exists anywhere on iOS**), `EmptyState`, `Notice` (`.notice` tone is the calm grey), `TopBar`, `IconButton`. `Icon` has no add-person glyph; adding one means a Tabler `user-plus` imageset in `DesignSystem/Resources/Icons.xcassets` + an enum case (`IconTests` enforces the pairing).
- Tests: swift-testing with hand-written `private actor` fakes (`PersonalChatTests/ConversationStoreTests.swift:7-90`), `StubURLProtocol` for edge-command adapters (`CallDataTests/`), per-target `SnapshotSupport.swift` (light/dark + accessibility/RTL); snapshot recording = run twice, then visually review every PNG against `docs/ui-ux-agent-guidelines.md` before committing.

## Locked decisions and non-goals

- Native remains direct-chat-only. Friends exists solely to let a direct conversation come into existence and to review requests — no friends directory browsing, no discovery, no profiles.
- **Exact-username search only.** One input, at most one candidate. Never a result list, never fuzzy matching, never contact import or QR. The `unavailable` collapse is presented exactly as the server returns it; the UI never distinguishes "doesn't exist" from "blocked you" from "declined recently".
- **Client role only.** Entry points render only for client accounts, reusing the exact signal that already gates the client-only Blocked people row on each platform (Android: the capability `ChatRoute` passes into the settings sheet at `ChatRoute.kt:643-679`; iOS: the role knowledge behind `AccountSettingsBlockedPeopleState.hidden` in `FishAppModel`). Do not invent a second role source. The server enforces regardless.
- **Build-time flag, default off**, mirroring web: Android gradle property `FISH_ANDROID_FRIENDS_ENABLED` → `BuildConfig.FRIENDS_ENABLED` (precedent: `FISH_ANDROID_WEB_BASE_URL`); iOS Info.plist key `FRIENDS_ENABLED` read through `FishAppConfiguration.fromBundle` (`FishAppConfiguration.swift:49-74`), parsed as the string `"true"`. Flag off ⇒ zero UI change anywhere.
- Accepting a request produces **no success toast**: the new conversation appearing in the refreshed inbox is the reward. After accept or decline the row disappears; when the last request is handled the requests surface returns to the inbox.
- Requests surface: a **quiet text row, never a numeric badge or red dot.** Copy comes from web: "A friend request is waiting" / "Friend requests are waiting".
- One primary action per screen holds everywhere: Add a friend's primary is Search (then Add friend on the candidate card — sequential, never simultaneous); the review screen's primary is Accept request with Decline as ghost; the zero-conversation empty state's primary is Add a friend.
- Mirror the web flow's error semantics exactly, including: `request_pending` → treat as sent; `already_friends` → show friends state; `incoming_request_exists` → re-search and pivot to Review; replayed `accepted` send → show friends state.
- Avatars: Android candidate/request rows resolve images through the existing `avatar-command` path like `PersonalChatTopBar` does; iOS uses initials `Avatar`, matching every existing iOS call site. This asymmetry is deliberate; iOS remote avatars are a separate feature.
- Server copy passes through verbatim (`readError` on Android, the `chatFailure`-style decode on iOS). Do not re-author server-owned strings client-side.
- No `NavHost`, no `NavigationStack`, no new navigation machinery. Android uses the search-screen boolean-branch precedent; iOS uses `FishRoot` sheets with internal page enums (account-settings precedent).

## User flow and screen/state contract

Entry points (all: flag on + client role only):

| Surface | Android | iOS |
| --- | --- | --- |
| Inbox top bar | `FishIconButton(FishIcons.PersonAdd, "Add a friend")` in the `ConversationListScreen` header row before `accountContent` (`ConversationListScreen.kt:54-62`) and in the two-pane rail title block (`ChatAdaptiveLayout.kt:252-261`) | Second `TopBarAction(icon: .personPlus, accessibilityLabel: "Add a friend")` in the inbox `TopBar` (`InboxView.swift:28-32`) |
| Requests row | Quiet tappable row between the list description and the `LazyColumn` when `incomingRequestCount > 0` | Quiet tappable row above the conversation list when count > 0 (`ConversationListScreen.swift:51-58` region) |
| Zero conversations | `ChatUnavailable` becomes a friends-aware empty state | `EmptyState` gains the `actionLabel` it already supports |
| List reachability | `showConversationList()` and `hasPreviousDestination` relax from `size > 1` to `friendsEnabled \|\| size > 1` so the sole-conversation client can reach the inbox | No change — the inbox is phase-based and always reachable |

Screen contract and exact copy (web-sourced unless marked new):

| State | Copy / behavior |
| --- | --- |
| Add a friend — input | Title "Add a friend". Field label "Username", hint "Usernames look like @sam_lee. Ask your friend for theirs." Primary "Search" (submit/IME search). Empty input keeps focus with field notice "Add a username to search." |
| Add a friend — search transport failure | Notice (calm tone): "The search didn’t go through. Give it a moment and try again." |
| Add a friend — `unavailable` | Notice: "That person isn’t available. Check the username and try again." Ghost "Search again" resets to input. |
| Add a friend — `none` | Candidate card: avatar, display name, @username. Primary "Add friend". Mint a fresh `clientRequestId` (UUID) for this candidate; reuse it on every retry of this candidate. |
| Add a friend — sent / `outgoing_pending` | Card body "Request sent. They’ll see it when they’re ready." No cancel affordance (deferred). Ghost "Search again". |
| Add a friend — `friends` | Card body "You’re already friends." Ghost "Search again". |
| Add a friend — `incoming_pending` | Card body "They already sent you a request." Primary "Review request" → opens that request's review. |
| Requests — list | Title "Friend requests". Rows: avatar, display name, @username, chevron; tap → review. Empty: "No requests right now. New ones will appear here." Load failure notice: "Could not load friend requests." with "Try again". |
| Requests — review | One request per screen: avatar, name, @username, body "Wants to be friends. Accept when you’re ready — there’s no rush." Primary "Accept request", ghost "Decline", both disabled while either is busy. Failure keeps the screen with the server's calm notice. Success (either response) returns to the list with the row gone; an empty list returns to the inbox. |
| Inbox requests row | count == 1: "A friend request is waiting"; count > 1: "Friend requests are waiting". Row is a ≥44pt/dp target opening Friend requests. |
| Zero-conversation empty state (new copy) | Title "No conversations yet", message "Add a friend to start talking.", primary action "Add a friend". Flag off or coach role: existing copy untouched on both platforms. |
| Decline semantics | Nothing is shown to the sender, ever. A declined sender's later search hits the 7-day cooldown and sees plain `unavailable` copy. |

Server-owned notices that must surface verbatim when `friend-command` returns them: "You’re already friends." · "They already sent you a request. Review it when you’re ready." · "Your request is already on its way." · "This request was already handled." · "Pause for a moment before sending more requests." · "That friend request is already in progress." · "Friends isn’t available for this account." · "This request isn’t available anymore." · "That person isn’t available." · "Sign in to manage friends." · "Friends is taking a break. Chat still works." (also each platform's local fallback).

Realtime contract (both platforms): subscribe to private broadcast `friends:user:{userId}`, event `friends.changed`, while signed in. On any event refetch `count_incoming_friend_requests` (and the open requests list); on `friendship_created` or `request_accepted` additionally refresh the conversation directory (`FishAppModel.refreshDirectory()` / a new public `ChatViewModel.refreshDirectory()`). Payloads are hints — never mutate local state from them directly. Tear the channel down on sign-out.

## Architecture

```text
Android                                          iOS
data/friends  (new)                              FishKit/Sources/FriendsData  (new)
  FriendsRepository (interface)                    Providers/FriendsProviding protocols
  DefaultFriendsRepository                         Adapters/RestFriendDirectory      (RPC reads)
  remote/FriendsRemoteDataSource (interface)       Adapters/EdgeFunctionFriendCommands (writes)
  remote/SupabaseFriendsRemoteDataSource           Adapters/FriendsLive              (friends:user:{id})
  remote/FriendsDtos                               Adapters/FriendsWire              (snake_case → domain)
  FriendsDataModule (+ Unconfigured fallback)      Models/ (FriendCandidate, IncomingFriendRequest,
                                                            FriendEvent, FriendCommandFailure)
feature/friends (new)                            FishKit/Sources/Friends (new; never imports Supabase)
  FriendsViewModel                                 ViewModels/AddFriendModel, FriendRequestsModel
  model/FriendsModels                              Views/AddFriendSheet, FriendRequestsSheet
  views/AddFriendScreen, FriendRequestsScreen      Models/ (UI state enums)

feature/chat: entry points + gate relaxation     App: FishAppModel flags/commands, FishRoot sheets,
FishApplication/MainActivity: DI wiring               InboxView second action, Package.swift + project.yml
```

Architecture decision: a paired module set (presence precedent) rather than growing `data/chat`/`feature/chat`, because friends has its own remote contract, realtime channel, and screens, and `ChatViewModel`/`ChatRoute` are already the largest files in the app. `feature/chat` (Android) and the App target (iOS) do the composition. The existing `remove-friend`/`block-user`/`unblock-user` calls stay where they are in the chat/settings path — no migration, no behavior change.

---

## Task 1 — Android: `data/friends` module

**Goal:** A tested repository exposing search, incoming-request reads, send/respond commands, and the `friends:user:{id}` event flow.

**Files:** `apps/android/settings.gradle.kts`; new `apps/android/data/friends/` (build.gradle.kts, AndroidManifest.xml, `FriendsRepository.kt`, `DefaultFriendsRepository.kt`, `FriendsModels.kt`, `FriendsDataModule.kt`, `remote/FriendsRemoteDataSource.kt`, `remote/SupabaseFriendsRemoteDataSource.kt`, `remote/FriendsDtos.kt`); tests under `data/friends/src/test/`.

- [ ] **1.1 Create the module** with the `data/presence` build file as the template (`api(libs.kotlinx.coroutines.core)`, `implementation(project(":core:supabase"))`, supabase-kt postgrest/functions/realtime, serialization, ktor-client-mock for tests). Register in `settings.gradle.kts`.

- [ ] **1.2 Domain models** in `FriendsModels.kt`:

```kotlin
enum class FriendCandidateStatus { None, Friends, OutgoingPending, IncomingPending, Unavailable }
data class FriendProfile(val id: String, val displayName: String, val username: String)
data class FriendCandidate(val status: FriendCandidateStatus, val profile: FriendProfile?, val requestId: String?)
data class IncomingFriendRequest(val requestId: String, val sender: FriendProfile, val createdAt: Instant)
enum class FriendEventReason { RequestCreated, RequestAccepted, RequestDeclined, RequestCancelled, FriendshipCreated, FriendshipRemoved, Unknown }
data class FriendEvent(val reason: FriendEventReason, val requestId: String?, val friendshipId: String?)
data class FriendRequestOutcome(val requestId: String, val status: String) // pending | accepted | declined | cancelled
```

Result type: reuse the module-local pattern (`FriendsResult.Success/Failure(message, recoverable)`) mirroring `ChatResult` (`data/chat/.../ChatRepository.kt:28-37`) rather than importing data/chat.

- [ ] **1.3 DTOs** in `FriendsDtos.kt` — `@Serializable` with `@SerialName` snake_case for reads (`request_id`, `sender_id`, `display_name`, `created_at`; candidate payload `status`/`request_id`/`profile{id, display_name, username}`), camelCase for `friend-command` bodies (`action`, `targetId`, `clientRequestId`, `requestId`, `response`) and its `{request: {...}}` response. Unknown candidate status decodes to `Unavailable`; `profile == null` forces `Unavailable` (web parity, `friend-repository.ts:108-118`).

- [ ] **1.4 Remote data source.** `SupabaseFriendsRemoteDataSource` (internal):
  - `searchCandidate(username)` → `client.postgrest.rpc("search_friend_candidate", buildJsonObject { put("p_username", JsonPrimitive(username)) }).decodeAs<FriendCandidateDto>()`
  - `listIncomingRequests()` → rpc `list_incoming_friend_requests` with `p_limit = 50`, `decodeList`
  - `countIncomingRequests()` → rpc `count_incoming_friend_requests`, decode `Int`
  - `sendRequest(targetId, clientRequestId)` / `respondRequest(requestId, response)` → `client.functions.invoke("friend-command", body = ...)` with the status check + `readError`-style `{code, error}` parsing copied from `SupabaseChatRemoteDataSource.kt:511-523, 1093-1095`; throw `RemoteFriendCommandException(code, message)` so the repository can branch on `code` (needed for `request_pending`/`already_friends`/`incoming_request_exists` handling). Fallback string: "Friends is taking a break. Chat still works."
  - `events(userId)` → `channel("friends:user:$userId") { isPrivate = true }.broadcastFlow<FriendEventDto>("friends.changed")` with subscribe/teardown per the presence template (`SupabasePresenceRemoteDataSource.kt:94-104`), `callbackFlow` + `awaitClose { removeChannel }`.

- [ ] **1.5 Repository.** `DefaultFriendsRepository` wraps every call in a `resultOf`-style catcher mirroring `DefaultChatRepository.kt:1179-1221` (categorize auth vs network vs remote; prefer the command exception's message; never log usernames or ids). Send-request maps the outcome per the locked decisions: exception code `request_pending` → Success(status pending), `already_friends` → Success(status accepted-equivalent), `incoming_request_exists` → a typed `IncomingExists` result so the ViewModel can re-search. `FriendsDataModule { data class Dependencies(val repository: FriendsRepository); fun create(client: SupabaseClient?): Dependencies }` with an `UnconfiguredFriendsRepository` no-op fallback (presence precedent `PresenceDataModule.kt:42-53`).

- [ ] **1.6 Tests** (`pnpm android:test`): DTO decode fixtures for every candidate status + unknown status + missing profile; command body encode (camelCase, action literals); error-body parsing → calm message; outcome mapping incl. the three special codes and replayed `accepted`. Use ktor-client-mock per `data/chat/src/test/.../SupabaseContractTest.kt`.

- [ ] **1.7 Commit** `feat(android): add friends data module for requests and search`.

## Task 2 — Android: `feature/friends` UI

**Goal:** The Add a friend and Friend requests screens plus `FriendsViewModel`, fully renderable from fakes.

**Files:** new `apps/android/feature/friends/` (build.gradle.kts with `implementation(project(":data:friends"))` + `project(":core:designsystem")` + screenshot plugin wiring; `FriendsViewModel.kt`, `model/FriendsModels.kt`, `views/AddFriendScreen.kt`, `views/FriendRequestsScreen.kt`, `views/FriendsPreviewContent.kt`); `core/designsystem/.../Icons.kt`; string resources `feature/friends/src/main/res/values/strings.xml`; tests in `src/test/`, `src/screenshotTest/`, `src/androidTest/`; `apps/android/package.json:13-17` script lists.

- [ ] **2.1 Icon.** Add `FishIcons.PersonAdd` (Tabler `user-plus` outline path, hand-authored `ImageVector` like the existing 33) and sync `design/parity/native-components.json` per its schema. Run `pnpm android:verify-design`.

- [ ] **2.2 UI state + ViewModel.** UI state in `model/FriendsModels.kt`:

```kotlin
sealed interface AddFriendUiState {
    data class Input(val notice: String?, val fieldNotice: String?, val searching: Boolean) : AddFriendUiState
    data class Candidate(
        val candidate: FriendCandidate,
        val clientRequestId: String,
        val sending: Boolean,
        val sent: Boolean,
        val notice: String?,
    ) : AddFriendUiState
}
sealed interface FriendRequestsUiState {
    data object Loading : FriendRequestsUiState
    data class Loaded(val requests: List<IncomingFriendRequest>, val busyRequestIds: Set<String>, val notice: String?) : FriendRequestsUiState
    data class Failed(val notice: String) : FriendRequestsUiState
}
```

`FriendsViewModel(repository, friendsEnabled, isClient)` owns: `addFriendVisible`/`requestsVisible` flags, `incomingRequestCount: StateFlow<Int>`, the two states above, a `selectedRequest: IncomingFriendRequest?` for review, a collector on `repository.events(userId)` that refetches the count on every event, and `directoryInvalidations: SharedFlow<Unit>` emitted on `FriendshipCreated`/`RequestAccepted` (collected by `ChatRoute` in Task 3.5 — the friends module never references the chat ViewModel). Search submits on IME action; blank input sets `fieldNotice = "Add a username to search."` without leaving Input. Send/respond are single-flight; respond success removes the row and clears `selectedRequest`; last-row removal also sets `requestsVisible = false`.

- [ ] **2.3 Screens.** `AddFriendScreen` copies the `MessageSearchScreen` shell (`BackHandler`, `FishTopBar(showBack = true, title = "Add a friend")`, `FishStateTextField` with `ImeAction.Search`, auto-focus). Candidate card: `FishAvatar`/`PresenceAvatar`-style row with Coil painter from the existing avatar resolution, body text per the copy table, `FishButton` primary that is "Search" in Input and "Add friend"/"Review request" on the card — never both visible. `FriendRequestsScreen`: list page (rows ≥ 48dp targets, chevron) and review page switched by `selectedRequest`, review body/buttons per copy table (`FishButtonVariant.Primary` + ghost), all notices `FishNotice(tone = Neutral)`. All copy in `strings.xml` (`add_friend_title`, `add_friend_username_label`, `add_friend_username_hint`, `add_friend_empty_input`, `add_friend_search`, `add_friend_send`, `add_friend_sent`, `add_friend_already_friends`, `add_friend_incoming`, `add_friend_review_request`, `add_friend_unavailable`, `add_friend_search_failed`, `add_friend_search_again`, `friend_requests_title`, `friend_requests_empty`, `friend_requests_load_failed`, `friend_request_review_body`, `friend_request_accept`, `friend_request_decline`, `friend_requests_waiting_one`, `friend_requests_waiting_many`).

- [ ] **2.4 Tests.** ViewModel unit tests with a hand-written `FakeFriendsRepository` in the test file (send maps `request_pending`→sent, `already_friends`→friends, `incoming_request_exists`→re-search pivot, replayed accepted→friends; respond removes row; event → count refetch always + `directoryInvalidations` emission on exactly the two refresh reasons; blank search never calls the repository). Screenshot tests via `FriendsPreviewContent` for input/candidate/sent/unavailable/requests-list/review/empty across the standard matrix; record with `./gradlew :feature:friends:updateDebugScreenshotTest`, then **visually review every PNG against `docs/ui-ux-agent-guidelines.md`**. `FriendsAccessibilityTest` asserting 48dp targets and content descriptions. Add `feature/friends` to the instrumented + screenshot script lists in `apps/android/package.json`.

- [ ] **2.5 Verify** `pnpm android:test`, `pnpm android:screenshots`, `pnpm android:instrumented`, `pnpm android:check`. **Commit** `feat(android): add friends feature module with add-friend and request screens`.

## Task 3 — Android: wiring, entry points, and directory refresh

**Goal:** Reachable flag-gated entry points, the friends-aware empty state, and a directory that updates when a friendship appears.

**Files:** `apps/android/app/build.gradle.kts` (flag), `FishApplication.kt`, `MainActivity.kt`, `feature/chat/build.gradle.kts` (`implementation(project(":feature:friends"))`), `ChatRoute.kt`, `viewmodels/ChatViewModel.kt`, `screens/ConversationListScreen.kt`, `screens/ChatAdaptiveLayout.kt`, `screens/PersonalChatScreen.kt`, `feature/chat/src/main/res/values/strings.xml`, tests.

- [ ] **3.1 Flag.** Gradle property `FISH_ANDROID_FRIENDS_ENABLED` (default `false`) → `BuildConfig.FRIENDS_ENABLED`, documented in `apps/android/README.md` next to the web-base-URL property.

- [ ] **3.2 DI.** `FishApplication`: `friendsDependencies by lazy { FriendsDataModule.create(supabaseClient) }` + `val friendsRepository` (precedent `:53-55`, `:79-83`). `MainActivity`: a `friendsFactory` `viewModelFactory` beside `presenceFactory` (`MainActivity.kt:370-385`), constructing `FriendsViewModel(repository = app.friendsRepository, friendsEnabled = BuildConfig.FRIENDS_ENABLED, isClient = ...)` — for `isClient`, locate and reuse the exact signal `ChatRoute` already passes into the settings sheet to gate the client-only Blocked people row (`ChatRoute.kt:643-679`); pass the ViewModel into `ChatRoute`.

- [ ] **3.3 Expose `ChatViewModel.refreshDirectory()`** — a public function running the existing `loadConversations()` logic (`ChatViewModel.kt:829-864`) safely from any state, debounced against concurrent runs. Unit-test that a call while signed in refreshes previews and that a new conversation id appears in `ConversationList`.

- [ ] **3.4 Reachability.** Relax the two `size > 1` gates to `friendsEnabled || size > 1`: `showConversationList()` (`ChatViewModel.kt:265-266`) and whatever computes `hasPreviousDestination` (consumed at `PersonalChatScreen.kt:148`; locate its source in the uimodel builder and gate identically). Unit-test both with flag on/off at sizes 0/1/2.

- [ ] **3.5 Entry points.** In `ChatRoute`: new route branches (search precedent at `:452-465`) rendering `AddFriendScreen` / `FriendRequestsScreen` when the FriendsViewModel flags are set; collect `friendsViewModel.directoryInvalidations` in a `LaunchedEffect` and call `chatViewModel.refreshDirectory()`; thread `onOpenAddFriend`/`onOpenRequests`/`incomingRequestCount` into `ConversationListScreen` (header row `:54-62`: `FishIconButton(FishIcons.PersonAdd, contentDescription = "Add a friend")` before `accountContent`; requests row under the description when count > 0) and into the two-pane rail (`ChatAdaptiveLayout.kt:252-261`). All render only when `friendsEnabled && isClient`.

- [ ] **3.6 Empty state.** In `PersonalChatScreen.ChatUnavailable` (`:290-311`): when `friendsEnabled && isClient && conversations are empty`, render title `no_conversations_title` = "No conversations yet", description `no_conversations_description` = "Add a friend to start talking.", and a `FishButtonVariant.Primary` "Add a friend" action invoking `onOpenAddFriend`. Flag off/coach: existing copy and button untouched.

- [ ] **3.7 Verify end to end** against a local/dev Supabase with `FRIENDS_ENABLED=true` on the Edge environment and two client accounts: search→send on device A, requests row + accept on device B, conversation appears on **both** devices without restart (the `friends:user:{id}` event → `refreshDirectory()` path), decline invisible to sender, coach account shows no entry points, flag-off build byte-identical behavior. `pnpm android:test`, `pnpm android:screenshots`, `pnpm android:instrumented`, `pnpm android:check`, `pnpm build`.

- [ ] **3.8 Commit** `feat(android): wire friends entry points, empty state, and directory refresh`.

## Task 4 — iOS: `FriendsData` module

**Goal:** Provider-neutral adapters + models for search, request reads, commands, and friend events, fully tested against stubs.

**Files:** `FishKit/Package.swift` (products `FriendsData`, `Friends`; targets + `FriendsDataTests`, `FriendsTests`); new `FishKit/Sources/FriendsData/` (`FriendsData.swift` module doc, `Models/FriendsModels.swift`, `Models/FriendCommandFailure.swift`, `Providers/FriendsProviding.swift`, `Adapters/FriendsWire.swift`, `Adapters/RestFriendDirectory.swift`, `Adapters/EdgeFunctionFriendCommands.swift`, `Adapters/FriendsLive.swift`); `FishKit/Tests/FriendsDataTests/` (+ its own `StubURLProtocol.swift` copy, JSON fixtures).

- [ ] **4.1 Models + protocols.** Mirror Task 1.2's shapes in Swift (`FriendCandidate`, `FriendCandidateStatus`, `FriendProfile`, `IncomingFriendRequest`, `FriendEvent(reason:requestId:friendshipId:)`, `FriendEventReason`, `FriendRequestOutcome`, plus `enum FriendRequestResponse: String, Sendable { case accept, decline }`). `FriendCommandFailure { code, notice, statusCode }` mirroring `AttachmentCommandFailure`, with `.unavailable` fallback notice "Friends is taking a break. Chat still works." Protocols:

```swift
public protocol FriendDirectoryProviding: Sendable {
    func searchCandidate(username: String) async throws -> FriendCandidate
    func listIncomingRequests() async throws -> [IncomingFriendRequest]
    func countIncomingRequests() async throws -> Int
}
public protocol FriendCommandsProviding: Sendable {
    func sendRequest(targetId: String, clientRequestId: String) async throws -> FriendRequestOutcome
    func respondRequest(requestId: String, response: FriendRequestResponse) async throws -> FriendRequestOutcome
}
public protocol FriendEventsProviding: Sendable {
    func events(userId: String) -> AsyncStream<FriendEvent>
}
```

- [ ] **4.2 Wire + REST adapter.** `FriendsWire.swift`: snake_case `CodingKeys` structs with `.domain` (candidate jsonb, request rows, `{code, error}` failures, camelCase-encoding command bodies and the `{request: {...}}` response). Unknown status or nil profile → `.unavailable`. `RestFriendDirectory` hand-rolls `rest/v1/rpc/{name}` exactly like `RestConversationDirectory.rpc` (`RestConversationDirectory.swift:42-81`), including the 15s timeout and `chatFailure`-style non-2xx mapping; `count_incoming_friend_requests` decodes a bare integer body.

- [ ] **4.3 Edge commands.** `EdgeFunctionFriendCommands` per the `EdgeFunctionAttachmentCommands.send` template (`EdgeFunctionAttachmentCommands.swift:105-145`) against `functions/v1/friend-command`, bodies `{action: "send-request", targetId, clientRequestId}` / `{action: "respond-request", requestId, response}`; non-2xx decodes `{code, error}` into `FriendCommandFailure` so callers can branch on `failure.code`.

- [ ] **4.4 Events.** `FriendsLive.events(userId:)` — one private broadcast channel `friends:user:{userId}`, event `friends.changed`, per the `attentionEvents` template (`ChatLive.swift:300-340`), decoding reason strings to `FriendEventReason` (unknown → `.unknown`, still emitted: every event triggers a refetch anyway).

- [ ] **4.5 Tests** (swift-testing): wire decode fixtures for all statuses/rows/failures; `RestFriendDirectory` + `EdgeFunctionFriendCommands` against `StubURLProtocol` (success, `{code, error}` calm mapping, 401 → not-authenticated, scalar count decode); command body encode assertions (action literals, camelCase). Run `pnpm ios:test`.

- [ ] **4.6 Commit** `feat(ios): add FriendsData module for search, requests, and friend events`.

## Task 5 — iOS: `Friends` feature module

**Goal:** `AddFriendSheet` + `FriendRequestsSheet` with observable models, snapshot-covered, never importing Supabase.

**Files:** new `FishKit/Sources/Friends/` (`Friends.swift` module doc, `Models/FriendsUiModels.swift`, `ViewModels/AddFriendModel.swift`, `ViewModels/FriendRequestsModel.swift`, `Views/AddFriendSheet.swift`, `Views/FriendRequestsSheet.swift`, `Views/FriendRequestRow.swift`); `DesignSystem/Resources/Icons.xcassets` + `Icons/Icon.swift` (`.personPlus = "user-plus"`); `FishKit/Tests/FriendsTests/` (own `SnapshotSupport.swift` copy per the AccountSettings precedent).

- [ ] **5.1 Icon.** Add the Tabler `user-plus` outline imageset + `Icon.personPlus` case; `IconTests` covers resolution automatically. Sync `design/parity/native-components.json`. Run `pnpm ios:tokens:check` and `pnpm ios:guard` if icon tooling requires.

- [ ] **5.2 Models.** `AddFriendModel` (`@MainActor @Observable`, injected `FriendDirectoryProviding` + `FriendCommandsProviding`): states `input(fieldNotice:notice:isSearching:)` and `candidate(FriendCandidate, clientRequestId: String, isSending: Bool, isSent: Bool, notice: String?)`; blank search sets the field notice without a network call; found candidate mints `UUID().uuidString.lowercased()` once; send maps outcomes per the locked decisions (including the `incoming_request_exists` re-search pivot and replayed `accepted`). `FriendRequestsModel`: `loading / loaded(requests:busyIds:notice:) / failed(notice:)` + `selectedRequest`, single-flight respond, row removal on success, `onLastRequestHandled` callback. Both take closures for cross-cutting effects (`onReviewRequested`, `onDirectoryChanged`-style) rather than importing app types.

- [ ] **5.3 Views.** `AddFriendSheet`: `TopBar(title: "Add a friend")`-style header, `InputField(label: "Username", support: .hint("Usernames look like @sam_lee. Ask your friend for theirs."), submitLabel: .search, onSubmit:, autoFocus: true)`, `ActionButton("Search", variant: .primary)`; candidate card with initials `Avatar`, copy per the table, primary "Add friend"/"Review request", ghost "Search again"; notices via `Notice(tone: .notice)`. `FriendRequestsSheet`: internal `Page` enum (`list`, `review`) with the AccountSettings `goBack()` transition-table pattern; list rows ≥44pt with chevron; review page body "Wants to be friends. Accept when you’re ready — there’s no rush.", `ActionButton("Accept request", variant: .primary, isLoading:)`, `ActionButton("Decline", variant: .ghost)`.

- [ ] **5.4 Tests.** Model tests with `private actor` fakes scripting results/failures (search statuses, blank input no-call, idempotent resend uses the same `clientRequestId`, all three special failure codes, respond removes row, last-row callback). Themed + accessibility snapshots of both sheets in every state; record twice, **visually review every PNG against `docs/ui-ux-agent-guidelines.md`**, commit `__Snapshots__/`. `pnpm ios:test`.

- [ ] **5.5 Commit** `feat(ios): add Friends feature module with add-friend and request sheets`.

## Task 6 — iOS: app wiring, entry points, and directory refresh

**Goal:** Flag-gated inbox entry points, sheets presented from `FishRoot`, and a directory that refreshes on friend events.

**Files:** `App/project.yml` (add `Friends`, `FriendsData` to App dependencies), `App/Sources/FishAppConfiguration.swift` (+ tests), `App/Sources/FishAppModel.swift`, `App/Sources/FishRoot.swift`, `App/Sources/InboxView.swift`, `FishKit/Sources/UIComponents/Navigation/TopBar.swift` (+ `TopBarTests` snapshots), `FishKit/Sources/PersonalChat/Screens/ConversationListScreen.swift` (+ snapshots), `design/parity/native-components.json`.

- [ ] **6.1 Flag.** `FishAppConfiguration.friendsEnabled: Bool` from Info.plist key `FRIENDS_ENABLED` (string `"true"`; absent/placeholder → `false`), following `fromBundle`'s `value(_:)` handling (`FishAppConfiguration.swift:59-65`). Extend `FishAppConfigurationTests`.

- [ ] **6.2 TopBar second action.** Extend `TopBar` so the inbox can show two trailing actions — change `trailing: TopBarAction?` to also accept an array (keep the existing single-action initializer for source compatibility). Update `TopBarTests`, re-record its snapshots (visual review), and sync `design/parity/native-components.json`.

- [ ] **6.3 Model.** On `FishAppModel`: `isShowingAddFriend`, `isShowingFriendRequests`, `incomingRequestCount: Int`, `friendsAvailable: Bool` (flag && client role via the same signal behind `blockedPeopleState`'s hidden case). Triggers `showAddFriend()` / `showFriendRequests()` guard on **signed-in** (`session != nil && directory != nil`) — not `phase == .inbox` — so the iPad rail works mid-conversation. `attach()` starts a friend-events task (`FriendsLive.events`) that refetches `countIncomingRequests` on every event and calls `refreshDirectory()` on `.friendshipCreated`/`.requestAccepted`; the task is cancelled and count zeroed on sign-out alongside the existing generation rotation (`FishAppModel.swift:666`). Count also refetches on `attach()` and whenever the requests sheet dismisses.

- [ ] **6.4 Entry points.** `InboxView.swift:28-32`: prepend `TopBarAction(icon: .personPlus, accessibilityLabel: "Add a friend", action: model.showAddFriend)` when `friendsAvailable`. `ConversationListScreen`: optional `requestsRowCount`/`onOpenRequests` parameters rendering the quiet row above the list when count > 0 (singular/plural copy per the table), and optional `emptyStateAction` so the `EmptyState` becomes title "No conversations yet", message "Add a friend to start talking.", `actionLabel: "Add a friend"`, `isPrimaryAction: true` when `friendsAvailable` and no failure notice is showing. Flag off: byte-identical rendering. Re-record affected `PersonalChatTests` snapshots with visual review.

- [ ] **6.5 Sheets.** In `FishRoot.swift` after line 130: `.sheet(isPresented: $model.isShowingAddFriend)` presenting `AddFriendSheet` and `.sheet(isPresented: $model.isShowingFriendRequests)` presenting `FriendRequestsSheet`, both `.presentationDetents([.medium, .large])` + drag indicator (account-settings precedent). The add-friend "Review request" pivot closes the add sheet and opens the requests sheet at that request. Adapters constructed in `FishAppModel.attach()` beside the existing ones, from the same `ChatBackendConfiguration`.

- [ ] **6.6 Verify end to end** on the simulator against dev Supabase with the Edge `FRIENDS_ENABLED=true`: the same two-device matrix as Task 3.7 (search/send/accept/decline, conversation appears both sides without relaunch, coach sees nothing, flag-off build unchanged), plus iPad two-pane rail entry mid-conversation. `pnpm ios:test`, `pnpm ios:tokens:check`, `pnpm ios:guard`, `pnpm build`.

- [ ] **6.7 Commit** `feat(ios): wire friends entry points, sheets, and directory refresh`.

---

## File map

| Area | Planned ownership |
| --- | --- |
| `data/friends` / `FriendsData` | RPC reads, `friend-command` writes, `friends:user:{id}` events, DTO/wire mapping, calm error mapping. No UI. |
| `feature/friends` / `Friends` | Screens/sheets, view models, copy, screenshot + accessibility coverage. No Supabase import. |
| `feature/chat` / `PersonalChat` + App | Entry points, requests row, empty state, reachability gates, directory refresh hookup. No friends state machine. |
| `FishApplication`/`MainActivity` / `FishAppModel`/`FishRoot` | Composition, flag, role gating, sheet presentation, sign-out teardown. |
| `core/designsystem` / `DesignSystem`+`UIComponents` | `PersonAdd`/`personPlus` icon, iOS TopBar multi-action, parity registry sync. |
| Backend | **Nothing.** Deployed contract consumed as-is. |

## Verification matrix

| Risk | Automated proof | Manual/release proof |
| --- | --- | --- |
| Privacy collapse broken (leaking who blocked/declined) | wire tests: every non-mapped status → unavailable; copy identical across unavailable causes | search for a blocking user, a declined-cooldown user, a coach, a nonsense handle — identical UI |
| Duplicate sends | idempotency unit tests (same `clientRequestId` on retry; replayed `accepted` handled) | tap Add friend repeatedly on a flaky network; exactly one request server-side |
| New conversation never appears | event→refresh unit tests both platforms | two-device accept; inbox updates on both without restart |
| Decline pressure | none possible client-side (no sender broadcast) | sender's device shows no change after decline; re-search shows unavailable |
| Coach exposure | role-gate unit tests; RPC error path test | coach account: no entries, and a forced deep call returns the calm server error |
| Flag regression | flag-off unit/screenshot tests byte-identical | flag-off build smoke: no friends UI anywhere |
| List reachability (Android) | gate tests at sizes 0/1/2 × flag | sole-conversation client can reach the list and back |
| Calm-copy drift | string assertions against the copy table | screenshot review against `docs/ui-ux-agent-guidelines.md` |

## Security, privacy, and threat considerations

- Never log usernames, request ids, or profile ids in diagnostics on either platform (matches the blocked-people rule in the account-settings work).
- The `unavailable` collapse is load-bearing anti-harassment design: do not add retry hints, "did you mean", or distinct error copy that would let a sender distinguish blocked/declined/nonexistent.
- Realtime topics are private and RLS-scoped; treat payloads as hints only and never render names or state from a broadcast payload.
- All friend mutations go through `friend-command` (server-side rate limiting, crossed-request handling, cooldowns); clients never write friend tables or call the mutation RPCs directly.
- The flag fails closed at three layers (client build flag, Edge env, RPC role checks); mobile must not add a client-side bypass such as calling mutation RPCs directly when the function 503s.
- Respond/send are single-flight per request/candidate to avoid double-accept races; the server's row locks make duplicates harmless, but the UI must not show two spinners.

## Rollout and rollback

- Land each task as an independently green commit; both apps ship with the flag **off** — zero user-visible change until the product decides to enable friends (a coach-validated rollout decision, consistent with coach-first; the web carries the same gate).
- Enabling for verification requires the target project's Edge environment `FRIENDS_ENABLED=true` plus the platform build flag; document both in the READMEs.
- Rollback = flip the build flag off; no data, schema, or server rollback exists to perform. Realtime subscription code is inert when the flag is off (never started).

## Assumptions, tradeoffs, and risks

- Assumption: the client-role signal already used for Blocked people is available at the friends entry points on both platforms (verified as a pattern; exact property located in Tasks 3.2/6.3).
- Assumption: supabase-kt supports the private-broadcast subscribe used by presence for a second topic without SDK changes (template exists at `SupabasePresenceRemoteDataSource.kt:94-104`).
- Tradeoff: no push notification for friend requests — requests surface on next app open or live via realtime. Accepted deliberately; the backend has no friend push and inventing one is server work this plan excludes.
- Tradeoff: iOS shows initials avatars where Android shows images; consistent with each platform's current conventions, revisit only with an iOS-wide avatar feature.
- Risk: Android's reachability relaxation (Task 3.4) touches first-run navigation; the flag confines any regression to flag-on builds, and gate tests cover sizes 0/1/2.
- Risk: `TopBar` API change (Task 6.2) ripples through snapshot baselines; re-record with visual review, and keep the single-action initializer so non-inbox call sites are untouched.

## Explicit deferrals

- Friends list management on mobile (list, unfriend, cancel outgoing request) — web owns these; mobile chat already has Block.
- Friend notifications center / `mark-notifications-read` / `list_friend_notifications` on mobile.
- Push notifications for friend events (no backend support).
- Requests pagination UI (first 50 shown; the RPC caps at 100).
- Remote avatar images on iOS.
- Contact import, QR codes, suggestions, or any discovery mechanism — permanently out per product rules.
- Changing the flag-off Android zero-conversation copy (today's "Go back and open an assigned conversation" oddity) — separate copy fix if wanted.

## Release and manual checks

- Two client accounts on the target project (Edge `FRIENDS_ENABLED=true`): full matrix — send, accept, decline, crossed requests (both send simultaneously → `incoming_request_exists` pivot), rate limit copy, re-search after decline (cooldown unavailable), block interplay (blocked pair searches unavailable both directions).
- Conversation appears on both devices post-accept without relaunch; presence/typing/messages work in it immediately.
- Coach account: no entry points, no requests row, empty state unchanged.
- Flag-off builds of both apps: behavior identical to today.
- Accessibility: VoiceOver/TalkBack labels on the new icon and rows, 44pt/48dp targets, 200% font, RTL, light/dark on every new screen.
- Physical-device pass rides the existing outstanding release-verification track alongside the other implemented features.

## Definition of done

- A mobile client can add a friend by exact username, review and accept an incoming request, and see the new conversation in their inbox without restarting — on both platforms, with the flag on.
- All entry points are flag- and role-gated; flag-off builds are unchanged; coaches never see friends UI.
- Every status, error, and copy string matches the web/server contract tables above; no new server-owned copy was authored client-side.
- The `friends:user:{id}` subscription refreshes count and directory on both platforms and is torn down on sign-out.
- All platform verification commands pass (`pnpm android:test/screenshots/instrumented/check`, `pnpm ios:test`, `pnpm ios:tokens:check`, `pnpm ios:guard`, `pnpm build`), new snapshots are visually reviewed, the parity registry is synced, and the two-device manual matrix is recorded.
