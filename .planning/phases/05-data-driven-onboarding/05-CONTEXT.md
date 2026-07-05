# Phase 5: Data-Driven Onboarding - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** `$gsd-discuss-phase 5` with auto-selected recommended defaults

<domain>
## Phase Boundary

Deliver the data-driven onboarding foundation on top of the shipped auth/profile base:

- A versioned onboarding assessment question bank stored in Supabase, with questions read from the database and never hard-coded in the UI.
- A client assessment experience that presents one question at a time, as a warm in-chat conversation, with one primary action and calm answer controls.
- A shared config-driven field renderer and validator that supports the six required answer types: `single_select`, `multi_select`, `scale`, `short_text`, `long_text`, and `boolean`.
- Autosaved answer drafts and exact resume position so a client can leave, refresh, and return without losing work or seeing scolding copy.
- Assessment versioning and immutability once used; each response pins to the exact assessment version the client saw.
- A read-only coach review surface for assigned clients' submitted or partial onboarding answers, scoped entirely by RLS.
- Extended `pnpm verify:rls`, app-level zod validation, a `pg_jsonschema` database backstop for question config, and a green `pnpm build`.

**Not in this phase:** onboarding branching/skip logic, coach authoring UI, assignment UI, validated learning content/templates, scoring/grades, tracker templates, realtime chat, or any Progress tab gamification. Minimal seed questions are neutral intake questions only, not a validated teaching technique.

</domain>

<decisions>
## Implementation Decisions

### Product shape and first-run framing
- **D-01:** Onboarding is a **warm in-chat assessment**, not a scroll form and not a plan/template picker. The `sketch-findings-fish` onboarding winner is binding: a system voice asks one question at a time; the client's selected or typed answer becomes their reply. This keeps FISH feeling like a ChatHub while preserving overload protection.
- **D-02:** The assessment is **assigned/active, never chosen**. The client never sees a menu of assessments or templates. For v1.1 this can be seed-controlled or "single active version" controlled; planner decides the thinnest safe mechanism, but the client UI presents only the assigned/current assessment.
- **D-03:** Seed content must stay neutral and intake-oriented: language goals, work context, confidence, availability, preferences. Do not encode unvalidated pedagogy, placement scoring, lesson assignment, or a learning plan recommendation in this phase.

### Question bank and versioning
- **D-04:** Use a versioned question-bank model. The database must distinguish an assessment identity from immutable published versions and ordered question configs. Once any client response references a version, that version and its question configs become immutable by trigger or equivalent DB guard.
- **D-05:** Every response pins both the client and the exact assessment version. The response record must be able to tell "which version did this client see?" without looking at mutable current config.
- **D-06:** Config is the source of truth for rendering. The UI must not switch on hard-coded question ids or copy. It may switch on the six answer type discriminants only.
- **D-07:** Config validation is two-layered: zod v4 in `apps/web` for app/runtime parsing and `pg_jsonschema` CHECK constraints in Supabase so malformed config cannot persist. Keep zod out of `packages/core`; shared structural TypeScript contracts may live in `packages/core` if useful, but runtime zod schemas stay in the web/Supabase command layer.

### Shared renderer and answer semantics
- **D-08:** Build the reusable renderer/validator here, because Phase 6 Tracker Engine must reuse it. The shared surface should be field-config driven, not onboarding-content driven: a field config plus current answer value produces the correct input UI, validation result, and normalized answer payload.
- **D-09:** The renderer must support all six answer types from config alone:
  - `single_select`: one option, answer chips/radio-like buttons.
  - `multi_select`: multiple option chips with a clear selected shape/weight, not color alone.
  - `scale`: bounded discrete steps with plain labels, never score-like copy.
  - `short_text`: one-line text input.
  - `long_text`: textarea-style response.
  - `boolean`: yes/no-style binary control with calm labels.
- **D-10:** Selection controls can save and advance without adding a separate "Submit" button when that keeps one action on screen. Text controls should provide one explicit primary action such as `Save answer` or `Continue`, with autosave preserving draft text before navigation.
- **D-11:** Progress is bounded and visual only. A subtle label like "Question 2 of 7" is acceptable as orientation, but no grade, score, percentage-as-judgement, level result, or completion shaming.

### Autosave, resume, and submit
- **D-12:** Autosave is a real persistence guarantee, not just local React state. Draft answers should persist to Supabase while the client is authenticated, and a refresh or route leave must reopen at the last in-progress or first unanswered question.
- **D-13:** Copy for unfinished work is reassuring: "We saved your answers. You can continue when you are ready." Avoid "incomplete", "failed", "missed", or any copy that reads as blame.
- **D-14:** Final submit/finalize must make the response reviewable by the coach while preserving pinned-version history. If a draft/final split is needed, planner decides the exact state model, but the coach review must distinguish partial from submitted calmly.
- **D-15:** Write paths may use Next.js Server Actions or Supabase RPC/Edge Functions as the planner judges safest. No Express/Node API. Any write path must run under the authenticated user's authorization boundary, keep RLS meaningful, and avoid service-role shortcuts except migration/seed work.

### Coach review
- **D-16:** Coach review is read-only. The coach sees the assigned client's onboarding answers grouped in assessment order with the original question prompt/options from the pinned version. There is no scoring, editing, grading, or assessment authoring.
- **D-17:** Coach access is RLS-scoped through the existing assignment relationship (`private.is_coach_of`). An unassigned coach must see a calm empty/not-found state with no cross-client leak.
- **D-18:** Partial and empty states are calm: "No onboarding answers yet" / "Answers are still in progress" style copy. Do not add a button that asks the coach or client to choose a plan.

### Design line
- **D-19:** The `sketch-findings-fish` skill has been loaded for this phase from `.claude/skills/sketch-findings-fish/SKILL.md`. Downstream UI agents must read the onboarding, states, chat, responsive, and theme references before building/reviewing UI.
- **D-20:** Client UI must use existing tokens and base components: no raw hex, no `tailwind.config.js`, no sub-56px controls, visible labels/accessible names, visible focus, reduced-motion support, and at most one `Button variant="primary"` per view.
- **D-21:** Reuse the existing chat component library where it fits, especially bubbles, message list/container anatomy, skeleton/empty state patterns, and answer-chip styling. Do not copy sketch HTML verbatim.

### Verification and gates
- **D-22:** `pnpm verify:rls` must be extended with onboarding response and question-bank assertions: self response ownership, assigned coach read, unassigned coach denial, cross-client denial, and immutable used-version protection.
- **D-23:** Automated checks must prove config validation from both sides: invalid question config is rejected by app zod parsing and by the `pg_jsonschema` database CHECK.
- **D-24:** Phase verification must include at least one save/resume proof: answer a question, reload or revisit, and confirm the same draft/position returns from persisted data rather than local-only state.

### the agent's Discretion
- Exact table names, migration number, foreign-key topology, enum/check strategy for answer types, whether finalization uses a status column or separate submit timestamp, and whether the write path is Server Action, RPC, or Edge Function.
- Exact route names as long as the flows are clear and assigned: likely client onboarding entry from `/home` and coach review from `/coach/clients/[id]`.
- Exact seed questions, provided they are neutral intake questions and do not imply a placement score or learning-plan recommendation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` section "Phase 5: Data-Driven Onboarding" - phase goal, dependency on Phase 4, success criteria, and UI hint.
- `.planning/REQUIREMENTS.md` - ONBD-01 through ONBD-07 plus XC-01, XC-02, and XC-03.
- `.planning/PROJECT.md` sections "Current Milestone: v1.1 The Coaching Loop", "Constraints", and "Key Decisions" - build order, coach-first boundaries, seed-only assignment, and zod/pg_jsonschema decision.
- `.planning/STATE.md` sections "v1.1 roadmap decisions" and "Accumulated Context" - onboarding precedes tracker so the shared renderer is built once; zod v4 is the one net-new runtime dependency.

### Prior dependency context
- `.planning/phases/04-client-profiles/04-CONTEXT.md` - client profile identity, safe write discipline, coach/client relationship patterns.
- `.planning/phases/04-client-profiles/04-VERIFICATION.md` - Phase 4 evidence and the current `human_needed` visual checks; use Phase 4 code as dependency evidence, but do not mark Phase 4 complete from this phase.
- `supabase/migrations/0007_client_profiles.sql` - latest schema/RLS/trigger style to extend.
- `scripts/verify-rls.ts` - live assertion harness to extend.

### Product and UI rules
- `AGENTS.md` - product rule, build order, API boundary, design tokens, one-primary-action rule, assigned-never-chosen rule.
- `docs/ui-ux-agent-guidelines.md` - mandatory UI/UX reference for every user-facing screen.
- `.claude/skills/sketch-findings-fish/SKILL.md` - validated design direction and source index.
- `.claude/skills/sketch-findings-fish/references/onboarding.md` - onboarding as warm in-chat conversation; scroll form rejected.
- `.claude/skills/sketch-findings-fish/references/states.md` - calm empty/loading/error and lifecycle states.
- `.claude/skills/sketch-findings-fish/references/chat.md` - chat surface conventions to reuse carefully.
- `.claude/skills/sketch-findings-fish/references/responsive.md` - responsive web/container-query direction.
- `.claude/skills/sketch-findings-fish/references/theme-and-tokens.md` - monochrome token/a11y constraints.
- `.planning/sketches/006-onboarding/README.md` - source sketch decision and variants.

### Existing implementation patterns
- `apps/web/components/ui/` - Button, Input, Card, Progress, Alert base components; extend/reuse.
- `apps/web/components/chat/` - chat primitives for conversational onboarding anatomy.
- `apps/web/app/(authenticated)/home/page.tsx` - likely client entry point.
- `apps/web/app/(authenticated)/coach/page.tsx` and `apps/web/components/coach/client-list.tsx` - coach client list and detail navigation pattern.
- `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` - read-only assigned-client route pattern and calm not-found state.
- `apps/web/lib/auth/server.ts` - server-side `getUser()`/role re-check and data access functions.
- `apps/web/lib/services/supabase/core.ts` - repository/service patterns for Supabase reads/writes.
- `apps/web/lib/validation/profile.ts` - current zod-in-web-only validation pattern.
- `packages/supabase/src/database.generated.ts` and `packages/supabase/src/database.types.ts` - generated DB type exports to update after migrations.
- `scripts/seed.ts` - seed/backfill pattern for active onboarding assessment and response fixtures.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/ui/button`, `input`, `card`, `progress`, `alert` - existing calm, token-backed controls. `Progress` already documents "visual, never a grade."
- `apps/web/components/chat/*` - reusable conversation anatomy: `MessageList`, `Message`, `Bubble`, `ChatContainer`, `Skeleton`, `EmptyState`, and related story/test patterns.
- `apps/web/lib/auth/server.ts` - Phase 4 data access pattern for authenticated Server Components and calm denied states.
- `apps/web/lib/services/supabase/core.ts` - repository abstraction to extend for onboarding tables instead of scattering Supabase calls.
- `scripts/verify-rls.ts` - live local Supabase/PostgREST assertion harness; Phase 4 added the pattern this phase should mirror.
- `supabase/migrations/0004_rls_helpers.sql` - `private.is_coach_of` and `private.is_client_of` authorization helpers.
- `supabase/migrations/0007_client_profiles.sql` - newest migration style for RLS, grants, triggers, and client-row provisioning.

### Established Patterns
- RLS is the read authorization boundary; app code does not hand-filter as a substitute for policy.
- Server Components re-check role and user identity per route.
- Next.js Server Actions are acceptable for safe authenticated web writes when they validate input and use the user-scoped Supabase path.
- Column grants plus triggers are used for protected field integrity.
- zod belongs in `apps/web`; `packages/core` stays dependency-light for shared structural contracts.
- Design tests often grep for `variant="primary"` counts to enforce one primary action.
- UI state changes must not resize controls or shift layouts.

### Integration Points
- Client Home -> onboarding entry when an active assessment exists.
- Onboarding route/component -> Supabase question version + current response state.
- Shared field renderer -> Phase 5 onboarding now, Phase 6 tracker later.
- Coach client detail/list -> read-only onboarding answers for assigned clients.
- Seed + migrations + generated database types + RLS verification all need to advance together.

</code_context>

<specifics>
## Specific Ideas

- Use language like "Let's get your coach a little context" and "We saved your answer" rather than "assessment incomplete" or "required."
- The system prompt can say "Question 2 of 7" as orientation, paired with a visual `Progress` bar or milestone strip, but never show a score or percentage.
- Answer chips should be large, keyboard reachable buttons with selected state by border/fill/weight, not color alone.
- For text answers, preserve typed draft before navigation and render a calm notice if save fails.
- Coach review should show original prompt text and the client's answer, not normalized scoring output.

</specifics>

<deferred>
## Deferred Ideas

- Branching/skip logic for onboarding config (`ONBD-B01`) - future trigger: a validated assessment actually needs conditional paths.
- Coach authoring/publishing UI for assessments - future phase; this phase can seed the active version.
- Assessment recommendations, placement levels, or automatic plan generation - blocked by coach-first validation and out of scope.
- Assignment UI - still seed-only in v1.1.
- Tracker-specific templates and cadence UI - Phase 6 reuses this renderer but owns tracker domain behavior.
- Progress tab or rewards - do not ship until coach validation.

</deferred>

---

*Phase: 5-Data-Driven Onboarding*
*Context gathered: 2026-07-05*
