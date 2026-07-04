---
phase: 04-client-profiles
plan: 03
subsystem: ui
tags: [nextjs, rls, coach-view, dynamic-route, supabase, release-gates]

# Dependency graph
requires:
  - phase: 04-01 (Client Profiles Schema)
    provides: client_profiles table, private.is_coach_of RLS policy for coach-read, level column
  - phase: 04-02 (Client Profile UI)
    provides: ClientProfileRepository + getProfileData server-data pattern to mirror, UI kit usage
provides:
  - "/coach/clients/[id] read-only coach detail view (identity + goal/role-context + level ONLY; a11y prefs & consent hidden)"
  - "getCoachClientDetailData(id) server data-access — RLS-gated via is_coach_of, returns null client for both no-such-client and not-your-client (no enumeration leak)"
  - "Coach roster rows linked to /coach/clients/[id] (client-list.tsx now renders next/link rows)"
  - "All four Phase 4 release gates green: pnpm build, pnpm verify:rls (14/14), pnpm lint, pnpm typecheck"
affects: [05-onboarding, 06-tracker, 08-chat-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coach read-only detail as a Server Component mirroring coach/page.tsx wrong-door guard + data-fetch shape; Next.js 16 async dynamic `params` (awaited before use)"
    - "Default-deny detail read: RLS (is_coach_of) returns zero rows for BOTH missing and unassigned clients → identical calm Alert tone=notice, no distinguishable 403 → no UUID enumeration side channel"
    - "Browser-only form values via useSyncExternalStore (server snapshot = DB value, client snapshot = navigator/Intl) instead of setState-in-effect — hydration-safe and lint-clean"

key-files:
  created:
    - apps/web/app/(authenticated)/coach/clients/[id]/page.tsx
  modified:
    - apps/web/lib/auth/server.ts
    - apps/web/components/coach/client-list.tsx
    - apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx
    - apps/web/app/(authenticated)/profile/edit/actions.test.ts

key-decisions:
  - "Coach detail hides a11y prefs + consent (D-10) — they are the client's personal settings, not coach-relevant; level rendered as a quiet data label, never a grade"
  - "Not-found and not-assigned render the identical Alert tone=notice (D-11) — no error that confirms/denies a UUID's existence"
  - "Replaced Wave-2's useEffect+setState browser-locale read with useSyncExternalStore to satisfy the lint release gate without regressing the hydration-safe, no-picker behavior (PROF-02)"

patterns-established:
  - "useSyncExternalStore for browser-derived, non-changing form values (locale/timezone) — the sanctioned alternative to setState-in-effect"

requirements-completed: [PROF-06]

coverage:
  - id: D1
    description: "Coach opens an assigned client's profile as a read-only detail view (identity + goal + level); reached from the roster"
    requirement: "PROF-06"
    verification:
      - kind: integration
        ref: "pnpm verify:rls#PROF-06 coach reads assigned client_profile: exactly one row"
        status: pass
      - kind: unit
        ref: "apps/web/components/coach/client-list.test.tsx (rows link to /coach/clients/[id])"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unassigned coach is denied with no cross-client leak and no UUID-enumeration side channel (zero rows → calm not-found)"
    requirement: "PROF-06"
    verification:
      - kind: integration
        ref: "pnpm verify:rls#PROF-06 unassigned coach denied: zero rows returned (no error, no leak)"
        status: pass
      - kind: integration
        ref: "pnpm verify:rls#PROF-05/06 cross-client denied: zero rows"
        status: pass
    human_judgment: false
  - id: D3
    description: "All four Phase 4 release gates green (ROADMAP SC #5)"
    verification:
      - kind: other
        ref: "pnpm build (17 routes) && pnpm verify:rls (14/14) && pnpm lint && pnpm typecheck"
        status: pass
      - kind: unit
        ref: "pnpm --filter @fish/web test (245 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Design line holds on the coach detail + roster (read-only, no primary button, 56px rows, monochrome, calm copy) — XC-03"
    verification: []
    human_judgment: true
    rationale: "No automated design-line/a11y assertion exists in this repo; requires a visual review in both themes"

# Metrics
duration: ~4min executor (interrupted) + inline closeout
completed: 2026-07-05
status: complete
---

# Phase 4 Plan 03: Coach Read-Only Client Detail Summary

**Read-only `/coach/clients/[id]` coach detail (identity + goal + level, no-leak default-deny), linked roster rows, and all four Phase 4 release gates green (build · verify:rls 14/14 · lint · typecheck)**

## Performance

- **Duration:** ~4 min executor (Task 1) before a session-limit interruption, then inline closeout of Task 2 + the lint gate
- **Completed:** 2026-07-05
- **Tasks:** 2/2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `/coach/clients/[id]` read-only detail view — a Server Component mirroring `coach/page.tsx`'s wrong-door guard, showing ONLY identity + goal/role-context + level (a11y prefs & consent hidden, D-10); level is a quiet data label, never a grade.
- `getCoachClientDetailData(id)` in `apps/web/lib/auth/server.ts` — RLS-gated via `private.is_coach_of`; returns a null client for BOTH "no such client" and "not your client", so the page renders one identical calm `Alert tone="notice"` — no 403, no enumeration side channel (D-11).
- Coach roster rows in `client-list.tsx` are now `next/link` rows to `/coach/clients/[id]` (keyboard-focusable, monochrome, ≥56px).
- All four Phase 4 release gates green: `pnpm build` (17 routes), `pnpm verify:rls` (14/14 — 8 existing + 6 new client_profiles assertions), `pnpm lint`, `pnpm typecheck`, plus `pnpm --filter @fish/web test` (245 tests).

## Task Commits

1. **Task 1: getCoachClientDetailData + read-only coach client detail view** — `8d8092b` (feat)
2. **Task 2: link coach roster rows to client detail** — `49ec385` (feat)
3. **Release-gate fix: lint (useSyncExternalStore + ESM test imports)** — `d9417ff` (fix)

## Files Created/Modified
- `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` — read-only coach client detail (created)
- `apps/web/lib/auth/server.ts` — `getCoachClientDetailData(id)` RLS-gated accessor
- `apps/web/components/coach/client-list.tsx` — roster rows became `/coach/clients/[id]` links
- `apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx` — `useSyncExternalStore` for browser locale/timezone (lint gate)
- `apps/web/app/(authenticated)/profile/edit/actions.test.ts` — ESM `node:fs`/`node:path` imports (lint gate)

## Decisions Made
- Coach view hides a11y prefs + consent (D-10); level shown as data, never a grade.
- Not-found and not-assigned are indistinguishable (D-11) — no enumeration leak.
- Fixed the lint gate at its root (`useSyncExternalStore`, ESM imports) rather than suppressing rules.

## Deviations from Plan

### Execution interruption + inline closeout
- **Found during:** Task 2. The spawned `gsd-executor` subagent hit a session usage limit after committing Task 1 (`8d8092b`), leaving the `client-list.tsx` link edit uncommitted and the release gates unrun.
- **Recovery:** Per the safe-resume "close out manually" path (production commit present, SUMMARY missing), the remaining work was completed inline: verified the two coach-view files against D-10/D-11, committed the roster link, ran the full gate suite, fixed the lint failures at root, and wrote this SUMMARY.

### Auto-fixed issues (lint release gate — introduced in Wave 2, caught by the Wave 3 gate)
**1. [react-hooks/set-state-in-effect] `edit-profile-form.tsx`**
- **Issue:** `useEffect` calling `setLocale`/`setTimezone` from `navigator`/`Intl` tripped the lint gate.
- **Fix:** Replaced with `useSyncExternalStore` (server snapshot = DB value, client snapshot = browser value) — hydration-safe and the React-sanctioned pattern for external/browser values.
- **Verification:** `pnpm lint` clean; 245 tests still pass.

**2. [@typescript-eslint/no-require-imports] `actions.test.ts`**
- **Issue:** `require("fs")`/`require("path")` in the source-assertion test.
- **Fix:** Converted to top-level `import { readFileSync } from "node:fs"` / `import { resolve } from "node:path"` (kept the existing `__dirname`, which is runtime-available and typechecks).
- **Verification:** `pnpm lint` clean; the "never references level in the write payload" test still passes.

---

**Total deviations:** 1 execution interruption (recovered via safe-resume closeout) + 2 auto-fixed lint issues.
**Impact on plan:** No scope change. The lint fixes were necessary for the ROADMAP SC #5 release gate; both fixed at root, not suppressed.

## Issues Encountered
- Subagent session-limit interruption mid-Task-2 (recovered inline as above). An unrelated concurrent session committed `fix(sketches)` commits interleaved in the log; they touch only `.planning/sketches/` and did not affect Phase 4 files — `verify:rls` re-confirmed green after.

## User Setup Required
None — no external service configuration required (local Supabase stack; migration `0007` applied via `pnpm db:reset && pnpm seed`).

## Next Phase Readiness
- Phase 4 complete: client profile view + safe-edit, coach read-only detail, DB-enforced protected-field freeze, all release gates green.
- The safe/protected write-safety discipline (column-scoped grant + freeze trigger + six-assertion `verify:rls` pattern) is now the reusable template for Phases 5–8.
- Remaining human sign-off: XC-03 visual design-line review in both themes (D4 above).

---
*Phase: 04-client-profiles*
*Completed: 2026-07-05*
