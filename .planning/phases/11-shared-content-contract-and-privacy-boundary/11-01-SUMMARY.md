---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 01
subsystem: database
tags: [supabase, postgres, rls, rpc, generated-types, pagination, privacy]

# Dependency graph
requires:
  - phase: 10-bounded-chat-loading
    provides: "Bounded direct-conversation message loading and stable message identity"
provides:
  - "Deployed shared-content schema contract with authorized normalized listing, category, context, deletion, and cleanup RPCs"
  - "Generated Supabase database contract through migration 0061"
  - "Intentional TypeScript aliases for link previews and shared-content RPC rows"
affects: [phase-11-plan-02, phase-11-plan-05, native-shared-content, shared-content-verification]

# Tech tracking
tech-stack:
  added: ["Supabase linked migration push", "supabase gen types typescript"]
  patterns: ["Database-owned normalized shared-content projection", "Generated schema plus indexed intentional aliases"]

key-files:
  created: []
  modified:
    - supabase/migrations/0061_shared_content_contract.sql
    - packages/supabase/src/database.generated.ts
    - packages/supabase/src/database.types.ts

key-decisions:
  - "The linked project accepted migrations 0059, 0060, and 0061 before generated-contract verification proceeded."
  - "The generated database file is sourced from a fresh local reset; downstream aliases index generated table and function shapes rather than duplicating fields."
  - "Two SQL defects found by local lint were repaired in the canonical migration and applied remotely with idempotent function replacements."

patterns-established:
  - "Shared-content RPCs remain SECURITY INVOKER with explicit membership checks, RLS, empty search paths, and authenticated-only grants."
  - "The four-field keyset order and p_limit + 1 sentinel are represented in the database contract before platform consumers are built."

requirements-completed: [DISC-03, PRIV-01, PAGE-01, PAGE-02]

# Metrics
duration: 34min
completed: 2026-07-22
---

# Phase 11 Plan 01: Shared-content database contract and privacy boundary Summary

**The linked Supabase project now runs the Phase-11 shared-content schema, with a fresh generated TypeScript contract for authorized pagination, deletion visibility, and bounded source context.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-07-22T09:39:56+08:00
- **Completed:** 2026-07-22T10:13:13+08:00
- **Tasks:** 3 (Task 2 was an authentication checkpoint with no repository changes)
- **Files modified:** 3 production files

## Accomplishments

- Pushed the linked migration chain through `0061_shared_content_contract.sql`; remote migration history now matches local through `0059`, `0060`, and `0061`.
- Rebuilt the local database from the complete migration chain, passed the local database linter, and confirmed the deployed listing/category functions contain the corrected SQL.
- Regenerated `database.generated.ts` and exposed `MessageLinkPreviewRow`, `SharedContentRpcRow`, `SharedContentCategoryRpcRow`, and `MessageContextRpcRow` as intentional generated-shape aliases.
- Preserved the database-owned security boundary: authenticated membership checks, RLS-preserving invoker RPCs, deterministic four-field pagination, source tombstone visibility, and service-role-only cleanup functions.

## Verification

- `supabase projects list` — passed; linked project identified as `fish`.
- `supabase db push --linked --yes` — passed; migrations `0049` through `0061` were accepted in order, including `0059`, `0060`, and `0061`.
- `supabase migration list` — passed; local and remote identifiers match through `0061`.
- `supabase db reset --local --yes` — passed; complete local chain rebuilt successfully.
- `supabase db lint --local --level error` — passed with zero results after the SQL corrections.
- `supabase db push --linked --dry-run --yes` — passed; remote database is up to date.
- `pnpm --filter @fish/supabase typecheck` — passed.
- `pnpm build` — passed for core, Supabase, and web.

## Task Commits

Each repository task was committed atomically:

1. **Task 1: Create the authorized normalized schema contract** - `023916fb` (feat)
2. **Task 2: Authorize the linked Supabase push** - authentication checkpoint completed; no repository commit
3. **Task 3: Push the schema and expose its generated contract** - `11b0f77b` (feat)

## Files Created/Modified

- `supabase/migrations/0061_shared_content_contract.sql` - Phase-11 schema, RPC authorization, normalized projection, pagination, deletion fan-out, and cleanup claim/finish contract; corrected after local lint found projection and category-order defects.
- `packages/supabase/src/database.generated.ts` - Fresh TypeScript schema generated from the fully reset local database.
- `packages/supabase/src/database.types.ts` - Provider-boundary aliases for link previews and Phase-11 RPC rows.

## Decisions Made

- The remote push is a prerequisite for any later behavioral verification; type generation and build checks were performed only after the linked project accepted the schema.
- The canonical migration remains `0061`; the two deployed SQL corrections were applied with idempotent `CREATE OR REPLACE FUNCTION` statements so the already-applied remote migration matches the corrected source without introducing a speculative migration number.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed the normalized listing UNION projection**
- **Found during:** Task 3 local database lint
- **Issue:** The attachment branch returned one fewer column than the GIF, sticker, and link branches, and the unnamed CTE columns made the declared category/cursor fields unavailable to the filter and order clauses.
- **Fix:** Added the missing typed null projection and declared the complete 28-column `eligible` CTE shape; applied the same function correction to the linked database.
- **Files modified:** `supabase/migrations/0061_shared_content_contract.sql`
- **Verification:** Fresh `supabase db reset`, local lint, linked function-definition check, package typecheck, and workspace build all passed.
- **Committed in:** `11b0f77b`

**2. [Rule 1 - Bug] Fixed deterministic category ordering with DISTINCT**
- **Found during:** Task 3 local database lint
- **Issue:** PostgreSQL rejected ordering a `SELECT DISTINCT` result by an expression not present in its select list.
- **Fix:** Ordered a distinct derived table by the fixed category ranking, then applied the same function correction to the linked database.
- **Files modified:** `supabase/migrations/0061_shared_content_contract.sql`
- **Verification:** Fresh local reset and `supabase db lint --local --level error` passed with zero issues; linked function-definition check passed.
- **Committed in:** `11b0f77b`

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs).
**Impact on plan:** Both fixes were required for the planned migration to execute correctly and for the live database contract to match the source; no new schema surface or package was introduced.

## Authentication Gates

Task 2 was completed after the user provisioned the Supabase credential in the execution environment. `supabase projects list` and `supabase migration list` succeeded without exposing the token; no credential was written to the repository or summary.

## Issues Encountered

- The first linked push applied the pending chain before local lint identified the two SQL defects above. The canonical migration was corrected, local state was rebuilt, and the two affected remote functions were updated idempotently before verification continued.

## Known Stubs

None found in the files modified by this plan.

## Threat Surface Review

No new trust boundary beyond the plan's threat model was introduced. The migration adds only the planned authenticated invoker RPCs, sender-authorized deletion fan-out, and service-role cleanup functions.

## User Setup Required

None - the linked Supabase credential gate was completed during execution.

## Next Phase Readiness

Plan 02 can consume the deployed shared-content RPCs and generated aliases. Plan 05 must still run the adversarial live database verifier after the lifecycle wiring from Plan 02 is complete.

---
*Phase: 11-shared-content-contract-and-privacy-boundary*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- Task commits `023916fb` and `11b0f77b` exist in repository history.
