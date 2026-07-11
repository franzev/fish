# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Monochrome Foundations

**Shipped:** 2026-07-04
**Phases:** 3 | **Plans:** 16 (11 planned + 5 gap-closure) | **Tasks:** 46 | **Commits:** 174 over 3 days

### What Was Built

- Monochrome design system: `light-dark()` oklch token ladder (WCAG-AA contrast-tested), five kit components, `/kit` demo page as the visual contract in both themes with no-flash system-preference theming.
- Full email/password auth loop: signup (always client) → verification email → login → persistent session → logout → password recovery; six auth screens, all Enter-submittable, calm non-enumerating copy.
- Database foundation: hardened `handle_new_user` trigger, `profiles` + `coach_clients`, recursion-safe RLS via SECURITY DEFINER helpers, server-enforced roles, idempotent seed, `pnpm verify:rls` live-assertion gate.
- Role-aware routing and shell: default-deny `(authenticated)` guard, pure-redirect root, wrong-door guards, `redirectIfSignedIn`, AppShell with zero primary actions, calm empty states for client and coach homes.

### What Worked

- **Adversarial verification caught a real shipped defect.** The Phase 1 verifier inspected compiled production CSS bytes (not source intent) and found the focus-ring `light-dark()` band swap that made keyboard focus invisible (~1.06:1 contrast). The gap-closure verification then proved the regression test discriminates the defect by reverting the fix and watching it fail.
- **Small, targeted gap-closure plans** (01-04, 02-06/07/08) kept phases converging instead of reopening whole plans — each closed a specific UAT/verification gap with its own regression coverage.
- **Live-DB verification as an exit-code gate** (`pnpm verify:rls`) made RLS/role boundaries provable on every run, not just at review time — re-executed independently at every verification pass.
- **Checkpoint-driven design evolution** — the 02-08 notice-overlay design went through two rounds of human feedback at checkpoints instead of shipping the first (rejected) reserved-row attempt.
- **Tests parsing the source of truth** — contrast and focus-ring tests read `globals.css` live, so token edits are automatically re-verified with no fixture drift.

### What Was Inefficient

- **Phase 2 took three verification passes and four gap-closure plans.** Enter-submit behavior and cursor affordances were only caught in human UAT; a keyboard-interaction checklist during planning would have caught the missing `<form onSubmit>` pattern before execution.
- **The 02-06 UAT blocker (site_url/port mismatch)** burned a full UAT cycle on environment config — cookies being host-scoped meant `127.0.0.1` vs `localhost` mattered; this was discoverable at setup time.
- **A false-alarm debug session** (recovery email "not delivered") consumed a full diagnosis cycle; the root cause was a typo'd email during UAT, invisible because anti-enumeration UX intentionally shows success either way. The pipeline was healthy all along.

### Patterns Established

- **Layout-stability contract:** no control ever changes size on state change — loading spinners overlay `opacity-0` labels, message rows reserve constant height, notices float out-of-flow above the card.
- **Auth-screen form pattern:** every auth screen uses `<form onSubmit={handleSubmit}>` + `type="submit"` Button — Enter always submits.
- **RLS is the sole authorization boundary for reads** — no manual id filtering; policies (`is_coach_of`/`is_client_of`) carry the whole burden.
- **`authRedirects` as the single redirect source of truth** (two hardcoded stragglers noted as tech debt in the audit).
- **Native HTML semantics over CSS hacks:** `disabled` attribute + explicit click-guards instead of `pointer-events-none` (which silently killed cursor feedback).
- **Scoped monochrome exception:** Alert tones may use calm, low-chroma semantic colors (chroma ≤ 0.15, contrast-gated); structural UI stays chroma-0.

### Key Lessons

1. **Verify shipped bytes, not source intent.** The focus-ring defect existed in compiled CSS despite correct-looking source review; Lightning CSS polyfill behavior only shows in the served output.
2. **Anti-enumeration UX hides testing signals.** When success copy is identical for real and unknown accounts by design, UAT scripts must paste seeded values verbatim — and testers need a side channel (Mailpit, audit log) to confirm the real outcome.
3. **Dev-environment origins must match the browser exactly.** Session cookies are host-scoped: pin the port AND use the same hostname (`localhost`, not `127.0.0.1`) the browser navigates on.
4. **Plan keyboard interaction explicitly.** "Button submits on click" passes every unit test while Enter-submit silently doesn't exist; a form-semantics checklist belongs in UI plan review.
5. **Human UAT catches what grep can't** — cursor affordances, layout shifts, "feels inert" — but each finding is cheapest to close in a small dedicated gap plan with its own regression test.

### Cost Observations

- Model mix: adaptive profile (not instrumented this milestone)
- Sessions: not precisely tracked; 174 commits across 3 calendar days (2026-07-02 → 2026-07-04)
- Notable: gap-closure plans (5 of 16) accounted for a large share of Phase 1–2 wall-clock; earlier keyboard/UX checklists would shrink this next milestone

---

## Milestone: v1.2 — Cross-platform Chat State Foundation

**Shipped:** 2026-07-11
**Phases:** 2 | **Plans:** 26 (8 planned + 18 gap-closure) | **Tasks:** 62 | **Commits:** ~295 over 5 days

*(v1.1 The Coaching Loop Foundation — Phases 4, 7, 8 — closed informally on 2026-07-06 during the learning-flow re-scope and never got its own retrospective section; its headline outcomes are the DB-frozen safe-edit profile discipline and the idempotent `send-message` chat foundation that v1.2 built on.)*

### What Was Built

- Portable chat-state machine in `@fish/core/chat-state`: platform-neutral reducer + selectors, 17 JSON replay fixture vectors covering 15 chat events plus pagination state, dependency-boundary tests, protocol docs, and Android/iOS native architecture notes.
- Web chat rebuilt on a conversation-keyed Zustand adapter over the portable reducer (Zustand as React adapter only, never source of truth); canonical surface moved to the community room `/channels/:id`, and the dead 1-on-1 `/chat` route was removed with dated supersede notes.
- Identity-safe chat cache: the module-singleton store purges on verified identity change, sign-out, and cross-tab session expiry (`ensureChatStoreOwner` + `ChatIdentityGuard`), closing the CR-01 cross-account leak.
- Bounded message loading: 40+1 keyset SSR window, cursor-based load-earlier via IntersectionObserver sentinel + quiet ghost button with scroll-anchor restore, layout-matched skeleton in a fixed pagination slot, and one conversation-owned server-confirmed-cursor reconnect backfill replacing three concurrent full refetches.

### What Worked

- **Fixture vectors as the contract.** Every reducer hardening round (WR-02/03/10, hasLoadError) landed with new replayable JSON vectors, so cross-platform parity claims stayed testable instead of aspirational — and web-layer tests later proved the same fixes held at the UI layer.
- **Cross-AI plan review caught two HIGH architecture gaps before execution** — the Plan 02↔03 unbounded-reset gap and the unbounded-reconnect gap — each closed by a targeted plan instead of a post-ship incident.
- **Supersede notes instead of silent re-targeting.** When `/chat` was removed mid-phase, dated supersede notes on CSTATE-02/06, D-09, and the phase goal kept re-verification honest — it measured the shipped community room, not the removed route.
- **Verification that reverts the fix.** Regression tests for the realtime bugs (WR-05/06) were proven to fail against pre-fix code, carrying forward the v1.0 discipline.
- **Browser-faithful test doubles.** The IntersectionObserver mock that replayed real observer timing was what finally proved the older-load double-fire bug and its single-retry fix.

### What Was Inefficient

- **Phase 9 needed five gap-closure rounds (15 of 19 plans).** Review and UAT kept finding real defects — cross-account leaks, retry storms, draft clobbering, cross-conversation page leaks — but each round cost a full re-verification cycle. Most defects cluster around one root theme: module-global state + async lifecycles (stale callbacks, unkeyed caches, unscoped locks). A lifecycle/ownership checklist at plan time would have caught several classes before execution.
- **The new-message delivery investigation (09-05) ended inconclusive** — two authenticated sessions delivered exactly once, but without WebSocket/request capture the protocol-level root cause was never established; the debug session was ultimately deferred at close.
- **Stale bookkeeping accumulated:** 6 open artifact files (5 debug sessions, 1 quick-task) had to be acknowledged as deferred at close; most were already effectively resolved but never marked.

### Patterns Established

- **Portable-core boundary:** shared state logic lives in `packages/core` behind dependency-guard tests that reject React/Next/Zustand/Supabase/browser imports; adapters stay thin.
- **Event-through-one-reducer:** every store mutation dispatches a `ChatEvent` through the single portable reducer — no side-channel state writes.
- **Identity-fingerprinted caches:** any module-singleton cache must bind to a verified auth identity and purge on change.
- **Conversation-scoped ownership:** in-flight locks, generation tokens, and lifecycle resets are keyed per conversation so a stale completion can never affect another conversation.
- **Atomic state-flag commits:** related flags (e.g. `hasLoadError` + `isLoadingOlder`) commit in the same reducer update — never split across a hook `useState` and the store.
- **Bounded everything:** initial windows, reconnect backfills, and automatic retries all have explicit bounds with calm manual affordances past them.

### Key Lessons

1. **Module-global state is where the bugs live.** Nearly every blocking gap traced to an unkeyed singleton, an unscoped lock, or a stale async callback. Ownership (who may write, keyed by what, reset when) deserves explicit plan-time design, not discovery via UAT.
2. **A portable contract is only as real as its replay vectors.** Docs drift; fixtures don't. The vector suite was the artifact that made "Android/iOS get the same behavior" a testable claim.
3. **Retargeting mid-phase is fine if it's dated and explicit.** The supersede-note pattern let the milestone change its canonical surface without corrupting verification.
4. **Close bookkeeping as you go.** Deferred-at-close artifact piles are cheap to prevent (mark the session resolved when the fix lands) and noisy to triage later.
5. **Inconclusive investigations should record what instrumentation was missing** (here: WebSocket/request capture) so the next attempt starts from the gap, not from zero.

### Cost Observations

- Model mix: adaptive profile (not instrumented this milestone)
- Sessions: not precisely tracked; ~295 commits across 5 calendar days (2026-07-07 → 2026-07-11)
- Notable: gap-closure plans were 18 of 26 (69%) — up from 31% in v1.0. The plan-time lifecycle/ownership checklist is the highest-leverage process fix for the next milestone.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 3 | 16 (5 gap-closure) | Established verify-against-shipped-bytes + live-DB gates + checkpoint-driven UAT |
| v1.1 | 3 | 5 | Informal close during re-scope; established DB-frozen safe-edit + idempotent Edge Function write path |
| v1.2 | 2 | 26 (18 gap-closure) | Established portable-core + fixture-vector contract, cross-AI plan review, dated supersede notes |

### Cumulative Quality

| Milestone | Tests | Live Gates | Requirements |
|-----------|-------|------------|--------------|
| v1.0 | 173 (Vitest) | verify:rls 8/8 | 28/28 satisfied |
| v1.2 | fixture vectors 17 + web/E2E suites | verify:rls 14/14 | 12/12 satisfied (v1.1's 17 also closed) |

### Top Lessons (Verified Across Milestones)

1. **Verification that discriminates (revert-the-fix, shipped bytes, live DB) finds real defects** — confirmed in both v1.0 (focus ring) and v1.2 (WR-05/06, double-fire retry).
2. **Human UAT + small dedicated gap plans converge phases** — but v1.2's 69% gap-closure share says the checklist belongs at plan time: lifecycle/ownership design for any shared or module-global state.
3. **Contracts need executable artifacts** — token-parsing tests (v1.0) and replay fixture vectors (v1.2) both outlived their docs.
