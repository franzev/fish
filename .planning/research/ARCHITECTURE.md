# Architecture Research

**Domain:** Per-conversation shared-content galleries in existing native direct-chat apps
**Researched:** 2026-07-22
**Confidence:** HIGH for repository integration; MEDIUM for framework details verified through current official documentation

## Executive Recommendation

Build the gallery as a **separate, bounded read model over the existing chat attachment authority**, not as another message timeline and not as a new sending system. Postgres, `message_attachments`, `messages`, private Storage, RLS, `refresh-attachment-urls`, and `delete_chat_message` remain authoritative. Android and iOS add native gallery state, caches, and presentation adapters, but they do not duplicate authorization or invent attachment formats.

The backend should expose one security-invoker, keyset-paginated RPC that returns stable metadata only. It must return source message identity, sender identity, message date, attachment metadata, and a server-derived category, while excluding deleted messages, unbound rows, and non-ready attachments. Signed URLs stay ephemeral and are requested only for visible thumbnails or a selected action through the existing Edge Function.

Do not put gallery state into the portable chat reducer. Gallery loading, filters, and paging have an independent lifecycle. Instead, add a small cross-platform `shared-content` contract and replayable JSON fixtures for category mapping, cursor ordering, page merge/deduplication, cached/offline/error transitions, sibling removal after source-message deletion, and capability derivation.

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Native direct-chat UI                                                │
│                                                                      │
│ Android feature:chat                 iOS PersonalChat                │
│ ├─ conversation header/details       ├─ header/details callbacks     │
│ ├─ SharedContentScreen               ├─ SharedContentScreen          │
│ └─ SharedContentViewModel            └─ SharedContentStore           │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ provider-neutral intents/state
┌───────────────────────────────▼──────────────────────────────────────┐
│ Native chat data boundary                                            │
│                                                                      │
│ SharedContentRepository / SharedContentProviding                     │
│ ├─ metadata cache (identity + conversation scoped)                   │
│ ├─ gallery RPC adapter                                               │
│ ├─ existing refreshAttachmentUrls adapter                            │
│ └─ existing delete-message command adapter                           │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │ stable metadata                │ command/delivery
┌───────────────▼───────────────────────────────▼──────────────────────┐
│ Supabase                                                             │
│                                                                      │
│ list_conversation_shared_content RPC                                 │
│   -> messages + message_attachments under caller RLS                 │
│ chat-image-command: refresh-attachment-urls                          │
│ chat-command: delete-message -> delete_chat_message                  │
│ private chat-images bucket + storage.objects RLS                     │
└──────────────────────────────────────────────────────────────────────┘
```

The conversation remains the ownership boundary. No API accepts an attachment ID without ultimately proving that the authenticated caller can still read its ready, bound, non-deleted source message.

### Component Responsibilities

| Component | New or modified | Responsibility | Typical implementation |
|---|---|---|---|
| `list_conversation_shared_content` | New | Authoritative, bounded gallery metadata read | `public` SQL RPC, `security invoker`, explicit conversation filter, RLS-preserving joins, composite cursor |
| `private.chat_attachment_category` | New | One authoritative MIME-to-category mapping | Immutable SQL helper tested against shared fixtures |
| Attachment/message indexes | Modified | Support newest-first message scan and attachment lookup | Reuse `messages_conversation_created_id_idx`; add a partial ready/bound attachment lookup index only if `EXPLAIN` proves useful |
| `refresh-attachment-urls` | Reused | Mint 15-minute delivery URLs after caller-scoped reads | Existing `chat-image-command`; no gallery-specific signer |
| `delete_chat_message` | Reused | Sender-only deletion of the entire source message | Existing `chat-command` action and RPC; never delete an attachment row directly |
| Shared-content contract | New | Categories, DTOs, cursor, capabilities, state semantics | `packages/core/src/shared-content`, protocol doc, JSON vectors |
| Android shared-content repository | New within existing `data:chat` module | RPC paging, Room cache, URL refresh, deletion reconciliation | Provider-neutral interface plus internal Supabase/Room adapters |
| Android gallery UI | New within existing `feature:chat` module | Screen, item list/grid, category navigation, actions, calm states | Compose screen + conversation-scoped ViewModel; no new Gradle feature module |
| Android file gateway | Modified | Open/share/save a verified downloaded file through system surfaces | Refactor `AttachmentFileOpener` into shared open/share/save gateway; `FileProvider` + `ACTION_CREATE_DOCUMENT` |
| iOS shared-content provider | New within `ChatData` | RPC paging and stable DTO mapping | Foundation-only protocol + REST/RPC adapter |
| iOS gallery cache | New within `ChatData` | Identity-scoped, bounded stable metadata cache | Actor-backed versioned Codable snapshot with atomic replacement and purge |
| iOS gallery UI | New within `PersonalChat` | Screen/store, categories, action routing, calm states | SwiftUI screen + `@MainActor @Observable` store; no new SwiftPM product |
| iOS transfer coordinator | Modified/new | Preview/share/export a verified temporary file | Reuse `AttachmentFileDownloader`, `AttachmentViewer`, Quick Look, activity sheet, document picker/exporter |
| Conversation focus path | Modified integration only | Jump from gallery to exact source message | Reuse Android `focusCurrentMessage` and iOS `focusMessage`; do not create a second transcript loader |
| Realtime invalidation | Modified integration only | Remove gallery entries when a source message becomes deleted | Fan the existing conversation-owned message change into gallery cache invalidation; do not subscribe twice |

## Backend Read Model

### RPC Contract

Use an RPC rather than making each native client reproduce a multi-table join, MIME classification, and four-column cursor. It is still a read operation and should run as the caller.

Recommended signature:

```sql
public.list_conversation_shared_content(
  p_conversation_id uuid,
  p_category text default 'all',
  p_before_created_at timestamptz default null,
  p_before_message_id uuid default null,
  p_before_position integer default null,
  p_before_attachment_id uuid default null,
  p_limit integer default 40
)
```

Return only:

```text
attachment_id, message_id, conversation_id, sender_id,
message_created_at, position, category, kind,
original_name, stored_mime_type, stored_byte_size,
width, height, thumbnail_path, display_path,
source_attachment_count, source_has_body
```

Do **not** return `staging_path`, scan metadata, hashes, failure codes, upload credentials, or signed URLs. Those are infrastructure or ephemeral secrets, not gallery presentation data.

The query must require:

```text
message_attachments.status = 'ready'
message_attachments.message_id is not null
messages.deleted_at is null
messages.conversation_id = p_conversation_id
message_attachments.conversation_id = p_conversation_id
```

Define it as `STABLE SECURITY INVOKER SET search_path = ''`, fully qualify every relation, revoke execution from `public` and `anon`, and grant only to `authenticated`. Security-invoker is preferable here because existing `messages` and `message_attachments` RLS already express the correct member boundary. A security-definer RPC would bypass those policies and would need to reproduce them perfectly.

### Category Contract

The database should derive the category once and return it:

| Category | Current attachment MIME coverage |
|---|---|
| `media` | `kind = image`, `audio/*`, `video/*` |
| `documents` | PDF, plain text, CSV, DOCX, XLSX, PPTX |
| `other` | Any future ready attachment not matched above |

`all` is a query filter, not a persisted item category. Validate unknown category inputs by returning no data or a controlled invalid-request error; never interpolate them into SQL.

This scope intentionally treats shared content as **ready, bound `message_attachments`**. That already covers the current photo, document, voice/audio, and MP4 video pipelines without adding a sending format. GIF provider rows, stickers, and link previews are separate message-presentation contracts with different licensing and save semantics. If product requirements intend those to be gallery items too, decide that before the backend RPC is finalized and extend the DTO as a discriminated `source_kind`; do not silently mix them into an attachment-only API later.

### Pagination

Order newest first using a deterministic composite key:

```sql
order by
  message.created_at desc,
  message.id desc,
  attachment.position desc,
  attachment.id desc
```

The cursor is the last retained tuple. The next query applies the matching row comparison and requests `limit + 1`; clients retain `limit` and derive `hasMore` from the sentinel. Clamp `p_limit` to `1..50`; use 40 as the shared default to match existing chat paging.

Require the four cursor fields to be either all null (first page) or all present (continuation). Reject a partial cursor as an invalid request, and encode/decode the tuple through the shared contract so Kotlin and Swift cannot invent different null or ordering behavior.

Offset pagination is not acceptable. Inserts or deletes between pages would create duplicates and gaps, and large offsets would become progressively more expensive.

### Indexing

The existing `messages_conversation_created_id_idx (conversation_id, created_at, id)` already supports the outer scan. The existing attachment message index supports joining. Before adding an index, capture `EXPLAIN (ANALYZE, BUFFERS)` against seeded conversations with realistic attachment density. If lookup cost is material, add:

```sql
create index message_attachments_ready_message_position_idx
on public.message_attachments (message_id, position desc, id desc)
where status = 'ready' and message_id is not null;
```

Do not denormalize message dates onto attachments for the MVP; the maximum five attachments per message and bounded page make the existing join appropriate.

## Cross-Platform Contract

### Stable DTO

```typescript
type SharedContentCategory = "media" | "documents" | "other";

type SharedContentCursor = {
  messageCreatedAt: string;
  messageId: string;
  position: number;
  attachmentId: string;
};

type SharedContentItem = {
  attachmentId: string;
  messageId: string;
  conversationId: string;
  senderId: string;
  messageCreatedAt: string;
  position: number;
  category: SharedContentCategory;
  kind: "image" | "file";
  originalName: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  displayPath: string;
  sourceAttachmentCount: number;
  sourceHasBody: boolean;
};
```

Capabilities are derived, not trusted from the server:

```text
canPreview = MIME supported by the platform viewer
canOpen = stable display path exists and MIME is allowed
canShare = downloadable MIME is allowed
canSave = downloadable MIME is allowed
canDeleteSource = item.senderId == currentUserId
canJump = source message identity exists
```

The server still enforces every action. `canDeleteSource` only controls presentation.

### Required Fixtures

Add `packages/core/src/shared-content/fixtures/shared-content-vectors.json` and sync it into Android and iOS test resources using the existing chat-vector script pattern. Include vectors for:

1. every current MIME mapping, plus an unknown future MIME;
2. equal timestamps, multiple messages, and five attachments in one message;
3. page overlap deduplication and stable cursor continuation;
4. initial loading, cached-refreshing, empty, offline-with-cache, offline-empty, failed, retrying, append-failed, and recovered states;
5. URL expiry without metadata loss;
6. deleting one source message removing all sibling attachment items;
7. recipient presentation never exposing delete;
8. a missing/deleted jump target producing the same calm unavailable outcome;
9. identity change purging all metadata and delivery state.

Keep the fixture contract separate from `chat-state-vectors.json`; gallery paging must not increase the core message reducer's authority.

## Native Data and Cache Design

### Shared Rules

- Persist stable metadata and storage paths only. Never persist signed URLs.
- Scope every cache key by verified authenticated user ID and conversation ID.
- Keep up to five 40-item pages (200 items) per conversation/category by default; older content remains remotely pageable. Make the bound a named contract constant.
- Refresh the first page on entry, foreground return, and reconnect. Coalesce concurrent refreshes and allow one automatic retry, then present a manual retry.
- Batch visible thumbnail URL requests and use the existing 50-ID Edge Function ceiling. A 12-20 item prefetch batch is sufficient; never refresh every historical URL on open.
- Treat cached metadata as presentation continuity, never authorization. Online open/share/save/delete always crosses the current server boundary.
- Purge metadata, in-memory URLs, decoded media, downloaded temporary files, and remote keys on sign-out or verified identity change.

### Android

Keep the work inside the existing `data:chat` and `feature:chat` modules, consistent with ADR 0002's consolidation.

Add Room entities:

```text
shared_content_items
  owner_user_id + conversation_id + attachment_id (primary identity)
  stable SharedContentItem fields
  fetched_category + fetched_at

shared_content_remote_keys
  owner_user_id + conversation_id + category (primary key)
  four cursor fields + has_more + refreshed_at
```

Use a Room migration from the current schema version 8. The DAO should expose a category-filtered `Flow`, upsert a page and remote key in one transaction, delete all items for a source `message_id`, trim beyond the cache bound, and clear all gallery rows with existing user-data purge operations.

`SharedContentRepository` should read only from Room and update Room after RPC results, matching Android's official offline-first guidance and the current chat repository pattern. A network failure with cache returns cached content plus an offline/failure status; it does not blank the gallery. A network failure without cache returns the calm offline-empty state.

The existing conversation Realtime subscription remains single-owner. Extend message reconciliation so a message tombstone deletes matching `shared_content_items`; do not start a second Supabase channel from the gallery.

Refactor `AttachmentFileOpener` into an app-owned transfer gateway shared by transcript and gallery:

```text
Open  -> verified cache file -> ACTION_VIEW
Share -> verified cache file -> FileProvider URI -> ACTION_SEND
Save  -> ACTION_CREATE_DOCUMENT -> bounded copy into user-selected URI
```

The existing 25 MiB bound, MIME/signature checks, host allow-list, `FileProvider`, temporary URI grants, one-day cache cleanup, and sign-out cleanup remain mandatory. Images may continue through the existing photo viewer and Coil cache; audio/video should reuse current Media3 playback rather than launch a second media stack.

### iOS

Add `SharedContentProviding` and `SharedContentCaching` protocols to `ChatData`; keep Supabase types internal. The live session composes the RPC adapter, existing attachment commands, and an identity-scoped cache.

Use an actor-backed, versioned Codable cache in Application Support (or Caches if product accepts purgeable offline metadata). Write atomically, set an appropriate data-protection class, keep the same 200-item/category bound, and key files by a hash of user ID + conversation ID rather than names. The gallery reads the cached snapshot immediately and refreshes it in the background.

Do not add SwiftData solely for this feature. The current app has no general iOS message database, and a small versioned cache behind a protocol is easier to test, purge, and replace when broader offline persistence is justified.

Reuse `MessageImageLoader`, `AttachmentFileDownloader`, `AttachmentViewer`, existing AV playback, and `AttachmentActivitySheet`. Add one transfer coordinator that owns temporary-file lifetime:

```text
Preview document -> verified temporary file -> Quick Look
Share            -> verified temporary file -> UIActivityViewController
Save to Files    -> verified temporary file -> document picker/file exporter
Close/completion -> remove temporary file unless system handoff still owns it
```

Current sign-out does not visibly call `MessageImageLoader.removeAll()`. This milestone should close that gap: purge decoded/disk attachment media, gallery metadata, and temporary downloads whenever the authenticated identity changes.

The active `ConversationStore` remains the one Realtime owner. Forward its normalized `ChatMessage` changes to a small cache invalidator so deleted source messages disappear from an open gallery without creating another channel.

## Presentation and Navigation Boundaries

### Android Structure

```text
apps/android/
├── data/chat/src/main/.../data/chat/
│   ├── sharedcontent/SharedContentModels.kt          # new
│   ├── sharedcontent/SharedContentRepository.kt      # new public port
│   ├── sharedcontent/DefaultSharedContentRepository.kt
│   ├── remote/SharedContentRemoteDataSource.kt       # new internal adapter
│   └── local/                                        # modify DB, DAO, entities, migration
├── feature/chat/src/main/.../feature/chat/
│   ├── sharedcontent/SharedContentViewModel.kt       # new
│   ├── sharedcontent/SharedContentScreen.kt          # new
│   ├── sharedcontent/SharedContentModels.kt           # UI-only models
│   ├── ChatRoute.kt                                  # modify destination orchestration
│   ├── ChatComponents.kt                             # add quiet header entry
│   └── ParticipantDetailsSheet.kt                    # add details entry
└── app/src/main/.../
    ├── AttachmentFileOpener.kt                       # refactor to transfer gateway
    └── MainActivity.kt                               # activity-result save/open/share host
```

The gallery is a destination within direct chat, not a new top-level app destination. Keep `ChatViewModel` alive while it is shown. On jump, close the gallery and call the existing `focusCurrentMessage(messageId)` path; its generation/cancellation logic already prevents stale focus results.

### iOS Structure

```text
apps/ios/FishKit/Sources/
├── ChatData/
│   ├── Models/SharedContent.swift                    # new stable DTOs
│   ├── Providers/SharedContentProviding.swift        # new port
│   ├── Providers/SharedContentCaching.swift          # new cache port
│   └── Adapters/
│       ├── RestSharedContent.swift                   # new RPC adapter
│       └── FileSharedContentCache.swift              # new identity cache
└── PersonalChat/
    ├── Models/SharedContentUiModel.swift             # new
    ├── ViewModels/SharedContentStore.swift           # new independent state owner
    ├── Screens/SharedContentScreen.swift             # new
    ├── Views/SharedContentItemView.swift              # new
    ├── Views/ConversationDetailsView.swift            # new/modified direct-chat support
    ├── ViewModels/AttachmentFileDownloader.swift      # reuse/extend
    ├── Views/AttachmentViewer.swift                   # reuse/extend
    ├── Screens/PersonalChatScreen.swift               # add entry callback only
    └── ViewModels/ConversationStore.swift              # external focus + invalidation integration
```

Do not create a new SwiftPM target. The gallery is a direct-chat subfeature; `ChatData` already owns its transport boundary and `PersonalChat` already owns native chat presentation.

Both platforms expose two entry callbacks to the same destination: one quiet labeled/icon entry in the conversation header and one row in conversation details. They must not instantiate separate stores or caches.

## Key Data Flows

### Open and Page

```text
Tap shared content
  -> validate active authorized conversation
  -> render identity-scoped cached metadata immediately
  -> RPC first page (40 + 1)
  -> transactionally merge stable rows + cursor
  -> request signed thumbnail URLs only for visible media
  -> render category/list state

Near end of list
  -> read category cursor
  -> one in-flight load-more request
  -> RPC next 40 + 1
  -> dedupe by attachment_id and persist cursor atomically
```

Every async request carries `ownerUserId + conversationId + category + generation`. Drop a response when any field no longer matches the active store.

### Preview, Open, Share, Save

```text
Select item
  -> check stable MIME/path capability
  -> use in-memory URL if valid beyond refresh margin
  -> otherwise refresh one attachment ID through existing Edge Function
  -> trusted-host + bounded-byte download
  -> verify expected length and supported format
  -> native viewer / share sheet / save picker
  -> delete transient file after handoff lifecycle completes
```

Do not expose the signed URL to generic external apps. Download inside FISH and hand off a local content/file URL with temporary access.

### Jump to Source Message

```text
Tap “View in conversation”
  -> close gallery while preserving gallery cache/scroll state
  -> invoke existing exact-message focus(message_id)
  -> if locally loaded: center and highlight
  -> otherwise fetch the exact message through existing authorized refresh path
  -> merge into transcript state and focus
  -> if RLS returns no row/deleted: “Earlier message unavailable”
```

Do not page backward repeatedly to find the source. Both native apps already support exact-message fetch and focus. The source message can appear as a temporary island in the bounded transcript; later normal paging may fill surrounding context.

### Delete Source Message

```text
Sender chooses delete source message
  -> UI derives sender ownership but server remains authoritative
  -> confirmation explains whether body/sibling attachments also disappear
  -> mark every gallery item with the same message_id busy
  -> existing chat-command delete-message
  -> delete_chat_message verifies authenticated sender
  -> returned tombstone reconciles transcript
  -> remove all cached gallery siblings by message_id
  -> discard in-memory URLs and temporary files for those attachment IDs
  -> Realtime delivers the same tombstone to the other participant
```

Never call `DELETE` on `message_attachments`. The product action is deletion of the source message for everyone. One source message can contain up to five attachments and text, so item-level wording that implies only one file disappears would be incorrect.

## State Model

Use the same semantic states on both platforms:

| State | Cached items | Network | Presentation |
|---|---:|---|---|
| `initialLoading` | No | Pending | Stable skeleton/status, no blank screen |
| `refreshingCached` | Yes | Pending | Cached content remains visible with quiet refresh status |
| `ready` | Any | Healthy | Content or genuine empty state |
| `offlineCached` | Yes | Offline | Cached content visible; open/share/save requiring refresh may explain connection need |
| `offlineEmpty` | No | Offline | Calm explanation and one retry action |
| `initialFailure` | No | Failed | Calm failure and one retry action |
| `appendFailure` | Yes | Failed | Existing items remain; one manual “Try again” row |
| `deletingSource` | Yes | Command pending | Source siblings disabled without layout shift |

Exactly one automatic retry is allowed for a transient first-page or append failure. Authorization failures are not retried until identity/conversation state changes.

## Security Boundaries

1. **RLS is authoritative for reads.** RPC security-invoker plus existing policies must hide non-member, non-ready, unbound, and deleted-source rows.
2. **The existing command is authoritative for deletion.** Sender-only UI is convenience; `delete_chat_message` is enforcement.
3. **Private object delivery remains private.** Use only the existing caller-scoped signed-URL Edge action; keep its 50-ID maximum and 15-minute lifetime.
4. **Signed URLs are secrets.** Never write them to Room, Codable snapshots, analytics, logs, crash breadcrumbs, clipboard, or navigation state.
5. **Stable paths are internal metadata.** They may be cached inside the authenticated app sandbox but never shared externally.
6. **Download validation remains mandatory.** Enforce host allow-list, no redirects unless explicitly revalidated, expected byte length, maximum size, MIME allow-list, and file signatures/container checks before opening or sharing.
7. **Identity change is a revocation event.** Cancel requests, invalidate generations, clear metadata caches, decoded media, temporary downloads, delivery URLs, and gallery route state.
8. **Deleted items lose delivery.** After deletion, both `message_attachments` RLS and `storage.objects` RLS should prevent URL refresh; regression-test this explicitly.
9. **No service-role key enters native code.** Native clients use the authenticated JWT only.

## Verification Matrix

### Backend

- Member client and coach receive the same ordered page for their direct conversation.
- Outsider, signed-out caller, blocked/revoked conversation member, and cross-conversation cursor receive no protected rows.
- Pending, failed, cancelled, unbound, and deleted-source attachments never appear.
- Equal timestamps and multi-attachment messages produce no duplicate or missing rows across pages.
- Every currently supported MIME maps to the fixture category.
- Recipient delete fails without revealing whether the message exists; sender delete removes all source siblings from subsequent gallery reads.
- Signed URL refresh succeeds before deletion and fails after deletion.
- Query plan remains index-backed at realistic seeded volume.

### Android

- Room migration 8→new version preserves existing chat/drafts and adds gallery tables.
- DAO transaction tests cover page merge, cursor update, sibling deletion, trim, and identity purge.
- Repository tests cover cache-first load, offline cache, offline empty, one retry, stale response suppression, and expired URL refresh.
- Existing focus tests are reused for gallery jump.
- Transfer tests cover FileProvider grants, ACTION_CREATE_DOCUMENT save, size mismatch, MIME/signature mismatch, host rejection, no-handler failure, temp cleanup, and sign-out cleanup.
- Compose screenshot/accessibility tests cover light/dark, compact/expanded, large font, RTL, loading, empty, offline, failure, append failure, and delete confirmation.

### iOS

- Codable cache tests cover version migration/rejection, atomic replacement, 200-item trim, identity scoping, corruption fallback, and purge.
- Store tests replay shared vectors and cover cancellation/generation rules.
- Existing focus tests are reused for gallery jump.
- Downloader/transfer tests cover URL refresh, host rejection, exact byte-size validation, Quick Look handoff, activity share, export completion/cancellation, and temp cleanup.
- Snapshot and accessibility audit coverage matches Android states, including Dynamic Type, RTL, Reduce Motion, VoiceOver names, and iPad share-sheet anchoring.
- Sign-out tests prove `MessageImageLoader`, gallery metadata, and temporary files are cleared.

## Scaling Considerations

| Scale | Architecture adjustment |
|---|---|
| Pilot / under 1K users | RPC + existing primary database + private Storage; 40-item pages and native bounded caches are sufficient |
| 1K-100K users | Inspect RPC latency and index hit rate; tune the partial attachment index, cache signed thumbnails at the CDN edge as already supported, and monitor Edge URL-refresh batch/error rates |
| 100K+ users | Consider a server-maintained shared-content projection only if measured join cost or multi-source gallery requirements justify it; preserve the same DTO/cursor and RLS boundary |

The likely first bottleneck is thumbnail delivery and decode memory, not the metadata join. The second is repeated URL signing if clients refresh offscreen history. Visible-only batching and stable-path binary cache keys address both without new infrastructure.

## Anti-Patterns

### Scanning the Local Transcript

**What people do:** Build the gallery from attachments currently loaded in the 40-message timeline window.
**Why it is wrong:** Older content disappears, results depend on chat paging, and Android/iOS drift according to cache history.
**Do this instead:** Query an independent authoritative gallery page by conversation and category.

### Persisting Signed URLs

**What people do:** Store signed URLs beside attachment metadata for offline rendering.
**Why it is wrong:** URLs expire, can leak through backups/logs, and make cache identity unstable.
**Do this instead:** Persist paths and metadata; keep deliveries memory-only and refresh on demand.

### A Second Realtime Subscription

**What people do:** Let the gallery subscribe directly to the same conversation messages.
**Why it is wrong:** It duplicates channels, reconnect recovery, races, and battery/network work.
**Do this instead:** Fan normalized message changes from the existing conversation owner into gallery invalidation.

### Attachment-Level Deletion

**What people do:** Delete `message_attachments` because the user selected one gallery tile.
**Why it is wrong:** It bypasses established message semantics, can orphan message content, and changes the authorization model.
**Do this instead:** Delete the source message through `chat-command` and remove every sibling gallery item.

### Full-History URL Hydration

**What people do:** Sign URLs for every cached item when the gallery opens.
**Why it is wrong:** It creates unnecessary Edge/Storage load and most URLs expire unused.
**Do this instead:** Sign visible/prefetch-window media in bounded batches and selected files individually.

### New Native Modules for Every Screen

**What people do:** Add another Android Gradle feature and iOS SwiftPM product for this one chat subflow.
**Why it is wrong:** It works against the repository's consolidated chat boundaries and creates navigation/dependency ceremony without isolating a provider.
**Do this instead:** Add clear packages/folders inside `feature:chat`/`PersonalChat`, with transport ports in `data:chat`/`ChatData`.

## Dependency-Ordered Build Plan

1. **Lock the content and parity contract.**
   - Decide that the initial source is ready, bound `message_attachments`, or explicitly expand to GIF/sticker/link unions before schema work.
   - Define categories, cursor, DTO, capability/action semantics, cache bound, state vocabulary, and JSON fixtures.
   - Add fixture sync/check scripts for Android and iOS.

2. **Ship the backend read boundary and security verification.**
   - Add category helper, gallery RPC, grants, and only the index justified by `EXPLAIN`.
   - Extend `verify-chat-attachments.ts` with authorization, pagination, deleted-source, and URL-revocation cases.
   - Regenerate `packages/supabase` database types.
   - This phase blocks all live native work; finish it before platform UI implementation.

3. **Build native data/cache foundations in parallel.**
   - Android: Room migration/entities/DAO, remote adapter, repository, URL-delivery reuse, identity purge.
   - iOS: provider protocol/adapter, actor cache, live-session composition, identity purge.
   - Both replay the same category/page/state fixtures before screens are added.

4. **Add browse UI and both entry points in parallel.**
   - Implement loading/cached/empty/offline/failure/append states and category navigation.
   - Wire header and conversation-details entries to one gallery store per conversation.
   - Keep the chat ViewModel/ConversationStore alive behind the destination.

5. **Integrate preview/open/share/save using existing transfer stacks.**
   - Extract common attachment presentation models where current viewers are message-specific.
   - Add visible-only URL batching, refresh margin, verified download, Android save picker, iOS Quick Look/export, and cleanup.
   - Do not add sending formats or a second media framework.

6. **Integrate jump and source-message deletion.**
   - Reuse exact-message focus paths.
   - Reuse `chat-command` deletion, show sibling/body consequences, reconcile tombstones into transcript and gallery caches, and handle remote deletion while open.

7. **Run parity, security, and performance gates.**
   - Replay shared fixtures on TypeScript, Kotlin, and Swift.
   - Run RLS/storage verification, Room migration tests, Swift cache tests, accessibility/snapshot suites, physical-device file handoff, large-history pagination, memory profiling, and identity-switch tests.
   - Roll out behind a staff/pilot flag only if URL-refresh failure rate, gallery first-content time, memory, and delete/jump correctness meet the agreed thresholds.

### Ordering Rationale

The RPC and shared DTO must precede platform work because they determine cache schema, cursors, category behavior, and fixtures. Native data layers can then proceed in parallel. Browse UI comes before platform actions so loading and authorization behavior can be verified with fake repositories. Preview/share/save follow because they depend on stable item metadata and URL refresh. Jump and deletion are integrated after both stores exist, when cross-surface reconciliation can be tested end to end. Final parity and security gates intentionally span both platforms and Supabase.

## Sources

### Repository evidence (HIGH confidence)

- `.planning/PROJECT.md` — v1.3 scope and direct-chat-only native boundary.
- `.planning/codebase/ARCHITECTURE.md` — provider-neutral ports, Supabase authority, portable state, bounded chat loading.
- `supabase/migrations/0017_chat_images.sql`, `0018_chat_file_attachments.sql`, `0050_chat_attachment_hardening.sql`, `0055_chat_voice_messages.sql`, `0060_chat_video_attachments.sql` — attachment schema, RLS, hardening, MIME support.
- `supabase/functions/chat-image-command/index.ts` — caller-scoped 15-minute URL delivery, maximum 50 IDs.
- `supabase/functions/chat-command/index.ts` and `0013_realtime_chat_features.sql` — exact-message refresh and sender-only source deletion.
- Android `data:chat`, `feature:chat`, `AttachmentFileOpener`, message focus path, Room cache, and sign-out cleanup.
- iOS `ChatData`, `PersonalChat`, `ConversationStore.focusMessage`, `AttachmentFileDownloader`, `AttachmentViewer`, and live-session composition.

### Current official documentation (MEDIUM confidence through verified web lookup)

- [Supabase Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) — private bucket downloads remain RLS-controlled and may use limited-time signed URLs.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — direct-client authorization, index/filter guidance, security-invoker views, and security-definer risks.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) — Storage policies use Postgres RLS.
- [Android offline-first data layer](https://developer.android.com/topic/architecture/data-layer/offline-first) — local persistent source of truth, repository synchronization, and bounded network/database paging.
- [Android Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files) — `ACTION_CREATE_DOCUMENT` for user-chosen save destinations.
- [Android secure file sharing](https://developer.android.com/training/secure-file-sharing) — `FileProvider` content URIs and temporary URI permissions.
- [Apple Quick Look](https://developer.apple.com/documentation/quicklook) — native previews for images, documents, text, PDF, audio, and video.
- [Apple UIActivityViewController](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller) — system sharing services.
- [Apple UIDocumentPickerViewController](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller) — export/copy outside the app sandbox.
- [Apple file-system guidance](https://developer.apple.com/documentation/foundation/using-the-file-system-effectively) — temporary and cache file lifecycle.

## Open Questions Requiring Product Confirmation

1. Does “every content type already supported by chat” mean every attachment MIME only, or must GIFs, stickers, and shared links also appear? The recommended architecture starts with attachments because their privacy, download, and deletion semantics are already unified.
2. Should “Save” for photos/videos mean export to Files on both platforms, or also write to the system photo library? Photo-library writes require a separate permission and copy decision; do not infer it from generic download wording.
3. How should deletion confirmation describe a source message that contains text plus several attachments? The backend can return counts/flags, but final copy needs target-user validation.

---
*Architecture research for: FISH v1.3 shared conversation content*
*Researched: 2026-07-22*
