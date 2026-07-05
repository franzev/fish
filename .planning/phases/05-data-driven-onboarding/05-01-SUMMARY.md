---
phase: 05-data-driven-onboarding
plan: 01
subsystem: database
tags: [supabase, postgres, rls, onboarding, pg_jsonschema]
requires:
  - phase: 04-client-profiles
    provides: coach/client assignment relationship and private.is_coach_of helper
provides:
  - Versioned onboarding schema and command functions
  - Seeded active onboarding assessment
  - Generated Supabase onboarding row aliases
  - Live RLS verification for onboarding ownership, resume, finalize, and coach review
affects: [phase-05-data-driven-onboarding, phase-06-tracker-engine]
tech-stack:
  added: [pg_jsonschema extension]
  patterns: [security-definer command functions deriving auth.uid, answer snapshot pinning, freeze triggers]
key-files:
  created:
    - supabase/migrations/0008_onboarding.sql
  modified:
    - scripts/seed.ts
    - scripts/verify-rls.ts
    - packages/supabase/src/database.generated.ts
    - packages/supabase/src/database.types.ts
key-decisions:
  - "Save/finalize are SQL command functions called through authenticated clients; no Edge Function here."
  - "Answers snapshot question metadata so coach review can render pinned prompts/options."
  - "Used assessment versions/questions are frozen by triggers once referenced by attempts."
patterns-established:
  - "Onboarding command functions derive identity from auth.uid() and accept no client_id/coach_id."
  - "RLS checks use real anon-key sessions; service-role appears only for DB-level malformed-config/freeze assertions."
requirements-completed: [ONBD-01, ONBD-03, ONBD-05, ONBD-06, ONBD-07]
duration: ~25min
completed: 2026-07-05
---

# Phase 05: Data-Driven Onboarding Plan 01 Summary

**Versioned Supabase onboarding foundation with immutable question versions, authenticated save/finalize commands, seeded neutral questions, generated types, and live RLS proof**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-05T02:59:11Z
- **Completed:** 2026-07-05T03:13:02Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added the onboarding database model: assessments, versions, questions, attempts, and answer snapshots.
- Added authenticated SQL command functions that derive client identity from `auth.uid()` and never accept `client_id` or `coach_id`.
- Seeded one active, published, neutral assessment covering all six planned field types.
- Regenerated Supabase types and exported onboarding row aliases for downstream web work.
- Extended `pnpm verify:rls` with live onboarding ownership, assigned-coach, denial, malformed-config, immutability, finalize-lock, and save/resume checks.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create versioned onboarding schema, RLS, command functions, and freeze triggers** - `181a2ba` (feat)
2. **Task 2: Seed one neutral active assessment and regenerate Supabase type aliases** - `1e7d28a` (feat)
3. **Task 3: Extend live RLS verification for onboarding ownership, coach access, config checks, and save/resume** - `83b3c16` (test)

## Files Created/Modified

- `supabase/migrations/0008_onboarding.sql` - Versioned onboarding schema, RLS policies, command functions, config checks, and freeze triggers.
- `scripts/seed.ts` - Seeds one active assessment version with six neutral question types.
- `scripts/verify-rls.ts` - Adds onboarding RLS and command verification against real authenticated sessions.
- `packages/supabase/src/database.generated.ts` - Regenerated from the local Supabase schema after the onboarding migration.
- `packages/supabase/src/database.types.ts` - Adds onboarding table row aliases.

## Decisions Made

- Kept save/finalize as database command functions because this plan is the data boundary; server actions in later plans can call the same RLS-protected commands.
- Snapshot question metadata on answers so coach review can render exactly what the client saw even after future version changes.
- Freeze used versions/questions through triggers rather than application-only checks so migrations, seed scripts, and service-role callers cannot mutate answered assessment definitions accidentally.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Qualified SQL output names in save/finalize functions**

- **Found during:** Task 3 (live RLS verification)
- **Issue:** PostgreSQL reported ambiguous output-column references for `attempt_id` in `save_onboarding_answer` and `submitted_at` in `finalize_onboarding_attempt`.
- **Fix:** Qualified the affected references and used `on conflict on constraint onboarding_answers_attempt_question_key` for the answer upsert path.
- **Files modified:** `supabase/migrations/0008_onboarding.sql`
- **Verification:** `pnpm db:reset && pnpm seed && pnpm verify:rls`
- **Committed in:** `83b3c16`

**2. [Rule 2 - Quality] Removed stale verification wording**

- **Found during:** Task 3 acceptance scan
- **Issue:** A stale comment in `scripts/verify-rls.ts` mentioned manual `SET ROLE` despite the verifier using real authenticated clients.
- **Fix:** Reworded the comment so the source text matches the verification approach and the `SET ROLE` scan is clean.
- **Files modified:** `scripts/verify-rls.ts`
- **Verification:** `rg -n "SET ROLE" scripts/verify-rls.ts` returns no matches.
- **Committed in:** `83b3c16`

---

**Total deviations:** 2 auto-fixed (1 blocking SQL correctness issue, 1 quality/source-truth issue)
**Impact on plan:** Both fixes tightened the planned implementation. No scope was added.

## Issues Encountered

- The first full RLS run failed because `save_onboarding_answer` had an ambiguous `attempt_id` reference. The migration was fixed and reset cleanly.
- The second full RLS run failed because `finalize_onboarding_attempt` had an ambiguous `submitted_at` reference. The migration was fixed and the full verification passed.

## Verification

- `pnpm db:reset && pnpm seed && pnpm verify:rls` - passed; output ended with `All assertions passed.`
- `pnpm typecheck` - passed.
- `if rg -n "score|grade|placement|recommendation|streak" scripts/seed.ts; then exit 1; else echo "seed copy scan passed"; fi` - passed.
- `if rg -n "SET ROLE" scripts/verify-rls.ts; then exit 1; else echo "verify-rls SET ROLE scan passed"; fi` - passed.
- `rg -n 'save_onboarding_answer\([^)]*(client_id|coach_id)|finalize_onboarding_attempt\([^)]*(client_id|coach_id)' supabase/migrations/0008_onboarding.sql` - no matches.

## Self-Check: PASSED

- Key created file exists: `supabase/migrations/0008_onboarding.sql`.
- Task commits exist for `05-01`.
- All task acceptance criteria and plan-level verification commands passed before summary creation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 05-02 can build the shared field contracts, zod validation, renderer, and onboarding conversation UI on top of the seeded database question model and generated Supabase aliases. The tracker engine can later reuse the field contract patterns established by this plan.

---
*Phase: 05-data-driven-onboarding*
*Completed: 2026-07-05*
