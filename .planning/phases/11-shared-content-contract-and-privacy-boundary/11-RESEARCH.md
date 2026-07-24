# Phase 11: Shared-content contract and privacy boundary - Research

**Researched:** 2026-07-22
**Domain:** Supabase/PostgreSQL authorization, keyset pagination, normalized cross-platform chat-content contracts
**Confidence:** HIGH

## User Constraints

### Locked Decisions

- Index every currently supported persisted content type: photos, MP4 videos, GIFs, stickers, supported documents, first safe public link per message, voice messages; exclude pending, failed, deleted, unsupported.
- Conversation members only, private conversation-scoped.
- 40 newest plus continuation sentinel and deterministic cursor.
- Shared TypeScript/Kotlin/Swift fixtures for classification, ordering, pagination, permissions, state, identity purge, deletion fan-out.
- Deletion immediately revokes access, tombstones source message, schedules idempotent permanent Storage cleanup.
- GIF/sticker export gated on verified redistribution rights.
- No new send/capture/upload/transcoding pipeline.

### the agent's Discretion

- Exact normalized item schema, item identifiers, category names, source ranks, cursor encoding, RPC shape, indexes, cleanup queue representation, and fixture organization, provided they preserve the locked behavior above.

### Deferred Ideas (OUT OF SCOPE)

- New send, capture, upload, MIME expansion, transcoding, global gallery, gallery search, bulk actions, albums, favorites, AI/OCR, autoplay, web gallery, or mobile dashboard surfaces.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-03 | The gallery includes currently supported photos, MP4 videos, GIFs, stickers, documents, the first safe public link per message, and voice messages; pending, failed, deleted, and unsupported content is excluded. | The eligibility matrix, canonical link persistence rule, and union projection below define every included and excluded source. [VERIFIED: `.planning/REQUIREMENTS.md` and codebase inspection] |
| PRIV-01 | Only verified members of a conversation can list or open its shared content; outsiders and members of other conversations are denied server-side. | The security-invoker RPC, canonical membership helper, RLS hardening, grants, and adversarial test matrix below preserve the conversation boundary. [VERIFIED: `.planning/REQUIREMENTS.md` and codebase inspection] |
| PAGE-01 | Opening the gallery loads the newest 40 items plus one continuation sentinel without scanning or loading the transcript. | The server-side `UNION ALL` query and 41-row sentinel contract below operate directly on persisted content tables. [VERIFIED: `.planning/REQUIREMENTS.md` and codebase inspection] |
| PAGE-02 | Older content loads through deterministic cursor pagination without gaps, duplicates, or position jumps. | The four-field keyset order, cursor predicate, sentinel handling, and parity vectors below define stable continuation. [VERIFIED: `.planning/REQUIREMENTS.md` and PostgreSQL documentation] |
| PAR-01 | Shared fixtures define classification, ordering, pagination, permissions, states, identity purging, and deletion fan-out for TypeScript, Kotlin, and Swift. | The fixture layout and required parity suites below reuse the repository's established cross-platform chat-state vector pattern. [VERIFIED: `.planning/REQUIREMENTS.md` and codebase inspection] |

</phase_requirements>

## Summary

Phase 11 should create one database-owned, caller-authorized projection over the existing chat persistence model. The projection must normalize four source families—ready attachments, GIF rows, sticker-bearing messages, and canonical link rows—into seven item kinds: `photo`, `video`, `gif`, `sticker`, `document`, `link`, and `voice`. It must not reconstruct content by loading transcript pages. The current schema already has authoritative persistence for every kind except one subtle case: a safe link is only copied into `message_link_previews` after metadata fetching succeeds. The phase must persist a minimal canonical link row at enqueue time so a safe link remains gallery-eligible even when third-party preview fetching fails. [VERIFIED: `supabase/functions/_shared/link-preview.ts`, migrations 0017/0021/0055/0058/0060]

Use one static, `SECURITY INVOKER` PostgreSQL RPC that returns at most 41 normalized rows in a four-part descending order. Retain 40 and derive `has_more` from the 41st row; the continuation cursor represents the last retained row, never the sentinel. Keep the server authoritative for ordering and eligibility. TypeScript, Kotlin, and Swift should only decode, merge by stable `item_id`, apply tombstones, and replay the same JSON vectors. A small companion category-availability RPC should use the same eligibility predicates so Phase 13 can show only populated category filters without scanning every page. [CITED: https://supabase.com/docs/guides/database/functions] [CITED: https://www.postgresql.org/docs/current/functions-comparisons.html]

Deletion needs two effects with different timing. In the tombstone transaction, hide every child row from all new authenticated reads and delivery-URL refreshes and durably mark bound Storage cleanup as requested. A scheduled worker then removes the Storage objects through the Storage API and finishes the job idempotently. Existing 15-minute signed URLs are bearer URLs and cannot be cryptographically recalled by an RLS change; “immediate revocation” is therefore exact for new metadata/read/signing requests, while an already-issued URL remains usable until its short expiry unless the object has already been removed. Product copy and tests must preserve that distinction. [VERIFIED: codebase inspection] [CITED: https://supabase.com/docs/guides/storage/serving/downloads] [CITED: https://supabase.com/docs/guides/storage/management/delete-objects]

**Primary recommendation:** Implement a single normalized, security-invoker, keyset-paginated shared-content RPC plus a matching category-availability RPC; persist safe link identity before enrichment; extend tombstone deletion into the existing idempotent attachment-cleanup path; and lock the contract with one cross-platform fixture corpus.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Content eligibility and normalization | Database / Storage | API / Backend | Eligibility depends on persisted status, MIME, source tombstone, and conversation membership, so it must be evaluated at the authorized data boundary. [VERIFIED: codebase inspection] |
| Privacy enforcement | Database / Storage | API / Backend | RLS, function grants, and `private.is_conversation_member` are the canonical authority; client filtering is presentation only. [VERIFIED: migrations 0002/0017/0050/0058] |
| Keyset pagination | Database / Storage | Browser / Client | PostgreSQL owns ordering and continuation; clients preserve server order and deduplicate stable identities. [CITED: https://www.postgresql.org/docs/current/functions-comparisons.html] |
| Permanent attachment deletion | API / Backend | Database / Storage | PostgreSQL durably schedules and claims work; the existing Edge cleanup worker calls the Storage API and records completion. [VERIFIED: `chat-image-command` and migrations 0050/0052] |
| Cross-platform gallery state semantics | Browser / Client | API / Backend | Shared pure fixtures define merge, purge, and tombstone behavior; authorization results still originate on the server. [VERIFIED: existing chat-state fixture infrastructure] |
| Around-message source context | Database / Storage | Browser / Client | A bounded server query must return real neighboring rows and gap metadata; clients must not imply adjacency by inserting an isolated source message. [VERIFIED: current Android/iOS focus-message implementations] |

## Project Constraints (from AGENTS.md)

- Use the pnpm workspace and `pnpm-lock.yaml`; do not use npm. [VERIFIED: `AGENTS.md`]
- Keep Supabase as the single backend. Use direct Supabase reads protected by RLS and Edge Functions for sensitive command writes; do not add Express or another auth provider. [VERIFIED: `AGENTS.md`]
- Native mobile remains direct-chat-only. Do not add home/dashboard, lesson, assigned-work, exercise, community, marketplace, or other web-product surfaces. [VERIFIED: `AGENTS.md`]
- Do not add a send, capture, upload, or transcoding pipeline in this retrieval-only phase. [VERIFIED: `AGENTS.md` and locked phase scope]
- Keep shared product contracts in `packages/core` and Supabase auth/database contracts in `packages/supabase`. [VERIFIED: `AGENTS.md`]
- For any React work, reuse base UI components, use named exports, use `forwardRef` for focusable controls, use `cn()`, preserve keyboard focus and reduced motion, and follow the same-named component-folder plus `index.ts` convention. No React UI is required in this phase. [VERIFIED: `AGENTS.md`]
- If exports change, complete-public-surface barrels should use `export *`; inspect every forwarding layer for drift. [VERIFIED: `AGENTS.md`]
- Do not create `tailwind.config.js`; Tailwind v4 remains CSS-first and its two Tailwind packages must stay version-aligned. No Tailwind change is required in this phase. [VERIFIED: `AGENTS.md`]
- Before any user-facing UI change, read `docs/ui-ux-agent-guidelines.md`; enforce one primary action, assigned-not-chosen experiences, accessible targets, visual-not-graded progress, reward-only gamification, calm copy, and design-token-only spacing/color. Phase 11 should remain contract/backend work. [VERIFIED: `AGENTS.md` and `docs/ui-ux-agent-guidelines.md`]
- Run `pnpm build` before any implementation commit, plus the applicable lint/typecheck and module-boundary checks for changed components. [VERIFIED: `AGENTS.md`]
- Coach-first, code-second applies to learning features; this phase is foundational chat retrieval, not a new learning technique. [VERIFIED: `AGENTS.md`]

## Live Implementation Inventory

### Persisted source model

| Source | Current persistence | Relevant state | Phase-11 implication |
|--------|---------------------|----------------|----------------------|
| Photos | `message_attachments`, `kind='image'`, ready output stored as WebP | `status='ready'`, bound `message_id`, display and thumbnail paths | Include only ready, bound, nondeleted source rows. [VERIFIED: migrations 0017/0050] |
| MP4 video | `message_attachments`, `kind='file'`, `stored_mime_type='video/mp4'` | 25 MiB cap in local migration 0060 | Include only after 0060 is deployed. [VERIFIED: migration 0060 and migration-list probe] |
| Voice | `message_attachments`, `kind='file'`, `stored_mime_type='audio/mp4'` | 10 MiB cap; existing voice pipeline | Classify separately from documents despite sharing the attachment table. [VERIFIED: migration 0055] |
| Documents | `message_attachments`, `kind='file'` | PDF, plain text, CSV, DOCX, XLSX, PPTX | Match the exact allowlist; reject other ready legacy MIME values. [VERIFIED: migrations 0021/0050/0060] |
| GIFs | One `message_gifs` row keyed by `message_id` | Provider metadata and public provider media URLs | Include in browsing; keep export capability false until rights are verified. [VERIFIED: migration 0022 and locked decision] |
| Stickers | `messages.sticker_id` and bundled native/web catalogs | Valid catalog identifiers | Include in browsing; keep export capability false until rights are verified. [VERIFIED: migrations 0024/0025 and asset catalogs] |
| Links | One `message_link_previews` row keyed by `message_id` | Row currently appears only after successful metadata fetch | Persist minimal canonical identity at enqueue time; later enrichment updates nullable metadata. [VERIFIED: migration 0058 and `_shared/link-preview.ts`] |

The attachment status vocabulary is `pending`, `uploaded`, `processing`, `pending_scan`, `ready`, `failed`, and `cancelled`. Only `ready` may enter the gallery. Ready image rows require processed display/thumbnail metadata; ready file rows require the hardened clean/legacy scan outcome and a display path. [VERIFIED: migrations 0017/0050]

### Current authorization and deletion

`private.is_conversation_member(uuid)` is the canonical membership seam. It covers channel membership and the repository's legacy direct-conversation relationship rules. The listing RPC must call it and must not infer membership from participant IDs supplied by a client. [VERIFIED: live local database function inspection]

Current message RLS intentionally permits members to see tombstones. Attachment and Storage read policies additionally require a ready, bound attachment whose source message is not deleted. GIF RLS also checks that the source is not deleted. Link-preview RLS checks membership but omits `message.deleted_at is null`, so a member can currently query link metadata directly after source deletion; Phase 11 must harden that policy. [VERIFIED: live local policies and migrations 0017/0050/0058]

`public.delete_chat_message(uuid)` is `SECURITY DEFINER`, sender-only, and converts the source to a tombstone by blanking `body`, clearing `edited_at`, and setting `deleted_at`. It does not schedule permanent cleanup for bound ready attachments. Existing cleanup claims expired unattached rows and stale staging objects only; it deliberately excludes bound final variants. [VERIFIED: migration 0013, cleanup SQL, and `chat-image-command`]

### Deployment and generated-contract drift

The local migration chain ends at 0060, but the linked remote migration list is applied only through 0058; 0059 and 0060 are pending. Because Supabase applies migrations sequentially, Phase 11 deployment must push 0059, then 0060, then the new shared-content migration before relying on MP4 classification. [VERIFIED: `supabase migration list --local` on 2026-07-22]

`packages/supabase/src/database.generated.ts` contains attachment, GIF, and sticker schema but does not contain `message_link_previews`; `database.types.ts` likewise has no public link-preview alias. Regenerate types from a database containing 0058–Phase 11 and then update intentional package exports. Do not manually maintain a divergent partial table shape. [VERIFIED: codebase inspection]

### Current indexes

The database has `messages_conversation_created_id_idx (conversation_id, created_at, id)`, attachment indexes by `message_id` and conversation/creation, and primary-key lookups for the one-to-one GIF and link tables. PostgreSQL can scan the message index backward for descending traversal. There is no partial ready/bound attachment index ordered by message and position. [VERIFIED: live local index inspection]

Do not add indexes from intuition alone. Seed a long conversation with thousands of mixed rows, run `EXPLAIN (ANALYZE, BUFFERS)` for first-page and deep-cursor queries, and add the following partial index only if the plan demonstrates attachment filtering is the bottleneck:

```sql
create index message_attachments_ready_message_position_id_idx
  on public.message_attachments (message_id, position, id desc)
  where status = 'ready' and message_id is not null;
```

Consider a partial active-message index on `(conversation_id, created_at desc, id desc) where deleted_at is null` only if a tombstone-heavy benchmark proves the existing index insufficient. [VERIFIED: live local index inspection; recommendation based on measured-query requirement]

## Standard Stack

### Core

| Library / service | Version | Purpose | Why standard here |
|-------------------|---------|---------|-------------------|
| PostgreSQL via Supabase | Local Supabase CLI 2.109.0 | Authorized normalized RPC, RLS, keyset order, durable cleanup claims | It is the existing data authority and avoids transcript hydration or a second API. [VERIFIED: environment and codebase inspection] |
| Supabase JS | 2.110.0 | Existing Edge cleanup and link-persistence work | Already pinned in Edge imports; no new runtime package is required. [VERIFIED: `supabase/functions/send-message/index.ts`] |
| TypeScript shared contract | Repository compiler; Node 25.9.0 available | Canonical types, reducer, and fixture generation/replay | `packages/core` is the required shared product-contract tier. [VERIFIED: `AGENTS.md` and environment probe] |
| Kotlin / Android chat modules | Kotlin 2.3.x toolchain; Room schema version 8 | Android decoding and pure parity replay | Uses the existing chat data/feature boundaries and fixture test resources. [VERIFIED: Gradle catalog and `ChatDatabase.kt`] |
| Swift Package / FishKit | Swift tools 6.0; Swift 6.3.3 available | iOS decoding and pure parity replay | Uses existing ChatCore, ChatData, and TestSupport boundaries. [VERIFIED: `Package.swift` and environment probe] |

### Supporting

| Tool | Version | Purpose | When to use |
|------|---------|---------|-------------|
| Supabase CLI | 2.109.0 | Reset/migrate, generate types, run SQL verification | Every schema/RPC verification pass. [VERIFIED: environment probe] |
| Docker | 29.6.0 | Existing local Supabase database/services | Required for reproducible RLS and query-plan tests. [VERIFIED: environment probe] |
| Android Gradle wrapper | Gradle 9.4.1 with Android Studio JBR Java 21 | Kotlin parity/unit tests | Invoke through `scripts/android-gradle.sh`; bare `java` is unavailable. [VERIFIED: environment probe] |
| Xcode / Swift | Xcode 26.6, Swift 6.3.3 | Swift parity and integration tests | Use SwiftPM for pure contracts and the existing iOS script for the full gate. [VERIFIED: environment probe] |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Static PostgreSQL union RPC | Client-side transcript scan | Rejected: leaks eligibility logic across clients, cannot meet the bounded first-page requirement, and invites authorization drift. [VERIFIED: requirement PAGE-01] |
| Four-part keyset cursor | Offset pagination | Rejected: concurrent inserts/deletions shift offsets and create duplicates or gaps. [CITED: https://www.postgresql.org/docs/current/functions-comparisons.html] |
| Minimal `message_link_previews` row at enqueue | A new `message_links` table | A new table cleanly separates identity from enrichment, but duplicates the existing one-row-per-message model. Reusing the existing table is the smaller, migration-safe choice. [VERIFIED: current schema inspection] |
| Existing attachment row as cleanup work item | New generic cleanup queue | A generic queue is broader, but bound attachment rows already contain every Storage path and established claim fields; extend that proven seam. [VERIFIED: migrations 0050/0052] |

**Installation:** No external package installation is needed. Use existing workspace, Supabase, Android, and Swift dependencies. [VERIFIED: codebase inspection]

## Package Legitimacy Audit

Not applicable: this phase should install no external packages. Therefore no registry or postinstall gate is required. [VERIFIED: recommended stack]

## Architecture Patterns

### System Architecture Diagram

```text
Authenticated member
        |
        v
list_conversation_shared_content(conversation, category, cursor, limit=40)
        |
        +--> validate auth + category + complete cursor
        +--> private.is_conversation_member(conversation)? -- no --> generic empty/denied result
        |
        v
Static UNION ALL eligibility projection
  +--> ready bound attachments + nondeleted source
  +--> GIF rows + nondeleted source
  +--> sticker messages + nondeleted source
  +--> canonical safe-link rows + nondeleted source
        |
        v
ORDER BY (created_at, message_id, source_rank, item_id) DESC
        |
        v
fetch 41 --> return 40 + has_more + cursor(last retained item)
        |
        +--> TypeScript/Kotlin/Swift decode same DTO
        +--> merge by item_id, server order authoritative

Sender delete command
        |
        v
single DB transaction: tombstone message + mark bound attachment cleanup requested
        |
        +--> RLS/RPC/signing queries immediately stop new access
        v
scheduled chat-image-command --> claim with SKIP LOCKED --> Storage API remove --> idempotent finish
```

### Recommended Project Structure

```text
packages/core/src/shared-content/
├── types.ts
├── classification.ts
├── ordering.ts
├── state.ts
├── index.ts
├── shared-content.test.ts
└── fixtures/shared-content-vectors.json

packages/supabase/src/
├── database.generated.ts
└── database.types.ts

scripts/
├── verify-shared-content.ts
└── sync-ios-chat-vectors.mjs

apps/android/feature/chat/src/main/kotlin/.../sharedcontent/state/
└── [pure contract/state files]
apps/android/feature/chat/src/test/kotlin/.../sharedcontent/
└── SharedContentParityTest.kt

apps/ios/FishKit/Sources/ChatCore/SharedContent/
└── [pure contract/state files]
apps/ios/FishKit/Sources/TestSupport/
└── SharedContentVectors.swift
apps/ios/FishKit/Tests/ChatCoreTests/
└── SharedContentContractTests.swift

supabase/migrations/0061_shared_content_contract.sql
```

Use the actual next migration number at execution time; `0061` is correct only while no concurrent migration is added. [VERIFIED: current migration list]

### Pattern 1: Canonical eligibility matrix

Use this exact classification vocabulary and reject everything not listed:

| Category | Kind | Source predicate | Stable item ID |
|----------|------|------------------|----------------|
| `media` | `photo` | ready, bound attachment; `kind='image'`; `stored_mime_type='image/webp'`; source nondeleted | `attachment:<attachment_uuid>` |
| `media` | `video` | ready, bound attachment; `kind='file'`; `stored_mime_type='video/mp4'`; source nondeleted | `attachment:<attachment_uuid>` |
| `media` | `gif` | `message_gifs` row; source nondeleted | `gif:<message_uuid>` |
| `media` | `sticker` | nonnull valid `messages.sticker_id`; source nondeleted | `sticker:<message_uuid>` |
| `files` | `document` | ready, bound attachment; `kind='file'`; stored MIME is PDF/plain/CSV/DOCX/XLSX/PPTX; source nondeleted | `attachment:<attachment_uuid>` |
| `links` | `link` | canonical `message_link_previews` row; source nondeleted | `link:<message_uuid>` |
| `voice` | `voice` | ready, bound attachment; `kind='file'`; `stored_mime_type='audio/mp4'`; source nondeleted | `attachment:<attachment_uuid>` |

Exclude unbound, pending, uploaded, processing, pending-scan, failed, cancelled, deleted-source, conversation-mismatched, unsupported-MIME, call-activity, reaction, avatar, plain-text-only, and emoji-only records. Do not infer kind from filenames or user-provided `source_mime_type`; classify from hardened persisted fields. [VERIFIED: current schema and locked decisions]

A source message can yield multiple gallery items: up to five attachments and, independently, its first safe link; GIF or sticker messages may also contain a safe body link. Deletion fan-out therefore removes every normalized `item_id` whose `source_message_id` matches the tombstone. [VERIFIED: attachment cardinality and message-source schema]

### Pattern 2: Stable normalized row

Return only metadata needed for later display/action phases:

```typescript
export type SharedContentKind =
  | "photo" | "video" | "gif" | "sticker"
  | "document" | "link" | "voice";

export type SharedContentCategory = "media" | "files" | "links" | "voice";

export interface SharedContentItem {
  itemId: string;
  conversationId: string;
  sourceMessageId: string;
  senderId: string;
  sourceCreatedAt: string;
  sourceRank: number;
  category: SharedContentCategory;
  kind: SharedContentKind;
  attachment?: {
    id: string; originalName: string; mimeType: string; byteSize: number;
    width?: number; height?: number; displayPath: string; thumbnailPath?: string;
  };
  gif?: { provider: string; providerContentId: string; title?: string; description?: string };
  stickerId?: string;
  link?: { url: string; hostname: string; title?: string; description?: string; siteName?: string };
  capabilities: { canDelete: boolean; canExport: boolean };
}
```

Do not return staging paths, cleanup claims/tokens, scan details, hashes, upload credentials, failure diagnostics, or signed delivery URLs. GIF provider URLs should not be exposed as export capability; Phase 14 may resolve preview behavior separately while export remains false. [VERIFIED: existing schema sensitivity and locked rights gate]

### Pattern 3: Exact order, cursor, and sentinel contract

Use fixed nonnull source ranks so multiple rows from one message are totally ordered:

- attachment rank: `100 - position` (`100..96`), preserving attachment position 0 before position 1 under descending order
- GIF rank: `90`
- sticker rank: `89`
- link rank: `80`

The canonical order is:

```sql
order by
  source_created_at desc,
  source_message_id desc,
  source_rank desc,
  item_id collate "C" desc
```

The cursor has exactly `{sourceCreatedAt, sourceMessageId, sourceRank, itemId}`. All four fields are absent for page one or all four are present; reject a partial cursor. The continuation predicate is the lexicographic row comparison:

```sql
and (source_created_at, source_message_id, source_rank, item_id collate "C")
    < (p_before_created_at, p_before_message_id, p_before_source_rank,
       p_before_item_id collate "C")
```

PostgreSQL row comparison is lexicographic, resolving left-to-right at the first unequal pair. All cursor fields are deliberately nonnull so SQL's null row-comparison behavior cannot create an indeterminate boundary. [CITED: https://www.postgresql.org/docs/current/functions-comparisons.html]

Request 41 rows. Retain rows 1–40. `hasMore` is true only when row 41 exists. Encode the next cursor from row 40, the last retained row; encoding row 41 would skip it on the next request. The sentinel is never rendered or cached as content. Clients treat server order as authoritative and deduplicate by `itemId`; they do not recreate a locale-sensitive sort. [VERIFIED: requirement PAGE-01/PAGE-02; PostgreSQL ordering contract]

### Pattern 4: Security-invoker RPC with a companion availability query

Create:

```sql
public.list_conversation_shared_content(
  p_conversation_id uuid,
  p_category text default null,
  p_before_created_at timestamptz default null,
  p_before_message_id uuid default null,
  p_before_source_rank integer default null,
  p_before_item_id text default null,
  p_limit integer default 40
)
```

Make it `STABLE SECURITY INVOKER SET search_path = ''`, fully qualify every object, revoke default execution from `public` and `anon`, and grant only to `authenticated`. PostgreSQL functions are invoker-security by default, and Supabase explicitly recommends invoker mode, an empty search path, explicit schemas, and restricted execution grants. [CITED: https://supabase.com/docs/guides/database/functions] [CITED: https://www.postgresql.org/docs/current/sql-createfunction.html]

Validate category against `media/files/links/voice`, require `p_limit` in `1..40` (native callers use 40), validate complete cursor presence, and make wrong conversation, nonmember, wrong-source, and deleted-source observations indistinguishable. Keep RLS active and include explicit membership/source predicates as defense in depth. Use static `UNION ALL`, not dynamic SQL. [VERIFIED: current RLS architecture; recommendation]

Also create `list_conversation_shared_content_categories(p_conversation_id)` returning the fixed categories that have at least one eligible row. Implement each with `EXISTS` against the exact same eligibility source, not a count over full history. This avoids the Phase-13 bug where a category appearing only before the first 40 rows is hidden, while avoiding an unnecessary full count. [VERIFIED: Phase 13 populated-filter requirement and pagination contract]

### Pattern 5: Persist safe link identity before enrichment

`enqueueLinkPreviewJob` already obtains `firstPublicHttpUrl(body)` through the hardened URL validator, then writes a durable job. Change that same server path to upsert a minimal `message_link_previews` row (`message_id`, canonical `url`, `hostname`, nullable metadata) in the same command flow; preview processing later enriches that row. Backfill existing rows from `chat_link_preview_jobs`, whose stored URL has already passed the same validator. This is a persistence correction inside the existing send command, not a new send pipeline. [VERIFIED: `_shared/link-preview.ts` and migration 0058]

Do not parse message bodies in the gallery RPC. That would duplicate SSRF/public-URL rules in SQL, vary across clients, and make each page a transcript scan. [VERIFIED: existing link-preview boundary]

### Pattern 6: Tombstone-now, purge-asynchronously

Extend the sender-authorized delete transaction so that it:

1. tombstones the source message exactly once;
2. stamps each bound attachment with a durable `delete_requested_at` (or equivalent explicit deletion-work state);
3. leaves source/attachment rows available only to the cleanup worker, while RLS and listing/signing predicates reject them immediately;
4. updates conversation activity using the existing semantics.

Add claim/finish functions dedicated to deleted bound attachments. Claim with the existing token/timeout and `FOR UPDATE SKIP LOCKED` pattern. Extend the scheduled `chat-image-command` cleanup action with a third pass that removes staging, display, and thumbnail paths via the Storage API and then deletes or marks the attachment row purged. Retrying the same claim, receiving a missing object, or repeating message deletion must converge to the same final state. [VERIFIED: existing cleanup implementation] [CITED: https://supabase.com/docs/guides/storage/management/delete-objects]

GIFs and link previews contain third-party/metadata references, stickers use bundled assets, and none of those rows own FISH Storage objects. Tombstone filtering is sufficient for their access boundary; do not delete shared provider or bundled assets. [VERIFIED: current persistence and asset model]

### Pattern 7: Cross-platform fixture corpus

Follow the existing chat-state vector pipeline: source JSON under `packages/core`, direct Android test resources, a sync script that copies the fixture into SwiftPM TestSupport resources, and pure tests in all three languages. [VERIFIED: existing `chat-state` fixtures, Android `ChatStateParityTest`, and `sync-ios-chat-vectors.mjs`]

The corpus must include these groups:

| Group | Required cases |
|-------|----------------|
| Classification | Every eligible kind; every attachment non-ready state; unbound; deleted; unsupported MIME; mixed attachment positions; link without fetched metadata |
| Ordering | Equal timestamp across messages; multiple items from one message; rank ties broken by `itemId`; strict codepoint ordering |
| Pagination | Empty, <40, exactly 40, 41; cursor from row 40; overlapping repeated page; stale duplicate; inserted newer item; deleted item between pages |
| Permissions/capabilities | signed-out, member, outsider, former/blocked member; sender delete true; recipient delete false; GIF/sticker export false |
| Gallery states | loading, content, empty, incomplete, stale/cached, unavailable, terminal error vocabulary needed by later phases |
| Identity purge | user A state + delivery data + temp references disappear before user B state becomes visible |
| Deletion fan-out | one source removes all sibling item IDs; tombstone wins over a stale page/realtime insert; repeat tombstone is idempotent |

These are client contract tests, not authorization tests. The database test suite must separately prove that a malicious caller cannot retrieve rows by bypassing the client reducer. [VERIFIED: security architecture]

### Pattern 8: Reserve a real around-message seam for Phase 14

Current Android and iOS source-focus paths can fetch one message ID and merge that isolated row into an existing window. For a far-old source this falsely implies adjacency. Reserve a caller-scoped RPC now:

```sql
public.list_conversation_message_context(
  p_conversation_id uuid,
  p_message_id uuid,
  p_before integer default 20,
  p_after integer default 20
)
```

It should return the target plus at most 20 real older and 20 real newer neighbors in ascending display order, bounded cursor/gap metadata (`has_older_gap`, `has_newer_gap`), and the same generic result for wrong-conversation, deleted, or unauthorized targets. Phase 14 should replace the active message window or preserve explicit gap markers; it must not insert an isolated target as though adjacent. The gallery route/selection state survives this handoff. [VERIFIED: current Android `focusCurrentMessage`, iOS `ConversationStore.focusMessage`, and Phase 14 requirement]

### Anti-Patterns to Avoid

- **Transcript-powered gallery:** It violates the bounded query requirement and produces incomplete history. Query normalized sources directly.
- **Client-side privacy filtering:** It cannot protect direct RPC/PostgREST access. Enforce membership, RLS, and grants in PostgreSQL.
- **Offset pagination:** Inserts and tombstones shift positions. Use the complete keyset tuple.
- **Cursor from the sentinel:** It skips one item. Cursor from the last retained row.
- **Using `created_at` alone:** Equal timestamps are normal enough to require stable message/rank/item tie-breakers.
- **Parsing body links at read time:** It duplicates the safe-public-link policy and scans transcript data. Persist canonical identity at send time.
- **Turning status away from `ready` without a cleanup marker:** It can hide the only row the cleanup scanner knows how to find. Schedule deletion durably in the tombstone transaction.
- **Deleting Storage rows with SQL:** Supabase requires the Storage API so underlying objects are removed. [CITED: https://supabase.com/docs/guides/storage/management/delete-objects]
- **Assuming RLS recalls signed URLs:** Existing signed URLs remain bearer credentials until expiry or object deletion. [CITED: https://supabase.com/docs/guides/storage/serving/downloads]
- **Sorting separately on Android/iOS:** Locale/collation differences can move ties. Preserve server order and merge by identity.
- **Treating parity fixtures as auth:** Fixtures prove client agreement, not database authorization.
- **Adding a gallery upload path:** This phase is retrieval-only and must reuse persisted content.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Conversation authorization | Participant comparison in each client/RPC | RLS plus `private.is_conversation_member` | It is the canonical relationship-aware membership rule. [VERIFIED: live database inspection] |
| Pagination | Offset counters or timestamp-only cursors | PostgreSQL keyset row comparison | It provides deterministic continuation through ties and mutations. [CITED: https://www.postgresql.org/docs/current/functions-comparisons.html] |
| Safe URL validation | A gallery-specific regex | Existing `firstPublicHttpUrl` / `validatePublicUrl` persistence path | Existing code rejects unsafe schemes, credentials, ports, local/private literals, and fragments. [VERIFIED: `_shared/link-preview.ts`] |
| Signed URL generation | URLs in gallery rows or local URL construction | Existing authorized refresh function, later invoked only for visible/selected items | Delivery credentials remain short-lived and unpersisted. [VERIFIED: `refresh-attachment-urls`] |
| Object deletion | SQL against `storage.objects` | Supabase Storage `.remove()` in the cleanup worker | SQL deletion leaves underlying objects orphaned. [CITED: https://supabase.com/docs/guides/storage/management/delete-objects] |
| Cleanup concurrency | In-memory locks | Existing Postgres claim token + `FOR UPDATE SKIP LOCKED` protocol | It survives worker retries and concurrent invocations. [VERIFIED: current cleanup SQL] |
| Three independent fixture sets | Native-local examples | One JSON corpus synced into Kotlin and Swift tests | A single corpus exposes semantic drift. [VERIFIED: existing chat-state parity pattern] |

**Key insight:** The hard part is not rendering content; it is preserving one content identity, order, and authority boundary while rows originate from several tables and move through deletion and pagination races.

## Common Pitfalls

### Pitfall 1: Safe links disappear when metadata fetch fails

**What goes wrong:** A valid first public link never appears because no `message_link_previews` row exists.  
**Why it happens:** The job is durable at enqueue time, but the canonical preview row is currently written only after a successful third-party fetch.  
**How to avoid:** Upsert minimal identity before enrichment and backfill from existing validated jobs.  
**Warning signs:** Failed/exhausted preview jobs with no row for the same message. [VERIFIED: `_shared/link-preview.ts`]

### Pitfall 2: Link metadata survives source deletion through direct queries

**What goes wrong:** The gallery RPC hides a deleted link, but a member can still select `message_link_previews` directly.  
**Why it happens:** Current link RLS checks membership but not `messages.deleted_at`.  
**How to avoid:** Harden table RLS and test direct PostgREST/RPC access after deletion.  
**Warning signs:** A tombstoned source ID still returns a preview row. [VERIFIED: migration 0058]

### Pitfall 3: The 41st row is skipped

**What goes wrong:** Every full page loses one record.  
**Why it happens:** The continuation cursor is encoded from the sentinel instead of the last retained row.  
**How to avoid:** Use row 41 only as `hasMore`; cursor row 40.  
**Warning signs:** 81 seeded items yield only 79–80 unique results. [VERIFIED: pagination contract]

### Pitfall 4: Existing signed URLs are described as immediately revoked

**What goes wrong:** Security tests or product copy promise a property the current Storage mechanism cannot guarantee.  
**Why it happens:** RLS protects URL issuance and authenticated reads, not a bearer URL already issued for 15 minutes.  
**How to avoid:** Revoke new issuance immediately, enqueue prompt physical removal, retain the short TTL, never persist URLs, and explicitly test the nuance.  
**Warning signs:** A previously captured signed URL still downloads shortly after tombstoning. [CITED: https://supabase.com/docs/guides/storage/serving/downloads]

### Pitfall 5: Local success relies on an unapplied remote migration

**What goes wrong:** Video fixtures pass locally but the linked environment lacks video constraints/support.  
**Why it happens:** Local migrations 0059 and 0060 are not applied remotely.  
**How to avoid:** Treat migration reconciliation and type regeneration as the first execution wave.  
**Warning signs:** Remote migration list stops at 0058. [VERIFIED: migration-list probe]

### Pitfall 6: Generated Supabase types silently omit link rows or the new RPC

**What goes wrong:** Clients create handwritten DTOs that drift from the database.  
**Why it happens:** Generated types predate migration 0058.  
**How to avoid:** Generate from the fully migrated local database and add a drift check.  
**Warning signs:** `message_link_previews` or the RPC name is absent from `database.generated.ts`. [VERIFIED: codebase inspection]

### Pitfall 7: Category filters inspect only the first page

**What goes wrong:** A valid populated category is hidden because its first item is older than the newest 40.  
**Why it happens:** Availability is derived from loaded items instead of authorized history.  
**How to avoid:** Use the companion `EXISTS` RPC over the same predicates.  
**Warning signs:** Adding an old document does not make `files` available. [VERIFIED: Phase 13 requirement]

### Pitfall 8: Delete removes only the selected normalized row

**What goes wrong:** Sibling attachment/link items from the same source message remain visible.  
**Why it happens:** Clients model deletion by `itemId`, but the command tombstones a message.  
**How to avoid:** Fan out tombstones by `sourceMessageId` in all reducers and fixtures.  
**Warning signs:** A multi-attachment message loses one tile but retains others. [VERIFIED: message/attachment model]

### Pitfall 9: Source jump inserts a far-old row into an unrelated window

**What goes wrong:** The conversation appears to contain neighboring messages that were never adjacent.  
**Why it happens:** Existing native focus behavior merges a single fetched message into current paging state.  
**How to avoid:** Reserve and later use the bounded around-message response with explicit gaps.  
**Warning signs:** Jumping to an old source preserves arbitrary recent rows immediately above/below it. [VERIFIED: native implementation inspection]

### Pitfall 10: Query optimization changes semantics

**What goes wrong:** Per-branch limits or a partial index predicate accidentally omit a kind or reorder ties.  
**Why it happens:** Optimization occurs before a long-history correctness corpus and query plan exist.  
**How to avoid:** First establish one canonical eligibility CTE and exhaustive seeds; then benchmark and compare the full ordered identity list.  
**Warning signs:** Optimized and reference queries disagree on seeded `item_id` order. [VERIFIED: recommended validation architecture]

## Code Examples

### Secure function shell

```sql
-- Source: https://supabase.com/docs/guides/database/functions
create or replace function public.list_conversation_shared_content(...)
returns table (...)
language sql
stable
security invoker
set search_path = ''
as $$
  -- fully-qualified static query only
$$;

revoke execute on function public.list_conversation_shared_content(...) from public;
revoke execute on function public.list_conversation_shared_content(...) from anon;
grant execute on function public.list_conversation_shared_content(...) to authenticated;
```

### Sentinel decoding

```typescript
// Source: Phase 11 canonical contract in this research
export function pageFromRows(rows: readonly SharedContentItem[], pageSize = 40) {
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);
  return {
    items,
    hasMore: rows.length > pageSize,
    nextCursor: rows.length > pageSize && last
      ? {
          sourceCreatedAt: last.sourceCreatedAt,
          sourceMessageId: last.sourceMessageId,
          sourceRank: last.sourceRank,
          itemId: last.itemId,
        }
      : undefined,
  };
}
```

### Tombstone-wins merge

```typescript
// Source: Phase 11 canonical contract in this research
export function reduceSharedContent(
  state: SharedContentState,
  event: SharedContentEvent,
): SharedContentState {
  if (event.type === "sourceDeleted") {
    const deletedSources = new Set(state.deletedSourceMessageIds);
    deletedSources.add(event.sourceMessageId);
    return {
      ...state,
      deletedSourceMessageIds: [...deletedSources],
      items: state.items.filter(
        (item) => item.sourceMessageId !== event.sourceMessageId,
      ),
    };
  }
  if (event.type === "pageLoaded") {
    return mergeByItemIdPreservingServerOrder(
      state,
      event.items.filter(
        (item) => !state.deletedSourceMessageIds.includes(item.sourceMessageId),
      ),
    );
  }
  return state;
}
```

### Storage deletion boundary

```typescript
// Source: https://supabase.com/docs/guides/storage/management/delete-objects
const { error } = await admin.storage
  .from("chat-attachments")
  .remove(claimedPaths);

if (error) {
  await releaseClaimForRetry(claimToken, error.message);
} else {
  await finishDeletedAttachmentCleanup(claimToken);
}
```

## State of the Art

| Old/current approach | Phase-11 approach | When changed | Impact |
|----------------------|-------------------|--------------|--------|
| Transcript pages separately hydrate attachments/GIFs/links | One normalized content RPC over persisted source tables | Phase 11 | Bounded first page and one authorization/ordering contract. [VERIFIED: current web/native data paths] |
| Link identity exists only after enrichment succeeds | Identity persists before enrichment | Phase 11 | Safe links remain discoverable through third-party failures. [VERIFIED: current link-preview code] |
| Attachment cleanup excludes bound final objects | Tombstone durably schedules bound-object cleanup | Phase 11 | Deleted content converges to physical removal. [VERIFIED: current cleanup code] |
| Native source focus may merge an isolated row | Reserved bounded around-message query with gap metadata | Contract fixed in Phase 11, consumed Phase 14 | Prevents false adjacency. [VERIFIED: native source-focus implementations] |
| Generated TS schema predates link previews | Regenerated schema after all Phase-11 migrations | Phase 11 | Removes hand-maintained type drift. [VERIFIED: generated files] |

**Deprecated/outdated:**

- Any prior attachment-only gallery recommendation is superseded by the locked requirement to index all currently persisted supported kinds. [VERIFIED: Phase 11 locked decisions]
- Offset or timestamp-only continuation is not compatible with PAGE-02. [VERIFIED: requirement and ordering analysis]
- Treating metadata-fetch success as link eligibility is not compatible with DISC-03. [VERIFIED: requirement and code inspection]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Repository claims were inspected directly; platform behavior is tied to official PostgreSQL/Supabase documentation; remaining choices are explicit recommendations, not asserted external facts. | — | — |

## Open Questions (RESOLVED)

1. **Does “immediately revokes access” require recall of already-issued signed URLs?**
   - What we know: The current application uses 15-minute signed URLs; RLS and tombstones can stop every new issue/read request immediately, and object cleanup can remove the target promptly. [VERIFIED: codebase inspection]
   - What's unclear: A strict requirement that a previously issued bearer URL stop before expiry cannot be guaranteed by the current RLS-based mechanism. [CITED: https://supabase.com/docs/guides/storage/serving/downloads]
   - **RESOLVED — accepted Phase-11 contract:** “Immediate revocation” means the tombstone transaction denies every new metadata read, listing result, and delivery-URL signing request, then schedules prompt idempotent Storage deletion. A bearer URL issued before the tombstone may remain usable until its existing 15-minute expiry or earlier object removal; Phase-11 fixtures, adversarial tests, and downstream copy must state that boundary and must not claim zero-window recall. Changing to recallable delivery credentials would be a separate delivery-architecture/security decision outside this phase.

2. **What redistribution rights apply to GIF and sticker exports?**
   - What we know: Export is explicitly gated, GIF rows refer to providers, and stickers are bundled catalogs. [VERIFIED: locked decision and codebase inspection]
   - What's unclear: No verified provider/catalog redistribution decision is recorded in this phase context.
   - **RESOLVED — accepted Phase-11 contract:** No verified redistribution grant exists, so the portable contract and every parity fixture must encode `canExport=false` for GIFs and stickers. Browsing, preview eligibility, and source navigation remain supported, but Phase 14 must expose no GIF/sticker export action unless a provider- or catalog-specific rights decision is documented in a later scoped change.

No open question remains for Phase-11 execution; the conservative privacy and licensing defaults above are binding inputs to the plans.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | TypeScript fixtures and verification | ✓ | 25.9.0 | — [VERIFIED: environment probe] |
| pnpm | Workspace build/test | ✓ | 11.7.0 | None; required by project [VERIFIED: environment probe and `AGENTS.md`] |
| Supabase CLI | Migrations/type generation | ✓ | 2.109.0 | — [VERIFIED: environment probe] |
| Local Supabase | RLS/RPC/integration tests | ✓ | Docker services running | Reset/restart local stack [VERIFIED: environment probe] |
| Docker | Local Supabase | ✓ | 29.6.0 | — [VERIFIED: environment probe] |
| Android toolchain | Kotlin parity | ✓ through project wrapper | Gradle 9.4.1, JBR Java 21 | Always use `scripts/android-gradle.sh`; bare `java` is unavailable [VERIFIED: environment probe] |
| Xcode / Swift | Swift parity | ✓ | Xcode 26.6, Swift 6.3.3 | SwiftPM for pure-contract tests [VERIFIED: environment probe] |
| iOS simulator | Full iOS gate | ✓ | iPhone 17 Pro destination available | Existing script chooses supported destination [VERIFIED: environment probe] |

**Missing dependencies with no fallback:** None. [VERIFIED: environment audit]

**Missing dependencies with fallback:** Bare Java is missing; the repository Android wrapper successfully selects Android Studio JBR Java 21. [VERIFIED: environment audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Database/RLS | Supabase local Postgres plus repository Node verification scripts. [VERIFIED: `scripts/verify-rls.ts`, `scripts/verify-chat-attachments.ts`] |
| TypeScript pure contract | Node built-in test runner with TypeScript stripping, or existing workspace Vitest if the planner standardizes it; prefer Node to add no dependency. [VERIFIED: Node 25 environment] |
| Android | JUnit parity tests invoked by project Gradle wrapper. [VERIFIED: existing `ChatStateParityTest`] |
| iOS | Swift Testing in FishKit plus existing Xcode full test script. [VERIFIED: `FishKit/Tests` and root scripts] |
| Quick run command | `pnpm verify:shared-content && node --experimental-strip-types --test packages/core/src/shared-content/shared-content.test.ts` |
| Full suite command | `pnpm build && pnpm lint && pnpm typecheck && pnpm android:test && pnpm ios:test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DISC-03 | Exact seven-kind classification; all exclusions; canonical failed-enrichment link | DB integration + shared parity | `pnpm verify:shared-content` | ❌ Wave 0 |
| PRIV-01 | Member-only listing and direct table/RPC/Storage denial after tombstone | Adversarial RLS integration | `pnpm verify:shared-content` | ❌ Wave 0 |
| PAGE-01 | 41-row fetch yields 40 visible plus continuation without transcript query | DB integration + query plan | `pnpm verify:shared-content` | ❌ Wave 0 |
| PAGE-02 | Deep cursor, ties, insertion/deletion races, no skip/duplicate | DB integration + TS/Kotlin/Swift parity | `pnpm verify:shared-content && scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentParityTest' && (cd apps/ios/FishKit && swift test --filter SharedContentContractTests)` | ❌ Wave 0 |
| PAR-01 | Same vectors replay in all three languages | Cross-platform unit | Commands above | ❌ Wave 0 |

### Required database/adversarial matrix

At minimum seed and verify: signed-out caller; random outsider; member of another conversation; former/blocked member; authorized member; cursor copied from another authorized conversation; invalid category; limit out of range; partial/tampered cursor; every attachment state; ready-unbound; source/attachment conversation mismatch; unsupported ready MIME; deleted source; link row after deletion; equal timestamps; multiple items per source; sender versus recipient deletion; repeat deletion; refresh URL before/after deletion; cleanup retry and missing object; anonymous function execute attempt; and direct table access as well as RPC access. Capture a pre-issued signed URL separately to document its TTL behavior rather than falsely expecting RLS recall. [VERIFIED: current threat surface and official signed-URL behavior]

### Query-plan gate

Seed at least one long conversation with thousands of ordinary messages, mixed eligible kinds, tombstones, and ineligible attachments. Record `EXPLAIN (ANALYZE, BUFFERS)` for: unfiltered first page, each category, a deep cursor, and category availability. Verify that each page examines a bounded indexed region rather than hydrating/scanning the transcript in application code. Compare every returned `item_id` with a simple reference query before accepting any per-branch limit optimization. [VERIFIED: PAGE-01/PAGE-02 performance risk]

### Sampling Rate

- **Per task commit:** The changed contract's focused test plus `pnpm build` as mandated by AGENTS.md.
- **Per schema task:** `pnpm verify:shared-content` after local reset/migration.
- **Per parity task:** focused TypeScript + Kotlin + Swift vector test.
- **Per wave merge:** `pnpm build && pnpm lint && pnpm typecheck`, then applicable native suites.
- **Phase gate:** Full database, web/workspace, Android, and iOS suites green before `$gsd-verify-work`.

### Wave 0 Gaps

- [ ] `scripts/verify-shared-content.ts` — deterministic seed, RLS/adversarial cases, link-deletion regression, sentinel/cursor checks, long-history plan checks.
- [ ] Root `verify:shared-content` package script.
- [ ] `packages/core/src/shared-content/fixtures/shared-content-vectors.json` and pure TypeScript replay test.
- [ ] Android `SharedContentParityTest.kt` plus fixture resource wiring.
- [ ] Swift `SharedContentVectors.swift` and `SharedContentContractTests.swift` plus sync/check script extension.
- [ ] A generated-type drift check after local migration.
- [ ] Hosted migration-list/deployment verification for pending 0059/0060 and the new phase migration.

Existing infrastructure is reusable, but none of the Phase-11-specific contract tests exists yet. [VERIFIED: codebase inspection]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Supabase Auth identity (`auth.uid()`) and `authenticated`-only execute grants; never accept caller identity as data. [VERIFIED: current stack] |
| V3 Session Management | yes | Existing Supabase sessions; do not persist signed delivery URLs; identity-change reducers purge all prior-account gallery state. [VERIFIED: current stack and PRIV roadmap] |
| V4 Access Control | yes | RLS + security-invoker RPC + `private.is_conversation_member` + source nondeleted predicates. [VERIFIED: current stack] |
| V5 Input Validation | yes | Fixed category enum, complete cursor validation, limit bounds, UUID/timestamp typed arguments, static SQL, existing safe-public-URL validator. [VERIFIED: proposed contract and current validator] |
| V6 Cryptography | yes | Supabase-generated short-lived signed Storage URLs; never hand-roll signatures or log/persist URLs. [VERIFIED: current delivery path] |
| V7 Error Handling and Logging | yes | Generic unauthorized/not-found behavior; no Storage paths, tokens, URLs, or private metadata in logs. [VERIFIED: privacy boundary requirement] |
| V8 Data Protection | yes | Conversation-scoped metadata, immediate new-access denial, identity purge fixture, permanent Storage cleanup through API. [VERIFIED: requirements PRIV-01 and locked deletion decision] |
| V9 Communications | yes | Existing Supabase HTTPS boundary; no provider URL proxy or new transport introduced. [VERIFIED: current architecture] |
| V10 Malicious Code | no new exposure | No package installation, uploaded-file execution, or new transcoding pipeline. [VERIFIED: phase scope] |

### Known Threat Patterns for Supabase/PostgreSQL content listing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR by conversation UUID | Information disclosure | RLS, canonical membership helper, authenticated-only invoker RPC, adversarial cross-conversation tests. |
| SECURITY DEFINER/search-path privilege escalation | Elevation of privilege | Use `SECURITY INVOKER`, `search_path=''`, fully qualified objects, revoke default grants. [CITED: https://supabase.com/docs/guides/database/functions] |
| Deleted child row remains directly queryable | Information disclosure | Apply nondeleted-source predicates to every child table policy, including link previews. |
| Cursor probing/oracle | Information disclosure | Validate tuple completeness and reapply conversation membership/source scope before comparison; use generic results. |
| Signed URL leakage | Information disclosure | Return Storage paths only to authorized metadata clients, sign in bounded visible batches later, never persist/log URLs, short TTL. |
| Stale page resurrects a tombstone | Tampering | Persist deleted source IDs in reducer state; tombstone wins all later page/realtime merges. |
| Cleanup replay/race | Tampering / denial of service | Durable claims, timeout, `SKIP LOCKED`, idempotent finish, missing-object success semantics, dedicated cleanup secret. |
| Dynamic category SQL injection | Tampering | Static `UNION ALL` and exact enum validation; no dynamic identifiers/fragments. |
| Provider asset redistribution | Legal/data-protection boundary | `canExport=false` for GIF/sticker until documented rights verification. |
| Account-switch cache disclosure | Information disclosure | Shared identity-purge contract now; Phase 12 implements persistent cache/temp-file purge before exposing next identity. |

### Security verification notes

Test both the normalized RPC and each underlying table/Storage path. A secure RPC does not repair a permissive table policy, as the current link-preview deletion gap demonstrates. Conversely, do not make the list function `SECURITY DEFINER` merely to simplify the union; that would bypass RLS and concentrate every predicate into one fragile body. [VERIFIED: current policy gap] [CITED: https://supabase.com/docs/guides/database/functions]

## Sources

### Primary (HIGH confidence)

- Repository `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — product, platform, and phase constraints. [VERIFIED: codebase inspection]
- Supabase migrations 0013, 0017, 0021, 0022, 0024, 0025, 0050, 0052, 0055, 0058, 0060 — source schema, RLS, cleanup, MIME, and deletion behavior. [VERIFIED: codebase inspection]
- `supabase/functions/_shared/link-preview.ts`, `send-message`, `chat-image-command`, `refresh-attachment-urls` — live link, command, cleanup, and delivery behavior. [VERIFIED: codebase inspection]
- Live local PostgreSQL catalog/policy/function/index inspection and Supabase migration-list probe — effective schema and local/remote drift. [VERIFIED: tool inspection on 2026-07-22]
- Existing TypeScript/Kotlin/Swift chat-state fixtures and parity tests — cross-platform vector precedent. [VERIFIED: codebase inspection]
- [Supabase database functions](https://supabase.com/docs/guides/database/functions) — invoker security, empty search path, schema qualification, and execute grants. [CITED: official documentation]
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — database access-control boundary. [CITED: official documentation]
- [PostgreSQL row and array comparisons](https://www.postgresql.org/docs/current/functions-comparisons.html) — lexicographic cursor behavior. [CITED: official documentation]
- [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) — function security and configuration semantics. [CITED: official documentation]
- [Supabase signed downloads](https://supabase.com/docs/guides/storage/serving/downloads) — signed URL delivery behavior. [CITED: official documentation]
- [Supabase deleting objects](https://supabase.com/docs/guides/storage/management/delete-objects) — Storage API deletion requirement. [CITED: official documentation]

### Secondary (MEDIUM confidence)

- None required; critical external behavior was checked against official PostgreSQL and Supabase documentation.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new stack; versions and availability were inspected locally.
- Architecture: HIGH — derived from the effective schema/RLS/functions and official database semantics.
- Eligibility: HIGH — every supported kind and persistence state was traced to migrations/current code.
- Pagination: HIGH — exact tuple and sentinel behavior are specified and backed by PostgreSQL semantics.
- Deletion: HIGH for new-access denial and cleanup design; MEDIUM for product interpretation of already-issued signed URLs until the open-question wording is accepted.
- Cross-platform parity: HIGH — established fixture infrastructure exists on all three platforms; Phase-11 files are clear Wave-0 gaps.
- Pitfalls: HIGH — each major pitfall maps to a live code/schema condition or a deterministic cursor/security failure mode.

**Research date:** 2026-07-22  
**Valid until:** 2026-08-21 for the stable architecture; re-run migration/version/environment probes immediately before execution or if migrations advance.
