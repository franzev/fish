---
phase: 13-calm-gallery-browsing
fixed_at: 2026-07-24T11:27:37Z
review_path: .planning/phases/13-calm-gallery-browsing/13-REVIEW.md
iteration: 6
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-07-24T11:27:37Z
**Source review:** `.planning/phases/13-calm-gallery-browsing/13-REVIEW.md`
**Iteration:** 6

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: Android refresh still collapses retained history and lets observer scheduling decide whether it returns

**Status:** fixed: requires human verification
**Files modified:** `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStore.kt`, `apps/android/feature/chat/src/test/kotlin/space/fishhub/android/feature/chat/sharedcontent/SharedContentStoreTest.kt`
**Commit:** a4bf2b54
**Applied fix:** Newest-page acceptance now reconciles the response with the already accepted contiguous older segment before publishing, retaining the deepest cursor and retained-history truth. The production-path test drives cache emission both before and after the refresh response with more than 40 rows and proves the category, visible anchor, retained rows, and deepest cursor never collapse.

### CR-02: Native URL policies do not validate the network address behind an allowed hostname

**Status:** fixed: requires human verification
**Files modified:** `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt`, `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentMediaUrlPolicy.kt`, `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentMediaUrlPolicyTest.kt`, `apps/ios/FishKit/Sources/PersonalChat/ViewModels/MessageImageLoader.swift`, `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentMediaRuntime.swift`, `apps/ios/FishKit/Sources/PersonalChat/ViewModels/SharedContentMediaURLPolicy.swift`, `apps/ios/FishKit/Tests/PersonalChatTests/MessageImageLoaderTests.swift`, `apps/ios/FishKit/Tests/PersonalChatTests/SharedContentMediaRuntimeTests.swift`
**Commit:** 698283af
**Applied fix:** Both platforms now canonicalize hostnames to lowercase IDNA ASCII, remove one terminal dot, reject special-use names, and require every resolved A/AAAA answer to be public and safe on the initial request and every redirect. Android binds OkHttp to the validated DNS answer set; iOS verifies the connected peer against the validated set. Resolution and transport work stay off the main thread. Tests cover localhost descendants, trailing-dot loopback, private IPv4/IPv6 and mixed answers, redirect-time address changes, peer mismatch, and valid public storage/GIF hosts.

### CR-03: iOS release builds automatically enable the plaintext development exception

**Status:** fixed: requires human verification
**Files modified:** `apps/ios/App/Fish.xcodeproj/project.pbxproj`, `apps/ios/App/Sources/FishApp.swift`, `apps/ios/App/Tests/FishAppConfigurationTests.swift`
**Commit:** d6533b2f
**Applied fix:** iOS now derives one local-development media flag from both non-release mode and an exact local backend. That same flag configures the message loader and gallery runtime, while release configuration rejects a non-HTTPS backend. App-composition tests prove local HTTP is accepted for development and rejected for release.

## Verification

- Focused Android retained-history and URL-policy suites: passed.
- Focused iOS media runtime, image loader, and app-composition suites: passed.
- Native policy tests cover canonicalization, special-use names, unsafe and mixed DNS answers, redirect rebinding, connected-peer verification, and valid public storage/GIF hosts.
- `pnpm android:check`: passed, including lint, release assembly, and native screenshot validation.
- Full connected Android command executed on `Pixel_10_Pro_XL`: all 80 data-chat and 28 feature-chat tests passed. The overall command remains non-green because the unrelated pre-existing `AccountSettingsAccessibilityTest.accountRowsAndDismissControlsHaveAccessibleTargets` calls Compose `setContent` twice.
- `pnpm ios:test`: passed.
- `pnpm ios:app:build`: passed.
- Android gallery screenshot validation: passed three uncached repetitions.
- iOS shared-content gallery snapshots: passed three repetitions.
- Web module boundaries: 10/10 passed with zero loose component implementations and zero missing component entry points.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check`: passed.

---

_Fixed: 2026-07-24T11:27:37Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 6_
