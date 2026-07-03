---
status: partial
phase: 02-secure-account-you-can-return-to
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md
started: 2026-07-03T03:12:53Z
updated: 2026-07-03T03:35:00Z
mode: mvp
user_story: "As a new client, I want to sign up, verify my email, log in, stay logged in across a browser restart, and log out, so that I can always return to an account where my data belongs only to me."
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing halted — user-flow step 3 failed; MVP mode: fix the flow before re-running. Tests 4-13 remain pending.]

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
result: issue
reported: "internal server error upon clicking the link"
severity: blocker
section: user-flow

### 4. Stay Signed In Across a Browser Restart
expected: Quit the browser entirely (not just the tab). Reopen it and go straight to /home. You are still signed in — no login screen, no flash of being logged out.
result: [pending]
section: user-flow

### 5. Log Out and Be Kept Out
expected: On /home, click Log out. You land on /login. Now type /home directly into the address bar — you are redirected back to /login (signed-out visitors can't see the authenticated screen).
result: [pending]
section: user-flow

### 6. Return to Your Account
expected: On /login, enter the same email and password you signed up with. Click the single primary button. You land back on /home, signed in — the account was waiting for you (the user story's outcome).
result: [pending]
section: user-flow

<!-- Section 2: Technical checks (run ONLY after all user-flow steps pass) -->

### 7. Wrong Password Stays Calm and Non-Revealing
expected: On /login, enter your email with a wrong password. A single field-level error appears — "That email and password don't match. Try again?" — in the soft notice tone, never alarming red, and it does not reveal whether the email exists.
result: [pending]
section: technical

### 8. Unverified Login Routes to Check-Inbox
expected: Sign up a second account but do NOT click its verification email. Try logging in with it. Instead of an error, you are routed to /check-inbox (with the email pre-filled) where you can resend the verification — guidance, not a scold.
result: [pending]
section: technical

### 9. Forgot Password Never Reveals Who Has an Account
expected: On /forgot-password, submit a real seeded email (client1@fish.dev), then reload and submit a made-up email (nobody@fish.dev). Both show the identical in-place success copy — no difference in wording, layout, or tone.
result: [pending]
section: technical

### 10. Recovery Link Lands on Set-New-Password (post-restart re-check)
expected: From the forgot-password request for a real account, open the Mailpit email and inspect the raw link: it must carry `type=recovery&next=/reset-password` (this is the re-check plan 02-05 requires after the stack restart). Clicking it lands you signed in on /reset-password — a single password field with an "At least 8 characters." hint. Set a new password; you land on /home. Log out and log back in with the NEW password successfully.
result: [pending]
section: technical

### 11. Consumed Link Routes to a Calm Expired-Link Screen
expected: Click the same (already used) email link again — either the signup or recovery one. You land on /expired-link, which explains calmly, knows which type of link it was, pre-fills your email, and offers a working resend — no raw error, no dead end.
result: [pending]
section: technical

### 12. RLS and Role Escalation Are Enforced
expected: Run `pnpm verify:rls` — all 6 assertions PASS (client sees only their own profile; coach sees own + 3 assigned clients only; a client's attempt to make themselves a coach is rejected; a safe-field update succeeds; no RLS recursion errors) and the script exits 0. Run `pnpm seed` a second time — it reports the accounts already exist, creating zero duplicates.
result: [pending]
section: technical

<!-- Section 3: Coverage check (goal-backward on the user story's outcome clause) -->

### 13. Coverage: "Always return to an account where my data belongs only to me"
expected: Confirm the outcome clause is observably true from the evidence above — return: verified email login persists across full browser restart and works again after logout (tests 4–6); data belongs only to me: RLS boundary + escalation guard verified live (test 12), and server-side role enforcement means signup can only ever create clients. If tests 1–12 passed, confirm with "yes".
result: [pending]
section: coverage

## Summary

total: 13
passed: 2
issues: 1
pending: 10
skipped: 0
blocked: 0

## Gaps

- truth: "Clicking the verification email link signs the user in and lands them at /home"
  status: failed
  reason: "User reported: internal server error upon clicking the link"
  severity: blocker
  test: 3
  root_cause: ""     # Filled by diagnosis
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis
