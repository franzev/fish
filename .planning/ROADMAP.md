# Roadmap: FISH

**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

## Milestones

- ✅ **v1.0 Monochrome Foundations** — Phases 1-3 (shipped 2026-07-04) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 The Coaching Loop Foundation** — Phases 4, 7, 8 (re-scoped 2026-07-06) — profiles plus real persistent 1-on-1 chat
- ◆ **v1.2 Cross-platform Chat State Foundation** — Phases 9-10 — portable chat state contracts, a web Zustand adapter, and optimized message loading

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

- [x] **Phase 9: Cross-platform Chat State** - Chat state rules become portable and test-vector-backed; web adopts Zustand only as the React adapter for shared chat surfaces while Android/iOS get the same event contract to implement natively. (needs UAT) (completed 2026-07-10)
- [x] **Phase 10: Chat Message Loading Optimization** - Conversations open near-instantly on a bounded newest-messages window; older history loads via cursor-based load-more and infinite scroll with reading position preserved; realtime messages merge in place with no duplicates, full reloads, or layout shift. (completed 2026-07-10)

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

> **Supersede note (2026-07-10):** The canonical chat surface for Phase 9 is the community room at `/channels/general` (the `/chat` route was removed); any "assigned conversation" phrasing above is superseded accordingly, and re-verification targets `/channels/:id`.
**Depends on**: Phase 8
**Requirements**: CSTATE-01, CSTATE-02, CSTATE-03, CSTATE-04, CSTATE-05, CSTATE-06
**Plans**: 11 plans (6 complete, 5 gap-closure round 2 from the 2026-07-10 re-verification)
**Wave 1**

- [x] 09-01-PLAN.md — portable chat-state core, fixture vectors, dependency boundary tests, and web helper shim

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — web chat hook extraction for messages, read state, realtime, presence, and composer behavior
- [x] 09-04-PLAN.md — platform-neutral protocol docs and Android/iOS native architecture notes

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-03-PLAN.md — web-only Zustand adapter, narrow selectors, hook integration, and release gates

**Wave 4** *(gap closure; blocked on the completed Phase 09 implementation)*

- [x] 09-05-PLAN.md — obtain real authenticated two-session realtime evidence for the inconclusive new-message UAT gap
- [x] 09-06-PLAN.md — synchronize the canonical Phase 09 native notes with the current pagination contract and align UAT documentation references

**Wave 5** *(gap closure round 2; blocked on the 2026-07-10 re-verification `gaps_found`)*

- [x] 09-07-PLAN.md — isolate the chat store by authenticated user; clear on soft logout with a cross-account regression test (CR-01 blocker)
- [ ] 09-08-PLAN.md — remove the `/chat` route and add dated CSTATE-02/06 + D-09 supersede notes for the community-room target
- [ ] 09-09-PLAN.md — draft-safe send-failure recovery: conditional reducer restore and removal of the composer clobber (WR-01 blocker)

**Wave 6** *(blocked on Wave 5)*

- [ ] 09-10-PLAN.md — reset realtime lifecycle/reconnect refs per conversation and dispatch each read payload once (WR-05, WR-06)

**Wave 7** *(blocked on Wave 6)*

- [ ] 09-11-PLAN.md — community grouping predicate (avatar/time reappear), truthful offline copy, and 56px touch-safe actions (WR-02, WR-03, WR-04)

### Phase 10: Chat Message Loading Optimization

**Goal**: Opening a conversation renders the newest messages near-instantly from a bounded initial window; older history arrives through cursor-based "load earlier" and infinite scroll with reading position preserved; realtime messages merge into the loaded list in place — no full reloads, no duplicate messages, no layout shift — and history stays gap-free and correctly ordered across offline/reconnect edge cases.
**Depends on**: Phase 8, Phase 9
**Requirements**: CLOAD-01, CLOAD-02, CLOAD-03, CLOAD-04, CLOAD-05, CLOAD-06
**Plans**: 4 plans

**Wave 1** *(parallel — no shared files)*

- [x] 10-01-PLAN.md — portable pagination contract: additive events (hydrateWindow/olderPageLoaded/…), pagination state, read-marker-outside-window selector fix, fixtures, protocol + native docs
- [x] 10-02-PLAN.md — bounded keyset SSR window + cursor-based load-older & bounded reconnect-backfill read actions (direct RLS selects; no new migration)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-03-PLAN.md — Zustand pagination wiring + selectors, message-hook loadOlder/gap-backfill, hydrateWindow hydration, reconnect consolidation (3→1 bounded backfill)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-04-PLAN.md — IntersectionObserver sentinel + manual scroll-anchor restore, stick-to-bottom prepend fix, quiet "load earlier" affordance, calm skeleton/offline states, CSS (skeleton pulse + overflow-anchor)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Monochrome design system you can see | v1.0 | 4/4 | Complete | 2026-07-02 |
| 2. Secure account you can return to | v1.0 | 8/8 | Complete | 2026-07-03 |
| 3. Role-aware home | v1.0 | 4/4 | Complete | 2026-07-04 |
| 4. Client Profiles | v1.1 | 3/3 | Complete | 2026-07-05 |
| 7. Chat Schema | v1.1 | 1/1 | Complete | 2026-07-05 |
| 8. Real Chat Route + send-message Edge Function | v1.1 | 1/1 | Complete | 2026-07-06 |
| 9. Cross-platform Chat State | v1.2 | 7/11 | In Progress|  |
| 10. Chat Message Loading Optimization | v1.2 | 4/4 | Complete   | 2026-07-10 |

---
*Roadmap created: 2026-07-02 · v1.0 archived: 2026-07-04 · v1.1 re-scoped: 2026-07-06 · v1.2 opened: 2026-07-07*
