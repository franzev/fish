# Native iOS (SwiftUI) chat media picker plan

The iOS port of the unified emoji / GIF / sticker picker. Companion to
`docs/chat-media-picker-design.md` (experience model), the shipped web
implementation (behavioral source of truth), `docs/android-chat-media-picker.md`
(the prior native port), and `docs/ios-personal-chat-foundation-plan.md` (the
conventions this plan extends). Everything here was verified against the code
on 2026-07-16.

## Outcome and scope

One expression trigger in the message composer opens one sheet with three
tabs — 😀 Emoji, 🎞️ GIFs, 🦀 Stickers — matching the web picker's behavior
contract on iOS idioms. Selecting an emoji appends to the draft; selecting a
GIF or sticker stages exactly one media item beside the draft; staged media
renders in the transcript the same way web renders it.

### Included

- `MediaPickerSheet` with the three tabs, shared search treatment, and close
  affordance; presented from the composer's new expression trigger.
- Emoji tab: 9 grouped categories + flattened search over the shared
  `emoji-groups.json` catalog; emoji append to the draft.
- GIF tab: KLIPY trending + debounced search with cursor pagination, pause/play
  of all previews, calm empty/notice states, and visible KLIPY attribution.
- Sticker tab: searchable 32-sticker aquatic pack from the shared
  `sticker-catalog.json`, bundled WebP assets.
- Composer staging: one pending GIF (preview strip + remove) or one pending
  sticker (in-place thumbnail + remove); text may combine with either; GIF and
  sticker are mutually exclusive.
- Transcript rendering: sticker messages (96 pt, "Sticker unavailable"
  fallback), GIF messages (poster → looping muted MP4, per-GIF play/pause,
  "Via KLIPY" attribution, reduced-motion poster-first), enlarged emoji-only
  message bodies.
- `ChatData` module started early with `GifProviding` + the live
  `KlipyGifProvider`; fixtures provider for tests and the catalog app.
- Shared-catalog sync pipeline (`pnpm ios:chat-media`) + extension of
  `scripts/verify-chat-media-catalogs.mjs` so iOS joins the existing drift gate.
- New tokens, icons, fixtures, logic/snapshot/audit test coverage, catalog
  pages.

### Excluded (deliberate, matching web's own deferrals and the foundation staging)

- Real sending, realtime enrichment, GIF share registration and reporting —
  these belong to the ChatData/Supabase milestone; this plan defines the value
  types and closures that milestone will consume (see "Integration points").
- Recents, favorites, skin-tone variants, a sticker style rail — web defers
  all of these on purpose (a web test asserts the style rail's *absence*).
- Reactions (foundation exclusion) — but the emoji panel is built standalone so
  the future reactions feature reuses it, as web does.
- Images/attachments, GIPHY client (server allowlists GIPHY; no client
  implements it), iPad popover presentation.

## How the web implementation works (analysis)

### Architecture

```text
MessageComposer ── MediaPickerButton (trigger, "Add emoji, GIF, or sticker")
                     └─ Popover (desktop) / focus-trapped sheet (mobile)
                          └─ MediaPicker  (Card, role=dialog, 3 Base-UI tabs)
                               ├─ EmojiPicker   (embedded)
                               ├─ GifPicker     (embedded, provider-injected)
                               └─ StickerPicker
                     shared: MediaPickerSearch (dumb controlled input, max 50)
                             MediaPickerScrollArea (inset scroll viewport)
```

- **State ownership.** The pickers hold only their own query/browse state. The
  *selection* lives above the composer in `useChatComposer`:
  `gifSelection {gif, query, revision}` and `stickerSelection {stickerId,
  revision}`, both reset on conversation change. The composer is presentational.
- **Selection flow.** `onSelectEmoji(emoji)` → `draft + emoji` (**append, not
  caret insertion** — there is no selection/caret logic anywhere).
  `onSelectGif(gif, query)` and `onSelectSticker(sticker)` stage state and close
  the picker. GIF, sticker, and images are mutually exclusive; text combines
  with any single one.
- **Send payload** (`sendMessageAction` → `send-message` Edge Function →
  `send_chat_message` RPC): `{conversationId, body, clientRequestId,
  replyToMessageId, attachmentIds, gif?, stickerId?}` with an optimistic local
  message first. On success, `gifProvider.registerShare({gif, query})` fires and
  forgets. On late failure the staged selection is restored only if the user
  hasn't picked something newer (revision guard).
- **Rendering.** Media renders above the text bubble. GIFs are MP4 renditions
  (poster WebP + `<video>` loop, muted), aspect ratio from `width/height`,
  alt text = `gif.description`. Stickers resolve `stickerId` through the
  bundled catalog; unknown ids render a calm "Sticker unavailable" box.
  Emoji-only bodies render at display size.
- **Reduced motion.** OS preference (plus a FISH mobile opt-in) starts every
  GIF as a poster; a picker-wide toggle pauses/plays all previews; each
  transcript GIF has its own play/pause overlay.

### Data and backend contracts (what iOS reuses)

- **Emoji:** `packages/core/src/chat-media/emoji-groups.json` — 9 groups,
  1,914 entries of `{emoji, name, slug, skin_tone_support, …}`, generated from
  `unicode-emoji-json@0.9.0`. Web searches `name`/`slug` substrings and ignores
  skin tones. No network.
- **Stickers:** `packages/core/src/chat-media/sticker-catalog.json` — 32
  entries `{id, phrase, animal, description, src, styles[], keywords[]}`; ids
  are the `aquatic-*` union in `packages/core/src/chat.ts` (`chatStickerIds`);
  WebP assets in `apps/web/public/stickers/aquatic/`. The DB CHECK constraint,
  RPC allowlist, Edge Function allowlist, core contract, and asset folder are
  cross-checked by `scripts/verify-chat-media-catalogs.mjs`.
- **GIFs:** KLIPY, called **directly from the client** (no proxy) at
  `https://api.klipy.com/v2/{search|featured|registershare}` with
  `key` (public, dashboard-restricted), `client_key=fish_chat`, a pseudonymous
  stored `customer_id` UUID, `locale`, `contentfilter=high`,
  `media_filter=preview,tinymp4,mp4`, `limit` 12 (≤24), `q` ≤50 chars, `pos`
  cursor. Results map to `ChatGif {provider, providerId, title, description,
  sourceUrl, posterUrl, previewUrl, mediaUrl, width, height}`; any result whose
  media host doesn't match `static\d*.klipy.com` is dropped client-side. The
  server re-validates provider, field lengths, 1–4096 dimensions, HTTPS, and
  host allowlists. GIF URLs are hotlinked — never copied into Supabase storage.
- **Message shape:** `messages.sticker_id` is inline on the row; the GIF is a
  1:1 `message_gifs` side table. Realtime delivers only the bare row, so
  clients re-fetch each realtime message to hydrate GIFs (stickers render
  instantly from the inline id).

### Behavioral contracts the port must preserve

Extracted from the web test suites (`media-picker-button`, `composer`,
`chat-composer-surface`, `use-chat-composer`, `gif-picker`, `emoji-picker`,
`sticker-picker`, `media-picker`, `gif-media`, `sticker-media`, `message-gif`):

1. One trigger, accessible name **"Add emoji, GIF, or sticker"**, 44 pt target.
2. One surface, three tabs, emoji tab default; a `defaultTab` override exists.
3. Selecting anything closes the picker; on mobile hosting there is an explicit
   **"Close expression picker"** control and the surface is modal.
4. Search fields are plain controlled inputs (label + placeholder per tab,
   50-char cap); no autofocus on open — focus never jumps and the keyboard
   never pops over the grid uninvited.
5. Emoji: empty query shows 9 category tabs with a bottom monochrome icon
   strip (active category name shown on compact widths); typing flattens
   results across categories under a "Results" heading; matches on name/slug
   substring; ≥5 columns; 44 pt targets; 24 pt glyphs; empty copy
   "No emoji match that yet."
6. GIFs: trending when query is empty; 300 ms debounce (immediate on clear)
   preserving punctuation; stale responses never clobber newer ones; cursor
   pagination via scroll sentinel; result label "Trending GIFs" / "GIF results
   for {query}"; skeleton loading tiles; empty copy "No GIFs found. Try a
   simpler phrase."; failure copy "GIF search is taking a break. Your message
   is still here." with Try again (only when the provider is configured);
   pause/play-all toggle (`aria-pressed` semantics); tiles labeled
   "Choose {description}"; 2 columns, 4:3 tiles; "Powered by KLIPY" footer.
7. Stickers: 3-column grid of 96 pt tiles; search across phrase, animal,
   description, keywords, styles; tiles labeled "Add {phrase} sticker"; empty
   copy "No stickers match that yet."; no style rail.
8. Composer: emoji appends to the draft; a staged GIF shows a preview row
   ("GIF selected", "Remove selected GIF"); a staged sticker shows an in-place
   44 pt thumbnail ("Remove selected sticker") without growing the composer;
   text + one media combine; GIF and sticker are mutually exclusive; send is
   available when there is text **or** media; staged media clears on send and
   on conversation change.
9. Transcript: sticker 96 pt with "Sticker unavailable" fallback for unknown
   ids; GIF aspect from `width/height`, poster-first under reduced motion,
   explicit per-GIF play/pause ("Play GIF: {description}"), attribution link
   "Via KLIPY" to `sourceUrl`; emoji-only bodies enlarged.
10. GIF previews and playback are always muted and looping; only posters render
    when the user (or the system) says not to animate.

Web-only mechanics that intentionally do **not** port: the sticker preloader
(warms Next.js's image-optimizer HTTP cache; iOS stickers load from the app
bundle), Base UI popover positioning, and the desktop hover states.

## iOS design

### Architectural decisions

| Decision | Choice | Rationale / tradeoff |
| --- | --- | --- |
| Presentation | `.sheet` with `presentationDetents([.medium, .large])`, visible drag indicator, plus an explicit close button in the sheet header | Matches Android's `ModalBottomSheet` and mobile web's modal hosting; the system supplies scrim, swipe-dismiss, focus containment, and keyboard avoidance. A popover variant for iPad regular width is deferred with the iPhone-first foundation scope. |
| Tabs | Custom 3-segment `MediaPickerTabs` (emoji glyph + label, equal widths, `surface2` active fill) | A system segmented control brings system materials/tinting the design system opts out of. The web tab strip is the visual contract. |
| Module placement | Picker models/logic/views inside `PersonalChat`; **new `ChatData` target** holding `GifProviding`, `GifPage`, `ChatGif`, and `KlipyGifProvider` | Starts the module the foundation plan already reserves for data ("feature code depends on the protocols only"), just with KLIPY as its first resident instead of Supabase. `PersonalChat` gains a dependency on `ChatData` (value types + protocol only — no SDK types; guard-enforced import direction gains `ChatData` rules). Alternative rejected: URLSession code inside `PersonalChat` would make the future Supabase adapter a second data home. |
| State management | First `@Observable` model: `GifSearchModel` in `PersonalChat/ViewModels/` (the folder the foundation plan reserves). Panels stay stateless — they take value-type state + closures | GIF search is the first genuinely async UI in the app. Emoji/sticker tabs need only local `@State` query + pure search functions. Views remain snapshot-deterministic because the model projects a `GifPanelState` value. |
| GIF playback | Poster via `AsyncImage` (WebP decodes natively since iOS 14); animation via muted, looping `AVPlayer` on the MP4 renditions (`tinymp4` in grids, `mp4` in transcript), created on appear and torn down on disappear | KLIPY "GIFs" are MP4s on web too — `AVPlayer` is hardware-decoded and battery-cheap versus animated-image decoding. Player instances are budgeted: only visible tiles animate, and the pause-all toggle / Reduce Motion drop the grid to posters entirely. No third-party media dependency. |
| Emoji data | Bundle the shared `emoji-groups.json` verbatim; decode lazily once; search `name`/`slug` substrings; render base glyphs at a fixed 24 pt | Identical vocabulary and results across platforms. Skin tones stay out (web ignores them; adding an iOS-only variant flow would break parity and add choices). Unlike Android there is no system emoji-picker view to lean on, so browse and search both use the shared catalog — which is closer to web than Android is. |
| Sticker/emoji catalogs | Copied into `PersonalChat/Resources/ChatMedia/` by a new `pnpm ios:chat-media` script; `verify-chat-media-catalogs.mjs` extended to fail on drift | SPM cannot reference files outside the package (Android's trick of mounting the web folder as an asset source doesn't translate), so iOS follows its own established pattern: generate/copy + drift gate, like tokens and fonts. |
| Sticker id type | `String` ids everywhere + catalog lookup returning `ChatSticker?` | Forward compatibility: the transcript may contain ids newer than the app. Unknown ids render "Sticker unavailable" (same rule as web/Android). A 32-case enum would turn new stickers into decode failures. |
| Selection modeling | `ComposerSelection` enum: `.none` / `.gif(ChatGif, searchQuery:)` / `.sticker(ChatSticker)` | Encodes GIF/sticker mutual exclusion in the type instead of two nullable fields + guard code (web needs three separate enforcement sites). The search query rides along so the future send path can register the share. |
| Message media | `MessageUiModel` gains `media: MessageMedia?` where `MessageMedia` = `.sticker(id: String)` / `.gif(ChatGif)` / `.gifUnavailable` | The web row has no discriminant (optional fields); an enum is the idiomatic Swift shape and lets adapters map invalid provider metadata to `.gifUnavailable` (Android's "safe cache marker") instead of propagating bad URLs. Default `nil` keeps every existing call site compiling. |
| Emoji insertion | Append to the draft string | Exactly what web does (`draft + emoji`); no caret APIs needed, no UIKit bridge. |

### Project structure (additions only)

```text
scripts/
  sync-ios-chat-media.mjs             # copy catalogs + webp into FishKit (--check drift mode)
  verify-chat-media-catalogs.mjs      # extended: also verifies the iOS copies

apps/ios/FishKit/
  Package.swift                       # + ChatData target; PersonalChat depends on it; + ChatMedia resources
  Sources/
    ChatData/
      ChatData.swift                  # module overview doc
      Models/
        ChatGif.swift                 # ChatGif, ChatGifProvider, GifPage
      Providers/
        GifProviding.swift            # the port (protocol)
      Adapters/
        KlipyGifProvider.swift        # live URLSession adapter + response mapping
    UIComponents/Fields/
      InputField.swift                # + optional leading icon (additive)
    DesignSystem/Resources/Icons.xcassets/   # + 11 Tabler imagesets (below)
    PersonalChat/
      Models/
        ChatSticker.swift             # sticker + emoji catalog entry value types
        EmojiGroup.swift
        MessageMedia.swift            # + MessageUiModel.media extension
        ComposerSelection.swift
        MediaPickerTab.swift
      Logic/
        StickerCatalog.swift          # bundle decode + id lookup + search
        EmojiCatalog.swift            # bundle decode + grouped browse + search
        EmojiOnlyMessage.swift        # emoji-only body detection (display-size rule)
        MediaSelectionRules.swift     # sendability with media, exclusivity helpers
        MediaAccessibility.swift      # labels: tiles, staged media, transcript media
      ViewModels/
        GifSearchModel.swift          # @Observable; debounce, paging, status, pause pref
      Views/MediaPicker/
        MediaPickerSheet.swift        # header + tabs + panels shell
        MediaPickerTabs.swift
        MediaPickerSearchField.swift  # InputField wrapper, 50-char cap
        EmojiPanel.swift              # grid + EmojiCategoryStrip
        GifPanel.swift                # states + grid + attribution footer; GifTile
        StickerPanel.swift            # grid; StickerTile
      Views/
        GifSelectionPreview.swift     # staged GIF row ("GIF selected", remove)
        StickerSelectionThumbnail.swift # staged sticker in-place control
        StickerMedia.swift            # transcript sticker (96 pt, unavailable fallback)
        GifMedia.swift                # poster/player states, play-pause overlay
        MessageGif.swift              # GifMedia + "Via KLIPY" attribution link
        MessageComposer.swift         # + expression trigger, staged media, media sendability
        PersonalChatTranscript.swift  # media above bubble in the row
      Screens/
        PersonalChatScreen.swift      # + selection binding, gifProvider, sheet presentation
      Resources/ChatMedia/            # synced, never hand-edited
        emoji-groups.json
        sticker-catalog.json
        stickers/aquatic/*.webp       # 32 files
    TestSupport/
      Fixtures/ChatMediaFixtures.swift  # gifs (bundled poster files), stickers, pages
      FixtureGifProvider.swift          # deterministic pages + error/empty modes
  Tests/
    ChatDataTests/                    # Klipy mapping/request tests (URLProtocol stub)
    PersonalChatTests/                # + catalog/search/selection/model logic + snapshots
  Catalog/Sources/CatalogPages.swift  # + Media picker page, Chat media states page
  Catalog/UITests/…                   # + new pages in the audit list

design/tokens/fish.tokens.json        # + shared media tokens (below)
```

Dependency direction (guard-enforced): `Catalog → PersonalChat → {UIComponents → DesignSystem, ChatData}`; `ChatData` imports only Foundation; `TestSupport` may import all.

### Data models (key shapes)

```swift
// ChatData — wire-faithful mirrors of packages/core/src/chat.ts
public enum ChatGifProvider: String, Sendable, Codable { case klipy, giphy }

public struct ChatGif: Equatable, Hashable, Sendable, Codable {
    public var provider: ChatGifProvider
    public var providerId: String
    public var title: String
    public var description: String     // alt text everywhere
    public var sourceUrl: URL          // attribution target
    public var posterUrl: URL          // still WebP
    public var previewUrl: URL         // tinymp4 (grid loop)
    public var mediaUrl: URL           // mp4 (transcript loop)
    public var width: Int              // 1...4096 (server-enforced)
    public var height: Int
}

public struct GifPage: Equatable, Sendable { public var gifs: [ChatGif]; public var next: String? }

public protocol GifProviding: Sendable {
    var isAvailable: Bool { get }                       // false → calm "unavailable" notice, no retry
    func trending(cursor: String?) async throws -> GifPage
    func search(query: String, cursor: String?) async throws -> GifPage
    func registerShare(gif: ChatGif, query: String) async   // fire-and-forget on send (ChatData milestone calls it)
}

// PersonalChat
public struct ChatSticker: Equatable, Sendable, Identifiable {
    public var id: String              // "aquatic-hello-otter"
    public var phrase: String          // "Hello!"
    public var animal: String
    public var description: String     // accessibility text
    public var assetName: String       // "hello-otter.webp" (from catalog src)
    public var styles: [String]
    public var keywords: [String]
}

public struct EmojiEntry: Equatable, Sendable { public var emoji: String; public var name: String; public var slug: String }
public struct EmojiGroup: Equatable, Sendable { public var name: String; public var slug: String; public var emojis: [EmojiEntry] }

public enum MessageMedia: Equatable, Sendable {
    case sticker(id: String)           // unknown id → "Sticker unavailable" at render
    case gif(ChatGif)
    case gifUnavailable                // invalid/unsupported provider metadata, kept readable
}
// MessageUiModel gains `public var media: MessageMedia? = nil`

public enum ComposerSelection: Equatable, Sendable {
    case none
    case gif(ChatGif, searchQuery: String)
    case sticker(ChatSticker)
}

public enum MediaPickerTab: Equatable, Sendable, CaseIterable { case emoji, gif, sticker }
```

Pure logic (all unit-tested, mirroring the web tests' cases):

- `EmojiCatalog.groups()` / `EmojiCatalog.search(_:)` — lazy single decode of
  the bundled JSON; search flattens all groups, case-insensitive substring over
  name and slug.
- `StickerCatalog.all()` / `sticker(for id:)` / `search(_:)` — search over
  phrase, animal, description, keywords, styles.
- `MediaSelectionRules.isSendable(draft:selection:)` — sendable when the
  selection is non-`none` **or** `ChatRules.isSendable(draft)`; draft length
  rules unchanged. `MessageComposer.showsSend` updated to take the selection.
- `EmojiOnlyMessage.isEmojiOnly(_:)` — Unicode-scalar based port of web's
  emoji-only detection driving display-size rendering.
- `MediaAccessibility` — "Add {phrase} sticker", "Choose {description}",
  "Remove selected GIF/sticker", "{description} sticker" / "GIF: {description}"
  transcript labels, "Play/Pause GIF: {description}".

### State management

- **`GifSearchModel`** (`@Observable`, `@MainActor`, in `ViewModels/`): owns
  `query`, debounce (300 ms non-empty / immediate on clear) via an injected
  `any Clock<Duration>` so tests use a manual clock, paging (`next` cursor,
  `loadMoreIfNeeded(current:)`), dedup by `provider + providerId`, `status`
  (`loading | ready | empty | notice`), `isLoadingMore`, retry, and the
  session-scoped `animationPreference: Bool?`. Cancellation mirrors the web's
  abort + sequence guard: each load cancels the previous `Task` and stamps a
  generation counter so stale results are dropped. It imports `ChatData` and
  Foundation — never SwiftUI. It projects a `GifPanelState` value for the view.
- **Effective animation state** = `model.animationPreference ??
  environment.accessibilityReduceMotion` — resolved in the view, matching web's
  `animationPreference ?? reducedMotion`.
- **Emoji/sticker panels**: local `@State private var query` + the pure
  catalog search functions. No models needed.
- **Selection** lives with the screen host as `Binding<ComposerSelection>`
  (Catalog's `ChatStateHost` today; the future `@Observable` conversation store
  later, with the revision-guard restore logic arriving alongside real sends in
  the ChatData milestone — same staging as web, where selection lives above the
  composer).
- **Sheet visibility** is local `@State` in `PersonalChatScreen` (the Android
  plan's "sheet visibility stays local" rule).
- Views stay stateless: every panel takes value state + closures, so the
  snapshot matrix and the future store both bind without view changes.

### UI architecture

```text
PersonalChatScreen (+ @State pickerPresented, selection: Binding<ComposerSelection>, gifProvider)
 └─ MessageComposer(draft:, selection:, sendState:, onSend:, onOpenMediaPicker:)
     ├─ [staged gif]  GifSelectionPreview(gif:, onRemove:)      // row above the field
     ├─ leading slot: IconButton(.moodSmile, "Add emoji, GIF, or sticker")
     │                └─ replaced by StickerSelectionThumbnail(sticker:, onRemove:) when staged
     ├─ growing TextField (unchanged)
     └─ send IconButton — shown when MediaSelectionRules.isSendable(draft:selection:)
 └─ .sheet(isPresented:) → MediaPickerSheet(gifProvider:, defaultTab:, gifDisabled:, stickerDisabled:,
                                            onSelectEmoji:, onSelectGif:, onSelectSticker:)
      ├─ header: "Add to message" + IconButton(.close, "Close expression picker")
      ├─ MediaPickerTabs (😀 Emoji · 🎞️ GIFs · 🦀 Stickers)
      ├─ EmojiPanel    — MediaPickerSearchField · LazyVGrid(adaptive ≥44pt, 24pt glyphs)
      │                  · browse: one group at a time + EmojiCategoryStrip (9 monochrome icons, bottom)
      │                  · search: flattened "Results" · empty: "No emoji match that yet."
      ├─ GifPanel      — MediaPickerSearchField("Search KLIPY") · status header + pause/play-all
      │                  · 2-col LazyVGrid of GifTile (4:3, poster → looping tinymp4 AVPlayer)
      │                  · skeleton loading · empty/notice copy (web strings) · Try again
      │                  · load-more sentinel → cursor page · "Powered by KLIPY" footer link
      └─ StickerPanel  — MediaPickerSearchField · 3-col LazyVGrid of StickerTile (96pt, surface2)
                         · empty: "No stickers match that yet."

Transcript row: [StickerMedia | MessageGif] above the text bubble; body hidden when empty;
emoji-only bodies render at display size. MessageGif = GifMedia + "Via KLIPY" link (44pt, sourceUrl).
```

Selection closures set the binding (or append the emoji), then dismiss the
sheet — reproducing web's select-then-close contract. Tab changes keep each
panel's query/scroll state alive within a presentation (web keeps mounted tab
panels), and everything resets when the sheet is dismissed and re-created.

Key component APIs (all stateless, tokens-only, 44 pt targets):

| Component | API sketch | Notes |
| --- | --- | --- |
| `MediaPickerSheet` | `init(gifProvider:defaultTab:gifDisabled:stickerDisabled:onSelectEmoji:onSelectGif:onSelectSticker:)` | Owns `@State` tab + `GifSearchModel`; header always shows the close control (sheet == web's mobile hosting) |
| `MediaPickerTabs` | `init(selection: Binding<MediaPickerTab>, gifDisabled:stickerDisabled:)` | Emoji glyphs are decorative; labels carry meaning; disabled tabs at reduced opacity |
| `MediaPickerSearchField` | `init(label:placeholder:text:)` | `InputField` + new leading `Icon.search`, visually-hidden-equivalent label, 50-char clamp |
| `EmojiPanel` | `init(onSelect: (String) -> Void)` | Grid buttons labeled with the emoji `name`; glyph hidden from a11y |
| `GifPanel` | `init(state: GifPanelState, reduceMotion:, onQueryChange:onSelect:onLoadMore:onToggleAnimations:onRetry:)` | Value-state for snapshots; tiles labeled "Choose {description}" |
| `StickerPanel` | `init(onSelect: (ChatSticker) -> Void)` | Tiles labeled "Add {phrase} sticker" |
| `GifMedia` | `init(gif:preview:paused:playRequested:fixedAspect:)` | Web-prop parity; poster failure → "GIF no longer available" text |
| `StickerMedia` | `init(stickerId:displaySize: .tile(96)/.control(44))` | Unknown id → "Sticker unavailable" element |
| `GifSelectionPreview` | `init(gif:, onRemove:)` | 160 pt preview, "GIF selected" label |
| `StickerSelectionThumbnail` | `init(sticker:, onRemove:)` | 44 pt control-size sticker + close badge; replaces the trigger in place |

### Networking: `KlipyGifProvider`

- `URLSession` + `async/await`; endpoints `search` / `featured` /
  `registershare` on `https://api.klipy.com/v2` with the exact web params
  (`client_key=fish_chat`, `contentfilter=high`,
  `media_filter=preview,tinymp4,mp4`, `limit` default 12 max 24, `q` sliced to
  50, `pos` cursor, `locale` from `Locale.current`).
- `customer_id`: a pseudonymous UUID generated once and stored in
  `UserDefaults` (parity with web's localStorage key; deliberately **not**
  IDFV/IDFA).
- Response mapping = `mapKlipyResult` parity: `preview → posterUrl`,
  `tinymp4 → previewUrl`, `mp4 → mediaUrl`, dims clamped to 4096; results whose
  media hosts don't match `^static\d*\.klipy\.com$` are dropped; `sourceUrl`
  falls back to `https://klipy.com/gifs/{id}` when the item URL isn't a KLIPY
  host. This keeps every URL the app ever sends inside the server's allowlist.
- The API key is injected (`init(apiKey:)`); the catalog app reads it from its
  build configuration (`Catalog/project.yml` setting / xcconfig — never
  committed source). A missing key ⇒ `isAvailable == false` ⇒ the panel shows
  the calm unavailable notice without a retry, exactly like web. The production
  key must be restricted to the iOS bundle id in the KLIPY dashboard before
  release (same rule as web's origin restriction).
- `FixtureGifProvider` (TestSupport) serves deterministic pages whose poster
  URLs point at bundled test images (file URLs), plus configurable
  empty/error/slow modes — snapshots and catalog demos run offline.

### Asset and catalog pipeline

- `scripts/sync-ios-chat-media.mjs` (`pnpm ios:chat-media`, `--check` for CI)
  copies `emoji-groups.json`, `sticker-catalog.json`, and the 32 WebPs into
  `PersonalChat/Resources/ChatMedia/` (SPM `.copy` so bytes stay identical).
- `scripts/verify-chat-media-catalogs.mjs` gains an iOS section: the copied
  JSONs must be byte-identical to `packages/core` and the copied WebP filenames
  must match the catalog — the same gate that already ties core, the Edge
  Function allowlist, the DB constraint, and web assets together.
- `StickerCatalog`/`EmojiCatalog` decode once (cached `static let`); the emoji
  JSON (~1,900 entries) decodes in the low milliseconds on first picker open.

### Design tokens and icons

Token additions to `design/tokens/fish.tokens.json` (all already exist in web
CSS and graduate into the shared manifest; regenerate with `pnpm ios:tokens`):

- `Metrics.emojiGlyph = 24` (web `--text-emoji`), `Metrics.stickerTile = 96`,
  `Metrics.chatGifSelection = 160`, `Metrics.chatGifMaxWidth = 420`,
  `Metrics.gifTileAspect = 4/3` (web `--aspect-gif-tile`).
- Web's picker panel dimensions (`--spacing-media-panel*`, `--spacing-emoji-panel*`,
  `--spacing-gif-panel*`) stay web-only — sheet detents replace them.
- No new colors ⇒ no contrast-test additions.

New `Icon` cases + Tabler template SVGs (auto-covered by `IconTests`):
`moodSmile` (trigger + Smileys category), `search`, `handStop`, `paw`,
`toolsKitchen2`, `car`, `ballBasketball`, `bulb`, `hash`, `flag`, `play`,
`pause`. (`close` and `send` already exist.) Tab glyphs 😀/🎞️/🦀 are text, not
icons, as on web.

### Accessibility and motion

- Every control keeps the web accessible names (listed under behavioral
  contracts); icon-only controls use the required-`accessibilityLabel` pattern.
- Emoji/GIF/sticker tiles ≥44 pt; sticker tiles 96 pt; glyphs hidden from
  VoiceOver with meaning carried by labels.
- The sheet gets an explicit close button (parity + audit-friendly), VoiceOver
  focus lands on the header when presented, and selection dismissal returns
  focus to the composer trigger (system sheet behavior; verified in the manual
  pass).
- Reduce Motion: previews and transcript GIFs start as posters; play only on
  explicit request; the pause-all toggle always available (`Motion` helpers +
  `accessibilityReduceMotion`). No autoplaying content under Reduce Motion,
  ever.
- Emoji glyphs render at a fixed 24 pt (pictographs don't scale in Apple's own
  keyboard); all *text* keeps Dynamic Type via the existing `TextRole` ladder;
  XL-type and RTL snapshots cover the new surfaces.
- Copy is the web copy verbatim (calm, never scolding, `notice` tone for the
  GIF failure state).

## Integration points

1. **`MessageComposer` / `PersonalChatScreen` (this milestone).** New
   parameters: `selection: Binding<ComposerSelection>` and
   `onOpenMediaPicker: () -> Void` on the composer; `gifProvider: any
   GifProviding` and the selection binding on the screen. `showsSend` and
   `ChatRules` sendability extend to media. All call sites are Catalog +
   tests — no shipped API to migrate.
2. **Future ChatData/Supabase milestone (contracts defined now).** The host
   sends `{body: draft, media: selection}`; payload mapping is
   `ComposerSelection → {gif | stickerId}` on the existing
   `{conversationId, body, clientRequestId, replyToMessageId, attachmentIds}`
   envelope (Edge Function `send-message` or RPC `send_chat_message`).
   That milestone owns: optimistic media messages, the revision-guarded
   restore-on-failure, clearing on conversation change, idempotent
   `clientRequestId` retries, `registerShare(gif:query:)` after confirmed
   sends, GIF reporting, and realtime hydration (bare row → fetch enriched
   message for `message_gifs`; stickers render instantly from the inline id;
   invalid rows map to `.gifUnavailable`). Server-side validation to satisfy is
   quoted in the analysis section above.
3. **Repo tooling.** `package.json` gains `ios:chat-media` (+`:check`);
   `verify-chat-media-catalogs.mjs` covers iOS; `ios-token-guard.mjs` learns
   the `ChatData` import rules; CI order: tokens check → chat-media check →
   guard → `pnpm ios:test` → `pnpm build`.
4. **Future reactions milestone.** `EmojiPanel` is standalone (no picker-shell
   dependency) so reactions can host it directly, as web reuses `EmojiPicker`.

## Platform considerations and tradeoffs

- **Append vs caret insertion** for emoji is not a compromise — it is the web
  behavior. If web ever moves to caret insertion, iOS needs iOS 18's
  `TextSelection` or a `UITextView` bridge; noted, not built.
- **No system emoji picker exists on iOS** (Android leans on
  `EmojiPickerView`), so the shared catalog drives everything — full parity
  with web search vocabulary, at the cost of bundling ~200 KB of JSON.
- **Unicode coverage:** `unicode-emoji-json@0.9.0` is Unicode 15.1; a handful
  of glyphs render as tofu below iOS 17.4. Accepted (web has the same gap on
  old OSes); revisit only if coach/client devices surface it.
- **AVPlayer budget:** grids cap live players to visible tiles and tear down on
  disappear; pause-all and Reduce Motion drop to posters. If profiling on older
  devices still shows pressure, the fallback is animating only the newest N
  visible tiles — a state already representable in `GifPanelState`.
- **Privacy:** the KLIPY `customer_id` is an app-generated UUID, never a device
  identifier; GIF search queries go to KLIPY exactly as on web (`contentfilter=high`).
  All endpoints are HTTPS (no ATS exceptions).
- **Offline:** `gifDisabled`/`stickerDisabled` mirror web's offline flags —
  wired to real connectivity in the ChatData milestone; emoji keeps working
  offline (it only edits the draft).
- **Detents vs fixed panel:** medium detent ≈ web's 456 pt panel on current
  iPhones; large detent covers keyboard-up search. The web height tokens stay
  unported on purpose.
- **Sticker preloading is unnecessary on iOS** — bundled assets load from disk;
  the web preloader exists to warm an HTTP image-optimizer cache.

## Implementation roadmap

Waves are dependency-ordered; each ends green (`pnpm ios:test`, guard, drift
checks) and reviewable. Estimates assume one iOS engineer.

| Wave | Contents | Exit gate | Est. |
| --- | --- | --- | --- |
| 0 — Pipeline | Manifest tokens + regen; 12 icon assets; `sync-ios-chat-media` + verify extension; Package resources | `ios:tokens:check`, `chat-media:verify`, `IconTests` green | 1 d |
| 1 — Models & logic (TDD) | `ChatSticker`/`EmojiGroup`/`MessageMedia`/`ComposerSelection`; catalog loaders + search; `MediaSelectionRules`; `EmojiOnlyMessage`; `MediaAccessibility`; fixtures | Logic suite green incl. web-parity search cases | 1–2 d |
| 2 — ChatData (TDD) | Target + `GifProviding`/`ChatGif`/`GifPage`; `KlipyGifProvider` (URLProtocol-stubbed request/mapping/host-drop tests); `FixtureGifProvider`; `GifSearchModel` with manual-clock debounce/paging/stale-guard tests | ChatData + model suites green | 2–3 d |
| 3 — Picker UI | `InputField` leading icon; search field; tabs; sheet shell; emoji/sticker/GIF panels incl. players, skeletons, attribution | Snapshot matrix (light/dark/XL/RTL × every panel state) green | 3–4 d |
| 4 — Composer & transcript | Trigger + staged previews; composer/screen API changes; `StickerMedia`/`GifMedia`/`MessageGif`; emoji-only bodies; transcript wiring; fixture states | Composer/transcript snapshots + `showsSend` truth table green | 2–3 d |
| 5 — Catalog & acceptance | Catalog pages (Media picker, Chat media states) + audit list; full gates; manual pass (VoiceOver order, keyboard, detents, Reduce Motion, live KLIPY smoke with a restricted debug key); behavioral-contract checklist review | Audit sweep + all gates green; checklist signed off | 1–2 d |

**Total: ~10–15 days.**

## Verification strategy

1. **Logic tests** (Swift Testing): emoji/sticker search parity with web's
   cases, selection exclusivity, media sendability, emoji-only detection,
   unknown-sticker fallback, KLIPY mapping (golden JSON incl. host-allowlist
   drops and 4096 clamping), `GifSearchModel` debounce/stale/pagination/dedup
   with a manual clock.
2. **Snapshots** (pinned iPhone 13, light/dark + XL/RTL): every panel state
   from the behavioral-contract list, staged-media composer states, transcript
   sticker/GIF/emoji-only rows — all fed by offline fixtures.
3. **Accessibility**: `performAccessibilityAudit()` over the new catalog pages;
   semantics assertions for names/traits/hidden decorations.
4. **Drift gates**: `ios:tokens:check`, `ios:chat-media --check`,
   `chat-media:verify`, `ios:guard` (with ChatData import rules), `pnpm build`.
5. **Manual acceptance**: VoiceOver traversal of the sheet, keyboard + detent
   interaction, Reduce Motion behavior, live KLIPY search/pagination smoke
   test, sticker/GIF/emoji rendering against real coaching copy.
6. **Interop readiness (pre-ChatData exit note)**: payload-parity table
   (ComposerSelection → send-message JSON) reviewed against
   `supabase/functions/send-message/index.ts` so the data milestone starts
   from verified shapes.

## Definition of done

- Every behavioral contract in the analysis section demonstrably holds on iOS
  (tests or the manual checklist reference each one).
- All drift gates green; no raw values; module import direction intact;
  baselines committed after visual inspection.
- Catalog demonstrates: picker (each tab, each GIF state via fixture modes),
  staged GIF/sticker composer, transcript media states — all offline.
- This document and the extended verify script are the cross-platform record;
  the Android doc stays untouched.
- No Supabase, no send path, no reactions — those milestones consume the
  contracts defined here.

## Risks and mitigations

- **KLIPY key handling** — a committed key would be origin-unrestricted;
  mitigated by build-config injection, dashboard bundle-id restriction, and the
  `isAvailable == false` calm fallback when absent.
- **Player memory pressure on older devices** — mitigated by
  visible-tile-only players, teardown on disappear, pause-all, and the
  documented N-newest fallback.
- **Catalog drift between platforms** — mitigated by extending the existing
  single verify script rather than adding an iOS-only check.
- **Emoji JSON decode on first open** — measured in Wave 3; if it ever shows up
  in Instruments, pre-decode off-main at app/catalog launch (the API already
  isolates callers from the change).
- **`PersonalChat → ChatData` dependency creep** (UI reaching for adapters
  directly) — mitigated by the guard script's import rules: feature code may
  import the module, reviews enforce protocol-only use; the live adapter is
  constructed only at the app/catalog boundary.
