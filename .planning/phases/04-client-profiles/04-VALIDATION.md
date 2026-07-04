---
phase: 4
slug: client-profiles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` § Validation Architecture (live-verified against the running local stack).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.9 (`apps/web/vitest.config.ts`, already configured) for component/unit tests + the standalone `scripts/verify-rls.ts` Node harness (live-DB RLS/grant assertions via real PostgREST) |
| **Config file** | `apps/web/vitest.config.ts` (+ `vitest.setup.ts`); `scripts/verify-rls.ts` is a plain async script that exits non-zero on failure |
| **Quick run command** | `pnpm --filter @fish/web test` |
| **Full suite command** | `pnpm build && pnpm verify:rls` (the two release gates named in ROADMAP.md Phase 4 SC #5) |
| **Estimated runtime** | ~30–90 seconds (build dominates) |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @fish/web typecheck` + the relevant co-located Vitest file
- **After every plan wave:** `pnpm build` + `pnpm verify:rls` (full six-assertion RLS suite against the local stack)
- **Before `/gsd-verify-work`:** Both `pnpm build` and `pnpm verify:rls` must be green (ROADMAP.md Phase 4 SC #5)
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PROF-01 | Client reads own `client_profiles` row | RLS live-assertion | `pnpm verify:rls` (new `checkClientProfileSelfRead()`) | ❌ W0 | ⬜ pending |
| PROF-02 | Client edits safe fields; change persists | RLS live-assertion + component | `pnpm verify:rls` (safe-update-succeeds) + `pnpm --filter @fish/web test` | ❌ W0 | ⬜ pending |
| PROF-03 | ≤3 a11y prefs, default to system | Component (control count) + manual visual | `pnpm --filter @fish/web test` | ❌ W0 | ⬜ pending |
| PROF-04 | Consent recorded as fields (write succeeds, fields populate) | RLS live-assertion | `pnpm verify:rls` | ❌ W0 | ⬜ pending |
| PROF-05 | Protected `level` change rejected at DB (privilege layer + trigger) | RLS live-assertion | `pnpm verify:rls` (new `checkLevelFreezeRejected()`, modeled on existing `checkEscalationRejected()`) | ❌ W0 | ⬜ pending |
| PROF-06 | Coach reads assigned client read-only; unassigned denied; cross-client denied | RLS live-assertion (positive + negative) | `pnpm verify:rls` (new `checkCoachReadsAssignedClientProfile()` + `checkUnassignedCoachDenied()` + cross-client) | ❌ W0 | ⬜ pending |
| XC-01 | `verify:rls` gate: self / safe-update / assigned-coach / unassigned-denial / cross-client-denial / field-freeze | RLS live-assertion suite (six assertions, D-15) | `pnpm verify:rls` | ❌ W0 | ⬜ pending |
| XC-03 | Design line (one action, 56px, calm copy, no lost work) | Manual/visual review | Review vs `docs/ui-ux-agent-guidelines.md` + `sketch-findings-fish` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Critical pitfall (from RESEARCH.md Pitfall 1):** RLS/grant assertions MUST go through real PostgREST (anon-key sign-in, exactly as `scripts/verify-rls.ts` already does). A `SET ROLE authenticated` sandbox test produces a false pass locally because the `postgres` connection role is a member of `authenticated`/`service_role` and table ownership bypasses privilege checks.

---

## Wave 0 Requirements

- [ ] `scripts/verify-rls.ts` — six new assertion functions (self-read, safe-update-succeeds, assigned-coach-read, unassigned-coach-denial, cross-client-denial, protected-field-freeze) for `client_profiles`, modeled on the existing `checkClientBoundary()` / `checkEscalationRejected()` / `checkClientReadsCoachName()` — same `signInAs()` helper, same `report()` conventions.
- [ ] `scripts/seed.ts` — idempotent `client_profiles` backfill (`insert ... on conflict do nothing`) + a seeded `level` for the dev clients so `pnpm seed` stays idempotent pre/post migration.
- [ ] `pnpm --filter @fish/web add zod` — the one net-new dependency (zod@4.4.3, legitimacy-audited in RESEARCH.md).
- [ ] Co-located `*.test.tsx` for new profile components (matches existing UI-kit convention) — no new Vitest config needed.

*Existing infrastructure (Vitest + verify-rls harness) covers all phase requirements; only new test bodies/components are needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Design line holds (one primary action, 56px targets, monochrome, calm copy, no lost draft on refresh) | XC-03, PROF-* | No automated design-line/a11y assertion exists in this codebase's tooling today | Review profile view, `/profile/edit`, and coach `/coach/clients/[id]` against `docs/ui-ux-agent-guidelines.md` and the `sketch-findings-fish` skill; confirm dev preview renders both themes |
| Text-size CSS scale correctness (Default/Large/Larger) | PROF-03 | `contrast.test.ts` covers color only; CSS scale is authored stylesheet rules verified against served/compiled CSS | Toggle each step in dev preview, confirm root font-size scales and layout stays stable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (verify-rls assertions, seed backfill, zod)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
