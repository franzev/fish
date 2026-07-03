---
phase: 02-secure-account-you-can-return-to
reviewed: 2026-07-03T02:30:26Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - apps/web/.env.example
  - apps/web/app/auth/confirm/route.ts
  - apps/web/app/check-inbox/page.test.tsx
  - apps/web/app/check-inbox/page.tsx
  - apps/web/app/expired-link/page.test.tsx
  - apps/web/app/expired-link/page.tsx
  - apps/web/app/forgot-password/page.test.tsx
  - apps/web/app/forgot-password/page.tsx
  - apps/web/app/home/page.test.tsx
  - apps/web/app/home/page.tsx
  - apps/web/app/login/page.test.tsx
  - apps/web/app/login/page.tsx
  - apps/web/app/reset-password/page.test.tsx
  - apps/web/app/reset-password/page.tsx
  - apps/web/app/signup/page.test.tsx
  - apps/web/app/signup/page.tsx
  - apps/web/components/auth/logout-button.tsx
  - apps/web/lib/supabase/client.ts
  - apps/web/lib/supabase/proxy.ts
  - apps/web/lib/supabase/server.ts
  - apps/web/package.json
  - apps/web/proxy.ts
  - docs/deploy-checklist.md
  - packages/supabase/src/auth.ts
  - packages/supabase/src/database.generated.ts
  - packages/supabase/src/database.types.ts
  - scripts/seed.ts
  - scripts/verify-rls.ts
  - supabase/config.toml
  - supabase/migrations/0001_profiles.sql
  - supabase/migrations/0002_handle_new_user.sql
  - supabase/migrations/0003_coach_clients.sql
  - supabase/migrations/0004_rls_helpers.sql
  - supabase/migrations/0005_role_guard.sql
  - supabase/templates/confirmation.html
  - supabase/templates/recovery.html
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-07-03T02:30:26Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

Reviewed the Phase 2 auth foundation: Supabase SSR client wiring (browser/server/proxy), the token-hash `/auth/confirm` handler, six auth screens plus their tests, the five migrations (profiles, handle_new_user, coach_clients, RLS helpers, role guard), seed and RLS-verification scripts, email templates, and deploy docs.

The security-critical checklist items are largely done right: `/auth/confirm` uses `verifyOtp` with `token_hash` (never `exchangeCodeForSession`); server code reads `getUser()`/`getClaims()`, never `getSession()`; forgot-password shows identical copy for any address (no enumeration); the service-role key appears only in `.env.example` (empty, with a warning) and server-side scripts, never with a `NEXT_PUBLIC_` prefix; `handle_new_user` is SECURITY DEFINER with `set search_path = ''`, `coalesce`, and `on conflict do nothing`; the role self-escalation guard and RLS helper avoid policy recursion; the seed uses `auth.admin.createUser`, never raw `auth.users` inserts.

Two Critical findings remain: an open redirect through the unvalidated `next` parameter in `/auth/confirm`, and a signup duplicate-email branch that is dead code under `enable_confirmations = true` — existing confirmed users are silently funneled to `/check-inbox` and the promised email never arrives. Warnings cover the proxy cookie-propagation pattern deviating from the documented @supabase/ssr contract, swallowed resend errors that show false success, misleading reset-password error copy, fragile error-message string matching, a vacuous leak assertion in `verify-rls.ts`, and an email expiry claim not pinned by config.

**Convention rule packs:** the shared `gsd-tools.cjs verify conventions --check` module is not installed in this environment (no `gsd-plugin` cache under `~/.claude/plugins/cache/`; `02-PATTERNS.md:396` records the same during derivation) — the packs skipped gracefully and emit nothing. A manual spot-check of the changed files against the named axes in `02-PATTERNS.md` (file-name casing, identifier casing, named-exports-except-framework-forced-default, import style) found zero deviations, so no CONVENTION findings are emitted.

No structural pre-pass was provided for this review, so there is no Structural Findings section.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Open redirect via unvalidated `next` parameter in `/auth/confirm` — BLOCKER

**File:** `apps/web/app/auth/confirm/route.ts:15,21`
**Issue:** `next` is taken straight from the query string and passed to `NextResponse.redirect(new URL(next, request.url))`. `new URL()` lets an absolute (`https://evil.example`) or protocol-relative (`//evil.example`) value override the base, so the handler redirects off-origin. This is exploitable without stealing anyone else's token: an attacker signs up with their own email, takes the valid `token_hash` from their own confirmation email, appends `&next=https://evil.example`, and sends that link to a victim. The victim's click both signs the victim's browser into the attacker-controlled account (verifyOtp establishes a session) and lands them on an attacker-controlled page that can seamlessly impersonate FISH — a credential-phishing chain launched from a legitimate `Site URL` link. Supabase's own guidance for this exact handler is to validate `next` as a local path.
**Fix:**
```ts
const rawNext = searchParams.get("next") ?? "/home";
// Only same-origin relative paths: must start with "/", must not start with
// "//" or "/\" (protocol-relative escapes).
const next =
  rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
    ? rawNext
    : "/home";
```

### CR-02: Signup "already registered" branch is dead under `enable_confirmations = true` — existing users are sent to /check-inbox for an email that never comes — BLOCKER

**File:** `apps/web/app/signup/page.tsx:40-53` (interacts with `supabase/config.toml:11`)
**Issue:** With email confirmations enabled (as `config.toml` sets), Supabase's `signUp` does **not** return a "User already registered" error for an existing confirmed email — as an anti-enumeration measure it returns `error: null` with an obfuscated fake user whose `identities` array is empty, and sends no email. So `error.message.toLowerCase().includes("already registered")` never fires in this configuration; the code falls through to `router.push("/check-inbox?...")` and the existing user waits for an email that will never arrive — a dead end with no guidance, for exactly the audience the product promises never to strand. The intended copy ("That email's already in use. Try logging in instead?") is unreachable in production; `page.test.tsx:79-104` only passes because it mocks the error shape that the confirmations-on backend never produces.
**Fix:**
```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { display_name: name } },
});

if (error) { /* keep existing branches for confirmations-off environments */ }

// Confirmations-on: an existing confirmed email returns a fake user with no
// identities and sends no email — surface the existing-account copy instead
// of routing to /check-inbox.
if (data.user && data.user.identities?.length === 0) {
  setEmailError("That email's already in use. Try logging in instead?");
  return;
}

router.push(`/check-inbox?email=${encodeURIComponent(email)}`);
```
Update the test to mock the obfuscated-user response (`{ data: { user: { identities: [] } }, error: null }`) so it exercises the branch production actually takes.

## Warnings

### WR-01: proxy.ts constructs the response before writing refreshed request cookies, so downstream server components never see the refreshed session — WARNING

**File:** `apps/web/lib/supabase/proxy.ts:17-35`
**Issue:** `NextResponse.next({ request })` snapshots the request headers into `x-middleware-request-*` override headers **at construction time**. Here the single response is created on line 17, and `setAll` later mutates `request.cookies` (line 28-30) — after the snapshot — so the refreshed cookies reach the browser (via `response.cookies.set`) but never propagate to the server components rendering that same navigation. On any request where the access token expires, `createClient()` in `server.ts` reads the *stale* cookie, `getUser()` gets a 401, and supabase-js performs a second refresh with the already-rotated refresh token. That usually survives only because it lands inside Supabase's ~10s refresh-token reuse window; it burns a redundant refresh per expiry, leaves the server render on a different session than the browser stores, and is exactly the "browser and server go out of sync and terminate the session prematurely" failure the @supabase/ssr docs warn about. The official pattern reconstructs the response *inside* `setAll` after mutating the request; the file's own "exactly ONE NextResponse" comment inverts the documented contract (the real pitfall is constructing a response *without* `{ request }`, not reconstructing per se).
**Fix:**
```ts
let response = NextResponse.next({ request });

const supabase = createServerClient(url, key, {
  cookies: {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request }); // re-snapshot WITH updated request
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
    },
  },
});

await supabase.auth.getClaims();
return response;
```

### WR-02: Resend handlers ignore the returned error and show "Sent again" even when nothing was sent — WARNING

**File:** `apps/web/app/check-inbox/page.tsx:20-29`, `apps/web/app/expired-link/page.tsx:22-35`
**Issue:** Both handlers `await supabase.auth.resend(...)` / `resetPasswordForEmail(...)` and unconditionally `setResent(true)`. supabase-js returns failures as `{ error }` rather than throwing, so rate-limit errors (`over_email_send_rate_limit` — the built-in sender allows only a handful per hour, and `check-inbox` is precisely where users hammer resend) and validation errors are silently converted into "Sent again. Check your inbox." — a false promise to users who will then wait on an inbox that stays empty. Compounding it: `check-inbox` calls `resend({ type: "signup", email: "" })` when the `?email=` param is missing (the body also renders "We sent a link to ."), and `expired-link`'s `Input required` is decorative because the Button is `type="button"` with no wrapping form submit — an empty email still fires the request and still shows success.
**Fix:** Capture `{ error }`; on error keep the screen calm but honest, e.g. an `Alert tone="notice"` such as "That didn't send — give it a minute and try again." Guard the empty-email case (disable the button or show the notice) instead of calling the API with `""`. In `check-inbox`, hide or repurpose the interpolated sentence when `email` is empty.

### WR-03: Every reset-password failure is reported as "Needs to be at least 8 characters." — WARNING

**File:** `apps/web/app/reset-password/page.tsx:31-38`
**Issue:** `updateUser({ password })` fails for several reasons that have nothing to do with length: `same_password` (new password identical to old), a missing/expired recovery session (user opened `/reset-password` directly, or the recovery session lapsed — "Auth session missing"), and rate limits. All of them render "Needs to be at least 8 characters.", so a user typing a valid 12-character password that happens to match their old one (or whose link session expired) is told to retry something that can never succeed — a scold-free voice delivering wrong guidance is still wrong guidance. There is also no on-mount session check, so the sessionless case is reachable by simply navigating to the URL.
**Fix:** Branch on `error.code`: `same_password` → "That's the same password as before. Pick a new one."; `weak_password`/`validation_failed` → the 8-characters copy; session-missing (`error.name === "AuthSessionMissingError"` or a `getUser()` check on mount) → route to `/expired-link?type=recovery` so the existing resend flow takes over.

### WR-04: Auth error handling matches on human-readable message strings instead of stable error codes — WARNING

**File:** `apps/web/app/login/page.tsx:35`, `apps/web/app/signup/page.tsx:41`
**Issue:** `error.message.toLowerCase().includes("email not confirmed")` and `...includes("already registered")` couple control flow to English copy that Supabase does not guarantee stable across gotrue releases. supabase-js v2 exposes stable codes on `AuthApiError` (`error.code === "email_not_confirmed"`, `"user_already_exists"`, `"invalid_credentials"`). If the message wording drifts, an unconfirmed user gets the bad-credentials copy instead of the `/check-inbox` route — a silent behavioral regression no test would catch. Relatedly, login's `catch` block (line 46-49) shows "That email and password don't match" for *network* failures too, telling an offline user their credentials are wrong.
**Fix:** Branch on `error.code` (keep the message check as a fallback if desired). In the `catch` block, use connection-loss copy ("Couldn't reach the server. Check your connection and try again.") instead of the credentials copy.

### WR-05: verify-rls.ts leak assertion compares display names against email addresses — it can never fail — WARNING

**File:** `scripts/verify-rls.ts:58-60`
**Issue:** `otherEmails` contains `"client2@fish.dev"` etc., but the check reads `row.display_name`, which the seed sets to `"Sam Okafor"`, `"Priya Nair"`, `"Coach Dana"`. `leaked` is therefore always `false` and "DB-03 client boundary: no other accounts visible" always PASSes — a vacuous assertion inside a script whose entire purpose is to be "a real gate, not advisory." The `rows.length === 1` check partially compensates, but the named leak check proves nothing (`profiles` has no email column at all).
**Fix:**
```ts
const otherNames = ["Sam Okafor", "Priya Nair", "Coach Dana"];
const leaked = rows.some((row) =>
  otherNames.includes((row as { display_name?: string }).display_name ?? "")
);
```
(Or assert on `row.id !== ownId`, which is independent of seed display names.)

### WR-06: Email templates promise "expires in 24 hours" but the OTP expiry is not pinned in config — default is 1 hour — WARNING

**File:** `supabase/templates/confirmation.html:40`, `supabase/templates/recovery.html:42`, `supabase/config.toml:9-11`
**Issue:** Both templates state "This link works once and expires in 24 hours." as fact, but `config.toml` never sets `otp_expiry` under `[auth.email]`, and the Supabase default is 3600 seconds (1 hour; the hosted security advisor flags anything above that). A user who trusts the stated window and clicks at hour 3 gets the expired-link screen after being told they had a day — a factual claim in the product's calm voice that is wrong by 24x under default config. The `/expired-link` recovery path softens the blow but does not make the claim true.
**Fix:** Either pin `otp_expiry = 86400` in `[auth.email]` (and mirror it in the hosted dashboard per the deploy checklist), or change the copy to match the real window ("expires in one hour") / drop the specific duration ("This link works once and expires soon").

## Info

### IN-01: Dead auth exports that have already drifted from the implemented routes — INFO

**File:** `packages/supabase/src/auth.ts:3-14`, `packages/supabase/src/database.types.ts:18-29`
**Issue:** Nothing in the repo consumes `authRedirects`, `FishAuthClaims`, or `LegacyChatContracts` (grep confirms definitions only). The drift has already started: `authRedirects.signedOut` is `"/"` while `home/page.tsx:20` redirects signed-out users to `/login`; `authRedirects.home` is `"/home"` while `login/page.tsx:45` hardcodes the string. `FishAuthClaims` declares `role: UserRole` as a JWT claim, but no custom access-token hook puts `role` into the JWT — role lives only in `public.profiles` — so the type describes claims that do not exist.
**Fix:** Either wire the pages to import `authRedirects` (and correct `signedOut` to `/login`), or delete the constants until Phase 3 actually needs them. Drop or comment-gate `FishAuthClaims.role` until a claims hook exists.

### IN-02: Deploy checklist describes a confirmation link the template doesn't emit — INFO

**File:** `docs/deploy-checklist.md:39-42`, `supabase/templates/confirmation.html:32`
**Issue:** Step 4 tells the deployer to confirm the confirmation link is `.../auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/home`, but the shipped template omits `&next=/home` (behavior matches only because the route handler defaults `next` to `/home`). A deployer following the checklist literally will conclude the template is wrong and "fix" it.
**Fix:** Align the two — either add `&next=/home` to the template or update the checklist to describe the actual link and note the handler default.

### IN-03: profiles UPDATE surface is wider than "safe fields" — timestamps are user-writable and updated_at never updates — INFO

**File:** `supabase/migrations/0001_profiles.sql:19`, `supabase/migrations/0004_rls_helpers.sql:38-43`, `supabase/migrations/0002_handle_new_user.sql:19`
**Issue:** The policy comment says "safe fields (display_name)" but the table-level `GRANT UPDATE` covers every column and the policy has no column restriction — only `role` is trigger-guarded, so an authenticated user can rewrite their own `created_at`/`updated_at`, corrupting audit values. Separately, no trigger touches `updated_at` on update (no `moddatetime`), so it is permanently equal to `created_at`; and `display_name` (defaulted from unvalidated `raw_user_meta_data` at signup and updatable thereafter) has no length bound.
**Fix:** `grant update (display_name) on public.profiles to authenticated;` (replacing the blanket update grant — the DB-04 escalation test still proves the boundary, just at the privilege layer), add a `moddatetime(updated_at)` trigger, and consider `check (char_length(display_name) <= 80)`.

### IN-04: Logout ignores the signOut result and has no failure path for the loading state — INFO

**File:** `apps/web/components/auth/logout-button.tsx:16-21`
**Issue:** `signOut()`'s returned `{ error }` is discarded and there is no try/finally, unlike every other async handler in this phase. In practice `signOut` clears local session state even when the network call fails and the push to `/login` proceeds, so the impact is low — but if `push` is ever preceded by a thrown error the button spins forever with `loading` stuck true.
**Fix:** Wrap in try/finally for symmetry with the sibling handlers, and intentionally ignore `error` with a comment (sessions are cheap to re-establish, per the file's own note).

### IN-05: forgot-password shows the success copy even when the request itself threw — INFO

**File:** `apps/web/app/forgot-password/page.tsx:26-32`
**Issue:** `setSubmitted(true)` lives in `finally`, so a thrown network failure (offline, DNS) still replaces the form with "If that address has an account, a reset link is on its way." D-07's identical-copy rule guards against *enumeration*, which only applies to server responses — a local network failure reveals nothing, and telling an offline user their reset is "on its way" strands them.
**Fix:** Keep the identical success copy for all *server* outcomes (including errors), but in a `catch` for transport failures show connection-loss copy with the form intact.

---

_Reviewed: 2026-07-03T02:30:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
