---
phase: 13-calm-gallery-browsing
plan: "04"
subsystem: shared-content-contracts
tags: [shared-content, gallery, supabase, typescript, tdd]
dependency-graph:
  requires:
    - phase: 13-calm-gallery-browsing
      plan: "01"
      provides: Phase 13 RED contracts for the 29-field RPC, duration, and gallery projection
    - migration: 0062_shared_content_privacy_hardening
      provides: Hardened member-scoped 28-field shared-content RPC
  provides:
    - Nullable non-negative trusted duration metadata in authorized shared-content rows
    - Canonical populated-category gallery projection in Media, Files, Links, Voice order
  affects: [13-05, 13-06, 13-07, 13-08, android, ios]
tech-stack:
  added: []
  patterns:
    - Forward-only additive metadata migration with complete hardened RPC replacement
    - Pure provider-neutral populated-category projection with deterministic selection fallback
key-files:
  created:
    - supabase/migrations/0063_shared_content_duration.sql
    - packages/core/src/shared-content/gallery.ts
  modified:
    - packages/supabase/src/database.generated.ts
    - packages/core/src/shared-content/types.ts
    - packages/core/src/shared-content/index.ts
key-decisions:
  - "Project duration only for audio/mp4 attachment rows; every non-voice source returns null."
  - "Expose the duration column to authenticated update shapes while the absence of an UPDATE RLS policy keeps all member writes at zero rows."
patterns-established:
  - "Gallery projection preserves accepted server item order and derives populated categories without optimistic counts."
requirements-completed: [DISC-02]
duration: 13m 1s
completed: 2026-07-24
---

# Phase 13 Plan 04: Shared Duration and Gallery Projection Summary

**Trusted nullable voice duration in the hardened shared-content RPC plus a provider-neutral projection that exposes only populated categories in canonical order.**

## Performance

- **Duration:** 13m 1s
- **Started:** 2026-07-24T02:25:40Z
- **Completed:** 2026-07-24T02:38:41Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added a forward-only nullable, non-negative `duration_ms` contract without rewriting legacy voice rows or widening mutation inputs.
- Recreated the hardened member-scoped listing RPC with exactly 29 normalized fields and duration exposed only for trusted voice attachments.
- Implemented the canonical pure gallery projection, including populated-only categories, stable input order, retained selection, deterministic fallback, and invalid-duration rejection.
- Turned all Phase 13 RED duration and gallery seams green while retaining byte-exact generated Supabase types and synchronized native fixtures.

## Task Commits

1. **Task 1: Extend the trusted shared-content provider contract with nullable duration** - `7457c091`
2. **Task 2: Implement canonical gallery projection and extend provider-neutral item contracts** - `3752c42a`

## Files Created/Modified

- `supabase/migrations/0063_shared_content_duration.sql` - Adds nullable constrained duration metadata and recreates the authorized listing RPC.
- `packages/supabase/src/database.generated.ts` - Byte-exact local-schema provider types for migration 0063.
- `packages/core/src/shared-content/types.ts` - Adds optional provider-neutral `durationMs` metadata.
- `packages/core/src/shared-content/gallery.ts` - Pure canonical gallery projection and category-order contract.
- `packages/core/src/shared-content/index.ts` - Exposes the complete gallery module surface.

## Decisions Made

- Duration is projected only from `audio/mp4` attachment rows; all other normalized source branches emit `null`.
- Authenticated callers receive column-level update shape access but no UPDATE RLS policy, preserving a zero-row denied write contract without granting mutation authority.
- Gallery projection preserves the accepted server order and never derives optimistic category counts or reorders items locally.
- Complete public surfaces continue through `export *` barrels from the shared-content folder to the package root.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved the verifier's row-denied member update response**

- **Found during:** Task 1
- **Issue:** Adding the new column caused a member update to fail at column privilege evaluation with `42501`, before RLS could produce the established zero-row denial response.
- **Fix:** Granted authenticated callers column-level update shape access while retaining no UPDATE RLS policy. Members still cannot mutate duration metadata, and former members cannot read it.
- **Files modified:** `supabase/migrations/0063_shared_content_duration.sql`
- **Commit:** `7457c091`

## Verification

- Local reset applied migration 0063 and both fresh-schema and 0061-to-latest migration verifiers passed.
- Shared-content verification passed all membership, privacy, 29-field shape, nullable/trusted/negative duration, pagination, ordering, deletion, cleanup, generated-type drift, and mutation-input checks.
- Portable gallery and shared-content suites passed all 22 tests.
- iOS chat fixture drift check, workspace typecheck, byte-exact Supabase type regeneration comparison, and production build all passed.

## Known Stubs

None. Nullable legacy duration is intentional persisted-data behavior, not an unwired UI placeholder.

## Threat Flags

None. The schema column and RPC replacement are the trust-boundary changes explicitly covered by the plan threat model and verified locally.

## Self-Check: PASSED

- All five created or modified production files exist.
- Task commits `7457c091` and `3752c42a` exist.
- Overall plan verification completed successfully.

---
*Phase: 13-calm-gallery-browsing*
*Completed: 2026-07-24*
