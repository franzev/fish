# Phase 11: Shared-content contract and privacy boundary - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 20 new/modified files
**Analogs found:** 20 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/0061_shared_content_contract.sql` | migration | request-response + batch | `supabase/migrations/0050_chat_attachment_hardening.sql` | exact |
| `supabase/functions/_shared/link-preview.ts` | service | event-driven | same file, enqueue/enrichment split | exact |
| `supabase/functions/chat-image-command/index.ts` | service | batch + file-I/O | same file, `cleanupExpired` | exact |
| `packages/supabase/src/database.generated.ts` | model | CRUD + request-response | same generated file | exact |
| `packages/supabase/src/database.types.ts` | model/barrel | transform | same file's table aliases | exact |
| `packages/core/src/shared-content/types.ts` | model | transform | `packages/core/src/chat-state/types.ts` | exact |
| `packages/core/src/shared-content/classification.ts` | utility | transform | `packages/core/src/chat-state/selectors.ts` | role-match |
| `packages/core/src/shared-content/ordering.ts` | utility | transform | `packages/core/src/chat-state/selectors.ts` | exact |
| `packages/core/src/shared-content/state.ts` | store | event-driven | `packages/core/src/chat-state/reducer.ts` | exact |
| `packages/core/src/shared-content/index.ts` | config/barrel | transform | `packages/core/src/chat-state/index.ts` | exact |
| `packages/core/src/shared-content/shared-content.test.ts` | test | batch | `packages/core/src/chat-state/chat-state.test.ts` (if retained) and native parity tests | role-match |
| `packages/core/src/shared-content/fixtures/shared-content-vectors.json` | test fixture | batch | `packages/core/src/chat-state/fixtures/chat-state-vectors.json` | exact |
| `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt` | model/store | event-driven | `.../chat/state/ChatState.kt` | exact |
| `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt` | test | batch | `.../chat/state/ChatStateParityTest.kt` | exact |
| `apps/android/feature/chat/src/test/resources/shared-content-vectors.json` | test fixture | batch | existing `chat-state-vectors.json` Android resource | exact |
| `apps/ios/FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift` | model/store | event-driven | `apps/ios/FishKit/Sources/ChatCore/Models/ChatState.swift` | exact |
| `apps/ios/FishKit/Sources/TestSupport/Fixtures/SharedContentVectors.swift` | test utility | file-I/O + transform | `.../Fixtures/ChatStateVectors.swift` | exact |
| `apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift` | test | batch | `.../ChatStateVectorTests.swift` | exact |
| `scripts/sync-ios-chat-vectors.mjs` | utility | file-I/O | same file's fixture-copy table | exact |
| `scripts/verify-shared-content.ts` and root `package.json` script | test/config | request-response + batch | `scripts/verify-chat-attachments.ts` and existing verify scripts | exact |

The migration number must be rechecked immediately before implementation. The names for the new Kotlin and Swift pure-contract files are planner-level concrete recommendations because RESEARCH.md specifies their directories but not every leaf filename.

## Pattern Assignments

### `supabase/migrations/0061_shared_content_contract.sql` (migration, request-response + batch)

**Analog:** `supabase/migrations/0050_chat_attachment_hardening.sql`

Use this one migration for the normalized listing/category/context RPCs, link-policy hardening/backfill, deletion scheduling columns, delete-command extension, and claim/finish functions. Keep listing RPCs `SECURITY INVOKER`; reserve `SECURITY DEFINER` only for sender-authorized commands and service-role cleanup functions.

**Durable claim pattern** (`0050_chat_attachment_hardening.sql`, lines 356-406):

```sql
create or replace function public.claim_chat_attachment_cleanup(
  p_claim_token uuid,
  p_limit integer default 100
)
returns setof public.message_attachments
language plpgsql
security definer
volatile
set search_path = ''
as $$
begin
  if p_claim_token is null then raise exception 'claim token is required'; end if;
  return query
  with candidates as (
    select attachment.id
    from public.message_attachments attachment
    where ...
    order by attachment.expires_at, attachment.created_at
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  )
  update public.message_attachments attachment
  set cleanup_claimed_at = now(), cleanup_token = p_claim_token
  from candidates
  where attachment.id = candidates.id
  returning attachment.*;
end;
$$;

revoke all on function public.claim_chat_attachment_cleanup(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_chat_attachment_cleanup(uuid, integer) to service_role;
```

**Idempotent finish pattern** (`0050_chat_attachment_hardening.sql`, lines 408-438):

```sql
with removed as (
  delete from public.message_attachments
  where cleanup_token = p_claim_token
    and id = any(coalesce(p_deleted_ids, '{}'::uuid[]))
  returning id
) select count(*) into v_deleted from removed;

update public.message_attachments
set cleanup_token = null, cleanup_claimed_at = null
where cleanup_token = p_claim_token;
```

**RLS policy shape to harden** (`0058_chat_link_previews.sql`, lines 39-50):

```sql
create policy "members read message link previews"
  on public.message_link_previews
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages message
      where message.id = message_link_previews.message_id
        and private.is_conversation_member(message.conversation_id)
        -- Phase 11 adds: and message.deleted_at is null
    )
  );
```

For public listing functions copy the empty-search-path, fully-qualified-object, revoke/grant discipline, but use `stable security invoker`. Validate category, limit, and all-or-none cursor fields before the static `UNION ALL`; fetch `p_limit + 1`, return at most 40, and derive the cursor from the last retained row.

### `supabase/functions/_shared/link-preview.ts` (service, event-driven)

**Analog:** the existing enqueue then enrich flow in the same file.

**Canonical safe-link seam** (lines 81-98):

```typescript
export async function enqueueLinkPreviewJob(
  admin: SupabaseClient,
  messageId: string,
  body: string,
): Promise<boolean> {
  const url = firstPublicHttpUrl(body);
  if (!url) return false;
  const { error } = await admin.from("chat_link_preview_jobs").upsert({
    message_id: messageId,
    url,
    state: "pending",
    attempt_count: 0,
    next_attempt_at: new Date().toISOString(),
  }, { onConflict: "message_id" });
  return !error;
}
```

In this same validated branch, upsert the minimal `message_link_previews` identity (`message_id`, `url`, parsed `hostname`, nullable metadata). Preserve the later metadata upsert pattern at lines 117-127. Do not parse bodies in the gallery RPC and do not add another send pipeline.

### `supabase/functions/chat-image-command/index.ts` (service, batch + file-I/O)

**Analog:** `cleanupExpired` in the same file.

**Authentication and calm error pattern** (lines 248-253):

```typescript
const expectedSecret = Deno.env.get("CHAT_ATTACHMENT_CLEANUP_SECRET")?.trim() ?? "";
const providedSecret = request.headers.get("x-cleanup-secret")?.trim() ?? "";
if (expectedSecret.length < 32 || !secureEquals(expectedSecret, providedSecret)) {
  return calmError("not_authorized", "That cleanup request is not available.", 401);
}
```

**Claim/remove/finish pattern** (lines 255-324):

```typescript
const claimToken = crypto.randomUUID();
const claimedResult = await admin.rpc("claim_chat_attachment_cleanup", {
  p_claim_token: claimToken,
  p_limit: 100,
});
for (const attachment of claimed) {
  const paths = [...new Set([
    attachment.staging_path,
    attachment.display_path,
    attachment.thumbnail_path,
  ].filter((path): path is string => Boolean(path)))];
  const removed = paths.length > 0
    ? await admin.storage.from(bucket).remove(paths)
    : { error: null };
  if (!removed.error) deletedIds.push(attachment.id);
}
await admin.rpc("finish_chat_attachment_cleanup", {
  p_claim_token: claimToken,
  p_deleted_ids: deletedIds,
});
```

Add a third, independently claimed deleted-bound-attachment pass. On claim failure, release successful sibling claims as the current function does. Log only stable codes, never URLs, Storage paths, or tokens.

### `packages/supabase/src/database.generated.ts` and `database.types.ts` (models)

**Analog:** generated schema plus intentional aliases.

Regenerate `database.generated.ts` from a database migrated through Phase 11; do not hand-edit it. Then expose intentional aliases in `database.types.ts` following lines 11-24:

```typescript
export type MessageAttachmentRow =
  Database["public"]["Tables"]["message_attachments"]["Row"];
export type MessageGifRow = Database["public"]["Tables"]["message_gifs"]["Row"];
```

Add the link-preview row and any useful RPC return alias only when it is an intentional package surface. Preserve `export type Database = GeneratedDatabase` (lines 6-9) as the canonical schema type.

### `packages/core/src/shared-content/*` (model, utilities, store, barrel, tests, fixture)

**Analogs:** `packages/core/src/chat-state/types.ts`, `reducer.ts`, `selectors.ts`, and `index.ts`.

**Contract type pattern** (`chat-state/types.ts`, lines 70-100, 102-206):

```typescript
export interface ChatMessageCursor {
  createdAt: string;
  id: string;
}

export interface ChatState {
  conversations: Record<ChatConversationId, ChatConversationState>;
}

export type ChatEvent =
  | { type: "hydrateConversation"; conversationId: string; messages: ChatMessageState[]; ... }
  | { type: "mergeRemoteMessage"; message: ChatMessageState; ... };
```

Mirror this with JSON-friendly string unions and plain interfaces for item/category/kind, the complete four-field cursor, pagination state, deleted source IDs, and discriminated events. Keep the seven kinds and four categories closed; capability fields are explicit booleans.

**Pure reducer pattern** (`chat-state/reducer.ts`, lines 36-56 and 142-159):

```typescript
export function applyChatEvents(state: ChatState, events: ChatEvent[]): ChatState {
  return events.reduce((next, event) => reduceChatState(next, event), state);
}

export function reduceChatState(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "hydrateConversation": {
      return setConversation(state, { ... });
    }
    case "deleteRequested": {
      return updateConversation(state, event.conversationId, (conversation) => ({ ... }));
    }
  }
}
```

The Phase-11 reducer must make source tombstones win over stale/repeated pages, remove every sibling by `sourceMessageId`, deduplicate by `itemId`, retain server order, and purge all identity-bound state before a new identity is exposed.

**Complete barrel pattern** (`chat-state/index.ts`, lines 1-3):

```typescript
export * from "./types";
export * from "./selectors";
export * from "./reducer";
```

Use `export *` for `types`, `classification`, `ordering`, and `state`.

The JSON corpus is the canonical source for classification, ordering, pagination, permission/capability, gallery-state, identity-purge, and deletion-fan-out vectors. The TS test should load and replay that same file; avoid separately authored language fixtures.

### Android shared-content contract and parity files

**Analogs:** `ChatState.kt` and `ChatStateParityTest.kt`.

**Serializable contract pattern** (`ChatState.kt`, lines 1-18 and 83-107):

```kotlin
@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

@Serializable
enum class OutgoingMessageStatus {
    @SerialName("sent") Sent,
    @SerialName("delivered") Delivered,
    @SerialName("read") Read,
}

@Serializable
@JsonClassDiscriminator("type")
sealed interface ChatEvent {
    @Serializable
    @SerialName("hydrateConversation")
    data class HydrateConversation(...) : ChatEvent
}
```

Use `@Serializable`, matching wire names via `@SerialName`, immutable data classes/lists, and the JSON `type` discriminator. Preserve server order; do not reproduce PostgreSQL collation in Kotlin.

**Parity replay pattern** (`ChatStateParityTest.kt`, lines 15-35 and 126-133):

```kotlin
private val json = Json {
    ignoreUnknownKeys = true
    classDiscriminator = "type"
}

val resource = checkNotNull(javaClass.classLoader?.getResource("chat-state-vectors.json"))
val vectors = json.decodeFromString<List<ChatStateVector>>(resource.readText())
vectors.forEach { vector ->
    val actual = applyChatEvents(vector.initialState, vector.events)
    vector.expectedState?.let { expected -> assertEquals(vector.name, expected, actual) }
}
```

Copy the canonical JSON into Android test resources through the existing project resource convention and assert the expected fixed case count so fixture drift is visible.

### iOS shared-content contract and parity files

**Analogs:** `ChatState.swift`, `ChatStateVectors.swift`, and `ChatStateVectorTests.swift`.

**Codable value model pattern** (`ChatState.swift`, lines 81-101 and 103-143):

```swift
public struct ChatStateLinkPreview: Codable, Sendable, Equatable {
    public var url: String
    public var hostname: String
    public var title: String?
    public var description: String?
    public var siteName: String?
}
```

Use `Codable, Sendable, Equatable` value types, raw-string enums matching the JSON contract, and pure reducer functions. Do not sort decoded pages locally.

**Fixture loader pattern** (`ChatStateVectors.swift`, lines 68-85):

```swift
public enum ChatStateVectors {
    public static func load() throws -> [ChatStateVector] {
        try JSONDecoder().decode([ChatStateVector].self, from: rawJSON("chat-state-vectors"))
    }

    public static func rawJSON(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try Data(contentsOf: url)
    }
}
```

**Swift Testing replay pattern** (`ChatStateVectorTests.swift`, lines 6-17):

```swift
struct ChatStateVectorTests {
    @Test func sharedReducerAndSelectorVectorsReplay() throws {
        let vectors = try ChatStateVectors.load()
        #expect(vectors.count == 27)
        for vector in vectors {
            let actual = ChatStateReducer.apply(vector.events, to: vector.initialState)
            if let expected = vector.expectedState {
                #expect(actual == expected, Comment(rawValue: vector.name))
            }
        }
    }
}
```

### `scripts/sync-ios-chat-vectors.mjs` (utility, file-I/O)

**Analog:** the existing sync/check table (lines 7-32).

```javascript
const entries = [
  ["packages/core/src/chat-state/fixtures/chat-state-vectors.json", "chat-state-vectors.json"],
];

if (process.argv.includes("--check")) {
  const stale = entries.filter(([source, copy]) => {
    const target = join(destination, copy);
    return !existsSync(target)
      || !readFileSync(join(root, source)).equals(readFileSync(target));
  });
} else {
  for (const [source, copy] of entries) {
    cpSync(join(root, source), join(destination, copy));
  }
}
```

Append the shared-content fixture to `entries`; keep byte-for-byte drift checking rather than generating a separate Swift corpus.

### `scripts/verify-shared-content.ts` and root `package.json` (test/config, request-response + batch)

**Analog:** `scripts/verify-chat-attachments.ts`.

**Adversarial report pattern** (lines 301-310):

```typescript
const claimed = await admin.rpc("claim_chat_attachment_cleanup", {
  p_claim_token: claimToken,
  p_limit: 10,
});
report("expired unbound attachment is claimed once", ...);

const callerCleanup = await owner.rpc("claim_chat_attachment_cleanup", {
  p_claim_token: crypto.randomUUID(),
  p_limit: 1,
});
report("member cannot invoke cleanup RPC", Boolean(callerCleanup.error));
```

Build one deterministic verifier that seeds every source/state, exercises member/outsider/direct-table/RPC/Storage denial, checks 40+sentinel and deep cursor identity lists, tests delete fan-out and cleanup retries, and records `EXPLAIN (ANALYZE, BUFFERS)` for long histories. Add `verify:shared-content` using the root's existing `verify:*` script style.

## Shared Patterns

### Authorization and grants

**Sources:** `0050_chat_attachment_hardening.sql` lines 404-406; `0058_chat_link_previews.sql` lines 30-49.

- Listing/category/context RPCs: authenticated-only, `SECURITY INVOKER`, `STABLE`, empty search path, fully qualified objects, explicit `private.is_conversation_member` and nondeleted-source predicates.
- Cleanup claim/finish RPCs: service-role-only, `SECURITY DEFINER`, empty search path, durable token and timeout.
- Test both normalized RPCs and direct underlying table access; client reducers are not an authorization control.

### Error handling and privacy

**Source:** `chat-image-command/index.ts` lines 248-287.

Use calm stable error codes/messages, generic unauthorized/not-found behavior, and structured logs containing only safe error codes. Never log/persist signed URLs, cleanup tokens, private metadata, or Storage paths.

### Ordering and pagination

The database owns `(source_created_at, source_message_id, source_rank, item_id COLLATE "C") DESC`. Clients only preserve returned order and deduplicate stable `itemId`. Cursor fields are all present or all absent. Row 41 is only a sentinel; the next cursor comes from row 40.

### Deletion

The message tombstone transaction schedules all bound attachment cleanup. Every reducer removes by `sourceMessageId`, not only selected `itemId`. Tombstones survive and defeat stale page/realtime events. Storage deletion remains in the Edge worker through `.remove()`, followed by idempotent finish.

### Fixture parity

One JSON corpus lives under `packages/core`; Android reads a test-resource copy and iOS reads a byte-identical SwiftPM resource enforced by `sync-ios-chat-vectors.mjs --check`. All three languages assert the same case count and replay semantics.

## No Analog Found

None. The normalized multi-source projection is new domain logic, but its constituent patterns all have strong repository analogs. Its exact `UNION ALL`, cursor tuple, eligibility matrix, and category `EXISTS` queries should follow `11-RESEARCH.md` because no prior gallery projection exists.

## Metadata

**Analog search scope:** `packages/core`, `packages/supabase`, `supabase/migrations`, `supabase/functions`, `scripts`, `apps/android/feature/chat`, `apps/ios/FishKit`
**Strong analogs inspected:** 12
**Pattern extraction date:** 2026-07-22
