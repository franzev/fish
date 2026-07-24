# Phase 13: Calm gallery browsing - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 31 new/modified files or file groups
**Analogs found:** 30 / 31

## Scope Guard

This is a native, per-conversation direct-chat destination. It must not create a web surface, global gallery, dashboard, learning surface, new sending pipeline, or provider-facing view API. Phase 13 exposes a provider-neutral `SelectItem(itemId)` seam but must not ship an enabled no-op selection control before Phase 14.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/core/src/shared-content/types.ts` | model | transform | same file: `SharedContentItem`, `SharedContentState` | exact |
| `packages/core/src/shared-content/gallery.ts` | utility | transform | `classification.ts`, `ordering.ts` | role + flow |
| `packages/core/src/shared-content/index.ts` | config/barrel | transform | same barrel | exact |
| `packages/core/src/shared-content/fixtures/shared-content-vectors.json` | test fixture | transform | existing shared-content vectors | exact |
| `packages/core/src/shared-content/gallery.test.ts` | test | transform | `shared-content.test.ts` | exact |
| `supabase/migrations/0063_*_shared_content_duration.sql` | migration | CRUD/request-response | `0061_shared_content_contract.sql` | role + flow |
| `packages/supabase/src/database.generated.ts` | generated model | request-response | current shared-content RPC row types | exact |
| Android `SharedContentDataItem` / DTO decoder files | model | request-response | `SupabaseDtos.kt`, `SupabaseChatRemoteDataSource.kt` | exact |
| Android Room entity/cache/schema v10 files | model/migration | CRUD | `ChatEntities.kt`, `ChatDatabase.kt`, schema `9.json` | exact |
| Android `SharedContentStore.kt` | store | event-driven/request-response | same Phase 12 store | exact |
| Android `SharedContentGalleryPresenter.kt` | provider/presenter | transform/event-driven | `SharedContentStore.kt` plus core reducer projection | role-match |
| Android `SharedContentGalleryScreen.kt` | component | event-driven | `MessageSearchScreen.kt` | role + flow |
| Android `SharedContentGalleryComponents.kt` | component | transform/event-driven | `ChatComponents.kt`, design-system feedback components | role-match |
| Android `ChatComponents.kt` (`ChatTopBar`) | component | event-driven | existing trailing action slots | exact |
| Android `ParticipantDetailsSheet.kt` | component | event-driven | existing full-width safety/action rows | exact |
| Android `ChatRoute.kt` | route | event-driven | current message-search route-local presentation | role-match |
| Android `ChatDataModule.kt` / live composition | provider | request-response | existing repository dependency composition | role-match |
| Android design-system icon registry | config | transform | existing `FishIcons` semantic aliases | exact |
| Android localized strings | config | transform | `feature/chat/src/main/res/values/strings.xml` | exact |
| Android presenter/store/parity tests | test | transform/event-driven | `SharedContentStoreTest.kt`, `SharedContentParityTest.kt` | exact |
| Android navigation test | test | event-driven | existing Compose route tests | role-match |
| Android `ChatScreenshotTest.kt` | test | transform | existing message-search/attachment matrices | exact |
| Android Room migration/repository tests | test | CRUD/request-response | `ChatDatabaseMigrationTest.kt`, shared-content repository tests | exact |
| iOS `SharedContentState.swift` | model | transform | same canonical Swift mirror | exact |
| iOS provider/cache/Core Data files | model/service | CRUD/request-response | current `SharedContentProviding`, caching, repository, Core Data adapter | exact |
| iOS `SharedContentStore.swift` | store | event-driven/request-response | same Phase 12 store | exact |
| iOS `SharedContentGalleryModel.swift` | provider/model | transform/event-driven | `SharedContentStore.swift` | role-match |
| iOS `SharedContentGallery*.swift` | component | transform/event-driven | `MessageSearchScreen.swift`, UIComponents feedback primitives | role + flow |
| iOS `PersonalChatTopBar.swift`, `PersonalChatScreen.swift` | component | event-driven | current optional trailing-content pattern | exact |
| iOS conversation-details component | component | event-driven | Android details behavior; iOS account/settings sheet composition | partial |
| iOS `FishApp.swift` | route/provider | event-driven | current `FishRoot` / `ConversationView` composition | role-match |
| iOS gallery/navigation/snapshot/cache tests | test | transform/event-driven/CRUD | `SharedContentStoreTests.swift`, `MessageSearchScreenTests.swift`, snapshot support, `CoreDataSharedContentCacheTests.swift` | exact |

## Pattern Assignments

### Shared contract, projection, fixtures, and tests

**Files:** `types.ts`, new `gallery.ts`, `index.ts`, fixture JSON, `gallery.test.ts`, Swift/Kotlin contract mirrors.

**Primary analog:** `packages/core/src/shared-content/classification.ts`

**Imports and pure-function pattern** (`classification.ts:1-4,51-58`):

```typescript
import type {
  SharedContentClassification,
  SharedContentSourceDescriptor,
} from "./types.ts";

export function classifySharedContentSource(
  source: SharedContentSourceDescriptor,
  conversationId?: string,
): SharedContentClassification | null {
```

Copy these rules:

- Keep `gallery.ts` pure and provider-neutral. Import contracts with `import type` and use no Supabase/native dependency.
- Canonical order is `media`, `files`, `links`, `voice`; derive populated categories from accepted display-eligible `SharedContentItem`s, never from an optimistic category count.
- Retain the current selection only while it remains populated; otherwise fall back to the first populated canonical category, or `null`.
- Preserve server item order. Do not locale-sort.
- Add nullable non-negative `durationMs` to the safe item projection. Reject negative/non-integral wire values; absent legacy values remain `null`/`nil`.
- `index.ts` should use `export * from "./gallery.ts"` because the barrel exposes the complete public surface.

**Existing item/state shape to extend** (`types.ts:264-278,292-327`):

```typescript
export interface SharedContentItem {
  itemId: string;
  conversationId: string;
  sourceMessageId: string;
  senderId: string;
  sourceCreatedAt: string;
  sourceRank: number;
  category: SharedContentCategory;
  kind: SharedContentKind;
  attachment?: SharedContentAttachment;
  gif?: SharedContentGif;
  stickerId?: string;
  link?: SharedContentLink;
  capabilities: SharedContentCapabilities;
}

export interface SharedContentPage {
  items: SharedContentItem[];
  hasMore: boolean;
  nextCursor: SharedContentCursor | null;
}
```

Tests should follow `shared-content.test.ts`: load the canonical JSON fixture once, assert exact cross-platform results, and add vectors for zero/one/four categories, selected retention/removal fallback, realtime category addition, global append with no selected-category item, legacy duration, and earlier failure retaining items.

### Supabase projection, strict decoders, and disposable caches

**Files:** forward SQL migration, generated database types, Android DTO/remote mapping/Room files, iOS provider/repository/Core Data files, migration/cache tests.

**Analog symbols:**

- SQL: `supabase/migrations/0061_shared_content_contract.sql` shared-content listing RPC and accepted server-order projection.
- Android: `SharedContentRowDto` (`SupabaseDtos.kt:70`), `SharedContentRowDto.toSharedContentItem()` (`SupabaseChatRemoteDataSource.kt:1104`), `SharedContentCacheItemEntity` (`ChatEntities.kt:223`), `SharedContentDataItem.toStoredSharedContentItem()` (`DefaultChatRepository.kt:1148`), `ChatDatabase.kt`, schema `9.json`.
- iOS: `SharedContentRowWire` (`SupabaseSharedContentRepository.swift:432`), `SharedContentDataItem` (`SharedContentProviding.swift:25`), `StoredSharedContentItem` (`SharedContentCaching.swift:59`), `CoreDataSharedContentCache.storedItem` (`CoreDataSharedContentCache.swift:633`).

Copy the existing end-to-end field flow rather than adding duration only in a view model:

```text
RPC row -> strict wire DTO -> provider-neutral data item -> accepted item
        -> disposable owner/conversation cache -> gallery display model
```

The migration is additive and nullable. Preserve RLS, 40+1 cursor semantics, tombstones, and accepted server order. Do not read/decode full audio or change upload/sending to manufacture duration. Add Room 9→10 coverage and Core Data legacy-row coverage; legacy rows render “Duration unavailable.”

### Android store and gallery presenter

**Files:** existing `SharedContentStore.kt`, new `SharedContentGalleryPresenter.kt`, presenter/store tests.

**Primary analog:** `apps/android/feature/chat/.../sharedcontent/SharedContentStore.kt`

**Boundary and dependency pattern** (`SharedContentStore.kt:49-68,82-111`):

```kotlin
interface SharedContentRecoveryRepository {
    fun observeSharedContentSnapshot(conversationId: String): Flow<StoredSharedContentSnapshot?>
    suspend fun refreshSharedContent(
        token: SharedContentRequestToken,
        category: String? = null,
    ): ChatResult<SharedContentDataPage>
}

class SharedContentStore(
    private val repository: SharedContentRecoveryRepository,
    private val scope: CoroutineScope,
    visibilityPort: SharedContentVisibilityPort? = null,
)
```

**Identity and lifecycle pattern** (`SharedContentStore.kt:143-185,248-255`):

```kotlin
fun bind(ownerIdentityId: String?, conversationId: String) {
    synchronized(lock) {
        closeJobsLocked()
        identityGeneration += 1
        boundOwnerId = ownerIdentityId?.takeIf(String::isNotBlank)
        boundConversationId = conversationId.takeIf(String::isNotBlank)
        // reset prior-owner presentation and observe only the current binding
    }
}

fun open() = trigger(SharedContentRecoveryTrigger.GalleryOpen)

fun close() {
    synchronized(lock) {
        closed = true
        closeJobsLocked()
    }
}
```

Extend this store to publish accepted safe items and a distinct global earlier-page state. The presenter owns populated categories, selected category, per-category scroll anchors, localized display labels, and item intents. It must not own network calls, provider rows, URLs/paths, or auth.

Use one global `loadEarlier` request guarded against duplicate taps. Preserve accepted visible items and the selected category on busy/failure. A page that adds no item to the selected category is still a successful global append.

### Android chrome, route, and gallery components

**Files:** `ChatComponents.kt`, `ParticipantDetailsSheet.kt`, `ChatRoute.kt`, gallery screen/components, strings/icons, navigation and screenshot tests.

**Primary analog:** `ChatRoute.kt` message-search destination seam (`ChatRoute.kt:110-153,186-199`).

```kotlin
val messageSearchState by messageSearchViewModel.uiState.collectAsStateWithLifecycle()
LaunchedEffect(selectedConversationId) {
    messageSearchViewModel.close()
}

if (messageSearchState.visible && currentConversation != null) {
    MessageSearchScreen(
        state = messageSearchState,
        onClose = messageSearchViewModel::close,
    )
} else {
    ChatAdaptiveLayout(/* conversation */)
}
```

Copy lifecycle-aware collection and typed callbacks, but represent gallery navigation with explicit origin (`Header` or `Details`) so Back restores the real source. `open()` belongs in a route-entry effect keyed by owner/conversation/entry identity, never in recomposition. Close/revoke on pop or identity change.

For `ChatTopBar`, preserve the participant identity target and add one quiet `FishIconButton` labeled exactly “Shared content” in the locked action order. In `ParticipantDetailsSheet`, add one full-width quiet row below identity and before safety actions. Use `FishIcons.Gallery`, an alias over the bundled Tabler photo outline; do not use `AddMedia`.

Gallery UI copies:

- `MessageSearchScreen.kt` for a full-screen `FishTopBar` destination and calm state switching.
- `FishNotice`, `FishEmptyState`, and `FishSkeleton` for Phase 12 truth, empty/unavailable, and loading.
- Material text tabs, `LazyVerticalGrid` with stable `itemId` keys for Media, and `LazyColumn` for Files/Links/Voice.
- Existing semantic `FishTheme` spacing/type/color tokens only.

Do not attach an enabled item click until Phase 14. No menus, swipe/long-press, autoplay, per-item retry, auto-pagination, or primary CTA.

### iOS store and gallery model

**Files:** existing `SharedContentStore.swift`, new `SharedContentGalleryModel.swift`, model/store tests.

**Primary analog:** `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentStore.swift`

**Observation and dependency pattern** (`SharedContentStore.swift:40-56,78-106`):

```swift
@MainActor @Observable
public final class SharedContentStore {
    public private(set) var presentation: SharedContentPresentationContract
    public private(set) var cachedItemKeys: [String] = []

    private let provider: any SharedContentProviding
    private let thumbnailStore: SharedContentThumbnailStore?
}
```

**Identity/lifecycle pattern** (`SharedContentStore.swift:108-169,238-252`):

```swift
public func bind(ownerIdentityId: String, conversationId: String) async {
    guard !ownerIdentityId.isEmpty, !conversationId.isEmpty else {
        close()
        return
    }
    identityGeneration = max(identityGeneration + 1, 1)
    // reset, then accept snapshots only for this owner/conversation
}

public func open() {
    requestRecovery(.galleryOpen)
}
```

Keep the model `@MainActor @Observable`, expose `public private(set)` state, and inject provider-neutral dependencies. Mirror Android’s global earlier-page state and projection exactly through shared fixtures. Keep `SharedContentIdentityCoordinator` revocation authoritative.

### iOS chrome, navigation, details, and gallery views

**Files:** `PersonalChatTopBar.swift`, `PersonalChatScreen.swift`, new details/gallery views, `FishApp.swift`, semantic icon alias, navigation/snapshot tests.

**Primary analog:** `PersonalChatTopBar.swift:15-27,29-63`.

```swift
public init(
    participantName: String,
    presence: PresenceUiModel?,
    onBack: (() -> Void)? = nil,
    trailingContent: AnyView? = nil,
    accountContent: AnyView? = nil
) { /* stored callbacks/content */ }

TopBar(onBack: onBack) {
    HStack(spacing: Spacing.sm) {
        // participant identity
        if trailingContent != nil || accountContent != nil {
            HStack(spacing: Spacing.xs) {
                if let trailingContent { trailingContent }
                if let accountContent { accountContent }
            }
        }
    }
}
```

Use the existing optional trailing-content seam for a quiet `IconButton` with exact accessibility label “Shared content.” Make the identity cluster a separate “Conversation details” button. Add a native details sheet with the full-width Shared content row before safety actions.

In `FishApp.swift`, the current root switches to `ConversationView(model:)` at lines 171-185. Introduce an owner/conversation-scoped navigation stack/path within conversation composition, with a hashable destination carrying origin. Header-origin Back returns to conversation; details-origin Back returns to details, then conversation. Construct one live store for the active verified owner/conversation, register it with the identity coordinator, call `open()` once per actual route entry, and close/revoke it on pop/identity transition.

Gallery views should copy `MessageSearchScreen.swift` for `TopBar` destination composition and use `Notice`, `EmptyState`, `SkeletonBar`, `LazyVGrid`, and `LazyVStack`. Use `Spacing`, `Palette`, typography, and `Icon.photo` semantic aliases only. The iOS tabs are a feature-owned plain-text row, not a segmented capsule.

## Shared Patterns

### Authentication and identity

**Sources:** Android `SharedContentStore.bind` (`143-183`); iOS `SharedContentStore.bind` / `revokeIdentityGeneration` (`108-165`).

Apply to every store, repository acceptance, cache, and route composition. State is keyed by verified owner identity plus conversation ID and generation. Clear prior-owner items before observing/fetching. No UI event bypasses owner/conversation/generation/request/cursor gates.

### Recovery and honest state

**Sources:** existing native Phase 12 stores and `SharedContentPresentationContract`.

Keep cached items visible at normal opacity while refreshing. Authoritative empty is legal only after a successful zero-item response. Offline without eligible cache is unavailable. Manual retry appears only when the Phase 12 contract enables it. Earlier-page failure is separate from gallery recovery and retains content.

### Error handling

Repository/provider failures remain typed and provider-neutral. Store coroutine/task cancellation is rethrown or allowed to terminate; disposable cache observation may fail without replacing authoritative recovery. UI maps truth to the approved calm copy and never renders raw provider errors, paths, URLs, MIME types, status codes, or retry counts.

### Validation and formatting

- Strictly validate nullable `durationMs` as a non-negative integer at the wire boundary.
- Use platform locale-aware byte, friendly file-type, hostname-direction, and duration formatting.
- Use safe original filename/title/hostname only; never expose raw URLs.
- Preserve server order and stable item IDs.

### Accessibility and design system

Reuse native design-system controls and semantic tokens. Android targets are at least 48dp; iOS targets at least 44pt. Tabs expose selected state; one parent exposes loading/busy state; decorative icons are hidden from accessibility. Large text grows rows and reduces Media columns; RTL mirrors chrome while preserving server order; reduced motion makes skeletons static.

### Tests

Use the shared fixture as the cross-platform oracle. Extend existing Kotlin/Swift parity harnesses rather than duplicating expected logic. Snapshot the same semantic matrix on both platforms: light, dark, RTL, accessibility text, loading, one/four categories, cached, stale, authoritative empty, offline unavailable, earlier busy/failure, and every item kind.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| iOS conversation-details component | component | event-driven | No current conversation-details sheet exists. Copy the repository’s native sheet/token/action-row conventions, but use the locked Phase 13 structure and explicit details-origin navigation contract. |

## Planner Guardrails

- Build contracts/fixtures and nullable duration flow before either gallery UI.
- Do not build a second repository or category-specific pagination.
- Do not infer navigation origin from sheet visibility.
- Do not persist selected category across launches.
- Do not blank accepted content during refresh or earlier-page work.
- Do not touch web React files; native component folder rules apply only to React and are not relevant here.
- Phase 13 has no primary CTA and no enabled preview/open action.

## Metadata

**Analog search scope:** `packages/core/src/shared-content`, `packages/supabase`, `supabase/migrations`, `apps/android/{feature/chat,data/chat,core/designsystem}`, `apps/ios/{App,FishKit}`

**Strong analog families read:** 5 — shared contract/classification; Android store/route; iOS store/top-bar/root composition; native test harnesses; Supabase/cache projection chain.

**Pattern extraction date:** 2026-07-24
