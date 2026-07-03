---
phase: 02-secure-account-you-can-return-to
plan: 06
subsystem: auth
tags: [supabase, nextjs, auth, config, cookies, gap-closure]

# Dependency graph
requires:
  - phase: 02-secure-account-you-can-return-to
    provides: signup/verify/login/logout loop (02-04, 02-05) that this plan's fix unblocks end-to-end
provides:
  - Deterministic FISH web dev port (3001) — Next can no longer silently fall back to a random port
  - supabase/config.toml site_url + additional_redirect_urls aligned to the exact host:port the browser session lives on (http://localhost:3001)
  - UAT test 3 ("Verify by Email") passing — phase 2's sole blocker closed, unblocking UAT tests 4-13
affects: [phase-3-role-aware-home, any-future-plan-touching-supabase-config-toml-auth-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local dev auth config must agree on BOTH port AND host (127.0.0.1 vs localhost) — Supabase session cookies are host-scoped, not just port-scoped"

key-files:
  created: []
  modified:
    - apps/web/package.json
    - supabase/config.toml

key-decisions:
  - "site_url pinned to http://localhost:3001, not http://127.0.0.1:3001 as the plan originally specified — cookies are host-scoped and the browser's normal navigation happens on localhost"
  - "Dev port pinned explicitly via next dev -p 3001 to remove Next's silent port-fallback nondeterminism permanently"

patterns-established:
  - "When aligning an email-link host:port to a dev server, verify BOTH the port match (via config.toml) AND the cookie-host match (via a full click-through, not just a curl of /auth/confirm) — a 307 redirect alone does not prove the session survives navigation"

requirements-completed: [AUTH-02]

coverage:
  - id: D1
    description: "FISH web dev server listens on a single, explicitly pinned port (3001); Next's silent port fallback can no longer divert the app"
    requirement: "AUTH-02"
    verification:
      - kind: other
        ref: "grep 'next dev -p 3001' apps/web/package.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "supabase/config.toml site_url + additional_redirect_urls aligned to the host:port the browser session actually lives on (http://localhost:3001), so verification email links plant a cookie the browser sees on its next navigation"
    requirement: "AUTH-02"
    verification:
      - kind: other
        ref: "grep 'localhost:3001' supabase/config.toml"
        status: pass
    human_judgment: false
  - id: D3
    description: "After a Supabase stack restart, clicking a FRESH verification email link signs the user in and lands them at /home — UAT test 3, the blocker"
    requirement: "AUTH-02"
    verification: []
    human_judgment: true
    rationale: "Requires a live browser click-through against Mailpit and a real session cookie carried across navigation — not reproducible by an automated check; user performed the fresh signup and confirmed the /home screen via screenshot"

# Metrics
duration: 42min
completed: 2026-07-03
status: complete
---

# Phase 2 Plan 06: Gap Closure — Verification Email Link 500 Summary

**Pinned the FISH dev port to 3001 and aligned Supabase's site_url/redirect allow-list to `http://localhost:3001` (not `127.0.0.1`) — cookies are host-scoped, so the fix required matching both port AND host to the browser's actual session origin, closing UAT test 3's blocker.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-07-03T05:35:00Z (approx, from debug session handoff)
- **Completed:** 2026-07-03T13:55:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 2 (apps/web/package.json, supabase/config.toml)

## Accomplishments

- Pinned `apps/web/package.json` `dev` script to `next dev -p 3001`, eliminating Next's silent port-fallback that previously diverted FISH onto an unpredictable port whenever :3000 was occupied by an unrelated project (Timberyard).
- Aligned `supabase/config.toml` `[auth]` `site_url` + `additional_redirect_urls` to the exact host:port FISH serves on — first to the right **port** (3001), then, after human verification failed, to the right **host** (`localhost` instead of `127.0.0.1`).
- Closed the phase-2 UAT blocker: a fresh signup's verification email link now signs the user in and lands them at `/home`, unblocking UAT tests 4-13.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin the FISH web dev port to 3001 and align supabase site_url + redirect allow-list** — `9cca5b9` (fix)
   - `apps/web/package.json`: `dev` script changed to `next dev -p 3001`
   - `supabase/config.toml`: `site_url`/`additional_redirect_urls` changed from `http://127.0.0.1:3000` to `http://127.0.0.1:3001`
2. **Task 1 (deviation, Rule 1 - bug fix during Task 2 human verification): Align site_url host to localhost** — `31bcf8b` (fix)
   - `supabase/config.toml`: `site_url`/`additional_redirect_urls` changed from `http://127.0.0.1:3001` to `http://localhost:3001`
3. **Task 2: [GAP-GATE] Restart stack + re-run UAT test 3 with FRESH signup** — human checkpoint, no code commit. Approved by user 2026-07-03 after a fresh signup click-through against the corrected config.

**Plan metadata:** (this commit) `docs(02-06): complete gap-closure plan — UAT test 3 blocker resolved`

## Files Created/Modified

- `apps/web/package.json` - `dev` script pinned to `next dev -p 3001` (deterministic, no silent fallback)
- `supabase/config.toml` - `[auth]` `site_url` and `additional_redirect_urls` set to `http://localhost:3001` (final value, after the host-alignment deviation)

## Decisions Made

- **Final `site_url` value is `http://localhost:3001`, not `http://127.0.0.1:3001`** as the plan's `must_haves`/`verify` strings originally specified. This still satisfies the plan's underlying intent — "the email-link host:port equals the host:port the browser session lives on" — the literal string in the plan was a reasonable first guess that first verification proved incomplete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] site_url host mismatch — cookies are host-scoped, `127.0.0.1` link left the session invisible on `localhost`**

- **Found during:** Task 2 (first human-verify attempt, before final approval)
- **Issue:** The plan's Task 1 pinned `site_url` to `http://127.0.0.1:3001` — correct port, but the wrong host. Supabase session cookies set by `/auth/confirm` are scoped to the exact host in the request (`127.0.0.1`), which browsers treat as a *different* cookie jar than `localhost`. Next.js's post-verify redirect lands the browser on `http://localhost:3001/home` (its default dev origin) regardless of the incoming `Host` header, and all normal navigation in this environment happens on `localhost`. The `127.0.0.1`-scoped cookie was therefore never visible again once the browser navigated to `localhost` — the user landed unauthenticated on `/login` even though `/auth/confirm` itself returned a 307 to `/home`.
- **Evidence chain:**
  - `curl` against `http://127.0.0.1:3001/auth/confirm?token_hash=...&type=email` → `307 Location: http://localhost:3001/home` + `Set-Cookie` scoped to `127.0.0.1`.
  - Replaying `GET http://localhost:3001/home` with that same cookie jar (as the real browser does after the redirect) → no cookie sent (different host) → `307 Location: /login`.
- **Fix:** Changed `site_url` and `additional_redirect_urls` in `supabase/config.toml` from `http://127.0.0.1:3001` to `http://localhost:3001`, so the emailed link's host matches the host the redirect lands on and the host all normal browsing already uses.
- **Files modified:** `supabase/config.toml`
- **Verification:** User restarted the Supabase stack (`supabase stop && supabase start`), restarted `pnpm dev` (confirmed serving on `http://localhost:3001`), performed a FRESH signup, opened the Mailpit email, clicked the link, and landed signed in at `/home` — confirmed via screenshot showing "You're signed in — This confirms your session — nothing else lives here yet." with a single Log out button.
- **Committed in:** `31bcf8b`

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1)
**Impact on plan:** Necessary correctness fix; the plan's literal `127.0.0.1` value was an incomplete diagnosis carried over from the debug session, which had only proven the port mismatch, not the host-cookie interaction. No scope creep — same two files, same root problem (email-link host:port must match the browser's session origin), one additional dimension (host, not just port) required to fully close it.

## Issues Encountered

None beyond the deviation documented above.

## Checkpoint Outcome

Task 2 (`[GAP-GATE] Restart the Supabase stack and re-run UAT test 3 with a FRESH signup`) required human verification because it depends on a live browser session and a real Mailpit email click-through — not something an automated check can assert. The user:

1. Restarted the Supabase stack (`supabase stop && supabase start`) so the corrected `site_url` loaded.
2. Started the dev server (`pnpm dev`), confirmed it served on the pinned port `3001`.
3. Performed a FRESH signup at `http://localhost:3001/signup` (required — the diagnostic session in `.planning/debug/verify-email-link-500.md` had already consumed the previous token).
4. Clicked the fresh verification email link and landed signed in at `/home`.

First verification attempt (against `http://127.0.0.1:3001`) failed with the host-cookie issue documented above. After the `31bcf8b` fix (host aligned to `localhost`), the user re-ran the same flow and **approved**: fresh signup → verification email → click → signed in at `/home`, single Log out button, dark theme, no 500, no bounce to `/login`.

UAT test 3 ("Verify by Email") now passes. The phase-2 UAT blocker is closed, unblocking UAT tests 4-13.

## User Setup Required

None - no external service configuration required. (The Supabase stack restart was performed as part of the checkpoint verification, not a standing setup requirement.)

## Next Phase Readiness

- Phase 2's sole UAT blocker is resolved; UAT tests 4-13 (session persistence, logout, wrong password, unverified login, forgot password, recovery link, expired link, RLS, coverage) remain pending and should be run next to close out phase 2's UAT pass.
- The host-scoping lesson (cookies are host-scoped, not just port-scoped) is worth carrying into any future local-auth-config work — it is not obvious from the port-only symptom and cost a second verification round here.
- Phase completion (ROADMAP checkbox/date) is intentionally NOT marked by this plan — that is the orchestrator's decision after the full UAT pass and post-wave verification gate.

---
*Phase: 02-secure-account-you-can-return-to*
*Completed: 2026-07-03*
