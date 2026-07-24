---
phase: 13-calm-gallery-browsing
reviewed: 2026-07-24T10:45:10Z
depth: standard
files_reviewed: 95
files_reviewed_list:
  - .gitignore
  - apps/android/app/src/main/kotlin/space/fishhub/android/AttachmentFileOpener.kt
  - apps/android/app/src/main/kotlin/space/fishhub/android/FishApplication.kt
  - apps/android/app/src/main/kotlin/space/fishhub/android/MainActivity.kt
  - apps/android/core/designsystem/src/main/kotlin/space/fishhub/android/core/designsystem/DimensionTokens.kt
  - apps/android/core/designsystem/src/main/kotlin/space/fishhub/android/core/designsystem/Icons.kt
  - apps/android/core/designsystem/src/main/kotlin/space/fishhub/android/core/designsystem/tokens/GeneratedTokens.kt
  - apps/android/data/chat/schemas/space.fishhub.android.data.chat.local.ChatDatabase/10.json
  - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/DefaultChatRepositoryTest.kt
  - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/local/ChatDatabaseMigrationTest.kt
  - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/RoomSharedContentCacheStoreTest.kt
  - apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentRepositoryTest.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatRepository.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDao.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDatabase.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatEntities.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/SupabaseChatRemoteDataSource.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/remote/SupabaseDtos.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/BoundedAttachmentDeliveryCache.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/RoomSharedContentCacheStore.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinator.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentMediaUrlPolicy.kt
  - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStore.kt
  - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/BoundedAttachmentDeliveryCacheTest.kt
  - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinatorTest.kt
  - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentMediaUrlPolicyTest.kt
  - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentThumbnailStoreTest.kt
  - apps/android/feature/chat/src/androidTest/kotlin/space/fishhub/android/feature/chat/ChatAccessibilityTest.kt
  - apps/android/feature/chat/src/androidTest/kotlin/space/fishhub/android/feature/chat/SharedContentNavigationTest.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatComponents.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatRoute.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatScreen.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ParticipantDetailsSheet.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryComponents.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryPresenter.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryScreen.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt
  - apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/state/SharedContentState.kt
  - apps/android/feature/chat/src/main/res/values/strings.xml
  - apps/android/feature/chat/src/screenshotTest/kotlin/space/fishhub/android/feature/chat/ChatScreenshotTest.kt
  - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryLayoutTest.kt
  - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentGalleryPresenterTest.kt
  - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentParityTest.kt
  - apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStoreTest.kt
  - apps/ios/App/Fish.xcodeproj/project.pbxproj
  - apps/ios/App/Sources/FishApp.swift
  - apps/ios/App/project.yml
  - apps/ios/Catalog/Sources/LiveAttachmentLab.swift
  - apps/ios/FishKit/Sources/ChatData/Adapters/CoreDataSharedContentCache.swift
  - apps/ios/FishKit/Sources/ChatData/Adapters/SharedContentDeliveryStore.swift
  - apps/ios/FishKit/Sources/ChatData/Adapters/SharedContentThumbnailStore.swift
  - apps/ios/FishKit/Sources/ChatData/Adapters/SupabaseSharedContentRepository.swift
  - apps/ios/FishKit/Sources/ChatData/Providers/SharedContentCaching.swift
  - apps/ios/FishKit/Sources/ChatData/Providers/SharedContentProviding.swift
  - apps/ios/FishKit/Sources/DesignSystem/Icons/Icon.swift
  - apps/ios/FishKit/Sources/DesignSystem/Resources/Icons.xcassets/link.imageset/Contents.json
  - apps/ios/FishKit/Sources/PersonalChat/Screens/PersonalChatScreen.swift
  - apps/ios/FishKit/Sources/PersonalChat/Screens/SharedContentGalleryScreen.swift
  - apps/ios/FishKit/Sources/PersonalChat/ViewModels/MessageImageLoader.swift
  - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentGalleryModel.swift
  - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentIdentityCoordinator.swift
  - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentMediaRuntime.swift
  - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentMediaURLPolicy.swift
  - apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentStore.swift
  - apps/ios/FishKit/Sources/PersonalChat/Views/ConversationDetailsSheet.swift
  - apps/ios/FishKit/Sources/PersonalChat/Views/PersonalChatTopBar.swift
  - apps/ios/FishKit/Sources/PersonalChat/Views/SharedContentGalleryComponents.swift
  - apps/ios/FishKit/Sources/TestSupport/Resources/shared-content-vectors.json
  - apps/ios/FishKit/Sources/UIComponents/Buttons/ActionButton.swift
  - apps/ios/FishKit/Tests/ChatDataTests/CoreDataSharedContentCacheTests.swift
  - apps/ios/FishKit/Tests/ChatDataTests/SharedContentDeliveryStoreTests.swift
  - apps/ios/FishKit/Tests/ChatDataTests/SharedContentRepositoryTests.swift
  - apps/ios/FishKit/Tests/ChatDataTests/SharedContentThumbnailStoreTests.swift
  - apps/ios/FishKit/Tests/PersonalChatTests/AttachmentUploadsModelTests.swift
  - apps/ios/FishKit/Tests/PersonalChatTests/MessageImageLoaderTests.swift
  - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGalleryModelTests.swift
  - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentGallerySnapshotTests.swift
  - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentIdentityCoordinatorTests.swift
  - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentMediaRuntimeTests.swift
  - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentNavigationTests.swift
  - apps/ios/FishKit/Tests/PersonalChatTests/SharedContentStoreTests.swift
  - design/tokens/fish.tokens.json
  - packages/core/src/shared-content/fixtures/shared-content-vectors.json
  - packages/core/src/shared-content/gallery.test.ts
  - packages/core/src/shared-content/gallery.ts
  - packages/core/src/shared-content/index.ts
  - packages/core/src/shared-content/shared-content.test.ts
  - packages/core/src/shared-content/state.ts
  - packages/core/src/shared-content/types.ts
  - packages/supabase/src/database.generated.ts
  - scripts/verify-shared-content-migration.ts
  - scripts/verify-shared-content.ts
  - supabase/migrations/0063_shared_content_duration.sql
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-07-24T10:45:10Z
**Depth:** standard
**Files Reviewed:** 95
**Status:** issues_found

## Summary

The 95-file Phase 13 acceptance scope was reviewed against the phase context, UI specification, validation contract, requirements, project rules, all prior review/fix artifacts, and current production call paths. The optional Core Data fields now round-trip through production hydration, and the iOS restoration task is no longer keyed by continuously changing viewport state. The earlier fixes for contiguous cache pruning, cursor repair, generation-fenced purge, thumbnail concurrency/cancellation, viewport measurement, focus, sticker fitting, and snapshot stability also remain present.

Three blockers remain. Android still replaces merged hydrated history with the newest RPC page and relies on a separate Room invalidation collector to repair it later. Both native URL policies classify only hostname text, so configured special-use/DNS-rebound names can still connect to loopback or private addresses. In addition, the iOS production composition automatically enables plaintext local HTTP from the URL itself even in release builds, despite already carrying an explicit release-mode flag.

Focused verification was green: 22 portable shared-content tests, Android URL/cache/store/presenter/layout unit suites, 49 selected iOS cache/store/navigation/media tests, iOS fixture parity, and the workspace production build.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Android refresh still collapses retained history and lets observer scheduling decide whether it returns

**Classification:** BLOCKER
**File:** `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt:647-656`
**Related:** `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt:247-255`; `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt:374-398`; `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/ChatDao.kt:645-685`

**Issue:** The production repository correctly preserves retained browsed pages when it replaces the newest Room page. The feature store then handles the returned RPC page in `acceptPageLocked` by assigning only `accepted` to `_acceptedItems`, replacing the retained cursor and history truth with that newest page. A different coroutine collects Room invalidations and may later hydrate the merged cache. If that invalidation runs after the RPC continuation, the gallery visibly drops older rows and then adds them back, moving the current anchor. If it runs before the RPC continuation, `acceptPageLocked` wins last and the older history remains absent until another database invalidation. The iOS store now explicitly reconciles this exact boundary; Android has no equivalent and no route-open test with more than 40 hydrated rows.

**Fix:** Reconcile the returned newest window with the already accepted contiguous older segment before publishing, preserving the prior deepest retained cursor/history truth when the new boundary exists in that segment. Alternatively, make the repository return the post-transaction merged snapshot and publish only that result. Do not depend on asynchronous Room invalidation order. Add a production-path test that drives the cache emission both before and after the refresh response and proves older rows, category, visible anchor, and deepest cursor never collapse.

### CR-02: Native URL policies do not validate the network address behind an allowed hostname

**Classification:** BLOCKER
**File:** `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentMediaUrlPolicy.kt:58-80`
**Related:** `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentMediaUrlPolicy.kt:87-108`; `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt:258-291`; `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentMediaURLPolicy.swift:66-110,128-153`; `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentMediaRuntime.swift:86-104`

**Issue:** Both policies reject literal IPs, exact `localhost`, and a few textual suffixes, then hand the hostname to the platform resolver without checking the resolved addresses. This leaves concrete local-name bypasses: a configured storage host such as `foo.localhost`, `localhost.`, or `127.0.0.1.` passes the current string predicates and is also the exact configured allowlist entry, while resolution targets loopback. A configured ordinary hostname can likewise resolve or rebind to loopback, link-local, or RFC1918/ULA space. Redirect checks repeat the same hostname-only predicate, so an approved same-host redirect chain does not close the gap. The tests cover literal `10.0.0.8` and exact `localhost`, but no special-use subdomain, trailing-dot form, or resolver result.

**Fix:** Canonicalize DNS names first (lowercase IDNA ASCII, strip one terminal dot), reject `localhost` and every `.localhost` descendant, and validate every resolved A/AAAA address against loopback, private, link-local, multicast, unspecified, and reserved ranges before connecting. Apply the same validation to every redirect hop and protect against DNS rebinding by binding the validated address to the connection (or by using a transport that exposes and verifies the connected peer). Keep the configured host as the TLS SNI/Host authority. Add both-platform tests for `.localhost`, trailing-dot loopback, IPv4/IPv6 private answers, mixed public/private answers, address changes across redirect hops, and valid public configured storage/GIF hosts.

### CR-03: iOS release builds automatically enable the plaintext development exception

**Classification:** BLOCKER
**File:** `apps/ios/App/Sources/FishApp.swift:584-591`
**Related:** `apps/ios/App/Sources/FishApp.swift:734-744,1535-1567`; `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentMediaURLPolicy.swift:21-47,60-64,78-87`

**Issue:** `FishAppConfiguration` already records `isRelease`, but both production media-policy constructions ignore it and set `allowsLocalDevelopment` solely by asking whether the configured backend URL is `http://localhost` or `http://127.0.0.1`. Therefore a release archive with an accidentally or maliciously supplied local backend setting permits plaintext signed-media requests. Android gates the same exception with `BuildConfig.DEBUG`; iOS does not. The policy test passes `allowsLocalDevelopment: true` directly and never exercises release composition, so it cannot detect this production-only transport downgrade.

**Fix:** Derive one explicit development-media flag from build mode and configuration, for example `!configuration.isRelease && isLocalDevelopmentBackend(configuration.supabaseUrl)`, and pass that same flag to the message loader and gallery runtime. Fail release startup/configuration when the backend is not HTTPS rather than silently enabling the exception. Add a composition test proving a local HTTP URL is accepted in a debug/development configuration and rejected in a release configuration.

---

_Reviewed: 2026-07-24T10:45:10Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
