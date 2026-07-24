---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Shared conversation content
status: verifying
stopped_at: Completed 13-13-PLAN.md
last_updated: "2026-07-24T06:16:01.635Z"
last_activity: 2026-07-24 -- Phase 13 execution started
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 41
  completed_plans: 41
  percent: 100
---

# Project State: FISH

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22)

**Core value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.
**Current focus:** Phase 13 — Calm gallery browsing

## Current Position

Phase: 13 (Calm gallery browsing) — COMPLETE
Plan: 13 of 13
Status: Phase complete — ready for verification
Last activity: 2026-07-24 -- Phase 13 automated validation completed

Progress: [██████████] 100%

## Performance Metrics

**Current milestone:**

- Plans completed: 2
- Average duration: 23 min
- Total execution time: 46 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 11-15 | 2 | 46 min | 23 min |
| 11 | 12 | - | - |

*Updated after each plan completion*
| Phase 11 P01 | 34min | 3 tasks | 3 files |
| Phase 11 P03 | 12min | 2 tasks | 10 files |
| Phase 11 P02 | 5min | 2 tasks | 3 files |
| Phase 11 P04 | 1141 | 2 tasks | 8 files |
| Phase 11 P5 | 42min | 1 tasks | 3 files |
| Phase 11 P06 | 25min | 3 tasks | 3 files |
| Phase 11 P07 | 6min | 2 tasks | 2 files |
| Phase 11 P09 | 10min | 1 tasks | 2 files |
| Phase 11 P10 | 13min | 1 tasks | 4 files |
| Phase 11 P11 | 23 | 2 tasks | 2 files |
| Phase 11 P12 | 7min | 1 tasks | 0 files |
| Phase 12 P01 | 26min | 2 tasks | 6 files |
| Phase 12 P02 | 17min | 2 tasks | 5 files |
| Phase 12 P03 | 11min | 2 tasks | 5 files |
| Phase 12 P04 | 15min | 2 tasks | 7 files |
| Phase 12 P5 | 45min | 3 tasks | 8 files |
| Phase 12 P6 | 15min | 2 tasks | 10 files |
| Phase 12 P07 | 32min | 2 tasks | 5 files |
| Phase 12 P08 | 15min | 1 tasks | 7 files |
| Phase 12 P11 | 35min | 1 tasks | 4 files |
| Phase 12 P09 | 21min | 2 tasks | 6 files |
| Phase 12 P12 | 25 | 2 tasks | 6 files |
| Phase 12 P10 | 12 min | 1 tasks | 4 files |
| Phase 12 P13 | 40min | 1 tasks | 2 files |
| Phase 12 P14 | 17 min | 1 tasks | 8 files |
| Phase 12 P15 | 30min | 1 tasks | 6 files |
| Phase 12 P16 | 2h | 2 tasks | 14 files |
| Phase 13 P01 | 18 min | 2 tasks | 5 files |
| Phase 13 P02 | 21 min | 2 tasks | 6 files |
| Phase 13 P03 | 12 min | 2 tasks | 5 files |
| Phase 13 P04 | 13m 1s | 2 tasks | 5 files |
| Phase 13 P05 | 8 min | 2 tasks | 9 files |
| Phase 13 P06 | 10 min | 2 tasks | 7 files |
| Phase 13 P07 | 12 min | 2 tasks | 2 files |
| Phase 13 P08 | 12 min | 2 tasks | 6 files |
| Phase 13 P09 | 17min | 2 tasks | 17 files |
| Phase 13 P10 | 17min | 2 tasks | 22 files |
| Phase 13 P11 | 25min | 2 tasks | 20 files |
| Phase 13 P12 | 16min | 2 tasks | 5 files |
| Phase 13 P13 | 49m | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Current milestone boundaries:

- Shared content is a retrieval layer over existing direct conversations, not a new sending or content-management product.
- The fixed populated-only category order is Media, Files, Links, Voice; one populated category removes the category control.
- Private metadata is account-and-conversation scoped; delivery URLs remain short-lived and memory-only.
- Deletion uses the sender-only source-message command and removes every derived gallery item only after server acceptance.
- [Phase 11]: The linked project accepted migrations 0059, 0060, and 0061 before generated-contract verification. — Later plans require live schema evidence before behavioral verification.
- [Phase 11]: The generated Supabase contract is the source for shared-content aliases; aliases index generated rows and function returns. — This preserves the provider-only boundary and prevents handwritten row-shape drift.
- [Phase 11]: Lint-found SQL defects were fixed in the canonical migration and applied remotely with idempotent function replacements. — The live database must match the corrected source without introducing a speculative migration number.
- [Phase 11]: The TypeScript shared-content contract uses one explicit JSON corpus for classification, ordering, paging, permissions, gallery states, identity purge, and deletion fan-out. — Native parity ports must replay this corpus rather than reinterpret server results.
- [Phase 11]: Shared-content clients preserve server order, use row 40 for the continuation cursor, and keep row 41 as a non-rendered sentinel. — Local locale sorting would create cross-platform drift.
- [Phase 11]: Source-message tombstones and verified identity changes are reducer boundaries. — Tombstones remove every sibling and block stale resurrection; identity changes clear all prior-owner state before new content is accepted.
- [Phase 11]: Canonical link and preview-job upserts ignore conflicts so a later enqueue cannot replace the first safe URL for a message. — The message primary key is the durable first-safe-link identity boundary.
- [Phase 11]: Deleted-bound cleanup treats no paths and provider missing-object responses as converged, while Storage failures remain retryable. — The Storage API is authoritative for physical deletion and the database finish RPC only acknowledges successful IDs.
- [Phase 11]: Native Android and iOS shared-content implementations replay the TypeScript-owned canonical JSON corpus.
- [Phase 11]: Native reducers remain pure and preserve canonical ordering, pagination, identity purge, and deletion fan-out semantics.
- [Phase 11]: GIF and sticker export remains explicitly rights-gated on both native platforms.
- [Phase 11]: Temporary real Auth identities isolate adversarial shared-content verification from seeded community membership.
- [Phase 11]: EXPLAIN uses one CTE statement to set the test identity because Supabase db query executes one prepared statement at a time.
- [Phase 11]: Generated type drift is checked byte-for-byte against supabase gen types --local, including the generator's final blank line.
- [Phase 11]: Preserve applied 0061 history and introduce all Phase 11 privacy and cleanup corrections only through forward migration 0062.
- [Phase 11]: Keep unproven legacy link rows stored but invisible until current version-2 proof, canonical URL/hostname identity, and validation timestamp are present.
- [Phase 11]: Regenerate provider types only after linked acceptance and verify generated bytes exactly against the local Supabase generator.
- [Phase 11]: DNS answers are validated as a union before version-2 link proof; any malformed, operational-error, private, reserved, or mixed answer fails closed.
- [Phase 11]: Optional link-preview enrichment is disabled, so redirects and DNS rebinding have no outbound request primitive and legacy jobs terminalize with preview_fetch_disabled.
- [Phase 11]: Android accepts shared-content page completion only when request ID, exact cursor, and replace mode match the pending request. — This prevents stale, duplicate, wrong-cursor, and wrong-mode callbacks from changing continuation.
- [Phase 11]: Android rejects mixed-conversation page and realtime payloads before reducer mutation and preserves tombstone and identity purge boundaries. — Whole-event validation prevents misrouted content and stale resurrection.
- [Phase 11]: Android parity uses strict complete projections with explicit null cursors and vector-context failures for lookup, event, and projection drift. — The native replay must fail closed when the canonical contract changes.
- [Phase 11]: Swift accepts page completions only for the exact pending request ID, cursor, and replace mode.
- [Phase 11]: Mixed-conversation page and realtime payloads are rejected as whole events before state mutation.
- [Phase 11]: Native parity uses complete JSON projections and explicit null cursors; the SwiftPM resource is byte-synced from TypeScript.
- [Phase 11]: Plan 11 requires exact ACTIVE send-message and link-preview deployment UUID/version/digest tuples before linked behavior verification.
- [Phase 11]: Plan 11 uses formula-derived parsed JSON EXPLAIN budgets and complete normalized-row equality for local and linked proof.
- [Phase 11]: Accept only the intended FishKit-Package iOS Simulator result; host SwiftPM is not parity evidence.
- [Phase 11]: Record fixture version, fixed counts, test status, and human approval without copying fixture or linked data.
- [Phase 12]: Keep the canonical fixture at version 3 with 16 ordered groups and exactly 92 literal cases, including all eight Phase 12 groups.
- [Phase 12]: Preserve the 40+1 paging invariant with p_limit 40, retained rows 0-39, and row 40 as a continuation sentinel only.
- [Phase 12]: Keep Phase 12 production exports absent so Node, Kotlin, and Swift suites fail only at intentional RED contract guards.
- [Phase 12]: Synchronize the iOS resource only through pnpm ios:chat-vectors; the copied bytes remain identical to the TypeScript fixture.
- [Phase 12]: Keep Android suites intentionally RED only at absent Phase 12 Room/store/repository production contracts, matching the Phase 12-01 native parity pattern.
- [Phase 12]: Use private provider-neutral fake ports to exercise repository acceptance semantics without importing Room or Supabase types into test contracts.
- [Phase 12]: Treat rows 0–39 as the only retained/rendered page, row 40 as the continuation sentinel, and row 41 as never accessed.
- [Phase 12]: Keep all five Android suites provider-neutral and intentionally RED behind absent production-symbol guards; implementation belongs to Plans 12-09, 12-10, and 12-14.
- [Phase 12]: Use opaque item keys and safe zero-count sentinel assertions so delivery values, owner IDs, paths, and content bytes cannot enter durable or diagnostic evidence.
- [Phase 12]: Make identity teardown observable as an exact revoke, hide, cancel, clear, purge, verify, bind, and publish order.
- [Phase 12]: Keep iOS Wave 0 suites provider-neutral and intentionally RED behind absent Phase 12 production contracts.
- [Phase 12]: Use opaque item keys and redacted categories so delivery values and private evidence never become durable or diagnostic data.
- [Phase 12]: Make the 40+1 page contract explicit: retain indexes 0–39, use index 40 only for hasMore, and never access index 41.
- [Phase 12]: Keep the version-3, 16-group, 92-case fixture as the cross-platform cache/recovery/delivery/identity contract boundary.
- [Phase 12]: Durable snapshots contain only owner-scoped metadata and cache truth; delivery URLs, tokens, temporary references, filesystem paths, and UI/request state stay out of persistence.
- [Phase 12]: Every asynchronous shared-content event is gated by owner identity and a strictly monotonic identity generation.
- [Phase 12]: Durable Room rows use compound owner/conversation identity and persist only safe shared-content metadata plus retained-history truth; delivery authority fields are absent. — This keeps offline metadata useful while ensuring Room never becomes an authorization or delivery-lease source.
- [Phase 12]: Android protects the newest 40 items and evicts older browsed pages by inactivity and oldest-page order before protected newest metadata. — This preserves the bounded offline footprint and newest-window availability contract.
- [Phase 12]: Room cache mutations validate the whole owner/conversation batch and execute page, item, boundary, tombstone, and pruning changes transactionally. — This prevents crash-visible partial cache truth and cross-namespace writes.
- [Phase 12]: The Android application database builder registers MIGRATION_8_9 for safe production upgrades. — A schema migration is incomplete if upgraded app instances cannot discover it.
- [Phase 12]: Persist only owner-scoped shared-content metadata and retained-history truth; delivery URLs, tokens, runtime state, bytes, paths, and action authority remain outside Core Data.
- [Phase 12]: Use Core Data uniqueness constraints for owner/conversation/page/item identity and a private context save boundary for every accepted mutation.
- [Phase 12]: Protect the newest 40 items, reclaim inactive and oldest browsed pages first, and enforce 400-per-conversation and 2,000-per-account limits with an injected clock.
- [Phase 12]: Require exact verified-owner hydration and make owner purge plus non-current-owner sweep explicit before a new identity can consume restored rows.
- [Phase 12]: Use p_limit = 40, retain only indexes 0–39, derive the cursor from retained index 39, and treat index 40 solely as hasMore; index 41 is rejected before inspection.
- [Phase 12]: Verify membership through the authorized conversation directory before accepting a page; local Room cache never authorizes access.
- [Phase 12]: Persist only the Room cache store's safe metadata projection, dropping delivery/runtime fields and action capabilities at the durable boundary.
- [Phase 12]: Gate asynchronous acceptance by owner, identity generation, cycle/request token, cursor, and replace mode, with typed redacted diagnostics.
- [Phase 12]: Keep provider and persistence details inside ChatData; expose only safe Codable repository values to later orchestration and UI layers.
- [Phase 12]: Treat Low Data Mode as an automatic constrained-path dimension: visible work remains usable while lookahead is suppressed.
- [Phase 12]: Validate the complete 28-field RPC row shape and reject duplicate or malformed ordered rows before any cache transaction.
- [Phase 12]: Keep shared-content delivery leases and staged thumbnails memory-only, with displayed bytes bounded and opaque on disk — Preserves Phase 12 privacy invariants while allowing authenticated delivery reuse and safe displayed-thumbnail recovery.
- [Phase 12]: Require validated internet and constrain lookahead under metering or Data Saver — Prevents constrained-network background work while preserving visible delivery behavior.
- [Phase 12]: Signed delivery URLs remain non-Codable actor-memory leases with 50-ID batching, 120-second freshness, and one authorization refresh. — Recorded by 12-12 summary
- [Phase 12]: Only explicitly displayed thumbnails cross the protected opaque file boundary; lookahead and selected-full bytes remain ephemeral. — Recorded by 12-12 summary
- [Phase 12]: Shared image identity includes owner generation and content version, never the rotating signed URL. — Recorded by 12-12 summary
- [Phase 12]: Keep recovery in the feature layer behind ChatRepository and provider-neutral visibility ports; ChatData owns the explicit Room cache dependency and existing delivery authority.
- [Phase 12]: Use a trailing 500ms coalescing window, five-minute meaningful foreground threshold, and exactly attempts 0 and 1 with a one-second injected-jitter delay.
- [Phase 12]: Expose only the existing closed presentation keys and retain cached item identity through refresh and failure; displayed-thumbnail promotion remains reachable only through confirmThumbnailDisplayed.
- [Phase 12]: Use a 500ms trailing trigger coalescer and a five-minute meaningful-foreground threshold.
- [Phase 12]: Limit each recovery cycle to attempts 0 and 1, with a deterministic one-second delay plus injected jitter capped by the shared contract.
- [Phase 12]: Expose only the closed presentation contract; provider paths, URLs, tokens, and request diagnostics remain internal.
- [Phase 12]: Keep lookahead memory-only and make confirmDisplayed the only thumbnail persistence promotion.
- [Phase 12]: Purge-before-bind transitions hide state synchronously, advance a monotonic generation, and publish a new owner only after verified zero. — This keeps stale callbacks and local leftovers from authorizing gallery access.
- [Phase 12]: Cleanup failures make only gallery eligibility unavailable and retry on verified start or foreground. — Unrelated authenticated chat surfaces remain usable while privacy cleanup recovers.
- [Phase 12]: Provider-neutral ephemeral purge hooks and redacted identity diagnostics keep app-owned temp files private. — The coordinator does not depend on a provider implementation or expose durable secrets.
- [Phase 12]: Gallery state becomes unresolved before purge awaits; only verified zero state publishes the new owner. — This makes old and new gallery state unobservable during identity transitions.
- [Phase 12]: Gallery cleanup failures remain isolated from auth and retry on startup/foreground. — Sign-in and unrelated authenticated surfaces must continue while gallery cleanup fails closed.
- [Phase 12]: Provider-specific storage remains behind a redacted, provider-neutral purge port. — The coordinator must not expose provider IDs, URLs, paths, or content through diagnostics.
- [Phase 12]: Keep wave_0_complete and nyquist_compliant false while the exact full Android connected matrix retains unrelated pre-existing failures.
- [Phase 12]: Preserve every pre-existing research cache JSON as untracked and unstaged.
- [Phase 12]: Update Room owner metadata in place so conflict handling cannot cascade-delete child cache rows.
- [Phase 13]: Nest Phase 13 gallery cases under galleryStates.galleryProjection so the strict earlier-phase fixture parser remains green while the portable corpus grows to 108 cases.
- [Phase 13]: Keep duration as trusted nullable listing metadata and exclude it from chat sending and attachment-upload inputs.
- [Phase 13]: Use deterministic provider-neutral Android test harnesses with named missing-symbol guards so Wave 0 RED failures remain isolated from behavioral failures. — Production gallery seams intentionally remain absent until later Phase 13 plans.
- [Phase 13]: Keep Android Shared content screenshot items non-actionable until Phase 14 while fixing the 12-state visual matrix and 88dp/120dp media geometry. — Phase 13 defines calm browsing without introducing a selection destination.
- [Phase 13]: Use deterministic provider-neutral iOS test harnesses with one named RED guard per absent Phase 13 production seam. — Keeps behavior executable now while isolating expected production-symbol failures for later implementation plans.
- [Phase 13]: Preserve legacy missing duration as nil and reject negative duration before repository acceptance or Core Data save. — Maintains backward-compatible display semantics without allowing invalid duration metadata to cross trusted boundaries.
- [Phase 13]: Keep iOS Wave 0 gallery items non-actionable and cover the approved visual matrix semantically until the production screen exists. — Defines calm browsing without adding Phase 14 selection behavior or brittle missing snapshot references.
- [Phase 13]: Project duration only for audio/mp4 attachment rows; every non-voice source returns null.
- [Phase 13]: Expose the duration column to authenticated update shapes while the absence of an UPDATE RLS policy keeps all member writes at zero rows.
- [Phase 13]: Require duration_ms to be present in every strict Android RPC row while accepting an explicit null for legacy content. — Missing fields fail closed while legacy SQL null remains honest metadata.
- [Phase 13]: Add Android Room duration_ms as nullable with no zero default, and validate it before repository or cache mutation. — Preserves legacy rows and prevents malformed duration from becoming durable.
- [Phase 13]: Require duration_ms in every strict iOS RPC row while accepting explicit null for legacy content. — Missing fields fail closed while existing SQL null remains honest metadata.
- [Phase 13]: Persist iOS duration as an optional Integer64 with inferred lightweight migration. — Pre-Phase-13 Core Data rows reopen as nil without a parallel model or fabricated zero.
- [Phase 13]: Validate iOS duration before repository reconciliation and cache transactions. — Negative metadata cannot mutate protected durable state or overwrite a prior snapshot.
- [Phase 13]: Expose one allowlisted Android accepted-item model that excludes provider, delivery, cache, raw URL/path, preview-context, and Phase 14 action fields. — Keeps the gallery feature boundary display-safe and provider-neutral.
- [Phase 13]: Keep Android earlier paging global and single-flight with exact owner, conversation, generation, request, cursor-bearing token, and append-mode acceptance. — Prevents duplicate or stale callbacks from mutating retained gallery state.
- [Phase 13]: Keep Android category selection and anchors route-scoped, preserving valid selection and falling back only when the selected category empties. — Matches the calm populated-only contract without persisting session choices.
- [Phase 13]: Accepted iOS gallery items expose only allowlisted display metadata and never provider delivery authority.
- [Phase 13]: Earlier paging is one exact-token global append stream that preserves visible content on failure.
- [Phase 13]: Gallery selection and anchors remain route-memory state, with item selection disabled unless explicitly injected.
- [Phase 13]: Keep Android gallery items non-actionable unless a caller explicitly supplies selection; Phase 14 owns previews and item actions. — Preserves the approved calm browsing scope and safe presenter boundary.
- [Phase 13]: Key Compose visibility and display effects by route scope, category, and accepted item ID. — Prevents stale composition effects from crossing owner or conversation scope.
- [Phase 13]: Use shared adaptive geometry for media content and skeletons, with 88dp normal and 120dp accessibility minimum cells. — Keeps loading stable while preserving readable accessibility layouts.
- [Phase 13]: Keep the iOS gallery on safe provider-neutral display projections — Thumbnail delivery remains explicitly deferred to Phase 14.
- [Phase 13]: Restore iOS gallery categories through model-owned anchors — Route generation plus item IDs scope visibility effects and reject stale route work.
- [Phase 13]: Create the Android gallery store and presenter only for an actual route entry with an eligible owner, active conversation, and exact verified generation. — This prevents duplicate stores and stale or cross-identity recovery work.
- [Phase 13]: Keep Android gallery delivery refresh and displayed-thumbnail promotion behind the ChatDataModule runtime. — Feature UI must never receive signed URLs, private paths, or cache locators.
- [Phase 13]: Revoke the active Android gallery session synchronously before pop, replacement, sign-out, or identity cleanup. — Old-owner items and callbacks must be hidden before asynchronous cleanup begins.
- [Phase 13]: Keep protected cache and thumbnail dependencies app-owned while creating one repository, store, and provider-neutral model per retained iOS gallery route. — Persistent resources participate in purge authority; mutable display state must remain route-scoped.
- [Phase 13]: Fail closed by withholding iOS Shared content entries until persistent storage and the exact signed-in owner are eligible. — No unverified identity or unavailable protected storage may expose prior-owner content.
- [Phase 13]: Carry header or details origin in the native destination value so Back restores the real source control. — Explicit origin avoids sheet-state inference and preserves deterministic focus restoration.
- [Phase 13]: Leave SharedContentGalleryModel item selection unset so Phase 14 delivery actions remain absent. — Phase 13 is browsing-only and must not add fake or premature actions.
- [Phase 13]: Production-entry evidence must render real controls rather than a faithful test harness.
- [Phase 13]: Gallery privacy scans exclude legacy direct-message attachment internals while documenting broad-scan matches.
- [Phase 13]: Android modal focus is requested only after the sheet reaches Expanded.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 11 planning must specify the bounded around-message window and honest continuity gaps used by Phase 14 source navigation.
- Phase 14 must keep GIF and sticker export unavailable unless redistribution rights are verified.
- Phase 15 planning must set measurable long-history, memory, cache, and delivery-URL performance gates and include hosted Supabase evidence.
- Deletion copy must distinguish immediate access revocation from issued URL expiry and copies previously exported by a user.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Dependency | Upgrade `@types/node` when dependencies are next refreshed | Deferred | v1.2 audit |
| Operations | Configure hosted Supabase environments, email templates, Site URL, and redirect allow-lists | Pending | Prior milestone |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260711-en2 | Reorganize and refactor the project while preserving behavior, improving ownership and reuse, and verifying all checks | 2026-07-11 | f645dfb0 | [quick archive](./quick/260711-en2-reorganize-and-refactor-the-project-to-f/) |
| 260711-gxf | Refactor the Next.js web folder structure and harden server-client boundaries | 2026-07-11 | c88b44c8 | [quick archive](./quick/260711-gxf-refactor-the-next-js-web-folder-structur/) |
| 260711-htb | Refactor toward clean architecture with provider-neutral boundaries and no behavior changes | 2026-07-11 | 436e7da1 | [quick archive](./quick/260711-htb-refactor-the-codebase-to-follow-clean-ar/) |
| 4 | Remove completed-call notifications from the attention inbox | 2026-07-15 | d9e8eb3c | — |
| 5 | Hide completed-call notifications before the database migration is applied | 2026-07-15 | f8ec69a1 | — |

## Session Continuity

Last session: 2026-07-24T06:16:01.630Z
Stopped at: Completed 13-13-PLAN.md
Resume file: None
