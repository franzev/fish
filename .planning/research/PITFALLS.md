# Pitfalls Research

**Domain:** Private per-conversation shared-content galleries in mature native chat apps
**Project:** FISH v1.3 Shared conversation content
**Researched:** 2026-07-22
**Confidence:** MEDIUM

The confidence tier comes from the GSD confidence seam for cross-checked websearch findings; the plan selected Context7 for Supabase, but that provider was unavailable, so current official Supabase documentation was fetched through the websearch fallback. Repository-specific findings are directly verified against the current migrations and Android/iOS implementations, but the milestone requirements have not yet fixed the final gallery taxonomy, retention promise, or cache policy.

## Critical Pitfalls

### Pitfall 1: Treating the conversation ID in the client as authorization

**What goes wrong:**
The gallery RPC, attachment join, URL-refresh command, or delete command accepts an arbitrary conversation or item ID and returns another conversation's metadata or a usable signed URL. Hiding the gallery entry point or filtering rows in Kotlin/Swift does not protect private content.

**Why it happens:**
The existing apps already know the active conversation, so it is tempting to treat that value as trusted. A gallery also joins more surfaces than the transcript—`messages`, `message_attachments`, GIFs, stickers, link previews, and Storage—which makes one missing membership predicate enough to leak content. Service-role Edge Functions are especially dangerous because they bypass RLS unless they deliberately re-establish caller authorization.

**How to avoid:**
Create one canonical, caller-authenticated gallery read contract. Every row must be derived from a non-deleted source message and must satisfy `private.is_conversation_member(source_message.conversation_id)` under the caller's JWT. Keep simple gallery reads direct/RLS-protected; use an Edge Function only where signed delivery credentials or command behavior require it. URL refresh must accept stable item/attachment IDs, query them as the caller, require every requested ID to be authorized, and fail the whole request rather than returning a partial cross-conversation batch. Keep sender-only deletion in `delete_chat_message`; do not add a gallery-specific delete path that weakens the existing sender check.

Add live RLS tests for member A, member B, stranger, former/blocked participant if membership can be revoked, wrong conversation, deleted source message, mixed authorized/unauthorized URL-refresh batch, and non-sender deletion. Verify both PostgREST/RPC access and Storage object access.

**Warning signs:**
- A gallery query contains `.eq("conversation_id", ...)` but no database policy or membership helper.
- An Edge Function creates an admin/service-role client before resolving the caller.
- A signed-URL response returns the authorized subset of a mixed request instead of rejecting it.
- Security tests assert only that the UI hides Delete.
- An attachment remains readable through Storage after its source message is tombstoned.

**Phase to address:**
**Phase 1 — Gallery data contract and privacy boundary.** This is a schema/RLS/RPC blocker; do not begin native gallery UI before the adversarial authorization matrix passes against local Supabase.

---

### Pitfall 2: Building the gallery by scanning the loaded transcript

**What goes wrong:**
The gallery looks correct in a seeded demo but silently omits older shared content. Loading every message to compensate causes slow opens, high memory use, and a query/fan-out problem that grows with conversation age.

**Why it happens:**
FISH intentionally opens only a bounded newest window. Android Room and the iOS conversation store therefore contain a working set, not the conversation archive. The repository has already identified an unbounded full-conversation recovery path as a priority concern; reusing it for gallery discovery would make the exceptional path routine. Attachment hydration can add additional queries and signed-URL work per page.

**How to avoid:**
Add a server-side gallery projection/RPC that emits stable content metadata directly, rather than loading messages and classifying them on-device. Use deterministic keyset pagination, not `OFFSET`, with a cursor that fully orders items—for example source-message `created_at`, source message ID, item position, and item ID. Fetch `pageSize + 1` to determine `hasMore`; cap page size server-side. Return metadata and storage paths/IDs separately from ephemeral delivery URLs. Add supporting indexes for the actual filter/order shape and inspect `EXPLAIN (ANALYZE, BUFFERS)` on a long synthetic conversation.

The initial page, load-earlier/page-next, reconnect refresh, and jump context must all be bounded independently. No gallery action may call `refresh-conversation` or select every message/attachment.

**Warning signs:**
- Gallery item count changes after the user scrolls the transcript.
- The implementation begins with `observeMessages(conversationId)` or `currentConversation.messages`.
- A query has no `limit`, uses `OFFSET`, or performs one attachment/GIF/link request per message.
- The first gallery open refreshes all message history.
- Memory/network traces grow linearly with total conversation age rather than page size.

**Phase to address:**
**Phase 1 — Gallery data contract and privacy boundary.** Prove bounded keyset pagination and indexes before designing cache or UI state. Add a performance fixture with thousands of messages and mixed content.

---

### Pitfall 3: Persisting signed URLs as if they were attachment identity

**What goes wrong:**
Thumbnails work immediately and then fail after backgrounding, offline time, or a long gallery session. Retrying the same expired URL loops. Worse, a signed URL is copied to logs, analytics, a database, or a share sheet, extending the confidentiality boundary because it is a bearer capability valid until expiry.

**Why it happens:**
Signed URLs resemble ordinary CDN URLs. Current FISH models correctly treat them as optional and Android uses stable cache keys, while both platforms already retry a 400/401/403 once through `refresh-attachment-urls`. A new gallery can accidentally fork that logic, persist the URL in Room, or share the remote URL rather than downloaded bytes. Supabase documents that signed URLs remain valid until their expiry and are not revoked by Auth signing-key rotation.

**How to avoid:**
Persist only stable attachment ID, storage path, content version/integrity metadata, and source-message identity. Keep signed URLs memory-only with `expiresAt`; refresh proactively just before use when near expiry and reactively once after 400/401/403. Coalesce refreshes by attachment ID, cap batches at the existing server limit, bind responses to the requesting account/conversation generation, and stop after one refresh+retry with calm manual recovery. Never emit signed URLs to logs, crash reports, analytics, deep links, clipboard, or native share payloads. Share downloaded, validated local bytes instead.

Test expiry with a very short TTL, app background/foreground, clock skew, concurrent thumbnail requests, mixed batches, deletion between refresh and fetch, sign-out during refresh, and a stale response arriving after switching conversations.

**Warning signs:**
- Room/Core Data/JSON state contains `signedUrl` or a URL query token.
- Cache keys include the signed query string or change whenever credentials refresh.
- More than one URL refresh fires for the same tile at once.
- The share sheet receives a remote URL.
- Logs contain `/storage/v1/object/sign/` values.

**Phase to address:**
**Phase 2 — Gallery state, cache, and offline recovery.** Reuse one attachment-delivery policy on both platforms and cover it with shared expiry/retry vectors before wiring previews and actions.

---

### Pitfall 4: Deletion updates one surface but not the others

**What goes wrong:**
The sender deletes an item from the gallery, yet it remains in the transcript, another device's gallery, an offline cache, search, a thumbnail cache, or Storage. Conversely, optimistic removal can make an item disappear locally even though the command failed. A non-sender may see a delete control that the server correctly rejects.

**Why it happens:**
The requirement is deletion of the **source message**, not deletion of a gallery row. FISH's current `delete_chat_message` tombstones the message and RLS stops members from reading bound attachments, but it does not physically delete the bound Storage objects. Gallery-specific state introduces another projection that must consume the same tombstone/realtime event. Native exports are independent copies and cannot be recalled.

**How to avoid:**
Expose Delete only when `sourceSenderId == currentUserId` and the source is not already deleted, while continuing to rely on the RPC's sender check. Send the existing source-message delete command. Optimistically mark the gallery item pending—not irreversibly gone—then reconcile the authoritative tombstone; roll back on failure. Make a source-message tombstone atomically remove every content item derived from that message on Android and iOS. Realtime/reconnect refresh must be idempotent and must let deletion win over stale page responses.

Decide and document retention separately: either (a) deletion means access revocation/tombstone while server objects remain under a stated retention policy, or (b) add an idempotent, retryable server-side purge job using the Storage API. Do not claim physical erasure while the current database only hides bound objects. Explicitly state that files already saved/shared outside FISH cannot be recalled.

Test multi-attachment messages, GIF/sticker/link-only messages, sender and non-sender, offline deletion attempt, command timeout after server success, two-device realtime, stale page response after deletion, expired URL after deletion, and physical-object behavior matching the chosen retention promise.

**Warning signs:**
- A new `delete_gallery_item` operation appears.
- The client deletes only a local gallery row.
- Gallery cache writes do not share a transaction/reducer event with message tombstones.
- Delete confirmation says the file will be erased everywhere.
- Bound objects have no retention/purge decision.

**Phase to address:**
**Phase 1 — Gallery data contract and privacy boundary** for semantics, authorization, and retention; **Phase 2 — Gallery state, cache, and offline recovery** for optimistic reconciliation; **Phase 4 — Cross-platform integration and security verification** for two-device and Storage checks.

---

### Pitfall 5: Reusing private caches across accounts, conversations, or content versions

**What goes wrong:**
A person who signs into a second account on the same device sees thumbnails or downloaded files from the previous account. Deleted/replaced media continues to render because its stable ID cache key never changes. A late request from conversation A populates conversation B's gallery.

**Why it happens:**
Private media caches outlive view models. Android clears Room rows and the opened-file directory on sign-out, but Coil disk entries use an attachment/content cache key and are not explicitly cleared in the chat sign-out path. iOS `MessageImageLoader` stores files under `Caches/ChatMedia` and provides `removeAll()`, but the production sign-out path does not call it; `AttachmentFileDownloader` creates temporary exports without an explicit lifecycle manager. The gallery multiplies cached thumbnails and long-lived tasks.

**How to avoid:**
Define a verified identity fingerprint as part of every gallery metadata and media-cache namespace. On any auth identity transition—including token restoration to a different user, remote expiry, sign-out failure, and account switch—cancel gallery tasks, revoke callbacks with a generation token, purge gallery metadata, memory images, disk images, temporary downloads, and pending share/save requests before presenting the next account. Include immutable content version or verified digest in media cache keys so changed bytes cannot reuse an old decode. On deletion, evict the affected item from memory/disk where APIs allow; at minimum remove app-owned temporary files immediately.

Add an automated account A → sign out → account B test without process death, plus conversation A → B with delayed network completions. Inspect the app sandbox after sign-out. Ensure offline cached metadata is never shown until its owner fingerprint matches the verified current user.

**Warning signs:**
- Cache paths are global (`ChatMedia`, default Coil disk cache) with no owner namespace.
- Sign-out clears database rows but not image/downloader caches.
- Async handlers check only `isActive`, not account and conversation generation.
- Cache identity is attachment ID alone and content can change without versioning.
- Temporary share files accumulate after the sheet closes.

**Phase to address:**
**Phase 2 — Gallery state, cache, and offline recovery.** Identity ownership and purge behavior are release-blocking privacy requirements, not cleanup work.

---

### Pitfall 6: “Jump to message” fetches an isolated row with false context

**What goes wrong:**
The app scrolls to the correct message ID but places it next to unrelated recent messages, offers no surrounding conversation, or immediately loses the target when pagination/realtime state rehydrates. Deleted or inaccessible targets produce a dead screen. This defeats the requirement to return to the source message with context.

**Why it happens:**
Both native apps already implement message focus by fetching `messages(ids: [id])`, merging that single message into the bounded window, sorting it, and scrolling. That is enough to highlight a search result but not enough to establish contiguous history. A gallery item may be months older than the loaded 40-message window.

**How to avoid:**
Create a bounded, RLS-protected “window around message” contract that returns the target plus a fixed number before and after, with cursors/continuity flags. Replace the active transcript window (or mark explicit gaps) rather than silently merging an isolated row. The navigation result must distinguish loaded, deleted, no longer authorized, and temporarily unavailable. Preserve gallery navigation state so Back returns to the same category/item/scroll position. Cancel a pending seek when the user selects another item or changes conversation.

Test first/last message, a target far outside cache, multiple items from one source message, deleted target, membership loss, offline target available/not available locally, new messages arriving during seek, and Back restoration. Assert that adjacent displayed messages are truly adjacent or separated by a visible “more messages” gap.

**Warning signs:**
- Gallery calls existing `refreshMessages(... [messageId])` / `messages(ids:)` unchanged.
- The reducer only receives `MergeRemoteMessage` for a jump.
- There is no around-message RPC or explicit gap model.
- Back returns to the gallery top or resets category.
- Tests assert highlight but not neighboring message IDs.

**Phase to address:**
**Phase 1 — Gallery data contract and privacy boundary** for the bounded around-message API; **Phase 3 — Native gallery UX and platform actions** for focus, gap presentation, and Back restoration.

---

### Pitfall 7: Offline mode either lies about completeness or destroys useful state

**What goes wrong:**
Opening the gallery offline shows “No shared content” even though the network failed, or it clears previously cached items before refresh. Automatic retry loops drain battery and repeatedly announce errors. Recovery duplicates pages, resurrects deleted items, or applies a stale response to the wrong category.

**Why it happens:**
Empty, offline, initial-loading, stale-cache, and filtered-empty states are easy to collapse into one list state. The two platforms have different persistence today: Android has Room-backed messages; iOS conversation state is primarily in memory. Treating their incidental caches as the gallery contract guarantees parity drift.

**How to avoid:**
Specify one portable gallery state machine with owner identity, conversation, category, pages/cursors, freshness, connectivity, in-flight generation, pending deletion, and recoverable notice. Preserve last-known authorized metadata when offline, label it as saved/possibly out of date, and never call a network failure “empty.” On reconnect, perform one coalesced bounded head refresh, merge by stable item ID, apply tombstones before older page results, and stop after one automatic retry before showing a calm manual action. Do not make share/save available unless verified local bytes exist; previews may use verified cache offline.

Use shared JSON event/result vectors for cold offline, warm offline, failure with items, failure without items, reconnect, duplicate page, stale callback, deletion while offline, identity switch, and expired URL. Keep Android persistence and any iOS persistence as adapters to the same semantics.

**Warning signs:**
- `items.isEmpty()` alone decides the empty screen.
- Refresh begins by clearing items.
- Each tile independently retries on connectivity restoration.
- Android supports cached gallery pages while iOS always blanks, without an explicit product decision.
- Reconnect has no generation/conversation guard or retry cap.

**Phase to address:**
**Phase 2 — Gallery state, cache, and offline recovery.** Define and fixture the state machine before either platform builds the complete screen.

---

### Pitfall 8: Native save/share/download broadens permissions or exports unsafe bytes

**What goes wrong:**
Android asks for broad storage access, shares a `file://` URI, or leaves a world-readable cache file. iOS crashes because a PhotoKit purpose string is absent, requests full library access when add-only is sufficient, or loses a temporary file before the share/export sheet reads it. Both platforms may save a partial, spoofed, oversized, or post-deletion download. Users may believe deleting in FISH recalls exported copies.

**Why it happens:**
“Share,” “Save,” and “Download” sound like one feature but have different platform and privacy contracts. The existing Android opener already validates host, size, MIME/signature, uses `FileProvider`, and cleans its opened-file cache; the gallery should extend rather than bypass it. iOS already validates host and expected byte size but has less explicit temporary-file lifecycle/integrity handling. Media-library save and document export require different system APIs.

**How to avoid:**
Download to an app-private temporary file with a strict host allowlist, no redirects to another host, bounded length, expected MIME/signature validation, and the server's verified digest where available. Refresh credentials once if expired, then re-check authorization immediately before fetch. Use:

- **Android share/open:** existing `FileProvider` `content://` URI plus temporary read grant and `ClipData`.
- **Android save media:** `MediaStore` for app-created images/video/audio, with pending publication until the full validated write completes.
- **Android save documents:** `ACTION_CREATE_DOCUMENT`/Storage Access Framework; do not add `MANAGE_EXTERNAL_STORAGE` or broad read permissions.
- **iOS share:** `UIActivityViewController` with a local file whose lifetime extends until activity completion.
- **iOS save media:** PhotoKit add-only authorization, requested after the user's action; `NSPhotoLibraryAddUsageDescription` already exists and must remain accurate/localized.
- **iOS save documents:** document export/file exporter to a user-selected destination, with security-scoped handling where the chosen URL requires it.

Keep each action secondary in a contextual sheet, provide cancel, prevent duplicate activation, clean temporary files on completion/cancel/sign-out/expiry, and say that exported copies are outside FISH's deletion control. Test permission allowed/denied/restricted/changed, no compatible target app, low disk, cancellation, app background, process interruption, expired URL, delete during download, malicious MIME/extension mismatch, and API-level/OS-version boundaries.

**Warning signs:**
- Android manifest gains `MANAGE_EXTERNAL_STORAGE` or unrestricted storage permissions.
- Share payload contains `file://` or a Supabase signed URL.
- The app writes directly into arbitrary filesystem paths.
- Photo access is requested on app/gallery open.
- The download code trusts filename extension or server `Content-Type` alone.
- Temp files have no owner, TTL, or completion cleanup.

**Phase to address:**
**Phase 3 — Native gallery UX and platform actions**, after the stable metadata/delivery contracts exist; re-verify in **Phase 4 — Cross-platform integration and security verification** on physical devices and supported OS versions.

---

### Pitfall 9: “All supported content” becomes two incompatible taxonomies

**What goes wrong:**
Photos appear but videos, voice messages, documents, GIFs, stickers, or links are missing or classified differently on Android and iOS. A future sending format ships but never appears in the gallery. One message produces duplicate or unstable items after pagination.

**Why it happens:**
FISH content is represented across several contracts: attachment `kind` is only `image`/`file`, while MIME distinguishes voice/video/documents; GIFs, stickers, and link previews live outside `message_attachments`. Android and iOS have parallel domain/UI models. Classifying locally duplicates business rules and may accidentally expand scope into new send pipelines.

**How to avoid:**
Freeze a server/shared gallery item discriminated union before UI work. Give every supported existing content shape an explicit inclusion/category rule, stable ID, source message ID, sender, source date, preview descriptor, availability, and action capabilities. Generate categories from content already sent; do not add upload/send behavior. Decide whether emoji-only text and ordinary text are excluded, and whether link previews count as Links/Other. Preserve one source-message relationship when a message contains up to five attachments. Unknown future kinds must render an accessible unavailable/other row rather than disappear or crash.

Create shared fixtures from real database rows for image, video MP4, voice M4A, PDF/text/CSV/Office documents, GIF, sticker, link preview, mixed attachments, unavailable/quarantined attachment, deleted source, and unknown future kind. Run the same expected classification/order on server, Android, and iOS.

**Warning signs:**
- Android checks MIME strings in a composable while iOS checks filename extensions in a view.
- “Media” is implemented as `kind == image`.
- Links/GIFs/stickers are added by scanning message body or transcript UI models.
- New gallery code changes the composer or send-message payload.
- There is no unknown-kind fallback or cross-platform fixture.

**Phase to address:**
**Phase 1 — Gallery data contract and privacy boundary.** Taxonomy is an API decision. Lock it before native implementation; parity fixtures continue through Phases 2–4.

---

### Pitfall 10: A dense visual grid becomes inaccessible and cognitively noisy

**What goes wrong:**
Screen readers announce “image” repeatedly with no sender/date; tiny tile menus overlap; Dynamic Type or 200% font clips metadata; videos autoplay; focus jumps after pagination/deletion; category controls and per-item actions compete as many primary actions. Empty/offline/permission states become indistinguishable.

**Why it happens:**
Media galleries are often optimized for visual density. FISH serves neurodivergent English learners and requires calm literal copy, one primary action, 44×44pt minimum touch targets (Android platform guidance recommends 48dp), reduced motion, and complete loading/error/offline behavior. A grid also tempts icon-only controls and gesture-only selection.

**How to avoid:**
Treat each tile/row as one accessible object named by content type/name, sender, date, and availability; expose Preview/Open as the tile action and keep Share/Save/Delete in one labeled contextual action sheet. Delete must remain visually subordinate and explicitly confirmed or undoable according to the final deletion policy. Use visible category labels, never color alone; retain adequate target spacing; no autoplay; provide captions/transcripts where existing media carries essential information; preserve focus after refresh/delete and announce loading/completion/failure politely without announcing every thumbnail. At large text sizes, switch media cells to a layout that keeps required context visible rather than shrinking text or targets.

Test VoiceOver and TalkBack traversal/order/action names, Switch Control/keyboard where supported, 200%+ text, RTL, light/dark/high contrast, reduced motion, offline states, long filenames/names/localized dates, and deletion focus restoration on real devices. Include both entry points (header and details) in the accessibility test matrix.

**Warning signs:**
- Tile semantics are only the filename or “image.”
- Overflow/delete targets are smaller than the platform floor or overlap adjacent tiles.
- Metadata disappears at large text instead of reflowing.
- Category is conveyed only by thumbnail appearance/color.
- Multiple actions are styled as primary, or every tile exposes four buttons.
- UI tests use screenshots only and never inspect accessibility trees.

**Phase to address:**
**Phase 3 — Native gallery UX and platform actions** for implementation; **Phase 4 — Cross-platform integration and security verification** for assistive-technology and real-device release gates.

---

### Pitfall 11: Android and iOS reach visual similarity but behavioral drift

**What goes wrong:**
The two apps differ in included content, item order, retry limits, offline behavior, deletion rollback, URL refresh, entry points, Back behavior, notices, or action availability. Bugs recur because each platform fixes its own reducer without updating the other.

**Why it happens:**
FISH uses native Compose and SwiftUI implementations. Existing portable chat-state fixtures prove parity for transcript behavior, but a gallery introduces a separate paginated state machine and platform-specific save/share APIs. Screenshot similarity cannot prove security or recovery semantics.

**How to avoid:**
Define a platform-neutral gallery event/result contract and JSON vectors in `packages/core`, then implement native reducers/adapters against it as the repository already does for chat state. Maintain a capability matrix only for legitimate OS differences; the user-visible outcome and calm copy must remain equivalent. Gate every change on shared fixtures, Android unit/instrumentation tests, iOS unit/snapshot tests, Supabase live authorization tests, and a paired manual UAT script covering both entry points and every state.

Do not share UI code or introduce a cross-platform framework for this milestone. Share contracts, fixtures, taxonomy, cursors, and expected outcomes.

**Warning signs:**
- A requirement is tested only on one platform.
- Platform reducers define different event names or retry counts.
- One app caches pages and the other does not without a recorded decision.
- Screenshots are the only parity evidence.
- A server contract change is decoded independently with no common fixture.

**Phase to address:**
**Phase 2 — Gallery state, cache, and offline recovery** establishes the contract; **Phase 4 — Cross-platform integration and security verification** is the final parity gate.

---

### Pitfall 12: Late callbacks and partial joins resurrect stale or unauthorized items

**What goes wrong:**
A slow page, thumbnail hydration, realtime event, or signed-URL refresh completes after the user changes category, conversation, or account. It repopulates the wrong gallery, reverses a deletion, or overwrites a newer page. Partial attachment/GIF/link joins make content disappear rather than render as unavailable.

**Why it happens:**
Gallery loading fans out across metadata, delivery URLs, previews, disk cache, and realtime. The repository has prior evidence that realtime lifecycle callbacks require explicit revocation and conversation ownership. Current transcript adapters deliberately preserve unavailable attachment placeholders when hydration fails; a new projection may lose that resilience.

**How to avoid:**
Stamp every request with owner identity, conversation ID, category, cursor, and generation. Validate the stamp before committing any result, and cancel or make inert all callbacks on scope change. Merge idempotently by stable item ID; deletion/tombstone has higher precedence than stale content; an older page may append only to its matching cursor lineage. Represent partial metadata and unavailable preview explicitly so one failed join does not hide the source item. Coalesce realtime/reconnect refresh into one bounded operation rather than one fetch per event.

Test delayed responses in every ordering: old category after new category, old account after sign-in, page after delete, URL refresh after delete, duplicate realtime delivery, hydration failure with source item present, and unmount during share/download.

**Warning signs:**
- A coroutine/Task writes state without checking identity/conversation/generation.
- Page merge uses list concatenation only.
- A failed preview join filters the entire item out.
- Every realtime event triggers an independent gallery reload.
- Cleanup guards only the promise exit and not callback entry.

**Phase to address:**
**Phase 2 — Gallery state, cache, and offline recovery**, with race vectors repeated in **Phase 4 — Cross-platform integration and security verification** against live Realtime.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Scan native transcript messages for gallery items | No backend work | Incomplete history, divergent classification, unbounded workaround | Never |
| Reuse the existing single-message focus path unchanged | Fast jump demo | False context and non-contiguous transcript | Never for the shipped jump requirement |
| Persist signed URLs | Easy image reload | Expiry loops and bearer-token exposure | Never |
| Add separate gallery deletion | Localized implementation | Authorization and tombstone semantics drift | Never |
| Cache by attachment ID globally | Simple image cache | Cross-account residue and stale bytes | Never for private content; namespace by verified identity and version |
| Implement Android fully before specifying iOS state | Faster first demo | Platform behavior becomes the accidental contract | Prototype only; discard before production implementation |
| Use one generic “Save” handler for every MIME | Less UI wiring | Wrong permissions/destinations and corrupt exports | Never |
| Treat physical object purge as part of tombstoning without an operations plan | Strong-sounding privacy copy | Lost data or false erasure promise when Storage deletion fails | Never |
| Load signed URLs for every item in a page eagerly | Simple view model | Token churn, bandwidth waste, slow gallery | Only tiny test fixtures; production should hydrate visible/near-visible items |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Postgres/RLS | Filtering by conversation ID only in clients | Enforce source-message membership and `deleted_at is null` in RLS/RPC; adversarial live tests |
| Supabase Edge Functions | Using service role for gallery reads/URL refresh without reauthorization | Query as caller or assert membership before any admin operation; reject mixed-ID batches |
| Supabase Storage | Treating private object URL as permanent or deleting `storage.objects` metadata directly | Use time-limited delivery and Storage API for any physical deletion |
| Supabase Realtime | Subscribing only to inserts | Reconcile source-message updates/tombstones; coalesce reconnect recovery and revoke stale callbacks |
| Android Coil | Stable cache key lacks owner/version or survives sign-out | Namespace private cache and explicitly purge/evict on identity transitions/deletion |
| Android sharing | Sharing a path or remote URL | Existing validated download + `FileProvider` URI + temporary grant |
| Android saving | Requesting broad storage access | `MediaStore` for app-created media; SAF `ACTION_CREATE_DOCUMENT` for documents |
| iOS image cache | `MessageImageLoader.removeAll()` exists but production sign-out does not call it | Integrate identity-owned cache purge and cancel in-flight tasks before new account UI |
| iOS share/export | Temporary URL is released too early or never cleaned | Own file through completion/cancel; clean on completion, TTL, and sign-out |
| iOS Photos | Requesting read/write on gallery open | Request add-only after Save; handle denied/restricted/settings changes calmly |
| Existing message search/jump | Fetching only target ID | Fetch bounded context window and model explicit gaps |
| Attachment scanner/integrity | Gallery bypasses existing validated download path | Reuse verified MIME/size/signature/digest policy for preview, share, save, and download |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Client-side full history scan | Slow open, high memory, old content missing until transcript pagination | Server projection + bounded keyset pages | Immediately beyond the loaded 40-message window; worsens with conversation age |
| `OFFSET` pagination | Slow deep pages, skips/duplicates during concurrent inserts/deletes | Composite keyset cursor with total deterministic order | Noticeable on deep histories and under mutation, regardless of user count |
| Per-item URL signing | N+1 Edge/Storage calls and thumbnail waterfall | Batch visible IDs within the existing 50-ID cap and coalesce | A few gallery rows with multi-attachment messages already expose it |
| Eager full-resolution decoding | Jank, memory pressure, process termination | Thumbnail variants, pixel-bounded decode, lazy visible-item loading | A screenful of modern photos/videos |
| Disk cache without quota/TTL | Private data residue and storage growth | Owner namespace, byte quota, TTL, deletion/sign-out eviction | Long-lived conversations and repeated share/download actions |
| One reload per realtime event | Battery/network storm after reconnect | Debounced/coalesced bounded head refresh | Bursty message changes or reconnect replay |
| Missing composite index | High database CPU and latency | Index the gallery filter/order and verify query plan | Thousands of content rows in an active conversation |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Confusing private Supabase chat with end-to-end encryption | Product/privacy claims exceed architecture; server and scanner process bytes | Describe actual private/RLS boundary accurately; do not claim E2EE |
| Logging signed URLs or local export paths | Bearer credentials or private file locations enter telemetry | Structured redaction tests; log stable IDs and failure categories only |
| Sharing remote URL instead of local verified bytes | Recipient obtains a bearer URL and fetch timing leaks | Download, authorize, validate, then share local content URI/file |
| Trusting MIME/extension from metadata | Malicious or corrupt file handed to another app | Keep existing allowlist, size bounds, signatures/container checks, and digest verification |
| Partial authorization in batched refresh | Attacker probes valid IDs or receives authorized subset with unintended correlation | Reject entire batch unless every stable ID is authorized and ready |
| Assuming deletion revokes already issued signed URLs immediately | Deleted content may remain fetchable until token expiry | Short TTL, no URL persistence, retention decision, and do not promise immediate cryptographic revocation |
| Keeping private media after account change | Shared-device cross-account disclosure | Identity-bound cache and comprehensive purge on every verified identity transition |
| Broad Android storage permissions | Excess device data access and Play policy risk | Use scoped APIs; never request all-files access for this feature |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Treating gallery as a catalog of choices | Cognitive overload and scope drift | Three calm, fixed content categories only if taxonomy evidence supports them; one clear tile action |
| Empty state used for offline/failure | User concludes shared content was lost | Distinct saved/offline, loading, empty, permission, and recoverable failure states |
| Four visible actions per tile | Dense, error-prone screen | Tile opens/previews; one labeled action sheet contains share/save/delete |
| Icon-only categories/actions | English learner and screen-reader ambiguity | Visible literal labels plus accessible names |
| Autoplay GIF/video/voice | Distraction, data use, accessibility problems | Static preview/poster and explicit play; respect reduced motion |
| Delete wording promises recall | False expectation for exported copies and current server retention | Say source message is removed for conversation members; exported copies remain outside FISH |
| Jump loses gallery position | Repeated work and disorientation | Restore category, item focus, and scroll position on Back |
| Retry on every tile | Choice overload and request storm | One calm page-level recovery action; tile-level unavailable state only where needed |

## “Looks Done But Isn't” Checklist

- [ ] **Complete history:** Gallery works with content older than the transcript cache and no query is unbounded.
- [ ] **Authorization:** Stranger, non-member, mixed-ID URL refresh, deleted source, and non-sender delete all fail at the server/Storage boundary.
- [ ] **Taxonomy:** Image, video, voice, document, GIF, sticker, link preview, unknown, unavailable, multi-attachment, and deleted-source fixtures have explicit outcomes on both platforms.
- [ ] **Signed URL lifecycle:** Expiry, refresh-once, coalescing, clock skew, deletion during fetch, and redacted telemetry are verified.
- [ ] **Deletion:** Transcript, gallery, realtime peer, offline cache, thumbnail cache, search, and Storage retention match one documented semantic.
- [ ] **Identity purge:** Account A content is absent after account B signs in without process death; sandbox caches are inspected.
- [ ] **Jump context:** A far-old item opens with truthful bounded neighbors or explicit gaps; Back restores gallery state.
- [ ] **Offline:** Warm-cache offline is distinct from true empty; reconnect is bounded, deduplicated, and retry-capped.
- [ ] **Android actions:** `FileProvider`, `MediaStore`, and SAF paths are tested with no broad storage permission and no `file://`/signed URL sharing.
- [ ] **iOS actions:** Activity sharing, add-only Photos permission, document export, cancellation, and temporary-file cleanup are tested.
- [ ] **Accessibility:** TalkBack/VoiceOver, large text, RTL, focus restoration, target sizes, reduced motion, and non-autoplay pass on real devices.
- [ ] **Parity:** Shared state/taxonomy vectors and paired UAT cover both header and conversation-details entry points.
- [ ] **Release evidence:** Hosted migration/type regeneration, Edge deployment, RLS verification, and platform build/test commands are recorded; local build alone is not treated as proof.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Client-side transcript scan shipped | HIGH | Add canonical projection/RPC, migrate cache to stable gallery items, remove full-history scan, add long-history tests |
| RLS or signed URL leak | HIGH | Disable affected endpoint, shorten/rotate delivery behavior where possible, audit logs without exposing tokens, patch policy, add adversarial tests; note existing signed URLs last until expiry |
| Stale private cache across accounts | HIGH | Ship forced purge on identity transition, version cache namespace, clear existing directories/Room rows, add account-switch regression |
| Deletion surface inconsistency | MEDIUM/HIGH | Reconcile from authoritative tombstones, evict derived gallery rows, decide/implement object retention or purge, correct user-facing copy |
| Expired URL loop | MEDIUM | Stop retries, clear ephemeral delivery cache, implement coalesced refresh-once, preserve stable metadata/offline state |
| False-context jump | MEDIUM | Add around-message window API, model gaps, replace isolated merge behavior for gallery navigation |
| Overbroad native permissions | MEDIUM | Remove permission, migrate to MediaStore/SAF or add-only PhotoKit, update purpose strings and denial UX |
| Platform drift | MEDIUM | Freeze shared vectors, choose intended behavior, align both reducers/adapters, run paired UAT before further feature work |

## Pitfall-to-Phase Mapping

Recommended roadmap phases are named so the roadmapper can assign final phase numbers.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Client ID mistaken for authorization | Phase 1 — Gallery data contract and privacy boundary | Live RLS/Storage/RPC matrix for member, stranger, deleted source, mixed batch, sender/non-sender |
| Unbounded/incomplete history | Phase 1 — Gallery data contract and privacy boundary | Keyset query plan and thousands-message fixture; no full-history call |
| Unsupported/divergent content taxonomy | Phase 1 — Gallery data contract and privacy boundary | One discriminated union and shared classification fixtures |
| Deletion semantics/retention ambiguity | Phase 1, then Phases 2 and 4 | Documented tombstone/purge promise; two-device and object-access tests |
| Signed URL expiry/persistence | Phase 2 — Gallery state, cache, and offline recovery | Short-TTL refresh-once vectors, token redaction, stale-response tests |
| Cross-account/stale caches | Phase 2 — Gallery state, cache, and offline recovery | Account-switch without process death; sandbox/cache inspection |
| Offline/reconnect inconsistency | Phase 2 — Gallery state, cache, and offline recovery | Shared event vectors for warm/cold offline, retry cap, reconnect merge |
| Late callbacks/partial joins | Phase 2 — Gallery state, cache, and offline recovery | Deterministic race tests with generation and tombstone precedence |
| False-context jump | Phase 1 API + Phase 3 — Native gallery UX and platform actions | Far-history around-window test, explicit gaps, Back-state restoration |
| Unsafe native share/save/download | Phase 3 — Native gallery UX and platform actions | Physical-device permission, cancellation, low-disk, validation, cleanup tests |
| Dense/inaccessible gallery | Phase 3, verified in Phase 4 | TalkBack/VoiceOver, 200% text, RTL, target-size and focus tests |
| Android/iOS behavioral drift | Phase 2 contract + Phase 4 — Cross-platform integration and security verification | Shared fixtures plus paired UAT across both entry points and every state |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Required Mitigation |
|-------------|---------------|---------------------|
| Phase 1 — Server projection | Reusing transcript queries or unioning content without total ordering | Dedicated RLS projection, explicit taxonomy, composite cursor/index, `pageSize + 1` |
| Phase 1 — Privacy | Service-role bypass and mixed-ID URL leakage | Caller-scoped query and fail-closed authorization matrix |
| Phase 1 — Source navigation | Single-row fetch presented as context | Bounded around-message contract with continuity/gap flags |
| Phase 1 — Deletion | “Delete item” diverges from source-message tombstone | Existing sender-only message command and explicit Storage retention decision |
| Phase 2 — State/cache | Cross-account residue and stale callbacks | Owner fingerprint, generation guards, task cancellation, full cache purge |
| Phase 2 — Offline | Empty/failure conflation and retry storm | Portable state vectors, last-known pages, one automatic retry, one manual action |
| Phase 3 — Android | Broad storage permissions or unsafe URI handoff | Extend existing validated opener; FileProvider/MediaStore/SAF |
| Phase 3 — iOS | Wrong Photos access and temporary-file lifetime | Add-only PhotoKit, activity/export completion ownership, cleanup manager |
| Phase 3 — UI | Dense grid and action overload | One tile action, contextual sheet, labels, target floor, reflow at large text |
| Phase 4 — Integration | Visual parity mistaken for behavioral parity | Server + reducer + real-device + paired-UAT matrix, including both entry points |
| Phase 4 — Deployment | Local tests pass while hosted RLS/functions differ | Regenerate schema types, deploy migrations/functions, run hosted RLS/Realtime/action smoke tests |

## Sources

### Official documentation

- [Supabase Storage buckets: private buckets and RLS-protected downloads](https://supabase.com/docs/guides/storage/buckets/fundamentals) — MEDIUM confidence via GSD seam; current official documentation.
- [Supabase serving Storage assets: private downloads and signed URL lifetime](https://supabase.com/docs/guides/storage/serving/downloads) — MEDIUM confidence via GSD seam; current official documentation.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) — MEDIUM confidence via GSD seam; current official documentation.
- [Supabase Storage schema: use the Storage API rather than direct metadata deletion](https://supabase.com/docs/guides/storage/schema/design) — MEDIUM confidence via GSD seam; current official documentation.
- [Android secure file sharing with FileProvider](https://developer.android.com/training/secure-file-sharing/) — MEDIUM confidence via GSD seam; official guidance, last updated 2025-02-10.
- [Android Storage Access Framework for user-selected document saving](https://developer.android.com/training/data-storage/shared/documents-files) — MEDIUM confidence via GSD seam; current official guidance.
- [Android shared media and MediaStore permissions](https://developer.android.com/training/data-storage/shared/media) — MEDIUM confidence via GSD seam; current official guidance.
- [Android Compose accessibility API defaults and minimum targets](https://developer.android.com/develop/ui/compose/accessibility/api-defaults) — MEDIUM confidence via GSD seam; current official guidance.
- [Apple UIActivityViewController](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller) and [sharing copies of app data](https://developer.apple.com/documentation/uikit/collaborating-and-sharing-copies-of-your-data) — MEDIUM confidence via GSD seam; current official documentation.
- [Apple UIDocumentPickerViewController](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller) — MEDIUM confidence via GSD seam; current official documentation.
- [Apple PhotoKit privacy guidance](https://developer.apple.com/documentation/PhotoKit/delivering-an-enhanced-privacy-experience-in-your-photos-app) and [`NSPhotoLibraryAddUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryaddusagedescription) — MEDIUM confidence via GSD seam; current official documentation.

### Repository evidence (directly verified 2026-07-22)

- `.planning/PROJECT.md` — v1.3 scope, direct-chat-only native surface, bounded 40-message loading, identity-safe chat-state precedent.
- `.planning/codebase/CONCERNS.md` — verified unbounded full-conversation recovery path, command duplication, Realtime lifecycle risk, deployment and generated-schema gaps.
- `supabase/migrations/0013_realtime_chat_features.sql` — sender-only source-message tombstone via `delete_chat_message`.
- `supabase/migrations/0017_chat_images.sql` and `0050_chat_attachment_hardening.sql` — attachment/member RLS, deleted-source exclusion, Storage object policy, cleanup limited primarily to unbound/staging objects.
- `supabase/functions/chat-image-command/index.ts` — fail-closed batch URL refresh and explicit signed URL expiry.
- `apps/android/data/chat/.../ChatModels.kt`, `ChatRepository.kt`, `DefaultChatRepository.kt`, `local/ChatDao.kt` — stable attachment metadata, bounded message APIs, Room cache and sign-out purge behavior.
- `apps/android/app/.../AttachmentFileOpener.kt` and `AttachmentMaintenanceWorker.kt` — current host/size/MIME validation, FileProvider sharing, and opened-file cleanup that should be extended for gallery actions.
- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/MessageImageLoader.swift` and `AttachmentFileDownloader.swift` — current signed URL refresh, disk cache, byte-size validation, and temporary downloads.
- `apps/ios/App/Sources/FishApp.swift` — production sign-out does not currently call `MessageImageLoader.removeAll()`.
- Android `ChatViewModel.focusMessage/requestFocusedMessage` and iOS `ConversationStore.focusMessage` — current jump fetches/merges a single target row without a bounded surrounding window.
- `docs/ui-ux-agent-guidelines.md` and `AGENTS.md` — FISH calm UI, one primary action, 44×44 minimum targets, complete state/accessibility requirements, and platform parity constraints.

## Open Decisions That Must Not Be Guessed

- Exact gallery taxonomy for GIFs, stickers, link previews, voice messages, and video under “Media / Documents / Other.”
- Whether deleting a source message promises access revocation only or physical Storage purge, and the retention period/audit requirement.
- Whether iOS will persist gallery metadata for warm offline parity with Android, or both platforms will use a deliberately smaller offline promise.
- Whether Save for images/video always means the platform photo library while Download/Save file uses a document destination; copy must use consistent user-facing verbs.
- Supported Android/iOS minimum versions for MediaStore, PhotoKit, file exporter, and permission test matrices.

---
*Pitfalls research for: FISH v1.3 shared conversation content*
*Researched: 2026-07-22*
