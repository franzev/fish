---
phase: 12
slug: cross-platform-data-cache-and-recovery
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-07-24
---

# Phase 12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Verified identity → local cache | Cache hydration and mutation must remain scoped to the exact owner, conversation, and generation | Private message metadata, membership state, cursors, and tombstones |
| Signed delivery → memory and files | Short-lived delivery credentials must remain ephemeral; private media may persist only through protected, contained thumbnail storage | Signed URLs, tokens, decoded bytes, and thumbnails |
| Old asynchronous work → current identity | Delayed callbacks must not mutate cache, leases, decoded memory, or files after an identity generation changes | Provider results, delivery leases, staged media, and recovery results |
| Filesystem and database → identity transition | Purge-before-bind must remove all prior-owner private state and remain final across failures or process interruption | Room/Core Data rows, memory leases, staged bytes, and thumbnail files |
| Lifecycle/network signals → recovery | Bursty or constrained signals must not create unbounded fetch, retry, cache, or delivery work | Item identifiers, recovery attempts, cache entries, and network requests |
| Runtime state → diagnostics/presentation | User-visible and diagnostic projections must expose only closed, provider-neutral fields | Operation names, outcomes, categories, and safe counts |
| Package manifests → build | Dependency changes could introduce unreviewed supply-chain code | Package declarations, manifests, and lockfiles |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|-----------------------|--------|
| T-12-01 | Information disclosure | Private cache isolation | mitigate | Android uses compound owner/conversation keys and exact hydration (`ChatEntities.kt:159-245`, `RoomSharedContentCacheStore.kt:118-139`), covered by wrong-owner tests (`RoomSharedContentCacheStoreTest.kt:210-241`). iOS uses compound Core Data constraints and exact predicates (`SharedContentCache.xcdatamodel/contents:3-72`, `CoreDataSharedContentCache.swift:100-136,380-413`), covered by wrong-owner/conversation tests (`CoreDataSharedContentCacheTests.swift:8-35`). | closed |
| T-12-02 | Information disclosure | Signed delivery credentials and durable schemas | mitigate | Durable schemas contain no signed URL, token, credential, or runtime-path fields. Android leases are process-local and bounded by `BoundedAttachmentDeliveryCache` (`BoundedAttachmentDeliveryCache.kt:16-69`). iOS leases are non-`Codable`, memory-only, and use an ephemeral no-cache/cookie/credential session (`SharedContentDeliveryStore.swift:3-55`). Production sentinel scan found zero occurrences. | closed |
| T-12-03 | Spoofing / elevation | Owner and membership authority | mitigate | Android requires signed-in owner, coordinator generation, and authoritative conversation membership before cache mutation (`DefaultChatRepository.kt:848-885`). iOS verifies owner and directory membership (`SupabaseSharedContentRepository.swift:147-189`). Cached state does not provide authority. | closed |
| T-12-04 | Tampering / information disclosure | Identity transitions | mitigate | Android visibility jobs capture owner, conversation, and generation, recheck identity before submission, and are cancelled on rebind (`SharedContentStore.kt:281-301,465-472`). iOS hides state, advances and revokes generation, purges, verifies, then publishes eligibility (`SharedContentIdentityCoordinator.swift:128-184,226-306`). The live cache and thumbnail store are directly wired into the production purge port (`FishApp.swift:482-490`). | closed |
| T-12-05 | Tampering / information disclosure | Filesystem purge and staged media | mitigate | Android uses contained opaque paths, atomic writes, staged-memory purge, and absence proof (`SharedContentThumbnailStore.kt:174-198,213-259`). iOS thumbnail keys carry generation; stage, confirm, and read reject revoked generations, and revocation removes staged bytes (`SharedContentThumbnailStore.swift:119-155,185-236`). Purge verification checks persisted files and staged memory (`SharedContentIdentityCoordinator.swift:290-306`). | closed |
| T-12-06 | Information disclosure / repudiation | Diagnostics and presentation | mitigate | Android diagnostics expose only operation, success, duration, and failure category (`ChatDiagnostics.kt:30-52`). iOS uses closed failure and presentation vocabularies (`SharedContentProviding.swift:161-183`, `SharedContentStore.swift:455-504`). Diagnostic scans found no sentinel, URL, token, path, or row-dump occurrence. | closed |
| T-12-07 | Tampering | Stale asynchronous callbacks | mitigate | Portable events require an exact positive safe generation (`state.ts:51-75,134-145`). Android cache publication is epoch-fenced and repository writes recheck identity under the identity mutex (`BoundedAttachmentDeliveryCache.kt:29-48`, `DefaultChatRepository.kt:369-398`). iOS cache writes are actor-fenced by generation (`CoreDataSharedContentCache.swift:101-110,187-223,274-315`), while repository, delivery, thumbnail, and loader paths recheck after awaited work. | closed |
| T-12-08 | Denial of service | Delivery and recovery bounds | mitigate | Portable recovery retains 500 ms coalescing, attempts 0/1, and 50-ID batches. Android live delivery refreshes in 50-ID batches and retains at most 400 leases (`DefaultChatRepository.kt:419-437`, `BoundedAttachmentDeliveryCache.kt:51-69`); the suspended-refresh regression verifies `50/50/1` batching. iOS delivery retains the same 50-ID and 400-lease bounds with epoch cancellation (`SharedContentDeliveryStore.swift:61-64,120-149,176-210`). | closed |
| T-12-SC | Tampering | Package supply chain | accept | Phase 12 introduced no dependency or lockfile changes. `apps/ios/FishKit/Package.swift` changed only to process an existing resource directory. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-12-01 | T-12-SC | Phase 12 installed no packages and changed no dependency resolution. The residual risk is limited to the project's already-approved dependency set. | Product owner delegation | 2026-07-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Verification Checks

| Check | Result |
|-------|--------|
| `node --test packages/core/src/shared-content/shared-content.test.ts` | 14 passed |
| `pnpm ios:chat-vectors:check` | All three fixture copies current |
| Focused Android shared-content data and feature unit suites | Passed |
| Android suspended-refresh/bounded-batch device regression | Passed |
| Android `SharedContentIdentitySecurityTest` device suite | 5 passed |
| Focused iOS cache, repository, delivery, store, identity, and loader suites | Passed |
| `pnpm ios:app:build` | Passed |
| `pnpm lint`, `pnpm typecheck`, and `pnpm build` | Passed |
| Production signed-credential sentinel scan | Zero occurrences |
| Durable Android Room and iOS Core Data schema scan | No lease, token, or runtime-authority fields |
| Android backup rules | `allowBackup=false` and root exclusions verified |
| iOS cache storage | Complete protection and backup exclusion verified |

The adversarial suites exercise suspended refresh, purge/rebind, missing-generation, bounded-delivery, and late metadata/thumbnail write interleavings.

---

## Security Audit 2026-07-24

| Metric | Count |
|--------|-------|
| Threats found | 9 |
| Closed | 5 |
| Open | 4 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-24 | 9 | 5 | 4 | GSD security auditor |
| 2026-07-24 | 9 | 9 | 0 | GSD security auditor, remediation re-audit at `ff1d0c39` |

## Remediation Re-audit 2026-07-24

| Metric | Count |
|--------|-------|
| Threats found | 9 |
| Closed | 9 |
| Open | 0 |

**Verdict:** `SECURED` at commit `ff1d0c39`. No unregistered threat flags.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** secured — all registered Phase 12 threats are closed or explicitly accepted.
