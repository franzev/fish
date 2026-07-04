---
phase: 02-secure-account-you-can-return-to
plan: 02
subsystem: database
tags: [supabase, postgres, rls, migrations, security-definer, triggers, generated-types]

# Dependency graph
requires:
  - phase: 02-secure-account-you-can-return-to (plan 01)
    provides: running local Supabase stack (CLI 2.109.0 + Docker), config.toml auth config, pinned @supabase packages
provides:
  - Five ordered migrations (0001-0005) applied cleanly on local Supabase — profiles, handle_new_user trigger, coach_clients, RLS helpers, role guard
  - profiles table with RLS: client self-read, coach reads assigned clients, safe-field self-UPDATE
  - Hardened handle_new_user trigger (security definer, search_path='', coalesce, on conflict do nothing, role hard-coded 'client')
  - coach_clients join table: UNIQUE(client_id) one-coach-per-client + enforce_coach_client_roles integrity trigger
  - private.is_coach_of() SECURITY DEFINER helper (created after coach_clients — no forward reference) that also verifies caller's own coach role
  - prevent_role_self_escalation trigger (authenticated blocked, service_role passes — Assumption A3 verified)
  - Real generated types in database.generated.ts (profiles + coach_clients only); database.types.ts composes them and keeps legacy chat contracts separate
affects: [02-03, 02-04, 02-05, phase-3-coach-home, phase-3-routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration order contract: tables before helpers that reference them — RLS helper functions live in a later migration than the tables they query"
    - "Every new table migration must include explicit GRANT statements (authenticated/service_role) — RLS policies are unreachable without base table privileges"
    - "Generated-vs-hand-written type split: supabase gen types overwrites only database.generated.ts; database.types.ts composes and never gets regenerated over"
    - "All RLS policies wrap auth.uid() as (select auth.uid()) for init-plan caching"

key-files:
  created:
    - supabase/migrations/0001_profiles.sql
    - supabase/migrations/0002_handle_new_user.sql
    - supabase/migrations/0003_coach_clients.sql
    - supabase/migrations/0004_rls_helpers.sql
    - supabase/migrations/0005_role_guard.sql
    - packages/supabase/src/database.generated.ts
  modified:
    - packages/supabase/src/database.types.ts

key-decisions:
  - "Table grants added to 0001/0003 (Rule 1 deviation): fresh Postgres tables carry no privileges for authenticated/service_role — without explicit GRANTs every RLS policy is dead code (permission denied before RLS evaluates)"
  - "Grants scoped to actual policy shape: authenticated gets select+update on profiles but select-only on coach_clients (writes stay service-role only); no anon grant anywhere (no anon-facing policy exists)"
  - "database.types.ts derives ProfileRow/CoachClientRow from the generated Database instead of keeping a duplicate hand-written interface — single source of truth is the schema"
  - "Legacy chat contracts renamed into an explicit LegacyChatContracts interface marked NOT YET MIGRATED — nothing can mistake conversations/messages for live tables"

patterns-established:
  - "Migration-order contract: 0001 tables → 0002 trigger → 0003 dependent table → 0004 helpers/policies that cross-reference → 0005 guards; supabase db reset is the proof gate"
  - "Role integrity enforced at two layers: enforce_coach_client_roles trigger (writes) + is_coach_of caller-role check (reads)"
  - "Grep-gated hardening: security definer + search_path='' + coalesce + on conflict do nothing are all mandatory on any auth.users trigger"

requirements-completed: [DB-01, DB-02, DB-03, DB-04]

# Metrics
duration: 15min
completed: 2026-07-03
---

# Phase 2 Plan 02: Database Schema, RLS, and Role Guards Summary

**Five ordered migrations creating hardened profiles + coach_clients with recursion-safe RLS via private.is_coach_of(), a signup trigger that never blocks auth.users inserts, a role self-escalation guard verified live against local Supabase, and real generated types split from legacy chat contracts**

## Performance

- **Duration:** 15 min (excludes checkpoint wait)
- **Started:** 2026-07-03T00:20:29Z
- **Completed:** 2026-07-03T01:06:49Z
- **Tasks:** 4 (3 auto + 1 blocking human-action checkpoint)
- **Files modified:** 7

## Accomplishments

- All five migrations apply cleanly in order under `supabase db reset` — the review's HIGH forward-reference concern is provably closed (is_coach_of created in 0004, after coach_clients exists from 0003; no `42P01` at any point)
- DB-01 verified live: metadata-less AND malformed-metadata (`role:"coach"`, `display_name:null`) signups each produce exactly one profiles row with `role='client'`, `display_name=''` — the trigger's four hardening elements all held
- DB-04 verified live and genuinely exercised: authenticated safe-field update succeeds (proving the UPDATE reaches the row via RLS), authenticated `role='coach'` self-update raises the guard exception (proving the trigger fired, not RLS), and a service_role role update succeeds (Assumption A3 confirmed — the seed script's D-12 reassignment path is safe)
- DB-03 verified live across three roles: client A sees only A, client B sees only B, coach C-of-A sees C + A but never B; zero `42P17` recursion; a malformed coach_clients row (client-role coach_id) is rejected by enforce_coach_client_roles
- Real `supabase gen types typescript --local` output landed in database.generated.ts (profiles + coach_clients only); database.types.ts composes it while keeping conversations/messages as clearly-marked not-yet-migrated contracts; `pnpm --filter @fish/supabase typecheck` and `pnpm build` both pass

## Task Commits

Each task was committed atomically:

1. **Task 1: profiles + coach_clients tables, hardened trigger, role integrity** - `bc40470` (feat)
2. **Task 2: RLS helper + coach-read + safe-field UPDATE policies, role guard** - `f8df480` (feat)
3. **Task 3: Split generated DB types from legacy chat contracts** - `16c7b99` (feat)
4. **Task 4: Schema push verification + table grants fix + real type regeneration** - `8d3cdad` (fix)

## Files Created/Modified

- `supabase/migrations/0001_profiles.sql` - profiles table (columns match ProfileRow exactly), RLS enabled, client self-read policy, table grants
- `supabase/migrations/0002_handle_new_user.sql` - hardened AFTER INSERT trigger on auth.users: security definer, search_path='', hard-coded 'client', coalesce display_name, on conflict do nothing
- `supabase/migrations/0003_coach_clients.sql` - join table with UNIQUE(client_id), enforce_coach_client_roles BEFORE INSERT/UPDATE trigger, client self-read policy, table grants
- `supabase/migrations/0004_rls_helpers.sql` - private schema, is_coach_of() (SECURITY DEFINER STABLE, caller-role-checked), coach-read policies on both tables, safe-field UPDATE policy on profiles
- `supabase/migrations/0005_role_guard.sql` - prevent_role_self_escalation trigger with WHEN (auth.role() = 'authenticated') so service_role bypasses
- `packages/supabase/src/database.generated.ts` - real `supabase gen types` output (profiles + coach_clients)
- `packages/supabase/src/database.types.ts` - composes generated Database, derives ProfileRow/CoachClientRow, isolates LegacyChatContracts

## Decisions Made

- **Grants scoped to policy shape, not blanket:** authenticated gets `select, update` on profiles (matches its two policies) but only `select` on coach_clients (writes are service-role only by design); no anon grants because no anon-facing policy exists this phase.
- **ProfileRow derived from generated types** (`Database["public"]["Tables"]["profiles"]["Row"]`) rather than kept as a duplicate hand-written interface — regeneration can never drift from the exported contract.
- **Comment wording in migrations avoids grep-gate strings:** 0001/0003 comments reference "the private RLS helper" instead of naming is_coach_of, keeping the plan's literal grep gates (`! grep is_coach_of`) honest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing table-level GRANTs on profiles and coach_clients**
- **Found during:** Task 4 (live verification against local Supabase)
- **Issue:** The planned migrations enabled RLS and created policies but never granted base table privileges. Fresh Postgres tables carry no privileges for `authenticated`/`service_role`, so every query failed with `42501 permission denied for table profiles` — the privilege layer is evaluated BEFORE row level security, making all RLS policies unreachable dead code. Even service_role (which bypasses RLS row-filtering but not table privileges) could not read profiles.
- **Fix:** Added explicit `grant` statements to 0001 (profiles: authenticated select+update; service_role full CRUD) and 0003 (coach_clients: authenticated select; service_role full CRUD), scoped to each table's actual policy shape.
- **Files modified:** supabase/migrations/0001_profiles.sql, supabase/migrations/0003_coach_clients.sql
- **Verification:** After `supabase db reset`, all DB-01/03/04 REST-API checks pass; all Task 1/2 acceptance-criteria grep gates re-run and still pass (grants are not `for insert`/`for update` policy clauses)
- **Committed in:** 8d3cdad (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness — without it the entire schema was inert behind the privilege layer. No scope creep; grants follow the plan's own service-role-writes-only intent.

## Issues Encountered

- `psql` is not installed on the host — DB privilege inspection went through `docker exec supabase_db_fish psql`, and role-based verification went through the Supabase REST API with real authenticated sessions (arguably a truer test of the boundary than SQL role-switching).
- First `supabase gen types --local` run pulled the postgres-meta Docker image (one-time, slow, succeeded).

## Authentication Gates

None — the local stack from plan 02-01 was already running with keys available via `supabase status`.

## User Setup Required

None - no external service configuration required (local Supabase only, per D-13/D-14).

## Next Phase Readiness

- Schema + RLS + guards are live and verified — plan 03 (seed script) can write coach/client accounts through the real auth machinery; the service_role role-update path it needs for D-12 reassignment is proven working
- `@fish/supabase` now exports real `Database` types — plans 04/05 auth screens can type their client factories (the untyped-clients stub from 02-01 can be resolved)
- Note for verification: DB-02's seed-script half lands in plan 03; this plan delivered the schema half (coach_clients + UNIQUE + integrity trigger), and the plan's requirements frontmatter claims DB-02 accordingly

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Untyped Supabase client factories | apps/web/lib/supabase/{client,server}.ts | Carried from 02-01 — real Database types now exist; wiring the generic is wave-3 work (plans 04/05) when the screens consume them |

## Self-Check: PASSED

- All 7 created/modified files verified present on disk (`[ -f ]`)
- All 4 task commits found in `git log` (bc40470, f8df480, 16c7b99, 8d3cdad)
- Plan-level verification re-run: `supabase db reset` applies 0001→0005 cleanly (no 42P01); all grep gates pass (trigger hardening quartet present; is_coach_of absent from 0001/0003, present in 0004; no conversations in generated file); `pnpm --filter @fish/supabase typecheck` and `pnpm build` exit 0

---
*Phase: 02-secure-account-you-can-return-to*
*Completed: 2026-07-03*
