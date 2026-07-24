---
phase: 11-shared-content-contract-and-privacy-boundary
reviewed: 2026-07-22T12:17:57Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - apps/android/feature/chat/build.gradle.kts
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt
  - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt
  - apps/ios/FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift
  - apps/ios/FishKit/Sources/TestSupport/Fixtures/SharedContentVectors.swift
  - apps/ios/FishKit/Sources/TestSupport/Resources/shared-content-vectors.json
  - apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift
  - packages/core/package.json
  - packages/core/src/index.ts
  - packages/core/src/shared-content/classification.ts
  - packages/core/src/shared-content/fixtures/shared-content-vectors.json
  - packages/core/src/shared-content/index.ts
  - packages/core/src/shared-content/ordering.ts
  - packages/core/src/shared-content/shared-content.test.ts
  - packages/core/src/shared-content/state.ts
  - packages/core/src/shared-content/types.ts
  - packages/core/tsconfig.json
  - packages/supabase/src/database.generated.ts
  - packages/supabase/src/database.types.ts
  - package.json
  - scripts/sync-ios-chat-vectors.mjs
  - scripts/verify-shared-content.ts
  - supabase/functions/_shared/link-preview.test.ts
  - supabase/functions/_shared/link-preview.ts
  - supabase/functions/chat-image-command/index.ts
  - supabase/migrations/0061_shared_content_contract.sql
findings:
  critical: 4
  warning: 6
  info: 0
  total: 10
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-22T12:17:57Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

The shared-content contract has useful cross-platform fixtures and explicit keyset fields, but the database and link-preview boundaries are not self-protecting. Unsafe or stale link identities can enter the normalized contract, redirect handling breaks parity, and the URL guard does not prevent DNS-based SSRF. The context and reducer implementations also have privacy/pagination edge cases, while the iOS and live-verifier tests leave important regressions undetected.

## Critical Issues

### CR-01 [BLOCKER]: Unsafe link-preview rows are trusted by the database contract

**File:** `supabase/migrations/0061_shared_content_contract.sql:8-30,368-372,473-478`
**Issue:** The migration backfills `message_link_previews` from every existing job without revalidating the URL, and both the listing and category RPCs treat every joined preview row as a canonical safe link. A service-role write or legacy job containing `http://127.0.0.1/...`, credentials, a fragment, or another invalid identity is therefore exposed through the shared-content RPC. The verifier's direct unsafe-row case would fail against this SQL because the link union has no URL/hostname safety predicate.
**Fix:** Make canonical identity an enforced database invariant: validate/backfill only rows that pass the same canonical policy, reject unsafe writes (prefer a narrowly scoped service function plus a constraint/validated marker), and have both RPCs require the invariant and `url`/`hostname` consistency before returning a link.

### CR-02 [BLOCKER]: Redirected previews corrupt the canonical hostname and break platform parity

**File:** `supabase/functions/_shared/link-preview.ts:64-77,135-143`; `packages/core/src/shared-content/classification.ts:24-33`
**Issue:** `fetchLinkPreview` returns the original URL but the hostname of the final redirect destination. `processLinkPreviewJobs` then overwrites the canonical row with that pair. The shared classifier requires `new URL(linkUrl).hostname === linkHostname`, so a safe URL that redirects from `example.com` to `final.example` is accepted by SQL but rejected by TypeScript, Android, and Swift; consumers that render the SQL row instead receive an internally inconsistent URL/hostname pair.
**Fix:** Preserve the canonical source hostname when enriching, or store the final URL as the canonical URL. Keep redirect metadata separate from the identity used by the classifier, and add a cross-platform redirect test.

### CR-03 [BLOCKER]: Public-host validation is vulnerable to DNS-based SSRF

**File:** `supabase/functions/_shared/link-preview.ts:25-37,219-237`
**Issue:** The fetcher rejects literal private IPs but allows arbitrary public-looking hostnames. A hostname controlled by an attacker can resolve to loopback, link-local, RFC1918, or cloud metadata addresses, and DNS rebinding can change the answer between validation and `fetch`. This is a server-side request forgery path because the Edge Function fetches the URL and follows redirects.
**Fix:** Resolve every A/AAAA answer and reject all non-public ranges, prevent rebinding by pinning the validated address for the request, or route requests through an egress proxy with private-network and metadata blocking. Apply the same checks to every redirect.

### CR-04 [BLOCKER]: Existing deleted-message attachments are never scheduled for cleanup

**File:** `supabase/migrations/0061_shared_content_contract.sql:5-6,688-697`
**Issue:** Adding `delete_requested_at` does not backfill it for attachments already bound to messages whose `deleted_at` is non-null. The new cleanup claim only selects rows with a non-null marker, so every pre-Phase-11 deleted message attachment is permanently skipped even though its Storage objects remain. This violates the deletion privacy/retention boundary for existing data.
**Fix:** In the migration, stamp `delete_requested_at` for every bound attachment whose source message is already tombstoned, then run it through the same retry-safe cleanup path. Keep the source-message predicate in the backfill and add a regression fixture for legacy tombstones.

## Warnings

### WR-01 [WARNING]: Around-message context returns deleted neighboring rows

**File:** `supabase/migrations/0061_shared_content_contract.sql:561-590,592-628`
**Issue:** The target is required to be nondeleted, but the older/newer queries and both gap probes do not filter `message.deleted_at is null`. The RPC can return tombstoned neighbors (including their `deleted_at` and body fields), and hidden deleted rows can make the gap flags claim continuity that the caller cannot actually display.
**Fix:** Add the nondeleted predicate to both neighbor CTEs and both gap probes, and test a deleted row immediately before and after a live target.

### WR-02 [WARNING]: Metadata-write failures permanently complete preview jobs

**File:** `supabase/functions/_shared/link-preview.ts:134-146`
**Issue:** The result of the enriched `message_link_previews.upsert` is ignored. If that write fails, the code still updates the job to `complete`, so a transient database failure loses enrichment permanently and the job will not retry.
**Fix:** Check the upsert result; only mark `complete` after success, otherwise use the same bounded backoff/attempt transition as the fetch-error path.

### WR-03 [WARNING]: Reducers accept content whose item conversation disagrees with the event

**File:** `packages/core/src/shared-content/state.ts:50-62,103-123`; `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt:351-362,390-411`; `apps/ios/FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift:433-441,485-505`
**Issue:** Ownership checks validate only the event's identity and conversation. Page items and realtime items are merged without checking each item's `conversationId` against that event/current conversation. A misrouted realtime or stale-cache payload can therefore place another conversation's item into the active gallery state.
**Fix:** Reject pages containing any item with a mismatched conversation (and reject mismatched realtime items), or validate and normalize the payload at the transport boundary before dispatching it to all three reducers.

### WR-04 [WARNING]: Out-of-order page loads can move the cursor backwards

**File:** `packages/core/src/shared-content/state.ts:58-60,103-123`; native equivalents in `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt:361-411` and `apps/ios/FishKit/Sources/ChatCore/SharedContent/SharedContentState.swift:438-505`
**Issue:** Every `pageLoaded` event overwrites `nextCursor` and `hasMore`, even when `appendPage` identifies the page as a duplicate or an older request completes after a newer page. Concurrent loads can consequently repeat pages, regress the cursor, or stop pagination early.
**Fix:** Add a request/page sequence or cursor-generation token to page events and ignore stale completions; at minimum, do not update continuation state when the page is already present or is older than the accepted cursor.

### WR-05 [WARNING]: iOS parity tests do not assert several important projections

**File:** `apps/ios/FishKit/Tests/ChatCoreTests/SharedContentContractTests.swift:21-28,30-40,164-183`
**Issue:** Unknown fixture item IDs are silently dropped with `compactMap`, page assertions only distinguish empty from nonempty, `nextCursor` is checked only for nil/non-nil, and the gallery-state assertion compares `status.rawValue` with itself. These tests can remain green while Swift ordering/page/cursor behavior drifts from TypeScript and while fixture references are malformed.
**Fix:** Fail on missing fixture IDs, compare full page and cursor values, and compare each decoded status to the fixture's wire string. Assert the permission fields that the vector declares, including `canDelete` and `canExport`.

### WR-06 [WARNING]: The live verifier's reference ordering is locale-dependent and underchecks returned fields

**File:** `scripts/verify-shared-content.ts:109-114,520-553`
**Issue:** The verifier uses default `localeCompare` instead of the contract's C/codepoint ordering, so its reference sequence is environment-dependent. It also compares mostly item IDs; a row with the right ID but the wrong kind/category/source fields can pass the pagination checks. This weakens the main adversarial gate for parity and classification regressions.
**Fix:** Reuse the canonical comparator or implement explicit codepoint comparison, and compare every returned row's normalized fields against the seeded expected descriptors before accepting pagination/reference equality.

---

_Reviewed: 2026-07-22T12:17:57Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
