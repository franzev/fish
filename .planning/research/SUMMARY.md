# Project Research Summary

**Project:** FISH — v1.1 "The Coaching Loop"
**Domain:** Coach-led English-learning ChatHub for neurodivergent (ADHD) professionals — RLS-first Supabase data-model milestone (client profiles · data-driven onboarding · config-driven tracker engine · persistent 1-on-1 chat) built ON a shipped v1.0 auth/RLS foundation
**Researched:** 2026-07-04
**Confidence:** HIGH

## Executive Summary

v1.1 adds four foundations to an already-shipped app (v1.0 Monochrome Foundations: auth, roles, `profiles` + `coach_clients`, recursion-safe RLS, the UI kit, and a *presentational-only* chat kit). It is overwhelmingly a **data-model + integration** milestone, not an ecosystem-selection one: the hard infrastructure problems (SSR client factories, a DI service seam, a `ServiceResult` envelope, a raw-Deno Edge Function convention, and a live `pnpm verify:rls` harness) were solved in v1.0. v1.1 is mostly **new tables + new RLS + new service methods + new routes**, plus making the `send-message` stub real. All four researchers converged hard, and their conclusions are load-bearing — this summary preserves them without dilution.

The recommended approach is disciplined and repetitive by design. **Exactly one new runtime dependency ships this milestone: `zod` v4** (in `apps/web` and the Edge Function, never in `packages/core`, which stays pure-type). Everything else the four features need is already in the box: Supabase migrations/RLS, Edge Functions for command writes, direct RLS reads for queries, and `pg_jsonschema` (ships with Supabase, zero npm cost) as a DB-level backstop for authored config. The build order is a real dependency chain, not a preference: **profiles → onboarding → tracker → chat**, and within each feature **schema (+RLS +verify:rls assertions) before service repo before UI**. Two architectural economies are non-negotiable and must be sequenced correctly: (1) onboarding and the tracker engine **share one config-driven, one-field-at-a-time renderer + validator** over a common answer-type vocabulary — build it during onboarding so the tracker reuses it; any ordering that duplicates it is waste. (2) **Versioning discipline is designed once and applied twice** (immutable-once-used freeze trigger; responses/entries pin to their `version_id`).

The key risks are all authorization and data-integrity risks that v1.0's role guard does **not** cover, plus the ND-UX floor. Two new escalation surfaces demand explicit gates: (a) new *protected* profile columns (`english_level`, consent) are writable until a freeze trigger / column-grant is added — RLS `WITH CHECK` proves row ownership, never column immutability; (b) the real `send-message` Edge Function uses the service-role key, which **bypasses RLS**, so it must re-derive the actor from the JWT and re-check conversation membership before the insert. Chat is the highest-risk feature (real Edge Function: JWT verify + membership + zod body + idempotency + in-memory rate limit + calm errors + read-state) and warrants the most planning/test budget — split chat-schema from chat-route. Idempotency + optimistic reconciliation share one key (`clientRequestId` → partial UNIQUE index + `on conflict do nothing` server-side + replace-by-key client-side). Every schema step is gated by an extended `pnpm verify:rls` (including a **cross-client denial** assertion) + `pnpm build`. And on every client-facing screen, FISH's choice-removal law overrides the general ND "give lots of customization" advice: default to OS/system, expose ≤3 a11y toggles, never a settings buffet; load the `sketch-findings-fish` skill before building any client UI.

## Key Findings

### Recommended Stack

See [STACK.md](./STACK.md). The v1.0 stack (Next.js 16.2.9 / React 19.2.7 / Tailwind v4.3.1 / `@supabase/supabase-js` 2.110.0 + `@supabase/ssr` 0.12.0 / Deno Edge Functions / pnpm 11.7.0 / Vitest 4.1.9) is **locked and not re-litigated**. v1.1 adds exactly one runtime dependency and keeps everything else as an existing pattern rather than a new tool. The reason the list is this short is structural — the codebase already models direct-RLS-read vs Edge-Function-command-write, and forms already use the shipped client-component + service-layer idiom (do **not** introduce Server Actions / `useActionState` wholesale; it would fork the form idiom and add a third write path).

**Core technologies:**
- **zod v4.4.3** (`apps/web` + Edge Function via `npm:zod@4`; NOT `packages/core`): one declarative schema, authored once, shared across web + Edge + tests, with the inferred TS type as a free byproduct — the difference between a maintainable data-driven engine and a pile of nested `if`s for question-bank/tracker config, onboarding answers, and the `SendMessageCommand` body. `packages/core` stays zero-runtime-dependency pure-type (native Swift/Kotlin consumers depend on this); derive core types via `z.infer` in the consumers.
- **pg_jsonschema** (Postgres extension, ships with Supabase, enabled in a migration — zero supply-chain cost): a `CHECK (jsonb_matches_schema(...))` backstop on the authored-rarely tracker-config / question-bank JSONB columns so malformed config is *impossible to persist* even via seed/`psql`. Zod is the primary developer-facing validator; `pg_jsonschema` is the un-bypassable belt-and-suspenders for config specifically.
- **@playwright/test 1.61.1** (dev-only, recommended, scoping-flexible): add when the first live chat route lands; scope to the three inherently cross-role/multi-step flows (signup→onboarding→resume, client-send→coach-read, tracker-assign→client-render). Keep the suite tiny; do not let it become a second component-test framework.
- **Idempotency = pure SQL, no library:** store `client_request_id` on `messages` with a partial `UNIQUE (conversation_id, client_request_id) WHERE client_request_id IS NOT NULL`; `INSERT … ON CONFLICT DO NOTHING RETURNING *` then re-select. Preserves message immutability *and* idempotency; races-safe at the DB. **Rate limiting = in-memory token-bucket keyed by JWT `user_id` now; do NOT add Upstash/Redis** (documented as the known scale-milestone upgrade path).
- **Explicitly NOT this milestone:** client-state libraries (Redux/Zustand/Jotai), React Query/SWR (no realtime/polling yet), an ORM (breaks RLS-first), a Node/Express API (barred), `react-hook-form`, any realtime/websocket/presence lib, Storage. Leave the `SupabaseRealtimeService`/`SupabaseStorageService` seams stubbed.

### Expected Features

See [FEATURES.md](./FEATURES.md). Four sub-landscapes, all scored against the six design rules. The single reusable cross-cutting rule: **for a client-facing screen, if a feature adds a choice, a score, a streak, or a scold, it is an anti-feature in FISH regardless of how standard it is elsewhere.** Coach-facing surfaces MAY use lists/filters/detail tables — the choice-removal law is a *client-facing* law.

**Must have (table stakes for v1.1 launch):**
- **Client profiles** — identity (display name, locale, timezone prefilled from browser), goal/role text, English level *as data not a grade*, consent *fields only* (boolean + timestamp + version), ≤3 a11y toggles defaulting to system; client edits SAFE fields only; coach reads assigned client's profile read-only.
- **Data-driven onboarding** — questions read from the DB (never hard-coded); linear one-question-at-a-time renderer over 6 answer types (single-select, multi-select, scale, short text, long text, boolean); autosave + resume; versioned/immutable assessment; calm **no-score** progress; coach reads submitted answers.
- **Tracker engine** — config schema (fields + daily/weekly cadence + versioning), seed/Edge-Function assignment (assigned-never-chosen), single-tracker client renderer + entry save, coach entry review, visual progress (no grade, no reward UI yet).
- **Real 1-on-1 chat** — conversation/message/read-state schema + RLS, real idempotent `send-message` Edge Function replacing the stub, web chat route on live data with optimistic `sending → sent / failed` lifecycle + calm empty/oversized/failed handling, coach reads the same thread. Text-only.

**Should have (differentiators / fast-follow with clear triggers):**
- One shared field-renderer/validator across onboarding + tracker (build onboarding first).
- Idempotent send that survives retry/double-tap; draft preserved on failed send (minimal slice of the offline queue).
- Onboarding branching/skip-logic (a complexity magnet — ship **linear first**, branching as fast-follow, expressed in config not UI code, with a publish-time cycle/dead-end validator).

**Defer (v1.x / v2+, several explicitly out of scope):**
- Reward-only progress / any gamification — **BLOCKED BY coach validation**; never a resetting streak; schema must not bake in streak-count semantics.
- Realtime / presence / typing / read-receipts; attachments / voice — kit components ship dormant.
- AI replies / auto-correction; full privacy tooling (export/delete/retention/audit — v1.1 is consent *fields* only); assignment UI (seed-only this milestone); native, analytics, notifications, admin UI.

### Architecture Approach

See [ARCHITECTURE.md](./ARCHITECTURE.md). Twelve new tables across six numbered migrations (`0007`–`0012`), each protected by RLS that **composes the two existing definer helpers** (`private.is_coach_of` / `private.is_client_of`) and never re-derives coach↔client. Reads go direct through RLS (no manual id-filtering); *command* writes (send message, assign tracker) go through Edge Functions; *safe* writes (profile safe-fields, onboarding answers, tracker entries) go direct under RLS `WITH CHECK`. Client profile is a **new 1:1 `client_profiles` table**, not an extension of the security-sensitive `profiles` row. Chat promotes the hand-written `LegacyChatContracts` into real tables and deletes the legacy block at `0012`.

**Major components:**
1. **RLS helpers + policies** — the sole authorization primitive; every new policy composes `is_coach_of`/`is_client_of`; unassigned denial is automatic (default-deny). Add one new `is_conversation_member` definer helper for chat. Every policy-referenced column MUST be indexed.
2. **Direct-read / direct-safe-write service repos** (`apps/web/lib/services`) — profiles, assessments, onboarding, trackers, conversations, messages; UI never imports Supabase directly (boundary test enforced).
3. **Edge Function command writes** — real `send-message` (JWT verify → membership check → idempotent insert) replacing the stub, and new `assign-tracker` (coach/seed-authorized, sets `coach_id`/`version_id` server-side from the active config, never from the body).
4. **`packages/core` contracts** (pure TS) — new `profile.ts`, `onboarding.ts`, `tracker.ts` (with pure resolvers: `nextQuestion`, `validateEntry`); extend `chat.ts` with read-state. `packages/supabase` regenerates types per migration and adds `*Row` aliases.
5. **`verify-rls.ts` as the release gate** — grows per table with self / assigned-coach / unassigned-denial / **cross-client denial** / field-protection / idempotency assertions.

Four load-bearing patterns applied throughout: (1) compose the existing helpers, never invent auth; (2) safe/protected column split enforced by a `BEFORE UPDATE` freeze trigger (RLS can't compare a value to its own previous value); (3) version-pin on write + freeze-a-used-version trigger; (4) idempotent immutable message insert via a DB unique constraint (not app/function memory).

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md). Priority order: (1) data leak across coach↔client, (2) role/field escalation, (3) duplicate/lost messages, (4) silent design-rule violation.

1. **RLS recursion / SQL-function inlining** — reuse the v1.0 definer helpers; every new helper keeps `security definer` + `set search_path = ''` (load-bearing for anti-inlining, not just security) + `stable` + `private` schema; extend `verify:rls` per table.
2. **Profile column escalation** — `WITH CHECK` guards the *row*, not the *columns*; the v1.0 `role` guard covers only `role`. Freeze every new protected column (`english_level`, consent) with a `BEFORE UPDATE` trigger AND prefer column-level GRANTs (`revoke update … grant update (safe cols only)`); test each column.
3. **Service-role send bypasses RLS** — the real `send-message` inserts with the service-role key, which turns RLS *off*; it MUST derive `sender_id`/`sender_role` from the verified JWT (`getUser()`) and re-check conversation membership before the insert. Never trust body-supplied actor ids.
4. **Duplicate messages on retry** — `clientRequestId` exists in the contract but is unenforced; add the partial unique index + `on conflict do nothing` + return-existing; the web client generates the id once and reuses it on retry. One key kills both server duplicates and (via replace-by-key) UI duplicates.
5. **Mutating in-use versions / bad branching** — enforce immutable-once-used by trigger; pin `version_id` on responses/assignments/entries; validate the branch graph at publish time (reject cycles/dead-ends/dangling targets); model "no active assessment / no assigned tracker / already completed" as calm first-class screens.
6. **`getSession()` for authorization + unguarded Server Actions/Edge Functions** — always `getUser()`/`getClaims()` (add a grep tripwire); every write path re-auths and re-authorizes independently of any page guard.
7. **ND-UX floor regressions** — lost work on refresh/nav (autosave onboarding, persist chat draft, tracker entry draft), choice overload (no picker/menu/gallery; one primary action per view), grades/scores/streaks (visual progress only; no resetting streak), and layout shift (reserve space, overlay notices) — verified on throttled/mobile, not just local.

## Implications for Roadmap

Based on research, the suggested phase structure follows the discovered dependency chain **profiles → onboarding → tracker → chat**, with **schema (+RLS +verify:rls) before service before UI** inside each feature, and every schema step gated by the extended `pnpm verify:rls` + `pnpm build`. Chat is split into schema and route because it is the highest-risk feature.

### Phase 1: Client Profiles
**Rationale:** Profiles underpin everything else — onboarding responses, tracker assignments, and chat all hang off the client identity + the shipped `coach_clients` pair. It also introduces the safe/protected split (freeze trigger + column GRANTs) that the whole milestone's write-safety discipline depends on.
**Delivers:** `0007_client_profiles.sql` (new 1:1 table, safe/protected columns, RLS self read/update + coach read, `freeze_protected_profile_fields` trigger); `packages/core/profile.ts`; `clientProfiles` repo; `verify:rls` self/coach/unassigned/protected-field assertions; web profile read/edit (one primary action) + coach client-detail read view.
**Addresses (FEATURES.md):** client profiles table stakes; ≤3 a11y toggles defaulting to system; consent as fields only.
**Avoids (PITFALLS.md):** #2 profile column escalation (the #2 escalation surface — gate on a proven column-scoped write), #1 RLS recursion, #5/#6 auth on new authed reads/writes, #12 choice overload on the edit screen.

### Phase 2: Data-Driven Onboarding (build the shared renderer HERE)
**Rationale:** Onboarding must come before the tracker because both need the same config-driven, one-field-at-a-time renderer + validator over the same answer-type vocabulary; building it here lets the tracker reuse it. This is also where versioning discipline is designed *once*. Ship **linear first**; branching is a fast-follow.
**Delivers:** `0008_assessment_bank.sql` + `0009_onboarding_responses.sql` (versioned bank, `freeze_used_version` trigger, resume pointer, response/item RLS); `onboarding.ts` contracts + `nextQuestion` resolver; `assessments`/`onboarding` repos; seed one assessment version; web one-question-at-a-time renderer with autosave + resume + calm no-score progress; coach onboarding review.
**Uses (STACK.md):** zod (answer validation, config parse) + `pg_jsonschema` backstop on the question-bank config; the shipped client-component + service-layer form idiom (no Server Actions).
**Implements (ARCHITECTURE.md):** Pattern 3 (version-pin + freeze-used-version); direct safe write for responses under RLS `WITH CHECK`.
**Avoids (PITFALLS.md):** #7 in-place version mutation / branching loops, #11 lost work (autosave + resume into the pinned version), #13 grades/scores, #1 RLS recursion.

### Phase 3: Tracker Engine (reuse the Phase-2 renderer/validator)
**Rationale:** Assignment presupposes the coach↔client pair; entries presuppose an assignment which pins a config version. The renderer + validator + versioning discipline already exist from Phase 2 — this phase reuses them, avoiding the flagged duplication.
**Delivers:** `0010_tracker_configs.sql` (+ `pg_jsonschema` CHECK on config) + `0011_tracker_assignments.sql` (version-pinned assignments + entries, RLS); `assign-tracker` Edge Function (coach/seed-authorized, seed-invocable — no assignment UI); `tracker.ts` + `validateEntry`; seed one config + assignment; web single-tracker renderer + entry save (visual progress, no grade) + entry-draft persistence; coach entry review.
**Uses (STACK.md):** zod field-type allowlist + `pg_jsonschema`; idempotent/safe write split (assignment = Edge Function, entry = direct).
**Implements (ARCHITECTURE.md):** Pattern 2/3 reused; the assigned-never-chosen command boundary.
**Avoids (PITFALLS.md):** #8 config injection / unvalidated render (closed field-type allowlist, entry checked against the pinned version), #12 tracker picker, #13 adherence %/streaks (schema stores entries, not a fragile streak integer), #7 version mismatch.

### Phase 4a: Chat Schema (split from the route — highest risk)
**Rationale:** Chat carries the most backend risk and is parallelizable (depends only on the shipped pair + new tables). Splitting schema from route lets the schema — including realtime-readiness — land and be RLS-verified before the Edge Function and UI complexity.
**Delivers:** `0012_chat.sql` (conversations/messages/message_reads; partial idempotency unique index; `(conversation_id, created_at, id)` composite index; `is_conversation_member` helper + members-read policy; immutability = no update/delete grant); remove `LegacyChatContracts`, add `*Row` aliases; `verify:rls` member-read (client & coach) / outsider deny / immutability / duplicate-`clientRequestId`-idempotent assertions; seed one conversation per pair.
**Avoids (PITFALLS.md):** #1 recursion, #4 duplicate messages (DB constraint), #9 ordering/pagination (stable composite cursor + index from day one). Realtime stays OUT but the schema is realtime-READY (stable ordering, `message_reads` cursor modeled now).

### Phase 4b: Real Chat Route + send-message Edge Function
**Rationale:** With the schema verified, wire the real Edge Function and the live UI. This is the #1 data-leak + #3 message-integrity surface — highest-priority test coverage in the milestone.
**Delivers:** real `send-message` (JWT verify → `getUser()` trusted `sender_id` → membership check → zod body → idempotent insert → calm 400/403 copy → in-memory rate limit); `conversations`/`messages` repos + `message_reads` upsert; web chat route on live data with optimistic `sending → sent / failed`, reconcile-by-`clientRequestId`, draft-persist on failure; coach reads the same thread. Realtime seam left unwired.
**Uses (STACK.md):** zod body schema, in-memory token bucket, idempotency constraint.
**Avoids (PITFALLS.md):** #3 service-role bypass (two clients: user-JWT to authorize, service-role only for the vetted insert), #10 empty/oversized + optimistic reconciliation, #11 lost draft, #14 layout shift on optimistic send.

### Phase Ordering Rationale

- **Dependencies are real, not preference:** onboarding responses FK the question-bank; tracker entries FK an assignment which FKs a config version; a conversation presupposes the coach↔client pair; the shared renderer means onboarding must precede the tracker.
- **Grouping by architecture:** schema→service→UI within each feature keeps the `verify:rls` release gate executable at every step and prevents forward-referencing a not-yet-created relation (the v1.0 `0004` lesson).
- **Pitfall-driven splits:** chat is split (4a/4b) because it concentrates the top-priority data-leak, idempotency, and integrity pitfalls; the profile safe/protected split is front-loaded because it establishes the write-safety discipline every later phase reuses.
- **Chat can run in parallel** with onboarding/tracker if capacity allows (it depends only on the shipped pair), but its planning/test budget should be the largest.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase <N>`):
- **Phase 4a/4b (Chat):** highest complexity — real Edge Function combining JWT verify + membership + zod + idempotency + in-memory rate limit + optimistic reconciliation (React 19 `useOptimistic` has a known rollback edge case, issue #31967) + keyset pagination + realtime-ready ordering. Warrants the most planning/test budget.
- **Phase 2 (Onboarding), only if branching is pulled forward:** the branch-graph validator (cycle/dead-end/dangling detection) and version-change-mid-session semantics are the non-trivial parts; linear-first keeps this shallow.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Profiles):** directly extends the shipped `prevent_role_self_escalation` freeze-trigger idiom + the existing form pattern; well-trodden.
- **Phase 3 (Tracker):** once Phase 2 ships the shared renderer/validator + versioning, the tracker is largely a reuse + one new Edge Function (`assign-tracker`) mirroring `send-message`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry (zod 4.4.3, Playwright 1.61.1); additions weighed against locked v1.0 stack + governing laws; official Supabase/Zod/Next docs. One net-new dep. |
| Features | HIGH (MEDIUM only where general ND UX conflicts) | Internal design law + prior GAP analysis + external ND/UX best practice converge; MEDIUM only where external sources assume choice-rich UX that FISH deliberately inverts (resolved in FISH's favor). |
| Architecture | HIGH | Grounded in the live `0001`–`0006` migrations, the send-message stub, the service layer, and `packages/core`/`packages/supabase`; external claims (RLS-scoped Edge client, INSERT `WITH CHECK`, index-policy-columns, DB-unique idempotency, `pg_jsonschema`) verified against official Supabase docs. |
| Pitfalls | HIGH (MEDIUM for React 19 `useOptimistic` edge cases) | RLS/SSR-auth/idempotency cross-verified against official Supabase/Postgres/Next docs; ND-UX already codified in AGENTS.md + v1.0 decisions; MEDIUM only for `useOptimistic` reconciliation (docs + open React issue #31967). |

**Overall confidence:** HIGH

### Gaps to Address

- **`useOptimistic` reconciliation (React 19):** documented rollback edge case (issue #31967). Handle in Phase 4b — reconcile by `clientRequestId`, run the mutation inside a transition/form action, verify no duplicate/vanishing bubble on a real (throttled) send; this is where the one Playwright flow earns its keep.
- **Edge Function cold-start / bundle size (`zod/mini`):** unresolved until measured. Start with standard `zod` for readability; switch the Edge Function to `zod/mini` only if a cold-start measurement justifies it — flag as a measurement task in Phase 4b, not a design decision now.
- **In-memory rate limiting is per-isolate only:** good enough against a runaway single client this milestone; Upstash/Redis is the documented scale-milestone upgrade path. Note it so no one re-derives it and no one adds Redis prematurely.
- **Branching config validation (if pulled into v1.1):** the cycle/dead-end/dangling-target validator is the non-trivial slice; default is linear-first with branching as a fast-follow. Decide the scope explicitly during Phase 2 planning.
- **Consent scope creep:** v1.1 is consent *fields only* (boolean + timestamp + version). Guard against pulling export/delete/retention tooling into scope — the privacy milestone precedes public launch, not this one.

## Sources

### Primary (HIGH confidence)
- Existing FISH codebase — migrations `0001`–`0006`, `scripts/seed.ts`, `scripts/verify-rls.ts`, `supabase/functions/send-message/index.ts`, `packages/core/src/chat.ts` (`clientRequestId`) + `package.json` (zero runtime deps), `packages/supabase/src/database.types.ts` (`LegacyChatContracts`), `apps/web/lib/services/**`, `apps/web/app/login/login-form.tsx`, `supabase/config.toml` (`verify_jwt = true`), `apps/web/components/chat/**` — the live contract being extended.
- FISH internal — `.planning/PROJECT.md`, `AGENTS.md`, `docs/ui-ux-agent-guidelines.md`, `docs/product-gap-analysis-2026-07-04.md` (GAP-005..GAP-022), `.planning/sketches/` winners, `v1.0-MILESTONE-AUDIT.md`.
- Supabase Docs — Securing Edge Functions (`verify_jwt`, RLS-scoped client, service-role bypasses RLS), Row Level Security (INSERT `WITH CHECK`, wrap `auth.uid()` in `select`, index policy columns), pg_jsonschema, RLS Performance & Best Practices, Postgres-changes realtime (respects RLS).
- npm registry — verified versions: zod 4.4.3, @playwright/test 1.61.1, vitest 4.1.9, supabase-js 2.110.0, ssr 0.12.0. zod.dev/v4 + zod.dev/packages/mini.
- PostgreSQL Docs — Inlining of SQL functions (`SECURITY DEFINER` + `SET search_path` both block inlining → v1.0 helpers safe), Row Security Policies (`WITH CHECK` cannot express column-immutability).
- Next.js Docs — Authentication (Server Actions are public POST endpoints), caching authed data (`cookies()` makes components dynamic).

### Secondary (MEDIUM confidence)
- React Docs — `useOptimistic` (reconcile on transition completion); rollback edge case: React issue #31967.
- Marmelab — idempotent, cold-start-safe Edge Function guidance; Supabase UI Realtime Chat (realtime-ready design, what to defer).
- Idempotency/ordering — client-generated idempotency key (UUIDv7/ULID); composite `(created_at, id)` ordering to break ties.
- ND/UX — UX Design Institute / Appcues (progressive disclosure, bare-minimum-per-step), Know About Accessibility / accessiBe / a11y-blog (default-to-system vs the customization buffet), SurveyJS/QuestionPro (branch types), Speexx/Preply/Co-Active (coach-led intake, CEFR as data).

### Tertiary (LOW confidence)
- None load-bearing. Where external ND sources recommend choice-rich customization, FISH's product law overrides — flagged inline rather than followed.

---
*Research completed: 2026-07-04*
*Ready for roadmap: yes*
