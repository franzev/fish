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
| 05-01-01 | 05-01 | 1 | ONBD-01, ONBD-03, ONBD-05, ONBD-06, ONBD-07 | T-05-01 / T-05-02 | Schema derives client from `auth.uid()`, pins versions, and rejects used-version mutation | migration/RLS | `pnpm db:reset` | ❌ W0 | ⬜ pending |
| 05-01-02 | 05-01 | 1 | ONBD-01, ONBD-02, ONBD-06 | T-05-02 | Seed creates one active neutral assessment with all six answer types and no picker/scoring data | seed/types | `pnpm db:reset && pnpm seed && pnpm typecheck` | ❌ W0 | ⬜ pending |
| 05-01-03 | 05-01 | 1 | ONBD-03, ONBD-05, ONBD-07 | T-05-01 / T-05-06 | Live RLS proves self-save, resume, assigned-coach read, unassigned/cross-client denial, malformed config rejection, and finalize lock | RLS/integration | `pnpm db:reset && pnpm seed && pnpm verify:rls` | ❌ W0 | ⬜ pending |
| 05-02-01 | 05-02 | 1 | ONBD-02 | T-05-04 | Shared schemas reject malformed configs and answers for all six field types | unit | `pnpm --filter @fish/web test -- --run apps/web/lib/validation/onboarding.test.ts && pnpm typecheck` | ❌ W0 | ⬜ pending |
| 05-02-02 | 05-02 | 1 | ONBD-02, ONBD-04 | T-05-04 | Renderer uses config-only accessible controls with 56px targets and no hard-coded question keys | component | `pnpm --filter @fish/web test -- --run apps/web/components/fields/field-renderer.test.tsx && pnpm --filter @fish/web typecheck` | ❌ W0 | ⬜ pending |
| 05-02-03 | 05-02 | 1 | ONBD-04 | — | Conversation shows one current question, calm status, visual progress, no picker, and no judgement copy | component | `pnpm --filter @fish/web test -- --run apps/web/components/onboarding/onboarding-conversation.test.tsx && pnpm --filter @fish/web typecheck` | ❌ W0 | ⬜ pending |
| 05-03-01 | 05-03 | 2 | ONBD-01, ONBD-02, ONBD-03, ONBD-06 | T-05-01 / T-05-04a / T-05-05 | Server Actions re-check session, load question config, validate answer against config, and call RPC without trusted client ids | action/integration | `pnpm --filter @fish/web test -- --run 'apps/web/app/(authenticated)/onboarding/actions.test.ts' && pnpm --filter @fish/web typecheck` | ❌ W0 | ⬜ pending |
| 05-03-02 | 05-03 | 2 | ONBD-01, ONBD-03, ONBD-04, ONBD-06 | T-05-03 | `/onboarding` renders only assigned active assessment, persists/resumes state, and exposes no chooser or score copy | route/component/RLS | `pnpm --filter @fish/web test -- --run 'apps/web/app/(authenticated)/onboarding/page.test.tsx' 'apps/web/app/(authenticated)/home/page.test.tsx' && pnpm build && pnpm verify:rls` | ❌ W0 | ⬜ pending |
| 05-04-01 | 05-04 | 3 | ONBD-07 | T-05-06 | Coach review displays ordered pinned answers read-only with calm empty/partial/submitted states | component | `pnpm --filter @fish/web test -- --run apps/web/components/onboarding/coach-onboarding-review.test.tsx && pnpm --filter @fish/web typecheck` | ❌ W0 | ⬜ pending |
| 05-04-02 | 05-04 | 3 | ONBD-07 | T-05-06 | Assigned coach detail includes inline review; malformed/unassigned/unknown clients reveal no onboarding detail | page/RLS/release | `pnpm --filter @fish/web test -- --run 'apps/web/app/(authenticated)/coach/clients/[id]/page.test.tsx' apps/web/components/onboarding/coach-onboarding-review.test.tsx && pnpm build && pnpm lint && pnpm typecheck && pnpm verify:rls` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/*_onboarding.sql` — versioned onboarding tables, command functions, RLS policies, grants, and seed-safe active assessment data.
- [ ] `scripts/verify-rls.ts` — live assertions for client writes, assigned coach reads, unassigned coach denial, version immutability, and exact response version pinning.
- [ ] `packages/core/src/onboarding.ts` or equivalent — shared answer/config contracts for six answer types.
- [ ] `packages/supabase/src/database.types.ts` — regenerated Supabase type contracts after migration.
- [ ] `apps/web/lib/validation/onboarding.test.ts` — schema/validator stubs for six answer types and config-aware answer rejection.
- [ ] `apps/web/app/(authenticated)/onboarding/actions.test.ts` — Server Action tests for session re-check, schema shape validation, config-aware rejection before RPC, calm failure copy, and save/finalize success.
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
