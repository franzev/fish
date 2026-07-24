---
phase: 11-shared-content-contract-and-privacy-boundary
verified: 2026-07-22T22:48:19Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "0062 now enforces safe-link proof, legacy tombstone cleanup, deleted-source filtering, and live-neighbor context."
    - "Current DNS A/AAAA validation and no-egress link-preview behavior were rechecked."
    - "Current TypeScript, Android, and Swift reducers reject cross-conversation items and stale request completions."
    - "The strict verifier now compares complete normalized rows with UTF-8/C ordering and full native projections."
    - "The corrected explainSharedContent probe now passes all semantic, pagination, and parsed JSON EXPLAIN cases."
    - "The intended iOS Simulator parity gate was explicitly approved in Plan 11-12 and independently rerun."
  gaps_remaining: []
  regressions: []
---

# Phase 11: Shared-content contract and privacy boundary Verification Report

**Phase Goal:** Clients and coaches have one secure, deterministic definition of the content that belongs in a direct conversation's gallery.
**Verified:** 2026-07-22T22:48:19Z
**Status:** passed
**Re-verification:** Yes — current checkout after Plans 11-06 through 11-12

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A verified member retrieves exactly supported, safe, nondeleted content; signed-out, outsider, and other-conversation callers cannot. | ✓ VERIFIED | Effective functions in `0062_shared_content_privacy_hardening.sql` enforce proof, conversation, deletion, supported-kind, and membership predicates. The fresh migration regression and local verifier pass all seven eligible kinds plus exclusion and authorization cases. |
| 2 | The first request returns the newest 40 eligible items plus one continuation sentinel without transcript hydration. | ✓ VERIFIED | The effective 0062 listing function constrains the limit to 1..40 and retains only a `p_limit + 1` sentinel. The fresh local verifier passes exact 41-row, row-40-cursor, complete-row, and bounded parsed-plan checks. |
| 3 | Older pages preserve deterministic order without gaps, duplicates, or jumps. | ✓ VERIFIED | 0062 uses the four-field timestamp/message/rank/item keyset with C-collated item ordering; the local verifier returns 87 exact rows as `[41,41,1]`, and all three reducers enforce request identity, cursor, mode, and item-conversation ownership. |
| 4 | TypeScript, Kotlin, and Swift agree on classification, ordering, pagination, permissions, gallery states, identity purge, and deletion fan-out. | ✓ VERIFIED | Fixture v2 has 48 fixed Task-1 cases and 74 total cases. TypeScript 7/7, Android focused parity, byte-synced fixtures, and the approved `FishKit-Package` iPhone 17 Pro simulator run pass. |
| 5 | Safe first links survive enrichment failure and unsafe URLs never become canonical gallery identities. | ✓ VERIFIED | Current `link-preview.ts` resolves A and AAAA records, fails closed for private/reserved/malformed/mixed answers, persists only version-2 proof, preserves first identity, and disables legacy fetch work. Focused tests pass 9/9; migration and local adversarial cases pass. |
| 6 | Source deletion revokes access immediately and cleanup converges, including pre-existing deleted sources. | ✓ VERIFIED | 0062 backfills `delete_requested_at` for attachments bound to deleted messages and adds insert/update tombstone protection. Fresh migration regression and local deletion/cleanup cases pass legacy claimability, sibling removal, retry release/reclaim, and durable finish. |
| 7 | Around-message context is bounded, excludes deleted neighbors, and reports honest live-row gaps. | ✓ VERIFIED | Effective 0062 target, older, newer, and gap CTEs all filter live messages in the requested conversation. Migration regression and local verifier pass exact live-neighbor and gap-flag cases. |
| 8 | The strict verifier proves exact fields, ordering, pagination, and bounded query semantics. | ✓ VERIFIED | Current `scripts/verify-shared-content.ts` compares all 28 normalized fields, uses `TextEncoder` C ordering, checks sentinel/cursor/reference equality, recursively parses JSON plans, and the corrected `explainSharedContent` probe passes all six page EXPLAIN cases plus category availability. |
| 9 | Native parity assertions reject fixture drift and incomplete or cross-conversation projections. | ✓ VERIFIED | Android and Swift require known fixture identities and compare complete item/page/state projections, including request identity and conversation guards. Current Android parity, iOS vector check, and approved iOS Simulator suite pass with zero failures/skips. |

**Score:** 9/9 truths verified. The phase goal is achieved in the current checkout.

### Prior Gap-Closure History

The earlier 1/9 verification findings were closed by Plans 11-06 through 11-12: 0062 safe-link/privacy hardening, legacy tombstone backfill, live-only context neighbors, request/conversation guards in all reducers, strict complete-field/C-order verification, strict native projections, and approved iOS Simulator acceptance. The immediately preceding 8/9 report’s remaining EXPLAIN finding is also closed: the current `explainSharedContent` probe orders bounded live messages first, probes eligible attachments through the production indexes, and the fresh local run passes every page and category plan case.

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/0062_shared_content_privacy_hardening.sql` | Effective privacy, safe-link proof, legacy cleanup, deletion filtering, deterministic listing/category/context functions | ✓ VERIFIED | 0062 replaces the 0061 functions and adds proof constraints, legacy tombstone backfill, deleted-source trigger, live-neighbor filters, and required indexes. All effective behavior was checked against 0062. |
| `supabase/functions/_shared/link-preview.ts` | DNS-validated canonical link persistence with no unsafe egress | ✓ VERIFIED | A/AAAA resolution and public-address checks are current; focused suite passes 9/9 and the production send path persists only validated version-2 identity. |
| `packages/core/src/shared-content/state.ts` | Identity-safe, tombstone-safe, request-sequenced portable reducer | ✓ VERIFIED | Exact request ID/cursor/mode matching and whole-page conversation guards are implemented; focused suite passes 7/7. |
| `apps/android/.../SharedContentState.kt` | Android parity reducer with request and conversation guards | ✓ VERIFIED | Current reducer rejects stale/mismatched page completions and mismatched realtime/page items; focused parity task builds successfully. |
| `apps/ios/.../SharedContentState.swift` | Swift parity reducer with request and conversation guards | ✓ VERIFIED | Current reducer performs the same request/cursor/mode and item-conversation checks; simulator suite passes. |
| `apps/ios/.../SharedContentContractTests.swift` | Strict complete iOS fixture replay | ✓ VERIFIED | Unknown fixture IDs fail, and item/page/state projections compare complete expected values. Plan 11-12's human approval is accepted. |
| `scripts/verify-shared-content.ts` | Strict local/linked adversarial verifier | ✓ VERIFIED LOCALLY | Exact 28-field comparison, UTF-8/C comparator, privacy/cleanup/context cases, corrected bounded EXPLAIN probe, parsed JSON budgets, and local target isolation pass. Linked execution is an optional environment follow-up. |
| `packages/core/src/shared-content/fixtures/shared-content-vectors.json` | Canonical cross-platform parity corpus | ✓ VERIFIED | Fixture metadata is version 2 with the fixed 48/74 counts and eight semantic groups; iOS copies are byte-synchronized. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| effective 0062 listing/category/context functions | member/privacy boundary | security-invoker functions, explicit membership, RLS-preserving projections | ✓ WIRED | Local signed-out, outsider, former/blocked, other-conversation, direct-table, and service-only cases pass. |
| effective 0062 listing function | deterministic cursor | timestamp/message/rank/item ID with C collation | ✓ WIRED | Exact 87-row reference sequence and raw sentinel pages pass. |
| deleted source | attachment cleanup | 0062 backfill plus insert/update tombstone trigger and cleanup RPC | ✓ WIRED | Legacy tombstone and retry cleanup regression cases pass. |
| `enqueueLinkPreviewJob` | canonical link identity | DNS-safe first URL → version-2 proof persistence | ✓ WIRED | `send-message` calls the helper; unsafe candidates never reach persistence and no preview job is created. |
| shared-content events | native/portable state | exact request identity/cursor/mode plus whole-event conversation ownership | ✓ WIRED | TypeScript, Android, and Swift implementations and focused tests agree. |
| canonical fixture | TypeScript/Android/iOS replay | shared JSON resource and byte-synced iOS copy | ✓ WIRED | Strict full-projection tests pass across the three implementations. |
| verifier | normalized production projection and bounded plan probe | full-field comparator, reference pagination, and corrected `explainSharedContent` probe | ✓ WIRED | The fresh local verifier passes complete row equality, ordering, sentinels, concatenated page sequence, six page EXPLAIN cases, and category availability. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| 0062 shared-content projections | normalized eligible rows | live messages, attachments, GIFs, stickers, version-2 safe links | Yes | ✓ FLOWING |
| link persistence | canonical URL/hostname/proof | DNS A/AAAA validation in current `link-preview.ts` | Yes | ✓ FLOWING |
| cleanup worker | claimed/deleted attachment IDs | service-only claim/finish RPCs plus Storage removal | Yes | ✓ FLOWING |
| TS/Android/Swift reducers | items/pages/cursors/tombstones | canonical fixture and validated page/realtime events | Yes | ✓ FLOWING |
| strict verifier plan evidence | parsed plan nodes/budgets | corrected `explainSharedContent` live-message/attachment probe and production schema indexes | Yes | ✓ FLOWING LOCALLY |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 0061→0062 correction regression | `node --experimental-strip-types --env-file=apps/web/.env.local scripts/verify-shared-content-migration.ts` | All 10 named regression checks passed; exit 0 | ✓ PASS |
| Link safety and no-egress behavior | `node --experimental-strip-types --test supabase/functions/_shared/link-preview.test.ts` | 9 passed, 0 failed, 0 skipped | ✓ PASS |
| Portable contract replay | `node --experimental-strip-types --test packages/core/src/shared-content/shared-content.test.ts` | 7 passed, 0 failed, 0 skipped | ✓ PASS |
| Android parity | `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentParityTest'` | `BUILD SUCCESSFUL` | ✓ PASS |
| iOS fixture drift | `pnpm ios:chat-vectors:check` | 3 fixture files up to date | ✓ PASS |
| Local strict adversarial verifier | `pnpm verify:shared-content` | Full local verification passed: privacy, exact 28-field rows, UTF-8/C ordering, 87-row pagination, cleanup, context, six page EXPLAIN cases, category availability, and generated-contract checks; exit 0 | ✓ PASS |
| iOS Simulator acceptance | `pnpm ios:test` | `FishKit-Package` on iPhone 17 Pro; `SharedContentContractTests` passed with zero failures/skips; overall test session passed | ✓ PASS |
| Workspace build | `pnpm build` | Exit 0 | ✓ PASS |
| Workspace lint | `pnpm lint` | Exit 0 | ✓ PASS |
| Workspace typecheck | `pnpm typecheck` | Exit 0 after sequential rerun following build generation | ✓ PASS |
| Linked migration parity | `supabase migration list --linked` | Local/remote history matches through 0062 | ✓ PASS |
| Linked migration dry run | `supabase db push --linked --dry-run --yes` | Remote database up to date; exit 0 | ✓ PASS |
| Linked strict adversarial verifier | `pnpm verify:shared-content:linked` | Fail-closed setup result because dedicated linked credentials were unavailable in this execution environment; local linked aliases/project environment remain available for the optional hosted follow-up | ℹ ENVIRONMENT FOLLOW-UP |

## Probe Execution

No Phase 11 probe path was declared and no conventional `scripts/*/tests/probe-*.sh` file was discovered.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DISC-03 | 11-01, 11-02, 11-03, 11-05, 11-06, 11-07, 11-11 | Supported photos, MP4 videos, GIFs, stickers, documents, first safe public link, and voice are included; pending/failed/deleted/unsupported content is excluded. | ✓ SATISFIED | Effective 0062 projection plus fresh migration and local adversarial exact-kind/exclusion checks pass. |
| PRIV-01 | 11-01, 11-02, 11-05, 11-06, 11-07, 11-11 | Only verified conversation members can list/open shared content; outsiders and other conversations are denied server-side. | ✓ SATISFIED | Current SQL and local signed-out/outsider/former/blocked/other-conversation/direct-table checks pass. A hosted linked run is an environment follow-up only. |
| PAGE-01 | 11-01, 11-03, 11-05, 11-06, 11-11 | Newest 40 plus one continuation sentinel without transcript loading/scanning. | ✓ SATISFIED | Raw 40+1, exact reference rows, corrected six-case page EXPLAIN probe, category availability, and derived plan budgets pass locally. |
| PAGE-02 | 11-01, 11-03, 11-05, 11-08, 11-09, 11-10, 11-11 | Deterministic cursor pagination without gaps, duplicates, or position jumps. | ✓ SATISFIED | Effective SQL, exact 87-row local pages, request sequencing, and all three native/portable replays pass. |
| PAR-01 | 11-03, 11-04, 11-08, 11-09, 11-10, 11-11, 11-12 | Shared fixtures define classification, ordering, pagination, permissions, states, identity purging, and deletion fan-out for all three languages. | ✓ SATISFIED | Fixture v2 strict replay passes in TypeScript, Android, and the approved iOS Simulator target with zero failures/skips. |

No Phase 11 requirement is orphaned: all five IDs are claimed by plans and mapped in `REQUIREMENTS.md`.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| — | — | No unreferenced `TBD`, `FIXME`, or `XXX` markers or implementation stubs found in the reviewed phase artifacts. | — | None |

## Linked Environment Follow-up (Non-blocking)

### Optional hosted adversarial deployment behavior

**Test:** When the dedicated linked credentials are available, run `pnpm verify:shared-content:linked`.

**Expected:** Exit 0 with hosted authorization, 0062 privacy, safe-link/no-egress, legacy cleanup, deleted-neighbor, exact-row, pagination, parsed-plan, deployment-boundary, and `finally` teardown cases passing.

**Why non-blocking:** This is hosted-environment confirmation, not an implementation gap. The current local verification is green, local linked aliases/project configuration are present, migration history/dry-run parity through 0062 pass, and no dedicated linked credentials were available to this execution.

The iOS simulator item is closed: Plan 11-12 records explicit `approved`, and the current independent `pnpm ios:test` run again passed on the intended simulator target. Host SwiftPM was not used as evidence.

## Residual Risks

- The optional linked behavioral gate is not rerun when its dedicated credentials are unavailable; this does not block the local phase result.
- The parsed EXPLAIN helper is a bounded local probe of the live-message/eligible-attachment path, supplemented by exact production RPC behavior checks.

## Gaps Summary

No implementation gap was found in the current checkout. Migration 0062 closes the legacy safe-link, tombstoned-attachment, and deleted-neighbor issues; current DNS validation closes the SSRF boundary; current reducers close request and conversation ownership races; the corrected strict probe closes the prior EXPLAIN evidence gap; and current strict comparator/native tests close parity-evidence weaknesses. Phase 11 is complete; the linked run is an optional environment follow-up.

## Smallest Follow-up Plan

Optionally run the existing `pnpm verify:shared-content:linked` command with its dedicated environment variables. No implementation change or new plan is required unless that hosted run reports a failure.

---

_Verified: 2026-07-22T22:48:19Z_
_Verifier: the agent (gsd-verifier)_
