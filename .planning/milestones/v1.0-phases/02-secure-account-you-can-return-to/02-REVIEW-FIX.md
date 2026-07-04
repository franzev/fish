---
phase: 02-secure-account-you-can-return-to
fixed_at: 2026-07-03T10:46:30Z
review_path: .planning/phases/02-secure-account-you-can-return-to/02-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-07-03T10:46:30Z
**Source review:** .planning/phases/02-secure-account-you-can-return-to/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (2 Critical, 6 Warning; fix_scope = critical_warning, 5 Info findings out of scope)
- Fixed: 8
- Skipped: 0

**Verification at final HEAD:** `pnpm --filter @fish/web exec vitest run` — 15 files, 120 tests passing (baseline was 109; 11 tests added). `pnpm build` — web production build and shared package typechecks pass. `apps/web` `tsc --noEmit` run after every code fix. `scripts/verify-rls.ts` executed live against the running local stack (all 6 assertions PASS, exit 0), without resetting the database.

## Fixed Issues

### CR-01: Open redirect via unvalidated `next` parameter in `/auth/confirm`

**Files modified:** `apps/web/app/auth/confirm/route.ts`
**Commit:** ae7ad62
**Status:** fixed: requires human verification (security-logic condition; verified by typecheck + build, no route-level test exists)
**Applied fix:** `next` is now honored only when it is a same-origin relative path — must start with `/`, must not start with `//` (protocol-relative escape), and must contain no backslashes (`/\evil` normalization escape, stricter than the review's `startsWith("/\\")` suggestion, per orchestrator direction). Anything else falls back to the D-08 default `/home`. Suggested manual check: hit `/auth/confirm?...&next=https://example.org`, `&next=//example.org`, and `&next=/%5Cexample.org` and confirm all land on `/home` (or `/expired-link` when the token is invalid).

### CR-02: Signup "already registered" branch dead under `enable_confirmations = true`

**Files modified:** `apps/web/app/signup/page.tsx`, `apps/web/app/signup/page.test.tsx`
**Commit:** c36f624
**Applied fix:** `signUp` now destructures `{ data, error }`; after the error branch (kept for confirmations-off environments), a `data?.user && data.user.identities?.length === 0` check surfaces "That email's already in use. Try logging in instead?" instead of routing an existing confirmed user to `/check-inbox` to wait for an email that never comes. Tests updated per orchestrator direction: the happy-path mock now returns the real confirmations-on shape (user with populated `identities`), and a new test mocks the anti-enumeration response (`{ data: { user: { identities: [] } }, error: null }`) — the branch production actually takes — asserting the existing-account copy and that no navigation happens.

### WR-01: proxy.ts constructed the response before writing refreshed request cookies

**Files modified:** `apps/web/lib/supabase/proxy.ts`
**Commit:** d39faea
**Status:** fixed: requires human verification (middleware session-refresh behavior has no unit test; verified by typecheck + build)
**Applied fix:** Applied the documented @supabase/ssr pattern exactly: `let response = NextResponse.next({ request })`, and inside `setAll` the refreshed cookies are first written onto `request.cookies`, then the response is re-created with the mutated request (re-snapshotting the header override), then cookies are set on the response. The single-response invariant is preserved (exactly one response is returned, cookies written to both request and response) and the misleading "exactly ONE NextResponse is constructed" comment was rewritten to state the real contract. Suggested manual check: with a short-lived access token, navigate after expiry and confirm the server render sees the refreshed session (no second refresh in the auth logs).

### WR-02: Resend handlers showed "Sent again" even when nothing was sent

**Files modified:** `apps/web/app/check-inbox/page.tsx`, `apps/web/app/check-inbox/page.test.tsx`, `apps/web/app/expired-link/page.tsx`, `apps/web/app/expired-link/page.test.tsx`
**Commit:** 4fe7463
**Applied fix:** Both handlers now capture `{ error }` from `resend`/`resetPasswordForEmail`; failures (rate limits included) show a calm `Alert tone="notice"`: "That didn't send — give it a minute and try again." — never false success, never an alarming error tone. Empty-email guards: `check-inbox` disables the resend button when `?email=` is missing and swaps the body sentence to "We sent you a link. Open it on this device to continue." (no more "We sent a link to ."); `expired-link` (which has an editable Input that `required` could not gate on a `type="button"` click) guards in the handler and shows "Add your email above, then resend." without calling the API. Four tests added covering the failure notice and empty-email guards on both screens.

### WR-03: Every reset-password failure reported as "Needs to be at least 8 characters."

**Files modified:** `apps/web/app/reset-password/page.tsx`, `apps/web/app/reset-password/page.test.tsx`
**Commit:** c5293d3
**Applied fix:** `updateUser` errors now branch on stable codes: `same_password` shows "That's the same password as before. Pick a new one."; a missing/expired recovery session (`error.name === "AuthSessionMissingError"` or `error.code === "session_not_found"`) routes to `/expired-link?type=recovery` so the existing resend flow takes over (this also covers the review's direct-navigation case at the moment of submit); `weak_password`/`validation_failed` keep the 8-characters copy; unknown errors get "That didn't save. Give it a moment and try again."; thrown transport failures get "Couldn't reach the server. Check your connection and try again." Three tests added (same_password copy, session-missing redirect, weak_password copy). Note: the review's optional on-mount `getUser()` check was not added — the sessionless case is handled at submit; an on-mount check can be layered in Phase 3 route protection where it naturally belongs.

### WR-04: Auth control flow matched human-readable message strings

**Files modified:** `apps/web/app/login/page.tsx`, `apps/web/app/login/page.test.tsx`, `apps/web/app/signup/page.tsx`, `apps/web/app/signup/page.test.tsx`
**Commit:** 3675010
**Applied fix:** Login branches on `error.code === "email_not_confirmed"` and signup on `error.code === "user_already_exists"`, each keeping the message `.includes()` check as a fallback for older backends (per the review's "keep the message check as a fallback"). Login's `catch` block no longer tells an offline user their credentials are wrong — it now shows "Couldn't reach the server. Check your connection and try again." Three tests added: code-based routing to `/check-inbox` with drifted wording, code-based existing-email copy on signup, and thrown-network-failure connection copy on login.

### WR-05: verify-rls.ts leak assertion could never fail

**Files modified:** `scripts/verify-rls.ts`
**Commit:** 47a8120
**Applied fix:** Replaced the vacuous check (email addresses compared against `display_name` values — `profiles` has no email column) with the review's suggested identity-based assertion: the client resolves its own user id via `getUser()` and any returned row with a foreign id is a leak. This is independent of seed display names (which the DB-04 safe-field check itself mutates). Verified live against the running local stack: all six assertions PASS, exit 0; the new assertion is falsifiable (any foreign-id row flips it to FAIL).

### WR-06: Email templates promised 24 hours; OTP expiry was unpinned (1-hour default)

**Files modified:** `supabase/config.toml`, `docs/deploy-checklist.md`
**Commit:** c8a99d5
**Applied fix:** Chose the orchestrator-preferred option: pinned `otp_expiry = 86400` under `[auth.email]` so the templates' "This link works once and expires in 24 hours." is stated fact, not a 24x overstatement. Added a step-6 line to the deploy checklist to mirror the 24-hour expiry in the hosted dashboard, noting the hosted security advisor flags expiries above 1 hour and that shortening later must change the expiry AND both templates' copy together. **Stack restart required:** the running local Supabase stack at 127.0.0.1:54321 was deliberately not restarted; the new `otp_expiry` takes effect on the next `supabase stop && supabase start` (or `db reset`).

## Skipped Issues

None — all in-scope findings were fixed. (IN-01 through IN-05 are Info-tier and outside `fix_scope: critical_warning`; they remain open in REVIEW.md.)

---

_Fixed: 2026-07-03T10:46:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
