# Phase 12: Cross-platform data, cache, and recovery - Research

**Researched:** 2026-07-23
**Domain:** Native Android/iOS offline read caches, bounded media delivery, reconnect recovery, and identity-safe teardown
**Confidence:** HIGH for repository architecture and existing behavior; MEDIUM for platform API guidance; LOW for discretionary numeric thresholds

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Offline footprint
- **D-01:** Persist the newest 40 shared-content items for an opened conversation plus older pages the user explicitly browsed. Do not prefetch unvisited history for offline storage.
- **D-02:** Bound persisted metadata. When the bound is reached, evict the oldest browsed pages while preserving the newest metadata for active conversations.
- **D-03:** Persist only small thumbnails that were actually displayed. A thumbnail fetched by lookahead remains ephemeral unless it reaches the displayed set.
- **D-04:** Never persist delivery URLs or full previews. Decoded full media and temporary delivery artifacts remain ephemeral and must participate in account-change cleanup.
- **D-05:** Apply both a storage ceiling and an inactivity window. Reclaim least-recent thumbnails and older browsed pages first while preserving the newest metadata for active conversations.
- **D-06:** Exclude all shared-content metadata, thumbnails, delivery state, and temporary files from Android/iOS device backup and migration. A new or restored device rebuilds gallery context only after verifying the account and reconnecting.

### Cached-state truth
- **D-07:** When offline cache exists, keep it normally browsable beneath one persistent gallery-level notice that the content is saved on this device and may be out of date. Do not dim or badge every item.
- **D-08:** Represent a partial cache honestly at the cached-history boundary. When the user reaches the oldest retained item, explain that more content may be available online; never imply that cached history is complete.
- **D-09:** Offline with no cache is `unavailable`, not `empty`. The empty state is valid only after a successful authoritative response confirms that the conversation has no eligible shared content.
- **D-10:** Keep cached items visible during refresh. Apply additions, replacements, and tombstone removals only from accepted server or realtime results.
- **D-11:** If refresh ultimately fails, keep cached content visible and mark it stale. Recovery failure must not replace useful cache with a blank or terminal screen.

### Recovery and bounded fetching
- **D-12:** Start metadata refresh when the gallery opens, after a meaningful foreground return, and when connectivity returns. Coalesce overlapping lifecycle/realtime triggers into one bounded recovery request.
- **D-13:** Fetch delivery URLs and thumbnail bytes for visible items plus a one-screen lookahead, in batches no larger than 50. Fetch full content only after explicit item selection.
- **D-14:** Respect Android Data Saver and iOS Low Data Mode automatically: visible thumbnails may still load on a usable network, but lookahead pauses. Do not add a gallery data-use setting.
- **D-15:** Allow exactly one automatic retry per recovery cycle after a short backoff and only while the app still has usable connectivity.
- **D-16:** After the second failure, retain stale content and expose one calm manual retry. Do not auto-retry again until a genuinely new gallery-open, meaningful-foreground, or reconnect cycle begins.

### Identity and authority carried forward
- **D-17:** Do not reveal any persisted gallery cache until the verified account identity matches its cache owner. A different, missing, or unresolved verified identity makes prior cache ineligible for display.
- **D-18:** Identity change purges prior-account metadata, thumbnails, delivery references, decoded media, and temporary files before new-owner content is accepted. Conversation changes retain the Phase 11 whole-event ownership checks.
- **D-19:** Supabase/Postgres and RLS remain authoritative. Local persistence is a disposable read cache and must never preserve access after authoritative deletion, membership loss, or identity change.

### the agent's Discretion
- Choose the exact per-conversation/account item, byte, and inactivity thresholds, provided they are measurable, bounded, shared in intent across Android and iOS, and preserve the newest active-conversation metadata.
- Choose native persistence and protection mechanics, cache-key structure, transaction boundaries, cleanup scheduling, and OS backup-exclusion flags while preserving account-and-conversation isolation.
- Choose the exact meaningful-foreground interval, retry backoff/jitter, coalescing window, and signed-URL freshness margin. These values must be deterministic and testable; they must not create repeated background retry loops.
- Choose how the existing portable fixture corpus is extended to prove cache hydration, eviction, status truth, data-saving behavior, URL non-persistence, recovery-cycle reset, and identity purge parity.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 12 data, cache, privacy, and recovery scope. Gallery navigation/presentation remains Phase 13; preview, export, source navigation, and user-facing deletion remain Phase 14; final accessibility/performance/release proof remains Phase 15.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRIV-02 | Short-lived delivery URLs are refreshed only when needed and are never persisted or logged. | Use an owner-scoped in-memory URL registry, a two-minute freshness margin against the existing 15-minute server TTL, ephemeral/no-HTTP-cache fetchers, opaque cache keys, and redacted diagnostics. [VERIFIED: codebase grep] |
| PRIV-03 | Cached gallery data is isolated by account and conversation and purged whenever the verified identity changes. | Put the owner and conversation in every metadata key and thumbnail namespace; gate hydration on verified identity; cancel by generation and synchronously purge database, disk, decoded memory, URL references, and temp files before accepting the new owner. [VERIFIED: 12-CONTEXT.md] |
| PAGE-03 | Delivery URLs and heavy previews load only for visible or selected content in bounded batches of at most 50. | Introduce one visibility planner that deduplicates IDs, splits requests into chunks of at most 50, pauses lookahead under OS data-saving signals, and never fetches full bytes without selection. [VERIFIED: 12-CONTEXT.md] |
| OFF-01 | Cached metadata remains browsable offline while the interface clearly distinguishes cached, incomplete, and unavailable content. | Persist a safe snapshot DTO, not the runtime reducer state; model cache provenance and retained-history completeness independently; reserve `empty` for an authoritative successful response. [VERIFIED: codebase grep] |
| OFF-02 | Reconnection merges additions and deletions without duplicates; failed refreshes receive one automatic retry before showing a manual retry action. | Reuse Phase 11 request/cursor/owner acceptance and tombstone-wins merge, then add a coalesced recovery-cycle state machine with attempt 0, one delayed retry, and a terminal manual-retry phase. [VERIFIED: codebase grep] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Use the pnpm workspace; do not use npm or add another lockfile. Run `pnpm build`, `pnpm lint`, and `pnpm typecheck`, and the production build must pass before a commit. [VERIFIED: AGENTS.md]
- Keep native Android and iOS direct-chat-only. Do not add a home/dashboard, lesson booking, assigned work, learning exercise, community, marketplace, global gallery, or other web-product surface. [VERIFIED: AGENTS.md]
- Coach-first, code-second applies to learning features. This phase is infrastructure for an already-defined direct-chat retrieval capability, not a new learning mechanic. [VERIFIED: AGENTS.md]
- Supabase remains the single backend. Use direct RLS-protected reads for authorized listing and Edge Functions for sensitive command-style work; do not add Express or another API service. [VERIFIED: AGENTS.md]
- The user-facing cache/recovery state must remain calm and sparse: one primary action per screen, one persistent gallery-level notice rather than per-item warnings, at least 44×44 touch targets, sentence-case plain language, and no scolding/alarming recovery copy. [VERIFIED: AGENTS.md] [VERIFIED: docs/ui-ux-agent-guidelines.md]
- Do not add client choices for cache size, data use, or retry policy; follow OS Data Saver/Low Data Mode automatically. [VERIFIED: 12-CONTEXT.md]
- Preserve visible keyboard focus and reduced-motion behavior. Later Phase 13 UI work must define loading, partial, empty, offline, failure, and retry states without geometry-changing updates. [VERIFIED: docs/ui-ux-agent-guidelines.md]
- Keep portable product contracts in `packages/core`, Android provider/Room details in `:data:chat`, Android feature state in `:feature:chat`, iOS pure state in `ChatCore`, provider/persistence adapters in `ChatData`, and orchestration in `PersonalChat`. [VERIFIED: AGENTS.md] [VERIFIED: ADR 0002] [VERIFIED: ADR 0005]
- If web files are incidentally touched, retain Tailwind v4 CSS-first configuration, never create `tailwind.config.js`, keep Tailwind packages version-aligned, use tokens rather than raw hex/arbitrary spacing, reuse base UI components, use named component exports/`forwardRef`/`cn()`, and follow the same-named component-folder plus `index.ts` barrel rules. Phase 12 should not need web UI changes. [VERIFIED: AGENTS.md]
- Complete barrels use `export *` unless a deliberate public subset, boundary, rename, collision, compatibility layer, or provider-internal shield requires explicit exports. [VERIFIED: AGENTS.md]

## Summary

Phase 12 should be planned as one portable state-contract extension plus two native data implementations, not as two unrelated caches. Phase 11 already supplies deterministic 40+1 paging: `p_limit = 40` permits at most 41 returned rows indexed 0–40; indexes 0–39 are retained; `nextCursor` comes from retained index 39; optional index 40 only sets `hasMore = true`; index 41 is never accessed and index 40 never supplies the cursor. It also supplies owner/request/cursor acceptance, duplicate suppression, tombstone-wins deletion, and TypeScript-owned Kotlin/Swift parity fixtures. [VERIFIED: codebase grep] The missing layer is an explicit safe persisted snapshot, an orthogonal cache/recovery truth model, native repositories that transact cache updates, and a generation-gated identity teardown that also owns media memory/disk/temp cleanup. [VERIFIED: codebase grep]

Android already has Room 2.8.4, Coil 3.5.0, a Room migration-test pattern, `NetworkMonitor`, redacted diagnostics, a database-wide sign-out transaction, `allowBackup="false"`, and cloud/device-transfer root exclusions. [VERIFIED: codebase grep] iOS already has the correct `ChatCore`/`ChatData` split, Supabase-backed provider adapters, an `NWPathMonitor` connectivity adapter, and file staging that applies backup exclusion and data protection. [VERIFIED: codebase grep] However, iOS has no shared-content persistent store, and `MessageImageLoader.shared` currently uses one global `Library/Caches/ChatMedia` directory, persists every successfully fetched image (including display bytes), and is not called from `FishAppModel.signOut()`. [VERIFIED: codebase grep] This is the highest-priority privacy seam to replace or bring under an owner-scoped coordinator.

Use Room on Android and built-in Core Data with a local SQLite store on iOS; add no external packages. [CITED: https://developer.android.com/training/data-storage/room] [CITED: https://developer.apple.com/documentation/coredata/] Keep signed URLs only in an in-memory registry backed by an ephemeral/no-response-cache HTTP session, and persist only displayed thumbnail bytes under opaque owner/conversation/item/version keys. [CITED: https://developer.apple.com/documentation/foundation/urlsession] [CITED: https://coil-kt.github.io/coil/api/coil-core/coil3.request/-options/index.html] Plan the identity transition before cache hydration and network acceptance: revoke the old generation, hide old state, purge every layer, verify deletion, then bind the new identity. [VERIFIED: 12-CONTEXT.md]

**Primary recommendation:** Build the portable cache/recovery contract and fixture vectors first, then implement Android and iOS adapters against that contract, and finish by wiring one fail-closed identity-change purge gate across metadata, thumbnail disk, decoded memory, signed-URL memory, and temporary artifacts. [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Safe persisted metadata snapshot and merge semantics | Browser / Client (portable native core) | Database / Storage | This is device-local native state, while Supabase remains the authority. The pure contract defines admissible cached fields and merge truth; native stores only implement it. [VERIFIED: ADR 0001] [VERIFIED: ADR 0005] |
| Android metadata persistence and eviction | Database / Storage (Room in `:data:chat`) | Browser / Client (`:feature:chat`) | Room owns transactions, indices, migrations, and pruning; feature state consumes provider-neutral snapshots. [VERIFIED: ADR 0002] |
| iOS metadata persistence and eviction | Database / Storage (Core Data in `ChatData`) | Browser / Client (`PersonalChat`) | Core Data is a local cache store; `PersonalChat` orchestrates reducer events without importing provider/store types. [CITED: https://developer.apple.com/documentation/coredata/] [VERIFIED: ADR 0005] |
| Authoritative list/category refresh | API / Backend (Supabase RPC under RLS) | Browser / Client native adapters | Existing Postgres functions own membership checks and ordering; native adapters call and decode them without re-authorizing locally. [VERIFIED: codebase grep] [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |
| Signed delivery URL refresh | API / Backend (existing Edge Function) | Browser / Client in-memory registry | The existing function authenticates, caps IDs at 50, and returns 15-minute URLs; clients decide freshness and never persist/log results. [VERIFIED: codebase grep] |
| Visible thumbnail and selected full-byte loading | Browser / Client | CDN / Static (Supabase Storage signed delivery) | Visibility/selection and OS data policy are local; Storage only serves authorized short-lived delivery URLs. [VERIFIED: 12-CONTEXT.md] |
| Offline/stale/incomplete/unavailable truth | Browser / Client portable state | Database / Storage | The reducer exposes truthful presentation state from cache provenance, retained boundary, connectivity, and recovery outcome. [VERIFIED: codebase grep] |
| Recovery-cycle coalescing and retry | Browser / Client orchestration | API / Backend | Lifecycle/reconnect/realtime hints start one local cycle; accepted API/realtime results remain authoritative. [VERIFIED: ADR 0006] |
| Verified-identity purge | Browser / Client application/session coordinator | Database / Storage | Auth change must revoke tasks and purge Room/Core Data, disk, memory, and temp layers before new-owner acceptance. [VERIFIED: 12-CONTEXT.md] |
| Backup/migration exclusion and file protection | Operating-system storage policy | Database / Storage | Android rules and no-backup/cache locations plus iOS cache/application-support flags and file protection prevent portable recovery of disposable private cache. [CITED: https://developer.android.com/identity/data/autobackup] [CITED: https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup] |

## Recommended Contract Shape

Do **not** serialize `SharedContentState` directly. It currently contains pending requests, delivery references, temporary references, runtime errors, and tombstones; persisting that object would make transient authority and secrets durable. [VERIFIED: codebase grep] Add a separate allowlisted `SharedContentCachedSnapshot` with:

- `schemaVersion`, `ownerIdentityId`, `conversationId`, `savedAt`, `lastAuthoritativeAt`, and `lastAccessedAt`. [ASSUMED]
- Deterministically ordered safe item metadata and explicitly browsed page boundaries/cursors; never URLs, decoded bytes, pending requests, error text, delivery references, temporary references, or full preview data. [VERIFIED: 12-CONTEXT.md]
- `authoritativeEmptyConfirmed`, `retainedOldestCursor`, `retainedHistoryComplete`, and `newestWindowProtected`. These allow `empty`, `unavailable`, and incomplete-history truth to be derived without guessing. [ASSUMED]
- Cached capability values may be retained for structural parity but must not authorize an action; offline/uncertain actions stay unavailable until current authority is confirmed. [ASSUMED]

Extend the pure runtime model with orthogonal dimensions instead of forcing all truth into the existing single `status` enum. [ASSUMED]

```typescript
// Source: project contract analysis; exact names are recommended, not existing API. [ASSUMED]
type SharedContentCacheSource = "none" | "verified-device-cache" | "authoritative";
type SharedContentRecoveryPhase =
  | "idle"
  | "refreshing"
  | "retry-backoff"
  | "manual-retry";

interface SharedContentCacheTruth {
  source: SharedContentCacheSource;
  stale: boolean;
  retainedHistoryComplete: boolean;
  lastAuthoritativeAt: string | null;
}

interface SharedContentRecovery {
  cycleId: string | null;
  attempt: 0 | 1;
  phase: SharedContentRecoveryPhase;
}
```

The public `SharedContentGalleryStatus` can remain the compact presentation vocabulary, but cache source, stale truth, and retained-history completeness must be independently representable because a cache can be both stale and incomplete. [VERIFIED: 12-CONTEXT.md]

## Standard Stack

### Core

| Library / framework | Version | Purpose | Why Standard |
|---------------------|---------|---------|--------------|
| Kotlin + coroutines | Kotlin 2.3.10 plugin catalog / coroutines 1.10.2 | Android pure state, flows, cancellation, serialized recovery | Already locked in the Android build and used by repository/state code. [VERIFIED: codebase grep] |
| Android Room | 2.8.4 | Metadata entities, owner/conversation indices, transactions, migration 8→9, deterministic pruning | Already installed with runtime, KTX, compiler, testing, and exported schema history. [VERIFIED: codebase grep] Official guidance supports migrations and device-side database tests. [CITED: https://developer.android.com/training/data-storage/room/migrating-db-versions] |
| Coil | 3.5.0 | Android decode/memory cache and request-level disk-policy control | Already installed; separate memory/disk/network cache policies allow lookahead disk writes to be disabled. [VERIFIED: codebase grep] [CITED: https://coil-kt.github.io/coil/api/coil-core/coil3.request/-options/index.html] |
| Android ConnectivityManager | minSdk 26; targetSdk 36 | Validated connectivity, meteredness, and Data Saver policy | Existing monitor already uses `NetworkCallback`; extend it from Boolean to a policy snapshot. [VERIFIED: codebase grep] [CITED: https://developer.android.com/develop/connectivity/network-ops/reading-network-state] |
| Swift 6 / iOS | Swift language mode 6; iOS 17 minimum | Sendable-safe pure state, actors, lifecycle orchestration | Locked in `Package.swift`. [VERIFIED: codebase grep] |
| Core Data | iOS 17 system framework | iOS metadata cache, transactions, batch purge, migration, protected local store | Built into the OS, adds no package, and Apple explicitly supports Core Data for single-device temporary caches and offline use. [CITED: https://developer.apple.com/documentation/coredata/] |
| Foundation URLSession + Network | iOS 17 system frameworks | Ephemeral delivery fetches and Low Data Mode observation | Ephemeral sessions avoid disk cache/cookie/credential persistence; `NWPath.isConstrained` is Low Data Mode. [CITED: https://developer.apple.com/documentation/foundation/urlsession] [CITED: https://developer.apple.com/documentation/network/nwpath] |
| Supabase Kotlin / Swift | Kotlin 3.6.0; Swift 2.52.0 resolved | Authenticated RPC, Edge Function invocation, realtime signals | Already installed and provider-confined; official clients support typed RPC and authenticated function invocation. [VERIFIED: codebase grep] [CITED: https://supabase.com/docs/reference/kotlin/v2/rpc] [CITED: https://supabase.com/docs/reference/swift/v1/rpc] |

### Supporting

| Library / framework | Version | Purpose | When to Use |
|---------------------|---------|---------|-------------|
| Android Room migration testing | 2.8.4 | Validate schema 8→9 and all retained rows/indices | Required for the new entities and future upgrade safety. [CITED: https://developer.android.com/training/data-storage/room/testing-db] |
| Swift Testing / XCTest through Xcode | Xcode 26.6 toolchain | Pure contract, Core Data adapter, file/cache, and app identity tests | Existing `FishKit-Package` simulator test path is the authoritative iOS target. [VERIFIED: codebase command] |
| Canonical JSON fixture corpus | Version 2 currently | Cross-language cache/recovery behavior | Extend TypeScript-owned bytes and sync them with `pnpm ios:chat-vectors`; do not author platform-local expectations. [VERIFIED: codebase grep] |
| Android backup rules + `noBackupFilesDir`/`cacheDir` | API 26+ | Prevent cloud/device-transfer portability | Existing manifest/rules already exclude the app root; keep gallery files in system-excluded roots and add focused regression checks. [VERIFIED: codebase grep] [CITED: https://developer.android.com/identity/data/autobackup] |
| iOS `isExcludedFromBackup` + file protection | iOS 17 | Prevent backup and protect local cache at rest | Use `Library/Caches` for thumbnails/temp; mark the Core Data store directory excluded after each material file operation and set complete store/file protection. [CITED: https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup] [CITED: https://developer.apple.com/documentation/coredata/nspersistentstorefileprotectionkey] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Core Data | SwiftData | SwiftData is available at the deployment floor, but Core Data exposes the store configuration, migration, batch-delete, and file-protection controls this cache needs more directly. Use Core Data for this phase. [ASSUMED] |
| Core Data | Flat Codable JSON files | Atomic file writes are simple, but multi-page upsert, owner purge, eviction ordering, crash recovery, and indexed querying would become a custom database. Do not use flat files for metadata. [ASSUMED] |
| Core Data | GRDB or another SQLite package | A wrapper could provide explicit SQL, but it introduces a new external dependency when the platform framework already covers the bounded cache. Do not add it. [ASSUMED] |
| Foreground recovery coordinator | WorkManager/background URLSession | The locked triggers are gallery-open, meaningful foreground, and reconnect; background scheduling would broaden retry behavior and risk loops. Keep recovery foreground/session scoped. [VERIFIED: 12-CONTEXT.md] |
| Controlled thumbnail store | Default global Coil/URL cache | Default caches do not encode the displayed-only rule or identity purge boundary. Use request-level disk policy and an owner-scoped controlled disk namespace. [VERIFIED: 12-CONTEXT.md] |

**Installation:** No new packages. Use existing Gradle/SwiftPM dependencies and Apple/Android system frameworks. [VERIFIED: codebase grep]

**Version verification:** Versions above were read from `apps/android/gradle/libs.versions.toml`, Android convention plugins, `apps/ios/FishKit/Package.swift`, and `Package.resolved` on 2026-07-23. [VERIFIED: codebase grep]

## Package Legitimacy Audit

No external package installation is recommended, so the package-legitimacy gate is not applicable. Existing Room, Coil, Supabase, Kotlin, and Swift dependencies remain pinned by repository manifests. [VERIFIED: codebase grep]

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: no new package recommendation]  
**Packages flagged as suspicious [SUS]:** none. [VERIFIED: no new package recommendation]

## Recommended Discretion Values

These values are deliberately explicit so tests and both native implementations can share intent. They are product engineering thresholds, not platform requirements, and therefore remain assumptions until accepted. [ASSUMED]

| Setting | Recommendation | Rationale |
|---------|----------------|-----------|
| Metadata per conversation | 400 items (newest protected 40 + at most nine explicitly browsed 40-item pages) | Simple page-aligned bound; avoids evicting within a retained page. [ASSUMED] |
| Metadata per account | 2,000 items | Adds a global ceiling while allowing several active direct conversations. Evict inactive older pages before any active newest-40 window. [ASSUMED] |
| Thumbnail disk ceiling | 64 MiB per verified account | Small enough to remain disposable while retaining useful displayed context; evict LRU bytes first. [ASSUMED] |
| Thumbnail inactivity | 30 days since display | Reclaims least-recent displayed context without background downloading. [ASSUMED] |
| Older-page inactivity | 30 days since conversation gallery access | Retain newest 40 for active conversations; prune old browsed pages first. [ASSUMED] |
| Meaningful foreground | 5 minutes since last inactive/background transition | Avoids a refresh for brief system interruptions while making a real return fresh. [ASSUMED] |
| Trigger coalescing | 500 ms trailing window with one in-flight cycle per owner/conversation | Coalesces lifecycle, reconnect, and realtime bursts deterministically. [ASSUMED] |
| Automatic retry | One retry after 1 second plus injected deterministic 0–250 ms jitter | Short, testable backoff without a background loop; retry only if connectivity remains usable. [ASSUMED] |
| Signed URL freshness | Refresh when `expiresAt <= now + 120 seconds` | Existing URL lifetime is 15 minutes, so this leaves a bounded completion margin. [VERIFIED: codebase grep] [ASSUMED] |
| Visibility batch | Deduplicated visible + one-screen lookahead, chunked at 50; no second lookahead page | Matches the server limit and locked data-use behavior. [VERIFIED: codebase grep] [VERIFIED: 12-CONTEXT.md] |

## Architecture Patterns

### System Architecture Diagram

```text
Verified Supabase identity
          |
          v
Identity generation gate -------------------- account changes -------------------+
          |                                                                      |
          | exact owner match                                                    v
          v                                                          cancel old generation
Safe cached snapshot -> portable reducer -> gallery state             hide old state
          |                    ^                                      purge DB/files/memory/temp
          |                    |                                      verify purge
          v                    |                                      bind new owner
gallery open / meaningful foreground / reconnect                                  |
          |                                                                       |
          v                                                                       |
coalesced recovery cycle (one in flight per owner + conversation) <----------------+
          |
          +--> attempt 0 --> accepted RPC page/categories --> owner/request/cursor gate
          |                         |                         |
          |                         |                         +--> reject stale/mixed callbacks
          |                         v
          |               reducer merge + tombstones
          |                         |
          |                         v
          |               one native storage transaction
          |
          +--> failure + usable network --> 1s backoff --> attempt 1
          |                                                |
          |                                                +--> failure -> stale + manual retry
          |
          v
visibility planner (visible + one-screen lookahead, <= 50 IDs)
          |
          +--> constrained/Data Saver? yes -> visible only
          |
          v
authenticated signed-URL refresh (15-minute URLs)
          |
          v
owner-scoped memory registry (never persisted/logged)
          |
          +--> lookahead thumbnail bytes -> memory only
          +--> displayed thumbnail bytes -> bounded protected disk cache
          +--> selected item -> ephemeral full bytes / temp file only
```

This flow keeps local cache useful without making it an authorization source, and gives the planner explicit cancellation and persistence boundaries. [VERIFIED: 12-CONTEXT.md]

### Recommended Project Structure

```text
packages/core/src/shared-content/
├── types.ts                         # cache truth/recovery/snapshot contracts
├── state.ts                         # hydration, merge, retry-cycle reducer events
├── shared-content.test.ts           # canonical Node replay
└── fixtures/shared-content-vectors.json

apps/android/data/chat/src/main/kotlin/.../data/chat/
├── ChatRepository.kt                # provider-neutral shared-content methods
├── DefaultChatRepository.kt         # verified-owner orchestration and purge
├── NetworkMonitor.kt                # validated + metered + Data Saver policy snapshot
├── local/
│   ├── ChatEntities.kt              # metadata/page/cache-owner entities
│   ├── ChatDao.kt                   # transactional upsert/prune/purge
│   └── ChatDatabase.kt              # version 9 + MIGRATION_8_9
├── remote/SupabaseChatRemoteDataSource.kt
└── sharedcontent/                   # delivery registry + thumbnail store/coordinator

apps/android/feature/chat/src/main/kotlin/.../feature/chat/sharedcontent/
├── state/SharedContentState.kt      # strict native parity
└── SharedContentViewModel.kt        # lifecycle/visibility orchestration, no provider types

apps/ios/FishKit/Sources/ChatCore/SharedContent/
└── SharedContentState.swift         # strict native parity

apps/ios/FishKit/Sources/ChatData/
├── Providers/SharedContentProviding.swift
├── Models/SharedContentCache.xcdatamodeld
└── Adapters/
    ├── CoreDataSharedContentCache.swift
    ├── SupabaseSharedContentRepository.swift
    ├── SharedContentNetworkPolicy.swift
    └── SharedContentDeliveryStore.swift

apps/ios/FishKit/Sources/PersonalChat/
└── ViewModels/
    ├── SharedContentStore.swift      # lifecycle/retry/visibility coordinator
    └── MessageImageLoader.swift      # owner-scoped decode facade; no global unowned disk
```

The exact filenames are recommendations, but tier ownership must follow the existing ADR boundaries. [VERIFIED: ADR 0002] [VERIFIED: ADR 0005]

### Component Responsibilities

| Component | Responsibility | Must not own |
|-----------|----------------|--------------|
| Portable contract | Safe snapshot fields, cache truth, history boundary, recovery-cycle transitions, owner/generation checks, explicit vector outputs | Room/Core Data/Supabase/Android/iOS imports. [VERIFIED: codebase boundary tests] |
| Android `ChatRepository`/Room adapter | RPC decoding, database transaction, pruning, owner purge, network-policy flow, delivery memory, thumbnail namespace | Compose presentation or independent ordering semantics. [VERIFIED: ADR 0002] |
| Android shared-content ViewModel | Dispatch portable events, coalesce triggers, maintain visibility set, expose calm state | SQL, Supabase SDK, signed URL logging. [VERIFIED: ADR 0002] |
| iOS `ChatData` | Supabase RPC/Edge Function calls, Core Data cache, protected file store, NWPath policy, memory URL registry | SwiftUI or presentation copy. [VERIFIED: ADR 0005] |
| iOS `PersonalChat.SharedContentStore` | `@MainActor @Observable` orchestration, lifecycle triggers, retry state, visibility | Supabase/Core Data concrete types. [VERIFIED: ADR 0005] |
| Application identity coordinator | Revoke generation, stop gallery/media work, purge all layers, then attach new session | Displaying cache before verified identity or accepting callbacks from old owner. [VERIFIED: 12-CONTEXT.md] |

### Pattern 1: Allowlisted Snapshot + Transactional Replace/Merge

**What:** Convert accepted reducer output to a safe cache DTO and persist page rows, page boundary, cache metadata, and pruning decisions in one native transaction. [ASSUMED]

**When to use:** After an owner/request/cursor-accepted authoritative page or tombstone event, never directly from an unvalidated callback. [VERIFIED: codebase grep]

```kotlin
// Source: https://developer.android.com/training/data-storage/room/accessing-data
@Transaction
suspend fun replaceNewestAndPrune(
    ownerId: String,
    conversationId: String,
    items: List<SharedContentCacheEntity>,
    boundary: SharedContentBoundaryEntity,
    limits: SharedContentCacheLimits,
) {
    require(items.all { it.ownerId == ownerId && it.conversationId == conversationId })
    deleteNewestWindow(ownerId, conversationId)
    upsertSharedContent(items)
    upsertBoundary(boundary)
    pruneOlderBrowsedPages(ownerId, conversationId, limits.perConversationItems)
    pruneAccount(ownerId, limits.perAccountItems)
}
```

The iOS implementation should perform the same logical steps inside one private `NSManagedObjectContext.perform` + `save`, with a compound uniqueness constraint over owner, conversation, and item identity. [CITED: https://developer.apple.com/documentation/coredata/using-core-data-in-the-background]

### Pattern 2: One Recovery Cycle, Two Attempts

**What:** Coalesce triggers into a cycle token and permit attempts 0 and 1 only. All results carry owner, conversation, generation, cycle, and request/cursor identity. [ASSUMED]

**When to use:** Gallery open, meaningful foreground, reconnect; manual retry starts a new explicit cycle but does not unlock background retries. [VERIFIED: 12-CONTEXT.md]

```typescript
// Source: Phase 12 locked decisions and existing request-sequencing reducer. [ASSUMED]
async function recover(trigger: RecoveryTrigger) {
  const cycle = cycles.startOrJoin(ownerId, conversationId, trigger);
  if (!cycle.didStart) return;

  for (const attempt of [0, 1] as const) {
    if (!network.usable || !cycles.isCurrent(cycle)) return;
    if (attempt === 1) await clock.sleep(retryDelay(cycle));
    const result = await repository.refresh(cycle.request);
    if (!cycles.isCurrent(cycle)) return;
    if (result.ok) return acceptAuthoritative(result);
  }
  markCachedContentStaleAndOfferManualRetry();
}
```

Inject clock, jitter, and network policy so tests do not wait on wall time and can prove no third attempt. [ASSUMED]

### Pattern 3: Visible/Lookahead/Selected Fetch Classes

**What:** Treat fetch intent as a type, not a Boolean. `visible` may fetch thumbnail URL/bytes and persist only after display confirmation; `lookahead` may fetch thumbnail URL/bytes but cannot write disk; `selected` may fetch full bytes and owns temp cleanup. [ASSUMED]

**When to use:** Every delivery request. This prevents a later caller from accidentally persisting a preview or prefetch. [ASSUMED]

```swift
// Source: https://developer.apple.com/documentation/foundation/urlsession
enum SharedContentFetchIntent: Sendable {
    case visibleThumbnail
    case lookaheadThumbnail
    case selectedFullContent
}

let configuration = URLSessionConfiguration.ephemeral
configuration.urlCache = nil
configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
let deliverySession = URLSession(configuration: configuration)
```

On Android, set Coil `diskCachePolicy(DISABLED)` for lookahead and full-preview delivery, and use an opaque `memoryCacheKey`/`diskCacheKey` derived from owner fingerprint + conversation + item + immutable content version, never the signed URL. [CITED: https://coil-kt.github.io/coil/api/coil-core/coil3.request/-image-request/-builder/index.html]

### Pattern 4: Identity Generation Gate

**What:** Every async callback and cache/media handle belongs to an identity generation. Identity change increments the generation before cancellation and purge; stale generations cannot write or display even if OS/network cancellation is delayed. [ASSUMED]

**When to use:** Auth restore, sign-in, sign-out, token invalidation, and switching verified accounts. [VERIFIED: 12-CONTEXT.md]

The purge order is:

1. Set verified identity to unresolved for gallery purposes and increment generation. [ASSUMED]
2. Hide previous gallery state and cancel recovery, delivery, decode, and temp-file tasks. [ASSUMED]
3. Clear in-memory URL registries and decoded image caches. [ASSUMED]
4. Transactionally delete old-owner metadata and cache-owner markers. [ASSUMED]
5. Delete owner-scoped thumbnail and temporary roots, verify absence, and retry synchronous cleanup if needed. [ASSUMED]
6. Bind the new verified identity and only then hydrate or accept new-owner content. [VERIFIED: 12-CONTEXT.md]

If the process dies during file deletion, stale owner directories may remain physically but remain ineligible for display; the next verified-start sweep deletes every non-current owner namespace before hydration. [ASSUMED]

### Anti-Patterns to Avoid

- **Persisting the reducer state wholesale:** it contains delivery/temp references, pending requests, errors, and runtime-only authority. Persist a separate allowlist DTO. [VERIFIED: codebase grep]
- **One `isOnline` Boolean:** Android’s current monitor checks only `NET_CAPABILITY_INTERNET`, not validation/metering/Data Saver; iOS’s adapter checks only `NWPath.status`. Extend both to a policy snapshot. [VERIFIED: codebase grep] [CITED: https://developer.android.com/develop/connectivity/network-ops/reading-network-state]
- **Global media cache:** iOS `MessageImageLoader.shared` currently has one global disk root, and Android default image caching does not encode owner/conversation/display intent. Replace with owner-scoped controlled caches. [VERIFIED: codebase grep]
- **URL as cache key:** even a hashed filename can make lifecycle and invalidation depend on a rotating secret URL, and logging/debug descriptions can still expose the original. Use immutable opaque content identity. [ASSUMED]
- **Clearing cache after attaching the new owner:** this creates a race where old callbacks or files can enter new state. Revoke and purge first. [VERIFIED: 12-CONTEXT.md]
- **Deleting cached content at refresh start:** cached rows remain visible until accepted server/realtime results replace or tombstone them. [VERIFIED: 12-CONTEXT.md]
- **Treating offline/no-cache as empty:** `empty` needs a successful authoritative proof. [VERIFIED: 12-CONTEXT.md]
- **Retrying each trigger independently:** gallery-open, foreground, connectivity, and realtime can arrive together; coalesce them into one cycle. [VERIFIED: 12-CONTEXT.md]
- **Using WorkManager/background URLSession for this recovery loop:** it broadens the locked lifecycle and risks repeated hidden retries. [VERIFIED: 12-CONTEXT.md]
- **Persisting lookahead or full media:** lookahead is memory-only unless confirmed displayed; full media and temp artifacts are ephemeral. [VERIFIED: 12-CONTEXT.md]
- **Local authorization from cached `canDelete`/membership:** RLS and current server results remain authoritative. [VERIFIED: 12-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Android relational cache | Ad-hoc files or manual SQLiteOpenHelper | Existing Room 2.8.4 | Transactions, migrations, query validation, exported schemas, and migration testing already exist. [CITED: https://developer.android.com/training/data-storage/room] |
| iOS relational cache | Homegrown SQL wrapper or multi-file JSON database | Core Data local SQLite store | Native transactions, fetch sorting, migrations, batch operations, and file-protection options. [CITED: https://developer.apple.com/documentation/coredata/] |
| Connectivity polling | Timers repeatedly checking endpoints | `ConnectivityManager.NetworkCallback` and `NWPathMonitor` | Both platforms expose network-change streams and policy properties. [CITED: https://developer.android.com/develop/connectivity/network-ops/reading-network-state] [CITED: https://developer.apple.com/documentation/network/nwpathmonitor] |
| Signed URL lifecycle | Persisted URL table or URL-derived durable cache | In-memory expiry registry + existing refresh Edge Function | URLs are short-lived and existing server code already caps and authenticates refresh. [VERIFIED: codebase grep] |
| Cross-platform semantics | Separate Kotlin/Swift retry and cache rules | TypeScript-owned explicit vectors replayed natively | The project already uses this pattern and Phase 11 parity tests pass. [VERIFIED: codebase command] |
| Backup exclusion | A custom restore detector | Android backup/data-extraction rules and system cache/no-backup roots; iOS cache directory plus exclusion flag | Platform mechanisms define backup/device-transfer behavior. [CITED: https://developer.android.com/identity/data/autobackup] [CITED: https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup] |
| Retry scheduler | Generic infinite exponential retry service | Small injected two-attempt recovery state machine | Exactly one retry is a locked product rule. [VERIFIED: 12-CONTEXT.md] |
| Secret-safe diagnostics | String scrubbing after logging | Structured operation/outcome/duration/failure-category diagnostics | Existing project pattern never accepts URL/path/content fields. [VERIFIED: codebase grep] |

**Key insight:** The hard part is not storing rows; it is making every durable and asynchronous object prove its owner, conversation, authority level, and lifecycle intent. Platform databases and caches handle storage mechanics, while the portable contract must handle truth and acceptance. [ASSUMED]

## Common Pitfalls

### Pitfall 1: Cache truth collapses into one status

**What goes wrong:** A stale cache with an evicted history tail can only be labeled `stale` or `incomplete`, so the UI lies by omission. [ASSUMED]  
**Why it happens:** The existing single status enum predates durable cache provenance. [VERIFIED: codebase grep]  
**How to avoid:** Model source/staleness and retained-history completeness orthogonally; derive the gallery notice and boundary copy separately. [VERIFIED: 12-CONTEXT.md]  
**Warning signs:** Tests assert only one enum value and never combine stale + partial. [ASSUMED]

### Pitfall 2: Accepted server merge is persisted in multiple steps

**What goes wrong:** A crash between item upsert, tombstone removal, boundary update, and pruning produces duplicate or falsely complete history. [ASSUMED]  
**Why it happens:** Repository methods mirror API calls instead of one cache transaction. [ASSUMED]  
**How to avoid:** Perform owner validation, accepted-page merge, tombstone removal, page metadata update, and eviction in one Room/Core Data transaction. [ASSUMED]  
**Warning signs:** Separate `saveItems`, `saveCursor`, and `prune` calls without a transaction. [ASSUMED]

### Pitfall 3: Connectivity is “internet capability,” not usable internet

**What goes wrong:** Captive portals or unvalidated networks trigger retry and consume the single allowed automatic attempt. [CITED: https://developer.android.com/develop/connectivity/network-ops/reading-network-state]  
**Why it happens:** Android’s current helper checks `NET_CAPABILITY_INTERNET` only; iOS `satisfied` still does not prove the endpoint succeeds. [VERIFIED: codebase grep]  
**How to avoid:** Require Android `NET_CAPABILITY_VALIDATED`; use iOS `NWPath.status == .satisfied` as a scheduling hint, while treating actual request success as authority. [CITED: https://developer.android.com/develop/connectivity/network-ops/reading-network-state] [ASSUMED]  
**Warning signs:** Retry starts on `onAvailable` before `onCapabilitiesChanged`, or network state is a Boolean with no constrained flag. [ASSUMED]

### Pitfall 4: Data-saving mode pauses all images

**What goes wrong:** Visible content becomes unavailable even though D-14 allows necessary visible thumbnails. [VERIFIED: 12-CONTEXT.md]  
**Why it happens:** “Constrained” is treated as “offline.” [ASSUMED]  
**How to avoid:** Separate `usable` from `lookaheadAllowed`; Data Saver/Low Data Mode disables lookahead, not interactive visible thumbnails. [VERIFIED: 12-CONTEXT.md]  
**Warning signs:** One network flag gates both visible and prefetch requests. [ASSUMED]

### Pitfall 5: Signed URL leaks through indirect persistence

**What goes wrong:** The URL is absent from the metadata table but appears in HTTP cache, Coil key/journal, error descriptions, test snapshots, request logs, or debug analytics. [ASSUMED]  
**Why it happens:** Teams inspect only explicit database fields. [ASSUMED]  
**How to avoid:** Ephemeral/no-response-cache sessions, opaque content keys, structured diagnostics with no arbitrary strings, fixture URLs clearly fake, and tests that search DB/files/log events for URL/token substrings. [CITED: https://developer.apple.com/documentation/foundation/urlsessionconfiguration/urlcache] [ASSUMED]  
**Warning signs:** Any diagnostic API accepts a URL/string payload or disk filename changes when token changes. [ASSUMED]

### Pitfall 6: Lookahead becomes durable

**What goes wrong:** Prefetched thumbnails write to disk before display, expanding private footprint and violating D-03. [VERIFIED: 12-CONTEXT.md]  
**Why it happens:** Default image loaders combine network and disk cache behavior. [ASSUMED]  
**How to avoid:** Fetch intent controls cache policy; lookahead disables disk, and a display-confirmation event performs the controlled durable write. [ASSUMED]  
**Warning signs:** Prefetch tests find a file before the item is rendered. [ASSUMED]

### Pitfall 7: Sign-out cleanup is narrower than identity change

**What goes wrong:** Token restoration, account replacement, or invalidation bypasses the logout button and leaves old cache eligible. [ASSUMED]  
**Why it happens:** Cleanup is wired only to a user action. [ASSUMED]  
**How to avoid:** Drive the purge from verified identity transitions, including missing/unresolved identity, and make button sign-out only one producer. [VERIFIED: 12-CONTEXT.md]  
**Warning signs:** Tests cover `signOut()` but not A→B, A→nil, unresolved→B, or stale A callback after B. [ASSUMED]

### Pitfall 8: iOS “Caches is purgeable” is mistaken for complete privacy

**What goes wrong:** The OS may purge thumbnails, but metadata or files in Application Support can still be backed up or accessible with weaker protection. [CITED: https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup]  
**Why it happens:** Purgeability, backup exclusion, and file protection are different controls. [ASSUMED]  
**How to avoid:** Set Core Data store file protection, exclude its directory from backup after saves/moves that can reset resource values, use Caches/tmp for purgeable media, and still perform identity purge. [CITED: https://developer.apple.com/documentation/coredata/nspersistentstorefileprotectionkey] [CITED: https://developer.apple.com/documentation/foundation/urlresourcevalues/isexcludedfrombackup]  
**Warning signs:** Only `cachesDirectory` is asserted, with no owner purge or protection check. [ASSUMED]

### Pitfall 9: Eviction removes the newest window

**What goes wrong:** A global byte/item cleanup deletes the newest 40 and leaves only old explicitly browsed pages. [ASSUMED]  
**Why it happens:** A simple LRU does not encode protected newest-window priority. [ASSUMED]  
**How to avoid:** Eviction tiers are fixed: expired temp/full bytes → non-displayed/lookahead memory → least-recent thumbnails → inactive older pages → account cap, while newest 40 of active conversations are protected. [VERIFIED: 12-CONTEXT.md]  
**Warning signs:** One `ORDER BY last_accessed LIMIT` delete query spans all metadata rows. [ASSUMED]

### Pitfall 10: A refresh failure blanks useful cache

**What goes wrong:** The reducer enters terminal error and drops items after the second failure. [ASSUMED]  
**Why it happens:** Network request lifecycle owns screen content rather than only freshness truth. [ASSUMED]  
**How to avoid:** Keep items; set stale/manual-retry truth. Only no-cache + offline is unavailable. [VERIFIED: 12-CONTEXT.md]  
**Warning signs:** Failure handlers call `createSharedContentState` or clear pages. [ASSUMED]

## Code Examples

Verified platform patterns and project-specific recommendations:

### Android network policy snapshot

```kotlin
// Sources:
// https://developer.android.com/develop/connectivity/network-ops/reading-network-state
// https://developer.android.com/develop/connectivity/network-ops/data-saver
data class SharedContentNetworkPolicy(
    val usable: Boolean,
    val metered: Boolean,
    val dataSaverEnabled: Boolean,
) {
    val lookaheadAllowed: Boolean
        get() = usable && !dataSaverEnabled
}

fun NetworkCapabilities.toPolicy(restrictBackgroundStatus: Int) =
    SharedContentNetworkPolicy(
        usable = hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED),
        metered = !hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED),
        dataSaverEnabled =
            restrictBackgroundStatus == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED,
    )
```

### iOS Low Data Mode without blocking visible content

```swift
// Source: https://developer.apple.com/documentation/network/nwpath
struct SharedContentNetworkPolicy: Sendable, Equatable {
    let usable: Bool
    let constrained: Bool
    let expensive: Bool

    var lookaheadAllowed: Bool { usable && !constrained }
}

func policy(for path: NWPath) -> SharedContentNetworkPolicy {
    .init(
        usable: path.status == .satisfied,
        constrained: path.isConstrained,
        expensive: path.isExpensive
    )
}
```

### Signed URL registry freshness

```swift
// Source: existing 15-minute Edge Function response and Phase 12 decision. [ASSUMED]
struct DeliveryLease: Sendable {
    let thumbnailURL: URL?
    let displayURL: URL?
    let expiresAt: Date

    func isFresh(now: Date, margin: TimeInterval = 120) -> Bool {
        expiresAt.timeIntervalSince(now) > margin
    }
}
```

The lease lives only in an actor/in-memory map keyed by owner generation + conversation + attachment ID and is cleared on background memory pressure, identity change, or expiry. [ASSUMED]

### iOS backup exclusion and protection

```swift
// Sources:
// https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup
// https://developer.apple.com/documentation/coredata/nspersistentstorefileprotectionkey
let description = NSPersistentStoreDescription(url: storeURL)
description.setOption(
    FileProtectionType.complete as NSObject,
    forKey: NSPersistentStoreFileProtectionKey
)

var values = URLResourceValues()
values.isExcludedFromBackup = true
var directory = storeDirectory
try directory.setResourceValues(values)
```

### Bounded batching

```typescript
// Source: existing Edge Function cap and PAGE-03. [VERIFIED: codebase grep]
function batchesOfAtMost50(ids: string[]): string[][] {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let index = 0; index < unique.length; index += 50) {
    batches.push(unique.slice(index, index + 50));
  }
  return batches;
}
```

The caller must derive `ids` only from visible + one-screen lookahead or explicit selection, not from all loaded metadata. [VERIFIED: 12-CONTEXT.md]

## State of the Art

| Old / unsafe approach | Current recommended approach | When / evidence | Impact |
|-----------------------|------------------------------|-----------------|--------|
| Connectivity = interface present | Android validated capability + Data Saver/metering; iOS satisfied path + constrained/expensive properties | Current official platform docs. [CITED: https://developer.android.com/develop/connectivity/network-ops/reading-network-state] [CITED: https://developer.apple.com/documentation/network/nwpath] | Prevents captive-portal retries and enables automatic lookahead suppression. |
| Default/global media disk cache | Owner-scoped, intent-aware disk policy with opaque keys | Phase 12 locked privacy/display-only decisions. [VERIFIED: 12-CONTEXT.md] | Stops cross-account persistence and lookahead/full-preview leakage. |
| Default URL session/shared HTTP cache | Ephemeral session with `urlCache = nil` for signed delivery | Current Foundation docs. [CITED: https://developer.apple.com/documentation/foundation/urlsessionconfiguration/urlcache] | Prevents signed responses and credentials from reaching disk caches. |
| One combined offline/error status | Orthogonal cache source, staleness, boundary completeness, and recovery phase | Phase 12 truth requirements. [VERIFIED: 12-CONTEXT.md] | Can truthfully express cached + stale + incomplete simultaneously. |
| Logout-button cleanup | Verified-identity generation transition | Phase 11/12 ownership boundary. [VERIFIED: codebase grep] | Covers session restore, account switch, expiry, and stale callbacks. |
| Separate platform expectations | One explicit TypeScript-owned JSON corpus replayed by Kotlin and Swift | Established Phase 11 contract. [VERIFIED: codebase grep] | Makes parity testable and prevents “equivalent” behavior from drifting. |

**Deprecated/outdated for this phase:**

- Treating `NET_CAPABILITY_INTERNET` alone as usable connectivity is insufficient; add `NET_CAPABILITY_VALIDATED`. [CITED: https://developer.android.com/develop/connectivity/network-ops/reading-network-state]
- Using `URLSession.shared` for signed delivery is inappropriate because it does not expose the required no-disk-cache configuration. [CITED: https://developer.apple.com/documentation/foundation/urlsession]
- Keeping `MessageImageLoader.shared` as an unowned global disk cache conflicts with the locked identity purge and displayed-thumbnail-only rules. [VERIFIED: codebase grep]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Metadata caps are 400 per conversation and 2,000 per account. | Recommended Discretion Values | Too small causes frequent history boundary notices; too large expands private footprint. |
| A2 | Thumbnail cap is 64 MiB/account with 30-day inactivity; older pages also expire after 30 days. | Recommended Discretion Values | Device/cache behavior may need tuning from real usage and Phase 15 performance evidence. |
| A3 | Meaningful foreground is five minutes; trigger coalescing is 500 ms. | Recommended Discretion Values | A shorter interval wastes traffic; a longer one leaves content stale. |
| A4 | Retry delay is one second plus deterministic 0–250 ms jitter. | Recommended Discretion Values | Product may prefer a different perceived recovery pace. |
| A5 | Refresh signed URLs within two minutes of expiry. | Recommended Discretion Values | Slow transfers could require a wider margin; overly wide refreshes waste function calls. |
| A6 | Core Data is the preferred iOS persistence mechanism over SwiftData/flat files/new package. | Standard Stack | SwiftData may be preferred by maintainers, but must still satisfy explicit protection, purge, migration, and transactional tests. |
| A7 | Cache truth needs orthogonal source/stale/boundary fields rather than only the existing status enum. | Recommended Contract Shape | Without this, combined stale+incomplete truth becomes ambiguous. |
| A8 | Cached capabilities may be stored but never used for offline authorization. | Recommended Contract Shape | If Phase 14 requires different offline action presentation, the safe snapshot may need to omit them entirely. |
| A9 | Identity cleanup verifies file deletion before accepting the new owner, while crash leftovers stay hidden and are swept on next verified start. | Identity Generation Gate | Strict blocking could affect sign-in if the filesystem is unhealthy; weakening it risks privacy. |

## Open Questions (RESOLVED)

1. **Numeric bounds — resolved: accept A1–A5 as shared Phase 12 constants.**
   - Metadata is capped at 400 items per conversation and 2,000 per account; the newest 40 stay protected. Displayed thumbnails are capped at 64 MiB per verified account. Thumbnails and older browsed pages become eviction candidates after 30 days of inactivity. Meaningful foreground is five minutes, trigger coalescing is 500 ms, retry is one second plus deterministic 0–250 ms jitter, and delivery refresh begins within 120 seconds of expiry.
   - Rationale: `12-CONTEXT.md` delegates these thresholds to the agent while requiring measurable cross-platform bounds that preserve newest active-conversation metadata. The values align to the shipped 40-item page and 15-minute delivery lifetime, and are deterministic internal constants—not settings. Phase 15 may measure them, but Phase 12 implements them completely.

2. **Cached capability fields — resolved: omit them from the durable snapshot.**
   - `SharedContentCachedSnapshot` persists safe descriptive/order/source metadata and retained-history truth only. It omits `capabilities`, membership, `canDelete`, `canExport`, and all action-authority fields. Hydration exposes actions as unavailable until a current authoritative result confirms them.
   - Rationale: D-19 keeps Supabase/RLS authoritative, D-17 requires exact verified-owner eligibility, and Phase 14 owns actions. Phase 13 needs no offline authorization fields. Omission removes elevation ambiguity and matches the provider-neutral privacy boundary.

3. **Hard filesystem purge failure — resolved: fail closed for gallery eligibility without blocking unrelated sign-in.**
   - The coordinator publishes unresolved, revokes the old generation, and runs ordered purge. If any database/filesystem/runtime absence probe fails, shared-content state becomes `unavailable`; neither old nor new gallery data binds. Other authenticated surfaces continue. Cleanup retries on the next verified start or meaningful foreground, and leftovers remain ineligible until every zero probe succeeds.
   - Rationale: D-18 requires purge before new-owner acceptance, while D-17/D-19 forbid local leftovers from granting access. Platform deletion can fail independently of authentication, so coupling the whole session to disposable cache health is unnecessary. The approved UI contract already defines calm nontechnical unavailable copy if a later gallery opens.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | fixture/test scripts | ✓ | 25.9.0 | — [VERIFIED: local command] |
| pnpm | workspace commands | ✓ | 11.7.0 | none; pnpm is required. [VERIFIED: local command] |
| Android Studio JBR | Android Gradle build | ✓ through `scripts/android-gradle.sh` | OpenJDK 21.0.10 | Script discovers Android Studio JBR even though shell `java` is unset. [VERIFIED: local command] |
| Gradle wrapper | Android tests/build | ✓ | 9.4.1 | — [VERIFIED: local command] |
| Android SDK / adb | instrumented migration and backup tests | ✓ | adb 1.0.41 | Start an emulator/device before connected tests. [VERIFIED: local command] |
| Xcode | iOS simulator tests/build | ✓ | 26.6 (17F113) | — [VERIFIED: local command] |
| Swift | Swift package compilation | ✓ | 6.3.3 toolchain; package language mode Swift 6 | — [VERIFIED: local command] |
| iPhone 17 Pro simulator | authoritative FishKit package tests | ✓ | available, initially shutdown | Xcode boots it automatically. [VERIFIED: local command] |
| Supabase CLI | local contract integration | ✓ | 2.109.0 | Hosted/linked verification remains later release evidence. [VERIFIED: local command] |

**Missing dependencies with no fallback:** none. [VERIFIED: local command]

**Missing dependencies with fallback:** shell `java` is not configured, but the repository wrapper locates Android Studio JBR successfully. Use `scripts/android-gradle.sh`, not direct `apps/android/gradlew`, in plans. [VERIFIED: local command]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Portable TypeScript | Node built-in test runner; current quick command `node --test packages/core/src/shared-content/shared-content.test.ts` passed 7/7 on 2026-07-23. [VERIFIED: local command] |
| Android unit | JUnit 4 + kotlinx-coroutines-test; current parity command `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests 'space.fishhub.android.feature.chat.sharedcontent.SharedContentParityTest'` passed on 2026-07-23. [VERIFIED: local command] |
| Android database | AndroidX Room migration/instrumented tests in `:data:chat`; schema JSON 1–8 is committed. [VERIFIED: codebase grep] |
| iOS unit | Swift Testing/XCTest through `FishKit-Package`; targeted SharedContentContractTests passed on iPhone 17 Pro simulator on 2026-07-23. [VERIFIED: local command] |
| Full Android | `pnpm android:check` plus `pnpm android:instrumented`. [VERIFIED: package.json] |
| Full iOS | `pnpm ios:chat-vectors:check && pnpm ios:test && pnpm ios:app:build`. [VERIFIED: package.json] |
| Repository gate | `pnpm lint && pnpm typecheck && pnpm build`. [VERIFIED: AGENTS.md] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRIV-02 | URL freshness, memory-only registry, no URL/token in DB/files/diagnostics, cache key stable across token rotation | portable + native unit + filesystem inspection | `node --test packages/core/src/shared-content/shared-content.test.ts` plus platform targeted tests | ❌ Wave 0 extensions/new adapter tests |
| PRIV-03 | A→B, A→nil, unresolved identity, purge every layer, stale A callback rejection, crash-leftover sweep | portable parity + native integration | Android shared-content unit/data tests; iOS ChatData/PersonalChat tests | ❌ Wave 0 |
| PAGE-03 | Visible/lookahead/selected intent, dedupe/chunk <=50, data-saving pauses lookahead, displayed-only persistence | portable parity + native unit | platform targeted shared-content tests | ❌ Wave 0 |
| OFF-01 | verified cache hydration, stale+incomplete combined truth, offline no-cache unavailable, authoritative empty only | portable parity + repository integration | Node + Android parity + iOS contract | ⚠️ Existing status vocabulary; new vectors/files required |
| OFF-02 | accepted additions/deletions converge, no duplicates, trigger coalescing, exactly two attempts, manual retry, new-cycle reset | portable parity + coordinator unit | Node + Android ViewModel + iOS SharedContentStore tests | ⚠️ Phase 11 merge exists; recovery tests required |

### Required Test Scenarios

- Cache hydration is rejected for wrong, missing, or unresolved owner before any row becomes observable. [VERIFIED: 12-CONTEXT.md]
- The safe snapshot round-trip contains no delivery URL, token, runtime reference, pending request, or error field. [ASSUMED]
- A cache can be simultaneously stale and incomplete; no-cache/offline is unavailable; only successful authoritative zero rows is empty. [VERIFIED: 12-CONTEXT.md]
- Page merge, realtime addition, tombstone deletion, repeated page, stale completion, and repeated tombstone remain duplicate-free and tombstone-wins. [VERIFIED: codebase grep]
- Trigger bursts join one cycle; first failure makes exactly one delayed retry; second failure enables manual retry; connectivity loss cancels retry; a genuinely new trigger resets the allowance. [VERIFIED: 12-CONTEXT.md]
- Batch sizes are 1, 49, 50, 51, duplicates, and mixed visible/lookahead; no emitted batch exceeds 50. [VERIFIED: codebase grep]
- Data Saver/Low Data Mode permits visible thumbnail intent, suppresses lookahead, and adds no setting. [VERIFIED: 12-CONTEXT.md]
- Lookahead download leaves no disk file; display confirmation creates one; full content never enters thumbnail disk; all use opaque keys. [VERIFIED: 12-CONTEXT.md]
- Token rotation returns the same media cache identity; expiry margin refreshes only when needed; a 401/403 refresh does not loop. [VERIFIED: codebase grep] [ASSUMED]
- Identity purge removes Room/Core Data rows, thumbnail disk, URL leases, decoded memory, in-flight tasks, and temp artifacts before B content is accepted. [VERIFIED: 12-CONTEXT.md]
- Android migration 8→9 validates schema and preserves unrelated chat data; backup rules still exclude cloud and device transfer. [VERIFIED: codebase grep]
- iOS Core Data store and cache roots are backup excluded and protected; sign-out/account switch calls the unified purge path, unlike the current image-loader gap. [VERIFIED: codebase grep]

### Sampling Rate

- **Per portable-contract task:** `node --test packages/core/src/shared-content/shared-content.test.ts`
- **Per Android feature task:** `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContent*'`
- **Per Android data task:** `scripts/android-gradle.sh :data:chat:testDebugUnitTest` and the focused connected Room test when schema/files change.
- **Per iOS core/data task:** targeted `xcodebuild test ... -only-testing:ChatCoreTests/SharedContentContractTests` or the new `ChatDataTests` suite.
- **Per wave merge:** `pnpm ios:chat-vectors:check && pnpm android:test && pnpm ios:test`
- **Phase gate:** `pnpm lint && pnpm typecheck && pnpm build && pnpm android:check && pnpm android:instrumented && pnpm ios:test && pnpm ios:app:build`

### Wave 0 Gaps

- [ ] Extend `packages/core/src/shared-content/fixtures/shared-content-vectors.json` and strict Node projections for cache hydration, stale+incomplete truth, eviction priority, recovery attempt/reset, visibility batches, data-saving behavior, URL non-persistence, and identity purge.
- [ ] Extend Android `SharedContentParityTest.kt` decoders/projections and iOS `SharedContentVectors.swift`/`SharedContentContractTests.swift`; sync iOS bytes through `pnpm ios:chat-vectors`.
- [ ] Add Android Room cache DAO/entity tests and migration 8→9 instrumented coverage.
- [ ] Add Android recovery coordinator/network-policy/thumbnail-intent tests.
- [ ] Add iOS Core Data cache, backup/protection, network policy, delivery registry, `SharedContentStore`, and identity-purge tests.
- [ ] Extend `MessageImageLoaderTests.swift` to prove displayed-only persistence, owner scoping, full-preview exclusion, and sign-out/account-switch purge.
- [ ] Add a structural secret-leak test that scans cache DB rows/files/diagnostic event projections for fake signed URL/token sentinels.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Hydrate only after Supabase returns a verified user identity; missing/unresolved identity reveals no cache. [VERIFIED: 12-CONTEXT.md] |
| V3 Session Management | yes | Bind all repository/recovery/delivery work to auth session identity generation; revoke on sign-out/account change/token invalidation. [ASSUMED] |
| V4 Access Control | yes | Existing Postgres RLS/RPC membership checks remain authoritative; cached membership/capabilities never authorize. [VERIFIED: codebase grep] [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |
| V5 Input Validation | yes | Strict DTO decoding, owner/conversation/request/cursor equality, canonical item ordering, batch <=50, HTTPS/allowed-host checks, and safe file-root containment. [VERIFIED: codebase grep] |
| V6 Cryptography | yes | Use platform TLS and file protection; use SHA-256 only for opaque cache names, not authorization or custom encryption. [VERIFIED: codebase grep] [CITED: https://developer.apple.com/documentation/foundation/fileprotectiontype] |

### Known Threat Patterns for Native Gallery Cache

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-account cache disclosure | Information disclosure / elevation | Exact verified-owner gate, generation cancellation, owner in every key, purge-before-bind, stale-owner sweep. [VERIFIED: 12-CONTEXT.md] |
| Signed URL persistence or logging | Information disclosure | Memory-only lease actor/map, ephemeral/no-cache HTTP, opaque cache keys, structured redacted diagnostics, secret-sentinel tests. [ASSUMED] |
| Mixed-conversation payload/cache poisoning | Tampering | Whole-event owner/conversation validation before reducer and storage transaction. [VERIFIED: codebase grep] |
| Stale callback resurrection after tombstone or identity change | Tampering / information disclosure | Tombstone-wins reducer plus request/cursor/cycle/identity-generation match. [VERIFIED: codebase grep] |
| Unbounded metadata/thumbnail growth | Denial of service | Per-conversation/account item caps, byte ceiling, inactivity pruning, batch <=50, one-screen lookahead. [VERIFIED: 12-CONTEXT.md] |
| Retry storm from lifecycle/realtime/connectivity bursts | Denial of service | 500 ms coalescing assumption, one in-flight cycle, exactly one retry, explicit new-cycle reset. [VERIFIED: 12-CONTEXT.md] |
| Path traversal or deletion outside cache root | Tampering | Generated opaque filenames and standardized-path containment before remove/write; never derive raw paths from server names. [VERIFIED: existing staging pattern] |
| Backup/device migration crosses identities | Information disclosure | Existing Android all-root backup/device-transfer exclusion; iOS Caches/tmp plus explicit exclusion and post-restore identity verification. [VERIFIED: codebase grep] [CITED: https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup] |
| Cached authority survives membership loss | Elevation | Refresh on open/foreground/reconnect, apply authoritative denial by purging conversation state, disable privileged offline actions. [VERIFIED: 12-CONTEXT.md] |

### Security Verification Gates

- Static scan: no shared-content persistent schema contains URL/lease/token fields; no diagnostics type accepts URL, storage path, or content bytes. [ASSUMED]
- Dynamic secret sentinel: inject a recognizable fake signed token, perform refresh/display/retry/purge, then scan Room/Core Data, cache filenames/bytes, temp roots, and captured diagnostic projections; sentinel count must be zero outside live in-memory test probes. [ASSUMED]
- Identity adversary matrix: A cache cannot be read by B, signed-out, unresolved, another conversation, or a stale A task after B binds. [VERIFIED: 12-CONTEXT.md]
- Authority loss: 403/membership loss removes or makes the conversation cache ineligible and never falls back to local membership. [VERIFIED: 12-CONTEXT.md]

## Planning Guidance

Recommended plan waves. [ASSUMED]

1. **Portable contract and explicit fixtures:** safe snapshot/cache/recovery types, orthogonal truth, reducer events, retry/batch/identity vectors, strict TypeScript tests, Android/iOS decoder failures first. [VERIFIED: established project pattern]
2. **Android storage and transport:** Room entities/DAO/migration 8→9, RPC/category/delivery adapters, richer network policy, owner-scoped thumbnail store, repository transaction/purge tests. [VERIFIED: codebase architecture]
3. **iOS storage and transport:** Core Data model/store protection, provider protocols/adapters, ephemeral delivery, richer NWPath policy, owner-scoped thumbnail store, adapter tests. [CITED: https://developer.apple.com/documentation/coredata/]
4. **Cross-platform recovery orchestration:** Android ViewModel and iOS `SharedContentStore`, lifecycle/reconnect coalescing, two-attempt state machine, visibility batching, data-saving policy, strict parity replay. [VERIFIED: 12-CONTEXT.md]
5. **Identity and media teardown integration:** Android application/repository and iOS `FishAppModel` attach/sign-out transitions, replace global iOS cache ownership, purge all layers, secret-sentinel and adversarial tests. [VERIFIED: codebase grep]
6. **Full verification:** vector byte sync, Room migration device test, targeted simulator tests, Android/iOS full gates, repository build/lint/typecheck. [VERIFIED: package.json]

Do not plan Phase 13 gallery navigation/screens or Phase 14 preview/export/source/deletion UI here. Phase 12 may expose provider-neutral state and a single calm manual-retry action contract, but presentation remains downstream. [VERIFIED: 12-CONTEXT.md]

## Sources

### Primary (HIGH confidence)

- `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, Phase 12 context, requirements, roadmap, project/state files — locked product, scope, architecture, and UX constraints. [VERIFIED: codebase read]
- `packages/core/src/shared-content/*`, Android native shared-content/Room/network/repository code, iOS ChatCore/ChatData/PersonalChat/App code, manifests and tests — current implementation seams and gaps. [VERIFIED: codebase grep]
- `supabase/functions/chat-image-command/index.ts` — existing 50-ID cap and 15-minute signed URL expiry. [VERIFIED: codebase grep]
- Local validation on 2026-07-23 — Node shared-content 7/7, Android SharedContentParityTest, and iOS simulator SharedContentContractTests passed. [VERIFIED: local command]

### Secondary (MEDIUM confidence)

- https://developer.android.com/training/data-storage/room — Room as native structured local persistence.
- https://developer.android.com/training/data-storage/room/migrating-db-versions — schema export and migration testing.
- https://developer.android.com/training/data-storage/room/testing-db — device-side database test guidance.
- https://developer.android.com/develop/connectivity/network-ops/reading-network-state — validated connectivity and callbacks.
- https://developer.android.com/develop/connectivity/network-ops/data-saver — metering and Data Saver state.
- https://developer.android.com/identity/data/autobackup — cloud/device-transfer rules and always-excluded directories.
- https://coil-kt.github.io/coil/api/coil-core/coil3.request/-options/index.html — per-request cache policies.
- https://developer.apple.com/documentation/coredata/ — local caching, background work, migration, batch operations.
- https://developer.apple.com/documentation/coredata/nspersistentstorefileprotectionkey — Core Data store protection.
- https://developer.apple.com/documentation/foundation/urlsession — ephemeral session persistence behavior.
- https://developer.apple.com/documentation/foundation/urlsessionconfiguration/urlcache — disabling URL caching.
- https://developer.apple.com/documentation/network/nwpath — Low Data Mode/constrained and expensive paths.
- https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup — cache directories and exclusion.
- https://developer.apple.com/documentation/foundation/urlresourcevalues/isexcludedfrombackup — backup exclusion resource value.
- https://supabase.com/docs/guides/database/postgres/row-level-security — RLS authority.
- https://supabase.com/docs/reference/kotlin/v2/rpc and https://supabase.com/docs/reference/swift/v1/rpc — native RPC calls.
- https://supabase.com/docs/reference/kotlin/functions-invoke and https://supabase.com/docs/reference/swift/v1/functions-invoke — authenticated native Edge Function invocation.

### Tertiary (LOW confidence)

- Exact cache ceilings, inactivity window, foreground interval, coalescing, retry delay/jitter, freshness margin, Core Data preference over SwiftData, and purge-failure UX are research recommendations tagged `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for what is installed and project boundaries; MEDIUM for official platform API recommendations. [VERIFIED: codebase read] [CITED: https://developer.android.com/training/data-storage/room] [CITED: https://developer.apple.com/documentation/coredata/]
- Architecture: HIGH because the repository ADRs and Phase 11 seams are explicit; MEDIUM for proposed new filenames/Core Data implementation details. [VERIFIED: codebase read] [ASSUMED]
- Pitfalls: HIGH for observed global-cache/connectivity/status gaps; MEDIUM for platform mitigations; LOW for numeric tuning. [VERIFIED: codebase read] [CITED: https://developer.android.com/develop/connectivity/network-ops/reading-network-state] [CITED: https://developer.apple.com/documentation/network/nwpath] [ASSUMED]
- Security: HIGH for locked owner/RLS/URL rules and observed code; MEDIUM for proposed purge and secret-sentinel implementation. [VERIFIED: codebase read] [ASSUMED]

**Research date:** 2026-07-23. [VERIFIED: local date]  
**Valid until:** 2026-08-22 for stable project/platform architecture; revisit numeric bounds after Phase 15 device evidence. [ASSUMED]
