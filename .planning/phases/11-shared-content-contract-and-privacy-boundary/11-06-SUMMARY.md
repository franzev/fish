---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 06
subsystem: database
tags: [supabase, postgres, rls, privacy, migration, generated-types]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: "Applied shared-content schema through migration 0061 and generated provider aliases"
provides:
  - "Forward-only 0062 safe-link privacy, tombstone cleanup, bounded listing, and live-message context corrections"
  - "Pre/post local migration regression covering unsafe links, legacy cleanup, and deleted neighbors"
  - "Linked schema and generated Supabase contract parity through migration 0062"
affects: [phase-11-linked-verification, phase-12-shared-content-runtime, phase-14-source-navigation]

# Tech tracking
tech-stack:
  added: ["Supabase migration 0062", "local pre/post migration regression"]
  patterns: ["Forward-only corrective migrations", "Byte-exact generated provider contracts"]

key-files:
  created:
    - supabase/migrations/0062_shared_content_privacy_hardening.sql
    - scripts/verify-shared-content-migration.ts
  modified:
    - packages/supabase/src/database.generated.ts

key-decisions:
  - "Preserve applied 0061 history and introduce all privacy and cleanup corrections only through 0062."
  - "Keep unproven legacy link rows stored but invisible until current version-2 proof, canonical URL/hostname equality, and timestamp validation are present."
  - "Regenerate provider types from the reset local database after linked acceptance and verify their bytes exactly against the Supabase generator."

patterns-established:
  - "All member-visible link paths call one immutable canonical safe-link identity helper."
  - "Legacy tombstoned attachments and later binds to tombstoned messages share the existing retry-safe cleanup claim path."
  - "Context target, neighbors, and continuity probes use the same nondeleted message set."

requirements-completed: [DISC-03, PRIV-01, PAGE-01, PAGE-02]

# Metrics
duration: 25min
completed: 2026-07-22
---

# Phase 11 Plan 06: Shared-content privacy hardening Summary

**Forward-only migration 0062 now hides unproven link identities, backfills tombstoned attachment cleanup, bounds shared-content branches, excludes deleted context neighbors, and keeps linked/generated Supabase contracts in sync.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-22T14:41:02Z
- **Completed:** 2026-07-22T15:05:42Z
- **Tasks:** 3
- **Files modified:** 3 production files

## Accomplishments

- Added `0062_shared_content_privacy_hardening.sql` without changing `0061`; version-2 proof requires canonical URL/hostname identity, timestamp, and public HTTP(S) host syntax, while legacy unproven rows remain invisible.
- Added branch-local cursor/limit retrieval, category short-circuit probes, live-message and eligible-attachment indexes, tombstoned attachment backfill/trigger cleanup, and nondeleted target/neighbor/gap predicates.
- Added a real local transition regression from 0061 to 0062 covering direct/member/category unsafe-link omission, legacy cleanup claimability, and exact live context IDs/gap flags.
- Accepted 0062 on the linked database, confirmed local/remote migration parity, regenerated provider types, and preserved all existing shared-content RPC signatures and aliases.

## Task Commits

Each repository task was committed atomically:

1. **Task 1: Write corrective migration and a real pre/post migration regression** - `cc9368b1` (feat)
2. **Task 2: Push corrective schema to the linked database** - no repository commit (deployment-only)
3. **Task 3: Regenerate the accepted provider contract** - `ad2aac1c` (feat)

**Plan metadata:** pending; this summary, STATE.md, and ROADMAP.md are committed in the final metadata commit.

## Files Created/Modified

- `supabase/migrations/0062_shared_content_privacy_hardening.sql` - Forward-only proof boundary, bounded listing/category functions, cleanup correction, and deleted-message context correction.
- `scripts/verify-shared-content-migration.ts` - Local-only 0061-to-0062 fixture transition with stable labels and sanitized error codes.
- `packages/supabase/src/database.generated.ts` - Generator output with the two new link-proof fields in Row/Insert/Update shapes.

## Verification

- `supabase migration list` - passed; local and remote identifiers match through `0062`.
- `supabase db push --linked --yes` - passed; migration `0062_shared_content_privacy_hardening.sql` applied successfully.
- `supabase db push --linked --dry-run --yes` - passed; remote database is up to date.
- `supabase db reset --local --yes` - passed; complete local chain applied through `0062`.
- `node --experimental-strip-types --env-file=apps/web/.env.local scripts/verify-shared-content-migration.ts` - passed; all stable migration-regression cases reported PASS.
- `supabase db lint --local --level error` - passed with zero results.
- Generated type byte comparison against `supabase gen types typescript --local` - passed.
- `pnpm --filter @fish/supabase typecheck` - passed.
- `pnpm build` - passed.

## Decisions Made

- The linked database was pushed before provider regeneration, preserving the plan's authoritative deployment order.
- Migration-list verification handled the CLI's informational login-role line before parsing the safe migration JSON; no schema or source change was needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first local parser attempt treated an informational Supabase CLI line as JSON. The command itself succeeded; the parity check was rerun using the JSON line and passed with local/remote `0062`.
- Node emitted its existing module-type performance warning while running the TypeScript regression; the regression and all required checks still passed.

## Authentication Gates

The user-provided project-local environment contained `SUPABASE_ACCESS_TOKEN` when linked commands resumed. The token was sourced but never printed, persisted, or included in output/summary.

## Known Stubs

None found in the files created or modified by this plan.

## Threat Surface Review

No trust boundary beyond the plan's threat model was introduced. The migration strengthens the planned link-preview, deleted-source cleanup, and message-context boundaries; the verifier uses only isolated local fixtures and stable sanitized labels.

## User Setup Required

None - the linked Supabase setup was completed before Task 2 resumed.

## Next Phase Readiness

The linked and local schemas, migration regression, generated provider contract, typecheck, lint, and build are green through `0062`. The next Phase 11 linked/adversarial verification plan can rely on the corrected database boundary.

---
*Phase: 11-shared-content-contract-and-privacy-boundary*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- Task commits `cc9368b1` and `ad2aac1c` exist in repository history.
- Task 2 linked deployment and local/generated verification evidence are recorded above.
