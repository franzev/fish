# Phase 5: Data-Driven Onboarding - Research

**Researched:** 2026-07-05  
**Domain:** Supabase/Postgres versioned config + RLS; Next.js App Router Server Actions; config-driven React field rendering  
**Confidence:** HIGH for codebase fit and phase constraints; MEDIUM for external docs fetched through official docs via websearch fallback.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- Branching/skip logic for onboarding config (`ONBD-B01`) - future trigger: a validated assessment actually needs conditional paths.
- Coach authoring/publishing UI for assessments - future phase; this phase can seed the active version.
- Assessment recommendations, placement levels, or automatic plan generation - blocked by coach-first validation and out of scope.
- Assignment UI - still seed-only in v1.1.
- Tracker-specific templates and cadence UI - Phase 6 reuses this renderer but owns tracker domain behavior.
- Progress tab or rewards - do not ship until coach validation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONBD-01 | Client sees DB-read onboarding questions one at a time with one primary action | Data model, service reads, `/onboarding` route, UI contract, one-primary tests. `[VERIFIED: codebase + 05-CONTEXT.md]` |
| ONBD-02 | Renderer supports six config-driven answer types | Shared field config/answer contracts, zod discriminated unions, component test map. `[CITED: https://zod.dev/api]` |
| ONBD-03 | Answers autosave and resume exactly where stopped without scolding | `onboarding_attempts` + `onboarding_answers`, command RPC/Server Action transaction, save/resume verification. `[VERIFIED: codebase + 05-CONTEXT.md]` |
| ONBD-04 | Calm visual step progress with no score/grade/judgement percentage | Existing `Progress` component and UI-SPEC copy rules. `[VERIFIED: apps/web/components/ui/progress/progress.tsx]` |
| ONBD-05 | Assessment is versioned, immutable once answered, responses pin exact version | Version tables, freeze trigger, snapshot answer metadata, RLS test. `[CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]` |
| ONBD-06 | Active onboarding is assigned/current, never chosen by client | Single active published version loaded server-side; no picker route or client-visible list. `[VERIFIED: 05-CONTEXT.md]` |
| ONBD-07 | Assigned coach can review answers read-only, RLS-scoped, calm empty/partial | Coach detail extension, `private.is_coach_of`, denial tests. `[VERIFIED: supabase/migrations/0004_rls_helpers.sql]` |
</phase_requirements>

## Summary

Phase 5 should be planned as a thin vertical slice across four boundaries: immutable Supabase config tables, user-scoped command writes, a shared config-field renderer, and two route surfaces (`/onboarding` for clients and `/coach/clients/[id]` for coach review). The codebase already has the right patterns: migrations with RLS and grants, `scripts/verify-rls.ts` real sign-in assertions, generated Supabase DB types, `ServiceResult` repositories, Server Actions that re-check `getUser()`, and token-backed UI primitives. `[VERIFIED: codebase]`

The strongest data-model recommendation is to separate assessment identity, immutable published versions, ordered question configs, client attempts, and per-question answers. Each answer should store `assessment_version_id` through the attempt and also snapshot the question key/order/prompt/type/config used at save time, so coach review never depends on mutable "current" config. Published versions and questions must be blocked from update/delete once an attempt references the version. `[VERIFIED: 05-CONTEXT.md]`

The save path should be transactional. Use a Next.js Server Action as the web entry point, validate with zod v4, then call a database command function for `save_onboarding_answer` / `finalize_onboarding_attempt` so attempt creation, answer upsert, and resume-position update happen atomically. The function must derive the client from `auth.uid()`, never accept `client_id` from the client, and `verify:rls` must exercise it through real authenticated sessions. Supabase docs state Server Actions are reachable POST entry points and must be treated as untrusted; Supabase docs also say exposed functions require explicit `EXECUTE` control. `[CITED: https://nextjs.org/docs/app/guides/server-actions]` `[CITED: https://supabase.com/docs/guides/api/securing-your-api]`

**Primary recommendation:** Add `supabase/migrations/0008_onboarding.sql`, `packages/core/src/fields.ts`, `apps/web/lib/validation/onboarding.ts`, `apps/web/components/fields/*`, `apps/web/app/(authenticated)/onboarding/*`, and coach review extensions under `/coach/clients/[id]`; gate the phase on `pnpm build`, `pnpm verify:rls`, targeted Vitest files, and one persisted save/resume proof. `[VERIFIED: codebase]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Versioned question bank | Database / Storage | API / Backend | Version immutability and malformed-config rejection must hold even if app code is bypassed. `[CITED: https://supabase.com/docs/guides/database/extensions/pg_jsonschema]` |
| Active/assigned assessment selection | API / Backend | Database / Storage | Client route should load one active version, never expose a picker; DB can enforce only one active published version. `[VERIFIED: 05-CONTEXT.md]` |
| Autosave answer transaction | API / Backend | Database / Storage | Web action authenticates and validates; DB command atomically upserts answer and resume state. `[CITED: https://nextjs.org/docs/app/guides/server-actions]` |
| RLS authorization | Database / Storage | API / Backend | Existing convention makes RLS the read boundary; app guards improve UX but never replace policies. `[VERIFIED: supabase/migrations/0004_rls_helpers.sql]` |
| Shared renderer | Browser / Client | API / Backend | Rendering, keyboard interaction, and draft retention are client concerns; server validates the same config/answer shape. `[VERIFIED: apps/web/components/ui]` |
| Coach read-only review | Database / Storage | Frontend Server (SSR) | `private.is_coach_of` scopes rows; Server Component renders calm not-found/partial states. `[VERIFIED: apps/web/app/(authenticated)/coach/clients/[id]/page.tsx]` |

## Project Constraints (from AGENTS.md)

| Directive | Planning Impact |
|-----------|-----------------|
| Use pnpm workspaces; do not use npm for installs. `[VERIFIED: AGENTS.md]` | Any dependency command must be `pnpm`, but this phase should not add npm packages. |
| Web is Next.js App Router + React + TypeScript in `apps/web`. `[VERIFIED: AGENTS.md]` | Routes/components/actions live under `apps/web/app` and `apps/web/components`. |
| Tailwind v4 is CSS-first; no `tailwind.config.js`. `[VERIFIED: AGENTS.md]` | Use tokens from `apps/web/app/globals.css`; do not add Tailwind config. |
| Supabase is the one backend; no separate auth provider or Express API. `[VERIFIED: AGENTS.md]` | Use Supabase RLS/RPC/Edge Functions and Next Server Actions only. |
| Coach-first, code-second; no unvalidated pedagogy. `[VERIFIED: AGENTS.md]` | Seed questions must be neutral intake only; no scoring or recommendation logic. |
| One primary action per screen and assigned-never-chosen. `[VERIFIED: AGENTS.md]` | `/onboarding` presents one active version/question; no assessment menu. |
| Controls are at least 56px and copy never scolds. `[VERIFIED: AGENTS.md]` | Field renderer chips/buttons/input rows must meet `--size-control`; errors use notice tone/copy. |
| Keep contracts in `packages/core`; Supabase contracts in `packages/supabase`. `[VERIFIED: AGENTS.md]` | Shared field structural types belong in core; generated DB aliases in supabase. |

## Current Codebase Map

| Area | Existing Files | Phase 5 Changes |
|------|----------------|-----------------|
| Supabase schema/RLS | `supabase/migrations/0004_rls_helpers.sql`, `0007_client_profiles.sql` | Add `0008_onboarding.sql` with `pg_jsonschema`, version tables, RLS policies, command functions, immutability triggers. `[VERIFIED: codebase]` |
| RLS verification | `scripts/verify-rls.ts` | Add sign-in assertions for client self-write/read, assigned-coach read, unassigned/cross-client denial, malformed config rejection, used-version immutability. `[VERIFIED: codebase]` |
| Seed data | `scripts/seed.ts` | Seed one active published onboarding assessment version with neutral intake questions for all six answer types; optionally seed a partial attempt fixture. `[VERIFIED: codebase]` |
| Generated DB types | `packages/supabase/src/database.generated.ts`, `database.types.ts` | Regenerate after migration; add aliases such as `OnboardingAttemptRow`, `OnboardingAnswerRow`, `OnboardingQuestionRow`. `[VERIFIED: codebase]` |
| Shared contracts | `packages/core/src/index.ts` | Add `fields.ts` with structural TypeScript types only; no zod import. `[VERIFIED: AGENTS.md]` |
| Runtime validation | `apps/web/lib/validation/profile.ts` | Add `apps/web/lib/validation/onboarding.ts` with zod v4 discriminated unions and answer validators. `[CITED: https://zod.dev/api]` |
| Supabase services | `apps/web/lib/services/supabase/{types,core}.ts` | Add `OnboardingRepository` methods for active version read, attempt read, coach review read, save/finalize commands. `[VERIFIED: codebase]` |
| Server data access | `apps/web/lib/auth/server.ts` | Add `getClientOnboardingData()` and `getCoachClientOnboardingReviewData(clientId)`, mirroring existing wrong-door/id guard style. `[VERIFIED: codebase]` |
| Client route | `apps/web/app/(authenticated)/home/page.tsx` | Link/CTA to `/onboarding` when active onboarding exists; do not add a picker. `[VERIFIED: 05-UI-SPEC.md]` |
| Onboarding route | none | Add `apps/web/app/(authenticated)/onboarding/page.tsx`, `actions.ts`, and client component for one-question chat flow. `[ASSUMED]` |
| Shared renderer | no generic field renderer yet | Add `apps/web/components/fields/FieldRenderer.tsx`, `AnswerChip.tsx`, `TextAreaField.tsx`, type-specific tests. `[VERIFIED: 05-CONTEXT.md]` |
| Coach review | `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` | Extend detail page or child component with read-only onboarding review section. `[VERIFIED: codebase]` |
| UI primitives | `apps/web/components/ui/{button,input,card,progress,alert}` and `components/chat/*` | Reuse `Button`, `Input`, `Progress`, `Alert`, `Bubble`, `MessageList`, `Skeleton`, `EmptyState`; add only missing textarea/chip composition. `[VERIFIED: codebase]` |
| Tests | Vitest in `apps/web/vitest.config.ts` | Add unit/component tests for validation, renderer, actions, one-primary rule, save/resume data shaping. `[VERIFIED: codebase]` |

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Next.js | installed `16.2.9`; npm latest `16.2.10` modified 2026-07-04 `[VERIFIED: npm registry]` | App Router Server Components and Server Actions | Already project stack; official docs define Server Action security and forms behavior. `[CITED: https://nextjs.org/docs/app/guides/server-actions]` |
| React | installed `19.2.7` `[VERIFIED: package.json]` | Client components, `useActionState` | Already project stack; used by existing Server Action form in Phase 4. `[VERIFIED: codebase]` |
| Supabase JS | `2.110.0`, npm latest `2.110.0` modified 2026-06-30 `[VERIFIED: npm registry]` | Typed PostgREST/RPC/auth client | Existing service layer is built on it; docs cover `upsert`, `update`, `maybeSingle`, and TS support. `[CITED: https://supabase.com/docs/reference/javascript/typescript-support]` |
| `@supabase/ssr` | `0.12.0`, npm latest `0.12.0` modified 2026-06-09 `[VERIFIED: npm registry]` | Cookie-aware server Supabase client | Existing `createServerSupabaseServices()` uses it. `[VERIFIED: codebase]` |
| zod | `4.4.3`, npm latest `4.4.3` modified 2026-05-04 `[VERIFIED: npm registry]` | App/runtime config and answer validation in `apps/web` | Locked by project state; zod v4 supports discriminated unions and `safeParse`. `[CITED: https://zod.dev/api]` |
| `pg_jsonschema` | Supabase Postgres extension `[CITED: https://supabase.com/docs/guides/database/extensions/pg_jsonschema]` | DB backstop for JSON question config | Required by D-07/D-23; validates `jsonb` with `jsonb_matches_schema`. `[CITED: https://supabase.com/docs/guides/database/extensions/pg_jsonschema]` |

### Supporting
| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Vitest | `4.1.9`, npm latest `4.1.9` modified 2026-06-15 `[VERIFIED: npm registry]` | Unit/component tests | Existing `apps/web/vitest.config.ts`; use for validator/renderer/action tests. |
| Testing Library React | `16.3.2`, npm latest `16.3.2` modified 2026-01-19 `[VERIFIED: npm registry]` | Component interaction tests | Existing pattern for UI components. `[VERIFIED: codebase]` |
| Supabase CLI | local `2.109.0` `[VERIFIED: command]` | Migration apply/status/type generation | Required for DB reset and local RLS verification. |
| Docker | local `29.6.1` `[VERIFIED: command]` | Local Supabase stack | Supabase status is available and local services respond. `[VERIFIED: command]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next Server Action + DB command function | Direct browser Supabase writes | Direct writes expose more low-level table mutation surface and make zod validation harder to centralize. `[VERIFIED: 05-CONTEXT.md]` |
| DB command function for save transaction | Multiple sequential Server Action Supabase calls | Sequential calls are simpler but not atomic for attempt creation + answer upsert + resume pointer. `[ASSUMED]` |
| Versioned normalized tables | One mutable JSON blob per assessment | Blob is faster to seed but harder to freeze, diff, query, and review in order. `[ASSUMED]` |
| Shared field renderer in `components/fields` | Onboarding-only renderer | Phase 6 must reuse it; onboarding-specific branching would create duplicate tracker work. `[VERIFIED: 05-CONTEXT.md]` |

**Installation:**
```bash
# No new npm packages required. zod is already installed in apps/web.
pnpm install
```

## Package Legitimacy Audit

No new external npm packages should be installed for Phase 5. Existing stack packages were checked because the planner will reuse them. `[VERIFIED: package.json + npm registry]`

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `next` | npm | latest published within days | 38.6M/wk | `github.com/vercel/next.js` | SUS (`too-new`) | Existing dependency only; do not upgrade in this phase without checkpoint |
| `@supabase/supabase-js` | npm | latest published within days | 21.5M/wk | `github.com/supabase/supabase-js` | SUS (`too-new`) | Existing dependency; approved for reuse |
| `@supabase/ssr` | npm | recent publish | 4.5M/wk | `github.com/supabase/ssr` | SUS (`too-new`) | Existing dependency; approved for reuse |
| `zod` | npm | established | 213.7M/wk | `github.com/colinhacks/zod` | OK | Existing dependency; approved for reuse |
| `vitest` | npm | recent publish | 68.6M/wk | `github.com/vitest-dev/vitest` | SUS (`too-new`) | Existing dev dependency; approved for reuse |
| `@testing-library/react` | npm | established | 43.4M/wk | `github.com/testing-library/react-testing-library` | OK | Existing dev dependency; approved for reuse |

**Packages removed due to [SLOP] verdict:** none.  
**Packages flagged as suspicious [SUS]:** `next`, `@supabase/supabase-js`, `@supabase/ssr`, `vitest` were flagged only by package-legitimacy recency heuristics; no postinstall scripts were reported for checked packages. Planner should not add or upgrade them in this phase without a human checkpoint. `[VERIFIED: package-legitimacy seam]`

## Recommended Data Model

### Tables

| Table | Purpose | Key Columns / Constraints |
|-------|---------|---------------------------|
| `onboarding_assessments` | Stable identity for the assessment family | `id uuid pk`, `slug text unique`, `title text`, `created_at`; service-role writes only. `[ASSUMED]` |
| `onboarding_assessment_versions` | Immutable published versions; one active published version | `id uuid pk`, `assessment_id fk`, `version_number int`, `status text check ('draft','published','retired')`, `is_active boolean`, `published_at`, unique `(assessment_id, version_number)`, partial unique active index. `[ASSUMED]` |
| `onboarding_questions` | Ordered config fields for a version | `id uuid pk`, `version_id fk`, `question_key text`, `order_index int`, `prompt text`, `answer_type text`, `config jsonb`, unique `(version_id, question_key)`, unique `(version_id, order_index)`, `jsonb_matches_schema(...)` CHECK. `[CITED: https://supabase.com/docs/guides/database/extensions/pg_jsonschema]` |
| `onboarding_attempts` | One client's pinned run through a version | `id uuid pk`, `client_id uuid references profiles`, `version_id uuid`, `status text check ('in_progress','submitted')`, `current_question_id uuid`, `started_at`, `submitted_at`, `updated_at`, unique `(client_id, version_id)`. `[ASSUMED]` |
| `onboarding_answers` | One persisted answer/draft per attempt/question | `id uuid pk`, `attempt_id fk`, `question_id fk`, `assessment_version_id uuid`, `question_key`, `question_order`, `question_prompt`, `answer_type`, `question_config jsonb`, `answer jsonb`, `answered_at`, `updated_at`, unique `(attempt_id, question_id)`. `[ASSUMED]` |

### Version and Snapshot Rules

- `onboarding_attempts.version_id` is the canonical "which version did this client see?" pin. `[VERIFIED: 05-CONTEXT.md]`
- `onboarding_answers` should denormalize `assessment_version_id` plus question snapshot columns so coach review can render original prompt/options without joining mutable current config. This is defense-in-depth even though published versions are immutable. `[ASSUMED]`
- Add a trigger that rejects update/delete to `onboarding_assessment_versions` and `onboarding_questions` when `exists (select 1 from onboarding_attempts where version_id = old.id)`. `[VERIFIED: 05-CONTEXT.md]`
- Draft versions may be editable by service role/seed before use, but no coach authoring UI ships in this phase. `[VERIFIED: 05-CONTEXT.md]`

### Answer Payload Shape

Store normalized answers as `jsonb` with a type-specific wrapper, not raw strings/arrays. This keeps Phase 6 tracker reuse straightforward. `[ASSUMED]`

```ts
type FieldAnswer =
  | { type: "single_select"; optionId: string }
  | { type: "multi_select"; optionIds: string[] }
  | { type: "scale"; value: string }
  | { type: "short_text"; value: string }
  | { type: "long_text"; value: string }
  | { type: "boolean"; value: boolean };
```

## RLS and Authorization Strategy

| Surface | Policy / Grant |
|---------|----------------|
| Question bank reads | Authenticated clients may read active published version/questions; clients/coaches may read pinned versions/questions referenced by their own/assigned attempts. `[ASSUMED]` |
| Question bank writes | Service role only via migrations/seed; no authenticated insert/update/delete grants. `[VERIFIED: 05-CONTEXT.md]` |
| Attempt reads | Client reads own attempts; assigned coach reads attempts where `private.is_coach_of(client_id)`; default deny returns zero rows. `[VERIFIED: supabase/migrations/0004_rls_helpers.sql]` |
| Attempt writes | Client writes only via `save_onboarding_answer`/`finalize_onboarding_attempt`; functions derive `client_id = auth.uid()` and never accept a client id. `[CITED: https://nextjs.org/docs/app/guides/server-actions]` |
| Answer reads | Client reads own answers through attempt ownership; assigned coach reads through `private.is_coach_of(attempt.client_id)`. `[VERIFIED: codebase pattern]` |
| Answer writes | Client can upsert own answer for an in-progress attempt only; no writes after `submitted_at` is set. `[ASSUMED]` |
| Coach review | Read-only; no update/delete grants/policies for coach. `[VERIFIED: 05-CONTEXT.md]` |

Implementation note: if RPC functions are exposed through the Data API, explicitly grant `EXECUTE` only to `authenticated` and revoke public defaults; Supabase official docs state functions need execute-level access control and security-definer functions need careful review. `[CITED: https://supabase.com/docs/guides/api/securing-your-api]`

## Architecture Patterns

### System Architecture Diagram

```text
Client /home
  └─ Server Component loads client profile + active onboarding summary
     └─ If active assessment exists: one quiet "Start/Continue onboarding" primary
        └─ /onboarding Server Component
           ├─ getUser() + role guard
           ├─ SELECT active published assessment version + ordered questions
           ├─ SELECT own in-progress/submitted attempt + answers
           └─ Render OnboardingConversation client component

OnboardingConversation
  ├─ Shows prior saved answers as "mine" bubbles
  ├─ Shows one active question as system/received bubble
  ├─ Renders FieldRenderer(config, value, validation)
  ├─ Selection fields: save and advance after persisted/sending state
  └─ Text/multi fields: local draft + one primary "Save answer"

Save answer Server Action
  ├─ Re-check getUser()
  ├─ zod parses field config + answer payload
  ├─ Calls DB command save_onboarding_answer(answer, question_id)
  │  ├─ Derives client_id from auth.uid()
  │  ├─ Creates/gets attempt for active version
  │  ├─ Upserts answer with question snapshot metadata
  │  └─ Updates current_question_id / updated_at in one transaction
  └─ Returns persisted attempt state for resume UI

Finalize Server Action
  ├─ Re-check getUser()
  ├─ Calls finalize_onboarding_attempt()
  └─ Sets submitted_at/status and renders completion copy

Coach /coach/clients/[id]
  └─ Existing Server Component role/id guard
     ├─ SELECT client profile via RLS
     ├─ SELECT assigned client's onboarding attempt/answers via RLS
     └─ Render read-only ordered prompts + answers, partial/empty states
```

### Recommended Project Structure

```text
supabase/migrations/
└── 0008_onboarding.sql

packages/core/src/
├── fields.ts
└── onboarding.ts

packages/supabase/src/
└── database.types.ts

apps/web/lib/
├── validation/onboarding.ts
├── services/supabase/types.ts
├── services/supabase/core.ts
└── auth/server.ts

apps/web/components/
├── fields/
│   ├── field-renderer.tsx
│   ├── answer-chip.tsx
│   ├── text-area-field.tsx
│   └── field-renderer.test.tsx
└── onboarding/
    ├── onboarding-conversation.tsx
    ├── autosave-status.tsx
    ├── coach-onboarding-review.tsx
    └── onboarding-conversation.test.tsx

apps/web/app/(authenticated)/
├── onboarding/
│   ├── page.tsx
│   └── actions.ts
└── coach/clients/[id]/page.tsx
```

### Pattern 1: Immutable Versioned Config

**What:** Separate identity/version/question tables; only published versions are readable by clients; used versions/questions are DB-frozen. `[VERIFIED: 05-CONTEXT.md]`

**When to use:** Any config whose saved responses must remain interpretable after future config changes. `[VERIFIED: ROADMAP.md]`

```sql
create extension if not exists pg_jsonschema with schema extensions;

create table public.onboarding_assessment_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.onboarding_assessments(id) on delete cascade,
  version_number integer not null,
  status text not null check (status in ('draft', 'published', 'retired')),
  is_active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assessment_id, version_number)
);

create unique index onboarding_one_active_version
  on public.onboarding_assessment_versions (assessment_id)
  where is_active;
```

### Pattern 2: Field Config Discriminated Union

**What:** One shared config union keyed by `type`, with type-specific options/constraints. Zod official docs describe `z.discriminatedUnion()` for object schemas that share a discriminator key and `safeParse()` for non-throwing validation. `[CITED: https://zod.dev/api]` `[CITED: https://zod.dev/basics]`

```ts
import { z } from "zod";

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const fieldConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single_select"), label: z.string(), options: z.array(optionSchema).min(2) }),
  z.object({ type: z.literal("multi_select"), label: z.string(), options: z.array(optionSchema).min(2), min: z.number().int().min(0).optional(), max: z.number().int().positive().optional() }),
  z.object({ type: z.literal("scale"), label: z.string(), steps: z.array(optionSchema).min(2) }),
  z.object({ type: z.literal("short_text"), label: z.string(), maxLength: z.number().int().positive().max(240).default(120) }),
  z.object({ type: z.literal("long_text"), label: z.string(), maxLength: z.number().int().positive().max(2000).default(1000) }),
  z.object({ type: z.literal("boolean"), label: z.string(), trueLabel: z.string(), falseLabel: z.string() }),
]);
```

### Pattern 3: Transactional Save Command

**What:** Server Action handles HTTP/form boundary and zod parsing; database command handles atomic attempt/answer/resume mutation. `[CITED: https://nextjs.org/docs/app/guides/server-actions]`

**When to use:** Every answer save and final submit. Do not scatter separate client-created attempt rows and answer writes. `[ASSUMED]`

```ts
"use server";

export async function saveOnboardingAnswerAction(input: unknown) {
  const services = await createServerSupabaseServices();
  const user = await services.auth.getCurrentUser();
  if (!user.ok || !user.data) return { ok: false, notice: "Your session expired. Sign in again to save." };

  const parsed = saveAnswerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const result = await services.database.onboarding.saveAnswer(parsed.data);
  if (!result.ok) return { ok: false, notice: "That did not save yet. Keep this open and try again." };
  return { ok: true, data: result.data };
}
```

### Anti-Patterns to Avoid

- **Hard-coded question IDs in React:** breaks DB-driven requirement; switch only on `config.type`. `[VERIFIED: 05-CONTEXT.md]`
- **Client-visible assessment picker:** violates assigned-never-chosen. `[VERIFIED: AGENTS.md]`
- **Multiple primary buttons on text/multi-select screens:** violates UI-SPEC; use one `Save answer`. `[VERIFIED: 05-UI-SPEC.md]`
- **Direct service-role writes from app runtime:** bypasses the user boundary; keep service role for migrations/seed. `[VERIFIED: 05-CONTEXT.md]`
- **Mutable published config:** breaks pinned interpretation; freeze used versions/questions. `[VERIFIED: 05-CONTEXT.md]`

## Config-Driven Renderer / Validator Strategy

| Type | Renderer | Validation | Phase 6 Reuse Note |
|------|----------|------------|--------------------|
| `single_select` | Large radio-like `AnswerChip` group, save/advance on selection | `optionId` must exist in config options | Same chip group can render tracker mood/context fields. `[ASSUMED]` |
| `multi_select` | Toggle chips plus one `Save answer` primary | selected option ids subset of config; min/max if present | Tracker checklists reuse this directly. `[ASSUMED]` |
| `scale` | Bounded segmented/chip steps with plain labels | selected `value` must match configured step id | Avoid numeric scoring labels in both onboarding/tracker. `[VERIFIED: 05-UI-SPEC.md]` |
| `short_text` | Base `Input` with visible label | trim, min if required, max length | Reuse for tracker free-text fields. `[VERIFIED: apps/web/components/ui/input/input.tsx]` |
| `long_text` | New textarea styled like `Input` | trim, max length, preserved draft | Reuse for reflection tracker notes. `[ASSUMED]` |
| `boolean` | Two large binary chips | boolean payload only; labels from config | Reuse for yes/no tracker prompts. `[ASSUMED]` |

Keep runtime zod schemas in `apps/web/lib/validation/onboarding.ts`; keep dependency-free structural types in `packages/core/src/fields.ts`. `[VERIFIED: AGENTS.md]`

## Autosave / Resume Strategy

- Use persisted Supabase data as source of truth for resume; local React state is only an in-flight/failure buffer. `[VERIFIED: 05-CONTEXT.md]`
- Selection fields save immediately and may advance after the save reaches `saving` or `saved`; text and multi-select fields use one explicit primary `Save answer`. `[VERIFIED: 05-UI-SPEC.md]`
- For text input, keep local draft on every keystroke, debounce optional background saves only after pause/blur, and never dispatch one Server Action per keystroke. `[ASSUMED]`
- Store `current_question_id` on `onboarding_attempts`; on load, resume to that question if status is `in_progress`, otherwise first unanswered ordered question. `[ASSUMED]`
- Include a monotonic `client_save_seq` or `updated_at` check in action responses so stale save responses cannot roll back a newer local draft. `[ASSUMED]`
- On `navigator.onLine === false` or network failure, keep the draft local, show `You are offline. We will save when you are back.`, and provide a focusable retry. `[VERIFIED: 05-UI-SPEC.md]`
- Finalization sets `status='submitted'` and `submitted_at`; answers remain read-only after submit. `[VERIFIED: 05-CONTEXT.md]`

## UI Implementation Notes

- The client surface is a warm chat-like assessment, not a scroll form. Use `Bubble`, `MessageList`, `Skeleton`, and `EmptyState` where their anatomy fits, but do not copy sketch HTML. `[VERIFIED: .claude/skills/sketch-findings-fish/references/onboarding.md]`
- The onboarding panel maximum width should be about 640px, matching `ChatContainer`; mobile remains single-column. `[VERIFIED: 05-UI-SPEC.md]`
- Use `Progress` with a quiet label like `Question 2 of 7`; do not show scores, grades, levels, or judgement percentages. `[VERIFIED: apps/web/components/ui/progress/progress.tsx]`
- Reserve a stable 14px autosave status row near the answer controls so `Saving...` / `Saved` / retry copy does not shift layout. `[VERIFIED: 05-UI-SPEC.md]`
- Answer chips must be real buttons/radios/checkbox-equivalent controls, at least `var(--size-control)` tall, selected by border/fill/weight/shape not color alone. `[VERIFIED: docs/ui-ux-agent-guidelines.md]`
- Use exact approved copy from `05-UI-SPEC.md`, including `Let's get your coach a little context`, `Save answer`, `Share with coach`, and `We saved your answers. You can continue when you are ready.` `[VERIFIED: 05-UI-SPEC.md]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config validation | Ad hoc `if (type === ...)` checks scattered in components | zod discriminated union + DB `jsonb_matches_schema` CHECK | Same shape must protect app runtime and persisted config. `[CITED: https://zod.dev/api]` |
| Authorization | App-only `if coachId === ...` filters | RLS policies using `auth.uid()` and `private.is_coach_of` | Direct Supabase/API calls bypass app filters. `[CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]` |
| Autosave transaction | Multiple unrelated client calls | One save command function invoked by Server Action | Prevents orphan attempts, answer saved without resume pointer, or partial finalization. `[ASSUMED]` |
| UI controls | New bespoke button/input system | Existing `Button`, `Input`, `Progress`, `Alert`, chat primitives | Maintains token/a11y/design-line consistency. `[VERIFIED: codebase]` |
| Assessment assignment UI | Client menu/list of assessments | Seeded single active published version | Assigned-never-chosen and no coach authoring UI in scope. `[VERIFIED: 05-CONTEXT.md]` |

**Key insight:** The hard part is not rendering six fields; it is preserving an exact, RLS-scoped, version-pinned record of what the client saw and saved while keeping the UI calm and resumable. `[VERIFIED: 05-CONTEXT.md]`

## Common Pitfalls

### Pitfall 1: Freezing the wrong layer
**What goes wrong:** Published question rows remain editable because app code avoids editing them, but DB does not block direct updates.  
**Why it happens:** The planner treats seed-only writes as enough.  
**How to avoid:** Add a trigger that rejects update/delete of versions/questions once any attempt references the version; verify through `verify:rls`. `[VERIFIED: 05-CONTEXT.md]`  
**Warning signs:** No explicit test named "used version immutability".

### Pitfall 2: Function endpoints treated as protected by table RLS
**What goes wrong:** RPC/SQL functions are callable too broadly or accept trusted ids from the client.  
**Why it happens:** Supabase docs distinguish table RLS from function execute privileges. `[CITED: https://supabase.com/docs/guides/api/securing-your-api]`  
**How to avoid:** Revoke default function execute where needed, grant only `authenticated`, derive `client_id` from `auth.uid()`, and test with real sessions.  
**Warning signs:** RPC input includes `client_id` or `coach_id`.

### Pitfall 3: Response pins version but not question context
**What goes wrong:** Coach review must join current question config to explain old answers.  
**Why it happens:** Version immutability is assumed but not enough for easy review/debugging.  
**How to avoid:** Snapshot `question_key`, `question_order`, `question_prompt`, `answer_type`, and `question_config` into `onboarding_answers`. `[ASSUMED]`  
**Warning signs:** Coach review query selects only `answer` and current `onboarding_questions.prompt`.

### Pitfall 4: Autosave that is only local
**What goes wrong:** Refresh loses typed text or route returns to the first question.  
**Why it happens:** UI state is mistaken for persistence.  
**How to avoid:** Save text drafts to Supabase on explicit `Save answer` and optionally debounce/blur; reload proof must show persisted data survives. `[VERIFIED: 05-CONTEXT.md]`  
**Warning signs:** No `onboarding_attempts.current_question_id` or equivalent persisted cursor.

### Pitfall 5: Renderer becomes onboarding-specific
**What goes wrong:** Phase 6 tracker reimplements the same six field types.  
**Why it happens:** Components branch on onboarding question ids/copy.  
**How to avoid:** Put field renderer under `components/fields` and pass generic `FieldConfig`, `FieldAnswer`, callbacks, and validation state. `[VERIFIED: 05-CONTEXT.md]`  
**Warning signs:** Component names like `LanguageGoalQuestion` or switch cases on `question_key`.

## Code Examples

### Field Renderer Dispatch

```tsx
export function FieldRenderer(props: FieldRendererProps) {
  switch (props.config.type) {
    case "single_select":
      return <SingleSelectField {...props} />;
    case "multi_select":
      return <MultiSelectField {...props} />;
    case "scale":
      return <ScaleField {...props} />;
    case "short_text":
      return <ShortTextField {...props} />;
    case "long_text":
      return <LongTextField {...props} />;
    case "boolean":
      return <BooleanField {...props} />;
  }
}
```

Source: zod discriminated-union/type narrowing pattern. `[CITED: https://zod.dev/api]`

### Coach Review Query Shape

```ts
const { data, error } = await client
  .from("onboarding_attempts")
  .select("id,status,submitted_at,onboarding_answers(*)")
  .eq("client_id", clientId)
  .order("updated_at", { ascending: false })
  .maybeSingle();
```

Source: Supabase JS `select()` / `maybeSingle()` docs and existing repository pattern. `[CITED: https://supabase.com/docs/reference/javascript/select]` `[CITED: https://supabase.com/docs/reference/javascript/v1/maybesingle]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mutable form definitions in app code | Versioned DB config with immutable published versions | Locked for Phase 5 | Enables DB-driven onboarding and Phase 6 renderer reuse. `[VERIFIED: ROADMAP.md]` |
| zod v3 `message` param examples | zod v4 unified `error` param | zod v4 | Use `{ error: "..." }` in new schemas, matching existing profile schema. `[CITED: https://zod.dev/v4/changelog]` |
| Server Action as trusted internal call | Server Action as untrusted POST entry point | Next.js current docs | Re-check `getUser()` and validate inside every action. `[CITED: https://nextjs.org/docs/app/guides/server-actions]` |

**Deprecated/outdated:**
- Zod v3 examples using `{ message }` for new code; use v4 `{ error }`. `[CITED: https://zod.dev/v4/changelog]`
- Blank spinner-only loading; use skeleton states. `[VERIFIED: .claude/skills/sketch-findings-fish/references/states.md]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact table names `onboarding_assessments`, `onboarding_assessment_versions`, `onboarding_questions`, `onboarding_attempts`, `onboarding_answers` | Data Model | Low; names are planner discretion and can change if topology remains. |
| A2 | DB command functions are the right transaction boundary instead of multiple Server Action calls | Autosave / Architecture | Medium; if team avoids RPC, planner must add explicit compensating transaction strategy. |
| A3 | Snapshotting question metadata into answers is worth the denormalization | Data Model | Low; storage overhead is small, but planner could rely on immutable joins instead. |
| A4 | Optional debounced text autosave is acceptable if explicit Save is still present | Autosave | Low; UI-SPEC requires explicit primary for text, not a specific debounce cadence. |

## Open Questions

1. **Should save/finalize commands be SQL RPC or Supabase Edge Functions?**  
   - What we know: D-15 permits Server Actions or Supabase RPC/Edge Functions; transaction semantics are cleaner in DB. `[VERIFIED: 05-CONTEXT.md]`  
   - What's unclear: Whether the team prefers SQL command functions for Phase 5 or reserves Edge Functions for later command surfaces.  
   - Recommendation: Use SQL command functions called by Server Actions for Phase 5; reserve Edge Functions for Phase 6/8 commands with external logic.

2. **Should coach review live inline on `/coach/clients/[id]` or as a child route?**  
   - What we know: D-16/D-17 require read-only review from assigned-client context. `[VERIFIED: 05-CONTEXT.md]`  
   - What's unclear: Page density after adding profile + onboarding.  
   - Recommendation: Inline section is thinnest; split only if the page becomes too dense.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build, seed, `verify:rls` | ✓ | `v25.9.0` | — |
| pnpm | workspace scripts | ✓ | `11.7.0` | — |
| Supabase CLI | local stack/migrations | ✓ | `2.109.0` | — |
| Docker | local Supabase services | ✓ | `29.6.1` | — |
| Local Supabase stack | RLS verification | ✓ | status responded on `127.0.0.1:54321` | — |
| `apps/web/.env.local` | seed/RLS scripts | ✓ | present | — |
| `psql` | direct extension probing | ✗ | — | Use Supabase migrations/CLI instead. |

**Missing dependencies with no fallback:** none.  
**Missing dependencies with fallback:** `psql` missing; not blocking because migrations and `verify:rls` use Supabase CLI/JS. `[VERIFIED: command]`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.9` + Testing Library + plain Node `scripts/verify-rls.ts` |
| Config file | `apps/web/vitest.config.ts`; RLS harness is `scripts/verify-rls.ts` |
| Quick run command | `pnpm --filter @fish/web test -- --run apps/web/lib/validation/onboarding.test.ts apps/web/components/fields/field-renderer.test.tsx` |
| Full suite command | `pnpm build && pnpm verify:rls` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBD-01 | Questions loaded from DB, one active question, one primary action | integration + component | `pnpm --filter @fish/web test -- --run apps/web/app/(authenticated)/onboarding/page.test.tsx` | ❌ Wave 0 |
| ONBD-02 | Six answer types render and validate from config | unit/component | `pnpm --filter @fish/web test -- --run apps/web/lib/validation/onboarding.test.ts apps/web/components/fields/field-renderer.test.tsx` | ❌ Wave 0 |
| ONBD-03 | Autosave persists and resume returns exact draft/position | RLS/integration/manual proof | `pnpm verify:rls` plus documented reload proof | ❌ Wave 0 |
| ONBD-04 | Visual progress only, no score/grade/judgement | component + grep | `pnpm --filter @fish/web test -- --run apps/web/components/onboarding/onboarding-conversation.test.tsx` | ❌ Wave 0 |
| ONBD-05 | Used version immutable; response pins version | RLS live assertion | `pnpm verify:rls` | ❌ Wave 0 |
| ONBD-06 | Active assessment assigned/current, no picker | route/component | `pnpm --filter @fish/web test -- --run apps/web/app/(authenticated)/home/page.test.tsx` | existing file, needs extension |
| ONBD-07 | Coach reads assigned client's answers; unassigned/cross-client denied | RLS + page test | `pnpm verify:rls` and coach page Vitest | existing coach page test, needs extension |

### Nyquist-Style Validation Dimensions

| Dimension | Evidence Needed |
|-----------|-----------------|
| Data correctness | Seed creates active version/questions; responses pin version/question snapshots; malformed config rejected by zod and DB CHECK. |
| Authorization | Real anon-key sign-ins prove self write/read, assigned-coach read, unassigned denial, cross-client denial, and no post-submit writes. |
| State recovery | Save answer, refresh/revisit, same draft and question position render from Supabase. |
| UI contract | One primary action per view; 56px controls; visual progress only; approved calm copy; no picker/menu. |
| Reuse contract | Field renderer tests prove no onboarding question ids/copy branches are required for six types. |
| Build/release | `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm verify:rls` all green before verification. |

### Sampling Rate
- **Per task commit:** targeted Vitest file + `pnpm --filter @fish/web typecheck`.
- **Per wave merge:** `pnpm build && pnpm verify:rls`.
- **Phase gate:** full build/lint/typecheck/RLS plus save-resume proof from persisted data.

### Wave 0 Gaps
- [ ] `supabase/migrations/0008_onboarding.sql` — schema/RLS/functions/config checks.
- [ ] `apps/web/lib/validation/onboarding.test.ts` — zod config/answer validation.
- [ ] `apps/web/components/fields/field-renderer.test.tsx` — six type render/interactions.
- [ ] `apps/web/components/onboarding/onboarding-conversation.test.tsx` — one active question, status, progress, one primary action.
- [ ] `scripts/verify-rls.ts` onboarding assertion functions.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Server Actions re-check Supabase `getUser()`; no trusted client ids. `[CITED: https://nextjs.org/docs/app/guides/server-actions]` |
| V3 Session Management | yes | Existing `@supabase/ssr` server client and cookie/session pattern. `[VERIFIED: codebase]` |
| V4 Access Control | yes | RLS policies plus `private.is_coach_of`; function execute grants. `[CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]` |
| V5 Input Validation | yes | zod v4 app validation and `pg_jsonschema` DB CHECK. `[CITED: https://zod.dev/api]` `[CITED: https://supabase.com/docs/guides/database/extensions/pg_jsonschema]` |
| V6 Cryptography | no | No custom crypto in scope; rely on Supabase Auth/JWT. `[CITED: https://supabase.com/docs/guides/auth/jwts]` |
| V13 API and Web Service | yes | Server Action/RPC command boundaries treated as untrusted entry points. `[CITED: https://nextjs.org/docs/app/guides/server-actions]` |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client submits `client_id` for another user | Elevation of Privilege | Commands derive client from `auth.uid()` and ignore any client id input. `[VERIFIED: 05-CONTEXT.md]` |
| Unassigned coach guesses client UUID | Information Disclosure | RLS `private.is_coach_of` returns zero rows; page renders same calm unavailable state. `[VERIFIED: apps/web/app/(authenticated)/coach/clients/[id]/page.tsx]` |
| Malformed config causes broken renderer or XSS-like unsafe rendering | Tampering | zod parse before render; DB JSON Schema CHECK; render text as React text, not HTML. `[CITED: https://zod.dev/basics]` |
| Published questions edited after answers exist | Repudiation / Tampering | Freeze trigger on used versions/questions and answer snapshots. `[VERIFIED: 05-CONTEXT.md]` |
| Autosave race overwrites newer local draft | Tampering | Debounce, single in-flight save per field, and monotonic save sequence/stale response discard. `[ASSUMED]` |

## Sources

### Primary (HIGH confidence)
- `AGENTS.md` — stack, design, Supabase boundary, product constraints. `[VERIFIED: codebase]`
- `.planning/phases/05-data-driven-onboarding/05-CONTEXT.md` — locked phase decisions. `[VERIFIED: codebase]`
- `.planning/phases/05-data-driven-onboarding/05-UI-SPEC.md` — approved visual/interaction contract. `[VERIFIED: codebase]`
- `supabase/migrations/0004_rls_helpers.sql`, `0007_client_profiles.sql`, `scripts/verify-rls.ts` — existing RLS/write-safety patterns. `[VERIFIED: codebase]`
- `apps/web/components/ui/*`, `apps/web/components/chat/*`, `apps/web/lib/auth/server.ts`, `apps/web/lib/services/supabase/*` — existing app architecture. `[VERIFIED: codebase]`

### Secondary (MEDIUM confidence)
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API security docs: https://supabase.com/docs/guides/api/securing-your-api
- Supabase pg_jsonschema docs: https://supabase.com/docs/guides/database/extensions/pg_jsonschema
- Supabase JS docs: https://supabase.com/docs/reference/javascript/upsert, https://supabase.com/docs/reference/javascript/update, https://supabase.com/docs/reference/javascript/typescript-support
- Next.js Server Actions docs: https://nextjs.org/docs/app/guides/server-actions
- Next.js Forms docs: https://nextjs.org/docs/app/guides/forms
- Zod docs: https://zod.dev/api, https://zod.dev/basics, https://zod.dev/v4/changelog

### Tertiary (LOW confidence)
- Claims marked `[ASSUMED]` in the Assumptions Log; planner should confirm or adjust during task breakdown.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing package versions and npm registry checked; no new packages recommended.
- Architecture: HIGH — follows existing codebase patterns and locked decisions.
- RLS/security: MEDIUM-HIGH — based on existing verified Phase 4 pattern plus official Supabase docs; exact RPC security mode still needs planner choice.
- UI: HIGH — directly grounded in approved UI-SPEC and sketch references.
- Autosave transaction details: MEDIUM — recommended topology is sound, but exact SQL command function design must be specified in the plan.

**Research date:** 2026-07-05  
**Valid until:** 2026-08-04 for codebase architecture; 2026-07-12 for package/latest-version claims.
