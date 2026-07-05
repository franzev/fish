---
phase: 4
slug: client-profiles
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-04
updated: 2026-07-05
audited: 2026-07-05
---

# Phase 4 - Validation Strategy

Per-phase validation contract for Phase 4 after retroactive Nyquist audit.
Phase 4 covers client profile ownership, safe profile edits, accessibility
preferences, consent fields, DB-protected `level`, and coach read-only client
detail.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 (`apps/web/vitest.config.ts`) for unit/component/route tests; `scripts/verify-rls.ts` for live Supabase RLS/grant assertions through real PostgREST |
| Config file | `apps/web/vitest.config.ts` + `apps/web/vitest.setup.ts`; `scripts/verify-rls.ts` runs through `node --experimental-strip-types --env-file=apps/web/.env.local` |
| Quick command | `pnpm --filter @fish/web test -- --run` |
| Release gates | `pnpm lint && pnpm typecheck && pnpm build && pnpm verify:rls` |
| Last audited run | 2026-07-05: web tests 260/260, RLS 14/14, lint/typecheck/build green |

## Sampling Rate

- After every task commit: `pnpm --filter @fish/web typecheck` and the relevant co-located Vitest file.
- After every plan wave: `pnpm build` and `pnpm verify:rls`.
- Before phase close: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm verify:rls`, and `pnpm --filter @fish/web test -- --run`.
- Max automated feedback latency observed in this audit: under 15 seconds for each gate except full build, still under the phase's 90-second target.

## Per-Task Verification Map

| Requirement | Behavior | Automated Evidence | Test Files / Commands | Status |
|-------------|----------|--------------------|------------------------|--------|
| PROF-01 | Client reads own `client_profiles` row and sees profile essentials | Live RLS self-read; profile source has zero primary buttons; profile data path verified in phase report | `pnpm verify:rls` (`checkClientProfileSelfRead`); `apps/web/app/(authenticated)/profile/page.tsx` source invariant | Green |
| PROF-02 | Client edits safe fields; typed text survives failures; locale/timezone are browser-derived, never pickers | Server Action tests cover invalid input, split two-table write, calm failure notice, session re-check, no protected-field write | `apps/web/app/(authenticated)/profile/edit/actions.test.ts`; `apps/web/lib/validation/profile.test.ts`; `pnpm --filter @fish/web test -- --run` | Green |
| PROF-03 | At most three a11y prefs, default to system, apply instantly, persist safely, and can clear back to system/null | Component tests cover exactly three controls, default selections, click-to-apply/persist, and clearing system values; helper tests cover `data-*` flips | `apps/web/components/profile/a11y-prefs.test.tsx`; `apps/web/lib/prefs/apply-prefs.test.ts`; `apps/web/app/(authenticated)/profile/edit/actions.test.ts` (`updatePrefsAction`) | Green |
| PROF-04 | Consent recorded as boolean + timestamp + version through safe fields | RLS proves consent fields are writable; Server Action and component tests cover consent write and settled accepted row | `pnpm verify:rls` (`checkClientProfileSafeUpdateSucceeds`); `apps/web/app/(authenticated)/profile/edit/actions.test.ts` (`acceptConsentAction`); `apps/web/components/profile/consent-row.test.tsx` | Green |
| PROF-05 | Protected `level` change rejected at DB, not just app code | Live PostgREST update attempt is rejected; app action source never references protected field | `pnpm verify:rls` (`checkLevelFreezeRejected`); `apps/web/app/(authenticated)/profile/edit/actions.test.ts` source invariant | Green |
| PROF-06 | Coach reads assigned client read-only; unassigned/guessed client denied without leak; roster rows link to details | Live RLS positive/negative checks; coach detail route tests calm not-found/read-only/no prefs; UUID guard tests malformed ids; roster link tests assert hrefs | `pnpm verify:rls`; `apps/web/app/(authenticated)/coach/clients/[id]/page.test.tsx`; `apps/web/lib/auth/server.test.ts`; `apps/web/components/coach/client-list.test.tsx` | Green |
| XC-01 | RLS gate for new table covers self, safe update, assigned coach, unassigned coach, cross-client, protected-field freeze | Six Phase 4 `client_profiles` assertions are wired into `scripts/verify-rls.ts` and pass live | `pnpm verify:rls` | Green |
| XC-02 | zod used only in `apps/web`; no `packages/core` zod dependency | Schema tests cover trim, empty name, valid payload, and `level` stripping | `apps/web/lib/validation/profile.test.ts`; package scan from phase verification | Green |
| XC-03 | Design line: one primary action, 56px rows, calm copy, monochrome, no lost work on refresh | Automated source/component coverage for primary-action count, calm notices, row links, read-only coach detail, and failure preservation; visual theme/served-CSS review remains manual-only | Vitest/source checks listed above; manual-only section below | Green with manual visual sign-off |

## Generated Tests From Audit

The retroactive Nyquist pass filled three automation gaps:

| Gap | Resolution |
|-----|------------|
| PROF-03 preference apply/persist behavior was only partially tested | Extended `apps/web/components/profile/a11y-prefs.test.tsx` and added `apps/web/lib/prefs/apply-prefs.test.ts` |
| PROF-04 consent write and row interaction were not directly tested | Extended `apps/web/app/(authenticated)/profile/edit/actions.test.ts` and added `apps/web/components/profile/consent-row.test.tsx` |
| PROF-06 coach roster link hrefs were not directly asserted | Updated `apps/web/components/coach/client-list.test.tsx` to assert sorted `/coach/clients/[id]` links |

One implementation defect was fixed while adding tests: selecting "System" for
theme or reduced motion could persist the previous value because the component
used nullish fallback when composing the next preference payload. `A11yPrefs`
now persists an explicit full next object so `null` remains `null`.

## Manual-Only Verifications

These are intentionally routed to human UAT rather than counted as missing
automated Nyquist coverage. The current repo has no Playwright/browser visual
test setup for Phase 4, and `.planning/phases/04-client-profiles/04-VERIFICATION.md`
already marks these as `human_needed`.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual design-line review of `/profile` and `/profile/edit` in both themes | XC-03, PROF-01..04 | No visual/design-line test harness exists; source/unit tests cover primary-action count, failure preservation, calm notice copy, and behavior, but not pixels/theme rendering | Walk both routes in a running dev server; confirm `/profile` has zero primary buttons, `/profile/edit` has one Save primary, rows are at least 56px, copy is calm, and both themes render cleanly |
| Served CSS text-size scale correctness | PROF-03, XC-03 | Static tests cover data attributes and helper behavior; Lightning CSS/served output needs a browser to judge layout stability | Toggle Default/Large/Larger in dev preview; confirm root font-size changes and layout remains stable |
| Visual design-line review of `/coach/clients/[id]` in both themes | XC-03, PROF-06 | Route/component tests cover read-only, calm not-found, hidden prefs/consent, and link hrefs; keyboard focus and visual tone still need an eyeball in a running browser | Walk assigned, unassigned, and malformed-id paths; confirm calm notice tone, level-as-data, no primary button, hidden prefs/consent, and focus-visible roster links |

## Validation Audit 2026-07-05

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |
| New test files | 2 |
| Existing test files extended | 3 |
| Implementation fixes | 1 |

### Commands Run

| Command | Result |
|---------|--------|
| `pnpm --filter @fish/web test -- --run apps/web/lib/prefs/apply-prefs.test.ts apps/web/components/profile/a11y-prefs.test.tsx apps/web/components/profile/consent-row.test.tsx apps/web/app/'(authenticated)'/profile/edit/actions.test.ts apps/web/components/coach/client-list.test.tsx apps/web/app/'(authenticated)'/coach/clients/'[id]'/page.test.tsx apps/web/lib/auth/server.test.ts` | Pass: 38 test files, 260 tests |
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm build` | Pass: 17 routes |
| `pnpm verify:rls` | Pass: 14/14 live assertions, including all six `client_profiles` checks |

## Validation Sign-Off

- [x] Input state detected as State A: existing `04-VALIDATION.md` audited and updated.
- [x] PLAN/SUMMARY artifacts read and cross-referenced.
- [x] Test infrastructure detected.
- [x] Fillable gaps classified and resolved with automated tests.
- [x] Manual-only visual checks documented separately.
- [x] No watch-mode flags.
- [x] Release gates green.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** automated validation complete; human visual UAT remains tracked in `04-UAT.md`.
