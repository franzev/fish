---
phase: 12-cross-platform-data-cache-and-recovery
plan: 14
subsystem: android-data
tags: [android, kotlin, identity, privacy, purge, shared-content]

# Dependency graph
requires:
  - phase: 12-cross-platform-data-cache-and-recovery
    provides: Android Room cache, authorized repository, delivery registry, displayed-thumbnail store, and recovery seams from Plans 12-06, 12-08, 12-09, and 12-10
provides:
  - Serialized Android purge-before-bind identity coordinator with monotonic generations
  - Fail-closed gallery eligibility and retryable cleanup across metadata, runtime leases, thumbnails, and temporary artifacts
  - Repository and app hooks that preserve unrelated authenticated chat behavior
affects: [phase-13-shared-content-gallery, phase-14-native-content-actions]

# Tech tracking
tech-stack:
  added: []
  patterns: [serialized purge-before-bind state machine, provider-neutral ephemeral purge hooks, redacted identity state]

key-files:
  created:
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinator.kt
  modified:
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatRepository.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt
    - apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt
    - apps/android/app/src/main/kotlin/space/fishhub/android/AttachmentFileOpener.kt
    - apps/android/app/src/main/kotlin/space/fishhub/android/MainActivity.kt
    - apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinatorTest.kt
    - .planning/phases/12-cross-platform-data-cache-and-recovery/deferred-items.md

key-decisions:
  - "Gallery state becomes unresolved and advances generation before any purge await; only a verified zero probe can publish the new owner as eligible."
  - "Room shared-content metadata is swept across all namespaces before a bind; local cache remains disposable and never authorizes membership or delivery."
  - "Filesystem or runtime cleanup failure makes only gallery eligibility unavailable and is retried on verified start/foreground, while unrelated auth/chat surfaces continue."
  - "App-owned opened-attachment files cross the data boundary only through a provider-neutral purge hook; identity state diagnostics redact owner IDs, URLs, paths, and content."

patterns-established:
  - "All asynchronous shared-content acceptance checks owner identity, exact generation, and current auth before exposing cached or authoritative results."
  - "Purge operations are idempotent and ordered: store/tasks, leases/decoded memory, metadata, thumbnail/temp roots, hooks, verify, then bind/publish."

requirements-completed: [PRIV-02, PRIV-03, OFF-01, OFF-02]

# Metrics
duration: 17 min
completed: 2026-07-23
---

# Phase 12 Plan 14: Android purge-before-bind identity privacy Summary

**Android shared-content identity now hides old state, purges every disposable layer, verifies zero, and publishes a new owner only after a serialized monotonic generation transition.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-23T15:35:07Z
- **Completed:** 2026-07-23T15:52:29Z
- **Tasks:** 1 completed
- **Files modified:** 8 planned files plus the phase deferred-items log

## Accomplishments

- Added `SharedContentIdentityCoordinator` with unresolved, purging, eligible, and unavailable states; synchronous hide-first transitions; monotonic generations; exact purge ordering; stale callback rejection; and explicit verified-start/foreground retry.
- Replaced the repository’s ad hoc shared-content identity mutex with coordinator-gated observation, hydration, request acceptance, sign-out, and cache-clear paths. Room metadata is swept before any new owner becomes eligible.
- Wired `ChatDataModule`, `AttachmentFileOpener`, and `MainActivity` to purge runtime leases and opened-file temp artifacts through provider-neutral hooks without blocking unrelated authentication/chat behavior.
- Added production coordinator JVM assertions for order, stale-owner rejection, monotonic generation, and unavailable-until-retry behavior. The existing Android security suite remains present and its production-symbol gate is green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate Android identity transitions across every private layer** - `5907aad0` (`feat`)

TDD contract RED coverage was established by the prior Wave 0 identity test commit `9d6bb871`; this plan supplied the GREEN implementation and direct production-coordinator assertions.

## Files Created/Modified

- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinator.kt` - Serialized generation and purge state machine with provider-neutral cleanup ports.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatRepository.kt` - Default identity state/generation and retry/hook surface for provider-neutral consumers.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/DefaultChatRepository.kt` - Coordinator-gated shared-content hydration/request acceptance and sign-out cleanup.
- `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt` - One production coordinator wiring point for Room and thumbnail purge.
- `apps/android/app/src/main/kotlin/space/fishhub/android/AttachmentFileOpener.kt` - Generation-aware invalidation and verifiable temporary-file cleanup hook.
- `apps/android/app/src/main/kotlin/space/fishhub/android/MainActivity.kt` - Registers the app purge hook and retries verified identity cleanup on foreground.
- `apps/android/data/chat/src/test/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinatorTest.kt` - Real coordinator order, stale callback, and failure/retry coverage.
- `apps/android/data/chat/src/androidTest/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentitySecurityTest.kt` - Existing adversarial and secret-sentinel instrumentation contract, compiled with the production symbols.

## Verification

- `scripts/android-gradle.sh :data:chat:testDebugUnitTest --tests '*SharedContentIdentityCoordinatorTest'` — PASS.
- `scripts/android-gradle.sh :data:chat:testDebugUnitTest` — PASS.
- `scripts/android-gradle.sh :data:chat:compileDebugKotlin :data:chat:compileDebugAndroidTestKotlin` — PASS.
- `scripts/android-gradle.sh :app:compileDebugKotlin` — PASS.
- `pnpm lint` — PASS.
- `pnpm build` — PASS.
- `pnpm typecheck` — PASS after the build regenerated Next `.next/types`; the initial pre-build invocation only reported missing generated route type files.
- `git diff --check`, scope/deletion checks, backup-rule inspection, and production coordinator secret-sentinel scan — PASS.
- Connected `SharedContentIdentitySecurityTest` — test APK packaged, but execution was unavailable because Gradle reported `No connected devices!`.
- Focused `:feature:chat:testDebugUnitTest --tests '*SharedContentStoreTest'` remains blocked by the pre-existing `ChatViewModelTest` and `MessageSearchViewModelTest` fakes missing Plan 12-08 shared-content methods; no unrelated test files were changed.

## Decisions Made

- Kept the coordinator in `:data:chat` and exposed only provider-neutral identity state and purge hooks; gallery consumers cannot use local cache as authority.
- Swept durable shared-content metadata before rebinding so restored or unknown-owner Room namespaces cannot survive into a new identity.
- Kept opened attachment handling available for normal chat while cancelling/invalidation protects in-flight temporary-file work across identity generations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected coordinator purge-result typing.**

- **Found during:** Task 1 focused Android compilation
- **Issue:** The cleanup `runCatching` block initially returned `Unit`, so the coordinator’s verification result could not be used as a Boolean.
- **Fix:** Required hook and zero-probe success and returned an explicit Boolean from the purge block.
- **Files modified:** `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/sharedcontent/SharedContentIdentityCoordinator.kt`
- **Verification:** Focused identity JVM suite, full data JVM suite, Android compilation, and repository build passed.
- **Committed in:** `5907aad0`

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking). **Impact:** Required to complete the planned purge state machine; no product, route, provider, or schema scope was added.

## Known Stubs

- `NoOpSharedContentPurgePort` and default `ChatRepository` identity methods are compatibility fallbacks for unconfigured builds and existing provider-neutral test fakes. The production `ChatDataModule` always supplies the Room/filesystem-backed purge port; these fallbacks do not authorize or expose gallery data.

## Issues Encountered

- No connected Android device/emulator was available; instrumentation was compile/package verified only. The exact command and limitation are recorded in `deferred-items.md`.
- The feature shared-content suite has pre-existing fakes missing Plan 12-08 methods and cannot compile; it is outside this plan’s files and remains deferred to the owning maintenance work.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. The new identity, filesystem, and ephemeral purge surfaces are the planned T-12-01, T-12-02, T-12-04, T-12-05, and T-12-07 mitigations; no endpoint, migration, route, or new provider boundary was added.

## Next Phase Readiness

Android identity transitions now fail closed before any Phase 13 gallery hydration or delivery work. Rerun the connected security suite on an attached emulator/device; the unrelated feature test fake maintenance should be handled by its owning plan.

---
*Phase: 12-cross-platform-data-cache-and-recovery*
*Completed: 2026-07-23*

## Self-Check: PASSED

- Required summary, coordinator, and security-test files exist.
- Task commit `5907aad0` is present in git history.
- Research-cache JSON files remain present and untracked; none were staged or modified.
