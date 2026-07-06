---
phase: 6
slug: tracker-engine
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-05
updated: 2026-07-06T00:15:59Z
---

# Phase 6 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest + Testing Library for web; plain-Node `scripts/verify-rls.ts`; Supabase local migrations/seeding |
| Config file | `apps/web/vitest.config.ts`; `scripts/verify-rls.ts`; root `package.json` scripts |
| Quick run command | `pnpm --filter @fish/web test -- <changed test files>` |
| Full suite command | `pnpm build && pnpm lint && pnpm typecheck && pnpm verify:rls` |
| Estimated runtime | About 5-15 minutes depending on Docker/Next font cache |

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 06-01-01 | 01 | TRAK-01, TRAK-04, XC-02 | migration + typecheck | `pnpm db:reset`; `pnpm --filter @fish/supabase typecheck`; `pnpm --filter @fish/web typecheck` | green |
| 06-01-02 | 01 | TRAK-03, TRAK-04, TRAK-05, XC-01 | live RLS + seed | `pnpm seed`; `pnpm verify:rls` | green |
| 06-02-01 | 02 | TRAK-01, TRAK-03, TRAK-05, XC-03 | component/action tests | `pnpm --filter @fish/web test -- apps/web/components/tracker/tracker-entry-flow.test.tsx apps/web/app/(authenticated)/tracker/actions.test.ts apps/web/lib/validation/tracker.test.ts` | green |
| 06-02-02 | 02 | TRAK-05, XC-03 | source + UI contract scan | `rg` forbidden progress/schema terms; focused tracker tests | green |
| 06-03-01 | 03 | TRAK-02 | source authorization review + build | `rg` checks over `supabase/functions/assign-tracker/index.ts`; `pnpm build` | green |
| 06-03-02 | 03 | TRAK-06, XC-01, XC-03 | component + RLS | `pnpm --filter @fish/web test -- apps/web/components/tracker/coach-tracker-review.test.tsx apps/web/app/(authenticated)/coach/clients/[id]/page.test.tsx`; `pnpm verify:rls` | green |

## Executed Evidence

- `pnpm --filter @fish/supabase typecheck` - passed.
- `pnpm --filter @fish/web typecheck` - passed before and after the shared formatter / coach-name fix.
- Focused Vitest tracker/onboarding run - 53 files passed, 356 tests passed.
- `pnpm db:reset` - passed after escalating for Docker/local Supabase access.
- `pnpm seed` - passed after removing stale version-scoped milestone seeding.
- `pnpm verify:rls` - passed, including tracker draft privacy, draft commit cleanup, progress rows, coach progress gating, malformed config/answer rejection, and immutable used version/field checks.
- `pnpm build` - passed after escalating for restricted Google Fonts/network access.
- `pnpm lint` - passed.

## Manual-Only Verifications

| Behavior | Requirement | Result | Notes |
|----------|-------------|--------|-------|
| Browser visual calm scan | TRAK-01, TRAK-03, TRAK-05, XC-03 | covered by component markup and final local dev smoke | Client surface has one primary action, no picker/gallery, notice-tone failure copy, and no visible score/streak/adherence copy. |
| Edge Function live HTTP invocation | TRAK-02 | source-verified; not required for `verify:rls` | Function source and registration are present. It derives caller/version server-side and uses a caller-scoped `coach_clients` filter before the service-role write. |

## Validation Sign-Off

- [x] All tasks have automated verification or documented source/manual coverage.
- [x] No 3 consecutive tasks without automated verification.
- [x] Wave 0 gaps are closed.
- [x] No watch-mode flags used.
- [x] Feedback latency stayed within the phase budget.
- [x] `nyquist_compliant: true` set in frontmatter.

Approval: verified 2026-07-06.

## Validation Audit 2026-07-06

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

Resolved gaps:
- Replaced stale version-scoped milestone assumptions in the implementation with assignment-owned progress rows and private draft rows.
- Extracted the shared answer formatter and restored coach-name milestone copy before closeout.
