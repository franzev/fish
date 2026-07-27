# Offline attachment outbox plan

Status: proposed
Written: 2026-07-28

## Outcome

A photo, file, or voice message sent while offline goes out on reconnect
instead of failing or being blocked, on both native apps — the same guarantee
text sends already have. Nothing else about chat changes.

The finished result is:

- Tapping send with attachments while offline queues the message durably; it
  sends itself when connectivity returns, surviving an app relaunch.
- A voice message recorded offline uploads and sends itself on reconnect.
- On iOS, picking or capturing media while offline stages it locally instead
  of the composer refusing; uploads start when the network is back.
- A send that has left the composer can no longer be silently lost: after a
  relaunch the queued message still renders as pending and still retries.

## Current baseline

Verified in the source, not assumed. The two platforms fail in different
places, so the work is asymmetric:

| Behavior | Android | iOS |
| --- | --- | --- |
| Durable text outbox, replayed on reconnect | `pending_text_sends` + `flushTextOutbox` ([DefaultChatRepository.kt:536](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt:536)) | `ChatPendingTextSend` in `FileChatDraftStore`, replayed by `reconcilePendingTextSends` ([ConversationStore.swift:458](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift:458)) |
| Attachment upload durable across relaunch | **Yes** — `attachment_drafts` + WorkManager, resumable TUS, cold-start recovery sweep ([AttachmentUploadWorker.kt:93](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/AttachmentUploadWorker.kt:93), [ChatDataModule.kt:543](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt:543)) | **No** — pipeline state lives in `AttachmentUploadsModel`'s in-memory dictionaries; staged bytes are on disk in `ChatOutbox` but nothing maps them back after relaunch ([AttachmentUploadsModel.swift:25](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/AttachmentUploadsModel.swift:25)) |
| Staging attachments while offline | Allowed; upload waits on `NetworkType.CONNECTED` | **Blocked** — `canAdd` requires `isConnected` ([AttachmentUploadsModel.swift:87](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/AttachmentUploadsModel.swift:87)), `attachmentsDisabled` when offline ([PersonalChatScreen.swift:314](../apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift:314)) |
| Attachment **message insert** durable | **No** — outbox diverts only when `plainText` ([DefaultChatRepository.kt:494](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt:494)); the ViewModel refuses attachment sends while disconnected ([ChatViewModel.kt:504](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:504)) | **No** — `handleSendFailure` queues only durable-text requests ([ConversationStore.swift:710](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift:710)) |
| Voice message offline | Uploads and waits, but the auto-send latch bails while disconnected and drops on conversation switch ([ChatViewModel.kt:1430](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:1430)) | Recording works; the upload cannot start, and the auto-send latch is in-memory ([PersonalChatScreen.swift:339](../apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift:339)) |
| Retry a failed send after relaunch | Retry button works from Room state, but is blocked while disconnected ([ChatViewModel.kt:639](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:639)) | Silent no-op — `retry(messageId:)` needs the in-memory `pendingSends` entry ([ConversationStore.swift:393](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift:393)) |

## Design

**No backend changes.** The server already makes replay safe end to end:

- `initialize_chat_attachment_upload` is idempotent on
  `(uploader_id, client_upload_id)` — an identical replay returns the existing
  row instead of a duplicate or a burned rate-limit slot
  ([0050_chat_attachment_hardening.sql:202](../supabase/migrations/0050_chat_attachment_hardening.sql:202)).
- `send-message` is idempotent on `clientRequestId` — a unique
  `(conversation_id, client_request_id)` constraint plus a replay-returns-
  existing-row RPC ([0010_chat.sql:23](../supabase/migrations/0010_chat.sql:23),
  [0030_chat_stickers.sql:175](../supabase/migrations/0030_chat_stickers.sql:175)).

So the durable unit on each platform is exactly what the online path already
uses: **staged bytes + the two client ids**. The outbox never invents a new
pipeline — it replays the existing one.

**Extend the text outbox rather than build an attachment outbox.** On both
platforms the queued record gains attachment *references* (Android: draft ids
in `pending_text_sends`; iOS: `clientUploadId`s in `ChatPendingTextSend`).
The flush gains one gate: a queued send flushes only once every referenced
attachment is `ready` with a server attachment id. Upload durability stays
where it already lives (WorkManager on Android; a persisted manifest on iOS).

**Send while offline means queue, not fail.** The user's tap always succeeds
locally: optimistic bubble with the existing `.pending`/`Pending` status,
composer clears, reply target consumed. The existing offline notice copy
already explains that sending waits for a connection.

## Rules for execution

1. Ship each step independently; each leaves both apps releasable.
2. The server stays authoritative. Client ids are minted once, stored with
   the queued record, and reused verbatim on every replay.
3. An outbox read or write must never fail chat — same `try?`/best-effort
   discipline as drafts and the offline cache.
4. Never log message text, attachment bytes or names, upload/request ids,
   account ids, or conversation ids.
5. Run `pnpm build` before each commit, plus `pnpm ios:test` for iOS steps
   and the module's Gradle unit tests for Android steps.
6. Gif and sticker sends stay non-durable. Do not widen the queue predicate
   beyond body + attachments.

---

## Step 1 — Android: queue attachment sends in the outbox

### Goal

`pending_text_sends` learns to carry attachment references, and the drain
learns to wait for attachment readiness. A queued attachment send survives
process death and flushes once its uploads finish.

### Why it is necessary

This is the whole Android gap. Uploads are already durable; only the final
`send-message` call referencing them is fire-and-forget. Closing it in the
repository first gives the ViewModel (Step 2) something safe to queue into.

### Dependencies and assumptions

- Room schema v10 → v11: add a nullable `attachment_draft_ids` TEXT column
  (ordered, comma-joined draft ids) to `pending_text_sends` in
  [ChatDatabase.kt](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDatabase.kt).
  Existing rows read as null = text-only; no data migration needed. Extend
  `ChatDatabaseMigrationTest`.
- The composite PK `(conversation_id, user_id, client_request_id)` and
  `REPLACE` upsert already make re-queueing idempotent; unchanged.
- Assumes an `attachment_drafts` row for a queued send is not garbage-
  collected while referenced. `AttachmentMaintenanceWorker` GCs expired
  drafts — the queued send must treat a missing/terminally-failed draft as a
  send failure (below), not a crash.

### Lean implementation

- Rename nothing. `queueTextSend` grows an `attachmentDraftIds: List<String>`
  parameter (default empty) and writes the column
  ([DefaultChatRepository.kt:581](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt:581)).
- `sendMessage` stops requiring `plainText` to divert: the offline pre-flight
  ([:494](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt:494))
  and network-failure post-flight
  ([:525](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt:525))
  also queue when the send has attachments and no gif/sticker. The existing
  ready-gate at [:450](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt:450)
  moves *after* the queue decision for the offline path: a queued send may
  reference drafts that are still `waiting_for_network`.
- `flushTextOutbox` gains one check per row: resolve each referenced draft;
  if any is not yet `ready` or lacks a `serverAttachmentId`, stop the drain
  at that row — the same stop-at-first-unflushable behavior the loop already
  has for network failures, so a conversation's messages never reorder. If a
  referenced draft is missing or in a terminal failure state, mark the
  message `Failed` via the existing `markMessageFailed` path and delete the
  outbox row.
- Optimistic row: the queued message already renders through
  `LocalMessageStatus.Pending`; reuse `QueueMessage`
  ([ChatReducer.kt:23](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/state/ChatReducer.kt:23))
  with the staged attachments attached so the bubble shows its media.
- Tests: repository unit tests for queue-with-attachments, drain-waits-for-
  ready, drain-fails-on-terminal-draft, and FIFO preserved.

## Step 2 — Android: let attachment and voice sends queue while offline

### Goal

The user-facing gates come off: tapping send offline with attachments queues
instead of no-opping, and a voice message recorded offline sends itself on
reconnect.

### Why it is necessary

Step 1 is unreachable while
[ChatViewModel.kt:504-507](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:504)
early-returns any non-durable-text send while disconnected, and the voice
latch bails at [:1430](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:1430).

### Dependencies and assumptions

- Depends on Step 1.
- The drain currently runs on realtime `Connected` and conversation open
  ([ChatViewModel.kt:940](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:940), [:950](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:950)).
  A queued attachment send becomes flushable when its *upload* finishes,
  which can happen while already connected — so a third trigger is needed.

### Lean implementation

- Relax the disconnect guard: allow the send when the payload is body +
  attachments (no gif/sticker); it flows into the Step 1 queue path.
- Replace the voice latch's disconnect bail: instead of waiting for `ready` +
  connected before calling `sendMessage()`, call it as soon as the draft is
  committed — the repository now queues it. This also fixes the latch being
  dropped on conversation switch, because the queued row is durable.
- Third drain trigger: the ViewModel already observes attachment-draft
  emissions for the voice latch
  ([ChatViewModel.kt:904](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:904));
  on a draft transitioning to `ready`, call `flushTextOutbox` for that
  conversation. The mutex makes overlapping calls harmless.
- Unblock retry-while-queued confusion: `retryMessage`'s disconnect block
  ([:639](../apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/viewmodels/ChatViewModel.kt:639))
  may now re-queue instead of refusing.
- Tests: ViewModel tests for offline attachment send queues, voice recorded
  offline sends after draft-ready + reconnect, no double-send on overlapping
  triggers (mutex already covers; assert via fake remote call count).

## Step 3 — iOS: make the upload pipeline durable across relaunch

### Goal

Every staged attachment gets a persisted manifest record; on reopening a
conversation, unfinished uploads rehydrate into `AttachmentUploadsModel` and
resume. Staged bytes stop being deleted while still referenced.

### Why it is necessary

iOS has no equivalent of Android's `attachment_drafts` + recovery sweep.
Killing the app loses the composer's uploads even though the bytes are
already on disk in `ChatOutbox` — the association lives only in in-memory
dictionaries. Durable sends (Step 5) are meaningless while the uploads they
reference evaporate.

### Dependencies and assumptions

- None on Steps 1–2; iOS work is independent.
- `ImagePreparation` already writes staged files with a stable sha256
  ([ImagePreparation.swift:38](../apps/ios/FishKit/Sources/ChatData/Staging/ImagePreparation.swift:38));
  preparation happens before any network call, so a manifest record can be
  written at the same moment.
- Replaying `initializeUpload` with the stored `clientUploadId` is safe and
  cheap (verified idempotent above). If the server row has expired or been
  cancelled since (`cancelled`/`upload_expired`-class errors), mint a fresh
  `clientUploadId` and re-run from the staged bytes — bytes are the source
  of truth, ids are disposable.
- `AttachmentStaging`'s protection class
  (`.completeFileProtectionUntilFirstUserAuthentication`) and
  non-account-scoped root stay as they are — the class is deliberately weaker
  so uploads can read in the background. Account scoping lives in the
  manifest, and sign-out deletes manifest-referenced files.

### Lean implementation

- Model `ChatPendingAttachment` in `ChatData/Models`: `conversationId`,
  `clientUploadId`, staged filename (relative to the `ChatOutbox` root),
  `originalName`, `sourceMimeType`, `sha256`, `position`,
  `serverAttachmentId?`, `createdAt`. `Codable`, like everything else in the
  draft store.
- Persist it in `FileChatDraftStore`'s existing single-payload blob
  ([FileChatDraftStore.swift:10](../apps/ios/FishKit/Sources/ChatData/Adapters/FileChatDraftStore.swift:10)) —
  a `pendingAttachments: [ChatPendingAttachment]` field with
  `decodeIfPresent` defaulting to empty, so existing payloads keep decoding.
  Three protocol methods on `ChatDraftProviding` with no-op defaults, matching
  the existing opt-in pattern
  ([ChatDraft.swift:54](../apps/ios/FishKit/Sources/ChatData/Models/ChatDraft.swift:54)).
- `AttachmentUploadsModel` writes the record after `prepare` succeeds,
  updates it when `initializeUpload` returns (store `serverAttachmentId`),
  and removes it when the item is removed by the user. On `init` for a
  conversation, load records, rebuild `StagedAttachment` items from the
  staged files (thumbnails re-derive from the file), and re-enter
  `runPipeline` for anything not `ready`.
- Cleanup discipline: `consumeAfterSend`
  ([AttachmentUploadsModel.swift:207](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/AttachmentUploadsModel.swift:207))
  currently deletes staged files 30 s after a send is *attempted*. Change it
  to remove manifest records and files only for items whose
  `serverAttachmentId` is set (the server holds the bytes from then on —
  same guarantee the current retry-by-id relies on). The launch sweep keeps
  any file referenced by a manifest record.
- Tests: manifest round-trip in `FileChatDraftStore` tests; uploads-model
  test that a relaunched model resumes a half-done item with the same
  `clientUploadId`; sweep-keeps-referenced-files test.

## Step 4 — iOS: allow staging attachments while offline

### Goal

Picking, capturing, and recording work without a connection; uploads start
automatically when connectivity returns.

### Why it is necessary

The subway scenario starts here. With Step 3's durability in place, an
offline-staged attachment is no longer a liability — before it, lifting the
gate would just create losable state.

### Dependencies and assumptions

- Depends on Step 3.
- The connectivity-triggered retry already exists:
  `connectivityChanged` re-runs every failed item whose reason `isTransient`
  ([AttachmentUploadsModel.swift:381](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/AttachmentUploadsModel.swift:381)).
  Assumes an offline `initializeUpload` URL error classifies as transient —
  verify and, if not, classify `URLError` connectivity codes as transient.
- Preparation (downsample, validate, hash, stage) is fully local and already
  network-free.

### Lean implementation

- Drop `isConnected` from `canAdd`
  ([AttachmentUploadsModel.swift:87](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/AttachmentUploadsModel.swift:87));
  keep the count cap.
- Drop the offline composer gate
  ([PersonalChatScreen.swift:314](../apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift:314))
  so the attachment menu and voice control stay enabled; the existing offline
  notice still explains that sending waits.
- Let `runPipeline` treat an offline `initializeUpload` failure as a waiting
  state, not a dead end: existing backoff (max 3 automatic attempts) plus the
  connectivity trigger cover it; raise nothing new. Copy for the tile stays
  in the existing calm voice ("Waiting for a connection." — reuse
  `notice`-style copy, no red).
- Tests: uploads-model test that staging offline produces a staged item with
  a manifest record and no failure surfaced; connectivity flip resumes it.

## Step 5 — iOS: queue attachment sends durably

### Goal

Tapping send with attachments — online or offline, ready or still uploading —
queues a durable pending send that flushes when every referenced attachment is
ready and the connection is up. Voice auto-send rides the same queue. The
relaunch retry no-op disappears.

### Why it is necessary

This is the iOS half of the actual outbox. It also fixes a live defect: the
transcript's "Try sending again" is a silent no-op after relaunch because
`pendingSends` is in-memory
([ConversationStore.swift:393](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift:393)).

### Dependencies and assumptions

- Depends on Steps 3–4.
- `ChatPendingTextSend` is the reducer-adjacent record the replay path
  already consumes; extending it beats a parallel type.
- The composer currently blocks send until all items are `ready`
  (`sendGuidance` at
  [AttachmentUploadsModel.swift:89](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/AttachmentUploadsModel.swift:89)).
  That gate stays for *failed* items but not for *in-flight/waiting* ones.

### Lean implementation

- Extend `ChatPendingTextSend` with
  `attachmentClientUploadIds: [String]` (`decodeIfPresent`, default empty —
  old queued sends keep decoding). Relax its non-empty-body expectation:
  body may be empty when attachment ids are present, mirroring the server
  rule.
- Queue path: `ConversationStore.send` queues (instead of failing) when the
  request carries attachment references and either the connection is down or
  a referenced item is not ready. Reuse the existing `.pending` optimistic
  construction ([ConversationStore.swift:488](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift:488))
  with `optimisticAttachments` so the bubble shows its media.
- Flush gate: `flushPendingTextSends`
  ([ConversationStore.swift:758](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift:758))
  resolves each `clientUploadId` → `serverAttachmentId` through the manifest;
  an unresolved id stops the FIFO loop exactly as a failed text send does
  today. A terminally-failed referenced upload marks the message `.failed`
  (calm copy, retry button re-queues) and removes the outbox record.
- Third flush trigger, mirroring Android: when `AttachmentUploadsModel`
  reports an item `ready`, the screen nudges the store to flush — the same
  observation the voice latch uses today
  ([PersonalChatScreen.swift:279](../apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift:279)).
- Voice: replace the in-memory `pendingVoiceUploadId` latch with an immediate
  queued send referencing the recording's `clientUploadId`.
- Replay: `reconcilePendingTextSends` already redraws queued rows from disk
  on `start()`; it now also rebuilds `pendingSends` entries for attachment
  sends, which is precisely what makes post-relaunch retry work.
- Cleanup: on confirmed send, remove the outbox record, then the manifest
  records and staged files for its attachments (supersedes Step 3's
  `serverAttachmentId`-based cleanup for queued sends).
- Tests: store tests for queue-offline-then-flush-on-reconnect,
  flush-waits-for-ready, terminal-upload-fails-calmly, relaunch-replay
  rebuilds a retryable send, FIFO order preserved across mixed text and
  attachment sends.

## Step 6 — Physical-device pass

### Goal

Airplane-mode walkthrough on real hardware, both platforms: stage + send a
photo and a voice message offline, kill the app, relaunch still offline
(bubbles render pending), reconnect, watch both deliver exactly once.

### Why it is necessary

Simulators lie about connectivity transitions, background task expiry, and
file protection. Every prior plan in this repo has kept this step external;
it stays a release gate, not a development gate.

### Dependencies and assumptions

- Steps 1–5 merged. Requires a real device with a signed build, per the
  standing device sign-off backlog that also covers push and calling.

---

## Deferred until there is a concrete need

- **Background flushing.** The outbox drains in the foreground (plus
  Android's WorkManager uploads). A BGTask/`PendingTextSendWorker` that sends
  with the app closed is real machinery; the foreground guarantee already
  covers the subway scenario.
- **Distinguishing "queued offline" from "sending" in the bubble.** Both
  render as sending today on both platforms. One quiet label is a copy/UX
  decision to make with the coach, not plumbing.
- **Durable gif and sticker sends.** Gif browsing needs a network anyway;
  stickers are rare enough to wait for evidence.
- **Queued edits, deletes, reactions offline.** Different verbs, different
  conflict semantics; nothing here blocks them later.
- **An outbox screen or count.** The transcript's pending bubbles are the
  outbox UI. No new surfaces (product rule: remove choices).
- **Android `NetworkMonitor` as a drain trigger.** Realtime-reconnect plus
  draft-ready triggers cover the flow; wiring a third connectivity edge in
  can wait for a report of a stuck queue.

## Assumptions and tradeoffs

- **Replay over resumption for iOS uploads.** On relaunch iOS re-runs the
  pipeline from staged bytes with the same `clientUploadId` rather than
  persisting TUS offsets like Android. Files are ≤ 25 MB and the server
  dedupes initialization, so re-uploading a partial file is an acceptable
  cost for skipping a resumable-transfer implementation.
- **The outbox stays conversation-scoped and foreground-drained.** A queued
  send flushes when its conversation is open or the realtime socket
  reconnects. This matches the existing text outbox exactly; widening it is
  the deferred background work.
- **Extending `pending_text_sends` / `ChatPendingTextSend` instead of new
  attachment-send stores.** One queue preserves FIFO per conversation across
  mixed text and media, and both platforms' drain/replay code already exists.
  The cost is a slightly misleading name; renaming is churn with no behavior,
  so it stays.
- **Staged bytes now persist longer on iOS.** Media waiting in the outbox
  lives in `ChatOutbox` until the server confirms the message. Bounded by
  the 5-attachment/25 MB caps and existing sweep; protection class unchanged;
  sign-out purges manifest-referenced files.
- **Server attachment expiry is handled by re-initializing, not prevented.**
  A send queued for days may find its server rows expired; the flush then
  fails calmly and the retry re-runs the pipeline from local bytes with fresh
  ids. No lease-refresh machinery.
- **No backend changes** — verified against migrations 0010, 0018, 0030,
  0050: both idempotency keys and the replay-returns-existing-row behavior
  already exist.
