# Phase 6: Tracker Engine - Research

**Researched:** 2026-07-05
**Domain:** Supabase/Postgres versioned config + RLS (reused from Phase 5); Supabase Edge Function command authoring (JWT verify + membership re-check + server-derived fields); config-driven React field rendering (reused from Phase 5); milestone-journey progress modeling without streak/adherence state.
**Confidence:** HIGH for codebase fit, schema/RLS patterns, and renderer reuse (all directly verified against Phase 4/5 code). MEDIUM for the exact `assign-tracker` Edge Function request/response shape (no existing Edge Function in this repo does membership re-check + derives fields server-side yet — `send-message` is validation-only). LOW/ASSUMED only for a small number of naming/topology choices explicitly marked.

<user_constraints>
## User Constraints (from CONTEXT.md)

No `06-CONTEXT.md` exists yet for this phase (checked: `.planning/phases/06-tracker-engine/` contains no `*-CONTEXT.md` file). The constraints below are therefore drawn from the **locked, already-authoritative sources** that stand in for CONTEXT.md at this stage: `.planning/ROADMAP.md` Phase 6 section, `.planning/REQUIREMENTS.md` (TRAK-01..06, XC-01..03), and `.planning/STATE.md` v1.1 roadmap decisions. If `/gsd:discuss-phase` runs before planning, treat any resulting `06-CONTEXT.md` as taking precedence over this section.

### Locked Decisions (from ROADMAP.md + REQUIREMENTS.md + STATE.md)

- **Reuse, don't reinvent:** Phase 6 depends on Phase 5's shared config-driven renderer/validator and versioning discipline. Any duplicate six-type field renderer, duplicate zod discriminated-union pattern, or duplicate freeze-trigger shape is a planning defect. `[VERIFIED: ROADMAP.md, STATE.md]`
- **Assignment is seed/Edge-Function only, no assignment UI.** `assign-tracker` is the seed-invocable Edge Function; STATE.md explicitly flags its signature as "design during Phase 6 planning" — this research resolves that flag. `[VERIFIED: STATE.md]`
- **Coach/version are server-derived, never client input.** The command sets `coach_id`/config version from the active config server-side; client input must never be trusted for these fields (mirrors the `client_id`-never-in-payload discipline from Phase 5's `save_onboarding_answer`). `[VERIFIED: ROADMAP.md Phase 6 Success Criterion #2]`
- **Entry draft is preserved on failure or navigation** (TRAK-03) — mirrors the Phase 5 autosave/draft pattern; not a new autosave mechanism. `[VERIFIED: ROADMAP.md]`
- **Each saved entry pins to the assigned config version** (TRAK-03/TRAK-04) — mirrors the `assessment_version_id` + question-snapshot pattern from `onboarding_answers`. `[VERIFIED: ROADMAP.md, 0008_onboarding.sql]`
- **Progress is a milestone journey — schema stores entries, not a streak integer** (TRAK-05). This is a hard schema-level constraint, not just a UI constraint: the requirement text explicitly says "the schema stores entries, not a streak integer." `[VERIFIED: REQUIREMENTS.md TRAK-05]`
- **Coach review is read-only, RLS-scoped, no scoring UI** (TRAK-06) — mirrors the Phase 5 `CoachOnboardingReview` inline-on-`/coach/clients/[id]` pattern. `[VERIFIED: ROADMAP.md]`
- **`pnpm verify:rls` must pass with:** entry self-ownership / active-assignment gate / assigned-coach-read / unassigned-denial / cross-client-denial / self-assign-rejected assertions. `[VERIFIED: ROADMAP.md Phase 6 Success Criterion #5]`
- **Tracker config is zod + `pg_jsonschema` validated** so malformed config cannot persist (XC-02). `[VERIFIED: REQUIREMENTS.md XC-01/XC-02]`
- **zod stays in `apps/web` + the Edge Function, never in `packages/core`** (XC-02, and the Phase 5 precedent literally enforces this with a grep-based release gate). `[VERIFIED: REQUIREMENTS.md, 05-02-SUMMARY.md]`
- **`sketch-findings-fish` skill loaded before building client UI** (XC-03) — already loaded per this session's `CLAUDE.md`/`AGENTS.md` instructions; `profile-and-progress.md` reference is the binding progress-model source. `[VERIFIED: CLAUDE.md, .claude/skills/sketch-findings-fish/references/profile-and-progress.md]`
- **No Express/Node API; Supabase only.** Command-style writes and sensitive logic (assignment) go through an Edge Function, not a new API route. `[VERIFIED: AGENTS.md]`
- **Migrations live in `supabase/migrations/*.sql`** with a `[BLOCKING]` local-apply task after schema changes (`pnpm db:reset && pnpm seed && pnpm verify:rls`) — identical to the 04-01/05-01 Task-4/Task-3 gate pattern. `[VERIFIED: 04-01-SUMMARY.md, 05-01-SUMMARY.md]`

### Claude's Discretion (not locked; planner should decide during task breakdown, informed by this research)

- Exact table names for tracker config/entries (this research proposes `tracker_configs`, `tracker_config_versions`, `tracker_fields`, `tracker_assignments`, `tracker_entries` — analogous to the onboarding five-table shape, but final naming is planner discretion).
- Exact `assign-tracker` Edge Function URL path, and whether it is invoked by `service_role` key directly from `scripts/seed.ts` (matching the `send-message` deploy shape) or wrapped in a thin coach-invocable Server Action later. Per ROADMAP: "no assignment UI" — for v1.1 the only caller is seed. A coach-invoked call site is explicitly out of scope (`ASGN-01` in REQUIREMENTS.md v2/Future).
- Whether cadence (`daily`/`weekly`) is a column on the tracker version, a property on each field, or both — this research recommends version-level cadence with optional per-field override, but the planner may simplify to version-level-only if the coach validation for the tracker technique hasn't happened yet (product still coach-first).
- Exact milestone-derivation formula (e.g., "milestone N unlocks after M entries" vs. "after M calendar days with an entry") — this research documents the schema invariant (no streak column) but the specific milestone math is a product/UX decision, likely `Claude's Discretion` bounded by "must be monotonic and non-decrementing."
- Whether `tracker_entries` stores one row per cadence period or allows multiple entries per day — recommend one-row-per-period via a partial/composite unique constraint, but exact grain (day vs. ISO week) is planner discretion informed by the seeded cadence.

### Deferred Ideas (OUT OF SCOPE — do not plan these into Phase 6)

- **`TRAK-R01` Reward-only progress / return rewards** — deferred to v2, trigger: coach validates the tracking + reward technique manually. Do not build streak-adjacent reward UI this phase, even a "non-decrementing" one — that is explicitly a *future* trigger-gated feature, not Phase 6 scope.
- **`ASGN-01` Coach/admin assignment + reassignment UI** — deferred to v2, trigger: volume outgrows seed-only. Phase 6 ships `assign-tracker` as an Edge Function with **no UI entry point**.
- **Tracker template galleries / multiple tracker types per client** — "exactly one tracker" per ROADMAP; no picker, no gallery, ever (permanent design rule, not just deferred).
- **Validated learning content / tracker templates** — REQUIREMENTS.md "Out of Scope" table: specific tracker templates await coach validation; Phase 6 builds the *engine* with minimal seed config only, same posture as Phase 5's neutral onboarding seed.
- **Branching/skip-logic in tracker config** — no such concept was ever introduced for onboarding (`ONBD-B01` deferred) and none is introduced for tracker; cadence is linear/config-driven only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAK-01 | Tracker rendered from a versioned config (fields + daily/weekly cadence), not a hard-coded template | Reuse `packages/core/src/fields.ts` `FieldConfig`/`FieldAnswer` + `FieldRenderer` verbatim; add `cadence` to the tracker version row; new `tracker-conversation` or `tracker-entry-form` component composes `FieldRenderer` per field. `[VERIFIED: packages/core/src/fields.ts, apps/web/components/fields/field-renderer.tsx]` |
| TRAK-02 | Coach or seed assigns exactly one tracker via an authorized command (Edge Function, seed-invocable, no UI); coach/version set server-side | New `supabase/functions/assign-tracker/index.ts` mirroring `send-message`'s Deno.serve shape + JWT verify + `is_coach_of` re-check + service-role insert with `coach_id`/`version_id` derived server-side, never from body. `[VERIFIED: supabase/functions/send-message/index.ts, supabase/config.toml verify_jwt=true]` |
| TRAK-03 | Client saves an entry; draft preserved on failure/navigation; each entry pins to assigned config version | Reuse Phase 5's Server Action + DB command-function shape (`save_onboarding_answer` -> `save_tracker_entry`); reuse local-draft-until-persisted-status pattern from `OnboardingClientFlow`. `[VERIFIED: apps/web/app/(authenticated)/onboarding/onboarding-client-flow.tsx, supabase/migrations/0008_onboarding.sql]` |
| TRAK-04 | Tracker config validated (zod + pg_jsonschema) and versioned; each entry pins version | Reuse `pg_jsonschema` `jsonb_matches_schema` CHECK pattern verbatim from `onboarding_questions`; reuse the "used version immutable via trigger" pattern from `reject_used_onboarding_version_mutation`. `[VERIFIED: supabase/migrations/0008_onboarding.sql]` |
| TRAK-05 | Visual milestone-journey progress, never grade/adherence%/streak; schema stores entries not a streak integer | `tracker_entries` table has no `streak_count`/`adherence_pct` column anywhere; progress is derived at read time from `count(tracker_entries)` / `max(entry_date)`, never persisted as a resettable counter. Client renders via existing `Progress` component + milestone-path pattern from `sketch-findings-fish` `profile-and-progress.md`. `[VERIFIED: apps/web/components/ui/progress/progress.tsx, .claude/skills/sketch-findings-fish/references/profile-and-progress.md]` |
| TRAK-06 | Coach reviews assigned client's entries read-only timeline, RLS-scoped, no scoring UI | Reuse `CoachOnboardingReview` inline-review pattern integrated into `/coach/clients/[id]/page.tsx`; reuse `private.is_coach_of` RLS policy verbatim. `[VERIFIED: apps/web/app/(authenticated)/coach/clients/[id]/page.tsx, apps/web/components/onboarding/coach-onboarding-review.tsx]` |
| XC-01 | RLS on every new table; `verify:rls` extended; `pnpm build` green | Six new assertion functions in `scripts/verify-rls.ts` following the exact naming/shape of `checkOnboarding*` functions; `resetOnboardingVerificationState`-style setup helper for tracker fixtures. `[VERIFIED: scripts/verify-rls.ts]` |
| XC-02 | zod v4 (apps/web + Edge Function only) + `pg_jsonschema` CHECK backstop | Reuse `apps/web/lib/validation/onboarding.ts` discriminated-union pattern for `apps/web/lib/validation/tracker.ts`; Edge Function needs its own minimal zod import (Deno-compatible) for the assign-tracker request body. `[VERIFIED: apps/web/lib/validation/onboarding.ts; CITED: https://zod.dev/api]` |
| XC-03 | Design line — one action, 56px targets, monochrome, calm copy, no lost draft, `sketch-findings-fish` loaded | Reuse `FieldRenderer`/`AnswerChip`/`TextAreaField` (already 56px-token-compliant); reuse `AutosaveStatus`-style stable status row; `Progress` component already visual-only. `[VERIFIED: apps/web/components/fields/*, apps/web/components/onboarding/autosave-status.tsx]` |
</phase_requirements>

## Summary

Phase 6 is structurally a **near-exact repeat of Phase 5's shape**, with three genuinely new problems: (1) an authorization-command Edge Function that must re-verify JWT + coach-client membership + derive fields server-side (nothing in this repo does that yet — `send-message` only validates shape, it does not touch the database or verify JWT-derived identity against a relationship), (2) a "one active tracker per client" invariant enforced at the database (not just app code), and (3) a progress model that must be schema-provably free of any streak/adherence integer. Everything else — versioned config tables, `pg_jsonschema` CHECK backstop, freeze-on-use triggers, RLS via `private.is_coach_of`, the six-type field renderer, the Server-Action-calls-DB-command-function write path, and the inline coach read-only review pattern — should be copied verbatim from Phase 4/5, not redesigned. `[VERIFIED: codebase]`

The tracker config model should mirror onboarding's five-table shape: a stable identity table, immutable published versions (this time carrying `cadence: 'daily' | 'weekly'`), ordered field configs (reusing `packages/core/src/fields.ts` `FieldConfig` as the `config` JSON payload — the exact same `pg_jsonschema` schema string from `0008_onboarding.sql` applies unchanged, since tracker fields are drawn from the identical six-type union), a `tracker_assignments` table (the "exactly one active tracker" record, written only by `assign-tracker`), and `tracker_entries` (one row per saved entry, pinning `version_id` + snapshotting field metadata, exactly like `onboarding_answers`). `[VERIFIED: supabase/migrations/0008_onboarding.sql]`

The `assign-tracker` Edge Function is the one component with no exact precedent in this codebase. It must: verify the caller's JWT (`verify_jwt = true` in `config.toml`, matching `send-message`'s entry), resolve the caller's identity via `supabase.auth.getUser()` from the incoming Authorization header, confirm the caller is either `service_role` (seed) or a coach who is genuinely assigned to the target client (re-querying `coach_clients`/`is_coach_of`, never trusting a `coach_id` in the request body), look up the currently-active published tracker config version server-side, and perform the assignment insert using the service-role client (bypassing RLS deliberately, the same way seed scripts already do) while enforcing "at most one active assignment per client" via a partial unique index — not just application logic — so a duplicate/racing call cannot create two active trackers. `[ASSUMED — no direct precedent in codebase; pattern inferred from Supabase Edge Function JWT-verification docs and the existing coach_clients/is_coach_of RLS helper]`

**Primary recommendation:** Add `supabase/migrations/0009_tracker.sql` (schema, `pg_jsonschema` CHECK, RLS, `save_tracker_entry`/`get_tracker_progress` command functions, freeze triggers, partial-unique active-assignment index), `supabase/functions/assign-tracker/index.ts` (new Edge Function), extend `packages/supabase/src/database.types.ts` with tracker row aliases, extend `apps/web/lib/validation/tracker.ts` (zod, reusing the `fieldConfigSchema`/`fieldAnswerSchema` shapes from onboarding almost unchanged), extend `apps/web/lib/services/supabase/{types,core}.ts` with a `TrackerRepository`, add `apps/web/app/(authenticated)/tracker/{page.tsx,actions.ts,tracker-client-flow.tsx}`, extend `/coach/clients/[id]/page.tsx` with a `CoachTrackerReview` component, and extend `scripts/seed.ts` + `scripts/verify-rls.ts` with tracker fixtures and six new assertions. Gate on `pnpm build`, `pnpm verify:rls`, targeted Vitest, and a manual seed-invoked `assign-tracker` proof plus a local `[BLOCKING]` apply step. `[VERIFIED: codebase]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Versioned tracker config (fields + cadence) | Database / Storage | API / Backend | Immutability and malformed-config rejection must hold even if app code is bypassed — identical reasoning to onboarding config. `[VERIFIED: 05-RESEARCH.md Architectural Responsibility Map]` |
| Tracker assignment ("exactly one active tracker") | API / Backend (Edge Function) | Database / Storage | The Edge Function is the trusted boundary that derives `coach_id`/`version_id` server-side and re-checks membership; the DB partial-unique index is the un-bypassable backstop against races/duplicates. `[ASSUMED]` |
| Entry save + draft preservation | Browser / Client | API / Backend | Draft retention until persisted is a client-state concern (mirrors onboarding autosave); the server validates + pins version atomically via a DB command function. `[VERIFIED: apps/web/app/(authenticated)/onboarding/onboarding-client-flow.tsx]` |
| RLS authorization (entries, assignment, config) | Database / Storage | API / Backend | Existing convention: RLS is the read boundary; Edge Function/Server Actions improve UX but never replace policies. `[VERIFIED: supabase/migrations/0004_rls_helpers.sql]` |
| Shared field renderer (six types) | Browser / Client | — | Already built in Phase 5 as a domain-agnostic component; Phase 6 must NOT add tracker-specific branches to it. `[VERIFIED: apps/web/components/fields/field-renderer.tsx]` |
| Milestone-journey progress derivation | API / Backend | Database / Storage | Progress must be computed from stored entries at read time (count/max-date), never persisted as a mutable counter — computing in a DB function or the repository layer (not a column) is the correct tier to prevent an accidental streak-integer column from ever being added. `[VERIFIED: REQUIREMENTS.md TRAK-05]` |
| Coach read-only entry timeline | Database / Storage | Frontend Server (SSR) | `private.is_coach_of` scopes rows; Server Component renders calm not-found/partial states — identical to onboarding review. `[VERIFIED: apps/web/app/(authenticated)/coach/clients/[id]/page.tsx]` |

## Project Constraints (from AGENTS.md / CLAUDE.md)

| Directive | Planning Impact |
|-----------|-----------------|
| Use pnpm workspaces; no npm. `[VERIFIED: AGENTS.md]` | Any dependency command is `pnpm`; this phase adds **zero new npm packages** (zod already installed). |
| Supabase is the one backend; no Express API; Edge Functions for command-style writes/assignment. `[VERIFIED: AGENTS.md]` | `assign-tracker` MUST be a Supabase Edge Function, not a Next.js route handler acting as an API. |
| Coach-first, code-second; no unvalidated pedagogy/gamification. `[VERIFIED: AGENTS.md]` | Seed tracker config must be neutral (e.g., a simple daily practice-minutes/reflection tracker), not a specific validated technique; no reward UI. |
| One primary action per screen; assigned-never-chosen. `[VERIFIED: AGENTS.md]` | `/tracker` route shows the single assigned tracker only; no tracker list/picker ever, in this phase or later (permanent rule, not deferred). |
| Progress visual, never a grade; gamification reward-only, no resetting streaks. `[VERIFIED: AGENTS.md rules 4/5]` | `Progress` component + milestone path only; TRAK-05 requirement literally forbids a streak column in the schema, not just the UI. |
| Copy never scolds. `[VERIFIED: AGENTS.md rule 6]` | Missed-entry/empty states use the same reassuring tone as onboarding ("We saved your answers…" precedent); never "You missed a day." |
| Keep shared contracts in `packages/core`; Supabase contracts in `packages/supabase`; keep zod OUT of `packages/core`. `[VERIFIED: AGENTS.md, 05-02-SUMMARY.md]` | `packages/core/src/fields.ts` is REUSED as-is (no new tracker-specific field type needed — tracker fields are the same six types); zod schemas live in `apps/web/lib/validation/tracker.ts` and the Edge Function only. |
| `sketch-findings-fish` skill must be loaded before building/reviewing client-facing screens. `[VERIFIED: CLAUDE.md]` | Already loaded this session; `profile-and-progress.md` is the binding milestone-journey/no-streak reference for TRAK-05 UI. |
| `pnpm build` must pass before any commit. `[VERIFIED: AGENTS.md]` | Release gate identical to Phase 4/5: `pnpm build && pnpm verify:rls && pnpm lint && pnpm typecheck`. |

## Current Codebase Map

| Area | Existing Files | Phase 6 Changes |
|------|----------------|------------------|
| Supabase schema/RLS | `supabase/migrations/0004_rls_helpers.sql`, `0007_client_profiles.sql`, `0008_onboarding.sql` | Add `0009_tracker.sql`: `pg_jsonschema` CHECK (reuse onboarding's schema string), version tables, RLS, `save_tracker_entry` command function, freeze triggers, partial-unique active-assignment index. `[VERIFIED: codebase]` |
| RLS verification | `scripts/verify-rls.ts` (672 lines, `checkOnboarding*` functions as the direct template) | Add `checkTracker*` assertion functions (self-ownership, active-assignment gate, assigned-coach-read, unassigned-denial, cross-client-denial, self-assign-rejected) wired into `main()`. `[VERIFIED: codebase]` |
| Seed data | `scripts/seed.ts` (`seedOnboardingAssessment()` as the direct template) | Add `seedTrackerConfig()` (one published active version, neutral fields, cadence) + a real call to the new `assign-tracker` Edge Function (or an equivalent service-role insert for local dev bootstrap) to give client1 an active assignment for RLS testing. `[ASSUMED]` |
| Generated DB types | `packages/supabase/src/database.generated.ts`, `database.types.ts` | Regenerate after migration; add `TrackerConfigRow`, `TrackerConfigVersionRow`, `TrackerFieldRow`, `TrackerAssignmentRow`, `TrackerEntryRow` aliases (mirrors the `Onboarding*Row` list exactly). `[VERIFIED: packages/supabase/src/database.types.ts]` |
| Shared contracts | `packages/core/src/fields.ts`, `index.ts` | **No changes needed** — `FieldConfig`/`FieldAnswer` already domain-agnostic; only add tracker-specific DTOs (e.g., `TrackerEntry`, `TrackerProgress`) if a tracker-only shape is needed beyond field types. `[VERIFIED: packages/core/src/fields.ts]` |
| Runtime validation | `apps/web/lib/validation/onboarding.ts` (242 lines, direct template) | Add `apps/web/lib/validation/tracker.ts` reusing `fieldConfigSchema`/`fieldAnswerSchema` verbatim (import or duplicate the discriminated unions — planner decides whether to factor a shared `field-schemas.ts` module) plus a `saveTrackerEntrySchema` and an `assignTrackerRequestSchema` for the Edge Function. `[VERIFIED: apps/web/lib/validation/onboarding.ts]` |
| Supabase services | `apps/web/lib/services/supabase/{types,core}.ts` (961-line `core.ts`) | Add `TrackerRepository` interface + implementation mirroring `OnboardingRepository` exactly: `getActiveAssignmentForClient()`, `getEntryQuestionForValidation()`, `saveEntry()`, `getProgress()`, `getCoachReview(clientId)`. `[VERIFIED: apps/web/lib/services/supabase/types.ts]` |
| Server data access | `apps/web/lib/auth/server.ts` (407+ lines) | Add `getClientTrackerData()` and `getCoachClientTrackerReviewData(clientId)`, mirroring `getClientOnboardingData()`/`getCoachClientOnboardingReviewData()` wrong-door/null-means-denied style. `[VERIFIED: apps/web/lib/auth/server.ts]` |
| Client route | `apps/web/app/(authenticated)/onboarding/{page.tsx,actions.ts,onboarding-client-flow.tsx}` (direct template) | Add `apps/web/app/(authenticated)/tracker/{page.tsx,actions.ts,tracker-client-flow.tsx}` following the identical Server-Component-loads-then-Client-Component-flow shape. `[VERIFIED: codebase]` |
| Edge Function | `supabase/functions/send-message/index.ts` (validation-only stub) | Add `supabase/functions/assign-tracker/index.ts` — first Edge Function in this repo that verifies JWT identity + re-checks a relationship + writes to the database (send-message does none of this yet). `[VERIFIED: supabase/functions/send-message/index.ts]` |
| Coach review | `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx`, `apps/web/components/onboarding/coach-onboarding-review.tsx` | Add `apps/web/components/tracker/coach-tracker-review.tsx` and integrate it into the same page, below `CoachOnboardingReview`. `[VERIFIED: codebase]` |
| Progress UI | `apps/web/components/ui/progress/progress.tsx` | Reuse verbatim (0-100 visual bar); milestone-path list is a new small component composing `Progress` + a vertical step list per `sketch-findings-fish` `profile-and-progress.md`. `[VERIFIED: apps/web/components/ui/progress/progress.tsx]` |
| Tests | Vitest in `apps/web/vitest.config.ts` | Add unit/component tests for tracker validation, entry form, progress derivation (no-streak assertion), and Edge-Function-adjacent Server Action tests. `[VERIFIED: codebase]` |

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Next.js | installed `16.2.9` `[VERIFIED: package.json]` | App Router Server Components, Server Actions for entry save | Already project stack; identical Server-Action-calls-DB-command-function shape as Phase 5. `[VERIFIED: codebase]` |
| React | installed `19.2.7` `[VERIFIED: package.json]` | Client components for tracker entry form | Already project stack. `[VERIFIED: codebase]` |
| Supabase JS | `2.110.0` `[VERIFIED: package.json]` | Typed PostgREST/RPC client (web) and Edge Function admin client (Deno) | Existing service layer + existing `send-message` Deno import shape. `[VERIFIED: codebase]` |
| `@supabase/ssr` | installed, used by `createServerSupabaseServices()` `[VERIFIED: codebase]` | Cookie-aware server Supabase client for Server Actions | Existing pattern reused unchanged. `[VERIFIED: codebase]` |
| zod | installed `^4.4.3` in `apps/web` `[VERIFIED: apps/web/package.json]`; registry current `4.4.3` `[VERIFIED: npm registry, checked this session]` | App/runtime tracker config + entry answer validation, and Edge Function request-body validation | Locked milestone dependency (STATE.md: "one net-new runtime dep this milestone: zod v4"); already installed, zero new install needed for `apps/web`. `[VERIFIED: STATE.md, apps/web/package.json]` |
| `pg_jsonschema` | Supabase Postgres extension, already enabled by `0008_onboarding.sql` (`create extension if not exists pg_jsonschema with schema extensions;`) `[VERIFIED: supabase/migrations/0008_onboarding.sql]` | DB backstop for JSON field config | Already active in the local stack from Phase 5; Phase 6 reuses the exact same `jsonb_matches_schema` CHECK string since tracker fields are the same six-type union. `[VERIFIED: supabase/migrations/0008_onboarding.sql]` |

### Supporting
| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Vitest | installed, config at `apps/web/vitest.config.ts` `[VERIFIED: codebase]` | Unit/component tests | Reuse for tracker validation/renderer/progress-derivation tests. |
| Testing Library React | installed `[VERIFIED: codebase]` | Component interaction tests | Reuse for `TrackerClientFlow`/entry-form tests. |
| Supabase CLI | local `2.109.0` `[VERIFIED: command this session]` | Migration apply/status/type generation, **`supabase functions serve` for local Edge Function testing** | Required for `[BLOCKING]` local apply step and manually invoking `assign-tracker` before `verify:rls`. |
| Docker | local `29.6.1` `[VERIFIED: command this session]` | Local Supabase stack (Postgres + Auth + Edge Runtime) | Confirmed running this session (`REST API HTTP status: 200`). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Edge Function for `assign-tracker` | A Postgres `security definer` RPC function called by a service-role script (like onboarding's `save_onboarding_answer`, but service-role-invoked) | ROADMAP explicitly names "the `assign-tracker` Edge Function" — this is a locked decision, not open for reconsideration. Edge Functions are also the correct tier per AGENTS.md's "command-style writes and sensitive logic such as sending messages, assigning clients" boundary. `[VERIFIED: ROADMAP.md, AGENTS.md]` |
| Partial unique index for "exactly one active tracker" | App-only check-before-insert in the Edge Function | A check-then-insert has a race window (two concurrent seed calls, or a retry); a DB constraint is un-bypassable even if the Edge Function has a bug — same reasoning as onboarding's `onboarding_one_active_version` unique index. `[VERIFIED: supabase/migrations/0008_onboarding.sql pattern]` |
| Deriving progress at read time (count/max-date query or a DB function) | A materialized `progress_pct` or `streak_count` column, updated by trigger on entry insert | TRAK-05 explicitly forbids a streak integer in the schema; even a well-intentioned "days practiced" counter risks becoming a de facto streak once the UI surfaces it. Read-time derivation keeps the schema honest — there is no column to misuse later. `[VERIFIED: REQUIREMENTS.md TRAK-05]` |
| Shared onboarding-answer JSON shape reused unchanged for tracker entries | A tracker-specific answer envelope | The six `FieldAnswer` variants (`single_select`/`multi_select`/`scale`/`short_text`/`long_text`/`boolean`) already generalize cleanly; introducing a parallel shape would violate the explicit Phase 5 "renderer reuse" mandate. `[VERIFIED: packages/core/src/fields.ts]` |

**Installation:**
```bash
# No new npm packages required. zod ^4.4.3 is already installed in apps/web.
# pg_jsonschema extension is already enabled by migration 0008.
pnpm install
```

## Package Legitimacy Audit

No new external npm packages are recommended for Phase 6. The only packages this phase touches are already installed and were already audited in Phase 5's research; re-verified here for currency. `[VERIFIED: apps/web/package.json + npm registry, checked this session]`

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `zod` | npm | established (multi-year, v4 line active) | 200M+/wk (per Phase 5 research) | `github.com/colinhacks/zod` | Not re-run this session — see note below | Existing dependency; approved for reuse, no new install |
| `@supabase/supabase-js` | npm | established | 20M+/wk (per Phase 5 research) | `github.com/supabase/supabase-js` | Not re-run this session — see note below | Existing dependency; approved for reuse, no new install |
| `next` | npm | established | 38M+/wk (per Phase 5 research) | `github.com/vercel/next.js` | Not re-run this session — see note below | Existing dependency; approved for reuse, no new install |

**slopcheck availability:** Not attempted this session — Phase 6 introduces zero new npm packages, so the legitimacy gate's primary purpose (catching a hallucinated/typosquatted new dependency) does not apply. All three packages above are pre-existing, already-audited (Phase 5 research ran the full slopcheck+registry gate on them and found no `[SLOP]` verdicts), version-pinned dependencies with no version bump proposed in this phase. Per the package legitimacy protocol, this is a documented, justified skip — not a silent omission — because the gate's risk (a new supply-chain-attack package) is structurally absent when zero packages are added.

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages).
**Packages flagged as suspicious [SUS]:** none newly flagged this session; Phase 5's research already flagged `next`/`@supabase/supabase-js`/`@supabase/ssr`/`vitest` as `[SUS]` under a "too-new-to-score" recency heuristic (not a hallucination signal) and approved them for reuse — that disposition carries forward unchanged since none are being upgraded in this phase.

## Recommended Data Model

### Tables

| Table | Purpose | Key Columns / Constraints |
|-------|---------|---------------------------|
| `tracker_configs` | Stable identity for a tracker family (mirrors `onboarding_assessments`) | `id uuid pk`, `slug text unique`, `title text`, `created_at`, `updated_at`; service-role writes only. `[ASSUMED — naming, following onboarding's exact shape]` |
| `tracker_config_versions` | Immutable published versions; one active version at a time; carries cadence | `id uuid pk`, `tracker_config_id fk`, `version integer`, `status text check ('draft','published','retired')`, `is_active boolean`, `cadence text check ('daily','weekly')`, `published_at`, `created_at`, `updated_at`, unique `(tracker_config_id, version)`, partial unique active index `where is_active`. `[ASSUMED — direct analog to onboarding_assessment_versions + new cadence column per TRAK-01]` |
| `tracker_fields` | Ordered config-driven fields for a version (mirrors `onboarding_questions`) | `id uuid pk`, `version_id fk`, `field_key text`, `field_order integer check (> 0)`, `prompt text`, `answer_type text check (six-type union)`, `config jsonb`, unique `(version_id, field_key)`, unique `(version_id, field_order)`, `constraint tracker_field_config_type_matches check ((config ->> 'type') = answer_type)`, `constraint tracker_field_config_schema check (extensions.jsonb_matches_schema(<same schema string as onboarding_question_config_schema>, config))`. `[VERIFIED pattern source: supabase/migrations/0008_onboarding.sql onboarding_questions table; table/column names ASSUMED]` |
| `tracker_assignments` | The "exactly one active tracker" record for a client, written only by `assign-tracker` | `id uuid pk`, `client_id uuid references profiles on delete cascade`, `coach_id uuid references profiles`, `version_id uuid references tracker_config_versions on delete restrict`, `status text check ('active','ended') default 'active'`, `assigned_at timestamptz default now()`, `ended_at timestamptz`, partial unique index `(client_id) where status = 'active'` (enforces "exactly one active tracker per client" at the DB, not just app logic). `[ASSUMED — new table with no direct onboarding analog, since onboarding has no assignment step (the version is globally active); this is the TRAK-02-specific addition]` |
| `tracker_entries` | One persisted entry per client/period (mirrors `onboarding_answers`) | `id uuid pk`, `assignment_id uuid references tracker_assignments on delete cascade`, `field_id uuid references tracker_fields on delete restrict`, `version_id uuid references tracker_config_versions on delete restrict` (denormalized pin, mirrors `assessment_version_id`), `field_key text`, `field_order integer`, `field_prompt text`, `answer_type text`, `field_config jsonb`, `answer jsonb`, `entry_date date not null default current_date` (the cadence period key), `created_at`, `updated_at`, unique `(assignment_id, field_id, entry_date)` (one entry per field per period — prevents duplicate same-day saves from creating extra rows; the Server Action upserts). `[ASSUMED — direct analog to onboarding_answers, with entry_date added for cadence-period grain per TRAK-01's daily/weekly requirement]` |

### Version and Snapshot Rules

- `tracker_assignments.version_id` is the canonical "which config version was this client assigned?" pin — set once at assignment time by the Edge Function, never mutated by the client. `[VERIFIED pattern: onboarding_attempts.version_id, adapted]`
- `tracker_entries` denormalizes `version_id` plus field snapshot columns (`field_key`, `field_order`, `field_prompt`, `answer_type`, `field_config`) so coach review renders the exact prompt/options the client saw even if a future tracker version supersedes the current one — identical reasoning and shape to `onboarding_answers`. `[VERIFIED pattern: supabase/migrations/0008_onboarding.sql]`
- Add a freeze trigger rejecting update/delete on `tracker_config_versions` and `tracker_fields` once any `tracker_assignments` row references the version — directly reuse the `reject_used_onboarding_version_mutation` / `reject_used_onboarding_question_mutation` function bodies, renamed for tracker tables. `[VERIFIED: supabase/migrations/0008_onboarding.sql, functions reject_used_onboarding_version_mutation / reject_used_onboarding_question_mutation]`
- Draft/unpublished config versions remain editable by service role/seed before any assignment references them; no coach-authoring UI ships this phase (same posture as onboarding). `[VERIFIED: 05-CONTEXT.md pattern, applies unchanged]`

### Entry Answer Payload Shape

Reuse `FieldAnswer` from `packages/core/src/fields.ts` **unchanged** — no new tracker-specific answer type is needed:

```ts
// packages/core/src/fields.ts — already exists, reused verbatim
export type FieldAnswer =
  | { type: "single_select"; optionId: string }
  | { type: "multi_select"; optionIds: string[] }
  | { type: "scale"; value: string }
  | { type: "short_text"; value: string }
  | { type: "long_text"; value: string }
  | { type: "boolean"; value: boolean };
```

`[VERIFIED: packages/core/src/fields.ts, read in full this session]`

## RLS and Authorization Strategy

| Surface | Policy / Grant |
|---------|----------------|
| Tracker config reads (`tracker_configs`/`tracker_config_versions`/`tracker_fields`) | Authenticated clients may read the active published version/fields; clients/coaches may additionally read a pinned (possibly no-longer-active) version if referenced by their own/assigned `tracker_assignments` — same three-branch `using()` shape as `onboarding_assessment_versions`/`onboarding_questions`. `[VERIFIED pattern: supabase/migrations/0008_onboarding.sql]` |
| Tracker config writes | Service role only via migrations/seed; no authenticated insert/update/delete grant. `[VERIFIED pattern: 0008_onboarding.sql]` |
| `tracker_assignments` reads | Client reads own assignment (`client_id = auth.uid()`); assigned coach reads via `private.is_coach_of(client_id)`; default-deny returns zero rows for everyone else. `[VERIFIED pattern: supabase/migrations/0004_rls_helpers.sql, 0008_onboarding.sql]` |
| `tracker_assignments` writes | **No authenticated INSERT/UPDATE policy at all.** Only `service_role` (used by the `assign-tracker` Edge Function's admin client) may insert. This is the DB-level enforcement of "a client can never self-assign" (TRAK-02's "self-assign-rejected" `verify:rls` assertion) and "no assignment UI" — even if a UI existed, RLS would reject any authenticated insert attempt. `[ASSUMED — new pattern, but directly modeled on the "question bank writes: service role only" row from 05-RESEARCH.md]` |
| `tracker_entries` reads | Client reads own entries through assignment ownership (`exists (select 1 from tracker_assignments ta where ta.id = tracker_entries.assignment_id and ta.client_id = auth.uid())`); assigned coach reads through `private.is_coach_of(ta.client_id)` — same join-through-parent shape as `onboarding_answers`. `[VERIFIED pattern: supabase/migrations/0008_onboarding.sql]` |
| `tracker_entries` writes | Client can upsert own entry only through the `save_tracker_entry(...)` `security definer` command function, which re-derives `client_id` from `auth.uid()`, checks an active assignment exists, and rejects writes if the assignment has `status = 'ended'`. No direct table INSERT/UPDATE grant to `authenticated` — mirrors the RPC-only write pattern for `onboarding_answers`. `[VERIFIED pattern: supabase/migrations/0008_onboarding.sql save_onboarding_answer]` |
| Coach review | Read-only; no update/delete grant/policy for coach anywhere in the tracker schema. `[VERIFIED pattern: 0008_onboarding.sql]` |

Implementation note: exactly as Phase 5 documented, RPC functions need explicit `EXECUTE` grants and revocation from `public` (`revoke execute on function public.save_onboarding_answer(uuid, jsonb) from public; grant execute ... to authenticated;`) — replicate this exact two-line pattern for `save_tracker_entry`. `[VERIFIED: supabase/migrations/0008_onboarding.sql lines 340-343; CITED: https://supabase.com/docs/guides/api/securing-your-api]`

## Architecture Patterns

### System Architecture Diagram

```text
Seed script (service-role, local dev bootstrap)
  └─ scripts/seed.ts: seedTrackerConfig()
     ├─ Upserts tracker_configs + one published/active tracker_config_versions row (cadence set)
     ├─ Upserts tracker_fields (neutral seed fields, all six types available for coverage)
     └─ Invokes assign-tracker Edge Function (service-role JWT or direct admin insert for bootstrap)
        └─ assign-tracker validates request, derives coach_id from coach_clients, inserts tracker_assignments

assign-tracker Edge Function (supabase/functions/assign-tracker/index.ts)
  ├─ Deno.serve — POST only, mirrors send-message's method guard
  ├─ Extract Authorization header; supabase.auth.getUser(token) resolves caller identity
  ├─ IF caller is service_role key → treat as "seed/system" caller, trust body.clientId only
  ├─ ELSE (authenticated coach JWT) → re-query coach_clients / is_coach_of(clientId) —
  │    NEVER trust a coachId in the request body; if not assigned, 403
  ├─ Look up the currently active published tracker_config_version server-side
  │    (never accept a versionId from the caller)
  ├─ Service-role admin client inserts into tracker_assignments
  │    (partial unique index on client_id WHERE status='active' rejects a second active row)
  └─ Returns { assignmentId, clientId, versionId, assignedAt } — no tracker content, just the pin

Client /tracker
  └─ Server Component loads client profile + active tracker_assignment via RLS
     └─ If no active assignment: calm EmptyState ("Your coach will assign your tracker when it is ready.")
     └─ If active assignment: load version's ordered fields + this period's saved entries
        └─ Render TrackerClientFlow (client component)
           ├─ FieldRenderer(config, value, validation) — REUSED verbatim from Phase 5
           ├─ Selection fields save+advance; text fields keep one primary "Save entry"
           ├─ Local draft state persists across a failed save or accidental navigation
           │    until the Server Action confirms persisted (mirrors OnboardingClientFlow)
           └─ MilestoneProgress — vertical step list + Progress bar,
                derived from count(tracker_entries) / cadence, NEVER a streak column

Save entry Server Action (apps/web/app/(authenticated)/tracker/actions.ts)
  ├─ Re-check getUser()
  ├─ zod parses field config + answer payload (reuse fieldConfigSchema/fieldAnswerSchema shape)
  ├─ Calls DB command save_tracker_entry(field_id, answer, entry_date)
  │  ├─ Derives client_id from auth.uid(), joins to their ACTIVE tracker_assignments row
  │  ├─ Rejects if no active assignment or assignment status='ended'
  │  ├─ Upserts entry with field snapshot metadata, pinned version_id
  │  └─ Returns entry state + assignment status for the draft-cleared confirmation
  └─ Returns persisted entry state to the client for draft-clear + status update

Coach /coach/clients/[id]
  └─ Existing Server Component role/id guard (UNCHANGED)
     ├─ SELECT client profile via RLS (existing)
     ├─ SELECT assigned client's onboarding review (existing, UNCHANGED)
     ├─ SELECT assigned client's tracker_assignments + tracker_entries via RLS (NEW)
     └─ Render CoachTrackerReview: read-only ordered entry timeline, calm empty/partial states
```

### Recommended Project Structure

```text
supabase/migrations/
└── 0009_tracker.sql

supabase/functions/
└── assign-tracker/
    └── index.ts

packages/core/src/
└── fields.ts               # UNCHANGED — reused as-is

packages/supabase/src/
└── database.types.ts       # add Tracker*Row aliases

apps/web/lib/
├── validation/tracker.ts
├── services/supabase/types.ts   # add TrackerRepository
├── services/supabase/core.ts    # add TrackerRepository impl
└── auth/server.ts               # add getClientTrackerData / getCoachClientTrackerReviewData

apps/web/components/
├── fields/                      # UNCHANGED — reused as-is
└── tracker/
    ├── tracker-entry-flow.tsx        # analog of onboarding-conversation.tsx
    ├── milestone-progress.tsx        # NEW — vertical step list + Progress bar
    ├── coach-tracker-review.tsx      # analog of coach-onboarding-review.tsx
    └── *.test.tsx

apps/web/app/(authenticated)/
├── tracker/
│   ├── page.tsx
│   ├── actions.ts
│   └── tracker-client-flow.tsx
└── coach/clients/[id]/page.tsx   # extended, not replaced
```

### Pattern 1: Reuse the Immutable Versioned Config Pattern Verbatim

**What:** Separate identity/version/field tables; only published versions readable by clients; used versions/fields DB-frozen once assigned. Directly copy `0008_onboarding.sql`'s DDL shape, renaming `onboarding_*` to `tracker_*` and `question*` to `field*`. `[VERIFIED: supabase/migrations/0008_onboarding.sql]`

**When to use:** Any config whose saved responses must remain interpretable after future config changes — identical justification as onboarding.

```sql
-- Directly modeled on 0008_onboarding.sql's onboarding_assessment_versions
create table public.tracker_config_versions (
  id uuid primary key default gen_random_uuid(),
  tracker_config_id uuid not null references public.tracker_configs (id) on delete cascade,
  version integer not null,
  status text not null check (status in ('draft', 'published', 'retired')),
  is_active boolean not null default false,
  cadence text not null check (cadence in ('daily', 'weekly')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tracker_config_id, version),
  constraint tracker_active_version_is_published check (not is_active or status = 'published')
);

create unique index tracker_one_active_version
  on public.tracker_config_versions (tracker_config_id)
  where is_active;
```

### Pattern 2: The "Exactly One Active Tracker" Partial Unique Index

**What:** A single-column partial unique index on `tracker_assignments (client_id) where status = 'active'` — enforces TRAK-02's "exactly one tracker" at the database, independent of the Edge Function's own check. This is the direct structural analog of `onboarding_one_active_version` but scoped per-client instead of per-config. `[VERIFIED pattern: onboarding_one_active_version index shape, applied to a new use case]`

**When to use:** Any "at most one active X per Y" invariant that a race condition (concurrent seed re-runs, a retried Edge Function call) could otherwise violate.

```sql
create unique index tracker_one_active_assignment_per_client
  on public.tracker_assignments (client_id)
  where status = 'active';
```

If `assign-tracker` is called twice for the same client (e.g., a retried seed script), the second insert raises a unique-violation (`23505`) that the Edge Function should catch and translate into an idempotent "already assigned" response rather than a 500 — this doubles as the `TRAK-02` "self-assign-rejected"-adjacent idempotency guarantee.

### Pattern 3: `assign-tracker` Edge Function — JWT Verify + Membership Re-check + Server-Derived Fields

**What:** The Edge Function is the FIRST one in this codebase that must do real identity verification and a database membership check, not just payload-shape validation. `send-message` is the wrong template to copy verbatim (it does neither); this pattern must be assembled from Supabase's documented Edge Function JWT-verification approach plus this repo's existing `is_coach_of` helper. `[CITED: https://supabase.com/docs/guides/functions/auth]` `[VERIFIED: supabase/functions/send-message/index.ts as the negative example — it does not verify identity]`

**When to use:** Any Edge Function that performs a privileged write on behalf of an authenticated caller and must confirm that caller's relationship to the target resource.

```ts
// supabase/functions/assign-tracker/index.ts
// Source: Supabase Edge Function JWT verification docs (CITED) + this repo's
// is_coach_of helper (VERIFIED: supabase/migrations/0004_rls_helpers.sql), adapted.
import { createClient } from "jsr:@supabase/supabase-js@2";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Assign a tracker with a post request." },
      { status: 405, headers: jsonHeaders },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = request.headers.get("Authorization") ?? "";

  // Caller-scoped client: identical Authorization header the platform already
  // verified (config.toml verify_jwt = true rejects a missing/invalid JWT
  // before this code even runs) -- resolve identity server-side, never trust
  // a body field for "who is calling".
  const callerClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return Response.json({ error: "Sign in again to assign a tracker." }, { status: 401, headers: jsonHeaders });
  }

  const body = (await request.json()) as { clientId?: string };
  if (!body.clientId) {
    return Response.json({ error: "Choose a client before assigning a tracker." }, { status: 400, headers: jsonHeaders });
  }

  // Admin client for the privileged read/write below -- RLS-bypass is
  // deliberate and RE-GUARDED by the explicit is_coach_of RPC check that
  // follows, exactly as the phase requirement demands ("service-role bypass
  // of RLS is re-guarded").
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: isCoachOf, error: membershipError } = await admin.rpc("is_coach_of_uid", {
    caller_uid: userData.user.id,
    client_uuid: body.clientId,
  });
  if (membershipError || !isCoachOf) {
    return Response.json({ error: "This client is not assigned to you." }, { status: 403, headers: jsonHeaders });
  }

  const { data: activeVersion, error: versionError } = await admin
    .from("tracker_config_versions")
    .select("id")
    .eq("is_active", true)
    .single();
  if (versionError || !activeVersion) {
    return Response.json({ error: "No active tracker is configured yet." }, { status: 409, headers: jsonHeaders });
  }

  const { data: assignment, error: assignError } = await admin
    .from("tracker_assignments")
    .insert({ client_id: body.clientId, coach_id: userData.user.id, version_id: activeVersion.id })
    .select("id, assigned_at")
    .single();

  if (assignError?.code === "23505") {
    return Response.json({ error: "This client already has an active tracker." }, { status: 409, headers: jsonHeaders });
  }
  if (assignError || !assignment) {
    return Response.json({ error: "That did not save yet. Try again." }, { status: 500, headers: jsonHeaders });
  }

  return Response.json(
    { assignmentId: assignment.id, clientId: body.clientId, versionId: activeVersion.id, assignedAt: assignment.assigned_at },
    { headers: jsonHeaders },
  );
});
```

Notes on this example: `private.is_coach_of(client_uuid)` as defined in `0004_rls_helpers.sql` reads `auth.uid()` internally (it is designed for use inside an RLS `using()` clause under the caller's own session), so it **cannot be called directly from a service-role admin client** — a service-role connection has no `auth.uid()`. The Edge Function therefore needs either (a) a new `security definer` SQL function `is_coach_of_uid(caller_uid uuid, client_uuid uuid)` that accepts an explicit caller id (shown above, `[ASSUMED]` — a small new helper, not a redefinition of the existing one), or (b) the Edge Function makes the coach-membership check using a **caller-scoped** (not admin) Supabase client so `is_coach_of(client_uuid)`'s internal `auth.uid()` resolves correctly, then switches to the admin client only for the actual write. Option (b) is architecturally cleaner (zero new SQL) and is the **recommended** approach; option (a) is documented as a fallback if the planner finds the caller-scoped RPC call awkward from Deno. `[ASSUMED — this is a genuine open design choice noted in Open Questions below]`

For the seed-invocation path (TRAK-02 "seed-invocable"), the seed script must call this same Edge Function over HTTP (`fetch` to `FUNCTIONS_URL` from `supabase status`) using either a real coach's session JWT (obtained via `signInWithPassword`, matching `verify-rls.ts`'s `signInAs()` helper) or — if the function is designed to also accept a service-role-authenticated request as a trusted "system" caller — the service-role key directly in the Authorization header, in which case the function must detect `userData.user` being absent-but-caller-being-service-role and skip the membership check for that one trusted path. **Recommendation: require seed to sign in as the real coach fixture and call the function exactly like a production coach would** — this is more test-realistic and avoids adding a "service-role special case" branch to the function. `[ASSUMED]`

### Pattern 4: Milestone-Journey Progress Derivation (No Streak Column)

**What:** Progress is computed by querying `tracker_entries`, never stored as a mutable integer. A simple, safe derivation: `entries_count = count(*)`, `milestones_reached = floor(entries_count / entries_per_milestone)`, where `entries_per_milestone` is a small config constant (e.g., 5), and the "current" milestone bar fill is `(entries_count % entries_per_milestone) / entries_per_milestone`. This can be computed either in the repository layer (a plain SQL count query, simplest) or in a `get_tracker_progress()` SQL function (more consistent with the command-function pattern already used for saves). `[ASSUMED — the exact milestone-count threshold is a product/UX decision per Claude's Discretion above; the "derive from count, never store as a mutable counter" principle is the load-bearing, non-negotiable part]`

**When to use:** Any place TRAK-05's progress bar or milestone list needs a number. Never introduce a `tracker_assignments.entries_logged` or similar denormalized counter column — even a monotonic one invites an accidental decrement later (e.g., an "undo entry" feature). Compute from `tracker_entries` every time.

```sql
-- Illustrative; exact milestone math is planner/product discretion.
-- The load-bearing property: SELECT-only, no write, no counter column.
create or replace function public.get_tracker_progress()
returns table (entries_count bigint, milestones_reached integer)
language sql
security definer
stable
set search_path = ''
as $$
  select
    count(*)::bigint as entries_count,
    (count(*) / 5)::integer as milestones_reached
  from public.tracker_entries te
  join public.tracker_assignments ta on ta.id = te.assignment_id
  where ta.client_id = (select auth.uid())
    and ta.status = 'active';
$$;
```

### Anti-Patterns to Avoid

- **Any column named `streak`, `streak_count`, `adherence_pct`, `completion_rate`, or similar anywhere in `tracker_assignments`/`tracker_entries`:** directly violates TRAK-05's explicit schema-level requirement. `[VERIFIED: REQUIREMENTS.md TRAK-05]`
- **Client-visible tracker picker/gallery:** violates assigned-never-chosen; there must be exactly one route (`/tracker`) with no list view. `[VERIFIED: AGENTS.md]`
- **`assign-tracker` trusting a `coachId`/`versionId` field from the request body:** must always be re-derived server-side (from the caller's verified JWT identity and the currently-active config), never accepted as input — this is the single most important security property of the whole phase. `[VERIFIED: ROADMAP.md Phase 6 Success Criterion #2]`
- **Reusing the `send-message` Edge Function as the literal template for `assign-tracker`:** `send-message` does not verify JWT-derived identity against any relationship and does not touch the database — copying it verbatim would silently drop the membership re-check. Use it only for the `Deno.serve`/method-guard/JSON-response shape, not the authorization logic. `[VERIFIED: supabase/functions/send-message/index.ts]`
- **Tracker-specific branches inside `FieldRenderer`/`AnswerChip`/`TextAreaField`:** these components must stay switch-on-`config.type`-only; any `if (trackerFieldKey === ...)` branch breaks the Phase 5 reuse contract. `[VERIFIED: 05-RESEARCH.md Pitfall 5, applies unchanged]`
- **A materialized progress counter updated by an `AFTER INSERT ON tracker_entries` trigger:** even framed as "cumulative only," a trigger-maintained counter is one bad migration away from becoming decrementable; keep progress as a read-time derivation with no persisted counter to corrupt. `[ASSUMED — reasoning extension of TRAK-05]`

## Config-Driven Renderer / Validator Strategy (Reused Unchanged from Phase 5)

| Type | Renderer | Validation | Tracker-Specific Note |
|------|----------|------------|------------------------|
| `single_select` | `AnswerChip` group (existing) | `optionId` must exist in config options | E.g., a mood/context check-in field. `[VERIFIED: apps/web/components/fields/answer-chip.tsx]` |
| `multi_select` | Toggle chips + one `Save entry` primary (existing) | selected ids subset of config; min/max if present | E.g., "what did you practice today" checklist. `[VERIFIED: apps/web/components/fields/field-renderer.tsx]` |
| `scale` | Bounded segmented/chip steps (existing) | selected value matches configured step id | Reuse onboarding's "no numeric scoring labels" discipline — e.g., "effort felt" not "rate 1-5". `[VERIFIED: 05-UI-SPEC.md pattern, applies unchanged]` |
| `short_text` | Base `Input` (existing) | trim, min if required, max length | E.g., "practice minutes today" as free text, or a short note. |
| `long_text` | `TextAreaField` (existing) | trim, max length, preserved draft | E.g., a reflection note field. |
| `boolean` | Two large binary chips (existing) | boolean payload only | E.g., "did you practice today?" yes/no. |

**Zero new renderer code is required.** The entire `apps/web/components/fields/` directory (`field-renderer.tsx`, `answer-chip.tsx`, `text-area-field.tsx`, `index.ts`) is imported and used exactly as onboarding uses it. This is the single highest-leverage reuse in the phase and should be the first thing the planner confirms in a task acceptance criterion (e.g., a grep-based test proving no new files were added under `apps/web/components/fields/`). `[VERIFIED: apps/web/components/fields/*, read in full this session]`

## Draft Preservation Strategy (TRAK-03) — Reuse Onboarding's Pattern

- Local component state (`OnboardingClientFlow`'s `savedAnswers`/`currentQuestionId`/`autosaveStatus` state shape) is the direct template for a `TrackerClientFlow` component: `savedEntries`, `autosaveStatus` (`idle`/`saving`/`saved`/`error`/`resume`), and the in-flight draft value for the currently-open field. `[VERIFIED: apps/web/app/(authenticated)/onboarding/onboarding-client-flow.tsx, read in full this session]`
- On save failure (`result.status !== "saved"`), the existing pattern sets `autosaveStatus("error")` and **does not clear the local draft** — the same must-not-clear behavior applies to tracker entry save failures, satisfying "the entry draft is preserved on failure." `[VERIFIED: onboarding-client-flow.tsx handleSaveAnswer]`
- On navigation away before save, the draft is NOT currently backed by anything beyond in-memory React state in the onboarding implementation (no `beforeunload` handler, no `sessionStorage` mirror was found in `onboarding-client-flow.tsx`). If TRAK-03's "preserved on... navigation" is interpreted strictly (surviving a full page reload, not just an SPA route change), the planner should add a lightweight `sessionStorage` draft mirror keyed by `assignmentId + fieldId` for the tracker entry form — this is a **new** pattern beyond what Phase 5 shipped, not a pure reuse. Flagged in Open Questions below. `[VERIFIED gap: no sessionStorage/beforeunload code found in onboarding-client-flow.tsx or its test file this session]`
- Selection-type fields (single_select/scale/boolean) can still save-and-advance immediately (no separate "Save entry" button needed) per the same one-primary-action reasoning as onboarding; text/multi-select fields keep one explicit `Save entry` primary. `[VERIFIED pattern: 05-CONTEXT.md D-10, applies unchanged]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Six-type field rendering | A tracker-specific field renderer | `apps/web/components/fields/*` imported unchanged | Direct violation of the Phase 5 reuse mandate if duplicated; also doubles the a11y/token-compliance surface to maintain. `[VERIFIED: ROADMAP.md, 05-02-SUMMARY.md]` |
| Config validation | Ad hoc `if (type === ...)` checks | zod discriminated union (near-identical to `apps/web/lib/validation/onboarding.ts`) + DB `jsonb_matches_schema` CHECK (same schema string) | The exact six-type union and JSON Schema string from onboarding apply unchanged to tracker fields — copy, don't reinvent. `[VERIFIED: supabase/migrations/0008_onboarding.sql]` |
| Authorization for assignment | App-only `if coach_id === ...` filters in a Server Action | RLS (`private.is_coach_of`) for reads + a dedicated `security definer` membership check inside the Edge Function for the write | Direct Supabase/API calls or a compromised Server Action would bypass app-only filters; the DB-level check and Edge Function membership re-check are the only un-bypassable boundaries. `[CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]` |
| "Exactly one active tracker" enforcement | A `SELECT ... WHERE status='active'` check followed by a conditional `INSERT` in the Edge Function only | A partial unique index (`tracker_one_active_assignment_per_client`) as the DB-level backstop | Check-then-insert has a race window under concurrent calls (retried seed invocation, network retry); the constraint is race-proof. `[VERIFIED pattern: onboarding_one_active_version index]` |
| Progress/streak math | A trigger-maintained counter column | Read-time derivation (SQL function or repository query) from `tracker_entries` | Any persisted counter is a latent streak; TRAK-05 requires the schema itself to make a streak impossible to express, not just discourage it in the UI. `[VERIFIED: REQUIREMENTS.md TRAK-05]` |
| Draft persistence UI | A bespoke autosave debounce/queue library | Reuse the onboarding `AutosaveStatus` component + local React state pattern (extended with `sessionStorage` only if strict-navigation-survival is required — see Open Questions) | Same reasoning as Phase 5's Don't-Hand-Roll table: the hard part is the RLS-scoped version-pinned persistence, not a generic autosave library. `[VERIFIED: 05-RESEARCH.md Don't Hand-Roll table, applies unchanged]` |

**Key insight:** Phase 6's actual net-new engineering surface is small — one Edge Function's authorization logic and one partial-unique-index invariant. Everything else (config versioning, RLS shape, field rendering, validation, draft UX, coach review) is direct, verbatim reuse of Phase 4/5 patterns already proven in this codebase. Treat any plan that reintroduces a parallel renderer, a parallel zod-schema-authoring style, or a parallel RLS-helper-naming convention as a planning defect, not a stylistic choice. `[VERIFIED: codebase-wide pattern analysis this session]`

## Common Pitfalls

### Pitfall 1: `is_coach_of` Cannot Be Called from a Service-Role/Admin Connection
**What goes wrong:** The Edge Function calls `admin.rpc("is_coach_of", { client_uuid })` expecting it to check "is the calling coach assigned to this client," but `private.is_coach_of` internally reads `auth.uid()` — which is `NULL` on a service-role connection — so the check silently always returns `false` (or worse, if written carelessly, always `true`).
**Why it happens:** The existing helper was designed exclusively for use inside an RLS `using()` clause under the caller's own authenticated session, not for cross-context reuse from an admin client.
**How to avoid:** Either (a) perform the membership check using a caller-scoped Supabase client (with the incoming `Authorization` header forwarded) so `auth.uid()` resolves to the real coach, and only switch to the admin client for the write step, or (b) add a small new `security definer` function that takes an explicit `caller_uid` parameter instead of relying on `auth.uid()`. See Pattern 3 above for both options.
**Warning signs:** A `verify:rls` "self-assign-rejected" or "unassigned coach denied" assertion that passes even when it shouldn't, or a membership check that always returns the same boolean regardless of input. `[VERIFIED: supabase/migrations/0004_rls_helpers.sql function body, read in full this session]`

### Pitfall 2: Treating `verify_jwt = true` as Sufficient Authorization
**What goes wrong:** The planner assumes `config.toml`'s `verify_jwt = true` (already set for `send-message`, and needed for `assign-tracker`) means "only valid users can call this," and skips the explicit membership re-check, reasoning "the JWT is already verified."
**Why it happens:** `verify_jwt` proves the caller IS a genuine authenticated user (or holds the service-role key) — it says nothing about whether THIS user is authorized to assign a tracker to THIS specific client. Any authenticated user (including any client) could otherwise call the function for an arbitrary `clientId`.
**How to avoid:** The explicit `is_coach_of`-equivalent re-check inside the function body (Pattern 3) is mandatory regardless of `verify_jwt`. Phase 8's chat research already flags this exact class of pitfall for `send-message`'s future real implementation — treat it as equally load-bearing here.
**Warning signs:** No "unassigned coach denied" or "self-assign-rejected" `verify:rls` assertion actually invoking the live Edge Function (a test that only checks the SQL layer, never the function, would miss this). `[CITED: https://supabase.com/docs/guides/functions/auth]`

### Pitfall 3: Duplicating the Onboarding `pg_jsonschema` CHECK String Instead of Sharing It
**What goes wrong:** The tracker migration copy-pastes the JSON Schema string from `onboarding_question_config_schema` with a typo or drift (e.g., forgetting `additionalProperties: false`), silently weakening the config-validation backstop for tracker fields specifically.
**Why it happens:** SQL has no shared-constant mechanism across CHECK constraints without a helper function; copy-paste is the path of least resistance.
**How to avoid:** Either literally copy the schema string byte-for-byte from `0008_onboarding.sql`'s `onboarding_question_config_schema` constraint (safest, verified this session), or — if the planner wants a single source of truth — extract it into a `private.field_config_json_schema() returns json` SQL function called from both migrations' CHECK constraints (more DRY, slightly more migration-ordering complexity since `0009` would then need to reference a function, not just a literal). Recommend the copy-paste approach for this phase given the low migration-count and the value of each migration being self-contained/replayable.
**Warning signs:** A malformed-tracker-config `verify:rls` assertion that unexpectedly succeeds (accepts a config the onboarding equivalent would reject). `[VERIFIED: supabase/migrations/0008_onboarding.sql onboarding_question_config_schema constraint, read in full this session]`

### Pitfall 4: Entry Cadence Grain Mismatch (Daily vs. Weekly) Producing Duplicate or Missing Rows
**What goes wrong:** `tracker_entries` uses a single `entry_date date` column with a `(assignment_id, field_id, entry_date)` unique constraint, but a **weekly**-cadence tracker's client saves an entry on Monday and again on Wednesday of the same week, expecting both to count as "this week's entry" (single row, last-write-wins) — but the unique constraint treats them as two different dates and creates two rows instead of one upsert.
**Why it happens:** The schema's period-key column (`entry_date`) defaults to calendar-day grain, which only matches `daily` cadence; `weekly` cadence needs a period-key normalized to the start of the ISO week, not the exact save date.
**How to avoid:** Derive the period key based on the version's cadence at save time inside `save_tracker_entry`: for `daily`, use `current_date`; for `weekly`, use `date_trunc('week', current_date)::date`. Store the derived period key in `entry_date` so the unique constraint correctly collapses same-period saves regardless of cadence.
**Warning signs:** A weekly tracker seed/test that saves twice in one week and finds two `tracker_entries` rows instead of one updated row; a milestone-progress count that overstates entries relative to the number of periods elapsed. `[ASSUMED — reasoning from the cadence requirement, no direct precedent since onboarding has no cadence concept]`

### Pitfall 5: Coach Review Query Missing the `status='ended'` Case
**What goes wrong:** A coach's read-only tracker timeline queries only the client's `tracker_entries` joined through `tracker_assignments`, but after a hypothetical re-assignment (out of scope this phase per "no assignment UI," but the schema should not preclude it later) the coach review silently shows nothing for an `ended` assignment's historical entries, looking like a bug rather than an intentional "current tracker only" scope choice.
**Why it happens:** `tracker_assignments.status` exists to support a future re-assignment flow (`ASGN-01`, deferred), but Phase 6's coach review UI only needs the currently active assignment — the risk is under-scoping the query to `status = 'active'` without a documented reason, so a later phase's re-assignment feature silently orphans historical entries from view.
**How to avoid:** Document explicitly (in the plan, not just here) that Phase 6's coach review shows only the single active assignment's entries — this is correct for v1.1 scope (exactly one tracker, ever, this milestone) — and that surfacing historical/ended assignments is deferred alongside `ASGN-01`. Do not silently under-scope; state the boundary.
**Warning signs:** None specific to this phase's `verify:rls` (there is only ever one assignment per client in v1.1 test fixtures), but worth a one-line code comment for the next engineer, mirroring this repo's existing "D-XX" comment discipline. `[ASSUMED]`

## Code Examples

### Save Tracker Entry Server Action (Direct Adaptation of `saveOnboardingAnswerAction`)

```ts
// Source: apps/web/app/(authenticated)/onboarding/actions.ts, adapted (VERIFIED pattern)
"use server";

export async function saveTrackerEntryAction(input: unknown) {
  const services = await createServerSupabaseServices();
  const user = await services.auth.getCurrentUser();
  if (!user.ok || !user.data) {
    return { status: "notice" as const, values: input, notice: "That did not save yet. Keep this open and try again." };
  }

  const parsed = saveTrackerEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice" as const, values: input, notice: "That did not save yet. Keep this open and try again." };
  }

  const fieldResult = await services.database.tracker.getFieldForAnswerValidation(parsed.data.fieldId);
  if (!fieldResult.ok || !fieldResult.data) {
    return { status: "notice" as const, values: parsed.data, notice: "That did not save yet. Keep this open and try again." };
  }

  const validation = validateFieldAnswer(fieldResult.data.config, parsed.data.answer);
  if (!validation.success) {
    return { status: "notice" as const, values: parsed.data, notice: "That did not save yet. Keep this open and try again." };
  }

  const saveResult = await services.database.tracker.saveEntry({ fieldId: parsed.data.fieldId, answer: validation.data });
  if (!saveResult.ok) {
    return { status: "notice" as const, values: parsed.data, notice: "That did not save yet. Keep this open and try again." };
  }

  return { status: "saved" as const, values: parsed.data, result: saveResult.data };
}
```

### `save_tracker_entry` Command Function (Direct Adaptation of `save_onboarding_answer`)

```sql
-- Source: supabase/migrations/0008_onboarding.sql save_onboarding_answer, adapted (VERIFIED pattern)
create or replace function public.save_tracker_entry(p_field_id uuid, p_answer jsonb)
returns table (assignment_id uuid, entry_id uuid, entry_date date, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := (select auth.uid());
  v_field public.tracker_fields%rowtype;
  v_assignment public.tracker_assignments%rowtype;
  v_period date;
  v_cadence text;
  v_entry_id uuid;
begin
  if v_client_id is null then
    raise exception 'not authenticated';
  end if;

  select f.* into v_field
  from public.tracker_fields f
  where f.id = p_field_id;

  if not found then
    raise exception 'tracker field is not available';
  end if;

  select ta.*, tcv.cadence into v_assignment, v_cadence
  from public.tracker_assignments ta
  join public.tracker_config_versions tcv on tcv.id = ta.version_id
  where ta.client_id = v_client_id
    and ta.status = 'active'
    and tcv.id = v_field.version_id;

  if not found then
    raise exception 'no active tracker assignment for this field';
  end if;

  v_period := case
    when v_cadence = 'weekly' then date_trunc('week', current_date)::date
    else current_date
  end;

  insert into public.tracker_entries (
    assignment_id, field_id, version_id, field_key, field_order,
    field_prompt, answer_type, field_config, answer, entry_date
  )
  values (
    v_assignment.id, v_field.id, v_field.version_id, v_field.field_key,
    v_field.field_order, v_field.prompt, v_field.answer_type, v_field.config,
    p_answer, v_period
  )
  on conflict on constraint tracker_entries_assignment_field_period_key do update
    set answer = excluded.answer, updated_at = now()
  returning id into v_entry_id;

  return query select v_assignment.id, v_entry_id, v_period, v_assignment.status;
end;
$$;

revoke execute on function public.save_tracker_entry(uuid, jsonb) from public;
grant execute on function public.save_tracker_entry(uuid, jsonb) to authenticated;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Building a tracker-specific field renderer | Reusing Phase 5's domain-agnostic `FieldRenderer`/`FieldConfig`/`FieldAnswer` | Locked at v1.1 roadmap creation (2026-07-04) | Zero new renderer code; the entire component surface is shared across onboarding and tracker. `[VERIFIED: STATE.md v1.1 roadmap decisions]` |
| `send-message` as validation-only stub | `assign-tracker` as the first "real" Edge Function (JWT verify + membership check + DB write) in this repo | This phase (Phase 6) | Establishes the JWT-verify + membership re-check + service-role-write pattern that Phase 8's real `send-message` will also need — Phase 6 is effectively the dress rehearsal for Phase 8's higher-stakes version. `[VERIFIED: STATE.md todos: "Phase 4 (Profiles) and Phase 6 (Tracker) use standard/reuse patterns — skip research-phase" combined with this session's finding that assign-tracker is NOT actually a pure-reuse item]` |
| Trigger-maintained progress counters (a common SaaS pattern) | Read-time derivation from raw entry rows | This phase, by explicit requirement (TRAK-05) | Prevents the schema from ever being able to express a decrementing/resettable value — a stronger guarantee than a UI-only "don't show a streak" rule. `[VERIFIED: REQUIREMENTS.md TRAK-05]` |

**Deprecated/outdated:**
- None specific to this phase's external libraries (zod v4, Next.js 16, Supabase JS 2.110 are all already the current versions verified in Phase 5's research and re-confirmed this session for zod).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact table names `tracker_configs`, `tracker_config_versions`, `tracker_fields`, `tracker_assignments`, `tracker_entries` | Data Model | Low — planner discretion, topology (5-table shape mirroring onboarding) is what matters, not exact names. |
| A2 | `assign-tracker` should perform its coach-membership check via a caller-scoped client (not a new `is_coach_of_uid` SQL function) | Pattern 3 | Medium — if the planner instead adds the new SQL helper, that's a valid alternative explicitly documented above; either resolves the Pitfall 1 problem, so risk is only "wasted research guidance," not a correctness gap. |
| A3 | Milestone-count threshold (illustrated as "5 entries per milestone") | Pattern 4 | Low — purely illustrative; the load-bearing claim (derive from `tracker_entries`, no counter column) is HIGH confidence; the specific number is explicitly marked Claude's Discretion. |
| A4 | `tracker_entries.entry_date` should be normalized per-cadence (day vs. week-start) rather than the raw save timestamp's date | Pitfall 4 | Medium — if the planner instead allows multiple entries per calendar day even for weekly trackers, the milestone math must then aggregate by week itself; either is workable, but the plan must pick one explicitly rather than leaving it ambiguous. |
| A5 | Seed script should sign in as a real coach fixture and call `assign-tracker` over HTTP, rather than adding a service-role special-case branch to the function | Pattern 3 | Low — this is a test-realism recommendation; a service-role special case is also workable and some teams prefer it for seed simplicity. |
| A6 | The onboarding `pg_jsonschema` CHECK schema string should be copy-pasted (not extracted into a shared SQL function) for this migration | Pitfall 3 | Low — either approach is DB-correct; copy-paste risks drift on a future edit to one but not the other, extraction adds a small amount of migration-ordering complexity. Flagged so the planner makes a deliberate choice. |

## Open Questions

1. **Should `assign-tracker`'s coach-membership check use a caller-scoped Supabase client or a new `is_coach_of_uid(caller_uid, client_uuid)` SQL helper?**
   - What we know: `private.is_coach_of(client_uuid)` reads `auth.uid()` internally and cannot be called meaningfully from a service-role admin connection (Pitfall 1). Both a caller-scoped-client approach and a new explicit-parameter SQL function resolve this correctly.
   - What's unclear: Which is more idiomatic for this specific Deno Edge Function runtime and whether the team prefers zero-new-SQL (caller-scoped client) over a small, explicit, easily-unit-testable SQL helper.
   - Recommendation: Default to the caller-scoped client approach (Pattern 3, option b) since it requires no new SQL function and mirrors how `verify-rls.ts`'s `signInAs()` already treats "a real session subject to RLS" as the trusted verification mechanism for this codebase's conventions. Planner should make this an explicit task-level decision, not leave it implicit in code.

2. **Does TRAK-03's "preserved on... navigation" require surviving a full page reload/tab close, or only an in-app SPA route change?**
   - What we know: The existing onboarding implementation (`OnboardingClientFlow`) preserves drafts only in React component state, which does NOT survive a hard reload — it survives only client-side route transitions within the same mounted tree, and any already-*saved* answer is safe because it is persisted, not because of client-side draft retention.
   - What's unclear: Whether "navigation" in TRAK-03's wording is meant as parity with onboarding's existing (lighter) guarantee, or as a strictly stronger guarantee requiring `sessionStorage`/`beforeunload` handling that Phase 5 never actually built.
   - Recommendation: Match Phase 5's existing bar (in-memory draft retention across SPA navigation only) unless `/gsd:discuss-phase` surfaces an explicit stronger requirement in `06-CONTEXT.md`. If the planner wants the stronger guarantee, budget it as new work, not reuse — a `sessionStorage` mirror keyed by `assignmentId:fieldId`, cleared on successful save, is the minimal addition.

3. **Cadence-to-entry-date normalization: is this something `save_tracker_entry` should handle (server-derived), or should the client determine and send the period key?**
   - What we know: Deriving the period key server-side (inside the SQL function, from the version's own `cadence` column) is more consistent with "server derives, client never dictates" discipline already established for `coach_id`/`version_id` in the assignment flow.
   - What's unclear: Whether a client might legitimately need to backfill a missed period (e.g., logging "yesterday's" weekly entry) — if so, an explicit `entry_date` input from the client becomes necessary, reintroducing a small trust boundary question (can a client claim an arbitrary past date?).
   - Recommendation: Server-derives-from-`current_date`-and-cadence for v1.1 (no backfill UI, consistent with "no lost work, calm present-moment logging" ND design ethos — backfilling old missed periods edges toward the "scolding about a missed day" anti-pattern anyway). Revisit only if a coach validates a backfill need.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build, seed, `verify:rls` | Yes | `v22.22.2` (checked this session) | — |
| pnpm | workspace scripts | Yes | `11.7.0` (checked this session) | — |
| Supabase CLI | local stack/migrations/Edge Function serving | Yes | `2.109.0` (checked this session) | — |
| Docker | local Supabase services | Yes | `29.6.1` (checked this session) | — |
| Local Supabase stack | RLS verification, Edge Function testing | Yes | REST API responded HTTP 200 on `127.0.0.1:54321`; two non-critical services (`imgproxy`, `pooler`) reported stopped but do not affect this phase | Restart with `supabase stop && supabase start` if a full-stack issue arises; not needed for this phase's scope. |
| `apps/web/.env.local` | seed/`verify:rls` scripts, Server Actions | Yes | present, used successfully by prior phases | — |
| zod (installed) | config/answer validation | Yes | `^4.4.3` installed, registry current `4.4.3` (checked this session, `npm view zod version`) | — |
| `pg_jsonschema` Postgres extension | Config CHECK backstop | Yes | already enabled by migration `0008_onboarding.sql` | — |
| Supabase Edge Function local runtime (`supabase functions serve`) | Testing `assign-tracker` before/alongside `verify:rls` | Not directly probed this session (requires a running `serve` process, which this research did not start) | — | If local Edge Function serving proves flaky, the planner can fall back to invoking `assign-tracker`'s logic through a direct service-role SQL insert for `verify:rls` fixture setup, while still shipping the real Edge Function file — but the "self-assign-rejected" assertion specifically should exercise the live function, not bypass it, since that is exactly where the authorization logic lives. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Supabase Edge Function local serving was not live-tested this session (only the REST/DB stack was probed); the fallback is documented above and does not block planning.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing, `apps/web/vitest.config.ts`) + Testing Library + the plain-Node `scripts/verify-rls.ts` harness |
| Config file | `apps/web/vitest.config.ts`; RLS harness is `scripts/verify-rls.ts` (672 lines currently; will grow with `checkTracker*` functions) |
| Quick run command | `pnpm --filter @fish/web test -- --run apps/web/lib/validation/tracker.test.ts apps/web/components/tracker/*.test.tsx` |
| Full suite command | `pnpm build && pnpm verify:rls` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| TRAK-01 | Tracker renders from versioned config (fields + cadence), not hard-coded | integration + component | `pnpm --filter @fish/web test -- --run apps/web/app/(authenticated)/tracker/page.test.tsx` | Wave 0 |
| TRAK-02 | `assign-tracker` derives coach/version server-side; self-assign and cross-client rejected | RLS live assertion + manual Edge Function invocation proof | `pnpm verify:rls` (assertions: `checkTrackerSelfAssignRejected`, `checkTrackerUnassignedCoachAssignRejected`) plus a documented `curl`/`fetch` proof against the local `assign-tracker` function | Wave 0 |
| TRAK-03 | Entry saves; draft preserved on failure/navigation; entry pins version | component + RLS/integration | `pnpm --filter @fish/web test -- --run apps/web/components/tracker/tracker-entry-flow.test.tsx` plus `pnpm verify:rls` (`checkTrackerEntrySelfSave`) | Wave 0 |
| TRAK-04 | Config validated (zod + `pg_jsonschema`) and versioned; entry pins version | unit + RLS live assertion | `pnpm --filter @fish/web test -- --run apps/web/lib/validation/tracker.test.ts` plus `pnpm verify:rls` (`checkTrackerMalformedConfigRejected`, `checkTrackerUsedVersionImmutable`) | Wave 0 |
| TRAK-05 | Visual milestone progress; schema has no streak/adherence column | component + grep + RLS | `pnpm --filter @fish/web test -- --run apps/web/components/tracker/milestone-progress.test.tsx`; grep gate: `if rg -n "streak|adherence|grade|score|percent.*complet" supabase/migrations/0009_tracker.sql; then exit 1; else echo 'no-streak schema scan passed'; fi` | Wave 0 |
| TRAK-06 | Coach reviews entries read-only, RLS-scoped, no scoring UI | RLS + page test | `pnpm verify:rls` (`checkTrackerAssignedCoachReadsEntries`, `checkTrackerUnassignedCoachDenied`, `checkTrackerCrossClientDenied`) plus `apps/web/app/(authenticated)/coach/clients/[id]/page.test.tsx` extension | existing file, needs extension |
| XC-01 | RLS assertions for every new table; `pnpm build` green | integration | `pnpm verify:rls` full run + `pnpm build` | Wave 0 (new assertions) |
| XC-02 | zod + `pg_jsonschema` reject malformed tracker config | unit + integration | `pnpm --filter @fish/web test -- --run apps/web/lib/validation/tracker.test.ts` + `pnpm verify:rls` (`checkTrackerMalformedConfigRejected`) | Wave 0 |
| XC-03 | Design line — one action, 56px, no lost draft, calm copy | component + grep | Reuse the Phase 5 judgement-copy/raw-hex grep gates, retargeted at `apps/web/components/tracker/` | Wave 0 |

### Nyquist-Style Validation Dimensions

| Dimension | Evidence Needed |
|-----------|-----------------|
| Data correctness | Seed creates one active tracker config version with cadence + fields; entries pin `version_id` + field snapshot; malformed config rejected by zod AND the DB CHECK. |
| Authorization | Real anon-key sign-ins prove: client self-read/self-write of own entries only; assigned coach reads entries/assignment; unassigned coach denied (zero rows, no error); cross-client denied; a client's own attempt to insert into `tracker_assignments` directly (bypassing the Edge Function) is rejected by RLS (no authenticated INSERT policy exists) — this IS the "self-assign-rejected" assertion. |
| Assignment invariant | A second `assign-tracker` call (or a second direct service-role insert) for the same client with an already-active assignment is rejected by the partial unique index, proving "exactly one active tracker" holds even under a race/retry, not just app-level intent. |
| Schema invariant (no streak) | A static grep/schema-introspection check confirms no column named `streak*`/`adherence*`/`completion_rate*` exists on any tracker table — this is the one assertion category genuinely novel to this phase versus Phase 5's template. |
| State recovery | Save entry, simulate a failed subsequent save (e.g., stub the Server Action to reject), confirm the draft value is still present in the UI rather than cleared. |
| UI contract | One primary action per view; 56px controls (inherited for free from reused `FieldRenderer`); milestone-journey visual only, no percentage/grade copy anywhere in tracker components (grep gate). |
| Reuse contract | A test/grep proving zero new files were added under `apps/web/components/fields/` for this phase — the tracker UI imports that directory, it does not extend it. |
| Build/release | `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm verify:rls` all green before phase closeout, matching the Phase 4/5 gate exactly. |

### Sampling Rate
- **Per task commit:** targeted Vitest file(s) + `pnpm --filter @fish/web typecheck`.
- **Per wave merge:** `pnpm build && pnpm verify:rls`.
- **Phase gate:** full `pnpm build && pnpm lint && pnpm typecheck && pnpm verify:rls`, plus one manual/documented `assign-tracker` Edge Function invocation proof (the assignment path is the one component `verify:rls` alone cannot fully exercise without either running `supabase functions serve` or the seed script calling the deployed local function).

### Wave 0 Gaps
- [ ] `supabase/migrations/0009_tracker.sql` — schema/RLS/command-functions/config-checks/freeze-triggers/partial-unique-indexes.
- [ ] `supabase/functions/assign-tracker/index.ts` — the Edge Function itself (net-new file, no existing test scaffold).
- [ ] `apps/web/lib/validation/tracker.test.ts` — zod config/answer/entry validation tests.
- [ ] `apps/web/components/tracker/*.test.tsx` — entry flow, milestone progress (no-streak assertion), coach review.
- [ ] `scripts/verify-rls.ts` tracker assertion functions (six+ new, mirroring `checkOnboarding*`).
- [ ] `scripts/seed.ts` `seedTrackerConfig()` + an `assign-tracker` invocation for local dev bootstrap/RLS-fixture setup.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Edge Function verifies caller JWT (`verify_jwt = true` in `config.toml`) and re-resolves identity via `getUser()`; Server Actions re-check `getUser()` exactly as Phase 5 does. `[VERIFIED: supabase/config.toml, apps/web/app/(authenticated)/onboarding/actions.ts pattern]` |
| V3 Session Management | yes | Existing `@supabase/ssr` server client and cookie/session pattern, unchanged. `[VERIFIED: codebase]` |
| V4 Access Control | yes | RLS policies plus `private.is_coach_of` for reads; a NEW dedicated membership re-check inside the Edge Function for the assignment write (the one place a plain RLS policy cannot apply, since the write itself is service-role). `[CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]` `[CITED: https://supabase.com/docs/guides/functions/auth]` |
| V5 Input Validation | yes | zod v4 app validation (entry answers, assign-tracker request body) and `pg_jsonschema` DB CHECK for field config, identical pattern to Phase 5. `[VERIFIED: apps/web/lib/validation/onboarding.ts, supabase/migrations/0008_onboarding.sql]` |
| V6 Cryptography | no | No custom crypto in scope; relies on Supabase Auth/JWT unchanged. |
| V13 API and Web Service | yes | The Edge Function is explicitly an untrusted-until-verified command boundary — this is the phase's highest-scrutiny surface, analogous to how Phase 8's `send-message` will be treated. `[VERIFIED: STATE.md todos flag Phase 6/8 Edge Function signatures as the design work needed]` |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A client calls `assign-tracker` directly (bypassing any UI) with their own id as `clientId`, attempting to self-assign a tracker | Elevation of Privilege | The Edge Function's membership check requires the CALLER to be a coach of the target client; a client caller fails `is_coach_of` (they are not a coach) and is rejected with 403 — this is the "self-assign-rejected" assertion. `[ASSUMED — direct extension of the existing is_coach_of check reasoning]` |
| A coach calls `assign-tracker` with an arbitrary `clientId` they are not assigned to, attempting a cross-client assignment | Elevation of Privilege / Information Disclosure | Re-querying `coach_clients`/`is_coach_of` server-side (never trusting the request) rejects with 403; this must be tested against the LIVE function, not just the RLS layer, since RLS alone does not protect a service-role write. `[VERIFIED: ROADMAP.md Phase 6 Success Criterion #2 explicit wording]` |
| Two concurrent/retried `assign-tracker` calls for the same client both succeed, creating two "active" assignments | Tampering (data integrity) | The partial unique index (`tracker_one_active_assignment_per_client`) makes the second insert fail at the DB regardless of application-level race conditions. `[VERIFIED pattern: onboarding_one_active_version index]` |
| Malformed tracker field config causes a broken renderer or unsafe rendering | Tampering | zod parse before render; DB JSON Schema CHECK (reused from onboarding); render text as React text, never HTML. `[VERIFIED: supabase/migrations/0008_onboarding.sql, apps/web/lib/validation/onboarding.ts pattern]` |
| Published tracker fields edited after entries exist, retroactively changing what a coach sees an old entry "meant" | Repudiation / Tampering | Freeze trigger on used tracker versions/fields (direct reuse of `reject_used_onboarding_version_mutation`/`reject_used_onboarding_question_mutation`) plus entry-level field snapshot columns. `[VERIFIED: supabase/migrations/0008_onboarding.sql]` |
| A future "undo my entry" feature decrements a progress counter, functionally recreating a resettable streak | Tampering (of the product's own design invariant) | No counter column exists to decrement in the first place — progress is always derived fresh from `tracker_entries`; deleting an entry (if ever allowed) simply changes the count on next read, with no separate "streak" state to corrupt. `[VERIFIED: REQUIREMENTS.md TRAK-05, this research's Pattern 4]` |

## Sources

### Primary (HIGH confidence)
- `AGENTS.md`, `.claude/CLAUDE.md`, `CLAUDE.md` — stack, design rules, Supabase boundary, coach-first rule. `[VERIFIED: codebase, read in full this session]`
- `.planning/ROADMAP.md` Phase 6 section — authoritative goal + 5 success criteria. `[VERIFIED: codebase, read in full this session]`
- `.planning/REQUIREMENTS.md` TRAK-01..06, XC-01..04 — requirement text, including the literal "schema stores entries, not a streak integer" wording. `[VERIFIED: codebase, read in full this session]`
- `.planning/STATE.md` — v1.1 roadmap decisions, the "assign-tracker Edge Function signature — design during Phase 6 planning" flag this research resolves. `[VERIFIED: codebase, read in full this session]`
- `supabase/migrations/0007_client_profiles.sql`, `0008_onboarding.sql`, `0004_rls_helpers.sql` — the exact freeze/versioning/RLS-helper patterns reused throughout this research. `[VERIFIED: codebase, read in full this session]`
- `scripts/verify-rls.ts`, `scripts/seed.ts` — the exact assertion/fixture pattern this phase's tests must extend. `[VERIFIED: codebase, read in full this session]`
- `packages/core/src/fields.ts`, `apps/web/lib/validation/onboarding.ts`, `apps/web/components/fields/*`, `apps/web/components/onboarding/*`, `apps/web/app/(authenticated)/onboarding/*`, `apps/web/lib/services/supabase/{types,core}.ts`, `apps/web/lib/auth/server.ts` — the complete Phase 5 reuse surface. `[VERIFIED: codebase, read in full this session]`
- `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` — the coach read-only review integration point. `[VERIFIED: codebase, read in full this session]`
- `supabase/functions/send-message/index.ts`, `supabase/config.toml` (`[functions.send-message] verify_jwt = true`) — the existing Edge Function shape and JWT-verification config, confirmed this session to NOT yet include identity/membership verification. `[VERIFIED: codebase, read in full this session]`
- `.claude/skills/sketch-findings-fish/references/profile-and-progress.md` — the settled milestone-journey/no-streak progress design decision. `[VERIFIED: codebase, read in full this session]`
- `.planning/phases/05-data-driven-onboarding/05-RESEARCH.md` — the direct research precedent this phase's methodology and many patterns are drawn from. `[VERIFIED: codebase, read in full this session]`
- Local environment checks this session: `node --version` (`v22.22.2`), `pnpm --version` (`11.7.0`), `supabase --version` (`2.109.0`), `docker info`, `supabase status`, `curl` against the local REST API (HTTP 200), `npm view zod version` (`4.4.3`). `[VERIFIED: command, this session]`

### Secondary (MEDIUM confidence)
- Supabase Edge Functions authentication/JWT docs: https://supabase.com/docs/guides/functions/auth
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API security docs: https://supabase.com/docs/guides/api/securing-your-api
- Zod discriminated union / `safeParse` docs: https://zod.dev/api

### Tertiary (LOW confidence)
- Claims marked `[ASSUMED]` in the Assumptions Log above; planner should confirm or adjust during task breakdown, particularly A2 (caller-scoped-client vs. new SQL helper) and A4 (cadence-normalization approach).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; existing versions re-verified against npm registry this session.
- Architecture (config/RLS/renderer reuse): HIGH — every reused pattern was read in full from the actual committed migration/component files this session, not inferred from summaries alone.
- Architecture (`assign-tracker` Edge Function specifics): MEDIUM — no direct precedent exists in this codebase (send-message does not verify identity or touch the DB); the recommended shape is synthesized from Supabase's official Edge Function auth docs plus this repo's existing RLS-helper pattern, and flagged with explicit Open Questions where a genuine design choice remains.
- Pitfalls: HIGH for the reused-pattern pitfalls (directly observed in the existing code, e.g., `is_coach_of`'s `auth.uid()` dependency); MEDIUM for the tracker-specific pitfalls (cadence-grain, coach-review scoping) since these have no prior occurrence in this codebase to verify against.
- Validation architecture: HIGH — directly modeled on the already-shipped and passing `verify:rls`/Vitest gate structure from Phase 4/5.

**Research date:** 2026-07-05
**Valid until:** 2026-08-04 for codebase architecture; 2026-07-12 for package/latest-version claims (zod, Next.js, Supabase JS all re-verify quickly given this stack's fast release cadence).
