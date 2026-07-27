# iOS offline chat cache plan

Status: Steps 1-2 implemented and merged; Step 3 (physical-device pass)
remains external
Written: 2026-07-27

## Outcome

An iOS cold launch without a network shows the member's conversations and the
last transcript they read, instead of a failed inbox and an unavailable
conversation. Nothing else about chat changes.

The finished result is:

- The conversation list renders from a local cache before the first network
  call and survives a launch with no connectivity.
- Opening a cached conversation shows its most recent messages, with the
  existing offline notice explaining that sending waits for a connection.
- Text typed offline is already durable today; it now also stays **visible** in
  the transcript across a relaunch, and still sends itself on reconnect.

This closes the last read-side parity gap with Android, whose Room database
already caches conversations, messages, attachments, and read state
([ChatDatabase.kt:9](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDatabase.kt:9)).

## Current baseline

Verified in the source, not assumed:

| Behavior | Android | iOS |
| --- | --- | --- |
| Durable text outbox across relaunch | `PendingTextSendEntity` | **Already present** — `ChatPendingTextSend` in `FileChatDraftStore` |
| Composer drafts across relaunch | `DraftEntity` | Already present — `FileChatDraftStore` |
| Conversation list cached | `ConversationEntity`, remote-then-cache fallback ([DefaultChatRepository.kt:211](../apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt:211)) | **Missing** |
| Transcript cached | `MessageEntity`, `ReadStateEntity` | **Missing** |

The two iOS failure points are exact and small:

- [ConversationDirectoryStore.swift:78](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationDirectoryStore.swift:78) —
  `catch { phase = conversations.isEmpty ? .failed : .ready }`. The fallback to
  `.ready` is already correct; there is simply never anything in
  `conversations` on a cold launch.
- [ConversationStore.swift:158](../apps/ios/FishKit/Sources/PersonalChat/ViewModels/ConversationStore.swift:158) —
  `catch { phase = .unavailable }`. The newest window is fetched fresh every
  time and never written down.

There is a third, quieter consequence. `reconcilePendingTextSends(with:)` runs
only inside the success path of `start()`, so an offline launch does not just
lose the transcript — it also fails to redraw the pending messages that are
sitting safely on disk. Fixing the read cache fixes this for free.

## Design

Persist the two payloads the app already hydrates from, in the format it
already hydrates them in.

`ChatMessageState`, `ChatReadState`, and `ChatMessageCursor` are **already
`Codable`** ([ChatState.swift:146](../apps/ios/FishKit/Sources/ChatCore/Models/ChatState.swift:146)),
and `ChatEvent.hydrateWindow` takes exactly those types. So the transcript
cache stores the reducer's own input and replays it through the existing
`reduce(.hydrateWindow(...))` — no mapping layer, no new domain model, no
translation to maintain in two directions.

Storage is JSON files written atomically, copying `FileChatDraftStore`
verbatim in shape: account-scoped path, `Data.write(options: [.atomic])`,
`FileProtectionType.completeUnlessOpen`. Core Data is deliberately not used
here; `CoreDataSharedContentCache` earns its complexity by paging a gallery of
thousands of items, whereas this cache is one small directory blob plus at most
40 messages per conversation.

Layout, one directory per account so sign-out is a single `removeItem`:

```
FISH/cache-<accountKey>/directory.json
FISH/cache-<accountKey>/transcript-<conversationKey>.json
```

`accountKey`/`conversationKey` reuse the existing SHA-256 helper from
`FileChatDraftStore` so no identifier appears in a filename.

## Rules for execution

1. Ship Step 1 and Step 2 independently; each leaves the app releasable.
2. The server stays authoritative. The cache is presentation continuity, never
   a source of truth for unread counts, read state, or mute.
3. A cache read or write must never fail chat. Every access is `try?`, exactly
   as draft persistence already is.
4. Never log message text, bodies, attachment URLs, account IDs, or
   conversation IDs.
5. Run `pnpm build` and `pnpm ios:test` before each implementation commit.

---

## Step 1 — Cache the conversation list

### Goal

`ConversationDirectoryStore` seeds itself from disk before its first network
call, and writes the list back after each successful refresh. An offline cold
launch shows the member's conversations instead of the failed state.

### Why it is necessary

This is the step that unblocks everything else. `FishAppModel.openConversation`
refuses to open anything that is not already in `directory.conversations`
([FishAppModel.swift:714](../apps/ios/App/Sources/FishAppModel.swift:714)), and
`attach` routes on `directory.route`. With an empty directory the app cannot
reach a conversation at all, so a transcript cache alone would be unreachable.

It is also the cheapest possible change: the existing failure branch already
degrades to `.ready` when `conversations` is non-empty. Nearly all the work is
putting something in that array.

### Dependencies and assumptions

- Add `Codable` to `ChatConversationPreview` and `ConversationMute`. Both are
  plain value types; the conformance is synthesized. Note that synthesized
  decoding bypasses the clamping `init`, which is fine because `unreadCount`
  was clamped before it was encoded.
- Cached previews go stale. Unread counts and last-message text may be wrong
  until the refresh lands, which is a sub-second window when online.
- `hasDraft` is recomputed on read from the draft store rather than trusted
  from the cache, so it cannot drift from the actual composer state.

### Lean implementation

- Add `ChatDirectoryCaching` to `ChatData/Providers` with three methods:
  `conversations()`, `save(_:)`, `removeAll()`.
- Add `FileChatCacheStore` in `ChatData/Adapters`, modelled directly on
  `FileChatDraftStore` (actor, lazy in-memory payload, atomic write, file
  protection, SHA-256 key). It owns the account cache directory.
- In `ConversationDirectoryStore`:
  - accept an optional `cache: (any ChatDirectoryCaching)?`, matching how
    `drafts` is already optional;
  - extract the existing `hasDraft` decoration into one private
    `decorated(_ previews:)` helper — it is currently inline in `refresh()` and
    is now needed by two callers;
  - in `start()`, before `refresh()`, load the cache; if non-empty, assign
    `conversations = await decorated(cached)` and set `phase = .ready`;
  - in `refresh()`, after a successful load, `try? await cache?.save(loaded)`;
  - in the `catch`, when `conversations` is non-empty, replace the current
    notice with cache-appropriate copy.
- Copy change in that `catch`: `"Conversations aren't available yet. Try
  again."` is the right sentence when there is nothing on screen, but it reads
  as a failure when the list is right there. Use `"Showing your saved
  conversations. They'll update when you're back online."` for the cached case
  and keep the existing sentence for the empty case.
- Wire it in `FishAppModel.attach` beside `draftStore`, and purge in
  `signOut()` next to the existing `removeAllDrafts()` call
  ([FishAppModel.swift:670](../apps/ios/App/Sources/FishAppModel.swift:670)).

### Working-state checkpoint

- Launch online, force-quit, enable airplane mode, launch: the conversation
  list is present and a calm notice explains it is saved.
- Tapping a conversation still opens it (it will show the loading/unavailable
  transcript until Step 2 — that is the expected intermediate state).
- Sign-out removes the cache directory; signing in as another account shows
  nothing from the previous one.
- A first-ever launch offline still shows the existing `.failed` state.

### Verification

- `ConversationDirectoryStoreTests`: cache seeds before refresh; successful
  refresh writes; failed refresh with cache stays `.ready` with the saved-copy
  notice; failed refresh without cache stays `.failed` with the original
  notice; `hasDraft` is recomputed rather than restored.
- `FileChatCacheStore` tests: round-trip, corrupt-file tolerance, account
  isolation, `removeAll`.
- Run `pnpm ios:test`, `pnpm ios:guard`, `pnpm ios:app:build`, `pnpm build`.

---

## Step 2 — Cache the newest transcript window

### Goal

`ConversationStore.start()` hydrates from a cached window when the network
window is unavailable, reaching `.ready` with saved messages and a
`.disconnected` realtime status instead of `.unavailable`.

### Why it is necessary

This is the actual thing the member wants: opening the app on a train and
reading what their coach said. It also restores the pending-send bubbles that
are already durable but currently invisible after an offline relaunch.

### Dependencies and assumptions

- The cache stores the `hydrateWindow` payload — `[ChatMessageState]`,
  `[ChatReadState]`, `hasMoreOlder`, `oldestCursor` — all already `Codable`.
- Only the newest window (40 messages) is cached. Paging older messages
  offline is out of scope; `hasMoreOlder` load failures already degrade calmly.
- Attachment, GIF, and sticker media are **not** cached. `ChatStateAttachment`
  carries signed URLs that expire, so cached image tiles render as the existing
  unavailable-media treatment offline. Text is the point of this step.
- `mute` and `callActivities` already fall back with `try?` and need no change.
- Subscribing to realtime while offline is safe: `SupabaseChatRealtime` yields
  `.connecting` and drives `.reconnected`
  ([SupabaseChatRealtime.swift:94](../apps/ios/FishKit/Sources/ChatData/Adapters/SupabaseChatRealtime.swift:94)),
  which is what triggers `flushPendingTextSends()`.

### Lean implementation

- Extend the cache protocol with `window(conversationId:)` and
  `saveWindow(_:conversationId:)` over a small `Codable` struct mirroring
  `ChatNewestWindow` in core-state terms.
- In `ConversationStore.start()`:
  - after restoring the draft, read the cached window; if present,
    `reduce(.hydrateWindow(...))`, `await reconcilePendingTextSends(with:)`
    against the cached messages, and set `phase = .ready`;
  - keep the network fetch exactly as it is; on success it re-hydrates,
    reconciles again, and writes the fresh window to the cache;
  - in the `catch`, set `.unavailable` **only if** nothing was hydrated from
    cache; otherwise leave `.ready` and set the realtime status to
    `.disconnected`;
  - call `subscribe()` on both paths so a reconnect backfills and flushes the
    outbox.
- `reconcilePendingTextSends` needs `[ChatMessage]` but the cache holds
  `[ChatMessageState]`; it only reads `clientRequestId`, so give it a
  `[String]` of confirmed request IDs instead of the full messages. That is a
  smaller signature than it has today and removes the need to reverse-map
  state back into domain models.

### Working-state checkpoint

- Offline cold launch → open a previously read conversation → the last
  messages are there, and `ChatConnectionNotice` shows the existing
  "You're offline / You can keep writing" copy unchanged.
- Text typed offline appears as pending, survives a force-quit, and sends
  itself when connectivity returns — exactly once.
- Reconnecting backfills the gap and the transcript converges on the server.
- A conversation never opened before still shows `.unavailable` offline.
- Attachments in a cached transcript show the existing unavailable-media state,
  not a crash or an empty bubble.

### Verification

- `ConversationStoreTests`: cache hydrate then network success (network wins);
  cache hydrate then network failure (stays `.ready`, `.disconnected`); no
  cache and network failure (`.unavailable`); pending sends visible from a
  cache-only start; successful start writes the window; duplicate send
  suppression after a cached reconcile.
- `pnpm ios:chat-vectors:check` to confirm no reducer contract drift.
- Run `pnpm ios:test`, `pnpm ios:catalog`, `pnpm ios:guard`,
  `pnpm ios:app:build`, `pnpm build`.

---

## Step 3 — Device pass

### Goal

Confirm on a physical iPhone what the simulator cannot: real cold start, real
airplane mode, real reconnection.

### Why it is necessary

Process termination, file protection under a locked device, and network
transition behavior are not honestly reproducible in unit tests.

### Execution matrix

1. Online launch → force-quit → airplane mode → launch → read a conversation.
2. Type two messages offline → force-quit → relaunch → both still pending.
3. Disable airplane mode → both send exactly once, in order, and the coach
   receives two messages, not four.
4. Launch offline with the device locked immediately after, then unlock —
   confirm no crash from file protection.
5. Sign out → confirm the cache directory is gone → sign in as a different
   account → confirm nothing from the previous account appears.
6. Confirm no message text, body, or conversation ID appears in device logs.

### Completion criteria

- Every row passes or is recorded as a named blocker.
- `pnpm build`, `pnpm ios:test`, and `pnpm ios:app:build` pass at the commit.

---

## Notes from implementation

Two things surfaced while building Steps 1-2 that were not anticipated when
this plan was written:

- **`ConversationDirectoryStore.refresh()` was silently resetting every
  conversation's quiet state.** It reconstructed each `ChatConversationPreview`
  without forwarding the `mute` field the server sent, so
  `ConversationListScreen`'s quiet marker could never show as quiet after the
  first refresh. Found while extracting the decoration logic into a shared
  helper for the cache-seed path; fixed in the same change with a dedicated
  regression test, since the helper being touched was the exact site of the
  bug.
- **The transcript cache was built and fully tested but not reachable from the
  running app.** `ConversationStore` gained the `cache` parameter and its
  `start()` behavior, but `FishAppModel.openConversation` — the one place a
  real conversation gets opened — was never updated to pass it in. Every
  `ConversationStore`-level test stayed green because the test harness
  supplies its own fake cache directly; none of them could catch a wiring gap
  one layer up. Caught by checking every production call site of
  `ConversationStore` after implementation, not just the one the plan named.
  A pre-existing Catalog host (`LiveAttachmentLab`) constructs its own
  `ConversationStore` against a live dev backend and deliberately omits both
  `drafts` and `cache`, since it has no local-continuity story to begin with;
  that one was left unchanged.

---

## Deferred until there is a concrete need

- **Caching older pages.** Only the newest 40 messages are stored. Scrolling
  back offline is a different problem (cursor continuity, eviction) and there
  is no evidence anyone does it.
- **Cache eviction.** Per-conversation files are small and bounded at 40
  messages each. Revisit only if a coach with many clients shows real disk use.
- **Caching attachment or GIF media.** Signed URLs expire and bytes are large.
  The existing unavailable-media treatment is honest.
- **An offline attachment outbox.** Only text sends are durable today, on both
  platforms. Queueing uploads means durable staged bytes and a retry policy —
  a genuinely bigger feature, not part of a read cache.
- **Caching search results, shared-content beyond its existing cache, or call
  activity.** All degrade acceptably already.
- **Android changes.** Android's cache is ahead of iOS here; this plan does not
  touch it.

## Assumptions and tradeoffs

- **The plan targets the read side only, because the write side already
  works.** An earlier reading of this gap assumed iOS had no durable outbox.
  It does — `ChatPendingTextSend` — and the scope here is smaller as a result.
- **Files over Core Data.** A JSON blob per conversation is far less machinery
  than a managed object model and migrations, and this payload is small and
  disposable. The cost is that a whole file is read and written at once; at 40
  messages that is not worth optimizing until measured.
- **Caching reducer state, not domain models.** Storing `ChatMessageState`
  avoids adding `Codable` to `ChatMessage`, `ChatGif`, and `ChatAttachment`,
  and means the cache cannot drift from what the reducer accepts. The tradeoff
  is that a future reducer-state change becomes a cache-format change; a
  corrupt or undecodable file is treated as a cache miss, so that failure mode
  is a silent refetch rather than a crash.
- **The cache is best effort and never authoritative.** A stale unread count
  for a second is acceptable; a wrong read state written to the server is not,
  so nothing here writes to the server.
- **Message text now lives on disk.** It is protected exactly as drafts already
  are (`completeUnlessOpen`, account-scoped, purged on sign-out). This is a
  real widening of at-rest data, accepted because drafts already established
  the precedent and the treatment.
- **Two small steps rather than one.** Step 1 alone is shippable and is the
  prerequisite for Step 2 being reachable at all.
