# Phase 12: Cross-platform data, cache, and recovery - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the Android and iOS direct-chat apps a private, bounded, account-and-conversation-scoped shared-content data layer that remains useful offline and converges safely after reconnect. This phase owns persisted gallery metadata, displayed-thumbnail caching, honest cached/incomplete/unavailable/stale state, short-lived delivery access, bounded visible-item fetching, refresh/retry behavior, and complete identity-change cleanup. It does not add gallery navigation or browsing UI (Phase 13), native preview/export/source/deletion flows (Phase 14), new sending pipelines, or any global/mobile-dashboard surface.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase scope
- `AGENTS.md` — Native direct-chat-only boundary, Supabase authority, calm recovery language, and non-negotiable product constraints.
- `.planning/ROADMAP.md` — Phase 12 goal, dependency, success criteria, and boundary from later gallery phases.
- `.planning/REQUIREMENTS.md` — Normative PRIV-02, PRIV-03, PAGE-03, OFF-01, and OFF-02 requirements plus durable scope exclusions.
- `.planning/PROJECT.md` — Milestone context and durable cross-platform chat/cache decisions.
- `.planning/STATE.md` — Current milestone state, Phase 11 carry-forward decisions, and later release-gate concerns.

### Upstream shared-content contract
- `.planning/phases/11-shared-content-contract-and-privacy-boundary/11-CONTEXT.md` — Locked server ordering, 40+1 paging, conversation ownership, tombstone, identity purge, and parity decisions that Phase 12 must preserve.

### Native architecture
- `docs/adr/0001-android-personal-chat-architecture.md` — Android Room-as-cache, repository boundary, offline reading, RLS authority, and redacted diagnostics.
- `docs/adr/0002-consolidate-android-chat-modules.md` — Current Android ownership: data contracts and Room in `:data:chat`, feature state and reducer parity in `:feature:chat`.
- `docs/adr/0005-ios-chatcore-chatdata-split.md` — iOS separation of pure `ChatCore` state from `ChatData` ports/adapters and `PersonalChat` orchestration.
- `docs/adr/0006-ios-supabase-chat-realtime-placement.md` — iOS authenticated realtime ownership and the single coalesced reconnect signal used by recovery.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core/src/shared-content/types.ts` and `packages/core/src/shared-content/state.ts`: portable gallery statuses (`loading`, `content`, `empty`, `incomplete`, `stale`, `unavailable`, `terminal-error`), request sequencing, identity/conversation ownership, tombstone-wins merging, and reference tracking.
- `packages/core/src/shared-content/fixtures/shared-content-vectors.json`: canonical TypeScript/Kotlin/Swift corpus to extend for Phase 12 cache and recovery semantics.
- `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt`: native Android parity reducer already matching the shared contract.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDatabase.kt`: Room database and migration pattern; current version 8 has no shared-content cache entities yet.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/NetworkMonitor.kt`: usable-network stream suitable for reconnect recovery and system-aware fetch gating.
- `apps/ios/FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift`: native Swift parity reducer already matching the shared contract.
- `apps/ios/FishKit/Sources/PersonalChat/ViewModels/MessageImageLoader.swift`: existing 32 MB decoded-memory cache, disk-backed image cache, expired-URL refresh hook, and `removeAll()` cleanup seam. Its current global `ChatMedia` disk cache must be brought under Phase 12 identity/conversation ownership and backup rules.
- `supabase/migrations/0061_shared_content_contract.sql` and `supabase/migrations/0062_shared_content_privacy_hardening.sql`: authoritative bounded listing, normalized item, privacy, and deletion behavior to consume rather than duplicate locally.

### Established Patterns
- Portable semantics live in TypeScript-owned fixtures and pure TypeScript/Kotlin/Swift reducers; provider and platform adapters replay the same behavioral contract.
- Supabase/RLS authorizes reads. Native databases and files are observable, disposable caches, never authorization sources.
- Server order is authoritative. Page completion is accepted only for the exact owner, request ID, cursor, and replace mode; tombstones prevent stale resurrection.
- Native feature/UI code stays provider-free. Android keeps provider/Room details internal to `:data:chat`; iOS keeps them inside `ChatData`.
- Diagnostics record only redacted operation/outcome/duration/failure categories. Delivery URLs, storage paths that expose private identity, and content bytes must not enter logs.

### Integration Points
- Add account-and-conversation-scoped gallery metadata and thumbnail persistence behind the Android `ChatRepository`/Room boundary and the iOS `ChatData` repository boundary.
- Hydrate the existing native shared-content reducers from verified-owner cache before authoritative refresh, without bypassing Phase 11 request sequencing.
- Connect refresh cycles to Android connectivity/lifecycle signals and the iOS coalesced reconnect/lifecycle coordinator.
- Route delivery-URL refresh and visible-thumbnail loading through bounded provider adapters, then clear all reference, memory, disk, and temporary-file layers on identity change.
- Extend shared vectors plus Android Room migration/instrumented tests and iOS cache/repository tests to prove parity, non-persistence of delivery URLs, eviction, backup exclusion, stale recovery, and cross-account cleanup.

</code_context>

<specifics>
## Specific Ideas

- “One-screen lookahead” is the deliberate calm-loading target: enough to avoid placeholder churn during ordinary scrolling, but not a license to fetch an entire history.
- Cache truth belongs at the gallery level and at the retained-history boundary, not as a warning badge on every item.
- Data-saving behavior follows the operating system automatically. Phase 12 adds no settings or choices for the client.
- Offline cache is disposable device-local context, not portable user data; device restores must re-verify and rebuild it.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 12 data, cache, privacy, and recovery scope. Gallery navigation/presentation remains Phase 13; preview, export, source navigation, and user-facing deletion remain Phase 14; final accessibility/performance/release proof remains Phase 15.

</deferred>

---

*Phase: 12-cross-platform-data-cache-and-recovery*
*Context gathered: 2026-07-23*
