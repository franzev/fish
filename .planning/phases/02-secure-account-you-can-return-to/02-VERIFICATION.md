---
phase: 02-secure-account-you-can-return-to
verified: 2026-07-03T14:20:00Z
status: human_needed
score: 13/13 must-haves verified (10 from initial verification + 3 from gap-closure plan 02-06)
has_blocking_gaps: false
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 10/10 must-haves verified
  gaps_closed:
    - "Clicking the verification email link signs the user in and lands them at /home (UAT test 3 blocker — port/site_url/host mismatch, found during live human UAT after the initial verification pass)"
  gaps_remaining: []
  regressions: []
---

# Phase 2: Secure account you can return to — Verification Report (Re-verification)

**Phase Goal:** As a new client, I want to sign up, verify my email, log in, stay logged in across a browser restart, and log out, so that I can always return to an account where my data belongs only to me. (Mode: mvp)
**Verified:** 2026-07-03T14:20:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 02-06)

## Context

The initial verification pass (2026-07-03T11:00:00Z, preserved below) recorded `status: passed` for plans 02-01..02-05 based on extensive live HTTP-level testing. Live human UAT — a separate downstream check run after that verification — then found a real blocker at UAT test 3: a fresh browser click-through on the verification email link produced a raw 500. Diagnosis (`.planning/debug/resolved/verify-email-link-500.md`) proved this was not a regression in FISH's own application code — it was an environment/config problem: `supabase/config.toml`'s `site_url` pinned port 3000 (permanently occupied on this machine by an unrelated project, Timberyard), while FISH's dev server silently fell back to port 3001. The emailed link therefore hit a foreign app and 500'd before FISH's own `/auth/confirm` handler was ever reached.

Gap-closure plan 02-06 fixed this with a minimal, two-file, four-line diff (commits `9cca5b9`, `31bcf8b`):
1. Pinned FISH's dev port deterministically (`next dev -p 3001` in `apps/web/package.json`) — no more silent Next port fallback.
2. Aligned `supabase/config.toml`'s `site_url`/`additional_redirect_urls`, first to the right port (3001) — a first human re-verify attempt then failed on a second, subtler issue (session cookies are host-scoped: `127.0.0.1` and `localhost` are different cookie jars) — then to the right **host+port**: `http://localhost:3001`.

This re-verification independently re-checks the 02-06 fix at all three levels (exists, substantive, wired), regression-checks the 10 previously-verified must-haves for drift, and reflects the current UAT.md state (tests 1-3 passed live, tests 4-13 still pending human execution).

## Goal Achievement

### Observable Truths — Gap-Closure Plan 02-06 (newly verified this pass)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The FISH web dev server always listens on a single, explicitly pinned port (3001) — no silent Next port fallback | VERIFIED | `apps/web/package.json:6` — `"dev": "next dev -p 3001"`. Confirmed live: `lsof -nP -iTCP:3001 -sTCP:LISTEN` shows the FISH node process bound to 3001 right now. |
| 2 | `supabase/config.toml` site_url + additional_redirect_urls point at the exact host:port FISH serves on, so `{{ .SiteURL }}` in email templates renders links that hit the FISH app | VERIFIED | `supabase/config.toml:4-5` — `site_url = "http://localhost:3001"`, `additional_redirect_urls = ["http://localhost:3001"]`. Zero remaining `:3000` references in the file (`grep -c "3000" supabase/config.toml` -> 0). `git diff 55d3056..HEAD -- apps/web supabase` confirms exactly this two-line change, nothing else touched. |
| 3 | After a Supabase stack restart, clicking a FRESH verification email link signs the user in and lands them at /home (the UAT test 3 blocker) | VERIFIED (human-confirmed) | `02-UAT.md` test 3: `result: pass`, note: "fresh signup on localhost:3001 landed signed in at /home after gap-closure plan 02-06; verified by user 2026-07-03." `02-06-SUMMARY.md` documents the full evidence chain including a first failed attempt (host-scoping bug, root-caused via curl replay proving the `127.0.0.1`-scoped cookie was invisible on `localhost`) and the corrected final pass with screenshot confirmation ("You're signed in" + single Log out button, dark theme, no 500). This truth requires a live browser+email click-through and cannot be independently re-proven by this verifier without consuming another one-time token; the UAT record, the code diff, and the live regression checks below together constitute sufficient evidence. |

**Score: 3/3 gap-closure truths verified** (1 human-confirmed via the phase's own UAT tracking, cross-checked against code and commit history).

### Regression Check — Plans 02-01..02-05 (previously VERIFIED, re-checked for drift)

| # | Truth (from prior verification) | Status | Evidence |
|---|-------|--------|----------|
| 4 | No `.getSession(` server-side; no `exchangeCodeForSession` in source | VERIFIED (no drift) | `grep -rn ".getSession(" apps/web/lib apps/web/app apps/web/proxy.ts` -> 0 matches. `grep -rn "exchangeCodeForSession" apps/web --include="*.ts" --include="*.tsx"` (excluding node_modules/.next) -> 0 matches. |
| 5 | Unauthenticated `/home` redirects to `/login` | VERIFIED (no drift) | Live: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3001/home` -> `307 http://localhost:3001/login`. |
| 6 | Full Vitest suite passes | VERIFIED (no drift) | Re-ran live this pass: `pnpm --filter @fish/web exec vitest run` -> 15 files, 120/120 tests passing. |
| 7 | Supabase stack healthy, live and reachable | VERIFIED | Docker containers confirmed running (`supabase_studio_fish`, `supabase_rest_fish`, etc.); `/auth/v1/settings` responds with valid JSON. |
| 8 | Requirements traceability current | VERIFIED (improved since last pass) | `.planning/REQUIREMENTS.md` now shows AUTH-01..06 and DB-01..04 all `[x]` Complete — the AUTH-03/AUTH-04 checkbox staleness flagged as a non-blocking doc gap in the prior verification pass has been corrected. |
| 9 | No debt markers introduced by the gap-closure change | VERIFIED | `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" apps/web/package.json supabase/config.toml` -> no matches. |
| 10 | Gap-closure diff is surgical — no scope creep | VERIFIED | `git diff 55d3056..HEAD -- apps/web supabase` -> exactly 2 files changed, 3 insertions/3 deletions, both within the `[auth]` block of `config.toml` and the `dev` script of `package.json`. No template, `.env.local`, or 02-01..02-05 file touched. |

No regressions found. All previously-verified artifacts, key links, and behaviors from plans 02-01 through 02-05 remain intact (see the full prior-pass detail preserved below).

### Required Artifacts (gap-closure plan 02-06)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/package.json` | `dev` script pins port 3001 | VERIFIED | `"dev": "next dev -p 3001"` — exact match, valid JSON, no other scripts touched |
| `supabase/config.toml` | `site_url`/`additional_redirect_urls` aligned to FISH's serving host:port | VERIFIED | `http://localhost:3001` for both keys; zero stale `:3000` references remain |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `supabase/config.toml site_url` | FISH dev server (port 3001) | `{{ .SiteURL }}` in `supabase/templates/confirmation.html` / `recovery.html` | WIRED | Templates read the port purely from `site_url`, no hardcoded port (confirmed in prior verification and unchanged this pass). Config now correctly points at `localhost:3001`. Live UAT confirms the rendered link worked end-to-end. |
| `apps/web/package.json dev script` | Port 3001 | `next dev -p 3001` | WIRED | Live: `lsof` confirms FISH's node process bound to 3001 right now |
| `/auth/confirm` session cookie | Browser navigation to `/home` | Host-scoped session cookie | WIRED | This was the actual root cause of the FIRST failed re-verify attempt (`127.0.0.1` vs `localhost` cookie scoping) — fixed by aligning site_url's host, not just port, to `localhost`. Confirmed fixed via the passing UAT test 3 record. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Dev port pinned and live | `lsof -nP -iTCP:3001 -sTCP:LISTEN` | FISH node process bound to 3001 | PASS |
| Supabase stack live post-restart | `docker ps` + `curl /auth/v1/settings` | Containers running, valid JSON response | PASS |
| Unauthenticated /home still redirects (no regression from config change) | `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3001/home` | `307 http://localhost:3001/login` | PASS |
| Full test suite | `pnpm --filter @fish/web exec vitest run` | 15 files, 120/120 passing | PASS |
| No stale :3000 references | `grep -c "3000" supabase/config.toml apps/web/package.json` | 0, 0 | PASS |
| No `exchangeCodeForSession`/`.getSession(` in source | `grep -rn` (excl. node_modules/.next) | 0 matches both | PASS |
| Gap-closure diff is minimal/surgical | `git diff 55d3056..HEAD -- apps/web supabase` | 2 files, 3+/3- lines, both in scope | PASS |

7/7 spot-checks PASS this pass. (15/15 spot-checks PASS'd during the initial verification pass, preserved below.)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-01 | 02-04 | Signup with email+password, always client | SATISFIED | Verified in prior pass; unchanged this pass (no files in scope of 02-06 touch signup logic) |
| AUTH-02 | 02-04, 02-06 | Verification email + calm check-inbox screen; **link must actually work end-to-end** | SATISFIED | UAT test 3 now passes live (the actual gap this plan closed); templates/handler unchanged and previously verified; only the config wiring the link's host:port was fixed |
| AUTH-03 | 02-05 | Log in with email and password | SATISFIED | Verified in prior pass; UAT test 6 ("Return to Your Account") still pending human execution but not blocked by anything found this pass |
| AUTH-04 | 02-05 | Reset password via email link -> single-field screen | SATISFIED | Verified in prior pass; UAT test 10 still pending human execution |
| AUTH-05 | 02-01, 02-04 | Session persists across refresh and restart | SATISFIED (mechanism); UAT test 4 pending | proxy.ts refresh + persistent cookie mechanism verified in prior pass; full physical browser-restart is human-only and is UAT test 4, still `[pending]` in 02-UAT.md |
| AUTH-06 | 02-04 | Log out from any authenticated screen | SATISFIED | Verified in prior pass; UAT test 5 ("Log Out and Be Kept Out") still pending human execution |
| DB-01 | 02-02 | Profile row auto-created, trigger never blocks signup | SATISFIED | Verified in prior pass; unchanged this pass |
| DB-02 | 02-02, 02-03 | coach_clients table + seed script | SATISFIED | Verified in prior pass; unchanged this pass |
| DB-03 | 02-02, 02-03 | RLS: client sees own, coach sees assigned only | SATISFIED | Verified in prior pass; UAT test 12 (`pnpm verify:rls`) still pending human execution |
| DB-04 | 02-02, 02-03 | Role enforced server-side, no self-escalation | SATISFIED | Verified in prior pass; UAT test 12 still pending human execution |

**No orphaned requirements.** All 10 requirement IDs (AUTH-01..06, DB-01..04) declared in phase plans are present in `.planning/REQUIREMENTS.md` and now marked `[x]` Complete (the AUTH-03/04 checkbox staleness flagged in the prior verification pass has since been corrected — REQUIREMENTS.md is now current).

### Anti-Patterns Found

Scanned the 2 files modified by gap-closure plan 02-06 (`apps/web/package.json`, `supabase/config.toml`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and stub-shaped patterns.

**Result: zero matches.** The fix is a clean, minimal config alignment — no debt markers, no placeholder text.

The 5 INFO-tier findings noted in the prior verification (IN-01 through IN-05, all cosmetic/Phase-3-territory, explicitly out of scope) remain open by design and are unaffected by this gap-closure plan. See "Anti-Patterns Found" in the preserved initial-verification section below for the full list.

### Human Verification Required

**UAT tests 4-13 remain pending in `.planning/phases/02-secure-account-you-can-return-to/02-UAT.md`** — this is the live, authoritative human-testing state file for this phase and is not duplicated or overwritten here. Referencing it directly:

| Test # | Name | UAT.md status |
|---|---|---|
| 4 | Stay Signed In Across a Browser Restart | pending |
| 5 | Log Out and Be Kept Out | pending |
| 6 | Return to Your Account | pending |
| 7 | Wrong Password Stays Calm and Non-Revealing | pending |
| 8 | Unverified Login Routes to Check-Inbox | pending |
| 9 | Forgot Password Never Reveals Who Has an Account | pending |
| 10 | Recovery Link Lands on Set-New-Password (post-restart re-check) | pending |
| 11 | Consumed Link Routes to a Calm Expired-Link Screen | pending |
| 12 | RLS and Role Escalation Are Enforced (`pnpm verify:rls`) | pending |
| 13 | Coverage: "Always return to an account where my data belongs only to me" | pending |

Tests 1-3 (Cold Start Smoke Test, Sign Up, Verify by Email) have PASSED live per 02-UAT.md, with test 3 specifically re-confirmed after the gap-closure fix. The phase's central blocker (verification email link 500) is closed. The mechanisms underlying tests 4-13 (persistent auth cookie, proxy.ts refresh, logout, wrong-password error copy, unverified-login routing, non-enumerating forgot-password, recovery link type/next params, expired-link routing, RLS/escalation guard) were all independently code-verified and several were live-HTTP-tested in the initial verification pass — but a full physical-browser walk-through of each has not yet been performed by the human tester and is required to close out the MVP-mode UAT script per this phase's own verification protocol.

**Why human:** These are exactly the items the phase's own MVP-mode UAT script (02-UAT.md) designates as requiring a live browser + real user judgment (visual calm/tone, actual browser-restart persistence, actual mail-client link-following) — the same category flagged in the initial verification's "Human Verification Required" section, now formalized as UAT test cases 4-13.

### Gaps Summary

**No blocking gaps.** The single blocker identified during live UAT (verification email link 500, UAT test 3) has been definitively closed by gap-closure plan 02-06, confirmed via: (1) a minimal, in-scope, two-file code diff matching the plan exactly, (2) zero stale `:3000` references remaining anywhere in the affected config, (3) a passing live regression check of `/home`'s auth redirect behavior and the full test suite, and (4) a human-confirmed UAT test 3 pass recorded in 02-UAT.md with a specific note describing the fresh-signup click-through and resulting `/home` screen.

Status is `human_needed`, not `passed`, because UAT tests 4-13 remain `[pending]` in the phase's own live UAT tracking file — per the MVP-mode verification protocol, a phase cannot be marked `passed` while human verification items are outstanding, even when all automatable evidence is green. This is not a new gap; it is the expected next step already tracked in 02-UAT.md. No action is needed from this verification beyond surfacing that the remaining 10 UAT steps should be run to close out the phase.

---

## Preserved: Initial Verification Pass (2026-07-03T11:00:00Z)

The full initial verification of plans 02-01..02-05 is preserved below unchanged, since it remains valid (no regressions found this pass) and documents the depth of live evidence gathered for the 10 must-haves that predate the gap-closure plan.

### Method

This verification did not trust 02-SUMMARY.md, 02-REVIEW.md, or 02-REVIEW-FIX.md claims. Every truth below was checked against the actual code and, where the environment allowed, exercised live against the running local Supabase stack (already up at 127.0.0.1:54321 with all 5 migrations applied and pre-seeded accounts) rather than accepted on the executor's word:

- Read all 5 PLAN.md files (must_haves frontmatter) and all 5 SUMMARY.md files.
- Read 02-REVIEW.md (2 critical + 6 warning findings) and 02-REVIEW-FIX.md (claimed fixes), then inspected the actual diffs in the current HEAD for every one of the 8 in-scope findings.
- Ran the full Vitest suite (120 tests, 15 files) — all passing.
- Ran `scripts/verify-rls.ts` live against the running stack twice (before and after other live tests) — all 6 assertions PASS both times.
- Ran `scripts/seed.ts` live (idempotency check against already-seeded data) — exit 0, zero new accounts created, confirming pagination-safe idempotent lookup works against real data.
- Ran `pnpm build` — clean production build, all 12 routes compile, Suspense/search-param gate green.
- Started the actual Next.js dev server and drove real HTTP requests through `/auth/confirm`, `/home`, and the Supabase Auth REST API directly: created two brand-new signup accounts via the live GoTrue API, read the real generated verification emails out of Mailpit, followed the real `token_hash` links through the real route handler, and confirmed the resulting session actually renders the authenticated `/home` view.
- Specifically re-created the CR-01 open-redirect exploit scenario with a **valid** token_hash and a malicious `next=https://evil.example` param — confirmed the handler still lands on `/home`, not the attacker origin.
- Queried `public.profiles` and `public.coach_clients` directly via the PostgREST admin API to confirm DB-01/DB-02 seed state independent of any test script's self-report.
- Cleaned up the two throwaway signup accounts created for this verification; did not touch the seeded `coach@fish.dev` / `client{1,2,3}@fish.dev` accounts or run any destructive `supabase db reset`.

### Observable Truths (ROADMAP.md Success Criteria — the binding contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A person can sign up with email and password, always as a client, and lands on a calm single-action "check your inbox" screen after a verification email is sent | VERIFIED | Live: POST to GoTrue `/auth/v1/signup` created a real user; `public.profiles` row appeared with `role=client`, `display_name` populated; Mailpit captured "Confirm your email address" with a `token_hash` link. `apps/web/app/signup/page.tsx` routes to `/check-inbox?email=` on success; one primary Button confirmed via grep + 8 passing RTL tests. |
| 2 | A person can log in with email and password, stays logged in across a browser refresh and restart, and can log out from an authenticated screen; a "forgot password" email link lands them on a single-field "set new password" screen | VERIFIED | Live: `signInWithPassword` against seeded `client1@fish.dev` returned a valid session (HTTP 200). `/home` rendered "You're signed in" + one "Log out" primary button for an authenticated cookie; unauthenticated `/home` 307-redirects to `/login` (live curl, confirms review-HIGH fix). Auth cookie `Max-Age=34560000` (400-day persistent cookie) + `proxy.ts` refresh-on-every-navigation (WR-01 fix confirmed in code) together deliver AUTH-05. Live: recovery email for `client1@fish.dev` read from Mailpit contained `type=recovery&next=/reset-password`; following the link 307-redirected to `/reset-password`. `reset-password/page.tsx` calls `updateUser({ password })` -> `/home` on success. |
| 3 | Signing up reliably creates exactly one profile row (a failing trigger never silently blocks the signup), and a seed script creates a coach account and assigns clients to it | VERIFIED | `0002_handle_new_user.sql` has all four mandated hardening elements (`security definer`, `set search_path=''`, `coalesce`, `on conflict (id) do nothing`) — live signup produced exactly one profiles row. Live query of `public.profiles`/`public.coach_clients` shows 1 coach (`Coach Dana`, role=coach) + 3 clients, all 3 assigned via `coach_clients` (3 rows, one per client, UNIQUE(client_id) in `0003_coach_clients.sql`). `pnpm seed` re-run live — exit 0, zero new accounts (idempotent, pagination-safe `admin.listUsers` loop confirmed in `scripts/seed.ts`). |
| 4 | Role is stored and enforced server-side — an authenticated user cannot escalate themselves to coach — and RLS on every table lets a client read only their own data while a coach reads only their own assigned clients | VERIFIED | `0005_role_guard.sql` blocks authenticated self-role-changes (`when (auth.role() = 'authenticated')`); `0004_rls_helpers.sql`'s `private.is_coach_of()` additionally verifies the caller's own role is coach, no bare self-SELECT (no 42P17). Live `scripts/verify-rls.ts` run twice against real anon-key sessions: client sees exactly 1 row (own), coach sees exactly 4 rows (own + 3 assigned, 1 coach + 3 client roles), self-escalation to coach REJECTED with the exact guard exception message, safe-field update SUCCEEDS (proves the guard is genuinely reached, not blocked earlier by RLS). All 6 assertions PASS both runs. |

**Score:** 4/4 roadmap Success Criteria verified.

### PLAN-Level Must-Haves (supplementary detail, all cross-checked)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | proxy.ts refreshes the session on every navigation, writing cookies to both request and response | VERIFIED | `apps/web/lib/supabase/proxy.ts` — WR-01 fix present: `setAll` re-snapshots `NextResponse.next({ request })` AFTER writing refreshed cookies to `request.cookies`, then writes to the re-created `response`. Matches the documented @supabase/ssr contract exactly. |
| 6 | No `.getSession(` server-side; `getUser()`/`getClaims()` only; `verifyOtp`/`token_hash`, never `exchangeCodeForSession` | VERIFIED | `grep -rn "\.getSession("` across `apps/web/lib`, `apps/web/app`, `apps/web/proxy.ts` returns zero matches. `grep -rn "exchangeCodeForSession"` returns zero matches in source. `auth/confirm/route.ts` uses `verifyOtp({ type, token_hash })`. |
| 7 | Open redirect protection on `/auth/confirm`'s `next` param (CR-01) | VERIFIED | Code checked (`route.ts:19-25`: rejects non-`/`-prefixed, `//`-prefixed, and backslash-containing `next` values, falls back to `/home`). Live-exploited with a VALID token + `next=https://evil.example` — landed on `/home`, not the attacker origin. Strongest possible proof (not just code inspection). |
| 8 | Signup "already registered" branch reachable under `enable_confirmations=true` (CR-02) | VERIFIED | `signup/page.tsx:63-66` checks `data.user.identities?.length === 0` (the confirmations-on obfuscated-user shape) and shows the existing-account copy instead of routing to `/check-inbox`. Test suite has both the confirmations-off error-message test AND the confirmations-on empty-identities test (`page.test.tsx`, both passing). |
| 9 | Zero chroma in confirmation.html and recovery.html (binding design constraint) | VERIFIED | `grep -oE "#[0-9a-fA-F]{6}"` on both templates: `#0a0a0a #171717 #2a2a2a #6b6b6b #a1a1a1 #fafafa` — all six hex values have R=G=B (neutral greys), zero saturation. No lime/accent color present. |
| 10 | forgot-password never reveals account existence (D-07); recovery email verified to carry `type=recovery&next=/reset-password` | VERIFIED | Live: `resetPasswordForEmail` called for a real seeded email AND a nonexistent email both returned identical `{}` / HTTP 200 from GoTrue. `forgot-password/page.tsx` shows the identical success copy for all outcomes, no enumeration branch. Live Mailpit read of the actual generated recovery link confirmed `type=recovery&next=/reset-password` present and correctly formed (review-HIGH concern, verified against production email content, not assumed). |

**Combined score: 10/10 must-haves verified** (4 roadmap Success Criteria + 6 supplementary plan-level/review-driven must-haves spot-checked for depth).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/lib/supabase/client.ts` | Browser client factory | VERIFIED | `createBrowserClient`, named `createClient` export |
| `apps/web/lib/supabase/server.ts` | Server client factory, `getUser()`/`getClaims()` only | VERIFIED | `createServerClient` + `cookies()`, `getAll`/`setAll`, no `getSession` |
| `apps/web/lib/supabase/proxy.ts` | `updateSession()` cookie-refresh helper | VERIFIED | WR-01-fixed re-snapshot pattern, single response returned, `getClaims()` called |
| `apps/web/proxy.ts` | Next.js 16 proxy entry at app root | VERIFIED | `export async function proxy`, `export const config` matcher |
| `packages/supabase/src/auth.ts` | `authRedirects.home` | VERIFIED | `home: "/home"` present alongside existing keys |
| `supabase/config.toml` | `[auth]` + `[auth.email]` local config | VERIFIED | `minimum_password_length=8` under `[auth]`; `enable_confirmations=true`, `otp_expiry=86400` (WR-06 fix) under `[auth.email]`; both template `content_path`s registered |
| `supabase/migrations/0001-0005*.sql` | Ordered migration set, no forward references | VERIFIED | Static read confirms 0001 has no `coach_clients`/`is_coach_of` reference; `is_coach_of` created in 0004 after 0003's `coach_clients` |
| `packages/supabase/src/database.generated.ts` | Real tables only | VERIFIED | Contains `profiles` + `coach_clients`, zero `conversations`/`messages` matches |
| `packages/supabase/src/database.types.ts` | Composes generated + legacy | VERIFIED | Imports `Database` from `./database.generated`; legacy chat contracts clearly labeled `LegacyChatContracts`, kept out of `Database` |
| `scripts/seed.ts` | Idempotent admin-API seed | VERIFIED | `admin.createUser`, `email_confirm:true`, pagination-safe `listUsers` loop, coach promoted before assignment, no `insert into auth.users`. Ran live twice — idempotent |
| `scripts/verify-rls.ts` | Anon-session RLS/escalation gate | VERIFIED | Uses `signInWithPassword` + publishable key only, zero `SERVICE_ROLE` references, identity-based leak check (WR-05 fix). Ran live twice — 6/6 PASS both times |
| `docs/deploy-checklist.md` | D-14 hosted setup checklist | VERIFIED | Covers link, Site URL, redirect allow-list, `db push`, both templates, hosted env vars, password-length + confirmations + otp_expiry config check, SMTP deferral note, "don't seed prod" |
| `supabase/templates/confirmation.html` / `recovery.html` | FISH-voice, `token_hash`, zero chroma | VERIFIED | Both use `token_hash` + `/auth/confirm`, no `{{ .ConfirmationURL }}`; recovery hardcodes `next=/reset-password`; all colors verified zero-chroma greys |

All 13 required artifacts across all 5 plans: VERIFIED (exists, substantive, wired). No stubs, no orphans found.

### Key Link Verification (initial pass)

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/web/proxy.ts` | `lib/supabase/proxy.ts` | `import { updateSession }` | WIRED | Confirmed by import + delegation in `proxy.ts` |
| `lib/supabase/proxy.ts` | `@supabase/ssr createServerClient` | `getAll`/`setAll` cookie contract | WIRED | Confirmed live: refreshed cookies visible on the auth cookie in real HTTP responses |
| `auth.users insert` | `public.profiles` | `handle_new_user` trigger | WIRED | Confirmed live: 3 separate real signups (2 test + observed seed data) all produced exactly 1 profiles row each |
| RLS policies | `private.is_coach_of()` | SECURITY DEFINER helper | WIRED | Confirmed live: coach boundary query returns exactly 4 rows (own + 3 assigned), no 42P17 |
| `signup/page.tsx` | `supabase.auth.signUp` | browser client | WIRED | Confirmed live via direct GoTrue call + code inspection of the calling page |
| `auth/confirm/route.ts` | `supabase.auth.verifyOtp` | server client | WIRED | Confirmed live: valid token_hash -> session issued, redirect to `/home`; invalid/consumed -> `/expired-link` |
| `home/page.tsx` | `/login` | server redirect on no user | WIRED | Confirmed live: unauthenticated GET `/home` -> 307 to `/login` |
| `logout-button.tsx` | `supabase.auth.signOut` | client island | WIRED | `signOut()` call present, `"use client"`, mounted as the one primary action on `/home` |
| `login/page.tsx` | `supabase.auth.signInWithPassword` | browser client | WIRED | Confirmed live: valid seeded credentials -> 200 with access_token |
| `forgot-password/page.tsx` | `supabase.auth.resetPasswordForEmail` | browser client, no next-carrying redirectTo | WIRED | Confirmed live: identical response for real + fake email; code contains no `redirectTo` smuggling `next=` |
| `reset-password/page.tsx` | `supabase.auth.updateUser` | recovery session from /auth/confirm | WIRED | Code path confirmed; recovery session establishment confirmed live (307 to `/reset-password` after clicking the real Mailpit link) |
| `scripts/seed.ts` | `supabase.auth.admin.createUser` | service-role client | WIRED | Confirmed live — ran against real stack, idempotent |
| `scripts/verify-rls.ts` | `supabase.auth.signInWithPassword` | anon-key client per seeded user | WIRED | Confirmed live — 6/6 assertions PASS |

All key links: WIRED, and the majority independently re-proven live (not just statically inspected).

### Behavioral Spot-Checks (initial pass)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Signup creates exactly 1 profile row | Live POST to GoTrue `/auth/v1/signup` + REST query on `public.profiles` | 1 row, `role=client`, correct `display_name` | PASS |
| Verification email uses `token_hash`, not `ConfirmationURL` | Mailpit API read of real generated email | `href="http://127.0.0.1:3000/auth/confirm?token_hash=...&type=email"` (note: this is the pre-fix :3000 link — the bug this phase's gap closure fixed) | PASS (template mechanism) |
| Valid confirm link lands signed-in at `/home` | curl through real route handler with real token | 307 -> `/home`, `/home` GET with resulting cookie renders "You're signed in" + "Log out" | PASS |
| Unauthenticated `/home` redirects to `/login` | curl GET `/home` with no cookie | 307 -> `/login` | PASS |
| Consumed/invalid confirm link routes to `/expired-link` | curl GET with already-used and bogus tokens | 307 -> `/expired-link?type=signup` | PASS |
| Open redirect via `next` is blocked (CR-01) | curl GET with VALID token + `next=https://evil.example` | 307 -> `/home` (not evil.example) | PASS |
| Login with seeded credentials succeeds | Live POST to GoTrue `/auth/v1/token?grant_type=password` | HTTP 200, valid session issued | PASS |
| Forgot-password is non-enumerating (D-07) | Live POST `/auth/v1/recover` for real + fake email | Both return identical `{}` / HTTP 200 | PASS |
| Recovery email carries `type=recovery&next=/reset-password` | Mailpit API read of real generated recovery email | Confirmed present and correctly formed | PASS |
| Recovery link establishes session, lands at `/reset-password` | curl GET through real route handler with real recovery token | 307 -> `/reset-password` | PASS |
| DB-03/DB-04 RLS + escalation boundary | `node scripts/verify-rls.ts` against live stack (x2) | 6/6 PASS both runs | PASS |
| Seed is idempotent | `node scripts/seed.ts` against already-seeded stack | Exit 0, "Already exists" for all 4 accounts, zero dupes | PASS |
| Full Vitest suite | `pnpm --filter @fish/web exec vitest run` | 15 files, 120/120 passing | PASS |
| Production build + Suspense gate | `pnpm build` | Exit 0, all 12 routes compiled, TypeScript clean | PASS |
| Web + shared package typecheck | `pnpm typecheck` (web), `pnpm --filter @fish/supabase typecheck` | Both exit 0 | PASS |

**Important note added during re-verification:** the "Verification email uses `token_hash`" spot-check row above captured a link at `http://127.0.0.1:3000/...` at the time of the initial pass — this is precisely the port-mismatched link that caused the UAT test 3 blocker discovered afterward. The route-handler mechanism (token_hash, verifyOtp, redirect) was and remains correct; only the emitted link's host:port was wrong, which is what gap-closure plan 02-06 fixed. This note is preserved for transparency rather than edited away.

### Requirements Coverage (initial pass)

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-01 | 02-04 | Signup with email+password, always client | SATISFIED | Live signup + trigger proof above |
| AUTH-02 | 02-04 | Verification email + calm check-inbox screen | SATISFIED | Live Mailpit read + check-inbox screen code/tests |
| AUTH-03 | 02-05 | Log in with email and password | SATISFIED | Live signInWithPassword 200 + login page code/tests (9 passing tests) |
| AUTH-04 | 02-05 | Reset password via email link -> single-field screen | SATISFIED | Live recovery email + link walk to `/reset-password` + updateUser code/tests |
| AUTH-05 | 02-01, 02-04 | Session persists across refresh and restart | SATISFIED | proxy.ts refresh (WR-01 fixed) + 400-day persistent auth cookie confirmed live; full physical browser-restart is inherently human-only (flagged below) |
| AUTH-06 | 02-04 | Log out from any authenticated screen | SATISFIED | logout-button.tsx signOut() + /login redirect; live unauthenticated-/home-redirects-to-/login proof |
| DB-01 | 02-02 | Profile row auto-created, trigger never blocks signup | SATISFIED | Live: 3 independent real signups each produced exactly 1 profiles row; all 4 hardening elements present in 0002 |
| DB-02 | 02-02, 02-03 | coach_clients table + seed script | SATISFIED | Live query: 1 coach + 3 clients, 3 coach_clients rows, UNIQUE(client_id) enforced in schema |
| DB-03 | 02-02, 02-03 | RLS: client sees own, coach sees assigned only | SATISFIED | Live verify-rls.ts: client boundary + coach boundary both PASS, no 42P17 |
| DB-04 | 02-02, 02-03 | Role enforced server-side, no self-escalation | SATISFIED | Live verify-rls.ts: self-escalation REJECTED, safe-field update SUCCEEDS (guard genuinely exercised) |

### Anti-Patterns Found (initial pass)

Scanned all 21 phase-2-modified source/migration files for `TBD`/`FIXME`/`XXX` (blocker gate), `TODO`/`HACK`/`PLACEHOLDER`, "coming soon"/"not yet implemented" language, and stub-shaped returns.

**Result: zero matches.** No debt markers, no placeholder text, no stub implementations found in any phase 2 file.

Five INFO-tier findings from 02-REVIEW.md remain open by design (explicitly out of `fix_scope: critical_warning` per 02-REVIEW-FIX.md):
- IN-01: `authRedirects`/`FishAuthClaims` unused/drifted (dead exports, not wired into pages yet — cosmetic, Phase 3 territory)
- IN-02: deploy-checklist step 4 describes `&next=/home` which the template omits (harmless — handler already defaults `next` to `/home`)
- IN-03: `profiles` UPDATE grant is broader than "safe fields" (role IS protected by the trigger guard, which is the security-critical boundary; timestamp mutability is a data-hygiene nit, not a security hole)
- IN-04: logout-button ignores `signOut()`'s error result (low impact — session clears locally regardless)
- IN-05: forgot-password shows success copy even on a thrown network error (D-07's anti-enumeration guarantee is about server responses; this only affects the offline-user edge case)

None of these are must-have failures. They are correctly scoped out of this phase's fix cycle and do not block phase goal achievement.

---

_Verified: 2026-07-03T14:20:00Z_
_Verifier: Claude (gsd-verifier)_
