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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 3 | 16 (5 gap-closure) | Established verify-against-shipped-bytes + live-DB gates + checkpoint-driven UAT |

### Cumulative Quality

| Milestone | Tests | Live Gates | Requirements |
|-----------|-------|------------|--------------|
| v1.0 | 173 (Vitest) | verify:rls 8/8 | 28/28 satisfied |

### Top Lessons (Verified Across Milestones)

1. (First milestone — lessons above await cross-validation in v1.1+.)
