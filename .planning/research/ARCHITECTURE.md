# Architecture Research

**Domain:** RLS-first Supabase data model for a coaching product (profiles, data-driven onboarding, config-driven tracker engine, persistent 1-on-1 chat) built ON an existing v1.0 auth/roles foundation.
**Researched:** 2026-07-04
**Confidence:** HIGH — grounded in the live v0001–v0006 migrations, the send-message stub, the service layer, and `packages/core`/`packages/supabase`; external claims (Edge Function RLS-scoped client, INSERT `WITH CHECK`, index-policy-columns, DB-unique idempotency) verified against official Supabase docs.

This is a **data-model + integration** design, not an ecosystem survey. It answers: what tables to add, how each is protected by RLS reusing `private.is_coach_of` / `private.is_client_of`, which writes go direct vs through an Edge Function, what contracts land in `packages/core`, and the dependency-ordered build sequence.

---

## Standard Architecture

### System Overview (unchanged shape — four new data domains slotted in)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     apps/web  (Next.js 16 App Router)                  │
│  Server Components (RLS reads)          Server Actions / route handlers │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ profile  │ │ onboard  │ │ tracker  │ │  chat    │ │  coach   │     │
│  │  screens │ │ renderer │ │ renderer │ │  thread  │ │  views   │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       └────────────┴──── apps/web/lib/services (DI seam) ──┴──────┐    │
│                        (UI never imports supabase directly)       │    │
├───────────────────────────────────────────────────────────────────┼───┤
│  DIRECT (RLS reads/safe writes)              COMMAND (Edge Fns)    │   │
│  profiles / *_profile / question-bank        send-message (real)  │   │
│  reads · onboarding response upsert ·        assign-tracker (seed)│   │
│  tracker entry insert                        (JWT-verified writes)│   │
├───────────────────────────────────────────────────────────────────────┤
│                     Supabase Postgres  (RLS = sole read authz)         │
│  EXISTING: profiles · coach_clients · private.is_coach_of/is_client_of │
│  NEW:  client_profiles · assessment_versions/questions/options ·       │
│        onboarding_responses/response_items · tracker_configs/versions/ │
│        assignments/entries · conversations · messages · message_reads  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| RLS helpers (`private.is_coach_of` / `is_client_of`) | The **only** authorization primitive; every new policy composes these, never re-derives coach↔client | Existing `SECURITY DEFINER STABLE search_path=''` functions (0004/0006) |
| Direct reads (Server Components) | Authorized reads for profile, question-bank, onboarding responses, tracker config/entries, chat thread — RLS carries the whole burden, **no manual id filtering** | `apps/web/lib/services` repositories over RLS-scoped supabase-js |
| Direct safe writes | Client self-updates that RLS can fully constrain: `client_profiles` safe fields, onboarding response upsert, tracker entry insert | Server Action → service repo → RLS `UPDATE/INSERT ... WITH CHECK` |
| Edge Function command writes | Writes needing server-side authorization/side-effects that RLS alone can't express safely: **sending a message** (idempotency + immutability + `sender_id` trust), **assigning a tracker** (coach-authorized, seed-invocable) | `Deno.serve` with an RLS-scoped client from the caller's `Authorization` header (mirrors existing send-message file) |
| `packages/core` contracts | Pure TS domain types shared by web + Edge Functions (no Supabase/React dep) | Extend `chat.ts`; add `profile.ts`, `onboarding.ts`, `tracker.ts` |
| `packages/supabase` types | `Database` re-export of generated types; row aliases | Regenerate `database.generated.ts` after each migration; add `*Row` aliases in `database.types.ts`; **delete `LegacyChatContracts`** once chat is a real table |

---

## Recommended Project Structure

Additive only — mirrors existing numbering, service, and contract conventions.

```
supabase/migrations/
├── 0007_client_profiles.sql          # client_profiles table + safe/protected split + RLS
├── 0008_assessment_bank.sql          # assessment_versions/questions/options + version-lock trigger
├── 0009_onboarding_responses.sql     # onboarding_responses + response_items + resume + RLS
├── 0010_tracker_configs.sql          # tracker_configs + tracker_config_versions + version-lock
├── 0011_tracker_assignments.sql      # tracker_assignments + tracker_entries + RLS
├── 0012_chat.sql                     # conversations + messages + message_reads + RLS + indexes
supabase/functions/
├── send-message/index.ts             # REPLACE stub: JWT-verified, membership-checked, idempotent insert
└── assign-tracker/index.ts           # NEW: coach/seed-authorized tracker assignment command
packages/core/src/
├── chat.ts                           # EXTEND: add readState + result shapes
├── profile.ts                        # NEW: ClientProfile, safe/protected field split, locale/tz types
├── onboarding.ts                     # NEW: question types, branching, response contracts
├── tracker.ts                        # NEW: TrackerConfig schema, field types, entry contracts
packages/supabase/src/
├── database.types.ts                 # add *Row aliases; remove LegacyChatContracts at 0012
apps/web/lib/services/supabase/
├── core.ts + types.ts                # add repositories: clientProfiles, assessments,
│                                     #   onboarding, trackers, conversations, messages
scripts/
├── seed.ts                           # EXTEND: seed one assessment version, one tracker config+assignment,
│                                     #   one conversation per seeded coach↔client pair
└── verify-rls.ts                     # EXTEND: add per-table self / assigned-coach / unassigned-denial /
                                      #   field-protection assertions (the release gate)
```

### Structure Rationale

- **One migration per feature-table-group, numbered forward.** 0004's HIGH lesson: never forward-reference a relation that does not exist yet. Every new policy that calls `is_coach_of`/`is_client_of` is safe because those helpers already exist from 0004/0006 — but a *table* a policy references must be created in the same or an earlier migration.
- **Schema before UI, per feature, and profiles→onboarding→tracker→chat overall.** Onboarding responses FK the question-bank; tracker entries FK an assignment which FKs a config version; a conversation presupposes the coach↔client pair. The order is a real dependency chain, not a preference.
- **`verify-rls.ts` grows into the milestone's release gate.** v1.0 proved the pattern (8/8 live anon-session assertions). Every new table adds its own self / assigned-coach / unassigned-denial / field-protection block, so the quality gate is executable, not aspirational.

---

## Architectural Patterns

### Pattern 1: Compose the two existing helpers; never invent a new auth mechanism

**What:** Every read/write policy on a new table expresses coach↔client access as `private.is_coach_of(<client_id>)` (I am the assigned coach) or `id/client_id = (select auth.uid())` (I own this row), and for the reverse direction `private.is_client_of(<coach_id>)`. Unassigned denial is automatic: if neither predicate is true, the row is invisible and unwritable — RLS default-denies.

**When to use:** All twelve new tables.

**Trade-offs:** Total consistency and recursion-safety for free (the helpers are `SECURITY DEFINER` and never bare-SELECT the protected table). Cost: every helper call runs a subquery per row, so **every column a policy references must be indexed** (verified best practice) — e.g. `messages.conversation_id`, `tracker_entries.assignment_id`, `onboarding_responses.client_id`.

**Example:**
```sql
-- coach reads an assigned client's profile; unassigned coach sees nothing (default deny)
create policy "coach reads assigned client profile"
  on public.client_profiles for select to authenticated
  using (private.is_coach_of(client_id));

-- client reads own; wrap auth.uid() in a subselect so the optimizer caches it (perf best practice)
create policy "client reads own profile detail"
  on public.client_profiles for select to authenticated
  using (client_id = (select auth.uid()));
```

### Pattern 2: Safe/protected column split enforced by a trigger, not by hoping the UPDATE policy is enough

**What:** A client-editable table exposes a `for update` policy scoped to `client_id = auth.uid()`, but an RLS `WITH CHECK` cannot compare a value to its *own previous value*. So protected fields (anything coach/system-owned: `role`-like fields, `english_level`, consent timestamps set by the system) are frozen by a `BEFORE UPDATE` trigger that raises if a protected column changed and the caller is `authenticated` — exactly the shape of the existing `prevent_role_self_escalation` (0005), including its `when (auth.role() = 'authenticated')` clause so service-role/seed writes still pass.

**When to use:** `client_profiles` (safe: goals, role context, locale, timezone, accessibility prefs; protected: `english_level`, consent metadata). Reused verbatim in spirit for any future "client edits some, coach owns some" table.

**Trade-offs:** Defense-in-depth (policy blocks the wrong *rows*, trigger blocks the wrong *columns*). Cost: one trigger function per protected-column table. This is the established FISH idiom, so it is zero new concept.

**Example:**
```sql
create or replace function public.freeze_protected_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.english_level is distinct from old.english_level
     or new.consent_at is distinct from old.consent_at then
    raise exception 'protected profile field cannot be changed by this caller';
  end if;
  return new;
end; $$;

create trigger freeze_protected_profile_fields_trigger
  before update on public.client_profiles for each row
  when (auth.role() = 'authenticated')   -- service_role / seed bypasses, mirrors 0005
  execute function public.freeze_protected_profile_fields();
```

### Pattern 3: Version-pin on write; freeze a version once it has dependents

**What:** Onboarding and tracker are **data-driven and versioned**. A `*_version` row holds the immutable snapshot (question set / tracker config). Every response or entry stores the `version_id` it was captured against, so later edits to the bank never mutate historical meaning. A `BEFORE UPDATE/DELETE` trigger on a version raises if any dependent response/entry exists — "immutable once used" (GAP-008/GAP-012 acceptance). New content = a new version row, never an in-place edit of a used one.

**When to use:** `assessment_versions`, `tracker_config_versions`.

**Trade-offs:** Historical integrity and safe coach iteration. Cost: content changes cost a new version + (optionally) flipping which version is `active`. Represent "active" as a nullable/boolean on the parent (`assessments.active_version_id`, `tracker_configs.active_version_id`) so exactly one version is live and switching is one UPDATE.

**Example:**
```sql
create or replace function public.freeze_used_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.onboarding_response_items ri where ri.version_id = old.id) then
    raise exception 'assessment version is in use and cannot be changed';
  end if;
  return coalesce(new, old);
end; $$;
```

### Pattern 4: Idempotent, immutable message insert via a DB unique constraint (not app state)

**What:** The real `send-message` Edge Function persists a row. Idempotency is a **`unique (conversation_id, client_request_id)`** constraint: a retried send with the same `clientRequestId` hits `on conflict do nothing` / returns the existing row instead of duplicating. This is cold-start-safe (Supabase explicitly advises "design for short-lived, idempotent operations"), because the durable guarantee lives in Postgres, not in function memory. Messages are immutable: `grant select, insert` only to the relevant roles — **no `update`/`delete` grant** and no UPDATE policy, so a message cannot be edited after insert (GAP-016 acceptance).

**When to use:** `messages` insert path.

**Trade-offs:** Exactly-once semantics under retries with no distributed lock. Cost: the client must generate a stable `clientRequestId` (already in `SendMessageCommand`) per logical send and reuse it on retry — a UI convention, already anticipated by the contract.

**Example:**
```sql
create unique index messages_idempotency_uk
  on public.messages (conversation_id, client_request_id)
  where client_request_id is not null;
-- insert: ... on conflict (conversation_id, client_request_id) do nothing
--         then re-select the row to return it (idempotent read-after-write)
```

---

## The four features — tables, RLS sketches, direct-vs-Edge, contracts

### (a) CLIENT PROFILE — **new `client_profiles` table**, not an extension of `profiles`

**Decision: new table.** `profiles` is the auth-identity row created by the `handle_new_user` trigger and read widely (coach list, chat participant, `is_*` role checks). Bolting rich, client-editable, nullable domain fields onto it would (1) widen the surface of the most security-sensitive table, (2) risk the safe/protected split colliding with the existing `role` guard, and (3) make `select *` reads heavier everywhere. A 1:1 `client_profiles` keyed by the same uuid keeps `profiles` lean and isolates the new safe/protected trigger. This matches the codebase's own instinct (0006 added only `email` to `profiles`, deliberately minimal).

```sql
create table public.client_profiles (
  client_id uuid primary key references public.profiles (id) on delete cascade,
  -- SAFE (client-editable)
  goals text not null default '',
  role_context text not null default '',
  locale text not null default '' ,          -- validated app-side + optional CHECK (see edge cases)
  timezone text not null default '',
  accessibility_prefs jsonb not null default '{}'::jsonb,
  -- PROTECTED (coach/system-owned; frozen from authenticated updates by trigger)
  english_level text check (english_level in ('a1','a2','b1','b2','c1','c2') or english_level is null),
  consent_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.client_profiles enable row level security;
grant select, update on public.client_profiles to authenticated;
grant select, insert, update, delete on public.client_profiles to service_role;
```

RLS sketch (four required cases):

| Case | Policy |
|------|--------|
| **Self read** | `for select using (client_id = (select auth.uid()))` |
| **Self update (safe only)** | `for update using (client_id = (select auth.uid())) with check (client_id = (select auth.uid()))` **+ `freeze_protected_profile_fields` trigger** (Pattern 2) freezes `english_level`/`consent_*` |
| **Assigned-coach read** | `for select using (private.is_coach_of(client_id))` |
| **Unassigned denial** | Automatic — no policy grants an unassigned coach a row; default deny |
| **Role/field protection** | `role` stays on `profiles` (untouched, still guarded by 0005). Protected `client_profiles` fields frozen by trigger, not editable via the self-update policy. |

Row existence: create the `client_profiles` row lazily on first save (Server Action `upsert`) or extend `handle_new_user` to insert an empty row alongside `profiles`. **Recommend lazy upsert** to keep the hardened auth trigger untouched (0002 warns a failing trigger aborts the whole signup transaction).

**Writes:** direct. Self-update is fully expressible in RLS + the freeze trigger; no server-side secret or side-effect is needed. Coach never writes here in v1.1 (protected fields are seed-set; coach-edit is a later milestone).

**`packages/core` contract:** `profile.ts` — `ClientProfile`, `ClientProfileSafeFields` (goals/roleContext/locale/timezone/accessibilityPrefs), `ClientProfileProtectedFields` (englishLevel/consent…), a `CEFRLevel` union, `AccessibilityPrefs` shape. The safe/protected split as *types* keeps the web form honest about what it may submit.

### (b) ONBOARDING — versioned bank + resumable responses

```sql
-- one logical assessment; points at its live version
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  active_version_id uuid,                    -- FK added after versions table exists
  created_at timestamptz not null default now()
);
create table public.assessment_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  version int not null,
  published_at timestamptz,
  unique (assessment_id, version)
);
create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.assessment_versions (id) on delete cascade,
  position int not null,                     -- one-at-a-time ordering
  prompt text not null,
  answer_type text not null check (answer_type in ('single_select','multi_select','short_text','long_text','scale')),
  required boolean not null default true,
  -- branching: which question to go to next per chosen option; null = linear next-by-position
  branch_default_next_id uuid references public.assessment_questions (id),
  unique (version_id, position)
);
create table public.assessment_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  position int not null,
  label text not null,
  value text not null,
  branch_next_id uuid references public.assessment_questions (id),  -- per-option branching
  unique (question_id, position)
);
-- one attempt per client per version; carries resume position + completion
create table public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  version_id uuid not null references public.assessment_versions (id),
  current_question_id uuid references public.assessment_questions (id),  -- resume pointer
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, version_id)             -- one attempt per version = resume, not restart
);
create table public.onboarding_response_items (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.onboarding_responses (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id),
  version_id uuid not null references public.assessment_versions (id),   -- version-pin (freeze trigger reads this)
  answer jsonb not null,                     -- shape depends on answer_type
  answered_at timestamptz not null default now(),
  unique (response_id, question_id)          -- one answer per question; re-answer = upsert
);
```

Immutability / resume / branching:
- **Immutable version once used:** `freeze_used_version` trigger (Pattern 3) on `assessment_versions` (and, if edited, questions/options) raises when a `response_item` references the version. New wording = new version; `assessments.active_version_id` flips to it.
- **Resume:** `onboarding_responses.current_question_id` is the pointer; `unique (client_id, version_id)` means returning resumes the same attempt. Autosave = upsert a `response_item` and advance `current_question_id` (GAP-009).
- **Branching:** represented as FKs — per-option `branch_next_id`, else `question.branch_default_next_id`, else linear next-by-`position`. Loops are a config error to guard in seed/validation (GAP-008 edge case "branching loops"), not in SQL.

RLS sketch:

| Table | Self | Assigned-coach | Unassigned | Notes |
|-------|------|----------------|------------|-------|
| `assessments` / `assessment_versions` / `assessment_questions` / `assessment_options` | any authenticated client may **read the active version** (`for select using true`, or restricted to `active_version_id`) | coach reads same bank | n/a (bank is not client-scoped) | writes **service_role only** (seed/admin) — no authenticated insert policy, mirrors `coach_clients` write posture |
| `onboarding_responses` | `client_id = (select auth.uid())` for select **and** insert/update `with check (client_id = (select auth.uid()))` | `for select using (private.is_coach_of(client_id))` | default deny | coach read-only (GAP-011: "no edits initially") |
| `onboarding_response_items` | via parent: `exists (select 1 from onboarding_responses r where r.id = response_id and r.client_id = (select auth.uid()))` | `... and private.is_coach_of(r.client_id)` | default deny | index `response_id`, `client_id` |

**Writes:** direct. Client owns its responses; RLS + `WITH CHECK` fully constrain the write (client can only write rows where `client_id = auth.uid()`). No Edge Function needed — there is no cross-user authorization or secret. Bank content is seed/service-role only.

**`packages/core` contract:** `onboarding.ts` — `AnswerType` union, `AssessmentQuestion`, `AssessmentOption`, `OnboardingResponse`, `ResponseItem`, `Answer` (discriminated by `AnswerType`), and a `nextQuestion(question, chosenOption)` pure resolver so web + any future client share one branching rule.

### (c) TRACKER — config + version + assignment + entry

```sql
create table public.tracker_configs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  active_version_id uuid,
  created_at timestamptz not null default now()
);
create table public.tracker_config_versions (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.tracker_configs (id) on delete cascade,
  version int not null,
  schema jsonb not null,                     -- field list, cadence, visual-progress spec
  published_at timestamptz,
  unique (config_id, version)
);
-- assigned-never-chosen: coach/seed assigns a config VERSION to a client
create table public.tracker_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  version_id uuid not null references public.tracker_config_versions (id),  -- version PINNED at assignment
  status text not null default 'active' check (status in ('active','archived')),
  assigned_at timestamptz not null default now()
);
create table public.tracker_entries (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.tracker_assignments (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,   -- denormalized for RLS index
  version_id uuid not null references public.tracker_config_versions (id),     -- version-pin echo
  values jsonb not null,                     -- validated against the pinned version.schema
  entered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

Config schema + server-side validation:
- `tracker_config_versions.schema` is jsonb (field types, cadence, progress spec). **Validate server-side** with `pg_jsonschema` as a `CHECK (jsonschema_is_valid(...))` on the version row (verified extension) *or* in the assign/entry Edge Function. Recommend the CHECK constraint for the config itself (config is authored rarely, by seed/admin) and lightweight per-field validation in the entry write path.
- **Version pinned on entries:** `tracker_assignments.version_id` fixes the schema at assignment time; `tracker_entries.version_id` echoes it. A later config version never retro-changes an active assignment's rendering (GAP-014 edge "config version mismatch" is designed out).
- **Immutable used version:** `freeze_used_version` variant on `tracker_config_versions` (raise if an assignment references it) — same Pattern 3.

RLS sketch:

| Table | Self (client) | Assigned-coach | Unassigned | Writes |
|-------|---------------|----------------|------------|--------|
| `tracker_configs` / `tracker_config_versions` | read active/assigned version only | read | n/a | service_role only |
| `tracker_assignments` | `for select using (client_id = (select auth.uid()))` | `for select using (private.is_coach_of(client_id))` | default deny | **Edge Function** (see below) — no authenticated INSERT policy |
| `tracker_entries` | select+insert `with check (client_id = (select auth.uid()) and exists(select 1 from tracker_assignments a where a.id = assignment_id and a.client_id = (select auth.uid()) and a.status='active'))` | `for select using (private.is_coach_of(client_id))` | default deny | **direct** client insert |

**Writes — split:**
- **Assignment → Edge Function `assign-tracker`.** Assigned-never-chosen is a product-critical authorization: only the client's assigned coach (or seed/service-role) may create an assignment, and the write must verify `is_coach_of(client_id)` server-side and set `coach_id`/`version_id` from the *active* config — not from client-supplied input. This is exactly the "assigning clients / command-style writes" the API boundary reserves for Edge Functions. It is seed-invocable (service-role) so v1.1 needs no assignment UI (GAP-013).
- **Entries → direct.** The client writes their own entry; RLS `WITH CHECK` proves ownership *and* an active assignment. No secret, no cross-user authorization → direct insert through the service layer. (Progress is derived/visual, never a stored grade — no score column.)

**`packages/core` contract:** `tracker.ts` — `TrackerFieldType` union, `TrackerFieldSpec`, `TrackerConfigSchema` (fields + cadence + progress spec), `TrackerAssignment`, `TrackerEntry`, and `validateEntry(schema, values)` pure validator shared by the entry write path and the renderer.

### (d) CHAT — persistent now, realtime-READY, subscriptions deferred

**Decision:** promote the hand-written `LegacyChatContracts` (currently in `database.types.ts`, explicitly "NOT YET MIGRATED") into real tables and **delete the legacy block** at 0012. Reuse the existing `ChatConversation`/`ChatMessage` shapes from `chat.ts`.

```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, coach_id)               -- one thread per pair
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  sender_role text not null check (sender_role in ('client','coach')),  -- cached, avoids join on read
  body text not null,
  client_request_id text,                    -- idempotency key (per-conversation unique)
  created_at timestamptz not null default now()
  -- NO updated_at / deleted_at: messages are immutable (no update/delete grant either)
);
create unique index messages_idempotency_uk
  on public.messages (conversation_id, client_request_id) where client_request_id is not null;
-- realtime-ready ordering + read-path indexes:
create index messages_conversation_created_idx on public.messages (conversation_id, created_at, id);
-- per-participant read cursor (not per-message receipts — cheaper, realtime-friendly)
create table public.message_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
```

Why a **participants table is *not* added:** membership is already fully determined by the coach↔client pair via `is_coach_of`/`is_client_of` against `coach_clients`. A separate `conversation_participants` table would duplicate that truth and create a second, drift-prone source of membership. For strict 1-on-1 (the only v1.1 shape), the pair *is* the participant set. (If group chat ever arrives, add participants then — noted as a future boundary.)

RLS sketch:

| Table | Client member | Coach member | Outsider | Writes |
|-------|---------------|--------------|----------|--------|
| `conversations` | `client_id = (select auth.uid())` | `coach_id = (select auth.uid()) and private.is_coach_of(client_id)` | default deny | seed/Edge (created with the pair) |
| `messages` — read | member of the conversation (join to `conversations`, then `client_id=auth.uid()` OR `is_coach_of(client_id)`) | same | default deny | **Edge Function insert** |
| `messages` — write | INSERT policy `with check (sender_id = (select auth.uid()) and <caller is a member of conversation_id>)` — but insert is routed through the Edge Function which additionally trusts `sender_id` from the JWT | | | immutable: **no update/delete grant, no UPDATE policy** |
| `message_reads` | `user_id = (select auth.uid())` select+upsert | same | default deny | direct upsert |

Read-membership predicate (composes the existing helpers, no new mechanism):
```sql
create policy "members read conversation messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.client_id = (select auth.uid()) or private.is_coach_of(c.client_id))
  ));
```

**Send → Edge Function (replaces the stub).** The real `send-message`:
1. Runs under `verify_jwt = true` (already the default; platform validates the JWT before the handler).
2. Creates an RLS-scoped supabase-js client from the caller's `Authorization` header (so the membership read policy still governs what it can see), and calls `auth.getUser()` to get the trusted `sender_id` — never trusts a client-supplied sender.
3. Confirms the caller is a member of `conversationId` (the read policy already enforces this; a `maybeSingle()` on `conversations` returning a row is the check).
4. Inserts with `on conflict (conversation_id, client_request_id) do nothing`, then re-selects and returns the row — **idempotent** under retries (Pattern 4). Keeps the stub's calm 400/405 copy and `chatLimits` check.

This is the canonical "sending messages" Edge-Function case named in the API boundary and matches the existing file's `Deno.serve` + `chatLimits` + calm-error style.

**Realtime-READY, without building subscriptions (the explicit deferral):**
- **Stable ordering:** the `(conversation_id, created_at, id)` index gives a total, tie-broken order so a future subscription/pagination cursor is deterministic — the top pitfall in realtime chat is ordering on `created_at` alone and duplicating/mis-ordering on ties.
- **UUID PK + `client_request_id`:** the same idempotency key that dedupes retries also lets a future optimistic UI reconcile the echoed insert with its local temp message — no schema change needed when realtime lands.
- **Cursor-style `message_reads`** (last-read timestamp per participant) is realtime-friendly (one row per participant, cheap to broadcast) rather than per-message receipts.
- **What to defer:** no `supabase.channel(...)` subscription, no presence, no typing, no `alter publication supabase_realtime add table messages`. The `SupabaseRealtimeService` seam already exists in the service layer (unused) so wiring it later is additive. GAP-019 owns this in the next milestone.

**`packages/core` contract:** extend `chat.ts` — add `MessageReadState { conversationId; userId; lastReadAt }`, keep `SendMessageCommand`/`SendMessageResult`. Remove `LegacyChatContracts` from `database.types.ts` once 0012 lands and add `ConversationRow`/`MessageRow`/`MessageReadRow` aliases from the regenerated types.

---

## Data Flow

### Direct read (Server Component, RLS-scoped)
```
[coach opens client detail]
   ↓
Server Component → services.database.clientProfiles.findByClientId(clientId)
   ↓ (RLS-scoped supabase-js; is_coach_of(client_id) grants the row)
Postgres RLS filters → row or nothing (unassigned coach ⇒ nothing, no error leak)
   ↓
calm profile view  (never a manual .eq() ownership filter — RLS is the boundary)
```

### Direct safe write (client edits profile / answers a question / logs an entry)
```
[client submits] → Server Action → services repo → INSERT/UPDATE ... WITH CHECK
   ↓                                                        ↓
freeze/ownership enforced by policy + trigger      42501 on violation → calm ServiceError
```

### Command write (send message / assign tracker)
```
[client sends] → supabase.functions.invoke('send-message', { conversationId, body, clientRequestId })
   ↓  verify_jwt=true (platform) → RLS-scoped client from Authorization header
   ↓  auth.getUser() → trusted sender_id ; membership confirmed by read policy
   ↓  INSERT ... ON CONFLICT (conversation_id, client_request_id) DO NOTHING → re-select
   ↓  return SendMessageResult { message }   (retry with same clientRequestId ⇒ same row)
[coach] reads the same thread via the members-read policy
```

### Key Data Flows
1. **Version-pinning:** assignment/response captures `version_id` → later bank edits (new version) never mutate history; freeze trigger blocks in-place edits of a used version.
2. **Idempotent send:** UI-stable `clientRequestId` + unique index ⇒ at-most-once persistence across retries and cold starts, no app-side dedupe.

---

## Scaling Considerations

Right-sized for this milestone (single coaching cohort, seeded pairs). Realistic limits, not theoretical.

| Scale | Architecture adjustments |
|-------|--------------------------|
| 0–1k users | As designed. RLS subqueries are cheap given the policy-column indexes below. No pagination needed for onboarding/tracker. |
| 1k–100k users | Paginate the message thread on `(conversation_id, created_at, id)` (index already present). Add a partial index on `onboarding_responses(client_id) where completed_at is null` if coach dashboards filter incomplete. |
| 100k+ users | Consider archiving old `messages`/`tracker_entries` to a cold table; only then revisit per-message receipts vs the cursor model. Out of scope for v1.1. |

### Scaling Priorities
1. **First bottleneck: un-indexed RLS policy columns.** Every `is_coach_of`/`is_client_of` call and every `client_id`/`conversation_id`/`assignment_id`/`response_id` referenced in a policy MUST be indexed (verified: "missing indexes are the top performance killer" for RLS). Ship indexes in the same migration as each table.
2. **Second bottleneck: message thread growth.** The composite `(conversation_id, created_at, id)` index makes keyset pagination trivial when realtime lands; no change needed now.

---

## Anti-Patterns

### Anti-Pattern 1: Manual id-filtering in app code "to be safe"
**What people do:** add `.eq('client_id', userId)` in the repository alongside RLS.
**Why it's wrong:** it re-implements the authorization boundary in a second place, invites drift, and contradicts the locked decision ("RLS is the sole authorization boundary for reads, no manual id filtering"). A wrong or forgotten filter creates a false sense of safety while RLS is the real gate.
**Do this instead:** trust RLS; assert the boundary in `verify-rls.ts` with a real anon session, not in the query.

### Anti-Pattern 2: Editing a used assessment/tracker version in place
**What people do:** `UPDATE assessment_questions SET prompt = ...` on the live version to "just fix wording."
**Why it's wrong:** it silently rewrites the meaning of already-captured responses/entries; historical coach review becomes wrong.
**Do this instead:** the `freeze_used_version` trigger blocks it; author a new version and flip `active_version_id`.

### Anti-Pattern 3: A `conversation_participants` table for 1-on-1 chat
**What people do:** add a participants join table by reflex.
**Why it's wrong:** membership is already the coach↔client pair in `coach_clients`; a second membership source drifts from RLS truth and the `is_*` helpers.
**Do this instead:** derive membership from the pair via the existing helpers; add participants only if/when group chat is a real requirement.

### Anti-Pattern 4: Idempotency in Edge-Function memory
**What people do:** cache seen `clientRequestId`s in a module-level Set.
**Why it's wrong:** cold starts and multiple instances make in-memory dedupe useless (Supabase: "design for idempotent operations").
**Do this instead:** the `unique (conversation_id, client_request_id)` constraint + `on conflict do nothing` makes Postgres the single durable arbiter.

### Anti-Pattern 5: Putting rich client-editable fields on `profiles`
**What people do:** extend the auth-identity table with goals/prefs/consent.
**Why it's wrong:** widens the most security-sensitive, most-read table and entangles the safe/protected split with the existing role guard.
**Do this instead:** a 1:1 `client_profiles` table with its own freeze trigger.

---

## Integration Points

### External / platform

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth (JWT) | `verify_jwt = true` (default) → Edge Function reads `Authorization` header → RLS-scoped client → `auth.getUser()` for trusted `sender_id` | Never trust client-supplied sender/coach ids; verified official pattern |
| Supabase Postgres RLS | Sole read authz; policies compose `is_coach_of`/`is_client_of` only | Index every policy-referenced column |
| `pg_jsonschema` (optional) | `CHECK (jsonschema_is_valid(schema, ...))` on `tracker_config_versions` | Verified extension; use for authored-rarely config, lighter validation for hot entry path |
| Supabase Realtime | Seam exists (`SupabaseRealtimeService`), **not wired** in v1.1 | Schema is realtime-ready (stable ordering, idempotency key); GAP-019 owns it next |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ data | via `apps/web/lib/services` only | Boundary test forbids direct supabase imports from UI; extend repos, don't bypass |
| web/Edge ↔ domain types | `packages/core` (pure TS) | New `profile.ts`/`onboarding.ts`/`tracker.ts`; Edge Functions import from `../../../packages/core/src` (existing relative-import convention) |
| generated types ↔ hand types | regenerate `database.generated.ts` per migration | Remove `LegacyChatContracts` at 0012; add `*Row` aliases |

---

## Dependency-Ordered Build Sequence

Overall **profiles → onboarding → tracker → chat**; within each feature **schema (+RLS +verify-rls assertions) before service repo before UI**. Each numbered step is independently shippable and gated by `pnpm verify:rls` + `pnpm build`.

1. **Profiles**
   1. `0007_client_profiles.sql` — table, safe/protected columns, RLS (self read/update, coach read), `freeze_protected_profile_fields` trigger. Regenerate types; add `ClientProfileRow`.
   2. `packages/core/profile.ts` contracts + `clientProfiles` service repo.
   3. `verify-rls.ts`: self read/update-safe / coach read / unassigned deny / protected-field-freeze assertions.
   4. Web: client profile read/edit (one primary action), coach client-detail view.

2. **Onboarding** (FKs nothing new beyond `profiles`; bank is standalone)
   1. `0008_assessment_bank.sql` — assessments/versions/questions/options, `freeze_used_version`, service-role-only writes, active-version read policy.
   2. `0009_onboarding_responses.sql` — responses/response_items, resume pointer, RLS (client owns, coach reads).
   3. `onboarding.ts` contracts + `nextQuestion` resolver + `onboarding`/`assessments` repos; seed one assessment version.
   4. `verify-rls.ts`: response ownership / coach read / unassigned deny.
   5. Web: one-question-at-a-time renderer with resume; coach onboarding review.

3. **Tracker** (assignment presupposes coach↔client; entries presuppose assignment)
   1. `0010_tracker_configs.sql` — configs/config_versions, jsonb schema (+ optional `pg_jsonschema` CHECK), `freeze_used_version`.
   2. `0011_tracker_assignments.sql` — assignments (version-pinned) + entries, RLS (client owns entries, coach reads).
   3. `assign-tracker` Edge Function (coach/seed-authorized); `tracker.ts` contracts + `validateEntry`; seed one config + one assignment.
   4. `verify-rls.ts`: entry ownership / active-assignment gate / coach read / unassigned deny / self-assign rejected.
   5. Web: client renders assigned tracker from pinned version + logs entries (visual progress, no grade); coach entry review.

4. **Chat** (last: exercises the pair end-to-end; replaces the stub)
   1. `0012_chat.sql` — conversations/messages/message_reads, idempotency unique index, `(conversation_id, created_at, id)` index, members-read policy, immutability (no update/delete grant). Remove `LegacyChatContracts`; add `ConversationRow`/`MessageRow`/`MessageReadRow`.
   2. Real `send-message` Edge Function (JWT-verified, membership-checked, idempotent) replacing the stub; extend `chat.ts` with read-state.
   3. `conversations`/`messages` repos; `message_reads` upsert; seed one conversation per pair.
   4. `verify-rls.ts`: member read (client & coach) / outsider deny / immutability (update rejected) / duplicate `clientRequestId` idempotent.
   5. Web: chat route on live data (persistent send/read), coach reads same thread. **Realtime deferred** — seam left unwired.

---

## Sources

- Existing FISH migrations `0001`–`0006`, `scripts/seed.ts`, `scripts/verify-rls.ts`, `supabase/functions/send-message/index.ts`, `packages/core/src/chat.ts`, `packages/supabase/src/database.types.ts`, `apps/web/lib/services/**` (HIGH — the live contract being extended).
- [Securing Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/auth) — `verify_jwt`, RLS-scoped client, user vs service auth (HIGH).
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — INSERT needs `WITH CHECK`; wrap `auth.uid()` in `(select …)`; index policy columns (HIGH).
- [supabase/examples RLS policy prompts](https://github.com/supabase/supabase/blob/master/examples/prompts/database-rls-policies.md) — membership `WITH CHECK` patterns (MEDIUM).
- [pg_jsonschema: JSON Schema Validation | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pg_jsonschema) — CHECK-constraint config validation (HIGH).
- [Realtime Chat | Supabase UI](https://supabase.com/ui/docs/nextjs/realtime-chat) and [Realtime Authorization | Supabase Docs](https://supabase.com/docs/guides/realtime/authorization) — realtime-ready design; what to defer (MEDIUM).
- [Transactions and RLS in Supabase Edge Functions | Marmelab](https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html) — idempotent, cold-start-safe Edge Function guidance (MEDIUM).
- `.planning/PROJECT.md`, `docs/product-gap-analysis-2026-07-04.md` (GAP-005..GAP-022), `AGENTS.md` — scope, acceptance criteria, API boundary (HIGH, internal).

---
*Architecture research for: FISH v1.1 "The Coaching Loop" — RLS-first data model on the existing Supabase foundation*
*Researched: 2026-07-04*
