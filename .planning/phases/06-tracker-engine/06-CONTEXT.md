# Phase 6: Tracker Engine - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** `$gsd-discuss-phase 6`, then user-approved recommended defaults

<domain>
## Phase Boundary

Deliver the tracker engine on top of the shipped profile and onboarding foundations:

- A versioned tracker config model stored in Supabase, with fields rendered from the Phase 5 shared field renderer and a daily/weekly cadence evaluated in the client's saved timezone.
- An authorized `assign-tracker` Edge Function that assigns exactly one active tracker to a client. The client never browses, chooses, or switches trackers.
- A client tracker entry surface that renders the single assigned tracker, preserves a private durable draft across failure/navigation/refresh, and saves the current period's entry with its pinned config version.
- Assignment-owned milestone progress that the coach can extend over time, rendered as a reward-only journey. No grade, score, adherence percent, streak, punishment, or gap shaming.
- A coach read-only timeline of the assigned client's saved tracker entries, scoped by RLS and reusing the Phase 5 answer formatting pattern.
- Extended `pnpm verify:rls`, zod validation, `pg_jsonschema` database checks, and a green `pnpm build`.

**Not in this phase:** tracker/template browsing, assignment UI, coach tracker authoring UI, validated learning templates, reward/gamification mechanics beyond the required milestone journey, streak counters, realtime updates, analytics dashboards, comments/replies on entries, edit/delete entry UI, or a Progress tab navigation change.

</domain>

<spec_lock>
## UI Contract Locked

The phase has a UI design contract at `.planning/phases/06-tracker-engine/06-UI-SPEC.md`.
It is not a product requirements SPEC with a numbered `## Requirements` section, but it is binding for visual and interaction decisions.

Downstream agents MUST read `06-UI-SPEC.md` before planning or implementing. Do not re-decide layout, copy, milestone visual grammar, one-primary-action rules, or coach timeline shape unless the spec directly conflicts with requirements.

**In scope from the UI contract:**
- Client renders one assigned tracker on Home, not a picker or gallery.
- Tracker entry form reuses `FieldRenderer` and has one `Save entry` primary action.
- Milestone progress is a read-only vertical journey with done/now/up-next states, never a grade or streak.
- Coach sees a read-only reverse-chronological entry timeline on `/coach/clients/[id]`.
- Draft preservation, calm notices, no layout shift, token-backed UI, and no raw hex are mandatory.

**Out of scope from the UI contract:**
- Progress tab navigation, tracker assignment UI, destructive entry actions, scoring UI, comments/replies on entries, chart/analytics motifs, streaks, and any second visual language.

</spec_lock>

<decisions>
## Implementation Decisions

### Tracker config, cadence, and milestone source
- **D-01:** Tracker versions define the renderable tracker shape: tracker identity/copy, field configs, and cadence. They do not own the evolving milestone journey.
- **D-02:** Milestone steps live separately on the client's active tracker assignment or assignment-owned journey. This makes the UI copy "your coach adds each step as you're ready" literally true without republishing tracker versions.
- **D-03:** Milestone steps are coach-authored plain-language copy with done/now/up-next state derived from assignment progress. Do not auto-generate step labels from numeric thresholds or render thresholds as fractions.
- **D-04:** Daily/weekly entry periods use the client's saved timezone from `client_profiles.timezone`, not coach timezone or UTC. If timezone is missing, planner may choose the calmest fallback, but must avoid silently changing a client's period after entries exist.
- **D-05:** v1.1 supports exactly one active tracker assignment per client. Enforce this at the database level with an active-assignment uniqueness constraint or equivalent.
- **D-06:** Tracker config validation mirrors Phase 5's field config discipline: zod in `apps/web` for app/runtime parsing and `pg_jsonschema` CHECK constraints in Supabase. Keep runtime zod out of `packages/core`.
- **D-07:** Saved entries pin to the assignment's tracker config version and snapshot enough field config/copy to make coach review stable even after later config changes.

### Entry draft, save lifecycle, and coach visibility
- **D-08:** Draft preservation is durable and private. Use a Supabase-backed draft or draft-status row so a refresh, navigation away, or device switch can restore the in-progress entry.
- **D-09:** The client may auto-persist draft changes quietly, but the only visible primary action is `Save entry`. Draft persistence must not introduce a second retry/submit action.
- **D-10:** A draft is not coach-visible. The coach timeline reads saved entries only. This avoids exposing half-typed or accidental client text.
- **D-11:** `Save entry` converts the current period's private draft into a saved entry, or marks the existing row saved, and records `saved_at`/status plus the pinned tracker config version.
- **D-12:** On save failure, the form values remain in local state and in any last successful durable draft. The `Save entry` button itself is the retry affordance; do not add a second "Retry" button.
- **D-13:** If a saved entry can be incomplete because fields are optional, the coach timeline may show it calmly as saved partial data. It must not show unsaved draft data.
- **D-14:** Entry save should be implemented as a Server Action/RPC-style authenticated command, following the Phase 5 onboarding save pattern, so the server derives assignment, current period, and version pinning. A Node/Express API is out of scope.

### Assignment command and active-tracker policy
- **D-15:** `assign-tracker` is an Edge Function because assignment is command-style sensitive logic. It may be seed-invoked with service credentials and should also be safe for a future coach-authenticated caller.
- **D-16:** The assignment command derives `coach_id` from the existing `coach_clients` relationship and derives the tracker version server-side from the active published config. Do not trust client-supplied coach IDs or version IDs as authority.
- **D-17:** In v1.1 there is no assignment UI. Seed scripts or privileged tooling can call the Edge Function; the client experience remains assigned and choice-free.
- **D-18:** Assignment is idempotent for the same active tracker/version/client pair. A conflicting active tracker assignment is rejected with calm copy instead of silently replacing it.
- **D-19:** Replacing/retiring an active tracker is deferred. The database can support inactive/retired assignment status if useful, but no replacement UI or workflow ships in this phase.
- **D-20:** The assignment should seed or attach the initial assignment-owned milestone journey using neutral coach-authored copy. Do not ship validated learning templates or reward mechanics beyond the required milestone journey.

### Coach read-only review
- **D-21:** Coach review extends `/coach/clients/[id]` and mirrors `CoachOnboardingReview`: read-only cards, original field label/copy, formatted answer text, calm empty/partial states, and no primary action.
- **D-22:** Coach reads are RLS-scoped via `private.is_coach_of`. An unassigned coach sees the same calm not-found/empty behavior as Phase 4/5, with no cross-client leak.
- **D-23:** Entry ordering is reverse chronological by period/saved time. No table, calendar, heatmap, chart, filter, score, or adherence summary in this phase.

### Verification and gates
- **D-24:** `pnpm verify:rls` must add tracker assertions for entry self-ownership, active-assignment gate, assigned-coach-read, unassigned-denial, cross-client-denial, self-assign rejected, and conflicting active assignment rejected or idempotent as appropriate.
- **D-25:** Tests must prove malformed tracker config is rejected by both app zod parsing and the `pg_jsonschema` database CHECK.
- **D-26:** Verification must include a save/resume proof for tracker drafts: enter values, navigate/refresh or simulate failed save, and confirm the same values restore from durable state.
- **D-27:** Verification must grep or test against forbidden progress language and schema leaks: no score, grade, percent/adherence UI, streak integer, missed-period shaming, heatmap, or chart motif.
- **D-28:** Phase verification must run `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm verify:rls`, relevant unit tests, and the security pass requested by the user.

### the agent's Discretion
- Exact table names, migration number, enum/check names, RPC names, repository interface names, and whether draft and saved entries use one table with status or two tables.
- Exact fallback behavior when a client timezone is missing, provided existing saved period boundaries do not drift silently.
- Exact seed tracker name, field labels, and initial milestone copy, provided the content stays neutral, coach-assigned, and not an unvalidated teaching template.
- Exact shape of future-compatible coach-authentication in `assign-tracker`, provided v1.1 remains no-assignment-UI and seed-invocable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` section "Phase 6: Tracker Engine" - phase goal, dependencies, success criteria, and `assign-tracker` command expectations.
- `.planning/REQUIREMENTS.md` - TRAK-01 through TRAK-06 plus XC-01, XC-02, and XC-03.
- `.planning/PROJECT.md` sections "Current Milestone: v1.1 The Coaching Loop", "Constraints", and "Key Decisions" - coach-first boundaries, seed-only assignment, Supabase API boundary, and design line.
- `.planning/STATE.md` sections "v1.1 roadmap decisions" and "Todos / open questions" - tracker depends on Phase 5 renderer; `assign-tracker` signature is intentionally designed during Phase 6.

### Locked UI and product rules
- `.planning/phases/06-tracker-engine/06-UI-SPEC.md` - binding Phase 6 UI/interaction contract.
- `AGENTS.md` - product rule, build order, API boundary, assigned-never-chosen, one-primary-action rule, no streaks, calm copy, Tailwind v4 CSS-first tokens.
- `docs/ui-ux-agent-guidelines.md` - mandatory UI/UX reference for every user-facing screen.
- `.claude/skills/sketch-findings-fish/SKILL.md` - validated design direction and source index.
- `.claude/skills/sketch-findings-fish/references/profile-and-progress.md` - milestone path grammar and reward-only constraints.
- `.claude/skills/sketch-findings-fish/references/states.md` - calm draft/save/offline/failure states.
- `.claude/skills/sketch-findings-fish/references/navigation-and-shell.md` - tracker remains on Home until a Progress tab is coach-validated.
- `.claude/skills/sketch-findings-fish/references/theme-and-tokens.md` - monochrome tokens, focus, reduced motion, shape-not-color-alone rules.
- `.claude/skills/sketch-findings-fish/references/coach-experience.md` - coach tools vs client choice boundaries.

### Prior dependency context
- `.planning/phases/05-data-driven-onboarding/05-CONTEXT.md` - shared renderer, versioning, autosave, zod/pg_jsonschema, and coach review decisions to reuse.
- `.planning/phases/05-data-driven-onboarding/05-UI-SPEC.md` - Phase 5 field/rendering precedent referenced by the Phase 6 UI spec.
- `.planning/phases/05-data-driven-onboarding/05-02-SUMMARY.md` - confirmation that `FieldRenderer`/`AnswerChip`/validation contracts are reusable.
- `.planning/phases/04-client-profiles/04-CONTEXT.md` - client timezone/profile and coach-client assignment relationship patterns.
- `.planning/phases/04-client-profiles/04-03-SUMMARY.md` - `/coach/clients/[id]` route structure and calm denied-state precedent.

### Existing implementation patterns
- `packages/core/src/fields.ts` - `FieldConfig`, `FieldAnswer`, and onboarding review answer contracts to extend or mirror.
- `apps/web/components/fields/field-renderer.tsx` - tracker fields must reuse this renderer rather than forking a tracker-specific renderer.
- `apps/web/lib/validation/onboarding.ts` - reusable field config/answer zod parsing and `validateFieldAnswer` discipline.
- `apps/web/components/onboarding/autosave-status.tsx` - save/draft status row pattern and polite live region.
- `apps/web/components/onboarding/coach-onboarding-review.tsx` - read-only answer formatting and coach review structure to mirror for tracker entries.
- `apps/web/app/(authenticated)/home/page.tsx` - client entry point where the assigned tracker appears.
- `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` - coach detail page to extend with tracker timeline.
- `apps/web/lib/services/supabase/core.ts` - repository/service pattern and Phase 5 onboarding RPC integration to extend.
- `apps/web/lib/services/supabase/types.ts` - repository interface pattern to extend.
- `supabase/migrations/0008_onboarding.sql` - latest versioned config, RLS, RPC, immutable-used-version, and `pg_jsonschema` migration shape.
- `scripts/seed.ts` - seed pattern to call assignment and seed neutral tracker config/fixtures.
- `scripts/verify-rls.ts` - live RLS assertion harness to extend for tracker tables and assignment command behavior.
- `packages/supabase/src/database.generated.ts` and `packages/supabase/src/database.types.ts` - generated DB type exports to update after migrations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FieldRenderer`, `AnswerChip`, and `TextAreaField` already render the six field types from config; tracker should compose these for all current-period fields.
- `validateFieldAnswer`, `fieldConfigSchema`, and `fieldAnswerSchema` already validate answer payloads against field config; tracker can reuse or extract this without adding zod to `packages/core`.
- `AutosaveStatus` already provides stable, calm status text with a polite live region; tracker save status should reuse it with Phase 6 copy.
- `CoachOnboardingReview` already formats `FieldAnswer` values against original field config; tracker coach timeline should reuse or extract the formatter rather than duplicating logic.
- `Button`, `Input`, `Card`, `Progress`, `Alert`, and chat `Skeleton` patterns are available in `apps/web/components/ui/` and `apps/web/components/chat/`.
- `SupabaseOnboardingRepository` and `save_onboarding_answer` show the current pattern for an authenticated RPC write that derives state server-side and returns a small result.

### Established Patterns
- RLS is the read authorization boundary; app code does not substitute manual filtering for policy.
- Server Components re-check role/user identity per route and rely on RLS returning zero rows for denied coach access.
- Phase 5 stores immutable snapshots of prompt/config/answer data so later version changes cannot rewrite what the user saw; tracker entries need the same stability.
- Used config versions/questions are protected by triggers; tracker config versions should get equivalent mutation guards once referenced by an assignment or entry.
- Config-bearing phases use zod in `apps/web` plus `pg_jsonschema` in PostgreSQL.
- Design tests can grep/render against one-primary-action and forbidden language.

### Integration Points
- Client Home -> assigned tracker entry form and milestone block.
- Tracker entry actions -> Supabase RPC/Server Action, current assignment, client timezone, durable draft, saved entry.
- `assign-tracker` Edge Function -> existing `coach_clients`, active published tracker config, seed script.
- Coach client detail -> tracker entry timeline below existing profile/onboarding review sections.
- Seed + migrations + generated database types + RLS verification all need to advance together.

</code_context>

<specifics>
## Specific Ideas

- Treat the tracker version as "what to render and how often"; treat assignment-owned milestones as "where this client is in their coach-guided journey."
- Keep the client surface language close to the UI spec: `Save entry`, `That did not save yet. Keep this open and try again.`, and `We saved what you started. Pick up where you left off.`
- Use neutral seed content only, such as a daily or weekly check-in. Do not encode an unvalidated language-learning technique or reward mechanic into the seed.
- If using one entries table, `status = 'draft' | 'saved'` plus RLS that hides drafts from coaches is acceptable. If using separate draft/saved tables, keep the same privacy and version-pinning guarantees.
- Prefer idempotent assignment for same client/tracker/version and explicit rejection for conflicting active assignment.

</specifics>

<deferred>
## Deferred Ideas

- Assignment/reassignment UI for coaches or admins - future phase when volume outgrows seed-only workflows.
- Coach tracker authoring/publishing UI - future phase; this phase can seed neutral config and expose a command boundary.
- Tracker template gallery or client plan picker - barred by assigned-never-chosen.
- Replacement/retirement workflow for an active tracker - future operational phase; v1.1 rejects conflicting active assignments.
- Progress tab navigation - waits for coach validation per the sketch findings; Phase 6 keeps tracker progress on Home.
- Reward mechanics beyond the required milestone journey, including return rewards - future trigger `TRAK-R01`; no streaks ever.
- Entry comments, coach replies inline, edit/delete entry UI, filters, search, charts, heatmaps, analytics, exports, or notifications - out of Phase 6.

Raw sketch manifest detected at `.planning/sketches/MANIFEST.md`, but no packaged `.codex/skills/sketch-findings-*` wrapper was found. Run `$gsd-sketch --wrap-up` later if those raw sketches should become reusable agent findings.

</deferred>

---

*Phase: 6-Tracker Engine*
*Context gathered: 2026-07-05*
