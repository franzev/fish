---
phase: 04-client-profiles
slug: client-profiles
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-05
verified: 2026-07-05
register_authored_at_plan_time: true
source_plans:
  - 04-01-PLAN.md
  - 04-02-PLAN.md
  - 04-03-PLAN.md
---

# Phase 04 - Security

Per-phase security contract for Phase 04 client profiles: threat register,
accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client browser -> PostgREST/Supabase | An authenticated client, or direct REST caller with a valid client JWT, can attempt profile reads and writes. RLS plus column grants are the enforcement boundary. | `profiles`, `client_profiles`, coach assignment ids, client profile settings |
| service_role seed -> database | Trusted local seed/setup path. It may set coach-owned `level` values and bypasses the authenticated freeze trigger by design. | Seeded users, coach assignments, seeded `level` values |
| client browser -> Server Action POST | Profile edit and preference writes are directly POST-reachable and must re-verify auth inside the action. | Display name, goal, locale, timezone, preferences, consent fields |
| client browser -> PostgREST write path | Server Action writes still land under the `client_profiles` RLS policy and column-scoped update grant. | Safe client profile fields only |
| coach browser -> `/coach/clients/[id]` | A coach can request any client UUID. RLS decides whether any client profile row is visible. | Client identity, goal, level for assigned clients only |

## Summary Threat Flags

No unresolved `## Threat Flags` entries were found in the phase summaries. The
three plan-time threat models were parseable, so this audit verified the
authored register instead of running retroactive STRIDE.

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | Elevation of Privilege | Client attempts to update own `level` | mitigate | `supabase/migrations/0007_client_profiles.sql` grants authenticated updates only to safe columns and never names `level`; `prevent_level_change` trigger rejects authenticated `level` changes. `pnpm verify:rls` passed `PROF-05 level freeze`. | closed |
| T-04-02 | Information Disclosure | Unassigned coach enumerates client UUIDs through `client_profiles` or `/coach/clients/[id]` | mitigate | Coach read policy uses `private.is_coach_of(id)`. `findByIdForCoach` relies on that RLS query, malformed ids return the same null shape, and the page renders the same calm notice for missing and unassigned clients. `pnpm verify:rls` passed `PROF-06 unassigned coach denied`. | closed |
| T-04-03 | Information Disclosure | Client reads another client's `client_profiles` row by direct REST | mitigate | Self-read/self-update policies gate on `id = auth.uid()`. `pnpm verify:rls` passed `PROF-05/06 cross-client denied`. | closed |
| T-04-04 | Tampering | Future migration accidentally widens the `level` grant | mitigate | Independent `prevent_level_self_escalation()` trigger remains in the database migration and raises if authenticated callers change `level`, even if a later grant is widened. | closed |
| T-04-SC | Tampering | New `zod` dependency supply-chain risk | mitigate | `zod` is installed only in `apps/web/package.json` as `^4.4.3`; no root or `packages/core` dependency was introduced. Phase research documented package legitimacy before adoption. | closed |
| T-04-05 | Spoofing | Forged or stale cookie presented to profile Server Actions | mitigate | `updateProfileAction`, `updatePrefsAction`, and `acceptConsentAction` call `services.auth.getCurrentUser()` inside the action before writes. Profile web tests passed. | closed |
| T-04-06 | Elevation of Privilege | Edit payload smuggles `level` or `role` | mitigate | `editProfileSchema` has no protected-field keys; `ClientProfileSafeFields` structurally excludes `level`; `updateSafeFields` is the only client profile write path used by the actions; DB grant/trigger remains the load-bearing backstop. | closed |
| T-04-07 | Denial of Service | Oversized `goal` text submitted to the edit action | mitigate | `editProfileSchema` trims `goal` and caps it with `.max(2000)` before persistence. Profile web tests passed. | closed |
| T-04-08 | Tampering | Preference CSS applied through inline style instead of compiled stylesheet rules | mitigate | `apply-prefs.ts` only flips `document.documentElement.dataset`; `globals.css` contains stylesheet rules for `html[data-theme]`, `html[data-text-size]`, and `html[data-reduced-motion]`; no inline style mutation is used in the preference helpers. Profile web tests passed. | closed |
| T-04-09 | Information Disclosure | Coach detail leaks client a11y preferences or consent | mitigate | `CoachClientDetail` DTO and `/coach/clients/[id]` page expose only display name, goal, and level. Preferences and consent are not selected into the coach detail path. | closed |
| T-04-10 | Spoofing | Client reaches the coach detail route | mitigate | `/coach/clients/[id]` resolves the current profile and redirects clients to the client home before rendering coach-only data. | closed |

## Accepted Risks Log

No accepted risks.

## Verification Evidence

| Check | Result |
|-------|--------|
| `pnpm verify:rls` | pass - 14 assertions passed, including self-read, safe update, level freeze, assigned coach read, unassigned coach denial, and cross-client denial |
| `pnpm --filter @fish/web test -- --run profile` | pass - 36 test files, 248 tests |
| Plan-time threat model parse | pass - threat models found in `04-01-PLAN.md`, `04-02-PLAN.md`, and `04-03-PLAN.md` |
| Security enforcement config | pass - `workflow.security_enforcement` is `true` |

## Security Audit 2026-07-05

| Metric | Count |
|--------|-------|
| Threats found | 11 |
| Closed | 11 |
| Open | 0 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-05 | 11 | 11 | 0 | Codex `$gsd-secure-phase 4` |

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

Approval: verified 2026-07-05
