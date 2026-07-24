# Stack Research

**Domain:** Private per-conversation shared-content galleries in native direct chat
**Researched:** 2026-07-22
**Confidence:** HIGH

## Recommendation

Build the gallery as a thin extension of the shipped chat stack. Add one normalized, RLS-protected, keyset-paginated read contract in Supabase; keep the existing `chat-image-command` signed-URL refresh path and the existing sender-only message deletion command; then render and export content with APIs already present in each native app.

**Do not add a new third-party runtime dependency.** Android already has Compose, Room, Coil, Media3, WorkManager, Ktor, and supabase-kt. iOS already has SwiftUI, `URLSession`, ImageIO, Quick Look, AVKit, UIKit sharing, and supabase-swift. A new gallery SDK, database, image loader, download manager, or API service would duplicate working boundaries without solving a new problem.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Supabase Postgres + RLS | Managed project; existing migrations | Authoritative gallery metadata, conversation membership, sender-only deletion | The source data already lives in `messages`, `message_attachments`, `message_gifs`, `message_link_previews`, and sticker/message fields. Keep authorization in the same database boundary that protects chat. |
| Supabase Storage private bucket | Existing private `chat-images` bucket | Store processed attachment display and thumbnail variants | Private buckets apply RLS to downloads. The current `storage.objects` policy already permits only conversation members to read ready attachments whose source message is not deleted. Keep the bucket private. |
| `chat-image-command` Edge Function | Existing; `@supabase/supabase-js` 2.110.0 | Issue attachment delivery URLs in batches of at most 50 | The function already authorizes with the caller JWT, selects only RLS-visible ready attachments, creates 15-minute signed URLs, and returns separate thumbnail/display URLs. Extend usage, not the service surface. |
| Android Kotlin + Jetpack Compose | Existing Compose BOM 2026.06.01; min SDK 26 | Native gallery screen and state | `LazyVerticalGrid`/`LazyColumn` compose only visible content. The feature remains inside `feature:chat`; data access remains behind `data:chat`. |
| iOS Swift 6 + SwiftUI | Swift tools 6.0; iOS 17 minimum | Native gallery screen and state | `ScrollView` + `LazyVGrid` supplies lazy item creation with no dependency. Keep provider code in `ChatData` and presentation in `PersonalChat`. |

### Supporting Libraries and Platform APIs

| Library / API | Version | Purpose | When to Use |
|---------------|---------|---------|-------------|
| supabase-kt | 3.6.0, existing | Authenticated PostgREST/RPC, Edge Function calls, Realtime hints | Android metadata page requests, URL refresh, and existing delete-message command. Do not add `storage-kt` merely for the gallery; the hardened Edge Function remains the delivery boundary. |
| Room | 2.8.4, existing | Account-scoped offline metadata and source-message lookup | Android: add DAO projections/queries over the existing `messages` and `message_attachments` cache, plus only the minimal extra cached gallery fields needed for GIF/link/sticker entries. No separate gallery database. |
| Coil | 3.5.0, existing | Thumbnail and full-image loading with memory/disk caching | Android image tiles and previews. Use the stable attachment storage path/content version as the cache identity, never the signed URL. |
| Android Media3 | 1.10.1, existing | Video/audio playback | Reuse the shipped message video and voice playback paths for gallery preview. The gallery does not add a sending or transcoding pipeline. |
| Android `LazyVerticalGrid` / `LazyColumn` | Compose foundation from existing BOM | Viewport-lazy media grid and document/other lists | Use stable item keys and load the next keyset page near the end. Manual bounded pagination matches the existing chat/search architecture; Paging 3 is unnecessary. |
| Android `FileProvider`, `ACTION_VIEW`, `ACTION_SEND` | AndroidX Core 1.19.0 + platform | Secure open/share handoff | Extend the existing `AttachmentFileOpener`: download into private cache, validate MIME/signature/size, expose a temporary `content://` URI, and grant read access only to the chosen receiver. |
| Android Storage Access Framework (`ACTION_CREATE_DOCUMENT` / `ActivityResultContracts.CreateDocument`) | Platform, API 19+ | Explicit download/export to a user-selected destination | Add at the app boundary for a dedicated “Save to device” action. Copy the already validated private-cache file through `ContentResolver`; this needs no broad storage permission. |
| iOS `URLSession` + ImageIO + `NSCache` | iOS 17 platform | Signed fetch, downsampled decode, memory/disk image caching | Reuse `MessageImageLoader` and `AttachmentFileDownloader`. Refresh expired delivery URLs through `AttachmentCommandProviding`; key disk cache by stable storage path, not URL. |
| iOS Quick Look | iOS 17 platform | Preview PDFs, Office files, text, images, audio, and video | Reuse `.quickLookPreview` for documents after bounded, trusted-host download. Quick Look is the native common-file preview surface. |
| iOS AVKit / AVFoundation | iOS 17 platform | Video and voice preview | Reuse `AVPlayer`/the shipped player views. Create players only for the selected/visible preview, not for every grid tile. |
| iOS `UIActivityViewController` | iOS 17 platform | Native share and system-provided save activities | Reuse `AttachmentActivitySheet` with a local temporary file. It already hands content to standard system services without maintaining custom integrations. |
| iOS `UIDocumentPickerViewController(forExporting:asCopy:)` | iOS 17 platform | Explicit “Save to Files” / download destination | Use only if product copy requires a separate download action instead of relying on the activity sheet. Export a local validated copy; never pass a signed remote URL. |
| Foundation account-scoped file cache | iOS 17 platform; existing pattern | Calm offline gallery metadata | Reuse the actor + atomic JSON + `completeUnlessOpen` file-protection pattern from `FileChatDraftStore`. Keep a bounded set of previously loaded gallery metadata per account/conversation and purge it on sign-out or identity change. Adding SwiftData/Core Data only for this cache is not warranted. |

### Development and Verification Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase migration + RLS verification scripts | Prove unrelated users cannot enumerate content, deleted sources disappear, and only senders can delete | Add live two-member plus unrelated-account checks. Test page cursors with identical timestamps and multi-attachment messages. |
| Shared JSON fixture vectors | Cross-platform gallery reducer/category/page-merge parity | Follow the existing `@fish/core` → Kotlin/Swift fixture pattern for categories, same-timestamp ordering, URL expiry, offline cache, deletion, and retry. Fixtures contain metadata only, never signed URLs. |
| Android Room migration/instrumentation tests | Verify cached metadata is account/conversation scoped and signed URLs never persist | Extend the existing schema export and migration tests. |
| Android Compose accessibility/screenshot tests | Grid/list, loading, empty, offline, failure, large font, RTL, light/dark | Reuse existing screenshot tooling; use stable keys and ensure source-message focus navigation is testable. |
| iOS XCTest + SnapshotTesting 1.19.3 (resolved) | State, navigation, Dynamic Type, VoiceOver labels, RTL, theme, and iPad width | Reuse current package and snapshot matrix. Add tests that player/image work starts only for visible/selected items. |
| `EXPLAIN (ANALYZE, BUFFERS)` on representative data | Validate page query/index shape before release | The existing message/attachment indexes are likely sufficient. Add an index only when the actual gallery query plan proves a need. |

## Required Backend Change

Add a single read-only database contract such as `list_conversation_shared_content`. It should be `stable`, run as the authenticated caller (`security invoker`), and return a normalized page rather than exposing storage internals or forcing each client to assemble multiple inconsistent queries.

Recommended result fields:

```text
content_id             stable typed ID (for example attachment:<uuid>, gif:<message-id>)
source_message_id      canonical navigation/deletion target
conversation_id
sender_id
shared_at              messages.created_at, not upload initialization time
position               attachment position within its source message
category               media | documents | other
content_type           image | video | voice | document | gif | sticker | link
original_name / mime_type / byte_size / width / height
thumbnail_path / display_path
provider metadata      only for existing GIF/link/sticker content
```

The query must:

- require `private.is_conversation_member(p_conversation_id)` and still rely on table RLS;
- include only non-deleted source messages and only `status = 'ready'` attachments;
- normalize every already-supported content type: images, MP4 video, AAC/M4A voice attachments, documents, provider GIFs, bundled stickers, and server-generated link previews;
- classify by stored MIME type rather than `message_attachments.kind`, because existing voice and video records intentionally remain `kind = 'file'` for backward compatibility;
- order newest-first with a deterministic keyset cursor such as `(shared_at, source_message_id, content_id)` and fetch `page_size + 1` rows; do not use offset pagination or a total-count query;
- return storage paths and stable metadata, **not signed URLs**;
- cap a page at no more than 40 content items so one page’s private attachments always fits the existing 50-ID URL-refresh limit.

The current indexes already support the preferred message-first plan:

- `messages (conversation_id, created_at, id)` can be scanned backward for newest-first `ORDER BY ... LIMIT`;
- `message_attachments (message_id)` resolves the small 0–5 attachment join;
- GIF and link-preview `message_id` keys, and the existing message-embed index, resolve the remaining content joins.

Do **not** create a duplicated “gallery items” table or materialized view in the first implementation. It would require triggers for send, edit, soft-delete, GIF/link hydration, and attachment processing, creating a second authority that can drift. If production `EXPLAIN` evidence later shows the normalized RPC is too slow, add a targeted partial index for ready attachments before denormalizing data.

## Delivery URL and Privacy Contract

Metadata access and byte delivery must remain separate:

1. The native app loads a bounded metadata page under RLS.
2. It asks `chat-image-command` for URLs only for attachment IDs in or near the visible viewport, in one batch of at most 50.
3. The app renders with the existing image/player/downloader stack.
4. On 400/401/403 from an expired URL, it refreshes once and retries once; an offline failure becomes a calm manual retry, not an automatic loop.

Rules:

- Keep the existing private bucket and 15-minute URL TTL. Do not lengthen it for scrolling convenience.
- Treat a signed URL as a bearer credential. Never store it in Room, the iOS metadata file, logs, analytics, notification payloads, or shared reducer fixtures.
- Key caches by stable attachment/storage identity. A rotating query token must not create duplicate disk entries.
- Purge account-scoped metadata and private media caches on sign-out or verified identity change, following the existing chat identity-purge rule.
- The existing `delete_chat_message`/chat command remains the only delete action. It proves the caller is the sender, soft-deletes the source message, and immediately makes the attachment row/object fail future RLS-backed discovery and URL issuance.
- An already issued signed URL remains valid until its short expiry; Supabase documents that signed URLs cannot be individually revoked by the app. Locally cached, shared, or saved copies also cannot be recalled. This is a product/privacy fact to test and document, not a reason to bypass the established delete boundary.
- GIF media remains provider-hosted and stickers remain bundled assets. Their gallery metadata is private because the message is private, but they do not need Supabase attachment URLs.

## Native Integration Points

### Android

- Add gallery contracts and implementations inside the existing `ChatRepository` / `data:chat` boundary; keep UI state and Compose screens in `feature:chat`; keep Activity Result, `FileProvider`, and external intent ownership in `app`.
- Reuse Room as the offline source. A DAO projection can join cached messages and attachments; add only bounded cached metadata required for GIF/link/sticker rows that is not already retained in `MessageEntity` JSON fields.
- Render images/videos in a `LazyVerticalGrid`; render documents/other content in a `LazyColumn` or full-span grid items. Use stable content IDs and preserve scroll state while pages merge.
- Reuse Coil requests with stable memory/disk cache keys, Media3 for selected video/audio, and the current validated attachment downloader for open/share.
- Add one native export launcher (`CreateDocument`) for explicit download. Do not request `MANAGE_EXTERNAL_STORAGE` or broad media permissions.
- “Jump to message” passes `source_message_id` through the existing conversation route/focus mechanism and lets the authoritative transcript load the needed page.

### iOS

- Add a gallery provider protocol/value types to `ChatData`; add screen/view model/state to `PersonalChat`; construct the live adapter at the app boundary. Keep Supabase and URLSession details out of SwiftUI views.
- Use `ScrollView` + `LazyVGrid`/lazy rows and stable IDs. Load only a bounded newest page and request the next page near the end.
- Reuse `MessageImageLoader`, `AttachmentFileDownloader`, `AttachmentViewer`, Quick Look, the existing video/voice players, and `AttachmentActivitySheet`.
- Use `UIDocumentPickerViewController(forExporting:asCopy:)` only for an explicit save/download destination. Prefer the existing activity sheet when one native system surface can cover both sharing and saving without another choice in the gallery UI.
- Keep offline metadata in a bounded, account-hashed, atomically written, file-protected cache using the current `FileChatDraftStore` pattern. Cached thumbnails stay in the existing image cache. Do not persist delivery URLs.
- “Jump to message” dismisses the gallery, asks the canonical `ConversationStore` to focus `source_message_id`, and lets existing message paging fetch it if outside the current window.

## Installation

No runtime dependency installation is recommended.

```text
Android: no Gradle catalog additions
iOS:     no Swift Package additions
Backend: one Supabase SQL migration; reuse existing Edge Functions
```

Do not combine this milestone with unrelated dependency upgrades. The repository-pinned versions already satisfy the deployed platform minimums and gallery APIs.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| One normalized RLS-safe Postgres RPC | Multiple client-side table queries and joins | Only for a single homogeneous table. The gallery spans attachments, GIFs, stickers, links, messages, and categories, so a shared server contract prevents Android/iOS drift and N+1 fetching. |
| Existing manual keyset page state | Android Paging 3 / Room Paging | Consider only if several independent large lists adopt the same paging infrastructure. One gallery beside already manual chat/search paging does not justify another state machine. |
| Existing iOS actor/file cache | SwiftData, Core Data, or GRDB | Consider when the iOS app needs a general durable relational offline store across multiple features. A bounded per-conversation gallery cache alone does not justify it. |
| Existing Coil / ImageIO loaders | Glide, Picasso, Nuke, or Kingfisher | Consider only during an app-wide image-pipeline replacement backed by measured problems. Mixing loaders duplicates caches and URL-expiry behavior. |
| Existing Edge Function signed URLs | Direct public URLs or mobile service-role access | Never for private conversation content. Public URLs remove access checks; a service-role secret in a mobile build compromises the entire project. |
| Native system preview/share/export | Custom document renderer and per-destination share integrations | Consider custom rendering only for a validated file type Quick Look/system apps cannot handle. Current allowed types are covered by native surfaces. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New Express/Node API, separate media service, or Firebase Storage | Splits authorization and operations across backends and violates the project boundary | Supabase Postgres, Storage, RLS, and existing Edge Functions |
| Public Storage bucket or long-lived public download URL | Anyone with the URL can read private coaching content; deletion cannot restore secrecy | Existing private bucket + short-lived signed URLs |
| Service-role key in Android/iOS | Bypasses RLS for the whole project | Caller JWT through PostgREST/Edge Functions |
| Direct writes/deletes to `storage.objects` | Supabase documents the storage schema as read-only metadata; direct mutation can orphan underlying objects | Storage API and existing cleanup command |
| A duplicated gallery authority table at launch | Requires complex trigger synchronization and creates deletion/privacy drift | Read-time normalized RPC over canonical chat tables |
| Offset pagination or loading the full conversation | Becomes slower and unstable as messages are added/deleted | Deterministic keyset pagination with `page_size + 1` |
| Persisting signed URLs | Tokens expire, leak into backups/logs, and poison caches | Persist stable paths/IDs only; refresh near use |
| Background predownload of the whole gallery | Wastes data/storage, expands private-data exposure, and adds WorkManager/background-session complexity | Viewport-driven thumbnails and user-initiated full downloads |
| New video/audio/voice upload or transcoding code | Explicitly outside the milestone | Index and display only the existing attachment records |
| Mobile home/dashboard/content catalog | Outside direct-chat-only native scope and adds choices | Conversation-scoped gallery entry from header/details only |

## Version Compatibility

| Package / API | Compatible With | Notes |
|---------------|-----------------|-------|
| Room 2.8.4 | FISH min SDK 26 | Official Room notes set the 2.8 line minimum to API 23, so the current app minimum is safe. |
| Coil 3.5.0 | FISH min SDK 26 | Coil 3.5 requires API 23 and supports configurable memory/disk caches. Current `coil-compose` + `coil-network-okhttp` is sufficient. |
| WorkManager 2.11.0 | FISH min SDK 26 | Existing upload recovery only. Gallery reads/exports do not need new workers. |
| supabase-kt 3.6.0 | Current Kotlin/Ktor stack | The repository already pins the April 2026 release. Reuse auth, PostgREST, functions, and Realtime modules already installed. |
| Swift 6 / iOS 17 | supabase-swift 2.52.0 resolved | Existing package resolution and deployment target are compatible. The gallery needs no additional Supabase product. |
| Quick Look / AVKit / UIKit activity and document picker | iOS 17 | All are system frameworks and require no package or deployment-target increase. |

## Sources

### Primary platform and service documentation

- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) — private Storage operations use RLS; service keys bypass RLS and must not be shipped to clients. **Confidence: HIGH.**
- [Supabase private bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals) — private downloads require an authenticated request or limited-time signed URL. **Confidence: HIGH.**
- [Supabase serving/downloading assets](https://supabase.com/docs/guides/storage/serving/downloads) — signed URLs are time-limited and remain valid until expiry. **Confidence: HIGH.**
- [Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design) — treat Storage tables as read-only and use the API for mutation. **Confidence: HIGH.**
- [Android Compose lazy lists and grids](https://developer.android.com/develop/ui/compose/lists) — lazy containers compose/layout viewport content and support stable keys/adaptive grids. **Confidence: HIGH.**
- [Android FileProvider](https://developer.android.com/reference/androidx/core/content/FileProvider.html) — secure temporary `content://` sharing with URI grants. **Confidence: HIGH.**
- [Android Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files) — `ACTION_CREATE_DOCUMENT` lets the user choose an export destination without system storage permissions. **Confidence: HIGH.**
- [Apple LazyVGrid](https://developer.apple.com/documentation/swiftui/lazyvgrid) — creates grid items only as needed. **Confidence: HIGH.**
- [Apple Quick Look](https://developer.apple.com/documentation/quicklook/) — native preview support for current allowed document, image, audio, and video types. **Confidence: HIGH.**
- [Apple UIActivityViewController](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller) — standard system services for sharing local items. **Confidence: HIGH.**
- [Apple UIDocumentPickerViewController](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller) — native export/copy to destinations outside the app sandbox. **Confidence: HIGH.**
- [Apple AVKit](https://developer.apple.com/documentation/avkit/) — native playback surfaces and controls. **Confidence: HIGH.**
- [PostgreSQL indexes and ORDER BY](https://www.postgresql.org/docs/current/indexes-ordering.html) — matching B-tree ordering makes `ORDER BY ... LIMIT` efficient. **Confidence: HIGH.**
- [Room 2.8.4 release notes](https://developer.android.com/jetpack/androidx/releases/room) — version and minimum-SDK compatibility. **Confidence: HIGH.**
- [Coil image loader/caching documentation](https://coil-kt.github.io/coil/image_loaders/) and [Coil 3.5 changelog](https://coil-kt.github.io/coil/changelog/) — memory/disk cache behavior and current pinned version. **Confidence: HIGH.**
- [supabase-kt repository/releases](https://github.com/supabase-community/supabase-kt) — 3.6.0 release and module surface. **Confidence: HIGH.**

### Repository evidence

- `apps/android/gradle/libs.versions.toml`, `data/chat`, `feature/chat`, and `AttachmentFileOpener.kt` — pinned dependencies, Room boundary, signed-URL handling, stable Coil cache identity, Media3 playback, and safe native handoff.
- `apps/ios/FishKit/Package.swift`, `Package.resolved`, `ChatData`, `MessageImageLoader.swift`, `AttachmentFileDownloader.swift`, `AttachmentViewer.swift`, `MessageFileCard.swift`, and `AttachmentActivitySheet.swift` — platform/dependency baseline and reusable native preview/share/cache paths.
- `supabase/migrations/0017_chat_images.sql`, `0018_chat_file_attachments.sql`, `0026_chat_gifs.sql`, `0030_chat_stickers.sql`, `0055_chat_voice_messages.sql`, `0058_chat_link_previews.sql`, and `0060_chat_video_attachments.sql` — canonical supported-content model and RLS policies.
- `supabase/functions/chat-image-command/index.ts` and `supabase/migrations/0013_realtime_chat_features.sql` — 15-minute signed URL batching and sender-only source-message deletion.

**Research tooling note:** The prescribed local `gsd-tools` research-plan/classify-confidence command was not installed in this workspace. Confidence labels above are therefore derived directly from primary official documentation plus the checked-in implementation and lockfiles; no low-confidence community source is used for a recommendation.

---
*Stack research for: FISH v1.3 shared conversation content*
*Researched: 2026-07-22*
