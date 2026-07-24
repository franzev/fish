---
phase: 13
slug: calm-gallery-browsing
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-24
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner and TypeScript compile; JUnit 4, Compose UI tests, Room migration tests, and Compose screenshot tests on Android; Swift Testing/XCTest and SnapshotTesting through `FishKit-Package` on iOS |
| **Config file** | `package.json`, `apps/android/gradle/libs.versions.toml`, `apps/ios/FishKit/Package.swift` |
| **Quick run command** | `node --test packages/core/src/shared-content/shared-content.test.ts && scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContent*'` |
| **Full suite command** | `pnpm android:check && pnpm ios:test && pnpm ios:app:build && pnpm build` |
| **Estimated runtime** | Focused contract and feature tests under 180 seconds; full native and workspace suite measured during execution |

---

## Sampling Rate

- **After every shared-contract task:** Run `node --test packages/core/src/shared-content/shared-content.test.ts` plus the Kotlin/Swift parity targets affected by the change.
- **After every Android feature task:** Run `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContent*'`; run the focused Compose navigation or screenshot target when UI/navigation changes.
- **After every Android data task:** Run `scripts/android-gradle.sh :data:chat:testDebugUnitTest`; run the focused Room migration test when persisted fields change.
- **After every iOS task:** Run the closest `PersonalChatTests` or `ChatDataTests` shared-content target through `FishKit-Package`.
- **After every plan wave:** Run `pnpm ios:chat-vectors:check && pnpm android:test && pnpm ios:test`.
- **Before phase verification:** `pnpm android:check`, `pnpm ios:test`, `pnpm ios:app:build`, and `pnpm build` must be green.
- **Max feedback latency:** 180 seconds for focused tests.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-W0-01 | 13-02, 13-11, 13-13 | 0, 5, 6 | DISC-01 | T-13-01, T-13-04 | Header and details entry stay conversation-owned; Back restores the correct origin without exposing another conversation | Android Compose navigation | `scripts/android-gradle.sh :feature:chat:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=space.fishhub.android.feature.chat.SharedContentNavigationTest` | ✅ | ✅ green |
| 13-W0-02 | 13-03, 13-12, 13-13 | 0, 5, 6 | DISC-01 | T-13-01, T-13-04 | Header and details routes bind the verified owner/conversation once and revoke gallery visibility on pop or identity change | iOS navigation/model | `(cd apps/ios/FishKit && xcodebuild test -scheme FishKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:PersonalChatTests/SharedContentNavigationTests)` | ✅ | ✅ green |
| 13-W0-03 | 13-01, 13-07 through 13-10, 13-13 | 0, 3, 4, 6 | DISC-02 | T-13-02 | Populated-only categories preserve canonical order, remove the one-option control, retain valid selection, and fall back safely after removal | Portable/native unit | `node --test packages/core/src/shared-content/gallery.test.ts` plus focused native gallery-model suites | ✅ | ✅ green |
| 13-W0-04 | 13-07, 13-08, 13-13 | 3, 6 | DISC-02 | T-13-02 | Global older-page completion may add categories without switching the current valid selection or moving the visible anchor | Android/iOS presenter unit | `scripts/android-gradle.sh :feature:chat:testDebugUnitTest --tests '*SharedContentGalleryPresenterTest*'` plus `PersonalChatTests/SharedContentGalleryModelTests` | ✅ | ✅ green |
| 13-W0-05 | 13-02, 13-03, 13-09, 13-10, 13-13 | 0, 4, 6 | DISC-02 | T-13-03 | One and four category layouts, loading/cache/stale/empty/offline states, and every supported item kind remain equivalent across platforms | Native screenshots/snapshots | `pnpm android:screenshots && pnpm ios:test` | ✅ | ✅ green |
| 13-W0-06 | 13-01, 13-04 through 13-06, 13-13 | 0, 2, 6 | DISC-02 | T-13-02, T-13-03 | Nullable voice duration survives provider/cache/fixture projection; absent legacy values render “Duration unavailable” without inventing data | RPC/decoder/cache/migration | `pnpm verify:shared-content`, Android data tests, and focused iOS repository/cache suites | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Required Semantic and Snapshot Matrix

Both platforms must cover light, dark, RTL, accessibility text, loading, one category, four categories, cached, stale, authoritative empty, offline unavailable, older-page busy, older-page failure, and every supported item kind.

Functional tests must additionally cover zero accepted categories while loading versus authoritative empty; a realtime-added category; selected-category removal; legacy voice duration; duplicate earlier-tap suppression; failed earlier requests retaining items and anchor; an accepted page with no item in the selected category; sign-out or owner switch during refresh; and category switching without starting a recovery cycle.

## Executed Phase Gate Evidence

All commands ran locally on 2026-07-24. No linked or hosted Supabase environment was accessed.

| Gate | Requirement | Result | Reproducible evidence |
|------|-------------|--------|-----------------------|
| Portable gallery oracle | DISC-02 | ✅ 8/8 | `node --test packages/core/src/shared-content/gallery.test.ts` proves fixture accounting, exact frozen category order, populated-only projection, selection retention/fallback, global earlier append/anchor preservation, single-flight failure truth, nullable/zero/trusted/invalid duration, and 40+1 sentinel handling. |
| Fixture parity | DISC-02 | ✅ | `pnpm ios:chat-vectors:check` reports all three iOS fixture copies byte-current. |
| Local backend | DISC-02, T-13-01..03 | ✅ 84 assertions | `pnpm supabase:start && pnpm db:reset && pnpm verify:shared-content` proves authorized exact 29-field rows, explicit legacy null, trusted non-negative duration, negative rejection, member write denial, former-member denial, fixed populated category order, 40+1 paging, complete-row equality, deletion revocation, generated-contract parity, and no duration input in sending/upload commands. |
| Android native matrix | DISC-01, DISC-02 | ✅ | `scripts/android-gradle.sh :data:chat:testDebugUnitTest :data:chat:connectedDebugAndroidTest :feature:chat:testDebugUnitTest :feature:chat:connectedDebugAndroidTest :feature:chat:validateDebugScreenshotTest` passes 78 data connected tests, 28 feature connected tests, the host unit suites, and gallery screenshot references on `Pixel_10_Pro_XL`, API 37. |
| iOS focused native matrix | DISC-01, DISC-02 | ✅ 74 tests | The Plan 13-13 focused `xcodebuild test` command passes 27 repository/cache tests and 47 store/identity/model/navigation/snapshot tests on iPhone 17 Pro. |
| Android release/design gate | DISC-01, DISC-02 | ✅ | `pnpm android:check` passes design-system policy, unit/lint/release assembly, and every chat/call/presence/settings screenshot validation target. |
| Complete iOS package gate | DISC-01, DISC-02 | ✅ | `pnpm ios:test` passes every FishKit test target, including production gallery navigation, state, cache, identity, and snapshots. |
| iOS app composition | DISC-01 | ✅ | `pnpm ios:app:build` regenerates the Xcode project and builds the Fish app plus share extension for iPhone 17 Pro. |
| Workspace quality | DISC-01, DISC-02 | ✅ | `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass. |
| Web component boundaries | Repository convention | ✅ 10/10 | `pnpm --filter @fish/web exec vitest run tests/module-boundaries.test.ts` proves zero loose component implementations and zero component folders without `index.ts`. |
| Production entry reachability | DISC-01, T-13-01, T-13-04 | ✅ Android 4/4; iOS 10/10 | Android renders the production `ChatTopBar` and `ParticipantDetailsSheet`, distinguishes both entry tags, activates both origins, and proves the exact Back/focus paths. iOS renders the production `PersonalChatTopBar` and `ConversationDetailsSheet` with distinct accessibility identifiers while the navigation contract activates both explicit origins and proves their return stacks. |
| Focused lifecycle audit | DISC-01, DISC-02 | ✅ Android + 38 iOS tests | The final Android presenter/navigation command and iOS navigation/store/identity/model command pass after the production reachability corrections. |
| Dependency/supply-chain audit | T-13-SC | ✅ zero files | The deterministic Phase 13 base `4b21c61b801fdadd2f9b63d02f755c50a66d4257` produces no manifest, lockfile, Gradle catalog, or Swift package diff. |
| Gallery privacy/deferred-surface scans | T-13-03 | ✅ | Gallery production boundaries contain no signed URL, storage path, cache locator, provider error, sender/date context, enabled deferred action, autoplay/gesture action, or out-of-scope product surface. |

### Android connected-gate correction

The first connected run correctly remained incomplete: no emulator was attached. After the repository AVD was booted, the matrix exposed deterministic pre-existing harness defects rather than product failures:

- attachment-import fixtures expired on the execution date, so their fixed expiry was moved to a clearly future test-only instant;
- the manual-retry case now uses a non-outbox message, preserving its intended remote-failure/retry assertion;
- the search assertion now addresses the editable field semantically instead of colliding with the screen heading;
- bottom-sheet tests now model host dismissal and update content through one Compose root.

The corrected focused suites and the exact complete Android matrix then passed without deleting, skipping, or weakening any assertion.

### Production reachability correction

The final audit rejected harness-only reachability evidence. Android navigation tests now render the real `ChatTopBar` and `ParticipantDetailsSheet`; the production participant control has an explicit localized Conversation details semantic, and focus restoration waits for the Material sheet to reach `Expanded` before requesting focus. iOS production entry controls now expose stable, origin-specific accessibility identifiers and are rendered in the native navigation suite. The resulting suites assert the two Shared content labels and identities semantically, activate both explicit origin contracts, and retain exact Back/focus behavior.

---

## Multi-Source Coverage Audit

| Source | In-scope item | Final evidence | Status |
|--------|---------------|----------------|--------|
| GOAL | Calm native shared-content browsing from the real direct conversation | Production Android/iOS entry renders, native gallery state/snapshot suites, and app composition gates | ✅ covered |
| REQ DISC-01 | Exactly two entries: quiet header photo icon and full-width details row | Android production tags plus iOS `SharedContentEntry.allCases` and distinct production accessibility identifiers; origin activation/Back/focus suites | ✅ complete |
| REQ DISC-02 | Browse conversation attachments by populated Media/Files/Links/Voice categories | Portable oracle, 84 backend assertions, native presenter/model/cache tests, full screenshot matrix | ✅ complete |
| RESEARCH | Nullable trusted duration end to end; legacy value remains unavailable | Exact 29-field backend rows, Android Room/repository tests, iOS Core Data/repository tests, UI projections | ✅ covered |
| RESEARCH | Extend Phase 12 RPC/repositories/caches/stores; global 40+1 paging and stale rejection | Backend 40+1 proof plus Android/iOS generation, request, cursor, destination, paging, and cache tests | ✅ covered |
| RESEARCH | Real Android/iOS production composition, lifecycle, identity, private delivery boundary | Production entry render tests, Android connected route test, iOS store/identity suite, app build | ✅ covered |
| RESEARCH | Native category/layout/state/accessibility/visual proof without new dependencies | Android screenshot references, iOS snapshots, semantic suites, and zero-file dependency audit | ✅ covered |
| CONTEXT | Header/details placement, full-screen route, explicit origin, exact Back paths | Exactly two distinct entries and both origin-bearing return stacks | ✅ covered |
| CONTEXT | Fixed populated-only order, hide at one, selection lifecycle | Portable oracle plus both native presenter/model suites | ✅ covered |
| CONTEXT | Approved Media/Files/Links/Voice metadata only | Projection tests and clean private-field scan | ✅ covered |
| CONTEXT | Loading/cache/stale/empty/offline/recovery/manual retry truth | Native model, screenshot, and snapshot matrices | ✅ covered |
| CONTEXT | One global Show earlier boundary preserving items/selection/anchors | Portable and native paging/single-flight/failure assertions | ✅ covered |
| CONTEXT | Optional real selection seam only; no no-op/deferred actions | Deferred-feature scan and native interaction models | ✅ covered |
| CONTEXT | 48dp/44pt targets, semantics/VoiceOver, focus, RTL, large text, reduced motion | Connected Android semantics, iOS production identity/render contract, snapshot matrices | ✅ covered |
| CONTEXT (agent discretion) | Photo icon, plain categories, responsive grid, native state/copy | Native production and visual suites | ✅ covered |

Excluded without a gap: sending from the gallery, item preview/details, sender/date preview context, global gallery/search/filter/date grouping, learning/community/dashboard surfaces, and exhaustive Phase 15 physical-device release proof remain explicitly out of Phase 13.

## Security and Privacy Audit

| Threat | Evidence | Result |
|--------|----------|--------|
| T-13-01 exact identity/conversation binding | Local RLS verification plus Android lifecycle and iOS identity/store suites | ✅ |
| T-13-02 stale work/tampering | Request, cursor, destination, generation, owner-switch, paging, and purge tests | ✅ |
| T-13-03 private delivery/cache boundary | Gallery-only private-field and deferred-feature scans; provider-neutral presentation tests | ✅ |
| T-13-04 navigation/session disclosure | Both explicit origin stacks, synchronous close/revoke, session clearing, and focus restoration | ✅ |
| T-13-SC dependency supply chain | Phase first `964dd2f760a4ca1a0a340c841e4099811b6ccc4b`; base `4b21c61b801fdadd2f9b63d02f755c50a66d4257`; zero manifest/lockfile diff | ✅ |

The literal plan scan over the entire iOS `PersonalChat` module also locates `storagePath` in the older direct-message attachment viewer/loader. Blame confirms those matched locator lines predate Phase 13 and belong to the non-gallery direct-chat path; the Phase 13 shared-content overload is explicitly provider-neutral. The same scan restricted to the actual gallery production boundary is clean. This semantic boundary resolution avoids both a false privacy claim and a fragile source-occurrence count.

## Non-Blocking Environment Notes

- All Supabase checks targeted the local stack; no linked or hosted project was accessed.
- The Supabase CLI printed only its available-update notice and the expected unset local Google OAuth warnings.
- Xcode printed its recurring empty supported-platform metadata warning while every selected simulator test and app build still completed successfully.
- Android connected tests used the repository `Pixel_10_Pro_XL` AVD on API 37.

---

## Wave 0 Requirements

- [x] `packages/core/src/shared-content/gallery.test.ts` — canonical category/session projection, category mutation, and nullable-duration vectors.
- [x] Android `SharedContentGalleryPresenterTest.kt` — selection, global append, pagination, duration fallback, and presentation truth.
- [x] Android `SharedContentNavigationTest.kt` — both origin stacks, semantics, focus restoration, and exactly-once gallery open.
- [x] Android gallery additions to `ChatScreenshotTest.kt` — full state, category, item-kind, theme, RTL, and large-text matrix.
- [x] iOS `SharedContentGalleryModelTests.swift` — projection, selection, append, duration, paging, and lifecycle behavior.
- [x] iOS `SharedContentNavigationTests.swift` — both origin stacks, details presentation, focus restoration, and exactly-once open.
- [x] iOS `SharedContentGallerySnapshotTests.swift` — equivalent state, category, item-kind, theme, RTL, and large-text matrix.
- [x] Room migration and Core Data legacy compatibility tests for nullable voice duration.
- [x] Supabase RPC shape and permission assertions for nullable duration plus generated-type drift verification.

No new test framework or package installation is required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Header and details entry remain reachable and calm on physical compact devices with platform accessibility enabled | DISC-01 | Final target acquisition, native navigation continuity, and assistive focus are device behaviors beyond unit snapshots | On one supported Android and iOS device, open Shared content from the header and details, navigate Back through each origin, and confirm the originating control regains focus without duplicate announcements |
| Media grid and category rows remain scannable with realistic mixed content and maximum system text | DISC-02 | Perceived density and scan continuity need device observation with real scaling | Load all four populated categories, enable maximum supported text size, switch categories, load an older page, and confirm content reflows without clipped labels, overlapping targets, or a horizontal scroll requirement |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or an explicit Wave 0 dependency.
- [x] Sampling continuity: no three consecutive tasks without automated verification.
- [x] Wave 0 covers every missing test reference.
- [x] No watch-mode flags.
- [x] Focused feedback latency remains below 180 seconds.
- [x] DISC-01 has automated coverage for both entry origins and both return stacks on Android and iOS.
- [x] DISC-02 has portable and native coverage for populated-only fixed category order and one-category control removal.
- [x] Nullable duration remains backward-compatible in provider, cache, migration, and UI projections.
- [x] Identity change and route pop revoke gallery visibility before stale callbacks can publish.
- [x] `nyquist_compliant: true` is set in frontmatter after every requirement maps to green evidence.

**Automated phase approval:** approved 2026-07-24. Phase 15 retains physical-device/manual release proof.
