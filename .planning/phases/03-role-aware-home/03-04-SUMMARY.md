---
phase: 03-role-aware-home
plan: 04
subsystem: auth
tags: [nextjs, server-components, redirect, supabase]

# Dependency graph
requires:
  - phase: 03-role-aware-home (plan 01)
    provides: authRedirects.clientHome/coachHome final values, getUser()-only server client discipline
provides:
  - Shared redirectIfSignedIn() server guard (getUser() + profiles.role read + role-home redirect)
  - /login and /signup as async Server Component shells that call the guard before rendering
  - LoginForm/SignupForm extracted as named-export client components
affects: [future auth-page work, any new auth entry route needing the same signed-in guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-shell-wraps-client-form: a thin async Server Component route file runs a server-only guard, then renders an extracted \"use client\" *-form.tsx component unchanged"

key-files:
  created:
    - apps/web/lib/auth/redirect-if-signed-in.ts
    - apps/web/lib/auth/redirect-if-signed-in.test.ts
    - apps/web/app/login/login-form.tsx
    - apps/web/app/signup/signup-form.tsx
  modified:
    - apps/web/app/login/page.tsx
    - apps/web/app/signup/page.tsx
    - apps/web/app/login/page.test.tsx (renamed to login-form.test.tsx, re-pointed at LoginForm)
    - apps/web/app/signup/page.test.tsx (renamed to signup-form.test.tsx, re-pointed at SignupForm)

key-decisions:
  - "redirectIfSignedIn() reads only profiles.role (not display_name) — the guard only needs to pick a destination, unlike the home pages which also render the name"
  - "Existing login/page.test.tsx and signup/page.test.tsx behavioral coverage was renamed and re-pointed at the extracted form components rather than replaced with a new minimal smoke test, since the form logic (and its full test coverage) moved verbatim"

requirements-completed: [ROUT-02, ROUT-03]

coverage:
  - id: D1
    description: "redirectIfSignedIn() shared server guard: signed-in client -> /home, signed-in coach -> /coach, signed-out visitor -> no-op"
    requirement: "ROUT-02"
    verification:
      - kind: unit
        ref: "apps/web/lib/auth/redirect-if-signed-in.test.ts#redirects a signed-in client to /home"
        status: pass
      - kind: unit
        ref: "apps/web/lib/auth/redirect-if-signed-in.test.ts#redirects a signed-in coach to /coach"
        status: pass
      - kind: unit
        ref: "apps/web/lib/auth/redirect-if-signed-in.test.ts#is a no-op for a signed-out visitor"
        status: pass
    human_judgment: false
  - id: D2
    description: "/login and /signup are server shells calling the guard before rendering the unchanged client form"
    requirement: "ROUT-03"
    verification:
      - kind: unit
        ref: "apps/web/app/login/login-form.test.tsx (full existing behavioral suite, re-pointed at LoginForm)"
        status: pass
      - kind: other
        ref: "pnpm build (Next.js build) — /login and /signup compile as dynamic (ƒ) server routes"
        status: pass
    human_judgment: true
    rationale: "Manual cross-role navigation check (signed-in client/coach hitting /login and /signup, plus signed-out form parity) is listed as phase-level manual verification in 03-04-PLAN.md and has not been executed by a human yet."

# Metrics
duration: 3min
completed: 2026-07-04
status: complete
---

# Phase 3 Plan 4: Signed-in auth-page redirect Summary

**Shared `redirectIfSignedIn()` server guard closes D-05: /login and /signup are now async Server Component shells that silently forward an already-authenticated visitor to their role home before the form ever renders.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-04T12:07:34Z
- **Completed:** 2026-07-04T12:09:57Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified/renamed)

## Accomplishments
- New `redirectIfSignedIn()` helper: `getUser()` (never `getSession()`) + `profiles.role` read, redirects to `authRedirects.coachHome`/`clientHome`, no-op when signed out — the inverse of the `(authenticated)` layout's default-deny guard
- `/login` and `/signup` converted from `"use client"` pages to async Server Component shells that `await redirectIfSignedIn()` then render the extracted `LoginForm`/`SignupForm`
- Existing login/signup form behavior (submit, error copy, routing, the "exactly one primary button" grep gate) preserved byte-for-byte via a pure move+rename into `login-form.tsx`/`signup-form.tsx`

## Task Commits

Each task was committed atomically (Task 1 followed the plan's TDD RED/GREEN split):

1. **Task 1 (RED): failing test for redirectIfSignedIn** - `3918e9e` (test)
2. **Task 1 (GREEN): implement redirectIfSignedIn** - `36079a5` (feat)
3. **Task 2: server shells for login/signup call redirectIfSignedIn** - `6243ecd` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `apps/web/lib/auth/redirect-if-signed-in.ts` - Shared server guard: getUser() -> profiles.role -> redirect to role home, no-op when signed out
- `apps/web/lib/auth/redirect-if-signed-in.test.ts` - Client/coach/signed-out behavior tests, mirrors the home page mock scaffold
- `apps/web/app/login/login-form.tsx` - Extracted client form (`LoginForm`), verbatim move+rename of the prior default export
- `apps/web/app/signup/signup-form.tsx` - Extracted client form (`SignupForm`), verbatim move+rename of the prior default export
- `apps/web/app/login/page.tsx` - Now an async Server Component shell: `await redirectIfSignedIn(); return <LoginForm />;`
- `apps/web/app/signup/page.tsx` - Now an async Server Component shell: `await redirectIfSignedIn(); return <SignupForm />;`
- `apps/web/app/login/login-form.test.tsx` - Renamed from `page.test.tsx`; full existing behavioral suite re-pointed at `LoginForm`
- `apps/web/app/signup/signup-form.test.tsx` - Renamed from `page.test.tsx`; full existing behavioral suite re-pointed at `SignupForm`

## Decisions Made
- `redirectIfSignedIn()` selects only `profiles.role` in its query (not `display_name`) — unlike the home pages, the guard never renders a name, so the narrower select keeps the read minimal.
- Rather than write a new "minimal render-smoke test" for the extracted forms per the plan's Task 2 wording, the pre-existing comprehensive behavioral test files (`login/page.test.tsx`, `signup/page.test.tsx`) were renamed to `login-form.test.tsx`/`signup-form.test.tsx` and re-pointed at the new named exports (`LoginForm`/`SignupForm`). This preserves strictly more coverage than a smoke test would (submit flows, error-code branching, primary-button grep gate) with the same "no logic change" guarantee the plan asked for, and avoids deleting existing test assertions.

## Deviations from Plan

None - plan executed as written, with one interpretation noted above (test-file handling: renamed+re-pointed existing full-coverage tests rather than authoring a new minimal smoke test, since the plan's own goal — "replaces the render coverage the old inline page had" — is satisfied more completely by carrying the existing suite forward than by writing a smaller one).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- D-05 is now fully closed: root (`/`), wrong-role home, and signed-in-visits-auth-page all resolve as silent redirects — the phase's "every mis-navigation resolves silently" contract is complete.
- Full test suite green (173 tests, up from 170), `pnpm build` and `pnpm lint` both exit 0.
- Manual verification remains for phase-level UAT (D2 above): confirm cross-role navigation (client/coach hitting /login, /signup) and signed-out form parity in a running app, per 03-04-PLAN.md's `<verification>` section.

---
*Phase: 03-role-aware-home*
*Completed: 2026-07-04*
