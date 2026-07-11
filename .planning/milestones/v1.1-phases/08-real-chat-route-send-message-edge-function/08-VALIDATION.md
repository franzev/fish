---
phase: 08
slug: real-chat-route-send-message-edge-function
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-05T20:28:30+08:00
updated: 2026-07-06T07:43:12+08:00
---

# Phase 08 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest, Playwright, Supabase RLS verifier, Next build |
| Config file | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm --filter @fish/web typecheck` |
| Full suite command | `pnpm --filter @fish/web e2e && pnpm verify:rls && pnpm build && pnpm lint && pnpm typecheck` |
| Estimated runtime | About 25 seconds locally after Supabase is warm |

## Sampling Rate

- After chat or tracker service edits: `pnpm --filter @fish/web typecheck`.
- After route/client changes: Vitest chat/tracker component tests.
- After Edge Function or RLS-sensitive changes: direct Edge Function smoke plus `pnpm verify:rls`.
- Before sign-off: Playwright E2E, RLS verifier, build, lint, and workspace typecheck.

## Per-Task Verification Map

| Task ID | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|-------------|-----------------|-----------|-------------------|--------|
| 08-01-chat-send | CHAT-02 | Real Edge Function persists via trusted RPC, with JWT-derived sender | E2E + RLS | `pnpm --filter @fish/web e2e`, `pnpm verify:rls` | green |
| 08-01-optimistic | CHAT-03 | Sending state reconciles to sent or failed without silent drop | Unit + E2E | `pnpm --filter @fish/web test -- --run ...chat-client.test.tsx`, `pnpm --filter @fish/web e2e` | green |
| 08-01-draft | CHAT-05 | Failed sends keep composer text and expose retry | Unit | `pnpm --filter @fish/web test -- --run ...chat-client.test.tsx` | green |
| 08-01-invalid | CHAT-07 | Blank and oversized messages return calm notice copy | Unit + RLS | `pnpm --filter @fish/web test -- --run ...chat/actions.test.ts`, `pnpm verify:rls` | green |
| 08-01-cross-role | XC-04 | Onboarding, tracker, and chat cross-role flows pass through the app | E2E | `pnpm --filter @fish/web e2e` | green |

## Validation Refresh 2026-07-06

| Gate | Result | Evidence |
|------|--------|----------|
| Stale tracker draft contract scan | passed | `rg` scan returned no matches across tracker app/service/generated/migration surfaces. |
| Unit/component tests | passed | 53 files, 354 tests passed. |
| Typecheck | passed | `pnpm typecheck` |
| Lint | passed | `pnpm lint` |
| Build | passed | `pnpm build` with network escalation for Google Fonts |
| DB reset | passed | `pnpm db:reset` applied migrations 0001-0010. |
| Direct Edge Function smoke | passed | Signed-in POST to `/functions/v1/send-message` returned 200 and persisted a `messages` row. |
| RLS/security verifier | passed | `pnpm verify:rls` all assertions passed. |
| Browser E2E | passed | `pnpm --filter @fish/web e2e` 3 passed. |

## Manual-Only Verifications

None. All Phase 8 behaviors have automated coverage through browser, unit, type, build, lint, and live Supabase RLS checks.

## Validation Audit 2026-07-05

| Metric | Count |
|--------|-------|
| Requirements checked | 5 |
| Automated gaps found | 0 |
| Manual-only items | 0 |
| Open validation gaps | 0 |

## Open Validation Gaps

None.

## Validation Sign-Off

- [x] All Phase 8 requirements have automated verification.
- [x] XC-04 browser E2E covers the three required cross-role flows.
- [x] Security/RLS assertions are green on the current migration set.
- [x] Build, lint, typecheck, and Vitest are green.
- [x] `nyquist_compliant: true` set in frontmatter.

Approval: verified 2026-07-06
