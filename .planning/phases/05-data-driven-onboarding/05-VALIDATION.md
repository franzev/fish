---
phase: 5
slug: data-driven-onboarding
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
---

# Phase 5 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Testing Library for web; TypeScript verification scripts for Supabase/RLS |
| **Config file** | `apps/web/vitest.config.ts`; `scripts/verify-rls.ts`; `package.json` scripts |
| **Quick run command** | `pnpm --filter @fish/web test -- --run <changed test files>` |
| **Full suite command** | `pnpm build && pnpm lint && pnpm typecheck && pnpm verify:rls` |
| **Estimated runtime** | ~120-240 seconds |

---

## Sampling Rate

- **After every task commit:** Run the nearest changed-file Vitest or targeted TypeScript check.
- **After every plan wave:** Run `pnpm --filter @fish/web test -- --run` plus `pnpm verify:rls` after any migration/RLS work.
- **Before `$gsd-verify-work`:** Full suite must be green: `pnpm build && pnpm lint && pnpm typecheck && pnpm verify:rls`.
- **Max feedback latency:** 15 minutes for a wave; under 3 minutes for a targeted task check.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | ONBD-01..07 | T-05-01 / T-05-02 | Migration and seed tests can create/read versioned onboarding config through authorized paths only | RLS / integration | `pnpm verify:rls` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 0 | ONBD-02 | — | Field config schemas reject malformed answer configs before rendering | unit | `pnpm --filter @fish/web test -- --run apps/web/lib/onboarding/field-config.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 0 | ONBD-03 | T-05-03 | Save/resume command preserves draft and exact resume position | integration | `pnpm --filter @fish/web test -- --run apps/web/lib/onboarding/onboarding-actions.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | ONBD-05 | T-05-04 | Used assessment versions cannot be mutated; answers pin version/question snapshots | RLS / SQL assertion | `pnpm verify:rls` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | ONBD-06 | T-05-05 | Client loads only the active assigned assessment, with no picker/list surface | route/component | `pnpm --filter @fish/web test -- --run apps/web/app/(authenticated)/onboarding/page.test.tsx` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | ONBD-07 | T-05-06 | Assigned coach can read; unassigned coach gets calm unavailable state and no row leak | RLS / page | `pnpm verify:rls && pnpm --filter @fish/web test -- --run apps/web/app/(authenticated)/coach/clients/[id]/page.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | ONBD-02 | — | All six answer types render from config with keyboard-reachable 56px controls | component | `pnpm --filter @fish/web test -- --run apps/web/components/fields/field-renderer.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 1 | ONBD-04 | — | Progress is visual and calm; no score, grade, streak, or judgement percentage copy | component / grep | `pnpm --filter @fish/web test -- --run apps/web/components/onboarding/onboarding-conversation.test.tsx` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 2 | ONBD-01 / ONBD-03 / ONBD-06 | T-05-03 | Client completes one-question-at-a-time flow, reloads, resumes, then shares with coach | integration | `pnpm --filter @fish/web test -- --run apps/web/app/(authenticated)/onboarding/page.test.tsx` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 2 | ONBD-07 | T-05-06 | Coach review is read-only, ordered by versioned question config, and hides unassigned clients | page / RLS | `pnpm verify:rls && pnpm --filter @fish/web test -- --run apps/web/app/(authenticated)/coach/clients/[id]/page.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/*_onboarding.sql` — versioned onboarding tables, command functions, RLS policies, grants, and seed-safe active assessment data.
- [ ] `scripts/verify-rls.ts` — live assertions for client writes, assigned coach reads, unassigned coach denial, version immutability, and exact response version pinning.
- [ ] `packages/core/src/onboarding.ts` or equivalent — shared answer/config contracts for six answer types.
- [ ] `packages/supabase/src/database.types.ts` — regenerated Supabase type contracts after migration.
- [ ] `apps/web/lib/onboarding/field-config.test.ts` — schema/validator stubs for six answer types.
- [ ] `apps/web/components/fields/field-renderer.test.tsx` — renderer coverage for six answer types and keyboard/focus basics.
- [ ] `apps/web/app/(authenticated)/onboarding/page.test.tsx` — assigned active assessment, one-question flow, save/resume, and no picker assertions.
- [ ] `apps/web/app/(authenticated)/coach/clients/[id]/page.test.tsx` — coach review partial/submitted/denied states.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser reload/resume proof | ONBD-03 | Automated tests cover service state; a browser smoke confirms user-visible exact resume behavior and copy tone | Start onboarding as a seeded client, answer at least two questions, reload/leave/return, confirm the same next question and saved answer transcript appear with non-scolding copy. |
| Visual calm/accessibility scan | ONBD-01, ONBD-04 | Automated tests catch markup/copy but not whole-screen focus calm | Inspect desktop and mobile viewport screenshots for one primary action, 56px controls, no chooser gallery, no score/grade/percentage judgement, and no text overlap. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15m
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-05
