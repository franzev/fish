# Roadmap: FISH

**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

## Milestones

- ✅ **v1.0 Monochrome Foundations** — Phases 1-3 (shipped 2026-07-04) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 The Coaching Loop Foundation** — Phases 4, 7, 8 (re-scoped 2026-07-06) — profiles plus real persistent 1-on-1 chat
- ◆ **v1.2 Cross-platform Chat State Foundation** — Phase 9 — portable chat state contracts plus a web Zustand adapter

## Phases

<details>
<summary>✅ v1.0 Monochrome Foundations (Phases 1-3) — SHIPPED 2026-07-04</summary>

- [x] Phase 1: Monochrome design system you can see (4/4 plans) — completed 2026-07-02
- [x] Phase 2: Secure account you can return to (8/8 plans) — completed 2026-07-03
- [x] Phase 3: Role-aware home (4/4 plans) — completed 2026-07-04

Full phase details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) · Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

### v1.1 The Coaching Loop Foundation

- [x] **Phase 4: Client Profiles** - A client owns their profile and safe-edits it; the coach reads it; protected fields are DB-frozen (completed 2026-07-04)
- [x] **Phase 7: Chat Schema** - Conversation/message/read-state tables landed RLS-verified, idempotent, immutable, and realtime-ready (completed 2026-07-05)
- [x] **Phase 8: Real Chat Route + send-message Edge Function** - A client and coach hold a real persisted 1-on-1 conversation through the live route and real Edge Function (completed 2026-07-06)

Removed 2026-07-06: the previously built learning-flow engines are no longer part of this milestone or the active product.

### v1.2 Cross-platform Chat State Foundation

- [ ] **Phase 9: Cross-platform Chat State** - Chat state rules become portable and test-vector-backed; web adopts Zustand only as the React adapter for shared chat surfaces while Android/iOS get the same event contract to implement natively. (needs UAT)

## Phase Details

### Phase 4: Client Profiles

**Goal**: A client can view and safe-edit their own profile, a coach can read an assigned client's profile read-only, and protected fields cannot be self-escalated — establishing the safe/protected write-safety discipline the whole milestone reuses.
**Depends on**: v1.0 (shipped `profiles` + `coach_clients`, `is_coach_of`/`is_client_of` RLS helpers, UI kit)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06

**Plans**: 3/3 plans complete

- [x] 04-01-PLAN.md — client_profiles schema + column-grant/trigger level freeze + RLS + six verify:rls assertions + local apply
- [x] 04-02-PLAN.md — /profile essentials view + /profile/edit Server Action safe-edit + a11y prefs + consent
- [x] 04-03-PLAN.md — coach read-only /coach/clients/[id] + linked roster rows + release gates

### Phase 7: Chat Schema

**Goal**: The conversation/message/read-state schema lands with membership-scoped RLS, an idempotency constraint, immutable messages, and realtime-ready stable ordering before any route complexity.
**Depends on**: v1.0 coach-client relationship and RLS helpers
**Requirements**: CHAT-01, CHAT-04, CHAT-06

**Plans**: 1/1 plan complete

- [x] 07-01-PLAN.md — chat schema, membership RLS, idempotent `send_chat_message`, seeded conversations, generated types, live RLS verifier, validation/UAT/security closeout

### Phase 8: Real Chat Route + send-message Edge Function

**Goal**: A client and coach hold a real, persistent 1-on-1 conversation on live data — the real idempotent `send-message` Edge Function persists messages, the web chat route reads real history, optimistic send states reconcile safely, drafts survive failure, and invalid messages are rejected with calm guidance.
**Depends on**: Phase 7
**Requirements**: CHAT-02, CHAT-03, CHAT-05, CHAT-07, XC-04

**Plans**: 1/1 plan complete

- [x] 08-01-SUMMARY.md — real `/chat` route, `send-message` Edge Function, optimistic send lifecycle, draft-preserving failure state, validation, RLS/security, and Playwright cross-role E2E

### Phase 9: Cross-platform Chat State

**Goal**: Extract chat state into a portable, test-vector-backed state machine and refactor the web chat route so Zustand coordinates shared web surfaces without becoming the source of truth; Android and iOS receive the same event/result contract for native ViewModel/observable implementations later.
**Depends on**: Phase 8
**Requirements**: CSTATE-01, CSTATE-02, CSTATE-03, CSTATE-04, CSTATE-05, CSTATE-06
**Plans**: 4 plans
**Wave 1**

- [x] 09-01-PLAN.md — portable chat-state core, fixture vectors, dependency boundary tests, and web helper shim

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — web chat hook extraction for messages, read state, realtime, presence, and composer behavior
- [x] 09-04-PLAN.md — platform-neutral protocol docs and Android/iOS native architecture notes

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-03-PLAN.md — web-only Zustand adapter, narrow selectors, hook integration, and release gates

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Monochrome design system you can see | v1.0 | 4/4 | Complete | 2026-07-02 |
| 2. Secure account you can return to | v1.0 | 8/8 | Complete | 2026-07-03 |
| 3. Role-aware home | v1.0 | 4/4 | Complete | 2026-07-04 |
| 4. Client Profiles | v1.1 | 3/3 | Complete | 2026-07-05 |
| 7. Chat Schema | v1.1 | 1/1 | Complete | 2026-07-05 |
| 8. Real Chat Route + send-message Edge Function | v1.1 | 1/1 | Complete | 2026-07-06 |
| 9. Cross-platform Chat State | v1.2 | 4/4 | Needs UAT  | — |

---
*Roadmap created: 2026-07-02 · v1.0 archived: 2026-07-04 · v1.1 re-scoped: 2026-07-06 · v1.2 opened: 2026-07-07*
