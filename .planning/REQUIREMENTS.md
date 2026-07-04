# Requirements: FISH — v1.1 "The Coaching Loop"

**Defined:** 2026-07-04
**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

Milestone goal: turn FISH from an auth-and-role shell into a working coaching product — a coach can profile a client, run them through a data-driven onboarding, assign a config-driven tracker, and hold a real persistent 1-on-1 conversation; the client experiences all of it as calm, assigned, choice-free screens.

Grounded in `.planning/research/SUMMARY.md` (+ STACK/FEATURES/ARCHITECTURE/PITFALLS) and `docs/product-gap-analysis-2026-07-04.md` (GAP-005…GAP-022). Every requirement is scored against the six non-negotiable design rules and the coach-first rule in AGENTS.md.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability). The four functional categories follow the discovered dependency chain **profiles → onboarding → tracker → chat**; the cross-cutting requirements apply to every phase.

### Client Profiles (PROF)

- [ ] **PROF-01**: A client can view their own profile
- [ ] **PROF-02**: A client can edit their own safe fields — display name, language goal / role context, locale, timezone (locale and timezone prefilled from the browser, never asked as a picker)
- [ ] **PROF-03**: A client can set a minimal set of accessibility preferences (at most three: theme, text-size step, and an optional reduced-motion override) that default to the system setting — no settings buffet
- [ ] **PROF-04**: A client records required consent, stored as fields only (boolean + timestamp + version) — no export/delete/retention tooling this milestone
- [ ] **PROF-05**: A client cannot alter protected fields (role, coach-owned English level) — enforced at the database via a field-freeze trigger / column grants, not just app code
- [ ] **PROF-06**: A coach can open an assigned client's profile as a read-only detail view from the coach client list; unassigned coaches are denied

### Data-Driven Onboarding (ONBD)

- [ ] **ONBD-01**: A client is presented onboarding questions read from the database (never hard-coded in the UI), one question per screen with a single primary action
- [ ] **ONBD-02**: The onboarding renderer supports the six config-driven answer types — single-select, multi-select, scale, short text, long text, boolean
- [ ] **ONBD-03**: A client's answers autosave and the client can leave and resume exactly where they stopped, with no "you didn't finish" scolding
- [ ] **ONBD-04**: A client sees calm visual step progress with no score, grade, or percentage-as-judgement
- [ ] **ONBD-05**: An onboarding assessment is versioned and becomes immutable once answered; each response pins to the exact version the client saw
- [ ] **ONBD-06**: The active onboarding assessment is assigned (seeded/active version), never chosen by the client
- [ ] **ONBD-07**: A coach can review an assigned client's submitted onboarding answers (read-only, RLS-scoped, calm empty/partial states)

### Tracker Engine (TRAK)

- [ ] **TRAK-01**: A tracker is rendered from a versioned config (fields + daily/weekly cadence), not a hard-coded template
- [ ] **TRAK-02**: A coach (or seed) assigns exactly one tracker to a client via an authorized command (Edge Function); a client never browses or chooses a tracker
- [ ] **TRAK-03**: A client sees their single assigned tracker and can save an entry, with the entry draft preserved on failure or navigation
- [ ] **TRAK-04**: A tracker config is validated and versioned; each saved entry pins to the assigned config version
- [ ] **TRAK-05**: A client sees visual progress on the tracker as a milestone journey — never a grade, adherence %, or streak (schema stores entries, not a streak integer)
- [ ] **TRAK-06**: A coach can review an assigned client's tracker entries (read-only timeline, RLS-scoped, no scoring UI)

### Real 1-on-1 Chat (CHAT)

- [ ] **CHAT-01**: An assigned client and coach share one conversation and can read its full persisted message history on load/refresh (both read the same thread)
- [ ] **CHAT-02**: A client can send a message to their coach and the coach to the client, persisted via the real `send-message` Edge Function replacing the validation-only stub
- [ ] **CHAT-03**: Sending shows an optimistic lifecycle (sending → sent / failed) with a retry affordance, never a silent drop, and no layout shift
- [ ] **CHAT-04**: Sending is idempotent on `clientRequestId` — a retry or double-tap never creates a duplicate message
- [ ] **CHAT-05**: The composer text (draft) is preserved when a send fails, so nothing the client typed is lost
- [ ] **CHAT-06**: Only the two members of a conversation can read or send in it; outsiders are denied by RLS, and stored messages are immutable
- [ ] **CHAT-07**: Empty, whitespace-only, and oversized (>4000 char) messages are rejected with calm, non-scolding guidance (soft notice tone, never red)

### Cross-Cutting (XC) — apply to every phase

These are milestone-level guarantees, not one-phase features. The roadmapper must thread each into the success criteria of every phase it touches.

- [ ] **XC-01**: Every new table is RLS-protected by policies composing the existing `is_coach_of` / `is_client_of` helpers; `pnpm verify:rls` is extended per table with self / assigned-coach / unassigned-denial / **cross-client-denial** / field-protection / idempotency assertions and passes as a release gate
- [ ] **XC-02**: Data-driven config (question-bank, tracker config) and command payloads are schema-validated with zod (in `apps/web` + the Edge Function; never in `packages/core`), with a `pg_jsonschema` CHECK backstop so malformed config cannot persist
- [ ] **XC-03**: Every client-facing screen holds the design line — one primary action, assigned-never-chosen, 56px targets, visual progress (no grades/streaks), non-scolding calm copy, monochrome, and no lost work on refresh; the `sketch-findings-fish` skill is loaded before building any client UI
- [ ] **XC-04**: The three cross-role, multi-step flows — onboarding save→resume, client-send→coach-read, tracker-assign→client-render — are covered by end-to-end tests (Playwright, dev-only, tightly scoped)

## v2 / Future Requirements

Deferred to a future milestone. Tracked, not in this roadmap. Each has a clear trigger.

### Onboarding

- **ONBD-B01**: Onboarding branching / skip-logic — config-driven condition → skip-to / show / complete, with publish-time cycle/dead-end validation. *Trigger: a validated assessment actually needs conditional paths. Ship linear first.*

### Tracker / Progress

- **TRAK-R01**: Reward-only progress / return rewards (reward returning after a gap, never a resetting streak). *Trigger: a coach validates the tracking + reward technique manually (coach-first, GAP-033).*

### Chat

- **CHAT-RT01**: Realtime, presence, typing, read-receipts (the chat schema is already realtime-ready). *Trigger: next chat layer (GAP-019).*
- **CHAT-AT01**: Attachments / voice notes. *Trigger: needs storage buckets + type/size/virus checks + moderation (GAP-021).*
- **CHAT-OQ01**: Full offline draft + retry queue beyond single-draft preservation. *Trigger: real flaky-connection reports (GAP-020).*

### Coach / Admin

- **ASGN-01**: Coach/admin assignment + reassignment UI (Edge Function + roster + audit). *Trigger: volume outgrows seed-only (GAP-036).*

## Out of Scope

Explicitly excluded from v1.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Realtime / presence / typing / read-receipts | v1.1 ships persistent send/read; realtime is the next chat layer and adds subscription surface + more moving indicators for ND users |
| AI replies, memory, personalization, grammar/vocabulary/pronunciation pipelines | AGENTS coach-first rule: no AI until the human chat foundation exists and a coach has validated the technique |
| Assignment UI | Coach→client assignment stays seed-only; the relationship schema already carries chat, profiles, and trackers, so the UI drops in later without migration |
| Full privacy tooling (export, delete, retention, audit logging) | v1.1 captures consent *fields* only; the privacy milestone precedes public launch, not this one |
| Validated learning content / templates | v1.1 builds the engines with minimal seed config; specific onboarding questions and tracker templates await coach validation (coach-first) |
| Reward UI / gamification / streaks | Reward-only progress is blocked by coach validation; a resetting streak is the audience's #1 abandonment trigger — never build it |
| Client-facing pickers, galleries, plan/tracker/assessment menus | Assigned-never-chosen — the product removes choices |
| Message reactions, edit, delete, search; group chat | Extra choices / immutability questions not needed to hold a 1-on-1 coaching conversation; community feed is barred |
| Native iOS/Android, analytics, notifications, admin UI | Web-first; out of this milestone |

## Traceability

Which phase covers which requirement. Populated by the roadmapper (authority). Phase numbering continues from v1.0 (which ended at Phase 3); v1.1 spans Phases 4-8. Dependency chain: profiles (4) → onboarding (5) → tracker (6) → chat-schema (7) → chat-route (8). XC-01/02/03 are milestone-wide guarantees woven into every phase's success criteria; XC-04 (E2E of the three cross-role flows) anchors to Phase 8.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | Phase 4 — Client Profiles | Pending |
| PROF-02 | Phase 4 — Client Profiles | Pending |
| PROF-03 | Phase 4 — Client Profiles | Pending |
| PROF-04 | Phase 4 — Client Profiles | Pending |
| PROF-05 | Phase 4 — Client Profiles | Pending |
| PROF-06 | Phase 4 — Client Profiles | Pending |
| ONBD-01 | Phase 5 — Data-Driven Onboarding | Pending |
| ONBD-02 | Phase 5 — Data-Driven Onboarding | Pending |
| ONBD-03 | Phase 5 — Data-Driven Onboarding | Pending |
| ONBD-04 | Phase 5 — Data-Driven Onboarding | Pending |
| ONBD-05 | Phase 5 — Data-Driven Onboarding | Pending |
| ONBD-06 | Phase 5 — Data-Driven Onboarding | Pending |
| ONBD-07 | Phase 5 — Data-Driven Onboarding | Pending |
| TRAK-01 | Phase 6 — Tracker Engine | Pending |
| TRAK-02 | Phase 6 — Tracker Engine | Pending |
| TRAK-03 | Phase 6 — Tracker Engine | Pending |
| TRAK-04 | Phase 6 — Tracker Engine | Pending |
| TRAK-05 | Phase 6 — Tracker Engine | Pending |
| TRAK-06 | Phase 6 — Tracker Engine | Pending |
| CHAT-01 | Phase 7 — Chat Schema | Pending |
| CHAT-02 | Phase 8 — Real Chat Route + send-message Edge Function | Pending |
| CHAT-03 | Phase 8 — Real Chat Route + send-message Edge Function | Pending |
| CHAT-04 | Phase 7 — Chat Schema | Pending |
| CHAT-05 | Phase 8 — Real Chat Route + send-message Edge Function | Pending |
| CHAT-06 | Phase 7 — Chat Schema | Pending |
| CHAT-07 | Phase 8 — Real Chat Route + send-message Edge Function | Pending |
| XC-01 | All phases (cross-cutting) | Pending |
| XC-02 | All phases (cross-cutting) | Pending |
| XC-03 | All phases (cross-cutting) | Pending |
| XC-04 | Phase 8 — Real Chat Route + send-message Edge Function | Pending |

**Coverage:**
- v1 requirements: 30 total (26 functional + 4 cross-cutting)
- Mapped to phases: 30 (PROF×6 → P4 · ONBD×7 → P5 · TRAK×6 → P6 · CHAT-01/04/06 → P7 · CHAT-02/03/05/07 → P8 · XC-04 → P8 · XC-01/02/03 cross-cutting across all phases)
- Unmapped: 0 ✓

**Cross-cutting weave (XC-01/02/03):** every schema phase (4-7) carries a `pnpm verify:rls` success criterion with self / assigned-coach / unassigned-denial / cross-client-denial (+ field-protection / idempotency where applicable) assertions (XC-01); config-bearing phases (5, 6) and the Edge-Function phase (8) carry a zod + `pg_jsonschema` validation criterion (XC-02); every client-facing phase (4, 5, 6, 8) carries a design-line + `sketch-findings-fish`-loaded criterion (XC-03).

---
*Requirements defined: 2026-07-04*
*Last updated: 2026-07-04 after roadmap creation — 30/30 mapped to Phases 4-8*
