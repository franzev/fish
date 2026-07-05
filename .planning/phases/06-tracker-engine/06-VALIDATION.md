---
phase: 6
slug: tracker-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-05
---

# Phase 6 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` § Validation Architecture. The **Per-Task Verification Map**
> is keyed by requirement until the planner assigns task IDs; the planner / `gsd-validate-phase`
> refine it to per-task rows before closeout.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Testing Library for web; the plain-Node `scripts/verify-rls.ts` live-RLS harness for authorization; `supabase db reset`/local apply for schema |
| **Config file** | `apps/web/vitest.config.ts`; `scripts/verify-rls.ts` (grows with `checkTracker*` assertions); `package.json` scripts |
| **Quick run command** | `pnpm --filter @fish/web test -- --run <changed test files>` (+ `pnpm --filter @fish/web typecheck`) |
| **Full suite command** | `pnpm build && pnpm lint && pnpm typecheck && pnpm verify:rls` |
| **Estimated runtime** | ~120–240 seconds full suite |

---

## Sampling Rate

- **After every task commit:** nearest changed-file Vitest + `pnpm --filter @fish/web typecheck`.
- **After every plan wave:** `pnpm build && pnpm verify:rls` after any migration/RLS/Edge-Function work.
- **Before `/gsd-verify-work`:** full suite green: `pnpm build && pnpm lint && pnpm typecheck && pnpm verify:rls`, plus one documented `assign-tracker` Edge Function invocation proof.
- **Max feedback latency:** under 3 minutes for a targeted task check; under 15 minutes per wave.

---

## Per-Task Verification Map

> Requirement-level until the planner assigns task IDs; `Threat Ref` values point at the
> `06-RESEARCH.md` § Known Threat Patterns rows. Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| TRAK-01 | Tracker renders from a versioned config (fields + daily/weekly cadence), never hard-coded | integration + component | `pnpm --filter @fish/web test -- --run 'apps/web/app/(authenticated)/tracker/page.test.tsx'` | ❌ W0 | ⬜ pending |
| TRAK-02 | `assign-tracker` derives coach/version server-side; client self-assign and cross-client assign rejected (live function proof) | RLS live assertion + Edge Function invocation | `pnpm verify:rls` (`checkTrackerSelfAssignRejected`, `checkTrackerUnassignedCoachAssignRejected`) + documented `assign-tracker` call proof | ❌ W0 | ⬜ pending |
| TRAK-03 | Entry saves; draft preserved on failure/navigation; entry pins config version | component + RLS/integration | `pnpm --filter @fish/web test -- --run apps/web/components/tracker/tracker-entry-flow.test.tsx` + `pnpm verify:rls` (`checkTrackerEntrySelfSave`) | ❌ W0 | ⬜ pending |
| TRAK-04 | Config validated (zod + `pg_jsonschema`) and versioned; each entry pins version; used version immutable | unit + RLS live assertion | `pnpm --filter @fish/web test -- --run apps/web/lib/validation/tracker.test.ts` + `pnpm verify:rls` (`checkTrackerMalformedConfigRejected`, `checkTrackerUsedVersionImmutable`) | ❌ W0 | ⬜ pending |
| TRAK-05 | Visual milestone progress; **no** streak/adherence/score column in schema, **no** grade/%/streak in UI | component + schema grep + RLS | `pnpm --filter @fish/web test -- --run apps/web/components/tracker/milestone-progress.test.tsx`; schema gate: `rg -n "streak\|adherence\|grade\|score\|percent.*complet" supabase/migrations/0009_tracker.sql` must find nothing | ❌ W0 | ⬜ pending |
| TRAK-06 | Coach reviews entries read-only, RLS-scoped, no scoring UI; unassigned/cross-client denied | RLS + page test | `pnpm verify:rls` (`checkTrackerAssignedCoachReadsEntries`, `checkTrackerUnassignedCoachDenied`, `checkTrackerCrossClientDenied`) + `apps/web/app/(authenticated)/coach/clients/[id]/page.test.tsx` extension | needs extension | ⬜ pending |
| XC-01 | RLS assertions for every new tracker table; `pnpm build` green | integration | `pnpm verify:rls` full run + `pnpm build` | ❌ W0 | ⬜ pending |
| XC-02 | zod + `pg_jsonschema` reject malformed tracker config | unit + integration | `pnpm --filter @fish/web test -- --run apps/web/lib/validation/tracker.test.ts` + `pnpm verify:rls` (`checkTrackerMalformedConfigRejected`) | ❌ W0 | ⬜ pending |
| XC-03 | Design line — one primary action, 56px, no lost draft, calm copy, monochrome | component + grep | Retarget the Phase 5 judgement-copy / raw-hex grep gates at `apps/web/components/tracker/` | ❌ W0 | ⬜ pending |

---

## Nyquist-Style Validation Dimensions

| Dimension | Evidence Needed |
|-----------|-----------------|
| **Data correctness** | Seed creates one active tracker config version (cadence + fields); entries pin `version_id` + field snapshot; malformed config rejected by zod AND the DB CHECK. |
| **Authorization** | Real anon-key sign-ins prove: client self-read/self-write of own entries only; assigned coach reads entries/assignment; unassigned coach denied (zero rows, no error); cross-client denied; a client's direct INSERT into `tracker_assignments` (bypassing the Edge Function) is rejected by RLS (no authenticated INSERT policy) — the "self-assign-rejected" assertion. |
| **Assignment invariant** | A second `assign-tracker` call (or a second direct service-role insert) for a client with an active assignment is rejected by the partial unique index — "exactly one active tracker" holds under race/retry, not just app intent. |
| **Schema invariant (no streak)** — *phase-novel* | Static grep / schema introspection confirms no `streak*` / `adherence*` / `completion_rate*` column exists on any tracker table. This is the one assertion category genuinely new versus the Phase 5 template. |
| **State recovery** | Save an entry, simulate a failed subsequent save (stub the Server Action to reject), confirm the draft value remains in the UI rather than being cleared. |
| **UI contract** | One primary action per view; 56px controls (inherited from the reused `FieldRenderer`); milestone-journey visual only — no percentage/grade/score/streak copy anywhere in tracker components (grep gate). |
| **Reuse contract** | Grep proving zero new files were added under `apps/web/components/fields/` and `packages/core/src/fields.ts` is imported (not extended) — the tracker UI consumes the Phase 5 renderer, it does not fork it. |
| **Build/release** | `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm verify:rls` all green before closeout, matching the Phase 4/5 gate. |

---

## Wave 0 Requirements

- [ ] `supabase/migrations/0009_tracker.sql` — tracker config/assignment/entries tables, RLS policies + grants, command functions (`save_tracker_entry`, `get_tracker_progress`), `pg_jsonschema` config CHECK, freeze/immutability triggers, and the `tracker_one_active_assignment_per_client` partial unique index.
- [ ] `supabase/functions/assign-tracker/index.ts` — net-new Edge Function (`verify_jwt=true`; `getUser()` identity; **caller-scoped** membership re-check per Research Pitfall 1; admin-client write) with no existing test scaffold.
- [ ] `apps/web/lib/validation/tracker.test.ts` — zod config/answer/entry validation tests (reusing the onboarding discriminated-union pattern).
- [ ] `apps/web/components/tracker/*.test.tsx` — entry flow (draft preservation), milestone progress (no-streak assertion), coach review.
- [ ] `scripts/verify-rls.ts` — six+ new `checkTracker*` assertions mirroring `checkOnboarding*`.
- [ ] `scripts/seed.ts` — `seedTrackerConfig()` + an `assign-tracker` invocation for local dev bootstrap / RLS fixtures.
- [ ] `packages/supabase/src/database.types.ts` — regenerated after the migration.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `assign-tracker` live invocation proof | TRAK-02 | RLS alone cannot fully exercise a service-role write path; the authorization re-check lives inside the function | With the local stack + `supabase functions serve`, invoke `assign-tracker` as (a) an assigned coach → succeeds and creates exactly one active assignment; (b) a client for themselves → 403; (c) a coach for an unassigned client → 403; (d) a repeat call for an already-assigned client → rejected by the unique index. |
| Draft-survives-reload proof | TRAK-03 | Automated tests cover in-memory state; a browser smoke confirms user-visible resilience | As a seeded client with an assigned tracker, type an entry, force a failed save (or navigate away and back), confirm the typed value is still present with calm non-scolding notice copy — no layout shift. |
| Milestone-not-scoreboard calm scan | TRAK-05, XC-03 | Whole-screen focus calm can't be fully asserted in markup tests | Inspect desktop + mobile screenshots: one primary action, 56px controls, milestone path only — no fraction, percent, score, rank, grade, or streak anywhere; verify the "returning after a gap" path never renders as worse-than-before. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies (finalized once planner assigns task IDs)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15m
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner / `gsd-validate-phase` after per-task map is complete)

**Approval:** draft — pending plan task-ID mapping
