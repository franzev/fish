# Roadmap: FISH

**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

## Milestones

- ✅ **v1.0 Monochrome Foundations** — Phases 1-3 (shipped 2026-07-04) — [archive](milestones/v1.0-ROADMAP.md)
- 📋 **v1.1 The Coaching Loop** — Phases 4-8 (planning) — turn the auth-and-role shell into a working coaching product

## Phases

<details>
<summary>✅ v1.0 Monochrome Foundations (Phases 1-3) — SHIPPED 2026-07-04</summary>

- [x] Phase 1: Monochrome design system you can see (4/4 plans) — completed 2026-07-02
- [x] Phase 2: Secure account you can return to (8/8 plans) — completed 2026-07-03
- [x] Phase 3: Role-aware home (4/4 plans) — completed 2026-07-04

Full phase details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) · Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

### v1.1 The Coaching Loop (Phases 4-8)

- [ ] **Phase 4: Client Profiles** - A client owns their profile and safe-edits it; the coach reads it; protected fields are DB-frozen
- [ ] **Phase 5: Data-Driven Onboarding** - A client answers a DB-driven, one-question-at-a-time assessment that autosaves and resumes; builds the shared config renderer
- [ ] **Phase 6: Tracker Engine** - A client is assigned exactly one config-driven tracker and logs entries; the coach reviews them (reuses the Phase 5 renderer)
- [ ] **Phase 7: Chat Schema** - Conversation/message/read-state tables land RLS-verified, idempotent, immutable, and realtime-ready (no subscriptions, no UI)
- [ ] **Phase 8: Real Chat Route + send-message Edge Function** - A client and coach hold a real persisted 1-on-1 conversation through the live route and real Edge Function; E2E covers the three cross-role flows

## Phase Details

### Phase 4: Client Profiles
**Goal**: A client can view and safe-edit their own profile, a coach can read an assigned client's profile read-only, and protected fields cannot be self-escalated — establishing the safe/protected write-safety discipline the whole milestone reuses.
**Depends on**: v1.0 (shipped `profiles` + `coach_clients`, `is_coach_of`/`is_client_of` RLS helpers, UI kit)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06
**Success Criteria** (what must be TRUE):
  1. A client opens their profile and sees their own identity, goal/role-context text, and level (level shown as data, never a grade); a client edits only safe fields — display name, goal/role context, locale, timezone (locale + timezone prefilled from the browser, never a picker) — and the change persists.
  2. A client sets at most three accessibility preferences (theme, text-size step, optional reduced-motion override), each defaulting to the system setting — no settings buffet — and records consent stored as fields only (boolean + timestamp + version), with no export/delete/retention tooling.
  3. A client attempting to change a protected field (role, coach-owned English level) is rejected at the database by a field-freeze trigger / column grant, not merely by app code.
  4. A coach opens an assigned client's profile as a read-only detail view from the coach client list; an unassigned coach is denied (default-deny, no cross-client leak).
  5. `pnpm verify:rls` passes with self-read / self-safe-update / assigned-coach-read / unassigned-denial / cross-client-denial / protected-field-freeze assertions for `client_profiles`; `pnpm build` is green (XC-01). The profile and edit screens hold the design line — one primary action, 56px targets, monochrome, calm non-scolding copy, no lost work on refresh; the `sketch-findings-fish` skill is loaded before building the client UI (XC-03).
**Plans**: 3 plans
  - [ ] 04-01-PLAN.md — client_profiles schema + column-grant/trigger level freeze + RLS + six verify:rls assertions + [BLOCKING] local apply (Wave 1)
  - [ ] 04-02-PLAN.md — /profile essentials view + /profile/edit Server Action safe-edit + a11y prefs + consent (Wave 2)
  - [ ] 04-03-PLAN.md — coach read-only /coach/clients/[id] + linked roster rows + release gates (Wave 3)
**UI hint**: yes

### Phase 5: Data-Driven Onboarding
**Goal**: A client completes a versioned, database-driven assessment one question at a time, answers autosave and resume exactly where they stopped, progress is calm and un-scored, and a coach reviews the submitted answers read-only. Build the shared config-driven, one-field-at-a-time renderer + validator HERE so the tracker reuses it.
**Depends on**: Phase 4 (client identity to link responses to)
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, ONBD-07
**Success Criteria** (what must be TRUE):
  1. A client is presented onboarding questions read from the database (never hard-coded in the UI), one question per screen with a single primary action; the active assessment is the assigned/active version, never chosen by the client.
  2. The renderer supports all six config-driven answer types — single-select, multi-select, scale, short text, long text, boolean — from config alone.
  3. A client's answers autosave and the client can leave and resume exactly where they stopped, with no "you didn't finish" scolding, and sees calm visual step progress with no score, grade, or percentage-as-judgement.
  4. An onboarding assessment is versioned and becomes immutable once answered (freeze-used-version trigger); each response pins to the exact version the client saw. A coach reviews an assigned client's submitted answers read-only (RLS-scoped, calm empty/partial states).
  5. `pnpm verify:rls` passes with self response-ownership / assigned-coach-read / unassigned-denial / cross-client-denial assertions for the response tables, and the question-bank config is zod-validated in the app with a `pg_jsonschema` CHECK backstop so malformed config cannot persist (XC-01, XC-02); `pnpm build` green. Every client screen holds the design line (one action, no lost work on refresh, monochrome, calm copy) and the `sketch-findings-fish` skill is loaded first (XC-03).
**Plans**: TBD
**UI hint**: yes

### Phase 6: Tracker Engine
**Goal**: A client is assigned exactly one config-driven tracker (via an authorized seed/Edge-Function command, never chosen), renders it from its pinned config version, saves entries with the draft preserved on failure, sees visual milestone progress (never a grade or streak), and a coach reviews the entries read-only. Reuses the Phase 5 renderer/validator and the versioning discipline.
**Depends on**: Phase 5 (shared renderer/validator + versioning discipline); Phase 4 (coach↔client assignment relationship, timezone for cadence)
**Requirements**: TRAK-01, TRAK-02, TRAK-03, TRAK-04, TRAK-05, TRAK-06
**Success Criteria** (what must be TRUE):
  1. A client sees their single assigned tracker rendered from a versioned config (fields + daily/weekly cadence), not a hard-coded template, and never browses or chooses a tracker.
  2. A coach or seed assigns exactly one tracker to a client via an authorized command (the `assign-tracker` Edge Function, seed-invocable — no assignment UI); the command sets coach/version server-side from the active config, never from client input.
  3. A client saves a tracker entry and the entry draft is preserved on failure or navigation; each saved entry pins to the assigned config version.
  4. A client sees visual progress as a milestone journey — never a grade, adherence %, or streak (the schema stores entries, not a streak integer); a coach reviews an assigned client's entries as a read-only timeline (RLS-scoped, no scoring UI).
  5. `pnpm verify:rls` passes with entry self-ownership / active-assignment gate / assigned-coach-read / unassigned-denial / cross-client-denial / self-assign-rejected assertions, tracker config is zod + `pg_jsonschema` validated so malformed config cannot persist (XC-01, XC-02); `pnpm build` green. Client screens hold the design line (one action, no lost draft, no grade/streak, monochrome, calm copy) and `sketch-findings-fish` is loaded first (XC-03).
**Plans**: TBD
**UI hint**: yes

### Phase 7: Chat Schema
**Goal**: The conversation/message/read-state schema lands with membership-scoped RLS, an idempotency constraint, immutable messages, and realtime-ready stable ordering — verified by `verify:rls` and seeded — before any Edge Function or UI complexity. No subscriptions, no route, no UI this phase; the highest-risk feature's data layer is isolated and proven first.
**Depends on**: v1.0 (shipped coach↔client pair + RLS helpers). Independent of Phases 5-6; may proceed in parallel with them if capacity allows.
**Requirements**: CHAT-01, CHAT-04, CHAT-06
**Success Criteria** (what must be TRUE):
  1. `conversations`, `messages`, and `message_reads` tables exist with one thread per assigned coach↔client pair; the full message history for a conversation is persisted and readable on load/refresh by both members through RLS (the persistence + members-read foundation of CHAT-01).
  2. Only the two members of a conversation can read or write in it (via the `is_conversation_member` helper composing the shipped `is_coach_of`/`is_client_of`); outsiders are denied by default-deny RLS, and stored messages are immutable — no update/delete grant, no update policy (CHAT-06).
  3. A duplicate `clientRequestId` cannot create a duplicate message: a partial unique index on `(conversation_id, client_request_id)` enforces idempotency at the database, and the schema carries the `(conversation_id, created_at, id)` composite index so ordering is stable and realtime-ready (CHAT-04) — subscriptions, presence, and typing stay OUT.
  4. `pnpm verify:rls` passes with member-read (client & coach) / outsider-denial / cross-client-denial / immutability (update rejected) / duplicate-`clientRequestId`-idempotent assertions for the chat tables (XC-01); the legacy hand-written `LegacyChatContracts` block is removed and `*Row` aliases are added; `pnpm build` green.
**Plans**: TBD

### Phase 8: Real Chat Route + send-message Edge Function
**Goal**: A client and coach hold a real, persistent 1-on-1 conversation on live data — the real idempotent `send-message` Edge Function replaces the validation-only stub, the web chat route sends and reads real history with an optimistic sending→sent/failed lifecycle, the draft is preserved on failure, oversized/empty messages are calmly rejected, and the three cross-role flows are covered end-to-end. This is the #1 data-leak + message-integrity surface and carries the largest test budget.
**Depends on**: Phase 7 (verified chat schema); Phase 5 and Phase 6 (the onboarding-save→resume and tracker-assign→client-render flows the E2E suite also exercises)
**Requirements**: CHAT-02, CHAT-03, CHAT-05, CHAT-07, XC-04
**Success Criteria** (what must be TRUE):
  1. A client sends a message to their coach and the coach to the client, persisted via the real `send-message` Edge Function replacing the validation-only stub; the function verifies the JWT, derives the trusted `sender_id` from `getUser()` (never from the body), re-checks conversation membership before the insert, and inserts idempotently (service-role bypass of RLS is re-guarded).
  2. Sending shows an optimistic lifecycle (sending → sent / failed) with a retry affordance, never a silent drop and no layout shift; a retry or double-tap reconciles by `clientRequestId` and never produces a duplicate bubble.
  3. The composer draft is preserved when a send fails, so nothing the client typed is lost; both client and coach load and read the same real thread history.
  4. Empty, whitespace-only, and oversized (>4000 char) messages are rejected with calm, non-scolding guidance (soft notice tone, never red).
  5. The three cross-role, multi-step flows — onboarding save→resume, client-send→coach-read, tracker-assign→client-render — are covered by tightly-scoped, dev-only Playwright end-to-end tests (XC-04); `pnpm verify:rls` and `pnpm build` are green (XC-01), and the chat route holds the design line — one primary action (Send), no lost draft, no layout shift, calm copy, monochrome — with `sketch-findings-fish` loaded first (XC-03).
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Monochrome design system you can see | v1.0 | 4/4 | Complete | 2026-07-02 |
| 2. Secure account you can return to | v1.0 | 8/8 | Complete | 2026-07-03 |
| 3. Role-aware home | v1.0 | 4/4 | Complete | 2026-07-04 |
| 4. Client Profiles | v1.1 | 0/? | Not started | - |
| 5. Data-Driven Onboarding | v1.1 | 0/? | Not started | - |
| 6. Tracker Engine | v1.1 | 0/? | Not started | - |
| 7. Chat Schema | v1.1 | 0/? | Not started | - |
| 8. Real Chat Route + send-message Edge Function | v1.1 | 0/? | Not started | - |

---
*Roadmap created: 2026-07-02 · v1.0 archived: 2026-07-04 · v1.1 The Coaching Loop added: 2026-07-04*
