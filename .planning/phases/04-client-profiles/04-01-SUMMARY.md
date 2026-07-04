---
phase: 04-client-profiles
plan: 01
subsystem: database
tags: [postgres, rls, supabase, grants, triggers, zod, verify-rls]

# Dependency graph
requires:
  - phase: 01-03 (v1.0 Monochrome Foundations)
    provides: profiles/coach_clients schema, private.is_coach_of helper (0004), prevent_role_self_escalation trigger shape (0005), verify-rls.ts harness, seed.ts fixtures
provides:
  - "client_profiles table (1:1 with profiles) — goal, locale, timezone, level, a11y prefs, consent fields"
  - "Column-scoped GRANT UPDATE freeze (layer 1) — level never granted to authenticated"
  - "prevent_level_self_escalation BEFORE-UPDATE trigger (layer 2) — independent freeze"
  - "provision_client_profile AFTER INSERT ON profiles trigger — auto-provisions every client's row"
  - "Three RLS policies: self-read, self-safe-update, coach-read (reusing is_coach_of verbatim)"
  - "Six new verify:rls assertions proving PROF-01/02/04/05/06 live through real PostgREST"
  - "Seed: leveled client_profiles backfill per client + a second unassigned coach fixture (coach2@fish.dev)"
  - "zod ^4.4.3 installed in apps/web (the one net-new milestone runtime dependency)"
affects: [04-02, 04-03, 05-onboarding, 06-tracker]

# Tech tracking
tech-stack:
  added: ["zod ^4.4.3 (apps/web only)"]
  patterns:
    - "Column-scoped GRANT UPDATE (...) as freeze layer 1, paired with a BEFORE-UPDATE trigger mirroring 0005's shape as an independent freeze layer 2 — the reused write-safety discipline every later v1.1 phase copies for its own protected fields"
    - "Auto-provisioning via a separate AFTER INSERT ON profiles trigger, never editing the already-hardened handle_new_user (0002) — isolates future protected-field additions from the auth-critical path"
    - "verify:rls assertions always sign in via signInAs() (real PostgREST, anon/publishable key) — never SET ROLE, which produces a false pass from a table-owning connection"

key-files:
  created:
    - supabase/migrations/0007_client_profiles.sql
  modified:
    - scripts/seed.ts
    - scripts/verify-rls.ts
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Followed RESEARCH Pattern 1 DDL verbatim — column-scoped grant + independent trigger, level never named in the authenticated UPDATE grant"
  - "Followed RESEARCH Pattern 3 Option B — separate AFTER INSERT ON profiles trigger for auto-provisioning; handle_new_user (0002) untouched"
  - "Seeded levels are plain data strings (A2/B1/A2) — level is data, never a grade, per D-10"
  - "Negative-path assertions (unassigned-coach, cross-client) assert rows.length === 0 with no error — RLS default-deny returns zero rows, not an error, so there is no enumeration side channel"

patterns-established:
  - "Pattern: freeze a coach/system-owned column with GRANT UPDATE(explicit safe list) + a BEFORE-UPDATE trigger mirroring prevent_role_self_escalation's shape — reuse this exact shape for any future protected field (e.g. tracker assignment state, onboarding response locks)"
  - "Pattern: auto-provision a 1:1 child table via a dedicated AFTER INSERT trigger on the parent table, never by editing an already-hardened trigger function"

requirements-completed: [PROF-01, PROF-04, PROF-05, PROF-06]

coverage:
  - id: D1
    description: "client_profiles table created (1:1 with profiles) with D-01/D-04/D-08/D-12 columns; PK references profiles(id) on delete cascade"
    requirement: "PROF-01"
    verification:
      - kind: integration
        ref: "pnpm verify:rls — PASS: PROF-01 client_profiles self-read: exactly one own row"
        status: pass
    human_judgment: false
  - id: D2
    description: "Client can read own client_profiles row and update safe fields (goal, consent fields) through RLS + column grant"
    requirement: "PROF-04"
    verification:
      - kind: integration
        ref: "pnpm verify:rls — PASS: PROF-02/04 client_profiles safe-update (goal + consent fields) succeeds"
        status: pass
    human_judgment: false
  - id: D3
    description: "A client's attempt to change level is rejected at the database (two-layer freeze: column grant 42501, or trigger P0001)"
    requirement: "PROF-05"
    verification:
      - kind: integration
        ref: "pnpm verify:rls — PASS: PROF-05 level freeze: client's level update is rejected at the database (permission denied for table client_profiles)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An assigned coach can read their client's client_profiles row; an unassigned coach and a cross-client read both return zero rows (default-deny, no leak)"
    requirement: "PROF-06"
    verification:
      - kind: integration
        ref: "pnpm verify:rls — PASS: PROF-06 coach reads assigned client_profile: exactly one row; PASS: PROF-06 unassigned coach denied: zero rows returned (no error, no leak); PASS: PROF-05/06 cross-client denied: zero rows returned"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every client (seed + real signup) always has a client_profiles row via the provision_client_profile auto-provision trigger, plus a seed backfill for pre-migration accounts"
    verification:
      - kind: integration
        ref: "pnpm db:reset && pnpm seed — coach, coach2 (unassigned), and three leveled clients created with no error; client_profiles rows present for all three clients (proven indirectly by the PROF-01/02/04/05/06 assertions above, all of which depend on the row existing)"
        status: pass
    human_judgment: false
  - id: D6
    description: "pnpm verify:rls is fully green: the six new client_profiles assertions plus the eight pre-existing assertions all PASS, no regression"
    verification:
      - kind: integration
        ref: "pnpm verify:rls — exit 0, 14/14 PASS lines (8 pre-existing + 6 new)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-04
status: complete
---

# Phase 4 Plan 1: Client Profiles Schema Summary

**Two-layer DB-enforced `level` freeze (column grant 42501 + independent BEFORE-UPDATE trigger P0001) on a new `client_profiles` table, auto-provisioned via a dedicated trigger, with six new live `verify:rls` assertions through real PostgREST — the write-safety discipline the whole v1.1 milestone reuses.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-04T16:10:01Z
- **Completed:** 2026-07-04T16:14:52Z
- **Tasks:** 4 (3 committed + 1 blocking verification gate with no source files)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `client_profiles` table (1:1 with `profiles`) landed with all D-01/D-04/D-08/D-12 columns: `goal`, `locale`, `timezone`, `level`, `theme_pref`/`text_size_pref`/`reduced_motion_pref` (nullable, NULL = follow system), `consented`/`consented_at`/`consent_version`.
- The two-layer `level` freeze is live and proven: a client's own `UPDATE .level` is rejected with `permission denied for table client_profiles` (grant-layer `42501`) before the trigger ever runs; the independent `prevent_level_self_escalation` trigger exists as a second layer for any future accidental grant-widening.
- Auto-provisioning via `provision_client_profile_trigger` (a separate `AFTER INSERT ON profiles` trigger) guarantees every client always has a row — `handle_new_user` (0002) was never touched.
- Three RLS policies (self-read, self-safe-update, coach-read via `private.is_coach_of` reused verbatim) are all live-verified through real PostgREST sign-ins, never `SET ROLE`.
- Six new `verify:rls` assertions all PASS, alongside the 8 pre-existing assertions — 14/14, zero regression.
- Seed extended: a leveled `client_profiles` backfill per client (`A2`/`B1`/`A2`, seeded as plain data, never a grade) and a genuinely unassigned second coach fixture (`coach2@fish.dev`) for the negative RLS assertions.
- `zod ^4.4.3` installed in `apps/web` only (the one net-new milestone runtime dependency, per D-16/XC-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install zod, extend seed with client_profiles backfill and a second unassigned coach** - `d3833f1` (feat)
2. **Task 2: Write migration 0007 — table, column grants, RLS policies, level freeze, auto-provision** - `27abb1a` (feat)
3. **Task 3: Add six client_profiles assertions to verify-rls.ts and wire into main()** - `826b288` (test)
4. **Task 4: [BLOCKING] Apply migrations locally, seed, then run verify:rls green** - no source files; local `pnpm db:reset && pnpm seed && pnpm verify:rls` gate, confirmed green (see Performance/verification below)

**Plan metadata:** (this commit — see Final Commit below)

## Files Created/Modified

- `supabase/migrations/0007_client_profiles.sql` - `client_profiles` table, column-scoped grants (level excluded from the authenticated UPDATE grant), three RLS policies, `prevent_level_self_escalation`/`prevent_level_change` trigger, `provision_client_profile`/`provision_client_profile_trigger`
- `scripts/seed.ts` - `backfillClientProfile()` helper (idempotent upsert, modeled on `assignClient()`), a second coach (`coach2@fish.dev`) promoted but never assigned, seeded `level` per client wired into the existing `for (const client of clients)` loop
- `scripts/verify-rls.ts` - six new assertion functions (`checkClientProfileSelfRead`, `checkClientProfileSafeUpdateSucceeds`, `checkLevelFreezeRejected`, `checkCoachReadsAssignedClientProfile`, `checkUnassignedCoachDenied`, `checkCrossClientDenied`) wired into `main()`
- `apps/web/package.json` - `zod: "^4.4.3"` added to dependencies
- `pnpm-lock.yaml` - lockfile updated for the zod install

## New Trigger/Function Names (for downstream plans)

- `public.prevent_level_self_escalation()` / trigger `prevent_level_change` (BEFORE UPDATE, `WHEN (auth.role() = 'authenticated')`) — freeze layer 2
- `public.provision_client_profile()` / trigger `provision_client_profile_trigger` (AFTER INSERT ON `profiles`) — auto-provisioning

## New verify-rls.ts Function Names

- `checkClientProfileSelfRead` (PROF-01)
- `checkClientProfileSafeUpdateSucceeds` (PROF-02/04)
- `checkLevelFreezeRejected` (PROF-05)
- `checkCoachReadsAssignedClientProfile` (PROF-06 positive)
- `checkUnassignedCoachDenied` (PROF-06 negative)
- `checkCrossClientDenied` (cross-client negative)

## Seeded Fixture Values (for downstream plans/UI work)

- `client1@fish.dev` — level `A2`
- `client2@fish.dev` — level `B1`
- `client3@fish.dev` — level `A2`
- Second, unassigned coach: `coach2@fish.dev` / `fish-coach-dev` (promoted, never assigned any client — the fixture `checkUnassignedCoachDenied()` needs)

## Decisions Made

- Followed RESEARCH Pattern 1's live-verified DDL verbatim: `grant update (goal, locale, timezone, theme_pref, text_size_pref, reduced_motion_pref, consented, consented_at, consent_version)` — `level` never named.
- Followed RESEARCH Pattern 3 Option B for auto-provisioning: a separate `AFTER INSERT ON profiles` trigger, not an edit to the hardened `handle_new_user` (0002) — keeps the auth-critical path's blast radius unchanged.
- The level-freeze assertion checks for a truthy error only (not a specific error code) per the plan's acceptance criteria — this session's live run happened to hit the grant layer (`42501`/"permission denied"), which is itself proof the grant-scoping is correctly narrow; the trigger remains as the documented second layer for any future grant-widening regression.
- Negative-path assertions (`checkUnassignedCoachDenied`, `checkCrossClientDenied`) assert `rows.length === 0` with no error — RLS default-deny returns zero rows, not an error, so there is no enumeration side channel to check for.

## Deviations from Plan

None - plan executed exactly as written. Two minor in-flight comment corrections during Task 3 authoring (a garbled draft sentence in the coach-read and unassigned-coach-denied helper comments) were cleaned up before verification/commit — not deviations from the plan's required behavior, just comment-clarity fixes caught during self-review before the code was ever run or committed.

## Issues Encountered

None. All three commit-bearing tasks and the blocking verification gate completed cleanly on the first attempt: `pnpm db:reset` applied migrations 0001→0007 with no error, `pnpm seed` ran idempotently (confirmed via a second run reporting "Already exists" for all pre-created accounts), and `pnpm verify:rls` was green on the first run and confirmed stable on a re-run.

## User Setup Required

None - no external service configuration required. This plan is 100% local (RESEARCH Environment Availability) — no remote Supabase project was linked.

## Next Phase Readiness

- `client_profiles` schema, its RLS policies, and the two-layer `level` freeze are live on the local Supabase stack and fully verified — plans 04-02 and 04-03 (the client edit flow and coach detail view) can now build directly against this schema with no further DB work required for the core write-safety guarantee.
- `zod` is installed in `apps/web` and ready for the profile edit payload validation (D-16) that 04-02 will add.
- The seeded fixtures (leveled clients, unassigned second coach) are in place for any UI-level manual verification in 04-02/04-03.
- No blockers. `pnpm build` remains green (15 routes, same baseline as before this plan) and `pnpm verify:rls` is 14/14 — no regression to the 8 pre-existing assertions from v1.0.

---
*Phase: 04-client-profiles*
*Completed: 2026-07-04*
