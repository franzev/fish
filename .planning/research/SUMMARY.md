# Project Research Summary

**Project:** FISH v1.3 — Shared conversation content
**Domain:** Private per-conversation shared-content discovery and management in native direct chat
**Researched:** 2026-07-22
**Confidence:** HIGH

## Executive Summary

FISH v1.3 is a retrieval layer for content already shared in an Android or iOS direct conversation. It is not a new chat, sending, storage, or content-management product. The expert approach is a bounded server read model over the existing message authority: one RLS-protected, security-invoker Supabase RPC normalizes current content into stable metadata, clients page it with deterministic keyset cursors, and the existing private Storage, signed-URL refresh, source-message deletion, realtime, viewer, and sharing boundaries remain authoritative.

The milestone should ship a calm **Shared content** destination from the conversation header and details screen, using four populated-only categories—**Media, Files, Links, Voice**—and the exact content already supported by chat: processed photos, MP4 video, provider GIFs, bundled stickers, supported documents, the first safe public HTTP(S) link, and `audio/mp4` voice messages. It must not add or alter capture, upload, transcoding, link extraction, or message-sending pipelines. Android and iOS should share classification, cursor, state, action, permission, and deletion fixture contracts while using their existing native UI and platform file APIs.

The largest risks are privacy leakage through weak authorization or persistent signed URLs, incomplete/slow galleries caused by scanning the bounded transcript, misleading deletion promises, cross-account cache residue, false-context source jumps, and unsafe native export. Mitigate them before UI polish: caller-scoped RLS and adversarial tests; 40+1 keyset pages with visible-only URL hydration; stable identity-keyed caches purged on identity changes; existing sender-only source-message deletion with honest retention copy; a bounded around-message navigation contract; and verified local-byte handoff through platform APIs.

## Key Findings

### Recommended Stack

This milestone is overwhelmingly reuse. Add one Supabase SQL read contract, a small portable shared-content contract with fixtures, and thin native repository/cache/UI adapters. Add no runtime dependency, backend service, storage provider, gallery SDK, image loader, database, or media framework.

**Core technologies:**

- **Supabase Postgres + RLS:** authoritative normalized metadata read and conversation membership enforcement; add `list_conversation_shared_content` as `STABLE SECURITY INVOKER`.
- **Existing private Supabase Storage + `chat-image-command`:** retain 15-minute, caller-authorized signed delivery URLs; request only visible/near-visible attachment IDs in batches within the existing 50-ID limit.
- **Existing `chat-command` / `delete_chat_message`:** retain sender-only source-message tombstoning; never create attachment-level deletion.
- **Android Compose, Room, Coil, Media3, FileProvider, SAF:** reuse current chat modules, offline storage, rendering/playback, validated download, share, and user-selected save flows.
- **iOS SwiftUI, URLSession/ImageIO, Quick Look, AVKit, activity view, document picker:** reuse current ChatData/PersonalChat and platform preview/export paths; add only an identity-scoped bounded metadata cache.
- **`packages/core` JSON fixtures:** add a separate shared-content contract for taxonomy, total ordering, page merge, state transitions, permissions, deletion fan-out, and identity purge; do not enlarge the portable chat reducer's authority.

**Critical constraints:** keep the default metadata page at 40 items (fetch 41 for the sentinel), signed URL batches at no more than 50 IDs, Android min SDK 26, and iOS 17/Swift 6. No dependency upgrade belongs in this milestone.

### Expected Features

**Must have (table stakes):**

- Conversation-scoped member access through RLS, with no cross-conversation or global gallery.
- Quiet entry from both the conversation header and conversation details, with normal Back behavior.
- Media, Files, Links, and Voice categories in a fixed order; hide empty categories and the selector when only one is populated.
- Newest-first deterministic keyset paging independent of transcript paging, with sender and localized date context.
- Native preview/open without autoplay; contextual, type-appropriate share/save/download using validated local bytes.
- **Go to message** using bounded surrounding context, graceful missing-source handling, and gallery position restoration.
- Sender-only **Delete message** through the existing command, with every gallery sibling from that source removed after server acceptance.
- Realtime/reconnect reconciliation plus distinct loading, cached, empty, offline, partial-failure, retry, expired-URL, and remote-deletion states.
- VoiceOver/TalkBack, large text, RTL, reduced motion, 44×44 targets, explicit labels, and cross-platform behavioral parity.

**Should have (FISH differentiators):**

- Dead-choice removal: only populated categories and one obvious action per tile.
- Context-first retrieval: sender/date remain visible and source-message return is first-class.
- Consequence-aware deletion copy for text-plus-content and multi-attachment messages.
- Calm offline continuity that preserves useful cached metadata without pretending it is complete or currently authorized.
- Fixture-tested semantic parity across TypeScript, Kotlin, and Swift.

**Defer until validated (v1.x/v2+):**

- Search, multi-select, pins/favorites, multiple links per message, and download management require observed need.
- Cross-conversation galleries, OCR/transcripts/AI summaries, semantic search, bulk actions, albums, rankings, and automatic downloads are v2+ or anti-features.
- Any new video, audio-file, voice, document, link, GIF, or sticker sending/capture pipeline is explicitly outside v1.3 and requires a separate validated milestone.

### Exact Milestone Boundary

v1.3 indexes and presents only server-confirmed content already supported and persisted by the current chat contracts. Include processed photo attachments, existing MP4 videos, provider GIF messages, bundled sticker messages, the supported file allowlist, exactly the first safe public HTTP(S) URL already recognized by chat, and existing `audio/mp4` voice messages. Exclude pending/failed uploads, avatars, reactions, emoji-only text, call activity/recordings, private or non-HTTP URLs, additional URLs in the same message, arbitrary binaries, and unsupported legacy/archive/executable formats.

This boundary is retrieval-only. Shared content has no composer or upload action and introduces no capture permissions, MIME expansion, transcoding, moderation path, provider hydration, or new sending code. Unknown future ready files render as an honest unavailable/file fallback rather than silently broadening support.

### Architecture Approach

Use a separate bounded gallery read model over canonical messages and content tables. The RPC returns stable typed IDs, source-message identity, sender/date, category/type, ordering fields, and safe provider/storage metadata—but never signed URLs or internal processing fields. Native repositories persist only stable account-and-conversation-scoped metadata; delivery credentials stay memory-only. Existing conversation stores remain the sole realtime owners and feed gallery invalidation. Platform presentation remains native, while shared fixtures make behavior—not pixels—consistent.

**Major components:**

1. **Shared-content contract and fixtures** — defines current content union, four categories, composite cursor, capabilities, state vocabulary, merge/deduplication, and deletion fan-out.
2. **Supabase gallery RPC** — performs RLS-safe normalization across current attachment/GIF/sticker/link sources, excludes pending/deleted content, and serves bounded 40+1 pages with total ordering.
3. **Existing delivery and command services** — refresh short-lived URLs for authorized attachments and delete the whole source message for the sender.
4. **Android repository/cache and Compose feature** — lives in existing `data:chat` and `feature:chat`; Room is the offline source and app-owned gateways handle external actions.
5. **iOS provider/cache and SwiftUI feature** — lives in `ChatData` and `PersonalChat`; an actor-backed bounded cache supports continuity and platform coordinators own temporary files.
6. **Conversation integration** — reuses one realtime subscription and extends focus navigation to fetch a bounded around-message window with explicit continuity/gap semantics.

### Critical Pitfalls

1. **Client identifiers mistaken for authorization** — enforce membership and deleted-source eligibility in caller-scoped RPC/RLS and reject an entire mixed authorized/unauthorized URL batch; verify member, stranger, wrong-conversation, deleted-source, and non-sender cases live.
2. **Transcript scanning or offset paging** — use a dedicated normalized projection ordered by `(shared_at, source_message_id, content_id/position)` with `page_size + 1`; validate long-history query plans before adding indexes.
3. **Signed URLs treated as identity** — persist stable IDs/paths only, key media caches by owner and content version, redact telemetry, coalesce refreshes, and allow exactly one refresh-and-retry.
4. **Deletion semantics drift** — delete the source message only, remove every derived item after authoritative acceptance, let tombstones win races, and state that issued URLs last until expiry and exported copies cannot be recalled. Decide access revocation versus physical object purge before writing retention copy.
5. **Cross-account or stale cache leakage** — scope every cache by verified user and conversation, cancel generation-stale work, and purge metadata, URLs, decoded media, and temporary downloads on every identity transition.
6. **False-context jump** — never merge an isolated message and imply continuity; fetch a bounded surrounding window with explicit gaps and restore gallery category/scroll/focus on Back.
7. **Unsafe or expensive native media handling** — hydrate only visible thumbnails, downsample images, instantiate players only for selected content, validate local bytes, use FileProvider/SAF on Android and activity/Quick Look/export APIs on iOS, and request no broad storage access.

## Implications for Roadmap

Based on the combined research, use five dependency-ordered phases.

### Phase 1: Contract, taxonomy, and privacy boundary

**Rationale:** Every cache schema, UI category, action, deletion effect, and parity test depends on one final discriminated content contract and authorized ordering model.
**Delivers:** Shared DTO/cursor/state fixtures; the four-category current-content taxonomy; RLS-safe normalized RPC; grants and generated types; bounded around-message contract; query-plan and adversarial privacy tests; explicit deletion-retention semantics.
**Addresses:** Secure discovery, complete history, deterministic ordering, category eligibility, source context, sender-only deletion.
**Avoids:** Client-side authorization, transcript scans, taxonomy drift, offset pagination, isolated-row jumps, and false erasure claims.

### Phase 2: Cross-platform data, cache, and recovery

**Rationale:** Native screens should consume an already-proven behavioral state machine rather than defining platform behavior independently.
**Delivers:** Android Room repository/migration; iOS actor-backed metadata cache; account/conversation namespaces; memory-only URL delivery state; first-page refresh, page merge, offline/retry states, stale-generation protection, realtime invalidation, and identity purge.
**Addresses:** Calm offline continuity, expired URLs, realtime consistency, complete state handling, parity fixtures.
**Avoids:** Persisted bearer tokens, retry storms, stale callback resurrection, cross-account residue, and Android/iOS drift.

### Phase 3: Calm gallery browsing on Android and iOS

**Rationale:** Once repositories and state semantics are stable, both native apps can implement the same product contract in their existing chat feature boundaries.
**Delivers:** Header/details entry points, populated-only category navigation, lazy grids/lists, sender/date context, stable scroll/focus, loading/empty/offline/failure states, and accessibility behavior.
**Addresses:** Discoverability, dead-choice removal, context-first retrieval, cognitive accessibility.
**Avoids:** Dense action grids, autoplay, icon-only controls, empty/failure conflation, mobile dashboard scope creep.

### Phase 4: Preview, native actions, source jump, and deletion

**Rationale:** These actions depend on stable metadata, URL refresh, cache ownership, and an implemented gallery destination.
**Delivers:** Existing viewer/player reuse; visible-only URL hydration; verified local-byte open/share/save/download; bounded Go to message with Back restoration; sender-only source-message deletion and sibling fan-out; cancellation and temporary-file cleanup.
**Addresses:** Preview/open, platform actions, coaching context, consequence-aware deletion.
**Avoids:** Remote URL sharing, unsafe MIME handoff, broad permissions, premature file cleanup, attachment-level deletion, and optimistic data loss.

### Phase 5: Parity, privacy, performance, and release gates

**Rationale:** Correctness spans Supabase, both native stores, platform handoffs, realtime, and real-device accessibility; local unit success is insufficient.
**Delivers:** Shared-vector replay; hosted RLS/Storage/function checks; long-history `EXPLAIN`; memory and URL batching profiles; identity-switch, deletion-race, offline, jump, file-handoff, accessibility, and paired-platform UAT; deployment evidence.
**Addresses:** Cross-platform semantic parity and production confidence.
**Avoids:** Visual-only parity, local-versus-hosted drift, cache leaks, missing old content, and unmeasured media jank.

### Phase Ordering Rationale

- Freeze the full current-content union before SQL because an attachment-only RPC cannot later absorb GIF, sticker, and link semantics without breaking DTOs, cursors, caches, and actions.
- Prove server authorization and bounded reads before native UI; privacy and completeness are architectural prerequisites, not UI follow-up work.
- Build both native data layers from the same fixtures before screens, then build Android and iOS presentation in parallel against stable ports.
- Add file actions, source jumps, and deletion after stores exist because these are cross-surface flows with cancellation, race, and cleanup semantics.
- End with hosted and physical-device evidence because signed delivery, RLS, platform export, memory behavior, and accessibility cannot be fully established by mocks.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1:** Research only the unresolved deletion retention/purge promise and provider/bundled-asset redistribution rights; the broader Supabase pattern is already established.
- **Phase 4:** Research final save/export wording and platform-specific media-library behavior if the requirement includes saving photos/videos outside Files/device storage.

Phases with standard patterns (skip research-phase):

- **Phase 2:** Existing Room, iOS actor/file-cache, signed-URL refresh, realtime ownership, and identity-purge patterns are documented in the repository.
- **Phase 3:** Existing Compose/SwiftUI chat boundaries and the FISH UI/UX guide define the presentation constraints.
- **Phase 5:** The verification matrix is explicit; planning should turn it into executable gates rather than repeat ecosystem research.

### Requirement-Category Recommendations

For the next requirements workflow, organize requirements into independently traceable outcome categories:

| Category | Recommended scope |
|---|---|
| **DISC — Discovery and taxonomy** | Two entry points, four populated-only categories, exact current-content inclusion/exclusion, stable sender/date context |
| **PRIV — Privacy and authorization** | Conversation membership, RLS/RPC grants, fail-closed URL batches, no signed URL persistence/logging, identity purge |
| **PAGE — Completeness and performance** | 40+1 deterministic keyset paging, long-history completeness, visible-only delivery hydration, query-plan thresholds |
| **VIEW — Preview and playback** | Type-appropriate native preview, no autoplay, reduced-motion handling, unavailable fallback |
| **XFER — Share, save, and download** | Verified local bytes, per-type action matrix, platform APIs, permissions, cancellation, temporary-file cleanup |
| **NAV — Source navigation** | Bounded around-message window, missing-source state, continuity/gap truth, Back restoration |
| **DEL — Deletion and retention** | Sender-only source-message command, sibling fan-out, realtime/reconnect reconciliation, precise retention/export copy |
| **OFF — Offline and lifecycle** | Bounded metadata cache, warm/cold offline distinction, retry cap, reconnect merge, stale-generation rejection |
| **PAR — Cross-platform parity** | Shared fixtures for taxonomy, ordering, capabilities, permissions, states, races, and deletion |
| **A11Y — Calm accessibility** | Labels, reading/focus order, 44×44 targets, large text reflow, RTL, reduced motion, non-color states |
| **SCOPE — Milestone exclusions** | No new sending pipelines, global gallery, search, bulk actions, AI/OCR, albums, autoplay, or web/mobile-dashboard expansion |

Requirements should state observable outcomes and server authority, not prescribe duplicate platform implementations. Treat PRIV, PAGE, DEL, and SCOPE as release blockers; do not defer them as non-functional polish.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Repository versions and current native/backend capabilities were directly inspected; official platform documentation confirms no new dependency is needed. |
| Features | HIGH | Current sending contracts establish the supported inventory; category and calm-state recommendations align with FISH rules and official messaging/platform patterns. |
| Architecture | HIGH | Repository boundaries, existing RLS/functions, native stores, caches, viewers, and navigation paths are directly evidenced. Some framework details rely on current official web documentation. |
| Pitfalls | MEDIUM-HIGH | Repository-specific risks are verified and platform mitigations are official; retention policy and redistribution rights remain product/legal decisions. |

**Overall confidence:** HIGH

### Gaps to Address

- **Deletion retention promise:** Decide whether deletion means immediate access revocation/tombstoning only or also schedules idempotent Storage purge, including retention and audit expectations. Existing issued URLs can remain valid until their 15-minute expiry and external copies cannot be recalled.
- **GIF/sticker export rights:** Include these current content types in discovery and preview, but enable rendition export only after provider and bundled-asset redistribution rights are confirmed.
- **Save terminology and destination:** Confirm whether photo/video Save writes to the media library, Files/device storage, or relies on the system activity surface; keep choices minimal and platform-native.
- **Performance thresholds:** During planning, set measurable first-content, paging, memory, cache quota/TTL, and URL-refresh failure targets, then validate with representative long conversations.
- **Around-message contract details:** Define window size and explicit gap markers before implementing Go to message; do not reuse the existing isolated-message focus behavior unchanged.

## Sources

### Primary (HIGH confidence)

- [`STACK.md`](./STACK.md), [`FEATURES.md`](./FEATURES.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), and [`PITFALLS.md`](./PITFALLS.md) — detailed project research and repository evidence.
- [FISH project definition](../PROJECT.md), [repository agent rules](../../AGENTS.md), and [UI/UX guidelines](../../docs/ui-ux-agent-guidelines.md) — milestone scope, stack, direct-chat-only boundary, and calm-accessible design rules.
- Supabase official documentation — RLS, private Storage, signed URL delivery, and Storage API boundaries (linked in the detailed research files).
- Android official documentation — offline-first data layers, FileProvider, Storage Access Framework, MediaStore, and Compose accessibility (linked in the detailed research files).
- Apple official documentation — Quick Look, activity sharing, document export, PhotoKit privacy, and file lifecycle (linked in the detailed research files).
- Repository migrations, Edge Functions, Android `data:chat`/`feature:chat`, iOS `ChatData`/`PersonalChat`, and existing attachment viewers/downloaders — current authority, content support, and integration seams.

### Secondary (MEDIUM confidence)

- Official Apple Messages and Signal support material summarized in `FEATURES.md` — familiar category and native action expectations, adapted to FISH's choice-reduction rules.

### Tertiary (LOW confidence)

- None used for roadmap-critical conclusions.

---
*Research completed: 2026-07-22*
*Ready for roadmap: yes*
