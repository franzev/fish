# Phase 13: Calm gallery browsing - Research

**Researched:** 2026-07-24
**Domain:** Native per-conversation shared-content navigation, projection, and calm gallery presentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Entry and navigation
- Add one dedicated 44px gallery control to the conversation header with the accessible label “Shared content.” Keep the participant identity path to conversation details intact.
- Add one full-width “Shared content” row below participant identity and before safety actions in conversation details. Do not add a count, badge, or competing primary treatment.
- Present Shared content as a full-screen native destination pushed onto the existing navigation stack, not as a sheet or embedded details section.
- Preserve the entry path through ordinary native navigation: header → gallery → conversation; details → gallery → details → conversation.

### Categories and gallery layout
- Use plain text tabs in the fixed order Media, Files, Links, Voice. Render only populated categories and remove the category control entirely when only one category is populated.
- On first open, select the first populated category in fixed order. Preserve the selected category while the gallery remains on the navigation stack; do not persist this choice across app launches.
- Use a compact thumbnail grid for Media and single-column rows for Files, Links, and Voice. Do not force every content type into one generic geometry.
- Keep the browsing surface scan-focused: Media is primarily visual; Files show filename plus type/size; Links show title and hostname; Voice shows duration. Sender and localized date context belongs to the Phase 14 preview.

### State and interaction behavior
- On first open without eligible cache, show structure-matched skeletons. During refresh, keep accepted cached items visible beneath the single gallery-level cached/stale notice defined by Phase 12; do not blank, dim, or badge every item.
- Show “No shared content yet” only after an authoritative successful empty response. Offline with no eligible cache is unavailable, not empty. Failure copy remains calm and shows the existing single manual retry only after the bounded recovery cycle permits it.
- Expose older pages through one quiet “Show earlier content” secondary control at the retained-history boundary. Preserve current category and scroll position while loading; a failed older-page request retains visible content and offers one calm retry.
- Each item exposes one selection intent reserved for Phase 14 preview. Phase 13 adds no inline action menu, long-press menu, swipe action, multi-select mode, autoplay, or destructive/export affordance.
- Keep controls at least 44×44px, expose category selection and loading state programmatically, use descriptive item labels, preserve visible focus, support large text and RTL reflow, and avoid motion beyond native navigation continuity.

### the agent's Discretion
- Choose the exact native gallery icon, tab implementation, adaptive Media grid column calculation, skeleton count, and category-specific row composition while reusing each platform’s design system and preserving the locked behaviors above.
- Choose the state-holder/view-model split and navigation route types, provided provider details stay inside existing data boundaries and both platforms expose equivalent presentation behavior.
- Choose concise platform-localized copy variants when required by grammar or OS conventions, while keeping the terms “Shared content,” “Media,” “Files,” “Links,” and “Voice” consistent.

### Deferred Ideas (OUT OF SCOPE)
- Preview/open behavior, sender/date context, native share/save/download, source-message navigation, return restoration from preview, and sender-only deletion remain Phase 14.
- Cross-platform release parity, TalkBack/VoiceOver completion, exhaustive large-text/RTL/reduced-motion proof, performance budgets, hosted evidence, and scope gates remain Phase 15.
- Search, sorting, filters, favorites, albums, bulk actions, global galleries, and new sending pipelines remain outside v1.3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | Clients and coaches can open Shared content from both the conversation header and conversation details on Android and iOS. | Use an explicit origin-bearing native route, add the two entry seams on each platform, add the missing iOS details sheet, and test both return stacks. |
| DISC-02 | The gallery shows populated-only categories in the fixed order Media, Files, Links, Voice; the category control is hidden when only one category has content. | Build the gallery projection from accepted display-safe items, use one canonical category-order function shared through parity fixtures, and test zero/one/four-category and category-removal transitions. |
</phase_requirements>

## Summary

Phase 13 is primarily an integration and presentation phase, not a new data-fetching system. Phase 11 already established the authoritative Supabase projection and 40+1 cursor semantics, while Phase 12 established identity-scoped caches, recovery truth, bounded delivery planning, and native `SharedContentStore` implementations. The missing layer is a provider-neutral gallery session model that exposes accepted display-safe items, populated categories, per-category scroll state, one global older-page command, and the existing presentation contract to native views. [VERIFIED: codebase inspection of `packages/core/src/shared-content`, Android `SharedContentStore.kt`, iOS `SharedContentStore.swift`, and Phase 12 artifacts]

Implementation should begin by extending the shared projection with nullable, non-negative `durationMs`, because Voice rows are locked to show trusted duration while the current TypeScript/Kotlin/Swift projection, Supabase RPC, Room schema, and Core Data model have no duration field. The field must flow through one forward Supabase migration, strict wire decoders, both local caches, parity fixtures, and display models. Existing voice records may remain absent and render `Duration unavailable`; Phase 13 must not add media decoding, full-audio fetches, or a new sending pipeline to manufacture duration. [VERIFIED: codebase inspection of `supabase/migrations/0055_chat_voice_messages.sql`, `0061_shared_content_contract.sql`, native data DTOs/caches, and approved `13-UI-SPEC.md`]

The highest-risk implementation work is production composition. Neither Phase 12 store is currently created for the live conversation screen; Android’s `ChatDataModule.Dependencies` does not expose the thumbnail/cache composition needed by the feature, while iOS constructs cache and thumbnail stores as initializer locals and its identity coordinator holds only an optional weak store. The plan must create one gallery store per active owner/conversation, bind only after verified identity, call `open()` exactly once per route entry, connect lifecycle/connectivity/realtime signals, and revoke it before identity transition. [VERIFIED: codebase inspection of `ChatDataModule.kt`, `MainActivity.kt`, `FishApp.swift`, and `SharedContentIdentityCoordinator.swift`]

**Primary recommendation:** Implement a fixture-driven, provider-neutral gallery session/presenter first; then wire the existing Phase 12 data/recovery stack into explicit Android and iOS navigation routes before building the category-specific views.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Header/details entry and origin-preserving back behavior | Browser / Client (native UI) | — | Compose and SwiftUI own route state, focus restoration, native Back, and details-sheet presentation. [VERIFIED: codebase inspection; CITED: https://developer.android.com/guide/navigation/backstack; CITED: https://developer.apple.com/documentation/swiftui/navigationstack] |
| Display-safe gallery projection and session state | Browser / Client (native feature) | Shared product contracts | Native feature stores own selected category and scroll state; canonical kinds/order/acceptance remain cross-platform contracts. [VERIFIED: approved `13-UI-SPEC.md` and existing shared-content fixtures] |
| Authorized page/category reads and cursor acceptance | API / Backend | Native data adapters | Supabase RPC/RLS is authoritative; repositories enforce owner/conversation/generation/request/cursor gates before cache/UI acceptance. [VERIFIED: `0061_shared_content_contract.sql`, `DefaultChatRepository.kt`, `SupabaseSharedContentRepository.swift`] |
| Metadata and thumbnail persistence | Database / Storage | Native data adapters | Room/Core Data and owner-scoped no-backup thumbnail stores hold disposable accepted cache data; views must not see entities or paths. [VERIFIED: native shared-content cache and thumbnail-store implementations] |
| Media thumbnail delivery | Native data adapters | Native feature visibility reporting | The UI reports visible plus one-screen lookahead IDs; existing adapters authorize and stage bounded thumbnail bytes, promoting only after display confirmation. [VERIFIED: Android/iOS Phase 12 delivery planners and thumbnail stores] |
| Voice duration authority | API / Backend | Database / Storage | Trusted nullable duration belongs in the attachment/shared-content projection and then flows through caches; views only format the safe integer. [VERIFIED: approved `13-UI-SPEC.md`; current schema has no duration field] |

## Project Constraints (from AGENTS.md)

- Use the pnpm workspace and run `pnpm build` before committing; do not use npm. [VERIFIED: `AGENTS.md` and root `package.json`]
- Native mobile remains direct-chat-only. Do not add a home/dashboard, learning, booking, community, marketplace, global-gallery, or other web-product surface. [VERIFIED: `AGENTS.md`]
- Remove choices: one primary action maximum, assigned rather than browsed experiences, calm non-scolding copy, and no punitive gamification. Phase 13 has no primary CTA. [VERIFIED: `AGENTS.md` and approved `13-UI-SPEC.md`]
- Preserve accessible targets: Android uses the existing 48dp touch target and iOS uses the existing 44pt target; use visible focus, large-text growth, RTL reflow, and reduced-motion behavior. [VERIFIED: `AGENTS.md`, design tokens, and approved `13-UI-SPEC.md`]
- Reuse existing native design-system components and generated semantic tokens; add only semantic aliases over bundled icons. Do not use raw color/spacing values or phase-local SVGs. [VERIFIED: `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, and approved `13-UI-SPEC.md`]
- Keep product contracts in `packages/core`, provider/persistence details in Android `:data:chat` and iOS `ChatData`, and sensitive writes behind Supabase. No Express/Node API service. [VERIFIED: `AGENTS.md`]
- Do not add a learning feature without manual coach validation. This phase is direct-chat retrieval, not a learning feature. [VERIFIED: `AGENTS.md` and Phase 13 boundary]
- Web React component-folder/barrel rules remain mandatory if web files are touched, but this native-only phase should not touch web components. [VERIFIED: `AGENTS.md` and phase boundary]

## Standard Stack

Phase 13 needs no new external dependency. Use the versions already pinned in the repository; package installation and a Package Legitimacy Audit are therefore not applicable. [VERIFIED: Android version catalog, Swift package manifest/resolution, and native feature build files]

### Core

| Library / framework | Verified version | Purpose | Why Standard Here |
|---------------------|------------------|---------|-------------------|
| Kotlin / Compose compiler | 2.3.10 | Android language and Compose compilation | Already pinned for every Android feature. [VERIFIED: `apps/android/gradle/libs.versions.toml`] |
| Jetpack Compose BOM | 2026.06.01 | Compose UI/foundation alignment | `:feature:chat` already imports Compose foundation/UI through this BOM. [VERIFIED: Android version catalog and `feature/chat/build.gradle.kts`] |
| Material 3 | 1.4.0 | Android tabs and native interaction semantics | Existing FISH wrappers and Material text tabs cover the approved UI contract. [VERIFIED: Android version catalog and approved `13-UI-SPEC.md`] |
| Android Lifecycle | 2.11.0 | Route/store lifecycle collection | Existing activity/feature stack already uses lifecycle-aware Compose state. [VERIFIED: Android version catalog and feature build file] |
| Swift / SwiftUI | Swift language mode 6, iOS 17 minimum | iOS navigation, lazy grids/lists, observation, accessibility | Existing app and `PersonalChat` are SwiftUI; `NavigationStack` and lazy containers are native. [VERIFIED: `Package.swift`; CITED: https://developer.apple.com/documentation/swiftui/navigationstack] |
| TypeScript | 5.7.3 | Canonical shared-content state and fixtures | `@fish/core` already owns cross-platform category/order/state fixtures. [VERIFIED: `packages/core/package.json`] |
| Supabase | Android 3.6.0; Swift 2.52.0 | Authorized shared-content RPC and RLS | Existing repositories and strict decoders already use these clients. [VERIFIED: Android version catalog and `Package.resolved`] |
| Room | 2.8.4 | Android identity/conversation-scoped metadata cache | Existing Phase 12 cache is Room schema version 9 and requires a forward migration for duration. [VERIFIED: Android version catalog and `ChatDatabase.kt`] |
| Core Data | Platform framework | iOS identity/conversation-scoped metadata cache | Existing Phase 12 iOS cache already owns the disposable shared-content schema. [VERIFIED: `CoreDataSharedContentCache.swift`] |

### Supporting

| Library / component | Verified version | Purpose | When to Use |
|---------------------|------------------|---------|-------------|
| Coil | 3.5.0 | Android image decode/rendering | Reuse only behind the existing authorized thumbnail path; never pass raw provider paths into gallery views. [VERIFIED: Android version catalog and `feature/chat/build.gradle.kts`] |
| Swift Snapshot Testing | 1.19.3 resolved | iOS state/appearance snapshots | Extend `PersonalChatTests` with the UI-SPEC parity matrix. [VERIFIED: `Package.swift` and `Package.resolved`] |
| Android Compose screenshot plugin | 0.0.1-alpha15 | Android reference image validation | Extend the existing `ChatScreenshotTest` matrix. [VERIFIED: Android version catalog and root scripts] |
| Native formatters | Platform | Friendly type/size, hostname direction, duration digits | Use Android platform formatters and Swift `FormatStyle`; do not hand-format localized values. [CITED: https://developer.apple.com/documentation/foundation/formatstyle; CITED: https://developer.apple.com/documentation/foundation/bytecountformatstyle/format(_:)] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing Compose/SwiftUI navigation and lazy containers | Add a third-party navigation/gallery library | Rejected: adds choices/dependencies and bypasses established native stacks without solving a repository gap. [VERIFIED: approved UI contract requires native stack navigation and no external component package] |
| Existing Phase 12 store/repository/cache | Build a second gallery repository | Rejected: would duplicate identity, cursor, recovery, and cache truth and create conflicting authority. [VERIFIED: Phase 12 store/repository contracts] |
| Nullable trusted `durationMs` | Decode/download audio in the gallery | Rejected: violates bounded delivery/privacy rules and delays rendering; absent values have an approved fallback. [VERIFIED: approved `13-UI-SPEC.md`] |

**Installation:** None.

## Architecture Patterns

### System Architecture Diagram

```text
Conversation header ─────────────┐
                                ├─> SharedContentRoute(origin)
Conversation details sheet ─────┘       │
                                        ├─ bind verified owner + conversation
                                        ├─ open once per route entry
                                        v
                              Native Gallery Session/Presenter
                              ├─ accepted display-safe items
                              ├─ populated categories in canonical order
                              ├─ selected category + per-category scroll
                              ├─ Phase 12 presentation truth
                              └─ global earlier-page boundary
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 v                      v                      v
          Media lazy grid       File/Link/Voice lists    State/boundary UI
          visible+lookahead      localized metadata       retry/older intents
                 │                      │                      │
                 └────────────── intents only ─────────────────┘
                                        │
                                        v
                         Existing native SharedContentStore
                         ├─ owner/generation/request gates
                         ├─ recovery and manual retry
                         ├─ global cursor append
                         └─ visibility delivery planning
                                        │
                         provider-neutral repository port
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 v                                             v
        Room/Core Data + thumbnails                Supabase RPC + RLS
        disposable owner-scoped cache              authoritative ordered rows
```

This flow keeps route/session concerns in feature UI, identity and recovery in the existing store, and provider/storage details in data adapters. [VERIFIED: repository boundaries and approved `13-UI-SPEC.md`]

### Recommended Project Structure

```text
packages/core/src/shared-content/
├── types.ts                         # nullable durationMs + display contract
├── gallery.ts                       # pure canonical projection/selection helpers
├── gallery.test.ts                  # zero/one/four/removal/parity cases
└── fixtures/shared-content-vectors.json

apps/android/feature/chat/.../sharedcontent/
├── SharedContentStore.kt            # expose safe items + global older-page state
├── SharedContentGalleryPresenter.kt # session/category projection
├── SharedContentGalleryScreen.kt    # route-level screen
└── SharedContentGalleryComponents.kt# tabs, grid/list rows, state boundary

apps/ios/FishKit/Sources/PersonalChat/
├── ViewModels/SharedContentStore.swift
├── ViewModels/SharedContentGalleryModel.swift
└── Views/SharedContentGallery*.swift

apps/ios/App/Sources/FishApp.swift    # owner-scoped composition + route origin
supabase/migrations/0063_*.sql        # duration projection only
```

Kotlin/Swift file naming should follow the repository’s native convention; the React same-named-folder rule does not apply to native files. [VERIFIED: current native layout and `AGENTS.md`]

### Component Responsibilities

| Component | Owns | Must Not Own |
|-----------|------|--------------|
| `SharedContentGalleryPresenter/Model` | Safe row/tile labels, populated categories, first/fallback selection, per-category scroll anchors, older-page UI state | Supabase rows, Room/Core Data entities, URLs/paths, network calls |
| Existing `SharedContentStore` | Binding, accepted item snapshot, recovery, global pagination, manual retry, visibility delivery, revoke/close | Tabs, localized labels, navigation |
| Repository/data adapter | RPC decode, cursor acceptance, cache writes, duration validation, delivery authorization | Selected category or screen state |
| Route host | Explicit origin and native Back destination, focus restoration target, exactly-once open/close lifecycle | Category derivation or provider state |
| Gallery view | Render approved components/states and emit typed intents | Enabled no-op selection, inline actions, auto-pagination |

### Pattern 1: Pure accepted-item projection

**What:** Convert only accepted safe items into gallery items, group by canonical category order, and retain selection if it remains populated.

**When to use:** On cache observation, accepted refresh/realtime append, or accepted tombstone removal.

```typescript
// Source: repository shared-content contract + approved Phase 13 UI-SPEC
const ORDER = ["media", "files", "links", "voice"] as const;

export function projectGallery(
  items: readonly SharedContentItem[],
  selected: SharedContentCategory | null,
) {
  const byCategory = new Map(
    ORDER.map((category) => [
      category,
      items.filter((item) => item.category === category && isDisplayEligible(item)),
    ]),
  );
  const categories = ORDER.filter((category) => (byCategory.get(category)?.length ?? 0) > 0);
  return {
    categories,
    selected:
      selected && categories.includes(selected)
        ? selected
        : (categories[0] ?? null),
    byCategory,
  };
}
```

Do not render a tab solely because the category-summary RPC says a category exists; the approved UI contract requires a category to have an accepted display-eligible item. The category summary may help confirm authoritative zero, while additional categories appear as global older pages are accepted. [VERIFIED: approved `13-UI-SPEC.md` category and pagination contracts]

### Pattern 2: Explicit route origin

**What:** Route state carries `.header` or `.details`; Back pops to the actual origin instead of inferring it from sheet visibility.

**When to use:** Both header and conversation-details entry paths.

```swift
// Source: https://developer.apple.com/documentation/swiftui/navigationstack
enum ConversationDestination: Hashable {
    case details
    case sharedContent(origin: SharedContentOrigin)
}

NavigationStack(path: $path) {
    conversation
        .navigationDestination(for: ConversationDestination.self) { destination in
            switch destination {
            case .details:
                conversationDetails
            case .sharedContent(let origin):
                sharedContent(origin: origin)
            }
        }
}
```

Android may use an equivalent sealed route/state reducer within the existing single-activity Compose host; it need not add a navigation dependency if ordinary stack semantics and tests are preserved. [VERIFIED: `MainActivity.kt` currently composes `ChatRoute` without a `NavHost`; approved UI contract allows route type discretion]

### Pattern 3: One global pagination state machine

**What:** `loadEarlier()` uses the retained global conversation cursor, deduplicates concurrent taps, appends only accepted pages, and reports busy/failure separately from recovery truth.

**When to use:** The quiet retained-history boundary.

```kotlin
// Source: repository Phase 11/12 request-token and cursor acceptance contracts
fun showEarlier() {
    if (earlierState !is EarlierState.Ready) return
    earlierState = EarlierState.Loading
    scope.launch {
        when (val result = repository.loadEarlierSharedContent(currentAcceptedCursorToken())) {
            is ChatResult.Success -> acceptIfCurrent(result.value)
            else -> earlierState = EarlierState.Failed
        }
    }
}
```

The request remains global even when the accepted page adds no item to the selected category. Never issue category-specific pagination or mark one category complete independently. [VERIFIED: approved `13-UI-SPEC.md`]

### Pattern 4: Route-scoped state, minimal save state

**What:** Keep selected category and a scroll state per visible category in the gallery route/session. Save stable category/item anchors, not item lists or repository objects.

**When to use:** Category switching and child-route return while the gallery remains on stack.

Android’s official guidance recommends stable item keys and saving only minimal UI state; `rememberLazyListState`/`rememberSaveable` are appropriate for scroll anchors, while accepted items remain in the store. [CITED: https://developer.android.com/develop/ui/compose/lists; CITED: https://developer.android.com/develop/ui/compose/state-saving]

### Anti-Patterns to Avoid

- **Parallel category repositories/cursors:** Category-filtered requests can overwrite or fork the global accepted window. Keep one conversation cursor and derive categories from accepted items. [VERIFIED: current repository `replace` token semantics and approved global pagination contract]
- **Recovery from recomposition/body evaluation:** Repeated `open()` calls create duplicate recovery cycles. Trigger once from route-entry lifecycle and close/pop once. [VERIFIED: native store coalescing contract and approved UI contract]
- **Store-by-ID-only UI:** IDs plus presentation truth are insufficient to render safe labels, category membership, sizes, hostname, or duration. Extend the provider-neutral store projection rather than allowing views to reach into cache/provider entities. [VERIFIED: current native stores]
- **Persisting session preferences:** Selected tab, focus, and scroll are route-session state, not app preferences. [VERIFIED: locked decisions]
- **Enabled dead item taps:** Expose the future `SelectItem(itemId)` API, but render Phase 13 items non-actionable until Phase 14 supplies a destination. [VERIFIED: approved `13-UI-SPEC.md`]
- **Category choice chrome for one option:** Remove the entire tab slot when exactly one category is populated. [VERIFIED: DISC-02]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native navigation/back gestures | A custom screen stack or animated overlay | Compose host route stack and SwiftUI `NavigationStack` | Preserves native Back/system gestures and explicit origin. [CITED: https://developer.android.com/guide/navigation/backstack; CITED: https://developer.apple.com/documentation/swiftui/navigationstack] |
| Lazy/adaptive collections | Manual viewport math or nested scroll containers | `LazyVerticalGrid`/`LazyColumn` and `LazyVGrid`/`LazyVStack` | Native lazy containers support stable keys, accessibility, and adaptive layout. [CITED: https://developer.android.com/develop/ui/compose/lists] |
| Recovery/cache truth | A gallery-specific online/offline/error reducer | Existing Phase 12 `SharedContentStore.presentation` | The existing contract already distinguishes loading, cached, stale, authoritative empty, offline-no-cache, and manual retry. [VERIFIED: native stores and shared contract] |
| Cursor validation | A UI-owned page counter | Existing signed request token/cursor acceptance path | Owner, generation, request, replace/append, and cursor gates are security and correctness boundaries. [VERIFIED: repositories and shared contract] |
| File size/type and duration localization | String concatenation and ASCII-only digits | Platform formatters | Native formatters honor locale and accessibility expectations. [CITED: https://developer.apple.com/documentation/foundation/formatstyle] |
| Icons/buttons/notices/skeletons | Phase-local SVGs and custom controls | `FishIcons`, `DesignSystem.Icon`, existing FISH UI components | Keeps semantics, target size, focus, and visual hierarchy consistent. [VERIFIED: approved UI contract and native design systems] |
| Audio-duration discovery | Downloading/decoding full audio | Nullable trusted projection metadata plus fallback | Avoids privacy, bandwidth, codec, cancellation, and performance complexity. [VERIFIED: approved UI contract] |

**Key insight:** The complex work—authority, identity isolation, cache truth, cursor acceptance, and bounded delivery—already exists. Phase 13 should expose it safely to native presentation, not create a competing subsystem. [VERIFIED: Phase 11/12 implementation]

## Common Pitfalls

### Pitfall 1: Treating category availability and category pagination as the same thing

**What goes wrong:** A category-specific refresh replaces the global window, produces independent cursors, or shows an empty tab.

**Why it happens:** The repository supports an optional category parameter and a companion category-summary RPC, but Phase 13’s approved UI derives tabs from accepted display-eligible items and defines pagination as global.

**How to avoid:** Use the unfiltered accepted item window as the UI source. Render a category only after an eligible item is accepted, and append older pages with the one global cursor.

**Warning signs:** Separate cursor per tab, network call on tab change, selected tab changing after an older page with no selected-category item. [VERIFIED: repository API and approved UI contract]

### Pitfall 2: Adding duration only to the view model

**What goes wrong:** Fresh rows may show duration while cache restores lose it, strict decoders reject the RPC shape, or legacy rows fabricate `0:00`.

**Why it happens:** The projection is duplicated across SQL, generated TypeScript, Kotlin, Swift, Room, Core Data, and fixtures.

**How to avoid:** Add nullable non-negative `durationMs` end-to-end in one compatibility wave: database/RPC, generated types, strict key sets, data DTOs, caches/migrations, core contract, native adapters, fixtures, then UI formatting. Render `Duration unavailable` when absent.

**Warning signs:** Decoder key-count failures, Room schema mismatch, Core Data KVC crash, or voice tests with hard-coded zero. [VERIFIED: strict native decoders and current cache schemas]

### Pitfall 3: Losing identity revocation in production composition

**What goes wrong:** A signed-out or switched user can retain prior-owner item IDs, metadata, staged thumbnails, or an in-flight callback.

**Why it happens:** The Phase 12 stores exist mostly in tests and are not currently part of each live conversation composition; iOS’s coordinator weakly references an optional store.

**How to avoid:** Construct and register the active store with the identity coordinator, bind only a verified owner, revoke before auth transition, cancel lifecycle jobs, clear session projection, and prove zero prior-owner state.

**Warning signs:** Store creation in a view body, optional owner defaulting to the current conversation participant, or gallery state surviving sign-out. [VERIFIED: current app composition and identity coordinators]

### Pitfall 4: Navigation that cannot preserve the details origin

**What goes wrong:** Back from details-origin gallery jumps directly to the conversation, or dismisses/recreates the details sheet.

**Why it happens:** Android currently uses local booleans for chat overlays and iOS has no conversation details screen or `NavigationStack` around `ConversationView`.

**How to avoid:** Make origin explicit in route state and add automated sequences for header → gallery → conversation and details → gallery → details → conversation.

**Warning signs:** Origin inferred from a current boolean, one callback shared by both entry points, or a gallery presented as a sheet. [VERIFIED: current `ChatRoute`, `FishApp.swift`, and approved navigation contract]

### Pitfall 5: Scroll/focus jumps after reconcile or pagination

**What goes wrong:** Append, tombstone, or category switch forces the user to the top or moves focus unpredictably.

**Why it happens:** Index-based keys and a single scroll state cannot survive inserts/removals across four layouts.

**How to avoid:** Use stable item IDs, one scroll anchor per category, and explicit focus fallback order. Keep the older boundary target stable while busy/failing.

**Warning signs:** Lazy collection items without keys, selected category stored as an index, or list replacement on append. [CITED: https://developer.android.com/develop/ui/compose/lists; VERIFIED: approved UI contract]

### Pitfall 6: Over-announcing skeletons and decorative icons

**What goes wrong:** Screen readers repeat meaningless loading bars or icon names and hide the real screen-level status.

**Why it happens:** Semantics are attached to every placeholder child.

**How to avoid:** Apply one parent `Loading shared content` status, hide decorative children/icons, expose selected/busy state on real controls, and give complete type-specific item labels.

**Warning signs:** Dozens of `loading` nodes, icon-only labels such as “photo,” or selection communicated only by color. [CITED: https://developer.android.com/develop/ui/compose/accessibility/semantics; VERIFIED: approved UI contract]

## Code Examples

Verified patterns from repository contracts and official platform documentation:

### Adaptive Compose media grid with stable keys

```kotlin
// Source: https://developer.android.com/develop/ui/compose/lists
LazyVerticalGrid(
    columns = GridCells.Adaptive(minSize = mediaMinimumCellWidth),
    horizontalArrangement = Arrangement.spacedBy(FishSpacing.twoXs),
    verticalArrangement = Arrangement.spacedBy(FishSpacing.twoXs),
) {
    items(items = mediaItems, key = { it.id }) { item ->
        SharedContentMediaTile(item = item)
    }
}
```

Use the approved 88dp minimum normally and 120dp at accessibility text sizes, clamp to at most six columns, and compute width from available content width after `page` insets. [VERIFIED: approved `13-UI-SPEC.md`]

### Compose populated-only tabs

```kotlin
// Source: https://developer.android.com/develop/ui/compose/components/tabs
if (categories.size > 1) {
    PrimaryTabRow(selectedTabIndex = categories.indexOf(selected)) {
        categories.forEach { category ->
            Tab(
                selected = category == selected,
                onClick = { onSelectCategory(category) },
                text = { Text(category.label) },
            )
        }
    }
}
```

### SwiftUI route-entry lifecycle

```swift
// Source: repository UI contract + SwiftUI NavigationStack documentation
SharedContentGalleryScreen(model: gallery)
    .task(id: route.entryID) {
        await gallery.bind(ownerIdentityId: ownerID, conversationId: conversationID)
        gallery.open() // once for this route entry ID
    }
    .onDisappear {
        if routeWasPopped {
            gallery.close()
        }
    }
```

Do not key this task only by category selection or body reconstruction; route entry owns recovery, category change does not. [VERIFIED: approved interaction contract]

### Safe duration formatting boundary

```swift
// Source: approved UI contract; https://developer.apple.com/documentation/swift/duration/timeformatstyle
func voiceDurationLabel(durationMilliseconds: Int64?) -> String {
    guard let value = durationMilliseconds, value >= 0 else {
        return String(localized: "Duration unavailable")
    }
    return formatClockDuration(milliseconds: value)
}
```

The platform-specific formatter must produce `m:ss` below one hour and `h:mm:ss` at or above one hour using locale-appropriate digits. [VERIFIED: approved `13-UI-SPEC.md`]

## Recommended Implementation Waves

1. **Wave 0 — contract tests and fixtures:** Add failing pure projection/parity vectors for canonical order, zero/one/four categories, selected-category retention/fallback, legacy duration, global append with no selected-category item, and earlier-page failure. Add native navigation and snapshot test scaffolds. [VERIFIED: existing shared fixtures are already consumed by TypeScript/Kotlin/Swift tests]
2. **Wave 1 — duration and safe item contract:** Add the forward Supabase/RPC field and native/cache migrations; update strict decoders, generated types, parity fixture copies, and provider-neutral UI item DTOs. Keep existing values nullable and do not modify sending. [VERIFIED: current schema/projection gap]
3. **Wave 2 — store/session integration:** Extend both Phase 12 stores with accepted safe items, category projection, global `loadEarlier`, distinct earlier state, and visibility reporting. Fix app-level construction/identity registration before any screen calls `open()`. [VERIFIED: current store gaps]
4. **Wave 3 — Android destination:** Add semantic icon aliases, both entry callbacks, origin route, gallery components/states, adaptive grid/list rows, focus/scroll restoration, and screenshot/navigation tests. [VERIFIED: Android integration points]
5. **Wave 4 — iOS destination:** Add the missing details sheet/identity button, `NavigationStack` destination with origin, gallery components/states, focus/scroll restoration, and snapshot/navigation tests. [VERIFIED: iOS integration points]
6. **Wave 5 — parity and gates:** Run core/native focused suites, fixture-sync checks, database migration tests, Android screenshot/design checks, iOS snapshots, full native suites, and `pnpm build`. [VERIFIED: root scripts and existing test infrastructure]

Waves 3 and 4 may proceed in parallel only after Waves 0–2 fix the shared contract and production composition seams. [VERIFIED: cross-platform dependency graph]

## State of the Art

| Old/current approach | Required Phase 13 approach | Impact |
|----------------------|----------------------------|--------|
| Native Phase 12 stores publish presentation plus item IDs/cache keys | Publish accepted display-safe item models plus presentation and typed intents | Views can render without reaching into provider/cache internals. [VERIFIED: current stores and approved UI contract] |
| Android `ChatRoute` and iOS `ConversationView` use local presentation state; iOS has no details route | Explicit conversation destination stack with origin-bearing Shared content route | Both entry paths return correctly through native Back. [VERIFIED: current route code] |
| Voice attachment projection has no duration | Nullable trusted `durationMs` across RPC/cache/fixtures/UI | Voice metadata is honest; legacy records remain displayable. [VERIFIED: current contracts and approved UI contract] |
| Phase 12 recovery handles newest-window refresh only | Separate global explicit older-page state reusing cursor acceptance | No auto-pagination, no content blanking, stable anchors. [VERIFIED: current store and UI contract] |
| Gallery stores are test-instantiated, not live-screen owned | One identity/conversation-scoped live store registered for revocation | Prevents duplicate work and prior-owner leakage. [VERIFIED: current app composition] |

**Deprecated/outdated:**
- Category-specific pagination for this gallery: do not use it; the approved continuation contract is global. [VERIFIED: approved `13-UI-SPEC.md`]
- `AddMedia` as the Shared content icon: do not use it; the plus implies creation. Add the approved semantic gallery/photo alias over bundled Tabler assets. [VERIFIED: approved `13-UI-SPEC.md`]
- ASCII/manual byte and duration formatting: use platform localization boundaries. [CITED: https://developer.apple.com/documentation/foundation/formatstyle]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Recommendations are derived from locked context/UI decisions, repository inspection, or cited official platform documentation. | — | — |

## Open Questions (RESOLVED)

1. **Where will trusted voice duration first become non-null? — RESOLVED**
   - Resolution: Phase 13 carries nullable `durationMs` end to end through the authoritative projection, strict decoders, caches, fixtures, and gallery models. Current records remain null and render `Duration unavailable`. Populating non-null duration is deferred to a separately scoped future sending change; Phase 13 does not add or modify a sending pipeline.
   - Evidence: No current upload/schema path records duration, and Phase 13 explicitly forbids full-audio fetch/decode merely to discover it. The approved UI contract defines `Duration unavailable` for absent legacy values. [VERIFIED: voice upload migration, current DTOs, and approved UI contract]

No planning-blocking user decision remains; the user approved autonomous defaults and the approved UI contract resolves the presentation choices. [VERIFIED: `13-CONTEXT.md` specifics and `13-UI-SPEC.md` status]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | pnpm/build/scripts | ✓ | v25.9.0 | — |
| pnpm | workspace build/checks | ✓ | 11.7.0 | — |
| Android Studio JBR | Android Gradle | ✓ | JDK 21.0.10 | `scripts/android-gradle.sh` discovers it |
| Android SDK / adb | instrumented/navigation tests | ✓ | Emulator `emulator-5554`, Android SDK path available | Host unit/screenshot tests if device temporarily unavailable |
| Swift / Xcode | iOS package/app tests | ✓ | Swift 6.3.3; Xcode 26.6 (17F113) | — |
| iOS Simulator | iOS tests/snapshots | ✓ | iPhone 17 Pro simulator booted | Set `FISH_IOS_SIM` to another installed simulator |
| XcodeGen | iOS app project generation | ✓ | 2.46.0 | — |
| Local Supabase | migration/RPC integration verification | Not established by this audit | — | Run schema/static decoder tests; planner should start local Supabase for `verify:shared-content` |

[VERIFIED: local command probes on 2026-07-24]

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** Local Supabase service state was not assumed; the repository already provides `pnpm supabase:start`, `pnpm db:reset`, and `pnpm verify:shared-content` for the integration gate. [VERIFIED: root `package.json`]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Shared contract | Node test runner + TypeScript compile; fixture at `packages/core/src/shared-content/fixtures/shared-content-vectors.json` |
| Android unit/UI | JUnit 4, Compose UI tests, Room migration tests, Compose screenshot plugin |
| iOS unit/UI | Swift Testing/XCTest plus SnapshotTesting |
| Quick run command | `scripts/android-gradle.sh :feature:chat:testDebugUnitTest && (cd apps/ios/FishKit && xcodebuild test -scheme FishKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:PersonalChatTests/SharedContentGalleryTests)` |
| Full suite command | `pnpm android:check && pnpm ios:test && pnpm ios:app:build && pnpm build` |

[VERIFIED: root scripts, Gradle feature configuration, and `Package.swift`]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | Android header opens full-screen gallery and Back restores conversation/header focus | Compose UI/navigation | `scripts/android-gradle.sh :feature:chat:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=space.fishhub.android.feature.chat.SharedContentNavigationTest` | ❌ Wave 0 |
| DISC-01 | Android details row opens gallery and Back returns details before conversation | Compose UI/navigation | same focused instrumented class | ❌ Wave 0 |
| DISC-01 | iOS header/details origins preserve the two return stacks | Swift navigation/model tests | `(cd apps/ios/FishKit && xcodebuild test -scheme FishKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:PersonalChatTests/SharedContentNavigationTests)` | ❌ Wave 0 |
| DISC-01 | Both entry targets have exact name and minimum geometry | Compose/SwiftUI semantics + snapshots | `pnpm android:screenshots && pnpm ios:test` | ❌ Wave 0 |
| DISC-02 | Canonical populated order, first selection, selected retention, removal fallback | Cross-platform fixture unit | `node --test packages/core/src/shared-content/shared-content.test.ts && scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentParityTest*' && pnpm ios:test` | Existing parity harness; ❌ new vectors |
| DISC-02 | One category removes entire category control; four categories show fixed order | Compose/SwiftUI UI + snapshots | `pnpm android:screenshots && pnpm ios:test` | ❌ Wave 0 |
| DISC-02 | Global older page can add a category without switching current selection | Store/presenter unit | `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentGalleryPresenterTest*' && pnpm ios:test` | ❌ Wave 0 |
| Supporting | Nullable duration survives RPC/cache/fixture projection; absent renders fallback | SQL/decoder/cache/unit | `scripts/android-gradle.sh :data:chat:testDebugUnitTest :feature:chat:testDebugUnitTest && pnpm ios:test` | Existing cache suites; ❌ duration cases |
| Supporting | Room 9→10 and iOS Core Data compatibility preserve legacy rows | Migration/persistence | `scripts/android-gradle.sh :data:chat:connectedDebugAndroidTest && pnpm ios:test` | Existing migration/cache harness; ❌ new cases |
| Supporting | Loading/cached/stale/empty/offline/earlier busy/failure remain mutually honest | Store/UI/snapshot | `pnpm android:screenshots && pnpm ios:test` | Phase 12 state tests exist; ❌ gallery matrix |
| Supporting | `open()` once per entry, close/revoke on pop/identity change | Lifecycle/unit/integration | focused native store/navigation tests | Existing store revocation tests; ❌ production route tests |

### Required Semantic and Snapshot Matrix

Both platforms must add equivalent fixtures for light, dark, RTL, accessibility text, loading, one category, four categories, cached, stale, authoritative empty, offline unavailable, older-page busy, older-page failure, and every item kind. [VERIFIED: approved `13-UI-SPEC.md`]

Functional tests must additionally cover: zero accepted categories while loading versus authoritative empty; a realtime-added category; selected-category removal; legacy voice duration; duplicate earlier tap suppression; failed earlier request retaining items/anchor; accepted page with no item in selected category; sign-out/owner switch during refresh; and category switch not starting recovery. [VERIFIED: identified state and security seams]

### Sampling Rate

- **Per task commit:** Run the closest pure/native focused tests in under 30 seconds; for shared contracts, run TypeScript compile plus Kotlin/Swift parity tests.
- **Per wave merge:** Run affected Android unit/screenshot or iOS package tests, fixture sync checks (`pnpm ios:chat-vectors:check`), and migration tests.
- **Phase gate:** `pnpm android:check`, `pnpm ios:test`, `pnpm ios:app:build`, and `pnpm build` must be green before `$gsd-verify-work`.

### Wave 0 Gaps

- [ ] `packages/core/src/shared-content/gallery.test.ts` — canonical category/session projection and duration fixtures.
- [ ] Android `SharedContentGalleryPresenterTest.kt` — selection, global append, pagination, and state truth.
- [ ] Android `SharedContentNavigationTest.kt` — both origin stacks, semantics, focus, and exactly-once open.
- [ ] Android gallery additions to `ChatScreenshotTest.kt` — parity matrix.
- [ ] iOS `SharedContentGalleryModelTests.swift` — projection, selection, append, duration, and lifecycle.
- [ ] iOS `SharedContentNavigationTests.swift` — both origin stacks and details sheet.
- [ ] iOS `SharedContentGallerySnapshotTests.swift` — parity matrix.
- [ ] Room 9→10 migration test and Core Data legacy compatibility test.
- [ ] Supabase RPC shape/permission assertions for nullable duration plus regeneration check for `database.generated.ts`.

No framework installation is required. [VERIFIED: existing test dependencies]

## Security Domain

`security_enforcement` is enabled in `.planning/config.json`, so identity isolation, authorization, data minimization, and input validation are phase gates. [VERIFIED: project config]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bind the gallery only to the verified Supabase owner identity; identity-resolving/ineligible state exposes no prior-owner content. [VERIFIED: Phase 12 identity contract] |
| V3 Session Management | yes | Cancel/revoke store jobs and generation-bound callbacks before sign-out or identity switch; route session state dies on pop. [VERIFIED: native identity coordinators and UI contract] |
| V4 Access Control | yes | Preserve RLS/RPC membership checks and owner+conversation+generation+request+cursor acceptance; never authorize in UI. [VERIFIED: `0061_shared_content_contract.sql` and repositories] |
| V5 Input Validation | yes | Validate strict RPC shape, category/kind enum, non-negative nullable duration, safe filenames/hostnames, and cursor/token match before acceptance. [VERIFIED: strict decoders and approved UI contract] |
| V6 Cryptography | no new cryptography | Continue platform/Supabase transport and SHA-256 opaque local cache keys; do not add custom crypto. [VERIFIED: thumbnail-store key implementation] |
| V8 Data Protection | yes | Cache only display-safe metadata and bounded thumbnails in owner-scoped backup-excluded storage; never expose raw URLs/paths/provider errors to views. [VERIFIED: native caches, thumbnail stores, and UI contract] |
| V9 Communications | yes | Use existing Supabase authorized endpoints and signed delivery; never fetch full audio to discover metadata. [VERIFIED: repository/delivery boundaries] |
| V12 Files and Resources | yes | Display safe stored metadata only; keep path containment, size caps, staged lookahead, and display-confirmed promotion. [VERIFIED: thumbnail stores] |

### Known Threat Patterns for Native Shared Content

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prior-owner cache appears after account switch | Information disclosure | Generation-bound revoke-before-bind, owner-scoped cache namespaces, purge verification, identity-ineligible UI. [VERIFIED: Phase 12 identity design] |
| Stale/cross-conversation page accepted after navigation | Tampering / Information disclosure | Validate owner, conversation, generation, cycle/request ID, requested cursor, and replace/append semantics before cache mutation. [VERIFIED: request token contracts] |
| Raw storage/delivery path leaks through gallery model/log/accessibility | Information disclosure | Feature-owned safe DTOs; no provider entities, URLs, paths, raw errors, or raw URLs in view/accessibility APIs. [VERIFIED: approved UI contract] |
| Malformed/negative duration causes crash or misleading display | Tampering | Database check plus strict native non-negative-or-null validation; absent fallback, never fabricated zero. [VERIFIED: approved duration contract] |
| Duplicate earlier taps amplify requests or reorder append | Denial of service / Tampering | One busy state, disabled duplicate activation, one global in-flight cursor token, append only accepted current response. [VERIFIED: approved pagination contract] |
| Lookahead persists content never displayed | Information disclosure | Keep lookahead in bounded memory and promote only after actual display confirmation. [VERIFIED: native thumbnail stores] |

### Security Verification Tasks

- Prove header and details routes never construct a store with participant ID in place of current verified owner ID.
- Prove identity switch during initial load, refresh, older-page request, and thumbnail lookahead leaves zero old-owner UI/cache/staged state.
- Prove all 29-field (after duration) strict RPC decoders reject missing/extra/invalid fields consistently across TypeScript/Kotlin/Swift.
- Prove RLS denies former-member access and the gallery maps authority failure to unavailable, never empty.
- Prove view-model debug descriptions, accessibility labels, snapshots, and logs contain no delivery/storage paths or raw URLs.

[VERIFIED: ASVS-relevant phase threat review against current stack]

## Sources

### Primary (HIGH confidence)

- `AGENTS.md` — product, native scope, design, architecture, command, and security constraints.
- `.planning/phases/13-calm-gallery-browsing/13-CONTEXT.md` — locked decisions and boundaries.
- `.planning/phases/13-calm-gallery-browsing/13-UI-SPEC.md` — approved native visual/state/interaction contract.
- `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` — DISC-01/DISC-02 and phase dependencies.
- `packages/core/src/shared-content/**` — canonical state/types/fixtures.
- `supabase/migrations/0055_chat_voice_messages.sql`, `0061_shared_content_contract.sql`, and native shared-content repositories — authoritative projection, pagination, and duration gap.
- Android `SharedContentStore.kt`, `ChatDataModule.kt`, `MainActivity.kt`, `ChatScreen.kt`, `ParticipantDetailsSheet.kt`, caches, and thumbnail store — current implementation seams.
- iOS `SharedContentStore.swift`, `SharedContentIdentityCoordinator.swift`, `FishApp.swift`, `PersonalChatTopBar.swift`, caches, and thumbnail store — current implementation seams.

### Secondary (MEDIUM confidence)

- [Android lazy lists and grids](https://developer.android.com/develop/ui/compose/lists) — stable keys and adaptive grid pattern.
- [Android state saving](https://developer.android.com/develop/ui/compose/state-saving) — minimal route UI state and lazy collection state.
- [Android tabs](https://developer.android.com/develop/ui/compose/components/tabs) — `PrimaryTabRow` and selected tab semantics.
- [Android semantics](https://developer.android.com/develop/ui/compose/accessibility/semantics) — accessibility semantics.
- [Android navigation back stack](https://developer.android.com/guide/navigation/backstack) and [navigation testing](https://developer.android.com/guide/navigation/testing/compose) — native back-stack behavior and route testing.
- [SwiftUI NavigationStack](https://developer.apple.com/documentation/swiftui/navigationstack) — value-based native navigation.
- [Foundation FormatStyle](https://developer.apple.com/documentation/foundation/formatstyle) and [ByteCountFormatStyle](https://developer.apple.com/documentation/foundation/bytecountformatstyle/format(_:)) — localized metadata formatting.
- [Swift Duration.TimeFormatStyle](https://developer.apple.com/documentation/swift/duration/timeformatstyle) — duration formatting surface.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all implementation dependencies and versions are already pinned in the repository; no package recommendation is introduced.
- Architecture: HIGH — derived from locked/approved artifacts and direct code inspection of every cross-tier seam.
- Platform patterns: MEDIUM — official platform documentation was fetched through the web fallback because the research-plan seam selected Context7 but Context7 was unavailable in this environment.
- Pitfalls: HIGH — each maps to a concrete current repository gap or approved contract invariant.
- Validation: HIGH — existing test frameworks/commands were inspected and each requirement has explicit missing Wave 0 coverage.
- Security: HIGH — checked against current Supabase/RLS, identity-generation, cache, and delivery boundaries; no new external security component is proposed.

**Research date:** 2026-07-24
**Valid until:** 2026-08-23 (30 days; stack is pinned and the phase contract is approved)
