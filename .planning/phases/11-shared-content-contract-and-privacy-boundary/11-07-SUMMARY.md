---
phase: 11-shared-content-contract-and-privacy-boundary
plan: 07
subsystem: api
tags: [supabase, edge-functions, dns, ssrf, link-previews, privacy]

# Dependency graph
requires:
  - phase: 11-shared-content-contract-and-privacy-boundary
    provides: "Version-2 safe-link proof columns and privacy projection from Plan 06"
provides:
  - "DNS-validated first-safe canonical link persistence"
  - "No-egress legacy link-preview job drain"
  - "Deployed hardened send-message and link-preview consumers"
affects: [phase-11-linked-verification, phase-12-shared-content-runtime, phase-14-source-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected A/AAAA resolver contract with Deno.resolveDns production implementation"
    - "Version-2 proof is written only after a nonempty all-public DNS answer union"
    - "Optional preview enrichment is disabled; legacy jobs are boundedly terminalized"

key-files:
  created: []
  modified:
    - supabase/functions/_shared/link-preview.ts
    - supabase/functions/_shared/link-preview.test.ts

key-decisions:
  - "Canonical link identity is the first source URL that passes lexical and complete DNS validation; redirect destinations are never followed or persisted."
  - "No server-side preview fetch primitive remains; pending and stranded processing jobs fail with preview_fetch_disabled without changing canonical rows."

patterns-established:
  - "HostAddressResolver keeps DNS behavior deterministic and injectable in Node tests while production uses only Deno.resolveDns."
  - "Canonical proof upserts retain first-link conflict-ignore semantics and leave metadata nullable until a future explicitly authorized path exists."

requirements-completed: [DISC-03, PRIV-01]

# Metrics
duration: 6min
completed: 2026-07-22
---

# Phase 11 Plan 07: DNS-safe canonical links and no-egress preview drain Summary

**DNS-proven version-2 link identities now survive without metadata enrichment, while redirects, rebinding, and legacy preview jobs have no outbound request path.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-22T15:27:16Z
- **Completed:** 2026-07-22T15:32:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `HostAddressResolver`, a Deno `A`/`AAAA` resolver, deterministic address normalization, and fail-closed public-address validation for canonical link selection.
- Changed enqueue to persist only the first DNS-safe URL with `safe_link_validation_version: 2` and `safe_link_validated_at`; new messages create no enrichment job.
- Removed metadata fetch, redirect-following, and retry egress. Bounded pending/processing compatibility jobs now transition to `failed` with `preview_fetch_disabled` without touching canonical rows.
- Added injected DNS, private/mixed/malformed/empty/error, first-safe-candidate, proof, conflict-ignore, no-fetch, and legacy-drain regressions.

## Task Commits

Each repository task was committed atomically:

1. **Task 1 RED: Add DNS-safe and no-egress regression coverage** - `6357bd24` (test)
2. **Task 1 GREEN: Validate DNS-safe canonical link identities** - `1a49280e` (feat)
3. **Task 2: Deploy the hardened shared helper consumers** - deployment-only; no repository commit

**Plan metadata:** pending; summary, state, and roadmap synchronization are committed in the final metadata commit.

## TDD Gate Compliance

- RED gate: `6357bd24` contains the focused tests and failed before implementation because the new exports were absent.
- GREEN gate: `1a49280e` contains the implementation; the focused suite passed 9/9.
- REFACTOR gate: not needed; no behavior-preserving cleanup remained after GREEN.

## Files Created/Modified

- `supabase/functions/_shared/link-preview.ts` - DNS-aware canonical validation, version-2 proof persistence, no-egress compatibility drain, and pure address parsing.
- `supabase/functions/_shared/link-preview.test.ts` - deterministic resolver doubles and SSRF, identity, proof, no-fetch, and legacy-job regressions.

## Verification

- `node --experimental-strip-types --test supabase/functions/_shared/link-preview.test.ts` - passed 9/9.
- `pnpm build` - passed.
- `pnpm lint` - passed.
- `pnpm typecheck` - passed.
- Linked migration `0062` was present before deployment.
- Exact deployment command `supabase functions deploy send-message link-preview --use-api --yes` passed.
- `send-message`: UUID `064cb2da-f101-4213-87b6-08c0ef71ef57`, version `4`, digest `eef74b44c066d9f4fce19d46179800dcfceb76af074e184759d32b2b1d85d8b3`, status `ACTIVE`.
- `link-preview`: UUID `adba2572-9217-4b17-b86b-5120b392280d`, version `1`, digest `05310e77f9af518979801999f4b8320115f39ca823181fa2a26a0d837e7f1752`, status `ACTIVE`.
- Source egress scan found no `fetch` call in the shared implementation; the only fetch references are test traps proving zero calls.
- No dependency or lockfile change.

## Decisions Made

- DNS answers are validated as a union: one empty family is allowed only when the other family supplies at least one public answer; any malformed, operational-error, private, reserved, or mixed result fails closed.
- Canonical identity and proof are immutable after the first successful conflict-ignore upsert; nullable metadata is never synthesized by the disabled enrichment path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first deployment wrapper invocation was rejected before execution because its temporary-directory cleanup trap matched a prohibited command pattern. It was retried without the trap; no Supabase command ran during the rejected attempt, and the required deployment then succeeded.
- Node emitted its existing module-type performance warning while running the focused TypeScript tests; all tests passed.

## Known Stubs

None found in the files created or modified by this plan. Nullable preview metadata is an intentional no-egress contract, not a placeholder data source.

## Threat Surface Review

No new trust boundary was introduced outside the plan threat model. The implementation removes outbound preview egress, validates DNS answers before proof, and keeps diagnostics free of URLs, hostnames, addresses, message IDs, bodies, and credentials.

## Authentication Gates

None. The project-local environment supplied the linked Supabase token after sourcing; its value was never printed or persisted.

## Next Phase Readiness

The linked runtime now consumes the tested DNS-validated/no-egress shared helper revisions. Plan 11 can perform hosted adversarial verification against the captured ACTIVE revisions and version-2 proof boundary.

---
*Phase: 11-shared-content-contract-and-privacy-boundary*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Summary file exists at the expected phase path.
- Task commits `6357bd24` and `1a49280e` exist in repository history.
- Focused tests, build, lint, typecheck, linked migration verification, and both targeted function deployments passed.
