---
status: diagnosed
phase: 02-secure-account-you-can-return-to
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md
started: 2026-07-03T03:12:53Z
updated: 2026-07-03T12:12:19Z
mode: mvp
user_story: "As a new client, I want to sign up, verify my email, log in, stay logged in across a browser restart, and log out, so that I can always return to an account where my data belongs only to me."
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

<!-- Section 1: User-flow walk-through (MVP mode — halt on any failure; do not advance past a broken step) -->

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Restart the Supabase stack from scratch (`supabase stop && supabase start` — also loads the final email templates per 02-05's post-merge note), run `pnpm db:reset`, then `pnpm seed`, then start the dev server. Stack boots without errors, migrations apply, seed completes (coach + 3 clients), app loads in the browser.
result: pass
section: user-flow

### 2. Sign Up as a New Client
expected: Open /signup. Fill in name, email, and password (8+ chars). Click the single primary button. You land on a calm /check-inbox screen telling you a verification email was sent — one action, no competing choices.
result: pass
section: user-flow

### 3. Verify by Email
expected: Open Mailpit at http://127.0.0.1:54324. A FISH-voice, pure-monochrome verification email is there (no lime, no color). Click its action link. You end up signed in at /home, which greets you calmly with a single Log out action.
result: pass
note: "fresh signup on localhost:3001 landed signed in at /home after gap-closure plan 02-06; verified by user 2026-07-03"
section: user-flow

### 4. Stay Signed In Across a Browser Restart
expected: Quit the browser entirely (not just the tab). Reopen it and go straight to /home. You are still signed in — no login screen, no flash of being logged out.
result: pass
section: user-flow

### 5. Log Out and Be Kept Out
expected: On /home, click Log out. You land on /login. Now type /home directly into the address bar — you are redirected back to /login (signed-out visitors can't see the authenticated screen).
result: pass
section: user-flow

### 6. Return to Your Account
expected: On /login, enter the same email and password you signed up with. Click the single primary button. You land back on /home, signed in — the account was waiting for you (the user story's outcome).
result: pass
section: user-flow

<!-- Section 2: Technical checks (run ONLY after all user-flow steps pass) -->

### 7. Wrong Password Stays Calm and Non-Revealing
expected: On /login, enter your email with a wrong password. A single field-level error appears — "That email and password don't match. Try again?" — in the soft notice tone, never alarming red, and it does not reveal whether the email exists.
result: pass
source: automated
note: "Re-run after gap-closure plan 02-07, delegated by user to Claude's Chromium session 2026-07-03 (1440x900, live stack): message renders in place in the notice tier (weight 400, info-circle icon, monochrome); heading/button/links/card rect deltas all 0.00px (was 14.8px); double-submit shows one message; signup tier-2 error treatment unaffected; correct password still lands /home."
section: technical

### 8. Unverified Login Routes to Check-Inbox
expected: Sign up a second account but do NOT click its verification email. Try logging in with it. Instead of an error, you are routed to /check-inbox (with the email pre-filled) where you can resend the verification — guidance, not a scold.
result: pass
section: technical

### 9. Forgot Password Never Reveals Who Has an Account
expected: On /forgot-password, submit a real seeded email (client1@fish.dev), then reload and submit a made-up email (nobody@fish.dev). Both show the identical in-place success copy — no difference in wording, layout, or tone.
result: pass
section: technical

### 10. Recovery Link Lands on Set-New-Password (post-restart re-check)
expected: From the forgot-password request for a real account, open the Mailpit email and inspect the raw link: it must carry `type=recovery&next=/reset-password` (this is the re-check plan 02-05 requires after the stack restart). Clicking it lands you signed in on /reset-password — a single password field with an "At least 8 characters." hint. Set a new password; you land on /home. Log out and log back in with the NEW password successfully.
result: issue
reported: "when I press enter it, form should submit"
severity: major
note: "Retest reached the reset form (recovery email delivery confirmed working), but pressing Enter in the password field does not submit the form. Prior 'no email received' report was diagnosed as a mistyped address — pipeline healthy."
section: technical

### 11. Consumed Link Routes to a Calm Expired-Link Screen
expected: Click the same (already used) email link again — either the signup or recovery one. You land on /expired-link, which explains calmly, knows which type of link it was, pre-fills your email, and offers a working resend — no raw error, no dead end.
result: issue
reported: "enter submit still not working in /expired-link page"
severity: major
note: "Page itself loads and routes correctly (user reached /expired-link); the defect is keyboard submit — pressing Enter in the resend form does not submit, same symptom as test 10's reset form."
section: technical

### 12. RLS and Role Escalation Are Enforced
expected: Run `pnpm verify:rls` — all 6 assertions PASS (client sees only their own profile; coach sees own + 3 assigned clients only; a client's attempt to make themselves a coach is rejected; a safe-field update succeeds; no RLS recursion errors) and the script exits 0. Run `pnpm seed` a second time — it reports the accounts already exist, creating zero duplicates.
result: pass
source: automated
note: "Run by Claude in-session 2026-07-03: verify:rls printed 6/6 PASS, exit 0; second seed reported all 4 accounts already exist, exit 0."
section: technical

<!-- Section 3: Coverage check (goal-backward on the user story's outcome clause) -->

### 13. Coverage: "Always return to an account where my data belongs only to me"
expected: Confirm the outcome clause is observably true from the evidence above — return: verified email login persists across full browser restart and works again after logout (tests 4–6); data belongs only to me: RLS boundary + escalation guard verified live (test 12), and server-side role enforcement means signup can only ever create clients. If tests 1–12 passed, confirm with "yes".
result: pass
source: automated
note: "Verified by Claude at user's request 2026-07-03: return clause backed by user-verified tests 4–6; isolation clause backed by live verify:rls 6/6 (test 12), hardcoded 'client' role in 0002_handle_new_user.sql, and prevent_role_change trigger in 0005_role_guard.sql. Scoped pass — the recovery-email failure weakening 'always return' is tracked as the test 10 gap, not re-logged here."
section: coverage

## Summary

total: 13
passed: 11
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Clicking the verification email link signs the user in and lands them at /home"
  status: resolved
  reason: "User reported: internal server error upon clicking the link"
  severity: blocker
  test: 3
  root_cause: "Port/site_url mismatch, not a code bug: supabase/config.toml pins site_url=http://127.0.0.1:3000 so email links point at :3000, but port 3000 is held by an unrelated project (Timberyard, Next 15) while the FISH dev server actually listens on :3001. The link hits the wrong app, which 500s. The identical request against :3001 verifies the email and lands at /home with a session cookie — FISH's /auth/confirm handler, proxy, and env keys are all healthy."
  artifacts:
    - path: "supabase/config.toml"
      issue: "site_url and additional_redirect_urls pin http://127.0.0.1:3000, a port FISH does not serve in this environment"
    - path: "apps/web/app/auth/confirm/route.ts"
      issue: "NOT at fault — verified working end-to-end on port 3001"
  missing:
    - "Deterministic agreement between the FISH dev port and site_url: pin the dev port explicitly in the dev script (no silent Next port fallback) and point site_url + additional_redirect_urls at that port"
    - "Supabase stack restart after the config change (config.toml is read at stack start)"
  debug_session: ".planning/debug/resolved/verify-email-link-500.md"
  note: "Resolved by gap-closure plan 02-06: pinned dev port to 3001 AND aligned site_url host to localhost (cookies are host-scoped — a 127.0.0.1 link left the session invisible on localhost). Fresh signup verified signed in at /home by user 2026-07-03."

- truth: "Wrong password on /login shows a single in-place field-level error in the soft notice tone, without a full page reload"
  status: resolved
  reason: "User reported: the whole page rerenders when login button clicked"
  severity: major
  test: 7
  root_cause: "No reload/navigation occurs — CDP reproduction confirmed the error copy renders in place with zero frameNavigated/load events. The perceived 'whole page rerenders' is a whole-page layout shift: /login vertically centers its Card (flex min-h-dvh items-center justify-center) and Input reserves no space for its message line, so setting passwordError grows the card ~30px and flexbox re-centers it — heading/email jump up 14.8px while button/links jump down 14.8px in the same frame at 1440x900. Secondary: the copy is wired to Input's heavy tier-2 `error` prop (semibold, 1px->2px border flip, alert icon) instead of the tier-1 soft `notice` tone the test expects (color itself is compliant monochrome, not red)."
  artifacts:
    - path: "apps/web/app/login/page.tsx"
      issue: "line 63 vertically centers the card so any card growth moves everything; line 79 passes the copy via the tier-2 `error` prop instead of the tier-1 `notice` prop"
    - path: "apps/web/components/ui/input.tsx"
      issue: "hint/notice/error message <p> is conditionally rendered with no reserved space — showing a message changes the component's height (violates the phase-01 layout-stability contract Button honors)"
  missing:
    - "Reserve a constant-height message slot under the field so appearance changes text, not geometry (always render the message row in Input, or swap a persistent hint line for the message on this page)"
    - "Render the wrong-password copy in the tier-1 notice tone per the UAT expectation"
    - "Fix verification: re-run UAT test 7 asserting zero movement of heading/button rects when the message appears (CDP measurement pattern from the debug session)"
  debug_session: ".planning/debug/resolved/login-wrong-password-full-rerender.md"
  note: "Resolved by gap-closure plan 02-07: Input now always renders a min-h-[22px] message row (reserved geometry) and /login passes the copy via the tier-1 notice prop. Fix verification performed per the CDP pattern: heading/button rect deltas 0.00px when the message appears (Chromium 1440x900, 2026-07-03)."

- truth: "Submitting /forgot-password for a real seeded account delivers a recovery email to Mailpit carrying type=recovery&next=/reset-password"
  status: resolved
  reason: "User reported: no email received"
  severity: major
  test: 10
  root_cause: "NOT a code/config/infrastructure defect. The three /recover requests made during UAT tests 9/10 all bear GoTrue's 'unknown email' signature (fast 200, no user_recovery_requested audit event, recovery_sent_at NULL for every user) — the address actually submitted matched no account (typo/truncation; HTML email validation and GoTrue both silently accept TLD-less strings like 'client1@fish'). Live reproduction with verbatim client1@fish.dev delivered the recovery email to Mailpit instantly with the exact expected type=recovery&next=/reset-password link. Rate limits, case sensitivity, empty-submit, template, and redirectTo allowlist all eliminated experimentally. Compounding factor by design (D-07 anti-enumeration): the form discards resetPasswordForEmail's result and always shows success, so there was no signal that nothing matched."
  artifacts:
    - path: "apps/web/app/forgot-password/page.tsx"
      issue: "NOT defective — discards the result and unconditionally shows success (intentional anti-enumeration, D-07)"
  missing:
    - "No code change — retest test 10 submitting the seeded address verbatim (copy-paste client1@fish.dev)"
  debug_session: ".planning/debug/recovery-email-not-delivered.md"
  note: "Recovery emails for client1@fish.dev and client2@fish.dev are already in Mailpit from the investigation's live reproduction — tests 10 and 11 can resume immediately."

- truth: "Pressing Enter in the /reset-password password field submits the form (keyboard submit works, not just the button)"
  status: failed
  reason: "User reported: when I press enter it, form should submit"
  severity: major
  test: 10
  root_cause: "NOT a steady-state code defect. Live reproduction (real Chromium against the running dev stack on :3001) proved the hydrated page submits on Enter identically to the button click, end-to-end. The report matches the pre-hydration window: before React attaches onSubmit, Enter triggers the browser's NATIVE implicit submission — a GET to /reset-password? that silently reloads and wipes the field ('nothing happened'). In next dev the recovery-link redirect is the FIRST visit to the route, so lazy route compilation stretches the unhydrated window to human scale; after the silent reload the route is warm, hydration is instant, and the button works — matching 'only the button submits'. Form markup is correct (<form onSubmit> + type=\"submit\" since first commit); no name attribute on the field, so the native GET leaks nothing. jsdom cannot exercise implicit submission, so no unit test can guard this."
  artifacts:
    - path: "apps/web/app/reset-password/page.tsx"
      issue: "NOT defective — form semantics correct; Enter-submit verified working end-to-end when hydrated; only exposure is the universal Next.js pre-hydration window (benign: no name attr, nothing leaks)"
  missing:
    - "No code change to /reset-password — retest test 10 on a settled/hydrated page (production builds hydrate near-instantly)"
    - "Optional: real-browser (Playwright) e2e regression asserting Enter submits on /reset-password — not testable in jsdom/vitest"
    - "Land test 11's /expired-link form fix, the one page where Enter genuinely never works and which kept re-triggering this report"
  debug_session: ".planning/debug/enter-submit-reset-password.md"

- truth: "Pressing Enter in the /expired-link resend form submits it (keyboard submit works, not just the button)"
  status: failed
  reason: "User reported: enter submit still not working in /expired-link page"
  severity: major
  test: 11
  root_cause: "/expired-link has no <form> element at all: the email Input and resend Button are wrapped in a plain <div> and the button is type=\"button\" wired to onClick={handleResend}. Implicit form submission (Enter in a text field) is a <form> behavior — with no form and no type=\"submit\" button, Enter is a structural no-op. Only auth screen deviating from the sibling pattern (login/signup/forgot-password/reset-password all use <form onSubmit> + type=\"submit\"). NOT a shared root cause with test 10. Tests only exercise fireEvent.click, so the defect shipped undetected."
  artifacts:
    - path: "apps/web/app/expired-link/page.tsx"
      issue: "Missing <form>; button is type=\"button\" + onClick instead of type=\"submit\" inside a form with onSubmit (lines 58–73)"
    - path: "apps/web/app/expired-link/page.test.tsx"
      issue: "No keyboard-submit test — submission exercised only via fireEvent.click"
  missing:
    - "Wrap Input + Button in <form className=\"mt-6 space-y-5\" onSubmit={handleSubmit}>, make the Button type=\"submit\", convert handleResend to handleSubmit(event: FormEvent) with event.preventDefault()"
    - "Regression test that submits via Enter in the email field"
    - "Optionally normalize /check-inbox to the same form pattern (same no-form shape, defect doesn't manifest there)"
  debug_session: ".planning/debug/enter-submit-expired-link.md"

- truth: "Buttons signal interactivity via the cursor: cursor-pointer normally, cursor-progress while loading, cursor-not-allowed when disabled"
  status: failed
  reason: "User reported: buttons should have a cursor-pointer, cursor-progress for loading, cursor-not-allowed for disabled"
  severity: cosmetic
  test: null  # general UAT feedback, not tied to a numbered test
  root_cause: "Pre-diagnosed by orchestrator (no debug agent needed): Button (apps/web/components/ui/button.tsx) sets no cursor utilities, and Tailwind v4 preflight defaults <button> to cursor:default, so no pointer feedback ever shows. Additionally, disabled uses `disabled:pointer-events-none` and loading adds `pointer-events-none` — pointer-events:none suppresses the element's own cursor, so cursor-progress/cursor-not-allowed cannot take effect while those classes remain."
  artifacts:
    - path: "apps/web/components/ui/button.tsx"
      issue: "No cursor classes; `pointer-events-none` on disabled/loading states blocks any cursor styling from applying"
  missing:
    - "Add cursor-pointer to the Button base classes"
    - "Show cursor-progress while loading and cursor-not-allowed when disabled — requires dropping pointer-events-none in favor of the disabled attribute + guarding the loading state (e.g. ignore clicks while loading) so the cursor is actually visible over the control"
    - "Keep the accessibility floor: disabled/loading must still be non-activatable via keyboard and click"
  debug_session: ""
