---
phase: 12
slug: cross-platform-data-cache-and-recovery
status: checkpoint
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Task 1 Automated Evidence — 2026-07-24

Fixture metadata is safe-count only: `fixture_version=3`, `groups=16`, `expected_task1_cases=48`.

| Area | Exact command / target | Result |
|------|-------------------------|--------|
| Portable contract | `node --test packages/core/src/shared-content/shared-content.test.ts` | ✅ PASS — 13 tests |
| iOS fixture synchronization | `pnpm ios:chat-vectors:check` | ✅ PASS — 3 fixture files up to date |
| Android feature parity/store | `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests 'space.fishhub.android.feature.chat.sharedcontent.SharedContentParityTest' --tests 'space.fishhub.android.feature.chat.sharedcontent.SharedContentStoreTest'` | ✅ PASS |
| Android data shared-content unit suite | `scripts/android-gradle.sh :data:chat:testDebugUnitTest` | ✅ PASS |
| Android Room migration | `scripts/android-gradle.sh :data:chat:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=space.fishhub.android.data.chat.local.ChatDatabaseMigrationTest` on the local `Pixel_10_Pro_XL` AVD | ✅ PASS — 11 tests |
| Android Room cache | `scripts/android-gradle.sh :data:chat:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=space.fishhub.android.data.chat.sharedcontent.RoomSharedContentCacheStoreTest` on the local `Pixel_10_Pro_XL` AVD | ✅ PASS — 12 tests |
| Android repository | `scripts/android-gradle.sh :data:chat:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=space.fishhub.android.data.chat.sharedcontent.SharedContentRepositoryTest` on the local `Pixel_10_Pro_XL` AVD | ✅ PASS — 9 tests |
| Android identity/security | `scripts/android-gradle.sh :data:chat:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=space.fishhub.android.data.chat.sharedcontent.SharedContentIdentitySecurityTest` on the local `Pixel_10_Pro_XL` AVD | ✅ PASS — 5 tests |
| Android build/design/lint/screenshot validation | `pnpm android:check` | ✅ PASS — Gradle `check`, release assembly, design policy, lint, and screenshot validation |
| iOS package/data/repository/delivery/loader/recovery/identity suite | `pnpm ios:test` | ✅ PASS — `FishKit-Package` test suite |
| iOS application build | `pnpm ios:app:build` | ✅ PASS — simulator application build |
| Workspace lint/typecheck/build | `pnpm lint && pnpm typecheck && pnpm build` | ✅ PASS |
| Structural scope scan | `git diff --name-only HEAD -- apps/android apps/ios apps/web packages supabase` checked for gallery/navigation/settings/route/marketplace/community/gamification paths | ✅ PASS — no prohibited production scope path |
| Supabase migration drift scan | `git diff --name-only HEAD -- supabase/migrations` | ✅ PASS — no migration changes |
| Persistent-cache secret/temporary-field scan | `rg -n -i 'signed[_-]?url\|delivery[_-]?token\|access[_-]?token\|refresh[_-]?token\|temporary[_-]?(path\|file\|root)\|diagnostic[_-]?(url\|token)'` over Android cache entities/store and iOS Core Data cache surfaces | ✅ PASS — no matches |
| Backup/protection scan | `rg` assertions for Android `allowBackup="false"`, extraction rules, and iOS file-protection/backup-exclusion controls | ✅ PASS |
| Production sentinel-literal scan | `rg -n -i 'signed[-_ ]token[-_ ]sentinel\|signed-token-sentinel-for-tests'` over production source | ✅ PASS — no matches |
| Exact full Android connected matrix | `pnpm android:instrumented` on the local `Pixel_10_Pro_XL` AVD | ⚠️ FAIL — only unrelated pre-existing `DefaultChatRepositoryTest` retry and Chat/Settings Compose accessibility tests remain red; all isolated Phase 12 Android targets above pass |

The exact full Android command was rerun after the Phase 12 fixes. Its remaining failures are outside this plan's owning implementation scope and are preserved in `deferred-items.md`; no Phase 12 assertion was weakened. Because the cited full matrix is not entirely green, `wave_0_complete` and `nyquist_compliant` intentionally remain `false` until the workflow's complete-gate condition is satisfied.

## Task 2 Human Verification — Approved

Evidence is limited to platform, native test-host target, safe state labels, and counts.

| Platform | Native target | Safe observations | Result |
|----------|---------------|-------------------|--------|
| Android | Existing authenticated native test host | `visible_intent=present`; `lookahead_requests=0`; `lookahead_after_disable=restored` | ✅ APPROVED |
| iOS | Existing authenticated native test host | `visible_intent=present`; `lookahead_requests=0`; `lookahead_after_disable=restored` | ✅ APPROVED |
| Android | Existing authenticated native account-transition host | `a_hidden_before_b_bind=true`; `b_waited_for_zero=true`; `stale_a_rejected=true` | ✅ APPROVED |
| iOS | Existing authenticated native account-transition host | `a_hidden_before_b_bind=true`; `b_waited_for_zero=true`; `stale_a_rejected=true` | ✅ APPROVED |

Human approval does not override the documented unrelated failures in the exact full Android connected matrix; the two compliance flags therefore remain `false`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner for the portable TypeScript contract; JUnit 4, kotlinx-coroutines-test, and Room migration tests on Android; Swift Testing/XCTest through `FishKit-Package` on iOS |
| **Config file** | `package.json`, `apps/android/gradle/libs.versions.toml`, `apps/ios/FishKit/Package.swift` |
| **Quick run command** | `node --test packages/core/src/shared-content/shared-content.test.ts` |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm build && pnpm android:check && pnpm android:instrumented && pnpm ios:chat-vectors:check && pnpm ios:test && pnpm ios:app:build` |
| **Estimated runtime** | Portable suite under 30 seconds; focused native suite under 180 seconds; full suite measured during Wave 0 |

---

## Sampling Rate

- **After every portable-contract task:** Run `node --test packages/core/src/shared-content/shared-content.test.ts`.
- **After every Android feature task:** Run `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContent*'`.
- **After every Android data task:** Run `scripts/android-gradle.sh :data:chat:testDebugUnitTest`; run the focused connected Room test when schema or database files change.
- **After every iOS core/data task:** Run the targeted `SharedContentContractTests` or the new `ChatDataTests` suite.
- **After every plan wave:** Run `pnpm ios:chat-vectors:check && pnpm android:test && pnpm ios:test`.
- **Before `$gsd-verify-work`:** The complete workspace, Android, and iOS suites must be green.
- **Max feedback latency:** 180 seconds for focused tests.

---

## Per-Task Verification Map

| Task ID | Wave 0 plan/tasks | Wave | Requirement | Threat Ref | Secure Behavior | Automated Command | File Exists / pre-execution state | Implementation consumers | Status |
|---------|-------------------|------|-------------|------------|-----------------|-------------------|-----------------------------------|--------------------------|--------|
| 12-W0-01 | 12-01 T1/T2; 12-03 T1; 12-04 T2 | 0 | PRIV-02 | T-12-02 | Delivery URLs/tokens remain memory-only, refresh only when needed, and never enter persistent or diagnostic surfaces | `node --test packages/core/src/shared-content/shared-content.test.ts`; Android `*SharedContentDeliveryRegistryTest`; iOS `SharedContentDeliveryStoreTests`/sentinel suites | Existing-to-extend: `packages/core/src/shared-content/shared-content.test.ts`; missing-to-create: `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentDeliveryRegistryTest.kt`, `apps/ios/FishKit/Tests/ChatDataTests/SharedContentDeliveryStoreTests.swift` | 12-05, 12-09, 12-12, 12-14, 12-15 depend on the owning Wave 0 plans | ✅ green |
| 12-W0-02 | 12-02 T1/T2; 12-03 T2; 12-04 T1/T2 | 0 | PRIV-03 | T-12-01/T-12-04/T-12-07 | A data is unavailable after sign-out/unresolved/B; every private layer purges before bind and stale A callbacks are inert | Android Room/repository/identity focused suites; iOS Core Data/repository/identity focused suites | Missing-to-create: `RoomSharedContentCacheStoreTest.kt`, `SharedContentIdentitySecurityTest.kt`, `CoreDataSharedContentCacheTests.swift`, `SharedContentIdentityCoordinatorTests.swift`; existing-to-extend: `MessageImageLoaderTests.swift` | 12-06, 12-08, 12-10, 12-11, 12-13, 12-14, 12-15 depend on 12-02/03/04 as applicable | ✅ green |
| 12-W0-03 | 12-01 T1/T2; 12-03 T1/T2; 12-04 T2 | 0 | PAGE-03 | T-12-08 | Visible/lookahead/selected intent is deduplicated and chunked ≤50; OS data-saving suppresses lookahead only | Node vectors; Kotlin/Swift parity; Android delivery/store; iOS delivery/store suites | Existing-to-extend: canonical JSON/Node/Kotlin/Swift parity files; missing-to-create: Android/iOS delivery and store tests named above | 12-05, 12-09, 12-10, 12-12, 12-13 depend on 12-01/03/04 | ✅ green |
| 12-W0-04 | 12-01 T1/T2; 12-02 T1; 12-04 T1 | 0 | OFF-01 | T-12-01/T-12-03 | Wrong-owner cache is rejected; stale/incomplete are orthogonal; offline/no-cache is unavailable; authoritative zero alone is empty | Node/native parity plus Room/Core Data hydration suites | Existing-to-extend: canonical parity files, Android migration/DAO tests; missing-to-create: `RoomSharedContentCacheStoreTest.kt`, `CoreDataSharedContentCacheTests.swift` | 12-05, 12-06, 12-07, 12-08, 12-11 depend on 12-01/02/04 | ✅ green |
| 12-W0-05 | 12-01 T1/T2; 12-03 T2; 12-04 T2 | 0 | OFF-02 | T-12-07/T-12-08 | Trigger bursts coalesce; attempt 0 retries once as attempt 1; second failure enables manual retry without blanking cache | Node/native parity; Android/iOS `SharedContentStore` suites | Existing-to-extend: canonical parity files; missing-to-create: `SharedContentStoreTest.kt`, `SharedContentStoreTests.swift` | 12-05, 12-10, 12-13 depend on 12-01/03/04 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Required Security and Recovery Matrix

Automated coverage must include A→B, A→signed-out, unresolved identity, another conversation, membership loss, a stale A callback after B binds, process restart with leftover temporary files, delivery-token rotation, URL expiry-margin refresh, one 401/403 URL refresh without looping, repeated page and tombstone events, connectivity loss during delayed retry, and trigger bursts while a recovery cycle is already in flight. Every portable, Android, and iOS repository/parity fixture that exercises 40+1 paging must request `p_limit = 40`, allow at most 41 returned rows indexed 0–40, retain indexes 0–39, derive `nextCursor` from retained index 39, and use optional index 40 only to set `hasMore = true`; no fixture may access index 41 or derive a cursor from index 40.

A structural secret-sentinel test must inject a recognizable fake signed token, exercise refresh, display, retry, and purge, then scan Room/Core Data, cache filenames and bytes, temporary roots, and captured diagnostic projections. The sentinel count must be zero outside the live in-memory test probe.

---

## Wave 0 Requirements

- [ ] **12-01 T1:** extend canonical JSON and Node projections for cache truth, eviction, recovery, delivery/data-saving, URL non-persistence, identity generation, and the exact retained-index-39/continuation-index-40 paging invariant.
- [ ] **12-01 T2:** extend strict Kotlin/Swift parity decoders/tests, including the exact retained-index-39/continuation-index-40 paging projection, and synchronize iOS bytes.
- [ ] **12-02 T1/T2:** extend Android migration/DAO tests and create Room cache/repository connected tests, with repository cases proving indexes 0–39 retained, `nextCursor` from index 39, optional index 40 setting `hasMore`, and no index 41 access.
- [ ] **12-03 T1/T2:** create Android delivery, thumbnail, recovery-store, identity-coordinator, and identity-security tests.
- [ ] **12-04 T1/T2:** create iOS Core Data, repository/network, delivery, thumbnail, recovery-store, and identity tests; make repository cases prove indexes 0–39 retained, `nextCursor` from index 39, optional index 40 setting `hasMore`, and no index 41 access; extend `MessageImageLoaderTests.swift`.
- [ ] **12-01/02/03/04:** include structural signed-sentinel tests across databases, files, temp roots, URL stores, and diagnostics.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Data Saver and Low Data Mode keep visible thumbnails available while pausing lookahead | PAGE-03 | Platform network-policy signaling and visible scrolling behavior require device/simulator observation | Enable the platform data-saving mode, open a cached gallery, scroll one viewport, and verify visible thumbnails may load while lookahead requests remain absent from captured diagnostics |
| Account change clears decoded media and temporary artifacts before the new account becomes observable | PRIV-03 | OS-managed decoded-memory and temporary-file behavior needs end-to-end lifecycle observation | Sign in as A, display media, switch to B, and verify no A thumbnail, preview, metadata, temporary file, or delayed completion appears |

---

## Validation Sign-Off

- [ ] Every task has an automated verification command or an explicit Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive tasks lack automated verification.
- [ ] Wave 0 covers every missing test reference.
- [ ] No watch-mode flags are used.
- [ ] Focused feedback latency is below 180 seconds.
- [ ] Room migration 8→9 passes on an emulator/device and preserves unrelated chat data.
- [ ] TypeScript, Kotlin, and Swift replay the same fixture corpus with identical outcomes.
- [ ] The secret-sentinel scan finds no delivery URL or token in persistent or diagnostic surfaces.
- [ ] The account-transition adversary matrix passes for Room/Core Data, disk, decoded memory, URL leases, in-flight tasks, and temporary files.
- [ ] `nyquist_compliant: true` is set in frontmatter after all requirements map to green tests.

**Approval:** approved
