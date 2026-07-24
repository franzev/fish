---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 05
subsystem: testing
tags: [supabase, postgres, rls, pagination, cleanup, generated-types, adversarial-verification]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: "Deployed shared-content RPCs, generated Supabase aliases, canonical link persistence, and retry-safe deleted attachment cleanup"
provides:
  - "Privacy-safe live adversarial verifier for the complete shared-content database and cleanup boundary"
  - "Root verify:shared-content command with generated-contract drift and long-history EXPLAIN gates"
affects: [phase-11-verification, phase-12-shared-content-runtime, phase-14-source-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use temporary real Auth identities and an isolated conversation/channel for adversarial RLS tests"
    - "Capture EXPLAIN evidence in memory through a single SQL statement with an explicit auth context"
    - "Emit stable PASS/FAIL labels and safe error codes without logging private IDs, URLs, paths, tokens, or bodies"

key-files:
  created:
    - scripts/verify-shared-content.ts
    - .planning/phases/11-shared-content-contract-and-privacy-boundary/11-05-SUMMARY.md
  modified:
    - package.json
    - packages/supabase/src/database.generated.ts

key-decisions:
  - "The verifier creates and deletes temporary real Auth identities so seeded community membership cannot authorize an adversarial case accidentally."
  - "EXPLAIN uses a single CTE statement to set the test identity because Supabase db query executes one prepared statement at a time."
  - "Generated type drift is a byte comparison against supabase gen types --local, including the generator's final blank line."

patterns-established:
  - "Every live case reports a stable name and sanitized code; sensitive evidence remains in process memory only."
  - "Reference ordering is compared against every normalized item identity before pagination is accepted."

requirements-completed: [DISC-03, PRIV-01, PAGE-01, PAGE-02]

# Metrics
duration: 42min
completed: 2026-07-22
---

# Phase 11 Plan 05: Shared-content live verification Summary

**A live, privacy-safe Supabase gate now proves shared-content authorization, seven-kind classification, sentinel pagination, bounded context, deletion fan-out, cleanup retries, EXPLAIN coverage, and generated-contract drift.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-07-22T11:24:00Z
- **Completed:** 2026-07-22T12:06:53Z
- **Tasks:** 1
- **Files modified:** 3 production files plus this summary

## Accomplishments

- Added `scripts/verify-shared-content.ts` and the root `verify:shared-content` command.
- Seeded an isolated real-identity fixture with 2,000 ordinary history messages, all seven eligible kinds, every required exclusion, 81 file identities, equal timestamps, multi-item sources, insertion/deletion races, and category-old-content cases.
- Passed signed-out, outsider, other-conversation, former/blocked-member, authorized-member, direct-table, anonymous RPC, service-role cleanup, sender/recipient deletion, signing, canonical-link, context, pagination, cleanup, and exact reference-order assertions.
- Captured safe bounded EXPLAIN evidence for unfiltered, every category, deep cursor, and category-availability queries without introducing an unmeasured index.
- Added a byte-exact generated Supabase type comparison and verified aliases still index generated table/function shapes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build and pass the complete adversarial shared-content verifier** - `63b8d650` (feat)

**Plan metadata:** pending; this summary, STATE.md, and ROADMAP.md are committed in the final metadata commit.

## Files Created/Modified

- `scripts/verify-shared-content.ts` - Live seeded adversarial authorization, classification, pagination, context, deletion, cleanup, EXPLAIN, and generated-drift gate.
- `package.json` - Root `verify:shared-content` entrypoint using Node TypeScript stripping and `apps/web/.env.local`.
- `packages/supabase/src/database.generated.ts` - Restored the generator's final blank line so byte drift is zero.

## Verification

- `supabase migration list --linked` - passed; hosted local/remote history matches through `0059`, `0060`, and `0061`.
- `pnpm verify:shared-content` - passed; every emitted case is `PASS` and the command exits 0.
- `supabase gen types typescript --local` byte comparison - passed.
- `pnpm build` - passed.
- `pnpm lint` - passed.
- `pnpm typecheck` - passed.

The pre-issued signed URL was retained only in memory. The verifier reports the truthful maximum 900-second bearer window and separately proves new signing is denied immediately after tombstoning; it never prints or persists the URL.

## Decisions Made

- Temporary test users are created through the real Supabase Auth admin API, used through publishable-key sessions, and deleted in the verifier's `finally` cleanup. This prevents pre-existing community channels from invalidating outsider/former-member assertions.
- EXPLAIN cases run through one SQL statement with a CTE auth context and only emit safe plan-capture status, avoiding private identifiers in logs.
- The generated file is compared byte-for-byte rather than normalizing output, so the committed generator newline is part of the contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Isolated the verifier from seeded community membership**
- **Found during:** Task 1 authorization matrix
- **Issue:** The initial fixture reused a seeded community conversation, causing unrelated community identities to be valid members and masking outsider/former-member failures.
- **Fix:** Create temporary real Auth identities, promote only the test coach, assign the test owner, and delete all identities and fixture rows in `finally`.
- **Files modified:** `scripts/verify-shared-content.ts`
- **Verification:** Former, blocked, signed-out, outsider, and other-conversation cases all pass with zero rows.
- **Committed in:** `63b8d650`

**2. [Rule 3 - Blocking] Made EXPLAIN execution compatible with the Supabase CLI query boundary**
- **Found during:** Task 1 query-plan gate
- **Issue:** `supabase db query` rejects multiple SQL statements in one prepared request, so transaction/session setup could not run as initially written.
- **Fix:** Use one `WITH auth_context AS (...)` statement and a lateral RPC call for each EXPLAIN case.
- **Files modified:** `scripts/verify-shared-content.ts`
- **Verification:** Six shared-content EXPLAIN cases plus category availability pass.
- **Committed in:** `63b8d650`

**3. [Rule 1 - Bug] Corrected the pre-issued signed-object path**
- **Found during:** Task 1 signing/deletion checks
- **Issue:** The verifier uploaded a path different from the attachment's persisted display path, so pre-deletion signing tested a nonexistent object.
- **Fix:** Reuse the exact persisted display path for upload and signing.
- **Files modified:** `scripts/verify-shared-content.ts`
- **Verification:** Pre-issued 15-minute URL and post-tombstone signing assertions pass.
- **Committed in:** `63b8d650`

**4. [Rule 1 - Bug] Restored generated-file byte parity**
- **Found during:** Task 1 generated-contract drift gate
- **Issue:** The committed generated file was missing the generator's final blank line and failed exact comparison despite identical schema content.
- **Fix:** Restored the generated output byte-for-byte; no schema or handwritten contract was changed.
- **Files modified:** `packages/supabase/src/database.generated.ts`
- **Verification:** `supabase gen types typescript --local` compares equal and the verifier passes.
- **Committed in:** `63b8d650`

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs, 1 Rule 3 blocking issue).
**Impact on plan:** All fixes made the planned live gate deterministic or mechanically correct; no new product or schema surface was introduced.

## Issues Encountered

- Local Supabase database services were running while the Edge Functions runtime was stopped. The runtime was started with the existing local project configuration before verification; no external credential gate was needed.

## Known Stubs

None found in the files created or modified by this plan.

## Threat Surface Review

No new trust boundary beyond the plan's threat model was introduced. The script exercises existing publishable-key RLS/RPC paths and uses service role only for isolated setup, administrative inspection, cleanup claims, and fixture teardown.

## User Setup Required

None. Hosted migration evidence was already available through the linked Supabase CLI, and local verification services were started during execution.

## Next Phase Readiness

Phase 11's shared-content database, lifecycle, native parity, and live adversarial verification artifacts are complete. The repository is ready for phase-level verification; hosted migration history is confirmed through 0061.

---
*Phase: 11-shared-content-contract-and-privacy-boundary*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- Task commit `63b8d650` exists in repository history.
- Live verifier, build, lint, typecheck, hosted migration-list, and generated-type drift checks passed.
