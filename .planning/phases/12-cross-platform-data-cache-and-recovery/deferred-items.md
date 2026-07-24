# Deferred Items — Phase 12 Plan 02

## Pre-existing verification issue

- `pnpm build` is currently blocked by `packages/core/src/shared-content/shared-content.test.ts:151`: TypeScript reports that `cases` is not available on the inferred fixture union. This file was not modified by Plan 12-02 and belongs to the preceding portable-contract work; leave it for the Phase 12-01 follow-up or the owning production-contract plan.
- Connected Android verification is unavailable in this environment because Gradle reports `No connected devices!`. The new Android test sources compile successfully and the existing `:data:chat:testDebugUnitTest` suite passes.

## Plan 12-06 verification issues

- Connected Android verification is still unavailable because Gradle reports `No connected devices!`. The Room migration, DAO, and cache-store instrumentation sources compile successfully.
- `:data:chat:testDebugUnitTest` now reports only the pre-existing intentional RED guard for `SharedContentIdentityCoordinator`, which belongs to Plan 12-14. The delivery and thumbnail guards are green after Plan 12-09; no unrelated RED contract was changed.

## Plan 12-10 verification issues

- `:feature:chat:testDebugUnitTest --tests '*SharedContentStoreTest'` compiles the new store tests but cannot execute because the pre-existing `ChatViewModelTest` and `MessageSearchViewModelTest` fakes do not implement the shared-content methods added by Plan 12-08. Those unrelated test files were left unchanged.
- Connected Android instrumentation remains unavailable because no emulator or device is attached. Production Kotlin compilation and the data-module shared-content unit suite completed; the latter retains only the intentional Plan 12-14 identity-coordinator RED guard.

## Plan 12-14 verification issues

- `:data:chat:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=space.fishhub.android.data.chat.sharedcontent.SharedContentIdentitySecurityTest` packaged the test APK but could not execute because Gradle reported `No connected devices!`. The Android data test sources and JVM suite compile and pass.
- `:feature:chat:testDebugUnitTest --tests '*SharedContentStoreTest'` remains blocked before test execution by the pre-existing `ChatViewModelTest` and `MessageSearchViewModelTest` fakes missing the shared-content methods introduced by Plan 12-08. Those unrelated test files were not changed.

## Plan 12-16 verification issues

- The exact `pnpm android:instrumented` matrix reaches the connected AVD but retains three unrelated pre-existing failures: `DefaultChatRepositoryTest.manualRetryReconcilesFailedRequestWithoutDuplicate`, `AccountSettingsAccessibilityTest.accountRowsAndDismissControlsHaveAccessibleTargets`, and three `ChatAccessibilityTest` assertions. Phase 12 data/recovery instrumentation was isolated and passes; these chat/settings UI failures were not changed because they are outside this plan's owning scope.
- The first `pnpm typecheck` invocation ran before the Next build had regenerated `.next/types` and reported missing generated route type files. `pnpm build` then passed and a clean rerun of `pnpm typecheck` passed; no source fix was needed.
