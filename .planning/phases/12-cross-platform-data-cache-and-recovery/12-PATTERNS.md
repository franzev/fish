# Phase 12: Cross-platform data, cache, and recovery - Pattern Map

**Mapped:** 2026-07-23  
**Files analyzed:** 30 new/modified files or file groups  
**Analogs found:** 30 / 30

This map follows the recommended file seams in `12-RESEARCH.md`. Exact new filenames may change during planning, but the tier ownership is locked: portable semantics in `packages/core`, Android provider/Room details in `:data:chat`, Android orchestration in `:feature:chat`, iOS persistence/providers in `ChatData`, pure Swift parity in `ChatCore`, and lifecycle orchestration in `PersonalChat`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/core/src/shared-content/types.ts` | model | transform | same file, Phase 11 contracts | exact |
| `packages/core/src/shared-content/state.ts` | utility/reducer | event-driven | same file, owner/request/tombstone reducer | exact |
| `packages/core/src/shared-content/fixtures/shared-content-vectors.json` | fixture/config | batch | same file, canonical parity corpus | exact |
| `packages/core/src/shared-content/shared-content.test.ts` | test | batch | same file, strict vector replay | exact |
| Android `.../sharedcontent/state/SharedContentState.kt` | model/reducer | event-driven | same file, Kotlin portable parity | exact |
| Android `.../sharedcontent/SharedContentParityTest.kt` | test | batch | same file, strict JSON replay | exact |
| Android `.../data/chat/local/ChatEntities.kt` | model | CRUD | `MessageEntity`, `ReadStateEntity` in same file | exact |
| Android `.../data/chat/local/ChatDao.kt` | model/DAO | CRUD | `reconcileMessages`, `clearAllUserData` | exact |
| Android `.../data/chat/local/ChatDatabase.kt` | config/migration | CRUD | `MIGRATION_2_3`, database v8 registration | exact |
| Android schema `.../schemas/...ChatDatabase/9.json` | generated config | CRUD | committed schema versions 1–8 | exact |
| Android `.../data/chat/ChatRepository.kt` | service contract | request-response | existing chat repository contract | exact |
| Android `.../data/chat/DefaultChatRepository.kt` | service | CRUD + request-response | cached conversation fallback/reconnect/sign-out | exact |
| Android `.../data/chat/NetworkMonitor.kt` | provider | event-driven | existing connectivity callback flow | exact |
| Android `.../remote/SupabaseChatRemoteDataSource.kt` | provider | request-response | existing authenticated chat RPC decoding | exact |
| Android new `.../sharedcontent/*` delivery registry/store | service | file-I/O + request-response | iOS `MessageImageLoader.swift`; Android attachment delivery map | role-match |
| Android new `.../sharedcontent/SharedContentRecoveryCoordinator.kt` or ViewModel logic | store/coordinator | event-driven | `DefaultChatRepository.observeConnectedRealtime` and feature reducers | role-match |
| Android `.../sharedcontent/SharedContentViewModel.kt` | store | event-driven | existing feature ViewModel + `SharedContentState.kt` | role-match |
| Android `ChatDatabaseMigrationTest.kt` | test | CRUD | same file migration validation | exact |
| Android `ChatDaoTest.kt` / `DefaultChatRepositoryTest.kt` | test | CRUD + request-response | same files | exact |
| Android recovery/network/media tests | test | event-driven + file-I/O | `SharedContentParityTest.kt`, repository tests | role-match |
| iOS `ChatCore/SharedContent/SharedContentState.swift` | model/reducer | event-driven | same file, Swift portable parity | exact |
| iOS `TestSupport/Fixtures/SharedContentVectors.swift` | fixture decoder | batch | same file, strict corpus decoder | exact |
| iOS `ChatCoreTests/SharedContentContractTests.swift` | test | batch | same file, canonical replay | exact |
| iOS new `ChatData/Providers/SharedContentProviding.swift` | provider contract | request-response | existing `ChatRealtimeProviding.swift` / attachment provider protocols | role-match |
| iOS new `ChatData/Models/SharedContentCache.xcdatamodeld` | model | CRUD | Android Room cache model; existing ChatData model boundary | data-flow match |
| iOS new `ChatData/Adapters/CoreDataSharedContentCache.swift` | service | CRUD | Android `ChatDao.kt`; `AttachmentStaging.swift` protection | role/data match |
| iOS new `ChatData/Adapters/SupabaseSharedContentRepository.swift` | service/provider | request-response | existing ChatData Supabase adapters | exact |
| iOS new `SharedContentNetworkPolicy.swift` | provider | event-driven | `NetworkAttachmentConnectivity.swift` | exact |
| iOS new `SharedContentDeliveryStore.swift` | service | file-I/O + request-response | `MessageImageLoader.swift`, `AttachmentStaging.swift` | exact |
| iOS new `PersonalChat/ViewModels/SharedContentStore.swift` | store/coordinator | event-driven | ChatCore reducer plus existing observable PersonalChat stores | role-match |
| iOS `PersonalChat/ViewModels/MessageImageLoader.swift` | service | file-I/O + request-response | same file | exact |
| iOS `App/Sources/FishApp.swift` (`FishAppModel`) | application coordinator | event-driven | existing `signOut()` teardown | exact |
| iOS ChatData/PersonalChat cache, recovery, media tests | test | CRUD + event-driven + file-I/O | existing contract, staging, and image-loader tests | role-match |

## Pattern Assignments

### Portable contract and reducer

**Apply to:** `types.ts`, `state.ts`, both native `SharedContentState` files.

**Analog:** `packages/core/src/shared-content/types.ts`

**Allowlisted domain types** (lines 25–55, 128–151):

```typescript
/** Persisted fields that are safe for the pure classifier to inspect. */
export interface SharedContentSourceDescriptor {
  itemId: string;
  conversationId: string;
  sourceMessageId: string;
  // explicit safe fields only
}

export type SharedContentGalleryStatus =
  | "loading" | "content" | "empty" | "incomplete"
  | "stale" | "unavailable" | "terminal-error";
```

Add `SharedContentCachedSnapshot`, cache truth, recovery phase, fetch intent, network policy, and deterministic limits as explicit portable types. Do not serialize `SharedContentState`: lines 144–150 prove it contains pending requests, delivery/temp references, and runtime errors.

**Owner and request acceptance** — `packages/core/src/shared-content/state.ts` lines 41–54 and 123–159:

```typescript
if (event.type === "identityChanged") {
  if (event.identityId === state.identityId &&
      event.conversationId === state.conversationId) return state;
  return { ...createSharedContentState(event.identityId, event.conversationId), status: "loading" };
}
if (!ownsEvent(state, event.identityId, event.conversationId)) return state;

if (
  state.pendingPageRequest === null ||
  state.pendingPageRequest.requestId !== event.requestId ||
  state.pendingPageRequest.replace !== replace ||
  !cursorsEqual(state.pendingPageRequest.requestedCursor, event.requestedCursor)
) return state;
```

Hydration and recovery results must carry the same identity/conversation ownership plus identity generation and cycle identity. Do not create a second merge path that bypasses this gate.

**Tombstone-wins, duplicate-free merge** — same file lines 219–234:

```typescript
const deleted = new Set(deletedSourceMessageIds);
const result = existing.filter((item) => !deleted.has(item.sourceMessageId));
const seen = new Set(result.map((item) => item.itemId));
for (const item of incoming) {
  if (deleted.has(item.sourceMessageId) || seen.has(item.itemId)) continue;
  seen.add(item.itemId);
  result.push(item);
}
```

Preserve accepted cached items during refresh; only accepted authoritative/realtime results may add, replace, or tombstone.

### Portable and native parity fixtures

**Apply to:** JSON vectors, Node test, Android parity test, Swift vector decoder and contract test.

**Android analog:** `apps/android/feature/chat/src/test/kotlin/.../SharedContentParityTest.kt` lines 36–50, 53–82:

```kotlin
private val json = Json {
    classDiscriminator = "type"
    ignoreUnknownKeys = false
}
private val fixture: JsonObject by lazy {
    val resource = checkNotNull(javaClass.classLoader?.getResource("shared-content-vectors.json"))
    json.parseToJsonElement(resource.readText()).jsonObject
}
```

**iOS analog:** `apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift` lines 7–34:

```swift
let vectors = try SharedContentVectors.load()
#expect(vectors.metadata.version == 2)
#expect(vectors.metadata.groups == [ /* exact ordered group names */ ])
#expect(totalCount == vectors.metadata.expectedCaseCount)
```

Increment the corpus version and expected counts. Keep strict unknown-key decoding. Add canonical cases for verified/wrong-owner hydration, stale+incomplete truth, authoritative empty, eviction priority, attempts 0/1/manual reset, batch sizes 49/50/51, data-saving suppression of lookahead, displayed-only persistence, URL non-persistence, and generation purge.

Carry the Phase 11 paging fixture forward with one exact cross-platform invariant: `p_limit = 40` permits at most 41 returned rows indexed 0–40; indexes 0–39 are retained; `nextCursor` comes from the last retained row at index 39; optional index 40 only sets `hasMore = true`; index 41 is never accessed and index 40 never supplies the cursor.

### Android Room entities, DAO, and migration

**Apply to:** `ChatEntities.kt`, `ChatDao.kt`, `ChatDatabase.kt`, schema 9, migration/DAO tests.

**Compound owner scoping** — `ChatEntities.kt` lines 81–103:

```kotlin
@Entity(
    tableName = "read_states",
    primaryKeys = ["conversation_id", "user_id"],
)
data class ReadStateEntity(
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    @ColumnInfo(name = "user_id") val userId: String,
    // ...
)
```

Every shared-content metadata/page/owner row must include verified owner and conversation in its primary key or unique index. Persist no URL, token, delivery reference, runtime error, or full-preview field.

**Transactional reconcile and purge** — `ChatDao.kt` lines 391–425 and 460–478:

```kotlin
@Transaction
suspend fun reconcileMessages(messages: List<MessageEntity>, attachments: List<MessageAttachmentEntity>) {
    val byMessage = attachments.groupBy(MessageAttachmentEntity::messageId)
    messages.forEach { reconcileMessage(it, byMessage[it.id].orEmpty()) }
}

@Transaction
suspend fun clearAllUserData() {
    clearAttachmentDrafts()
    clearMessages()
    clearReadStates()
    clearDrafts()
    clearPendingTextSends()
    clearConversations()
}
```

Use one Room transaction for accepted page rows, retained boundary/cache owner metadata, tombstones, and pruning. Add shared-content tables to both conversation deletion and account-wide clearing.

**Migration registration** — `ChatDatabase.kt` lines 8–23 and 138–158:

```kotlin
@Database(entities = [/* all entities */], version = 8, exportSchema = true)
abstract class ChatDatabase : RoomDatabase()

val MIGRATION_7_8: Migration = object : Migration(7, 8) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("""CREATE TABLE IF NOT EXISTS ...""".trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS ...")
    }
}
```

Bump to 9, register all new entities, define `MIGRATION_8_9`, and commit schema JSON 9.

**Migration proof** — `ChatDatabaseMigrationTest.kt` lines 26–63 and 89–117:

```kotlin
helper.createDatabase(DatabaseName, 2).apply { /* seed prior rows */ close() }
helper.runMigrationsAndValidate(DatabaseName, 3, true, MIGRATION_2_3).use { database ->
    database.query("SELECT count(*) FROM messages ...").use { cursor ->
        cursor.moveToFirst()
        assertEquals(1, cursor.getInt(0))
    }
}
```

The 8→9 test must validate the exported schema, prove unrelated chat rows survive, new cache tables start safely, and no delivery URL column exists.

### Android repository, network policy, delivery, and recovery

**Apply to:** repository contract/implementation, remote adapter, network monitor, new shared-content services, ViewModel/coordinator.

**Verified-owner cache observation** — `DefaultChatRepository.kt` lines 78–95:

```kotlin
authState.flatMapLatest { auth ->
    val userId = (auth as? ChatAuthState.SignedIn)?.userId
    if (userId == null) flowOf(emptyList()) else {
        dao.observeAttachmentDrafts(conversationId, userId).map { rows -> /* domain */ }
    }
}
```

Shared-content hydration must additionally verify that the conversation belongs to the same user. Missing/unresolved/mismatched identity emits no prior cache.

**Connectivity-driven coalescing seam** — `DefaultChatRepository.kt` lines 97–147:

```kotlin
networkMonitor.isOnline().flatMapLatest { online ->
    if (online) observeConnectedRealtime(conversation)
    else flowOf(ChatRealtimeEvent.Disconnected)
}
```

Replace the Boolean only for the shared policy boundary with a snapshot containing usable/validated, metered, and Data Saver state. Gallery-open, meaningful foreground, reconnect, and realtime hints join one injected-clock recovery cycle; exactly attempts 0 and 1 are permitted.

**Calm cached fallback** — same file lines 175–200:

```kotlin
val cached = userId?.let { dao.conversations(it).map { row -> row.toDomain() } }.orEmpty()
return if (cached.isNotEmpty()) ChatResult.Success(/* cached directory */) else remoteResult
```

For shared content, expose provenance and retained-history completeness rather than disguising cache as authoritative. Offline/no-cache is unavailable; empty requires successful authoritative zero rows.

**Identity teardown** — same file lines 155–173 and 698–704:

```kotlin
attachmentUploadScheduler?.cancelUser(signedInUserId)
attachmentImporter?.deleteAll(attachmentRows)
dao.clearAllUserData()
attachmentDeliveries.value = emptyMap()
```

Extend this seam: increment/revoke generation and hide state first; cancel recovery/delivery/decode/temp work; clear URL registry and memory; purge Room; delete owner-scoped thumbnail/temp roots; verify absence; only then bind/hydrate a new owner.

**Network monitor analog** — `NetworkMonitor.kt` lines 23–53:

```kotlin
val callback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) = publishCurrent()
    override fun onLost(network: Network) = publishCurrent()
    override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) =
        publishCurrent()
}
```

Keep `callbackFlow`/`StateFlow`, but publish the richer policy and include validated capability, metering, and restrict-background status. Visible thumbnails remain permitted on usable connectivity; lookahead is suppressed under Data Saver.

### iOS ChatCore parity and ChatData providers

**Apply to:** Swift state, provider protocol, Supabase repository, network policy, recovery store.

Mirror portable names and raw wire values in `ChatCore/SharedContent/SharedContentState.swift`; its reducer lines 497–584 are the direct Swift analog for identity reset and whole-event ownership. Provider protocols must return `ChatCore` domain values and must not expose Supabase/Core Data types to `PersonalChat`.

**Network policy analog** — `NetworkAttachmentConnectivity.swift` lines 4–34:

```swift
public let updates: AsyncStream<Bool>
private let monitor: NWPathMonitor
monitor.pathUpdateHandler = { [weak self] path in
    guard let self else { return }
    let connected = path.status == .satisfied
    self.continuation.yield(connected)
}
```

Change the shared-content adapter output to a Sendable policy snapshot including `path.status`, `isConstrained`, and `isExpensive`. Retain buffering-newest behavior and provide a deterministic fake for tests.

### iOS Core Data and protected file cache

**Apply to:** `SharedContentCache.xcdatamodeld`, `CoreDataSharedContentCache.swift`, `SharedContentDeliveryStore.swift`.

Core Data has no same-platform repository analog yet; use the Android compound-owner/transaction semantics, but copy iOS file safety from `AttachmentStaging.swift`.

**Backup exclusion and protection** — `AttachmentStaging.swift` lines 20–44 and 89–99:

```swift
try fileManager.createDirectory(at: self.root, withIntermediateDirectories: true)
try Self.excludeFromBackup(self.root)
try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
try Self.excludeFromBackup(url)

private func isInsideRoot(_ url: URL) -> Bool {
    url.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path + "/")
}
```

Apply exclusion to the Core Data store directory and thumbnail/temp roots after material operations. Use protected atomic writes, standardized containment checks, opaque owner/conversation/item/version filenames, and owner-scoped deletion. Configure Core Data store file protection and uniqueness over owner + conversation + item.

### iOS delivery and image loading

**Apply to:** `SharedContentDeliveryStore.swift`, modified `MessageImageLoader.swift`, associated tests.

**Decode/in-flight/refresh seam** — `MessageImageLoader.swift` lines 34–79:

```swift
if let cached = memory.object(forKey: decodeKey as NSString) { return cached }
if let task = inFlight[decodeKey] { return try await task.value }
let task = Task<UIImage, any Error> {
    do { data = try await self.fetch(url) }
    catch {
        let refreshed = try await commands.refreshUrls(attachmentIds: [attachmentId])
        // retry once with refreshed delivery
    }
}
```

Retain actor serialization, decode sizing, in-flight deduplication, allowed-host checks, and one expired-URL refresh. Replace `URLSession.shared` with an injected ephemeral/no-cache session for delivery.

**Current anti-pattern to remove** — same file lines 41–45, 71–72:

```swift
let storageKey = storagePath.isEmpty ? url.absoluteString : storagePath
let diskUrl = cacheRoot.appending(path: Self.cacheKey(storageKey))
try? data.write(to: diskUrl, options: .atomic)
```

Never fall back to a signed URL as cache identity and never persist every successful fetch. Fetch intent must distinguish visible thumbnail, lookahead thumbnail, and selected full content; only an explicit displayed confirmation may commit thumbnail bytes to disk.

**Unified memory/disk cleanup seam** — same file lines 81–85:

```swift
public func removeAll() {
    memory.removeAllObjects()
    try? FileManager.default.removeItem(at: cacheRoot)
    try? FileManager.default.createDirectory(at: cacheRoot, withIntermediateDirectories: true)
}
```

Make cleanup owner/generation-aware, cancel in-flight tasks, clear URL leases, verify owner-root absence, recreate protected/excluded roots, and reject old-generation completions.

### iOS recovery store and application identity gate

**Apply to:** new `SharedContentStore.swift`, `FishAppModel` attach/sign-out paths.

Use `@MainActor @Observable` orchestration, injected clock/jitter/network/repository ports, and provider-neutral `ChatCore` events. Preserve cached items while `refreshing`/`retryBackoff`; after attempt 1 fails, expose stale truth and exactly one quiet manual-retry callback. UI copy and components remain Phase 13.

**Application teardown analog** — `apps/ios/App/Sources/FishApp.swift` lines 758–789:

```swift
func signOut() async {
    await stopConversation()
    if let draftStore { try? await draftStore.removeAllDrafts() }
    try? await notificationReplyStore.removeAll()
    // stop live resources
    if let session { await ChatLive.signOut(session) }
    session = nil
}
```

Insert the gallery identity gate before attaching a replacement session: mark identity unresolved and hide old state, revoke generation, stop store/media work, purge Core Data + URL registry + decoded memory + thumbnail/temp files, verify cleanup, then accept the new verified owner. Cleanup failure fails closed for gallery data.

## Shared Patterns

### Authority and ownership

- Supabase/RLS remains authoritative; cache never grants membership or actions.
- Every persisted key and async result carries owner and conversation; async work additionally carries identity generation.
- Keep Phase 11 request ID/cursor/replace gates and tombstone-wins semantics.

### Error and cancellation handling

`DefaultChatRepository.kt` lines 130–146 is the standard: rethrow cancellation, categorize other failures into redacted diagnostics, and keep provider details out of UI. Delivery URLs, tokens, raw paths, bytes, provider codes, and identity-bearing cache paths must never be logged.

### Bounded work

- Metadata: newest protected 40 plus explicitly browsed pages; recommended caps are 400/conversation and 2,000/account.
- Delivery IDs: deduplicate and chunk at 50.
- Thumbnails: visible plus one-screen lookahead; lookahead pauses under Data Saver/Low Data Mode and stays memory-only.
- Recovery: one in-flight cycle, one automatic retry, no third attempt or background loop.

### Truthful presentation contract

Cache source, stale truth, and retained-history completeness are orthogonal. Cached content remains visible during refresh/failure. `empty` follows only an accepted authoritative zero-item response. Phase 12 exports provider-neutral state and retry capability but creates no gallery route or presentation component.

### Test style

Use strict shared-vector replay for semantics, injected clocks/network/jitter for recovery, Room migration/device tests for Android persistence, in-memory Core Data plus filesystem inspection for iOS, and secret-sentinel scans proving URLs/tokens appear nowhere durable or diagnostic.

## No Analog Found

No file lacks a usable pattern. The only new technology is iOS Core Data persistence; its transaction/schema mechanics come from the system framework guidance in `12-RESEARCH.md`, while repository boundaries, compound ownership, purge behavior, backup exclusion, and tests all have strong local analogs.

## Metadata

**Analog search scope:** `packages/core/src/shared-content`, `apps/android/data/chat`, `apps/android/feature/chat`, `apps/ios/FishKit/Sources/{ChatCore,ChatData,PersonalChat}`, `apps/ios/App`, corresponding native tests  
**Strong analogs read:** 15 source/test files  
**Pattern extraction date:** 2026-07-23  
**Scope exclusions:** no Phase 13 gallery route/components; no Phase 14 preview/export/source/deletion; no web changes; no new package
