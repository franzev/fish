---
phase: 11
slug: shared-content-contract-and-privacy-boundary
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Local Supabase/Postgres integration scripts; Node test runner for TypeScript; JUnit through the Android Gradle wrapper; Swift Testing through SwiftPM |
| **Config file** | `package.json`, `apps/android/gradle/libs.versions.toml`, `apps/ios/FishKit/Package.swift` |
| **Quick run command** | `pnpm verify:shared-content && node --experimental-strip-types --test packages/core/src/shared-content/shared-content.test.ts` |
| **Full suite command** | `pnpm build && pnpm lint && pnpm typecheck && pnpm android:test && pnpm ios:test` |
| **Estimated runtime** | Quick suite target: under 120 seconds; full suite measured during Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run the focused test for the changed contract plus `pnpm build`.
- **After every schema task:** Reset/migrate the local database and run `pnpm verify:shared-content`.
- **After every parity task:** Run the focused TypeScript, Kotlin, and Swift vector suites.
- **After every plan wave:** Run `pnpm build && pnpm lint && pnpm typecheck` plus applicable native suites.
- **Before `$gsd-verify-work`:** The complete database, workspace, Android, and iOS suites must be green.
- **Max feedback latency:** 120 seconds for the quick suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-W0-01 | TBD | 0 | DISC-03 | T-11-03 | Only the seven eligible kinds enter the normalized contract; every excluded state stays absent | DB integration + parity | `pnpm verify:shared-content` | ❌ W0 | ⬜ pending |
| 11-W0-02 | TBD | 0 | PRIV-01 | T-11-01, T-11-02 | Only authenticated conversation members can list content or query nondeleted child metadata | Adversarial RLS integration | `pnpm verify:shared-content` | ❌ W0 | ⬜ pending |
| 11-W0-03 | TBD | 0 | PAGE-01 | T-11-04 | Forty retained rows plus one sentinel are returned without transcript hydration | DB integration + query plan | `pnpm verify:shared-content` | ❌ W0 | ⬜ pending |
| 11-W0-04 | TBD | 0 | PAGE-02 | T-11-04 | Deep cursors, ties, inserts, and tombstones produce no skipped or duplicated item IDs | DB integration + cross-platform parity | `pnpm verify:shared-content && scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentParityTest' && (cd apps/ios/FishKit && swift test --filter SharedContentContractTests)` | ❌ W0 | ⬜ pending |
| 11-W0-05 | TBD | 0 | PAR-01 | T-11-05 | TypeScript, Kotlin, and Swift replay one fixture corpus with identical outcomes | Cross-platform unit | `node --experimental-strip-types --test packages/core/src/shared-content/shared-content.test.ts && scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentParityTest' && (cd apps/ios/FishKit && swift test --filter SharedContentContractTests)` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Required Security and Data Matrix

`pnpm verify:shared-content` must cover signed-out, outsider, other-conversation member, former/blocked member, authorized member, cross-conversation cursor reuse, invalid category, out-of-range limit, partial/tampered cursor, every attachment state, ready-unbound rows, source/attachment conversation mismatch, unsupported ready MIME, deleted source, direct link-preview access after deletion, equal timestamps, multiple items per source, sender versus recipient deletion, repeated deletion, delivery URL refresh before/after deletion, cleanup retry, missing Storage objects, anonymous function execution, and direct-table as well as RPC access.

Capture the behavior of a URL issued before tombstoning separately: new issuance is denied immediately and cleanup is prompt, but an already-issued bearer URL may remain usable until its 15-minute expiry or earlier object removal.

---

## Query-Plan Gate

Seed at least one long conversation with thousands of ordinary messages, mixed eligible kinds, tombstones, and ineligible attachments. Record `EXPLAIN (ANALYZE, BUFFERS)` for the unfiltered first page, each category, a deep cursor, and category availability. Compare the optimized result's full ordered `item_id` list with a simple reference query before accepting any per-branch limit or new partial index.

---

## Wave 0 Requirements

- [ ] `scripts/verify-shared-content.ts` — deterministic seed, authorization matrix, link-deletion regression, sentinel/cursor assertions, cleanup checks, and long-history query plans.
- [ ] Root `verify:shared-content` package script.
- [ ] `packages/core/src/shared-content/fixtures/shared-content-vectors.json` and TypeScript replay tests.
- [ ] Android `SharedContentParityTest.kt` with fixture resource wiring.
- [ ] Swift `SharedContentVectors.swift` and `SharedContentContractTests.swift` with sync/check script support.
- [ ] Generated Supabase type drift check after local migration.
- [ ] Hosted migration-list and deployment verification for migrations 0059, 0060, and the new Phase 11 migration.

---

## Manual-Only Verifications

All Phase 11 contract behavior must have automated verification. Hosted deployment evidence may require operator credentials, but its migration state and command result must be captured as a blocking execution artifact rather than accepted by visual inspection.

---

## Validation Sign-Off

- [ ] All tasks have an automated verification command or an explicit Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers every currently missing test reference.
- [ ] No watch-mode flags are used.
- [ ] Quick feedback latency is below 120 seconds.
- [ ] Local and hosted migration lists include 0059, 0060, and the Phase 11 migration before feature verification.
- [ ] TypeScript, Kotlin, and Swift fixture results agree.
- [ ] `nyquist_compliant: true` is set in frontmatter after all requirements are mapped to green tests.

**Approval:** pending
