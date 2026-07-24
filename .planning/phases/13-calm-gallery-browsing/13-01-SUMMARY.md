---
phase: 13-calm-gallery-browsing
plan: "01"
subsystem: shared-content-contracts
tags: [tdd, shared-content, gallery, supabase, ios]
dependency-graph:
  requires:
    - phase: 12-offline-shared-content-cache-delivery
      provides: Canonical shared-content fixtures, ordering, paging, and synchronized iOS resources
    - migration: 0062_shared_content_privacy_hardening
      provides: Authorized 28-field shared-content RPC with 40+1 pagination
  provides:
    - Portable Phase 13 gallery projection and nullable-duration RED oracle
    - Authenticated nullable-duration migration, permission, ordering, and paging RED gates
  affects:
    - 13-02
    - 13-03
    - 13-04
tech-stack:
  added: []
  patterns:
    - Runtime RED guards for production symbols that intentionally do not exist yet
    - Exact normalized RPC shape comparisons with redacted verifier output
key-files:
  created:
    - packages/core/src/shared-content/gallery.test.ts
  modified:
    - packages/core/src/shared-content/fixtures/shared-content-vectors.json
    - apps/ios/FishKit/Sources/TestSupport/Resources/shared-content-vectors.json
    - scripts/verify-shared-content.ts
    - scripts/verify-shared-content-migration.ts
key-decisions:
  - "Nest Phase 13 gallery cases under galleryStates.galleryProjection so the existing strict Phase 11/12 fixture parser remains green while the portable corpus grows to 108 cases."
  - "Treat duration as trusted nullable metadata projected by the listing RPC, with no duration input added to chat sending or attachment-upload contracts."
patterns-established:
  - "Phase-specific RED suites dynamically load absent production modules so missing symbols fail at runtime without breaking workspace typechecks."
  - "Backend RED verification exercises trusted writes and untrusted reads/writes separately while retaining existing privacy and paging evidence."
requirements-completed: [DISC-02]
duration: 18 min
completed: 2026-07-24
---

# Phase 13 Plan 01: Calm Gallery Browsing RED Contracts Summary

**A synchronized 108-case cross-platform gallery oracle and authenticated 29-field Supabase RED gate now define DISC-02 before production gallery code exists.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-24T01:16:37Z
- **Completed:** 2026-07-24T01:34:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added 16 canonical Phase 13 cases for loading versus empty state, category projection and selection, global earlier-page mutations, failure retention, nullable duration formatting, and the 40+1 sentinel.
- Synchronized the canonical JSON fixture to SwiftPM byte-for-byte and added a portable RED suite that names only the three missing Phase 13 production contracts.
- Extended both Supabase verifiers to require exact 29-field rows, nullable and non-negative trusted duration metadata, retained authorization boundaries, canonical ordering, and non-rendered continuation sentinels.
- Confirmed chat sending and attachment-upload function inputs remain duration-free.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define canonical gallery projection, mutation, paging, and duration RED vectors** - `964dd2f7` (test)
2. **Task 2: Add nullable-duration RPC, migration, and permission RED assertions** - `8ba97d94` (test)

## Files Created/Modified

- `packages/core/src/shared-content/gallery.test.ts` - Portable fixture-driven Phase 13 RED suite.
- `packages/core/src/shared-content/fixtures/shared-content-vectors.json` - Canonical gallery projection, paging, mutation, and duration cases.
- `apps/ios/FishKit/Sources/TestSupport/Resources/shared-content-vectors.json` - Byte-identical SwiftPM fixture copy.
- `scripts/verify-shared-content.ts` - Authenticated exact-shape, duration, permission, ordering, and sentinel checks.
- `scripts/verify-shared-content-migration.ts` - Migration regression for legacy null duration, trusted values, negative rejection, and client write denial.

## Decisions Made

- Kept Phase 13 cases inside the existing `galleryStates` fixture group so the strict earlier-phase parser remains green without changing files outside this plan.
- Kept duration metadata service-owned and read-only for conversation members; neither sending nor upload contracts accept it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Loaded the intentionally absent gallery module without traversing the Node-incompatible source barrel**

- **Found during:** Task 1
- **Issue:** Node's stripped-TypeScript test runner could not resolve extensionless re-exports in the source barrel, causing an infrastructure error before the intended RED assertions.
- **Fix:** Dynamically load the future `gallery.ts` module only when present and import the existing ordering helper directly, preserving runtime-only failures for the named Phase 13 symbols.
- **Files modified:** `packages/core/src/shared-content/gallery.test.ts`
- **Commit:** `964dd2f7`

## Verification

- Existing shared-content suite: 13/13 passing.
- Phase 13 gallery suite: expected RED on `SHARED_CONTENT_CATEGORY_ORDER`, `projectSharedContentGallery`, and `durationMs` only.
- Authenticated shared-content verifier: reaches the authorization matrix and fails on absent `duration_ms`/29-field contract while existing privacy, ordering, performance, deletion, and sentinel assertions pass.
- Migration verifier: reaches the post-migration authenticated checks and fails on absent `duration_ms` column/RPC projection and check constraint.
- `pnpm ios:chat-vectors:check`: passing.
- `pnpm lint`: passing.
- `pnpm build`: passing.

## Next Phase Readiness

- Plans 13-02 and 13-03 can add platform RED contracts against the shared 108-case oracle.
- Plan 13-04 can turn these portable and backend gates green with the additive gallery projection and nullable duration migration.
- No production gallery behavior, new endpoint, upload input, sending input, preview, export, search, dashboard, or web-gallery surface was introduced.

## Self-Check: PASSED

- All five plan-owned implementation/test artifacts exist.
- Task commits `964dd2f7` and `8ba97d94` exist in git history.
- Required RED failures name missing Phase 13 contracts; synchronized vectors, lint, and production build pass.
