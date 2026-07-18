# Native iOS (SwiftUI) chat attachments plan (photos & files)

Status: proposal for review — do not implement until approved.
Written 2026-07-17 from a full audit of the web implementation, the backend
contracts, the iOS codebase, and external research (Apple documentation,
Supabase documentation, and public behavior of five established messengers).
Sources are cited inline as `[S#]` and listed in section 18.

The web feature is internally called "chat images" even though it carries
documents; this plan uses "attachments" for the combined photo + file flow and
keeps the wire names (`chat-image-command`, `message_attachments`) unchanged.

---

## 1. Outcome and scope

A client or coach in the iOS personal chat can attach up to five photos and
documents to a message, see calm per-item progress while they upload, recover
from failures without alarm, and see sent attachments rendered in the
transcript the same way web renders them: wrapped image tiles with blur-up
loading, and glanceable file cards. Everything the server already enforces
(limits, formats, processing, storage privacy) is reused, not rebuilt.

### Included

- Photo attachment via the system Photos picker (no permission prompt),
  multi-select up to 5, selection order preserved and honored on send.
- Document attachment via the system file picker for the six formats web
  accepts (PDF, TXT, CSV, DOCX, XLSX, PPTX).
- Client-side image preparation: downsampling, orientation fix, metadata
  (EXIF/GPS) stripping, recompression — one pipeline, silent, no quality
  choices shown to the user.
- A staged-attachment strip above the composer with per-tile progress,
  remove, and retry; text may accompany attachments (one caption per send,
  which is the message body — matching web).
- Upload queue: signed-URL PUT uploads with real progress, cancellation,
  automatic retry on reconnect, and a short background grace period so
  briefly leaving the app does not kill an upload.
- Transcript rendering: single and multi-image bubbles (flow-wrap parity with
  web), file cards, blur-up thumbnails, signed-URL refresh, full-screen image
  viewer with swipe-through, Quick Look for documents.
- Fixture-first construction: every UI state works offline in the Catalog and
  is snapshot- and accessibility-audited before live wiring.

### Excluded (deliberate)

- Video attachments. The bucket allows no `video/*` MIME type and the web
  search filter's `video` branch is dead code today (see §3.10). Adding video
  is a product decision with its own pipeline (trimming, poster frames,
  background uploads) — out of scope.
- Image editing (crop, draw, stickers-on-photos). Telegram/WhatsApp-style
  editors are decision-heavy surfaces; the research (§4.2) recommends
  against them for this product. Not in v1.
- Per-item captions, HD/quality toggles, "send as file vs compressed" forks.
  All are choice-multiplication the product exists to remove (§4.3).
- Voice notes and polls (the web `AddMenu` shows inert placeholders for
  these; they remain separate features).
- A full offline *send* outbox (send-and-it-goes-out-later for the message
  itself). Upload retry on reconnect is included; queuing whole unsent
  messages belongs to the chat data-layer milestone (§17.1).
- Camera capture is proposed as an optional fast-follow phase, not v1
  (§14 Phase 8, §17.2).

### The one hard dependency

**iOS chat today is a stateless presentation layer.** There is no message
send pipeline, no realtime subscription, no message repository — `onSend` is
a bare closure, and delivery states exist only as presentation enums
(`MessageDeliveryStatus` in `apps/ios/FishKit/Sources/PersonalChat/Models/MessageUiModel.swift`).
The media-picker plan explicitly deferred real sending to a "ChatData/Supabase
milestone" (`docs/ios-chat-media-picker-plan.md`). Attachments can be built
and verified against fixtures up to and including Phase 5 without that
milestone, but **live end-to-end attachment sending (Phase 7) requires the
minimal chat send/hydration slice to exist**. Section 17.1 lays out the two
sequencing options; the phased plan is structured so this dependency blocks
only the final integration phase.

---

## 2. How the web implementation works today (confirmed)

Full file references were verified in this audit; key files are listed at the
end of this section.

### 2.1 Entry points

- A `+` "Add to message" `IconButton` opens an `AddMenu` with one working
  item, "Add files", which clicks a hidden
  `<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.docx,.xlsx,.pptx">`
  (`apps/web/features/chat/components/composer/add-menu/add-menu.tsx`).
- Drag-and-drop onto the composer, with an overlay that says "Add images to
  this message" (copy bug — files are accepted too).
- Clipboard paste is confirmed absent.
- Attachments are disabled while offline or while a GIF/sticker is staged
  (`imageSelectionDisabled = isOffline || gif || sticker`).

### 2.2 Validation and limits (client mirrors server)

From `packages/core/src/chat.ts` (`chatLimits`): body ≤ 4000 chars, max **5
attachments** per message, **10 MB** source ceiling per file, **5 MB**
post-compression ceiling for images. Client allow-list of 9 MIME types
(JPEG/PNG/WebP + PDF/TXT/CSV/DOCX/XLSX/PPTX) with an extension fallback for
empty `File.type`. Validation is all-or-nothing per batch: the first invalid
file rejects the whole selection (weakness, §3.3). Failure copy is calm and
notice-toned ("Each file needs to be 10 MB or smaller.", "That file type is
not supported yet.", "Add up to five files to one message.").

### 2.3 Client image preparation

Images (and only images) are re-encoded before upload with
`browser-image-compression` in a Worker (45 s timeout, main-thread fallback):
target ≤ 2 MB, max dimension 2560 px, output **WebP** at quality 0.8,
`preserveExif: false` (EXIF/GPS stripped). Output is renamed to a UUID
`.webp`. Non-image files upload as-is.

### 2.4 Upload pipeline (four-step contract)

1. **initialize** — `chat-image-command` action `initialize-upload` → RPC
   `initialize_chat_image_upload` (membership, MIME allow-list, 1..10 MB,
   rate limits ≥20/10 min or ≥100/day → 429). Creates a `message_attachments`
   row (`status='pending'`, `expires_at = now()+2h`, unique
   `(uploader_id, client_upload_id)` for idempotency) and returns a
   server-minted signed upload token for the staging path
   `{conversationId}/{attachmentId}/staging[.webp]`.
2. **upload bytes directly to Storage** — primary transport is resumable TUS
   (`tus-js-client`, 6 MB chunks, retry delays 0/1/3/5 s, header
   `x-signature: uploadToken`); fallback on TUS 400/403 is a signed PUT via
   `XMLHttpRequest`. Both URLs are derived client-side from the project ref.
   Two files upload concurrently; the CPU-heavy `complete` step is serialized
   through a promise chain.
3. **complete** — `chat-image-command` action `complete-upload` (idempotent):
   server downloads staging, validates magic bytes (`isWebP` for images;
   `%PDF-`, UTF-8-without-NUL, or OOXML-zip-with-`[Content_Types].xml` and a
   `vbaProject.bin` macro rejection for files), enforces stored ceilings
   (5 MB image / 10 MB file), rejects unsafe dimensions (> 4096 px edge or
   > 25 M pixels), then for images generates WebP variants with
   ImageMagick-WASM — display: longest edge 1920, quality 78 stepping down to
   56, ~1.25 MB target; thumbnail: 64 px, ≤ ~16 KB — and marks the row
   `ready`. Files are stored as `file.{ext}` with their source MIME.
4. **send** — `send-message` with `attachmentIds` → RPC `send_chat_message`
   locks the rows, re-checks `ready`/ownership/conversation/unbound/not
   expired, binds them with `position` 0–4 in the order given, and extends
   `expires_at` by 100 years. Attachments are mutually exclusive with GIFs
   and stickers at every layer.

Also available: `cancel-upload` (deletes objects, marks `cancelled`) and
`refresh-image-urls` (≤ 50 ids, RLS-checked, returns fresh signed URLs).

### 2.5 Progress, cancel, retry, failure

Per-tile determinate `Progress` bar with staged ranges: preparing 0.02→0.25,
uploading 0.25→0.90, processing pinned at 0.92, ready 1.0. Remove aborts the
transfer, revokes the preview, and server-cancels. Retry clones the item with
a fresh `clientUploadId`. A failed upload blocks Send entirely with the hint
"Retry or remove the upload that didn't finish". A `beforeunload` guard warns
while uploads are in flight; unmount aborts transfers but does **not**
server-cancel (orphan risk, §3.1).

### 2.6 Send and optimistic rendering

`handleSend` emits body + `attachmentIds` + optimistic `images` carrying the
local `blob:` preview URLs, so the just-sent bubble renders instantly; object
URLs are revoked 30 s after the real signed URLs take over.

### 2.7 Data model and hydration

- Table `public.message_attachments` (separate table, not jsonb): status
  lifecycle `pending → uploaded → processing → ready | failed | cancelled`,
  bind-on-send with `position` 0–4, per-kind ready invariants (images must
  have WebP display + thumbnail + dimensions; files must not have
  thumbnails), storage paths unique.
- Bucket `chat-images` is **private**; delivery is exclusively via signed
  URLs with a **15-minute TTL**. Allowed MIMEs after migration 0018:
  `image/webp` + the six document types; bucket cap 10 MB.
- There is **no INSERT/UPDATE/DELETE storage RLS** on the bucket: the signed
  upload token is the only ingress, and the service role does all processed
  writes. This is a hard requirement for any new client (§7 note).
- **Realtime carries no attachments.** The `postgres_changes` payload is the
  bare `messages` row; web maps it with `images: []` and immediately
  refetches that message, reading `message_attachments` under RLS and
  minting signed URLs client-side (`createSignedUrls(paths, 900)`). The
  `chat-command` refresh actions do not join attachments either — hydration
  is entirely a client responsibility today (§3.8).
- Shared shape `ChatImage` (`packages/core/src/chat.ts`): `id`,
  `status:"ready"`, `kind? ("image"|"file")`, `originalName`, `mimeType?`,
  `byteSize?`, `width?`, `height?`, `thumbnailPath?`, `displayPath`,
  `thumbnailUrl?`, `displayUrl?`. `SendMessageCommand.attachmentIds?:
  string[]`.

### 2.8 Message rendering

`MessageImages` splits images from files. Images: flow-wrap of
aspect-ratio-preserving tiles (`gap-nudge`), aspect clamped to [2/3, 2] when
more than one, single image gets a larger max width; blur-up: 64 px thumbnail
renders scaled/blurred, the display image crossfades in; failure state
"Image unavailable" + "Try again" (refreshes signed URLs); lightbox dialog
with scrim, sr-only title, and "Close image". Files: card with `IconFileText`,
truncated `originalName`, "`{type label} · {size}`" caption, and an
open-in-new-tab link; missing URL shows a retry icon. Alt text is always the
generic "Image shared by {author}" (weakness, §3.6).

### 2.9 Reusable backend contracts (what iOS consumes unchanged)

Everything in 2.4 and 2.7 is client-agnostic and reusable as-is:

| Contract | Endpoint / object | iOS use |
| --- | --- | --- |
| Initialize | `chat-image-command` / `initialize-upload` | unchanged |
| Byte ingress | signed upload token → storage PUT (or TUS) | signed PUT (§6.5) |
| Finalize | `chat-image-command` / `complete-upload` | unchanged |
| Cancel | `chat-image-command` / `cancel-upload` | unchanged |
| URL refresh | `chat-image-command` / `refresh-image-urls` | unchanged |
| Bind | `send-message` `attachmentIds` | unchanged (needs send slice) |
| Read model | `message_attachments` RLS select + `createSignedUrls` | unchanged |
| Limits | `chatLimits` in `packages/core/src/chat.ts` | mirrored constants + Codable contract tests |

The only server-side change this plan requires is accepting JPEG staging for
images (§7.1) — additive and invisible to web.

Key web/back-end files: `apps/web/features/chat/hooks/use-chat-image-uploads.ts`,
`.../hooks/prepare-chat-image.ts`, `.../components/composer/*`,
`.../components/message-images/message-images.tsx`,
`apps/web/lib/services/supabase/{chat-images,chat-realtime,chat-message-hydration}.ts`,
`supabase/functions/chat-image-command/index.ts`,
`supabase/functions/send-message/index.ts`,
`supabase/migrations/0017_chat_images.sql`, `0018_chat_file_attachments.sql`,
`packages/core/src/chat.ts`, `packages/core/src/chat-state/selectors.ts`.

---

## 3. Weaknesses in the web implementation

Evidence-backed; each informs an iOS decision (§15) and most are backport
candidates (§16.3).

1. **Orphaned uploads on navigation.** Unmount aborts transfers but never
   server-cancels initialized attachments; `pending` rows + `staging` objects
   linger until expiry (`use-chat-image-uploads.ts` cleanup effect vs
   `remove()`).
2. **Cleanup is defined but never runs.** `expire_unattached_chat_images()`
   exists (migration 0017) but no cron job schedules it, and it only flips
   row status — it never deletes the storage objects. Orphaned staging bytes
   accumulate indefinitely.
3. **All-or-nothing batch validation.** One invalid file rejects the whole
   selection and doesn't say which file failed.
4. **Untruthful processing progress.** Progress pins at 0.92 while completes
   are serialized server-side; five attachments show several tiles "stuck"
   with no queue indication.
5. **A count race.** `addFiles` guards with a ref updated by effect; two
   rapid drops can briefly exceed the 5-attachment cap client-side.
6. **Generic alt text.** Every image is "Image shared by {author}"; no
   per-attachment description exists anywhere in the schema. The UI/UX
   guidelines list chat media accessibility as an unresolved area
   (`docs/ui-ux-agent-guidelines.md`, "Missing areas").
7. **No paste, no true cancel.** Clipboard paste is absent; cancel is only
   remove.
8. **Realtime N+1.** Every incoming message triggers a per-message refetch +
   client-side signed-URL minting because neither realtime nor the edge
   refresh actions carry attachments.
9. **Copy drift: "images" vs "files".** Server errors say "Add up to five
   images" and the RPC raises `'too many images'`; the drop overlay says
   "Add images" — all now wrong for documents.
10. **Dead `video` capability.** Search filters accept `contentKinds:
    'video'` but no `video/*` MIME can ever enter the bucket.
11. **Duplicated validation constants.** The MIME allow-list lives in ≥ 4
    places (core, web hook, edge function, SQL RPC) with no single source of
    truth; core has no validation functions at all, and core's fixture suite
    has **zero attachment merge vectors** (the `images` branch of
    `mergeChatMessage` is fixture-untested) — a parity risk for every native
    port.
12. **`File.type` is trusted for the image/file split** until the server
    re-validates; a mis-typed file renders a wrong preview kind client-side.

---

## 4. Research findings that shape this plan

### 4.1 Platform capabilities (verified against primary docs)

- **PhotosPicker (SwiftUI, PhotosUI) is the correct picker.** iOS 16+; the
  repo's floor is iOS 17 (`apps/ios/FishKit/Package.swift`,
  `platforms: [.iOS(.v17)]`), so every needed capability is available. It is
  system-rendered and out-of-process: "private by default", **no photo
  permission and no Info.plist key** [S1][S2][S7]. `maxSelectionCount:`
  caps selection; `selectionBehavior: .ordered` numbers the user's picks and
  preserves that order [S1][S4] — the Telegram pattern (§4.2) for free.
- **Load via custom `Transferable`, not `SwiftUI.Image`** (PNG-only), and
  handle iCloud-offloaded originals: loads can fail offline and the
  completion variant returns `Progress` for download UI [S3][S6][S9].
- **Camera** would use `UIImagePickerController` wrapped for SwiftUI (Apple
  still recommends it for simple capture over AVCapture [S11]); it hard
  requires `NSCameraUsageDescription` — the app is terminated without it
  [S13]. The Catalog Info.plist already has a camera string, but its copy is
  call-specific ("…so your coach can see you during video calls").
- **Documents** use SwiftUI `.fileImporter` (iOS 14+) with a strict
  `allowedContentTypes` allow-list; it returns security-scoped URLs — call
  `startAccessingSecurityScopedResource()`, copy the bytes into app-owned
  staging while the scope is open, then release; never persist picker URLs
  [S14][S15].
- **Picker/provider URLs are ephemeral** (the system deletes the temp copy
  when the handler returns) [S16]. The staging outbox must live in
  `Application Support` — `tmp` and `Caches` can be purged — written
  atomically, UUID-named, and excluded from iCloud backup [S17][S18][S19].
- **One ImageIO pass solves four problems.** `CGImageSourceCreateThumbnailAtIndex`
  with `kCGImageSourceCreateThumbnailWithTransform: true` downsamples without
  decoding the full bitmap (a 12 MP photo decodes to ~48–80 MB otherwise),
  bakes EXIF orientation into pixels, and re-encoding via
  `jpegData(compressionQuality:)` produces a fresh bitmap that simply carries
  no EXIF/GPS [S20][S21][S25][S50]. The picker does **not** strip metadata by
  default (iOS 17 only offers the user an opt-out menu) [S9], so the app must
  strip to guarantee privacy.
- **ImageIO cannot encode WebP.** Verified on this machine:
  `CGImageDestinationCopyTypeIdentifiers()` lists 22 encodable types, WebP
  absent; decode is supported. This forces either a libwebp dependency or a
  backend change; §7.1 chooses the backend change.
- **supabase-swift storage today** has `createSignedUploadURL` /
  `uploadToSignedURL` / `createSignedURLs` / `download`, but **no upload
  progress reporting and no TUS/resumable support** (verified against
  `Sources/Storage/StorageFileApi.swift` and the Supabase docs; the
  resumable guide lists no Swift client) [S43][S44][S45][S48]. Progress
  therefore requires PUT-ing the staged file with our own
  `URLSession.uploadTask(with:fromFile:)` and a task delegate
  (`didSendBodyData`) [S26][S29].
- **Background sessions are the wrong default here.** They are delegate-only,
  file-only, rate-limited on relaunch, and designed for "long-running and
  nonurgent transfers" [S27][S28]. Post-compression chat payloads are
  hundreds of KB; a foreground session with `waitsForConnectivity`, plus a
  `beginBackgroundTask` grace window when the app is backgrounded mid-upload,
  is simpler and keeps async/await and progress [S30][S32]. `NWPathMonitor`
  drives offline gating and auto-retry [S31].
- **AsyncImage is insufficient for the transcript** (no progress, no cache
  control; its customization points are iOS 27 beta only) — a small
  hand-rolled loader with `NSCache` keyed by **storage path** (signed URLs
  embed expiring tokens, so URL-keyed caches always miss) is required
  [S35][S36][S38].
- **Testing:** URLProtocol interception for the upload pipeline (tests the
  real request/retry code) [S41][S49]; the picker runs out-of-process, so
  flows must be testable through an injected attachment source rather than
  UI-driving system chrome [S7]; snapshots must be recorded on a pinned
  simulator [S51]. Apple's adoption stats (June 2026: iOS 26 on 86 % of
  recent iPhones) support a matrix of latest-iOS simulators in CI plus one
  older physical device [S42].

### 4.2 Messaging app patterns (public behavior, cited in §18)

Compared: WhatsApp, Telegram, Signal, Apple Messages, Slack [S56–S74].
Highlights that informed decisions:

- All five insert the message optimistically and show quiet per-item
  progress in place; WhatsApp documents its transfer counter.
- Telegram numbers photo selections and honors the order; albums cap at 10
  with one bubble and one notification per batch.
- WhatsApp/Telegram queue offline sends behind a soft clock icon that
  resolves itself; iMessage's red "Not delivered" exclamation with
  manual-only retry is the pattern everyone else avoids.
- Slack uses one message per batch of files (no per-item captions) and
  documents a hard cap surfaced in the product (10 files).
- WhatsApp/Telegram expose quality forks (HD toggles, compress-vs-file);
  Signal and iMessage compress silently. WhatsApp file cards show type icon,
  name, size, page count.

### 4.3 Resolutions for FISH (calm, one-primary-action, assigned-not-chosen)

- Selection order badges + honored order: adopt (free with `.ordered`).
- Small documented cap surfaced in the picker: adopt (`maxSelectionCount: 5`
  and cap copy in the strip).
- One caption per batch = the message body: adopt (already the web model).
- Silent compression, no quality forks, no editors: adopt.
- Optimistic insert + quiet per-tile progress + per-item retry on the item
  itself: adopt.
- Soft self-resolving recovery over red-badge dead ends: adopt — auto-retry
  uploads on reconnect, notice-toned copy, never red, never scolding.
- Album-style grouping: keep web's flow-wrap layout for cross-platform
  visual parity rather than adopting Telegram mosaics (§16.1).

---

## 5. Recommended iOS experience

Every screen keeps one primary action (Send). All copy is sentence case,
literal, non-scolding, notice-toned on failure. All targets ≥ 44 pt
(`Metrics.targetTouch`). Reduce Motion suppresses all animation via the
existing `Motion` policy.

### 5.1 Adding photos

The composer's existing `+`-style entry: a new `IconButton` (paperclip icon,
accessibility label "Add to message") sits left of the expression trigger in
`MessageComposer`. Tapping it presents a compact menu (action sheet /
confirmation dialog) with two rows — **Photo library** and **File** (Camera
joins later, §14 Phase 8). One tap → `PhotosPicker` sheet
(`matching: .images`, `maxSelectionCount: 5 - stagedCount`,
`selectionBehavior: .ordered`, `preferredItemEncoding: .current`). The system
picker shows numbered selection badges; confirming returns items in that
order. No permission prompt ever appears [S1][S7].

While picked items load (iCloud originals may download), their tiles appear
immediately in the staged strip in a `loading` state with indeterminate
shimmer-free placeholders (Skeleton component), so slow iCloud loads are
visible, not silent [S3].

### 5.2 Adding files

"File" opens `.fileImporter` with
`allowedContentTypes: [.pdf, .plainText, .commaSeparatedText, .docx, .xlsx, .pptx]`
(the OOXML types via `UTType(filenameExtension:)`), `allowsMultipleSelection:
true`. On return, each URL is read under its security scope and copied into
the staging outbox before the handler returns [S14][S16]. Files never get a
quality/compression step.

### 5.3 The staged strip (pre-send)

A horizontal strip above the input field (parity with web's
`ImageUploadPreview`): square tiles (`Metrics`-token size, `Radius.control`),
image thumbnails `scaledToFill`, file tiles with the document icon and a
truncated filename underneath. Each tile carries:

- a determinate progress bar (staged ranges matching web: preparing
  0.02–0.25, uploading 0.25–0.90, finishing 0.90–0.99 truthfully by queue
  position (§15.2), ready 1.0),
- a ≥ 44 pt remove control ("Remove {name}") that cancels transfer + server
  row,
- on failure: the tile dims, shows a notice-colored dot + "Didn't finish",
  and tapping the tile opens Retry / Remove (retry lives on the item itself,
  §4.3).

Adding is disabled (button dimmed, not hidden) while offline, while a GIF or
sticker is staged (mutual exclusivity parity), or when 5 items are staged.
Validation is **per-file** (improvement over web §15.1): unsupported or
oversized files are skipped with one combined notice ("2 files were left out
— each file needs to be 10 MB or smaller."), valid ones stage normally.

### 5.4 Sending and in-bubble upload state

Send stays a single primary action, enabled when the draft is sendable
(existing `MediaSelectionRules`, extended: body optional when ≥ 1 attachment
is `ready`; disabled while any staged item is uploading or failed, with the
web-parity hint copy). On send, the optimistic bubble renders instantly using
the local staged thumbnails (web parity of blob-preview behavior), with the
existing `sending` delivery status.

### 5.5 Failure and recovery

- Upload failure: per-tile retry/remove as in 5.3. Transient network drops
  auto-retry with backoff once connectivity returns (`NWPathMonitor`), so
  most failures resolve themselves before the user notices (§4.2's
  soft-queue pattern) [S31].
- Send failure: existing `failed` delivery status + "Try again" link in the
  bubble (already built in `MessageBubble`); retry restores staged state
  because ready attachments stay bound-able for 2 hours.
- Rate limit (429): "You have added several files. Try again in a little
  while." (server copy, reused verbatim).
- Nothing is red; everything uses `notice` tone; no state dead-ends.

### 5.6 Rendering in the transcript

`MessageBubble` renders attachments above the body text (web parity):

- **Images.** One image: single tile at chat-preview max width with its real
  aspect ratio. Two to five: flow-wrap rows of tiles with aspect ratios
  clamped to [2/3, 2] and `Spacing.threeXs`-level gaps — a Swift port of
  web's layout rules so both platforms group identically. Blur-up: 64 px
  thumbnail immediately (it is ≤ 16 KB), display image crossfades in
  (`MotionDuration` token; no animation under Reduce Motion). Unavailable →
  quiet "Image unavailable" surface + "Try again".
- **Files.** Card with document icon, `originalName` (Dynamic Type,
  truncating middle), caption "`{type label} · {size}`" (labels identical to
  web: PDF, Text file, CSV, Word document, Excel workbook, PowerPoint
  presentation), and a download affordance.
- Pending/optimistic tiles reuse the staged thumbnails so there is no flash
  between send and hydration.

### 5.7 Viewing

- Tapping an image opens a full-screen viewer: scrim background, pinch zoom,
  swipe-through across that message's images (Telegram/Signal pattern),
  "Close image" control ≥ 44 pt, share via the system share sheet.
- Tapping a file downloads it (progress on the card) to a temporary location
  and presents Quick Look (`QLPreviewController`) — native inline preview
  for every supported format, better than web's open-in-new-tab (§15.6).

### 5.8 Copy (exact strings, sentence case)

| Situation | Copy |
| --- | --- |
| Menu items | "Photo library" · "File" ("Camera" later) |
| Count cap | "Add up to five files to one message." |
| Too large (per file skipped) | "{n} files were left out — each file needs to be 10 MB or smaller." |
| Unsupported (per file skipped) | "{n} files were left out — that file type is not supported yet." |
| Tile failed | "Didn't finish" (+ Retry / Remove) |
| Send blocked | "Let the files finish preparing, then send." / "Retry or remove the upload that didn't finish" |
| Image load failure | "Image unavailable" + "Try again" |
| Offline | Add control disabled; existing composer offline treatment |

---

## 6. Proposed iOS architecture

Follows the Calls/Presence shape exactly: provider-neutral data target →
one `@MainActor @Observable` orchestrator per concern → stateless views fed
value projections → concrete adapters constructed only at the app boundary
(Catalog live lab). Import direction stays guard-enforced (`pnpm ios:guard`).

### 6.1 Decision table

| Decision | Choice | Rationale | Rejected alternative |
| --- | --- | --- | --- |
| Picker | `PhotosPicker`, `.ordered`, max 5 | Zero-permission, system-private, order badges free [S1][S7] | `PHPickerViewController` wrap (more code, same engine); custom gallery (needs library permission — worst privacy posture) |
| Image staging format | JPEG (q 0.8, ≤ 2560 px) + backend accepts JPEG staging (§7.1) | ImageIO cannot encode WebP (verified §4.1); server transcodes staging → WebP anyway, so output parity is preserved | Bundling libwebp (new binary dep, against repo dependency discipline); uploading originals (bandwidth, metadata leaks) |
| Upload transport | Signed PUT of staged file via own `URLSession` upload task | supabase-swift has no progress/TUS [S45][S48]; PUT from file gives progress, cancel, backgrounding [S26][S29]; payloads ≤ 10 MB don't need chunked resume | TUS client dep (third-party, unneeded at this size); `client.storage.uploadToSignedURL` (no progress) |
| Session model | Foreground `URLSession` + `waitsForConnectivity` + `beginBackgroundTask` grace | Right-sized for chat payloads; keeps async/await [S27][S30][S32] | Background `URLSessionConfiguration` (delegate-only, relaunch rate-limited — reserve for a future video feature) |
| Staging home | `Application Support/ChatOutbox/{uuid}.{ext}`, atomic, backup-excluded | Survives relaunch; tmp/Caches purgeable [S17][S18][S19] | tmp (silently vanishing queue) |
| Ports location | `ChatData` (stays Foundation-only) with raw-URLSession adapters + `ChatBackendConfiguration` mirroring `CallBackendConfiguration` | CallData precedent; attachments need no realtime; smallest dependency footprint | Linking Supabase SDK into ChatData now (PresenceData precedent — revisit when chat realtime lands, §17.4) |
| Transcript images | Hand-rolled `MessageImageLoader` (NSCache by storage path + ImageIO downsampled decode) | Signed URLs rotate → URL-keyed caches useless; AsyncImage lacks progress/cache control [S35][S38] | AsyncImage (fine for GIF posters, wrong here); third-party image lib (unneeded) |
| Grouping layout | Port web's flow-wrap + aspect-clamp rules | Cross-platform visual parity; pure logic → fixture/snapshot-testable | Telegram mosaic algorithm (prettier, but diverges from web and is more logic to keep in sync) |

### 6.2 Project structure (additions only)

```
FishKit/Sources/ChatData/
  Models/      ChatAttachment.swift            // wire + domain value types
               AttachmentUploadState.swift     // state machine value types
  Providers/   AttachmentCommandProviding.swift  // initialize/complete/cancel/refreshUrls
               AttachmentByteUploading.swift     // PUT staged file w/ progress stream
               AttachmentHydrating.swift         // fetch ready rows + signed URLs for message ids
  Logic/       AttachmentValidationRules.swift   // mirrors chatLimits + MIME allow-list
               AttachmentStateReducer.swift      // per-item state transitions (pure)
  Adapters/    ChatBackendConfiguration.swift    // supabaseUrl, anonKey, accessToken closure
               EdgeFunctionAttachmentCommands.swift
               SignedUrlByteUploader.swift       // URLSession uploadTask(fromFile:), delegate → AsyncStream progress
               RestAttachmentHydration.swift     // PostgREST select + storage sign REST
  Staging/     AttachmentStaging.swift           // outbox copy-in, atomic write, sweep
               ImagePreparation.swift            // ImageIO downsample + orient + strip + JPEG
               ByteSignature.swift               // magic-byte checks (jpeg/png/webp/pdf/ooxml/text)

FishKit/Sources/PersonalChat/
  Models/      MessageAttachmentUiModel.swift    // render model (see 6.3)
               StagedAttachment.swift            // strip tile model
  ViewModels/  AttachmentUploadsModel.swift      // @MainActor @Observable queue orchestrator
  Logic/       AttachmentLayout.swift            // flow-wrap + aspect clamp (pure port of web rules)
               AttachmentAccessibility.swift     // labels for tiles/bubbles/cards
  Views/       StagedAttachmentStrip.swift, StagedAttachmentTile.swift
               MessageAttachments.swift, MessageImageTile.swift, MessageFileCard.swift
               AttachmentViewer.swift            // full-screen swipe-through viewer
  Views/Composer additions: attach entry + menu inside MessageComposer

FishKit/Sources/TestSupport/
  Fixtures/    AttachmentFixtures.swift          // staged/ready/failed vectors, sample images & PDFs
  Providers/   FixtureAttachmentProviders.swift  // scripted command/upload/hydration ports

Catalog/Sources: "Attachments" catalog page (all states) + live-lab wiring.
```

Icon additions required in the generated icon pipeline (`design/icons` →
`Icons.xcassets` → `Icon` enum): `paperclip` (attach), `photo`, `file-text`
already exists on web (Tabler set) — match Tabler names used by web
(`IconPlus`/`IconUpload`/`IconFileText`/`IconDownload` equivalents).

### 6.3 Data models (key shapes)

```swift
// ChatData — mirrors packages/core/src/chat.ts ChatImage field-for-field.
public struct ChatAttachment: Equatable, Sendable, Codable {
    public enum Kind: String, Sendable { case image, file }
    public let id: String
    public let kind: Kind                 // unknown wire kinds → decode as file-like fallback, never crash
    public let originalName: String
    public let mimeType: String?
    public let byteSize: Int?
    public let width: Int?
    public let height: Int?
    public let thumbnailPath: String?
    public let displayPath: String
    public let thumbnailUrl: URL?         // signed, short-lived, refreshable
    public let displayUrl: URL?
}

// ChatData — limits mirrored from packages/core (Codable contract test pins them).
public enum AttachmentRules {
    public static let maxCount = 5
    public static let sourceMaxBytes = 10 * 1024 * 1024
    public static let imagePreparedMaxBytes = 5 * 1024 * 1024
    public static let imageMaxDimension: CGFloat = 2560
    public static let jpegQuality: CGFloat = 0.8
    public static let allowedSourceMimeTypes: Set<String> = [/* 9 web values */]
}

// PersonalChat — render model; MessageUiModel gains one field.
public struct MessageUiModel /* existing */ {
    // ... existing fields ...
    public let attachments: [MessageAttachmentUiModel]   // default [], parallel to `media`
}
```

`ChatAttachment` gets a Codable key-set test pinning the exact wire keys
(house pattern from `ChatGifCodingTests`). Forward compatibility: unknown
`kind` values render as a generic file card ("File unavailable" if paths are
missing), mirroring `.gifUnavailable`.

### 6.4 Ports (ChatData, Foundation-only)

```swift
public protocol AttachmentCommandProviding: Sendable {
    func initializeUpload(_ request: InitializeAttachmentRequest) async throws -> AttachmentUploadAuthorization
    func completeUpload(attachmentId: String) async throws -> ReadyAttachment
    func cancelUpload(attachmentId: String) async
    func refreshUrls(attachmentIds: [String]) async throws -> [SignedAttachmentUrl]
}

public protocol AttachmentByteUploading: Sendable {
    // PUT the staged file; yields fractional progress; honors cancellation.
    func upload(fileUrl: URL, to authorization: AttachmentUploadAuthorization) -> AsyncThrowingStream<Double, Error>
}

public protocol AttachmentHydrating: Sendable {
    func readyAttachments(forMessageIds: [String]) async throws -> [String: [ChatAttachment]]
}
```

`EdgeFunctionAttachmentCommands` speaks plain HTTPS to
`functions/v1/chat-image-command` with `apikey` + bearer headers and a 15 s
deadline — the `EdgeFunctionCallCommands` pattern verbatim.
`SignedUrlByteUploader` derives the signed PUT URL exactly as web does
(`/storage/v1/object/upload/sign/{bucket}/{objectPath}?token={uploadToken}`)
from `ChatBackendConfiguration.supabaseUrl` and uploads with
`uploadTask(with:fromFile:)`, bridging `didSendBodyData` into the stream
[S26][S29]. `RestAttachmentHydration` does the RLS PostgREST select on
`message_attachments` (`status=eq.ready`, `message_id=in.(…)`, ordered by
`position`) plus the batch storage sign call — the same two requests web's
hydration makes.

### 6.5 The upload queue (`AttachmentUploadsModel`, PersonalChat)

`@MainActor @Observable final class` injected with the three ports, the
staging service, an `imagePreparer`, a `clock`, and `makeClientUploadId` —
all injectable for determinism (Calls precedent). Owns `[StagedAttachment]`
and drives each through the state machine in §9.1:

- Concurrency 2 for prepare+upload (web parity); `complete` calls serialized
  through one queue (web parity — the server step is CPU-bound).
- Progress mapping identical to web, except the queue position is truthful
  (§15.2).
- `NWPathMonitor` gates entry and triggers auto-retry of `failed(transient)`
  items on reconnect.
- On app backgrounding with active uploads: `beginBackgroundTask` (named,
  with expiration handler that pauses cleanly) [S32].
- On screen dismissal with un-sent staged items: cancel transfers **and
  server-cancel initialized rows** (fixes web weakness §3.1), then sweep
  staged files. On relaunch, `AttachmentStaging.sweep()` deletes orphaned
  outbox files.

### 6.6 Image pipeline (`ImagePreparation`, pure)

Staged original → `CGImageSourceCreateThumbnailAtIndex`
(`kCGImageSourceCreateThumbnailWithTransform: true`,
`kCGImageSourceThumbnailMaxPixelSize: 2560`, no full decode) →
`jpegData(compressionQuality: 0.8)` → atomic write to outbox. This bakes
orientation, strips all EXIF/GPS (fresh bitmap), caps memory, and yields the
declared `image/jpeg` staging MIME [S20][S21][S25]. Post-encode > 5 MB →
one retry at quality 0.6, then per-file rejection with the size notice
(mirrors web's post-compression guard). `ByteSignature` re-verifies magic
bytes before upload (JPEG `FF D8 FF`, PDF `%PDF-`, OOXML zip, UTF-8 text) so
a mis-typed pick is caught client-side (§3.12 fixed).

### 6.7 Transcript loader (`MessageImageLoader`)

An actor: `NSCache<NSString, UIImage>` keyed by **storage path** with
decoded-byte cost accounting; request coalescing; ImageIO-downsampled decode
to the tile's pixel size; loads run in `.task(id:)` per tile so scroll-away
cancels work [S35][S38]. A second, tiny disk layer under `Caches/ChatMedia/`
keyed by path stores the *encoded* bytes — safe because processed objects are
immutable at their paths — so reopening a chat renders without re-downloading
(improvement §15.5; Caches purge just means re-download). Signed-URL expiry
(15 min) surfaces as a 400/403 on fetch → the loader asks
`refreshUrls` once and retries (web's `refreshUrls` behavior).

### 6.8 Composer integration

`ComposerSelection` (`.none/.gif/.sticker`) stays untouched — attachments are
a parallel axis (text + attachments compose; GIF/sticker exclude both, as on
web/server). `MediaSelectionRules.isSendable` extends to: sendable when
(non-empty body OR ≥ 1 ready attachment) AND no staged item uploading or
failed AND connection ready. `PersonalChatScreen` gains
`attachmentUploads: AttachmentUploadsModel` and an `onSend` payload that now
carries `attachmentIds` — the seam the future send slice consumes (§17.1).

---

## 7. Backend, schema, and storage changes

### 7.1 Required: accept JPEG staging for images (small, additive)

Today images must stage as WebP (`bucket allowed_mime_types`, the edge
function's `uploadMimeType: 'image/webp'` for `kind='image'`, and the
`isWebP` magic-byte check in `complete-upload`). iOS cannot encode WebP
natively (§4.1). Change, in one migration + one edge-function edit:

1. Migration: add `'image/jpeg'` to the `chat-images` bucket
   `allowed_mime_types` (RPC source-MIME allow-list already accepts
   `image/jpeg` sources — only the staging content type is affected).
2. `chat-image-command`: for `kind='image'`, set `uploadMimeType` to the
   client's declared staging format when it is `image/webp` **or**
   `image/jpeg` (web keeps sending WebP unchanged); in `complete-upload`,
   accept JPEG magic bytes (`FF D8 FF`) alongside `isWebP`. ImageMagick
   already decodes JPEG; display/thumbnail outputs remain WebP, so the
   stored contract, DB invariants (`stored_mime_type = 'image/webp'`), web
   rendering, and Android are all untouched.

Trade-off: iOS images are transcoded twice (JPEG staging → WebP variants) —
but web's pipeline is also double-lossy (client WebP → server WebP), and the
server's 1920 px / q78 output dominates final quality. Rejected alternative:
bundling libwebp on iOS (new binary dependency, maintenance, app-size cost,
against the repo's dependency discipline).

### 7.2 Required: schedule cleanup and delete orphaned objects

`expire_unattached_chat_images()` exists but is never scheduled, and it only
flips rows to `cancelled` without deleting storage objects (§3.2). Add a
`cron.schedule` job (daily, like `cleanup-presence-sessions-daily`) and
extend the sweep to remove `staging/display/thumbnail` objects for
`cancelled`/expired rows (service-role storage delete — simplest as a small
scheduled edge function, since SQL cannot delete storage objects). This
protects every client, not just iOS.

### 7.3 Recommended: copy fixes

`send-message` "Add up to five images to one message." → "…five files…";
RPC error `'too many images'` → `'too many attachments'` (keep the edge
function's mapping in sync); web drop overlay "Add images to this message" →
"Add files to this message". Cosmetic but contract-visible (§3.9).

### 7.4 Optional (backport candidate, not required for iOS v1)

Include ready attachments (+ signed URLs) in `chat-command`'s
`refresh-messages` / `refresh-conversation` responses to kill the per-message
N+1 (§3.8). iOS v1 replicates web's hydration instead, so both platforms can
adopt the enriched response together later.

### 7.5 No schema changes

`message_attachments`, RLS policies, rate limits, statuses, and
`send_chat_message` binding are used as-is. Note as a documented hard
requirement for client authors: **the signed upload token is the only
ingress** — there is no storage INSERT RLS, so no client may attempt direct
uploads outside the initialize contract (§2.7).

---

## 8. Component-level behavior

### 8.1 Attachment entry + pickers

- Attach `IconButton` (paperclip): disabled states per §5.3; accessibility
  label "Add to message"; menu is a confirmation-dialog-style sheet, rows ≥
  44 pt, labels "Photo library" / "File".
- `PhotosPicker` sheet configured per §5.1. On item return: create
  `StagedAttachment(loading)` tiles immediately in pick order; each
  `PhotosPickerItem` loads via a custom `Transferable` `Data` representation
  → staging → preparation; load failure (offline iCloud) marks that tile
  `failed` with the standard tile treatment, others proceed [S3][S6].
- `.fileImporter` per §5.2. Security-scope handling per §4.1; per-file
  validation before staging.

### 8.2 Staged attachment tile — state table

| State | Visual | Progress | Actions | VoiceOver |
| --- | --- | --- | --- | --- |
| loading (picker/iCloud) | skeleton fill | none | Remove | "{name or Photo}, loading, button, Remove" |
| preparing | thumbnail, dim | 0.02–0.25 | Remove | "…, preparing" |
| uploading | thumbnail | 0.25–0.90 (real bytes) | Remove (cancels) | "…, uploading {n} percent" |
| waiting / processing | thumbnail | truthful 0.90–0.99 (§15.2) | Remove | "…, finishing" |
| ready | thumbnail, full | hidden | Remove | "…, ready to send" |
| failed | dim + notice dot + "Didn't finish" | hidden | Retry · Remove | "…, didn't finish, button, retry" |

Geometry never shifts between states (layout-stability rule). All tiles are
one VoiceOver element each; the strip is a labeled container ("Files to
send").

### 8.3 Upload queue engine (behavior spec)

- Admission: per-file validation (type via UTType conformance + magic bytes,
  size ≤ 10 MB, count ≤ 5 including staged). Skipped files produce one
  combined notice naming the reason.
- Pipeline per item: stage → (images) prepare → initialize (idempotent by
  `clientUploadId`) → PUT with progress → complete (serialized) → ready.
- Cancellation: remove at any state aborts the URLSession task, calls
  `cancel-upload` when a row exists, deletes the staged file.
- Retry: failed → fresh `clientUploadId`, restart from initialize (web
  parity); transient network failures also auto-retry on reconnect with
  exponential backoff + jitter (max 3 automatic attempts, then wait for the
  user).
- Lifecycle: backgrounding continues under a named background task with a
  clean pause on expiry; screen dismissal cancels + server-cancels; app
  launch sweeps the outbox.
- The queue never blocks the composer: typing, sending is only gated by
  §6.8's rules.

### 8.4 Message attachment rendering — state table

| State | Image tile | File card |
| --- | --- | --- |
| optimistic (sending) | staged thumbnail, delivery row shows "sending" | card with name/type/size |
| thumbnail only (hydrated) | 64 px blurred-up thumbnail | n/a |
| display loaded | crossfade to sharp (none under Reduce Motion) | n/a |
| URL expired | transparent auto-refresh once, then "Image unavailable" + "Try again" | download action fails → "Try again" |
| unavailable / unknown kind | "Image unavailable" quiet surface | "File unavailable" |
| deleted message | not rendered (web parity) | not rendered |

Bubble remains a single combined VoiceOver element; `MessageAccessibility`
weaves in "{n} photos" / "{name}, PDF, 2.1 MB" before the body text. Tap
targets (tiles, cards, retry) are separately focusable, following the
`MessageGif` precedent for focusable children.

### 8.5 Viewer & file preview

- `AttachmentViewer`: full-screen cover, `TabView`-paged swipe-through of the
  message's images, pinch zoom, scrim background, top-trailing "Close image"
  (≥ 44 pt), share button → system share sheet. VoiceOver: "Image {i} of
  {n}, shared by {author}". Reduce Motion disables the page transition
  animation.
- Files: tapping the card streams to `tmp` with card-level progress, then
  `QLPreviewController` presents it; the share sheet is available from Quick
  Look. Downloads are re-verified against the expected byte size.

---

## 9. State and error-handling flows

### 9.1 Upload item state machine (pure, `AttachmentStateReducer`)

```
picked ─→ staging ─→ (image? preparing) ─→ initializing ─→ uploading ─→ completing ─→ ready
   │          │             │                   │              │             │
   └──────────┴─────────────┴───────────────────┴──────────────┴─────────────┴──→ failed(reason)
                                                                                    │  ▲
                                                              retry / reconnect ────┘  │
removed (any state) → cancel task + cancel-upload + delete staged file ────────────────┘
```

`failed` carries a typed reason (`unsupportedType`, `tooLarge`,
`preparationFailed`, `offline`, `rateLimited`, `serverRejected(code)`,
`expired`) → copy and retry policy derive from it (only transient reasons
auto-retry). Transitions are fixture-tested as vectors (house pattern:
`CallStateVectorTests`).

### 9.2 Send gating

Sendable ⇔ (body non-empty OR ≥ 1 ready attachment) AND no staged item in a
non-terminal state AND no failed item AND connection ready. This is web's
`imageUploadsSettled` semantics, expressed in `MediaSelectionRules` and
fixture-tested.

### 9.3 Partial failure in multi-file uploads

- **Before send:** independent items — one failure never cancels siblings;
  the failed tile shows retry; Send is gated until the item is retried or
  removed (web parity: no partial sends, the user always decides).
- **At admission:** per-file skips with a combined notice (improvement over
  web's all-or-nothing, §15.1).
- **At send:** the server binds all-or-nothing inside `send_chat_message`
  ("image attachment is not ready" on any mismatch) — surfaced as a failed
  message with retry; ready rows stay bindable for 2 h, so retry does not
  re-upload.
- **Expiry edge:** if a staged item sits > 2 h (user left the composer
  open), `complete`/bind returns 410/`expired` → tile flips to failed with
  reason `expired`; retry restarts from initialize.

### 9.4 Hydration and refresh flow (read path)

On message fetch or realtime insert (once the send slice exists): collect
message ids → `AttachmentHydrating.readyAttachments(forMessageIds:)` → merge
into `MessageUiModel.attachments` preserving optimistic attachments when the
ack carries none (port of `mergeChatMessage`'s images branch; add the
missing fixture vectors to `packages/core` so all three platforms replay
them, §16.3). Signed URLs refresh lazily on fetch failure (§6.7), and
`refresh-image-urls` batches ≤ 50 ids (server contract).

### 9.5 Connectivity and lifecycle

`NWPathMonitor` (one instance in the model): unsatisfied → attach entry
disabled, in-flight PUTs continue under `waitsForConnectivity`; satisfied →
auto-retry transient failures. Backgrounding: named `beginBackgroundTask`
around active uploads; expiration pauses uploads cleanly (they restart from
initialize on foreground — acceptable at these payload sizes). Termination:
staged files persist in the outbox; the launch sweep removes entries with no
live composer session (fresh start, matching web's refresh behavior).

---

## 10. Security and privacy

- **Metadata stripping is guaranteed, not hoped for**: re-encoding produces a
  fresh bitmap with no EXIF/GPS; we do not rely on the picker's user-optional
  metadata menu [S9][S20]. (Improvement over trust-the-source approaches;
  web strips via `preserveExif: false` — parity.)
- **Zero-permission posture**: no photo-library keys are added; the picker is
  out-of-process and private by default [S1][S7]. Camera keys only when the
  camera phase ships, with attachment-appropriate copy (§17.2).
- **Validation defense in depth**: UTType conformance at pick, magic-byte
  verification at staging (client) and again server-side (existing), size
  checks client + RPC + bucket. Client never trusts declared types (§3.12
  fixed on iOS).
- **Filenames**: storage keys are server-generated UUID paths (existing
  contract); the original name is display metadata only; staged files are
  UUID-named — user text never becomes a path component [S33].
- **At rest**: staged files use default protection
  (`completeUntilFirstUserAuthentication` — readable during
  post-unlock background uploads), `isExcludedFromBackup = true` [S18][S34].
- **URLs as data**: attachment bytes are fetched only from
  `ChatBackendConfiguration.supabaseUrl`-derived hosts using paths the
  client received via the authenticated contract; message-carried URLs are
  never dereferenced as instructions.
- **Signed tokens**: upload tokens and signed URLs are never logged; the
  existing 15-minute TTL + RLS read policy govern access (no change).
- Rate limits (20/10 min, 100/day) are surfaced with the server's calm copy.

## 11. Accessibility

- Every attachment has an accessible name (guideline "Media accessibility in
  chat" default): tiles, cards, viewer pages, and combined bubble labels per
  §8.2/§8.4. Never read filenames-as-UUIDs; prefer "{Photo}" / original
  document names.
- Dynamic Type throughout (file cards, notices, viewer chrome) via existing
  `textStyle(_:)` roles; layouts tested at `accessibilityExtraLarge` in the
  snapshot matrix (house `assertAccessibilitySnapshots` covers XL + RTL).
- All controls ≥ 44 pt (`Metrics.targetTouch`); no drag-only or press-and-hold-only
  interactions; every gesture (swipe-through) has button alternatives
  (previous/next available to VoiceOver via adjustable trait or paged
  controls).
- Reduce Motion: no blur-up crossfade, no viewer page animation, skeletons
  static — through the existing `Motion` policy (explicit, unlike web's
  global CSS clamp — see §15.10).
- Announcements: upload completion/failure posts polite announcements so
  silent visual state changes are exposed ("2 files ready to send",
  "1 file didn't finish").
- No autoplay anywhere (images are static; files never auto-open).
- Alt-text authoring is not in v1 — recorded as an unresolved product
  decision (§17.6) since it needs schema + coach workflow, and web lacks it
  too.

## 12. Performance

- Downsample-at-decode everywhere: transcript tiles decode at tile pixel
  size via ImageIO, never full-bitmap (§4.1 memory math) [S20][S50].
- `NSCache` with decoded-cost limits + immutable-path disk cache (§6.7);
  memory-warning eviction is automatic.
- `LazyVStack` transcript unchanged; per-tile `.task(id:)` cancels loads on
  scroll-away; thumbnails (≤ 16 KB) make first paint effectively instant.
- Upload work (staging copy, ImageIO, JPEG encode) runs off the main actor;
  the 2560 px/q0.8 prepare keeps typical uploads in the hundreds of KB —
  fast on LTE and cheap for the server transcode.
- Concurrency 2 + serialized completes protects the edge function (web
  parity; verified by web's e2e "two medium images … without competing for
  Edge CPU").
- The staged strip and bubbles keep stable geometry across states (no layout
  churn while progress updates).

## 13. Testing strategy

Unit (deterministic, injected clocks/ports — house style):
- `AttachmentValidationRules`: allow-list, size, count, per-file skip
  reasons; contract test pinning constants against `packages/core` values.
- `ImagePreparation` with fixture images: orientation matrix (all 8 EXIF
  orientations render upright), GPS/EXIF absence in output bytes, dimension
  caps, quality retry, HEIC input (device-generated fixture), huge-image
  memory ceiling (downsample path, no full decode).
- `ByteSignature` against fixture files incl. mismatched-extension cases.
- `AttachmentStateReducer` vector tests (JSON fixtures, replayable by other
  platforms later — the `call-state-vectors` pattern).
- `AttachmentUploadsModel`: URLProtocol-stubbed pipeline (initialize → PUT →
  complete), progress mapping, cancellation mid-PUT, retry with fresh
  `clientUploadId`, auto-retry on reconnect (scripted path monitor), rate
  limit 429 handling, expiry 410 handling, dismissal server-cancel [S41].
- `AttachmentHydrating` merge logic incl. optimistic-preservation vectors.
- Codable key-set tests for `ChatAttachment` and the initialize/complete
  wire payloads.

Snapshots (`assertThemedSnapshots` light/dark + `assertAccessibilitySnapshots`
XL/RTL, pinned simulator [S51]):
- Strip: each §8.2 state; 1–5 tiles; mixed image+file.
- Bubbles: 1/2/3/4/5 images (aspect extremes 2/3 and 2), image+text,
  files, mixed, failed, optimistic, unavailable.
- Viewer chrome; file card longest-name truncation.

Catalog + accessibility audit:
- New "Attachments" page rendering every state offline via
  `FixtureAttachmentProviders`; added to `CatalogAccessibilityAuditTests`
  page list and swept by `performAccessibilityAudit`. Baselines get the
  mandatory human visual review (repo memory rule).

Live/manual (device matrix informed by adoption data [S42]):
- CI: latest iOS simulator; snapshots pinned to the house simulator.
- Device pass A (recent iPhone, latest iOS): PhotosPicker ordered
  multi-select incl. iCloud-offloaded originals on cellular, HEIC camera
  photos from the library, large-PDF Quick Look, backgrounding mid-upload,
  Airplane-mode drop → reconnect auto-retry.
- Device pass B (oldest supported: an iOS 17 device): memory behavior on a
  5×12 MP send, Dynamic Type XL, VoiceOver transcript sweep.
- Two-account iOS ↔ web interoperability: send each kind both directions,
  verify rendering parity, signed-URL refresh after 15 min, rate-limit copy,
  and web's existing e2e suite still green (bucket change is additive).

Gates: `pnpm ios:guard`, `pnpm ios:test`, `pnpm ios:catalog`,
`pnpm ios:tokens:check` all pass; module-boundary and import-direction guards
unchanged.

---

## 14. Phased implementation plan

Each phase lands independently behind fixtures, keeps all gates green, and
ends with review evidence (tests + catalog page + snapshots). Dependencies in
parentheses.

**Phase 0 — Backend enablement (no iOS dependency; unblocks Phase 4+ live testing)**
Changes from §7.1–7.3: JPEG staging migration + edge acceptance; scheduled
cleanup with object deletion; copy fixes. Acceptance: web e2e suite green;
a JPEG staged via curl completes to WebP variants; cron job visible in
`cron.job`; new copy strings live.

**Phase 1 — Contracts and fixtures (ChatData) (none)**
`ChatAttachment`, requests/authorization types, `AttachmentRules`, ports,
reducer skeleton, `AttachmentFixtures` + `FixtureAttachmentProviders`,
Codable key-set + constants-parity tests. Also: add the missing attachment
merge vectors to `packages/core` fixtures (shared, §16.3). Acceptance:
`pnpm ios:test` green; contract tests fail if `chatLimits` or wire keys
drift.

**Phase 2 — Staging outbox and image pipeline (1)**
`AttachmentStaging`, `ImagePreparation`, `ByteSignature`. Acceptance: unit
matrix of §13 (orientation, metadata-stripping, caps, sweep) green; staged
files verified backup-excluded and relaunch-persistent.

**Phase 3 — Upload queue engine (1, 2)**
`AttachmentUploadsModel`, `AttachmentStateReducer` vectors,
`SignedUrlByteUploader` + `EdgeFunctionAttachmentCommands` adapters,
URLProtocol test suite, background-task grace, path-monitor retry.
Acceptance: full §13 pipeline tests green including cancellation, 429, 410,
reconnect retry; no main-thread file IO (verified by test).

**Phase 4 — Composer UI (1–3)**
Attach entry + menu, `PhotosPicker` + `.fileImporter` integration, staged
strip + tiles, `MediaSelectionRules` extension, copy from §5.8, icons added
through the token/icon pipeline. Acceptance: snapshot matrix for the strip;
catalog "Attachments (composer)" states; accessibility audit green;
`MessageComposer` still one primary action.

**Phase 5 — Transcript rendering (1)**  *(parallel with 3–4)*
`MessageAttachmentUiModel`, `MessageUiModel.attachments`,
`AttachmentLayout` (ported wrap/clamp rules + fixture parity with web
values), `MessageAttachments`/tiles/cards, `MessageImageLoader` + disk
cache, viewer + Quick Look, `AttachmentAccessibility`. Acceptance: bubble
snapshot matrix; layout fixtures match web-derived expected frames; loader
unit tests (path-keyed cache, refresh-once-on-403); catalog transcript page;
audit green.

**Phase 6 — Screen integration (4, 5)**
`PersonalChatScreen` wiring: uploads model in, `onSend` carries
`attachmentIds`, optimistic bubble reuse of staged thumbnails, dismissal
cancel semantics. Acceptance: composer→bubble flow works end-to-end against
fixtures in the Catalog; keyboard/rotation audit test still green.

**Phase 7 — Live integration (0, 6, and the chat send/hydration slice — see §17.1)**
Live adapters in a Catalog live lab (`LiveCallLab` pattern), hydration wired
to the message fetch path, two-account interop pass (§13). Acceptance:
photos and files sent iOS→web and web→iOS render correctly on both; signed
URL refresh verified after TTL; orphan cleanup verified for abandoned
uploads.

**Phase 8 — Optional fast-follow: camera capture (7; product decision §17.2)**
`UIImagePickerController` wrap, camera menu row, broadened
`NSCameraUsageDescription` copy, simulator-absent guard, device tests.
Acceptance: captured photo flows through the same pipeline; permission
denial path calm and recoverable.

---

## 15. Improvements over the web version (rationale, trade-offs)

1. **Per-file validation instead of all-or-nothing batches** (§3.3). Valid
   files stage; skipped ones get one combined, specific notice. Trade-off:
   slightly more notice-copy logic; strictly better UX.
2. **Truthful processing progress** (§3.4). Queued completes show a slowly
   advancing 0.90–0.99 based on queue position instead of freezing at 0.92.
   Trade-off: still an estimate; but it never *looks* stuck.
3. **Auto-retry on reconnect** (soft-queue pattern, §4.2). Transient
   failures fix themselves; the user only ever sees "Didn't finish" when
   retry genuinely needs them. Trade-off: bounded automatic attempts to
   avoid battery/rate-limit churn.
4. **No orphaned uploads** (§3.1). Screen dismissal server-cancels
   initialized rows; the launch sweep cleans staged files; Phase 0's cron
   closes the server side for every client.
5. **Cross-session media cache** (§6.7). Immutable processed objects make a
   path-keyed disk cache trivially correct; reopening a chat renders
   instantly and offline. Web can't easily match this (signed URLs + browser
   cache), which is fine — it's a native advantage.
6. **Quick Look for documents** (§5.7) instead of open-in-new-tab: inline,
   zoomable, shareable previews for every supported type. Trade-off: a
   download step with visible progress.
7. **Ordered multi-select with numbered badges** (§5.1): users see and
   control send order (web's file input has no ordering UI at all).
8. **Guaranteed-upright images**: EXIF orientation baked at prepare time;
   web relies on browser EXIF honoring plus the server transform.
9. **Client-side magic-byte verification** (§3.12): mis-typed files fail
   fast with honest copy instead of after a full upload.
10. **Explicit Reduce Motion behavior** for media transitions (guidelines
    gap): intentional, testable, not a global CSS clamp side-effect.

Each of 1–4 is also a backport candidate (§16.3); 9 and 10 could follow to
web once proven on iOS.

---

## 16. Cross-platform consistency

### 16.1 Keep consistent (web ↔ iOS, contract-level)

- Limits and formats: 5 per message, 10 MB source, 5 MB prepared image, the
  9 source MIME types, six document types.
- The four-step upload contract, `clientUploadId` idempotency, status
  lifecycle, bind-on-send order semantics, 2 h staging expiry, rate limits.
- Mutual exclusivity: attachments ⊕ GIF ⊕ sticker; one caption per send =
  message body.
- Signed-URL delivery model (15 min TTL) + refresh-on-expiry behavior.
- Visual language: wrap layout + aspect clamp [2/3, 2], blur-up from 64 px
  thumbnails, file-card anatomy and type labels, notice-toned calm copy,
  send gating semantics ("everything settled or nothing sends").
- Server processing: WebP display/thumbnail variants unchanged.

### 16.2 iOS-specific adaptations

- System `PhotosPicker` + `.fileImporter` instead of file input/drag-drop;
  no clipboard-paste equivalent; no drag-and-drop (not idiomatic in a phone
  chat; iPad drop is a possible later addition).
- JPEG staging (server accepts both; web keeps WebP) — consequence of
  platform codec support.
- Signed PUT with own URLSession instead of TUS (no Swift TUS support in
  supabase-swift; payload sizes don't justify a third-party client).
- Disk staging outbox + launch sweep instead of blob URLs +
  `beforeunload`.
- Foreground session + background-task grace instead of a browser tab's
  lifetime.
- Quick Look, share sheet, full-screen swipe viewer, haptic-free calm
  interactions per house motion rules.
- Rendering stack: hand-rolled loader/caches, `LazyVStack` transcript,
  combined VoiceOver bubble elements (house pattern).

### 16.3 Backport candidates (bring to web after iOS validates them)

- Per-file batch validation with a combined skip notice (§15.1).
- Truthful queued progress (§15.2).
- Server-cancel on unmount/navigation (web can call `cancel-upload` with
  `keepalive`/`sendBeacon`) (§15.4).
- Auto-retry on reconnect (§15.3).
- Attachments included in `refresh-messages`/`refresh-conversation`
  responses to remove the N+1 (§7.4) — adopt on both platforms together.
- `packages/core`: attachment merge-vector fixtures (Phase 1 adds them) and,
  longer-term, a single exported validation module so the MIME/size rules
  stop living in four places (§3.11).
- Copy fixes ship server-side in Phase 0 and benefit web immediately (§7.3).
- Per-attachment alt text if §17.6 is pursued — schema + both clients.

---

## 17. Assumptions and unresolved decisions

1. **Chat send slice sequencing (blocking for Phase 7 only).** Options:
   (a) land the personal-chat data layer milestone first (send, fetch,
   realtime), then Phase 7 rides it; (b) fold a *minimal* send slice
   (send-message invoke + message fetch + hydration, no realtime) into this
   feature to demo end-to-end earlier. Recommendation: (a) if the chat
   milestone is next on the roadmap anyway; the plan's seams (`onSend`
   payload, `AttachmentHydrating`) are identical either way. **Needs a
   call.**
2. **Camera in v1?** Recommendation: defer to Phase 8. It is the only part
   requiring a permission prompt and device-only testing, and web has no
   camera path to be consistent with. The messaging research shows camera
   tiles are table stakes in consumer messengers, but a coach↔client
   coaching chat is closer to Slack, which also leads with library/files.
   **Needs a call.**
3. **Share-sheet "Save Image" and `NSPhotoLibraryAddUsageDescription`.**
   Offering the system share sheet from the viewer can surface "Save Image",
   which requires the add-only key. Recommendation: include the key with
   calm copy ("FISH can save photos you choose to your library.") so
   received coaching materials are saveable. Alternative: exclude the
   save activity in v1. **Needs a call.**
4. **Supabase SDK vs raw URLSession for ChatData adapters.** This plan
   chooses raw URLSession (CallData precedent, §6.1). If the chat milestone
   standardizes on supabase-swift (PresenceData precedent) for realtime,
   the attachment adapters can be re-hosted behind the same ports with no
   feature-code changes. Assumption recorded, low risk.
5. **Auth/session source.** `ChatBackendConfiguration.accessToken` assumes
   an app-level session provider exists by Phase 7 (today only lab
   credentials exist). Same assumption the calling feature made.
6. **Alt-text authoring** (guidelines' "Media accessibility in chat" gap):
   not in v1; would need schema (+ column), composer UX, and coach
   workflow. Logged as the product-level follow-up for both platforms.
7. **Assumed stable server behavior**: 15-min signed TTL, 2-h staging
   expiry, rate limits, and the ImageMagick variant parameters are treated
   as contracts; changes there require re-validating the progress model and
   copy.
8. **iPad**: the plan targets iPhone-class layouts (the app's current
   surface); the components are size-class-agnostic, but no iPad-specific
   work (pointer drop, popover pickers) is scoped.
9. **Verification note**: WebP-encode absence was verified on macOS ImageIO
   (22 encodable types, no WebP); iOS shares the framework surface and is
   assumed identical — Phase 2 includes a one-line device assertion to
   confirm before relying on it. (If iOS ever gains WebP encode, §7.1
   remains harmless.)

---

## 18. Sources

Apple documentation and WWDC (primary):
- [S1] https://developer.apple.com/documentation/photokit/photospicker
- [S2] https://developer.apple.com/documentation/photokit/phpickerviewcontroller
- [S3] https://developer.apple.com/documentation/photokit/photospickeritem
- [S4] https://developer.apple.com/documentation/photokit/photospickerselectionbehavior/continuous
- [S5] https://developer.apple.com/documentation/photokit/phpickerconfiguration
- [S6] https://developer.apple.com/documentation/photokit/bringing-photos-picker-to-your-swiftui-app
- [S7] https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app
- [S8] https://developer.apple.com/documentation/photokit/phauthorizationstatus/limited
- [S9] https://developer.apple.com/videos/play/wwdc2023/10107/ (Embed the Photos Picker in your app)
- [S10] https://developer.apple.com/documentation/uikit/uiimagepickercontroller
- [S11] https://developer.apple.com/documentation/avfoundation/capture-setup
- [S12] https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media
- [S13] https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription
- [S14] https://developer.apple.com/documentation/swiftui/view/fileimporter(ispresented:allowedcontenttypes:allowsmultipleselection:oncompletion:)
- [S15] https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller
- [S16] https://developer.apple.com/documentation/foundation/nsitemprovider/loadfilerepresentation(fortypeidentifier:completionhandler:)
- [S17] https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html
- [S18] https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup
- [S19] https://developer.apple.com/documentation/foundation/nsdata/writingoptions/atomic
- [S20] https://developer.apple.com/documentation/imageio/cgimagesourcecreatethumbnailatindex(_:_:_:)
- [S21] https://developer.apple.com/documentation/imageio/kcgimagesourcecreatethumbnailwithtransform
- [S22] https://developer.apple.com/documentation/imageio/kcgimagemetadatashouldexcludegps
- [S23] https://developer.apple.com/library/archive/qa/qa1895/_index.html
- [S24] https://developer.apple.com/documentation/uikit/uigraphicsimagerenderer
- [S25] https://developer.apple.com/documentation/uikit/uiimage/jpegdata(compressionquality:)
- [S26] https://developer.apple.com/documentation/foundation/urlsession/uploadtask(with:fromfile:)
- [S27] https://developer.apple.com/documentation/foundation/downloading-files-in-the-background
- [S28] https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background(withidentifier:)
- [S29] https://developer.apple.com/documentation/foundation/urlsessiontaskdelegate/urlsession(_:task:didsendbodydata:totalbytessent:totalbytesexpectedtosend:)
- [S30] https://developer.apple.com/documentation/foundation/urlsessionconfiguration/waitsforconnectivity
- [S31] https://developer.apple.com/documentation/network/nwpathmonitor
- [S32] https://developer.apple.com/documentation/uikit/uiapplication/beginbackgroundtask(expirationhandler:)
- [S33] https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct
- [S34] https://developer.apple.com/documentation/foundation/fileprotectiontype
- [S35] https://developer.apple.com/documentation/swiftui/asyncimage
- [S36] https://developer.apple.com/documentation/swiftui/view/asyncimageurlsession(_:) (iOS 27 beta)
- [S37] https://developer.apple.com/documentation/swiftui/lazyvstack
- [S38] https://developer.apple.com/documentation/foundation/nscache
- [S39] https://developer.apple.com/documentation/swiftui/view/accessibilityelement(children:)
- [S40] https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion
- [S41] https://developer.apple.com/documentation/foundation/urlprotocol
- [S42] https://developer.apple.com/support/app-store/ (OS adoption, measured 2026-06-07)

Supabase (primary):
- [S43] https://supabase.com/docs/guides/storage/uploads/standard-uploads
- [S44] https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- [S45] https://supabase.com/docs/reference/swift/storage-from-upload
- [S46] https://supabase.com/docs/reference/swift/storage-from-createsigneduploadurl
- [S47] https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- [S48] https://github.com/supabase/supabase-swift (Sources/Storage/StorageFileApi.swift, main)

Engineering references (secondary):
- [S49] https://www.swiftbysundell.com/articles/testing-networking-logic-in-swift/
- [S50] https://swiftsenpai.com/development/reduce-uiimage-memory-footprint/
- [S51] https://github.com/pointfreeco/swift-snapshot-testing
- [S52] https://github.com/woltapp/blurhash · https://github.com/evanw/thumbhash
- [S54] https://www.avanderlee.com/xcode/simulator-camera-test-your-app-without-a-physical-device/

Messenger behavior (official help/blog pages; supplemented by cited teardowns):
- [S56] https://faq.whatsapp.com/453914586839706 · [S57] https://faq.whatsapp.com/164676891531296 · [S58] https://faq.whatsapp.com/759301289012856 · [S59] https://faq.whatsapp.com/5155925751185676 · [S60] https://blog.whatsapp.com/reactions-2gb-file-sharing-512-groups
- [S61] https://telegram.org/faq · [S62] https://telegram.org/blog/albums-saved-messages · [S63] https://telegram.org/blog/downloads-attachments-streaming · [S64] https://telegram.org/blog/700-million-and-premium
- [S65] https://support.signal.org/hc/en-us/articles/360007060212-Send-a-message · [S66] https://support.signal.org/hc/en-us/articles/360007317471-View-and-save-media-or-files
- [S67] https://support.apple.com/guide/iphone/send-and-receive-photos-videos-and-audio-iph3d039f23/15.0/ios/15.0 · [S68] https://support.apple.com/en-us/118433 · [S69] https://support.apple.com/en-us/111799
- [S70] https://slack.com/help/articles/201330736-Add-files-to-Slack · [S71] https://slack.engineering/ways-we-make-the-slack-ios-app-accessible/
- [S72] https://www.macrumors.com/guide/ios-17-messages/ · [S73] https://www.imore.com/how-use-photo-collections-messages-iphone-and-ipad · [S74] https://github.com/mattermost/mattermost/issues/36002

Repo evidence: file references throughout §2–§3 and §6 were verified against
the working tree on 2026-07-17 (branch `main`, commit `f8e128eb`).
