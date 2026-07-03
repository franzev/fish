---
phase: 02-secure-account-you-can-return-to
verified: 2026-07-03T11:00:00Z
status: passed
score: 10/10 must-haves verified
has_blocking_gaps: false
overrides_applied: 0
---

# Phase 2: Secure account you can return to — Verification Report

**Phase Goal:** A secure account you can create and return to (sign up → verify → log in → log out, session persists, role enforced server-side). Full linear email/password auth loop backed by a hardened profiles + coach-client schema with server-enforced roles and RLS.
**Verified:** 2026-07-03T11:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

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

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria — the binding contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A person can sign up with email and password, always as a client, and lands on a calm single-action "check your inbox" screen after a verification email is sent | ✓ VERIFIED | Live: POST to GoTrue `/auth/v1/signup` created a real user; `public.profiles` row appeared with `role=client`, `display_name` populated; Mailpit captured "Confirm your email address" with a `token_hash` link. `apps/web/app/signup/page.tsx` routes to `/check-inbox?email=` on success; one primary Button confirmed via grep + 8 passing RTL tests. |
| 2 | A person can log in with email and password, stays logged in across a browser refresh and restart, and can log out from an authenticated screen; a "forgot password" email link lands them on a single-field "set new password" screen | ✓ VERIFIED | Live: `signInWithPassword` against seeded `client1@fish.dev` returned a valid session (HTTP 200). `/home` rendered "You're signed in" + one "Log out" primary button for an authenticated cookie; unauthenticated `/home` 307-redirects to `/login` (live curl, confirms review-HIGH fix). Auth cookie `Max-Age=34560000` (400-day persistent cookie) + `proxy.ts` refresh-on-every-navigation (WR-01 fix confirmed in code) together deliver AUTH-05. Live: recovery email for `client1@fish.dev` read from Mailpit contained `type=recovery&next=/reset-password`; following the link 307-redirected to `/reset-password`. `reset-password/page.tsx` calls `updateUser({ password })` → `/home` on success. |
| 3 | Signing up reliably creates exactly one profile row (a failing trigger never silently blocks the signup), and a seed script creates a coach account and assigns clients to it | ✓ VERIFIED | `0002_handle_new_user.sql` has all four mandated hardening elements (`security definer`, `set search_path=''`, `coalesce`, `on conflict (id) do nothing`) — live signup produced exactly one profiles row. Live query of `public.profiles`/`public.coach_clients` shows 1 coach (`Coach Dana`, role=coach) + 3 clients, all 3 assigned via `coach_clients` (3 rows, one per client, UNIQUE(client_id) in `0003_coach_clients.sql`). `pnpm seed` re-run live — exit 0, zero new accounts (idempotent, pagination-safe `admin.listUsers` loop confirmed in `scripts/seed.ts`). |
| 4 | Role is stored and enforced server-side — an authenticated user cannot escalate themselves to coach — and RLS on every table lets a client read only their own data while a coach reads only their own assigned clients | ✓ VERIFIED | `0005_role_guard.sql` blocks authenticated self-role-changes (`when (auth.role() = 'authenticated')`); `0004_rls_helpers.sql`'s `private.is_coach_of()` additionally verifies the caller's own role is coach, no bare self-SELECT (no 42P17). Live `scripts/verify-rls.ts` run twice against real anon-key sessions: client sees exactly 1 row (own), coach sees exactly 4 rows (own + 3 assigned, 1 coach + 3 client roles), self-escalation to coach REJECTED with the exact guard exception message, safe-field update SUCCEEDS (proves the guard is genuinely reached, not blocked earlier by RLS). All 6 assertions PASS both runs. |

**Score:** 4/4 roadmap Success Criteria verified.

### PLAN-Level Must-Haves (supplementary detail, all cross-checked)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | proxy.ts refreshes the session on every navigation, writing cookies to both request and response | ✓ VERIFIED | `apps/web/lib/supabase/proxy.ts` — WR-01 fix present: `setAll` re-snapshots `NextResponse.next({ request })` AFTER writing refreshed cookies to `request.cookies`, then writes to the re-created `response`. Matches the documented @supabase/ssr contract exactly. |
| 6 | No `.getSession(` server-side; `getUser()`/`getClaims()` only; `verifyOtp`/`token_hash`, never `exchangeCodeForSession` | ✓ VERIFIED | `grep -rn "\.getSession("` across `apps/web/lib`, `apps/web/app`, `apps/web/proxy.ts` returns zero matches. `grep -rn "exchangeCodeForSession"` returns zero matches in source. `auth/confirm/route.ts` uses `verifyOtp({ type, token_hash })`. |
| 7 | Open redirect protection on `/auth/confirm`'s `next` param (CR-01) | ✓ VERIFIED | Code checked (`route.ts:19-25`: rejects non-`/`-prefixed, `//`-prefixed, and backslash-containing `next` values, falls back to `/home`). Live-exploited with a VALID token + `next=https://evil.example` — landed on `/home`, not the attacker origin. Strongest possible proof (not just code inspection). |
| 8 | Signup "already registered" branch reachable under `enable_confirmations=true` (CR-02) | ✓ VERIFIED | `signup/page.tsx:63-66` checks `data.user.identities?.length === 0` (the confirmations-on obfuscated-user shape) and shows the existing-account copy instead of routing to `/check-inbox`. Test suite has both the confirmations-off error-message test AND the confirmations-on empty-identities test (`page.test.tsx`, both passing). |
| 9 | Zero chroma in confirmation.html and recovery.html (binding design constraint) | ✓ VERIFIED | `grep -oE "#[0-9a-fA-F]{6}"` on both templates: `#0a0a0a #171717 #2a2a2a #6b6b6b #a1a1a1 #fafafa` — all six hex values have R=G=B (neutral greys), zero saturation. No lime/accent color present. |
| 10 | forgot-password never reveals account existence (D-07); recovery email verified to carry `type=recovery&next=/reset-password` | ✓ VERIFIED | Live: `resetPasswordForEmail` called for a real seeded email AND a nonexistent email both returned identical `{}` / HTTP 200 from GoTrue. `forgot-password/page.tsx` shows the identical success copy for all outcomes, no enumeration branch. Live Mailpit read of the actual generated recovery link confirmed `type=recovery&next=/reset-password` present and correctly formed (review-HIGH concern, verified against production email content, not assumed). |

**Combined score: 10/10 must-haves verified** (4 roadmap Success Criteria + 6 supplementary plan-level/review-driven must-haves spot-checked for depth).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/lib/supabase/client.ts` | Browser client factory | ✓ VERIFIED | `createBrowserClient`, named `createClient` export |
| `apps/web/lib/supabase/server.ts` | Server client factory, `getUser()`/`getClaims()` only | ✓ VERIFIED | `createServerClient` + `cookies()`, `getAll`/`setAll`, no `getSession` |
| `apps/web/lib/supabase/proxy.ts` | `updateSession()` cookie-refresh helper | ✓ VERIFIED | WR-01-fixed re-snapshot pattern, single response returned, `getClaims()` called |
| `apps/web/proxy.ts` | Next.js 16 proxy entry at app root | ✓ VERIFIED | `export async function proxy`, `export const config` matcher |
| `packages/supabase/src/auth.ts` | `authRedirects.home` | ✓ VERIFIED | `home: "/home"` present alongside existing keys |
| `supabase/config.toml` | `[auth]` + `[auth.email]` local config | ✓ VERIFIED | `minimum_password_length=8` under `[auth]`; `enable_confirmations=true`, `otp_expiry=86400` (WR-06 fix) under `[auth.email]`; both template `content_path`s registered — live-confirmed to be the actually-served config per environment brief |
| `supabase/migrations/0001-0005*.sql` | Ordered migration set, no forward references | ✓ VERIFIED | Static read confirms 0001 has no `coach_clients`/`is_coach_of` reference; `is_coach_of` created in 0004 after 0003's `coach_clients`. Stack already has all 5 applied (per environment brief) and functions correctly live (verify-rls.ts, seed.ts both pass against it) |
| `packages/supabase/src/database.generated.ts` | Real tables only | ✓ VERIFIED | Contains `profiles` + `coach_clients`, zero `conversations`/`messages` matches |
| `packages/supabase/src/database.types.ts` | Composes generated + legacy | ✓ VERIFIED | Imports `Database` from `./database.generated`; legacy chat contracts clearly labeled `LegacyChatContracts`, kept out of `Database` |
| `scripts/seed.ts` | Idempotent admin-API seed | ✓ VERIFIED | `admin.createUser`, `email_confirm:true`, pagination-safe `listUsers` loop, coach promoted before assignment, no `insert into auth.users`. Ran live twice — idempotent |
| `scripts/verify-rls.ts` | Anon-session RLS/escalation gate | ✓ VERIFIED | Uses `signInWithPassword` + publishable key only, zero `SERVICE_ROLE` references, identity-based leak check (WR-05 fix). Ran live twice — 6/6 PASS both times |
| `docs/deploy-checklist.md` | D-14 hosted setup checklist | ✓ VERIFIED | Covers link, Site URL, redirect allow-list, `db push`, both templates, hosted env vars, password-length + confirmations + otp_expiry config check, SMTP deferral note, "don't seed prod" |
| `supabase/templates/confirmation.html` / `recovery.html` | FISH-voice, `token_hash`, zero chroma | ✓ VERIFIED | Both use `token_hash` + `/auth/confirm`, no `{{ .ConfirmationURL }}`; recovery hardcodes `next=/reset-password`; all colors verified zero-chroma greys |

All 13 required artifacts across all 5 plans: **VERIFIED** (exists, substantive, wired). No stubs, no orphans found.

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/web/proxy.ts` | `lib/supabase/proxy.ts` | `import { updateSession }` | WIRED | Confirmed by import + delegation in `proxy.ts` |
| `lib/supabase/proxy.ts` | `@supabase/ssr createServerClient` | `getAll`/`setAll` cookie contract | WIRED | Confirmed live: refreshed cookies visible on the auth cookie in real HTTP responses |
| `auth.users insert` | `public.profiles` | `handle_new_user` trigger | WIRED | Confirmed live: 3 separate real signups (2 test + observed seed data) all produced exactly 1 profiles row each |
| RLS policies | `private.is_coach_of()` | SECURITY DEFINER helper | WIRED | Confirmed live: coach boundary query returns exactly 4 rows (own + 3 assigned), no 42P17 |
| `signup/page.tsx` | `supabase.auth.signUp` | browser client | WIRED | Confirmed live via direct GoTrue call + code inspection of the calling page |
| `auth/confirm/route.ts` | `supabase.auth.verifyOtp` | server client | WIRED | Confirmed live: valid token_hash → session issued, redirect to `/home`; invalid/consumed → `/expired-link` |
| `home/page.tsx` | `/login` | server redirect on no user | WIRED | Confirmed live: unauthenticated GET `/home` → 307 to `/login` |
| `logout-button.tsx` | `supabase.auth.signOut` | client island | WIRED | `signOut()` call present, `"use client"`, mounted as the one primary action on `/home` |
| `login/page.tsx` | `supabase.auth.signInWithPassword` | browser client | WIRED | Confirmed live: valid seeded credentials → 200 with access_token |
| `forgot-password/page.tsx` | `supabase.auth.resetPasswordForEmail` | browser client, no next-carrying redirectTo | WIRED | Confirmed live: identical response for real + fake email; code contains no `redirectTo` smuggling `next=` |
| `reset-password/page.tsx` | `supabase.auth.updateUser` | recovery session from /auth/confirm | WIRED | Code path confirmed; recovery session establishment confirmed live (307 to `/reset-password` after clicking the real Mailpit link) |
| `scripts/seed.ts` | `supabase.auth.admin.createUser` | service-role client | WIRED | Confirmed live — ran against real stack, idempotent |
| `scripts/verify-rls.ts` | `supabase.auth.signInWithPassword` | anon-key client per seeded user | WIRED | Confirmed live — 6/6 assertions PASS |

All key links: **WIRED**, and the majority independently re-proven live (not just statically inspected).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Signup creates exactly 1 profile row | Live POST to GoTrue `/auth/v1/signup` + REST query on `public.profiles` | 1 row, `role=client`, correct `display_name` | ✓ PASS |
| Verification email uses `token_hash`, not `ConfirmationURL` | Mailpit API read of real generated email | `href="http://127.0.0.1:3000/auth/confirm?token_hash=...&type=email"` | ✓ PASS |
| Valid confirm link lands signed-in at `/home` | curl through real route handler with real token | 307 → `/home`, `/home` GET with resulting cookie renders "You're signed in" + "Log out" | ✓ PASS |
| Unauthenticated `/home` redirects to `/login` | curl GET `/home` with no cookie | 307 → `/login` | ✓ PASS |
| Consumed/invalid confirm link routes to `/expired-link` | curl GET with already-used and bogus tokens | 307 → `/expired-link?type=signup` | ✓ PASS |
| Open redirect via `next` is blocked (CR-01) | curl GET with VALID token + `next=https://evil.example` | 307 → `/home` (not evil.example) | ✓ PASS |
| Login with seeded credentials succeeds | Live POST to GoTrue `/auth/v1/token?grant_type=password` | HTTP 200, valid session issued | ✓ PASS |
| Forgot-password is non-enumerating (D-07) | Live POST `/auth/v1/recover` for real + fake email | Both return identical `{}` / HTTP 200 | ✓ PASS |
| Recovery email carries `type=recovery&next=/reset-password` | Mailpit API read of real generated recovery email | Confirmed present and correctly formed | ✓ PASS |
| Recovery link establishes session, lands at `/reset-password` | curl GET through real route handler with real recovery token | 307 → `/reset-password` | ✓ PASS |
| DB-03/DB-04 RLS + escalation boundary | `node scripts/verify-rls.ts` against live stack (x2) | 6/6 PASS both runs | ✓ PASS |
| Seed is idempotent | `node scripts/seed.ts` against already-seeded stack | Exit 0, "Already exists" for all 4 accounts, zero dupes | ✓ PASS |
| Full Vitest suite | `pnpm --filter @fish/web exec vitest run` | 15 files, 120/120 passing | ✓ PASS |
| Production build + Suspense gate | `pnpm build` | Exit 0, all 12 routes compiled, TypeScript clean | ✓ PASS |
| Web + shared package typecheck | `pnpm typecheck` (web), `pnpm --filter @fish/supabase typecheck` | Both exit 0 | ✓ PASS |

15/15 behavioral spot-checks PASS — an unusually high proportion verified live against the actual running stack rather than through static inspection alone, made possible by the pre-running Supabase environment provided for this verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-01 | 02-04 | Signup with email+password, always client | ✓ SATISFIED | Live signup + trigger proof above |
| AUTH-02 | 02-04 | Verification email + calm check-inbox screen | ✓ SATISFIED | Live Mailpit read + check-inbox screen code/tests |
| AUTH-03 | 02-05 | Log in with email and password | ✓ SATISFIED | Live signInWithPassword 200 + login page code/tests (9 passing tests) |
| AUTH-04 | 02-05 | Reset password via email link → single-field screen | ✓ SATISFIED | Live recovery email + link walk to `/reset-password` + updateUser code/tests |
| AUTH-05 | 02-01, 02-04 | Session persists across refresh and restart | ✓ SATISFIED | proxy.ts refresh (WR-01 fixed) + 400-day persistent auth cookie confirmed live; full physical browser-restart is inherently human-only (flagged below) |
| AUTH-06 | 02-04 | Log out from any authenticated screen | ✓ SATISFIED | logout-button.tsx signOut() + /login redirect; live unauthenticated-/home-redirects-to-/login proof |
| DB-01 | 02-02 | Profile row auto-created, trigger never blocks signup | ✓ SATISFIED | Live: 3 independent real signups each produced exactly 1 profiles row; all 4 hardening elements present in 0002 |
| DB-02 | 02-02, 02-03 | coach_clients table + seed script | ✓ SATISFIED | Live query: 1 coach + 3 clients, 3 coach_clients rows, UNIQUE(client_id) enforced in schema |
| DB-03 | 02-02, 02-03 | RLS: client sees own, coach sees assigned only | ✓ SATISFIED | Live verify-rls.ts: client boundary + coach boundary both PASS, no 42P17 |
| DB-04 | 02-02, 02-03 | Role enforced server-side, no self-escalation | ✓ SATISFIED | Live verify-rls.ts: self-escalation REJECTED, safe-field update SUCCEEDS (guard genuinely exercised) |

**No orphaned requirements** — all 10 requirement IDs listed in the phase brief (AUTH-01..06, DB-01..04) appear in at least one PLAN.md `requirements:` field and are satisfied by live evidence above.

**Note on REQUIREMENTS.md staleness:** `.planning/REQUIREMENTS.md` currently shows `AUTH-03` and `AUTH-04` as unchecked `[ ]` with status "Pending" (lines 37-38, 112-113), while `AUTH-01/02/05/06` and all `DB-*` rows are marked `[x]` "Complete". This is a **documentation gap in REQUIREMENTS.md, not a code gap** — AUTH-03 (login) and AUTH-04 (password reset) are both fully implemented, tested (9 + 10 passing tests respectively), and independently proven live in this verification (see spot-checks above). REQUIREMENTS.md simply was not updated after 02-05-PLAN.md executed. This does not block the phase but should be corrected as a trivial doc-sync follow-up.

### Anti-Patterns Found

Scanned all 21 phase-2-modified source/migration files for `TBD`/`FIXME`/`XXX` (blocker gate), `TODO`/`HACK`/`PLACEHOLDER`, "coming soon"/"not yet implemented" language, and stub-shaped returns.

**Result: zero matches.** No debt markers, no placeholder text, no stub implementations found in any phase 2 file.

Five INFO-tier findings from 02-REVIEW.md remain open by design (explicitly out of `fix_scope: critical_warning` per 02-REVIEW-FIX.md, and independently confirmed still present in code during this verification):
- IN-01: `authRedirects`/`FishAuthClaims` unused/drifted (dead exports, not wired into pages yet — cosmetic, Phase 3 territory)
- IN-02: deploy-checklist step 4 describes `&next=/home` which the template omits (harmless — handler already defaults `next` to `/home`)
- IN-03: `profiles` UPDATE grant is broader than "safe fields" (role IS protected by the trigger guard, which is the security-critical boundary; timestamp mutability is a data-hygiene nit, not a security hole)
- IN-04: logout-button ignores `signOut()`'s error result (low impact — session clears locally regardless)
- IN-05: forgot-password shows success copy even on a thrown network error (D-07's anti-enumeration guarantee is about server responses; this only affects the offline-user edge case)

None of these are must-have failures. They are correctly scoped out of this phase's fix cycle and do not block phase goal achievement.

### Human Verification Required

The following require a physical browser and cannot be fully proven by HTTP-level tooling, even though the underlying mechanism (persistent cookie + proxy refresh) has been verified live:

#### 1. Full browser-restart session persistence (AUTH-05)

**Test:** Sign up or log in in a real browser, fully quit and reopen the browser, revisit `/home`.
**Expected:** Still signed in, `/home` renders "You're signed in" without redirecting to `/login`.
**Why human:** curl/HTTP-level testing can replay a saved cookie jar (which this verification did, successfully, proving the mechanism), but cannot fully replicate real browser cookie-jar persistence across an actual process restart, including any browser-specific session-cookie clearing behavior.

#### 2. Visual/UX quality of the FISH-voice email templates and screens in a real mail client

**Test:** Open the confirmation and recovery emails in Mailpit's web UI (or forward to a real client) and visually inspect the layout, spacing, and voice against the UI-SPEC.
**Expected:** Calm, single-column, monochrome layout matching the rest of the product; copy reads as guiding, not alarming.
**Why human:** Zero-chroma color compliance was verified programmatically (all hex values confirmed neutral grey), but overall visual polish, spacing rhythm, and "does this feel calm" is a subjective UX judgment.

#### 3. 56px tap-target and keyboard-focus visual confirmation on auth screens

**Test:** Tab through each auth screen (signup, login, forgot-password, reset-password, check-inbox, expired-link, home) and confirm every control shows a visible focus ring and feels comfortably large to click/tap.
**Expected:** Matches the Phase 1 kit contract (`/kit` page) — no surprises introduced by embedding kit components in real forms.
**Why human:** The Phase 1 kit components (Button, Input) already carry the 56px/focus-ring guarantees and were verified in Phase 1; this phase only composes them, but a final visual pass confirms no layout regression was introduced.

### Gaps Summary

No blocking gaps found. Every roadmap Success Criterion, every PLAN-level must-have, every artifact, and every key link verified — the substantial majority proven through live execution against the running local Supabase stack rather than static code reading alone. Both Critical review findings (open redirect, dead duplicate-email branch) and all 6 Warning findings from 02-REVIEW.md were independently re-confirmed as fixed in the current code, with the open-redirect fix additionally re-exploited live to prove the fix holds under the exact attack scenario the review described. The 5 INFO-tier findings remain open exactly as documented and are correctly out of this phase's fix scope. One documentation-only discrepancy was found (REQUIREMENTS.md checkbox staleness for AUTH-03/04) — flagged as a non-blocking follow-up, not a phase gap, since the underlying capability is fully implemented and live-proven.

---

_Verified: 2026-07-03T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
