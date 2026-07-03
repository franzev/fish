---
status: diagnosed
trigger: "UAT test 10: Submitting /forgot-password for a real seeded account (client1@fish.dev) should deliver a recovery email to Mailpit carrying type=recovery&next=/reset-password — user reported 'no email received'"
created: 2026-07-03T15:00:00Z
updated: 2026-07-03T15:35:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — the three /recover requests made from the browser during UAT tests 9/10 carried email addresses that matched no row in auth.users; GoTrue's anti-enumeration design returned the identical 200 success for them without sending anything, and the app UI (by design, D-07) shows the same success copy regardless. The recovery pipeline itself is fully healthy — proven end-to-end by direct reproduction.
test: complete — direct API reproduction + differential experiments + log/DB forensics
expecting: n/a
next_action: return diagnosis (goal: find_root_cause_only)

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: From the forgot-password request for a real account (client1@fish.dev), a recovery email appears in Mailpit (http://127.0.0.1:54324) whose link carries type=recovery&next=/reset-password
actual: "no email received" — Mailpit shows no recovery email; the /forgot-password page showed its success copy (by design identical for real and fake emails)
errors: None visible in UI (success copy is intentionally non-revealing)
reproduction: UAT test 10 (.planning/phases/02-secure-account-you-can-return-to/02-UAT.md) — submit /forgot-password for client1@fish.dev, check Mailpit
started: Discovered 2026-07-03 during UAT. Known-good baseline: signup VERIFICATION emails delivered fine earlier in the same session (tests 2-3 and 8), so SMTP/Mailpit wiring works in general. During test 9, user submitted /forgot-password for client1@fish.dev AND nobody@fish.dev, possibly multiple times.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "H1 — GoTrue email rate limit exhausted; recovery email silently dropped as 429"
  evidence: "Local stack runs with GOTRUE_RATE_LIMIT_EMAIL_SENT=360000 (effectively unlimited). All three UAT /recover requests returned 200, not 429; zero rate-limit/429 lines anywhere in auth logs."
  timestamp: 2026-07-03T15:15:00Z

- hypothesis: "H3 — redirectTo/site_url mismatch causes GoTrue to reject the recovery request"
  evidence: "The app calls resetPasswordForEmail(email) with NO redirectTo (routing hardcoded in recovery.html template), so the allowlist is never consulted. Direct reproduction produced a link on http://localhost:3001 matching site_url exactly."
  timestamp: 2026-07-03T15:25:00Z

- hypothesis: "H4 — recovery email template misconfigured/missing after 02-06 config changes"
  evidence: "supabase/templates/recovery.html exists; [auth.email.template.recovery] registered; one transient template-fetch error at container start (06:07:43Z, kong not up yet) was immediately followed by a successful reload and ~9-minutely successful reloads thereafter. Direct reproduction delivered a correctly rendered 'Reset your password' email."
  timestamp: 2026-07-03T15:25:00Z

- hypothesis: "H5 — case-sensitivity: user typed Client1@... and GoTrue lookup is case-sensitive"
  evidence: "POST /recover with CLIENT2@FISH.DEV matched the lowercase client2@fish.dev account: audit event logged, recovery_sent_at set, email delivered. GoTrue normalizes case."
  timestamp: 2026-07-03T15:30:00Z

- hypothesis: "H6 — controlled-input/autofill desync submitted an empty email"
  evidence: "POST /recover with empty email returns HTTP 400 validation_failed. All three UAT requests returned 200, so they carried non-empty, well-formed email strings."
  timestamp: 2026-07-03T15:30:00Z

- hypothesis: "H2a — server/client code swallows a real GoTrue ERROR (429/400) behind the success copy"
  evidence: "True that page.tsx discards the result (compounding factor), but GoTrue returned 200 for all three UAT requests — there was no error to swallow. The requests were accepted and processed as 'unknown email'."
  timestamp: 2026-07-03T15:32:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-03T15:00:00Z
  checked: .planning/debug/resolved/verify-email-link-500.md context (prior session) + STATE.md decision log
  found: 02-06 gap closure changed supabase/config.toml site_url/additional_redirect_urls from 127.0.0.1:3000 to localhost:3001; stack was restarted before UAT resumed. Verification emails delivered after that change.
  implication: SMTP->Mailpit path and config load are healthy post-02-06; failure is specific to the recovery path or request content.

- timestamp: 2026-07-03T15:05:00Z
  checked: apps/web/app/forgot-password/page.tsx
  found: handleSubmit calls `await supabase.auth.resetPasswordForEmail(email)` discarding the returned {error}; the finally block sets submitted=true unconditionally. Success copy renders regardless of any GoTrue outcome. No redirectTo passed (by design; recovery.html template hardcodes routing).
  implication: The UI cannot distinguish "email sent" from "no such account" — intentional anti-enumeration (D-07), but it removes all in-app signal for UAT.

- timestamp: 2026-07-03T15:05:00Z
  checked: supabase/config.toml
  found: No [auth.rate_limit] section; [auth.email.template.recovery] -> ./supabase/templates/recovery.html (file exists).
  implication: Config as expected; rate limit falls to CLI defaults.

- timestamp: 2026-07-03T15:10:00Z
  checked: docker inspect supabase_auth_fish env
  found: GOTRUE_RATE_LIMIT_EMAIL_SENT=360000, GOTRUE_SMTP_HOST=supabase_inbucket_fish:1025, GOTRUE_MAILER_TEMPLATES_RECOVERY=http://supabase_kong_fish:8088/email/recovery.html, GoTrue image v2.192.0.
  implication: Rate limiting effectively disabled locally — H1 dead. SMTP wired to Mailpit.

- timestamp: 2026-07-03T15:12:00Z
  checked: Mailpit API (/api/v1/messages)
  found: Only 2 messages total at investigation start — both "Confirm your email address" (06:07:53Z to evangelistafranz+1@gmail.com, 06:45:55Z to evangelistafranz+2@mail.com). No recovery email ever arrived.
  implication: The recovery email was never handed to SMTP at all — not a delivery/visibility problem.

- timestamp: 2026-07-03T15:15:00Z
  checked: docker logs supabase_auth_fish — all /recover requests since container start (06:07:43Z)
  found: Exactly three /recover requests during UAT — 07:14:54Z (10.4ms), 07:15:03Z (5.7ms), 07:16:19Z (11.8ms), all status 200, referer http://localhost:3001/, and NONE carries a user_recovery_requested audit event. No SMTP errors, no 429s, no 5xx anywhere.
  implication: GoTrue accepted all three requests and processed them on its "unknown email" fast path (anti-enumeration 200 without send).

- timestamp: 2026-07-03T15:18:00Z
  checked: auth.users + auth.audit_log_entries in Postgres
  found: recovery_sent_at was NULL for every one of the 9 users; ZERO user_recovery_requested audit events existed. client1@fish.dev exists since 04:54:02Z, email_confirmed_at set, not banned/deleted/SSO. The seed re-run (POST /admin/users x4, 422 email_exists) and verify:rls logins happened at 07:19Z — placing the three /recover requests squarely at UAT tests 9/10 time.
  implication: No recovery was ever initiated for ANY account — the requests cannot have carried client1@fish.dev (or any existing address).

- timestamp: 2026-07-03T15:25:00Z
  checked: LIVE reproduction — POST http://127.0.0.1:54321/auth/v1/recover {"email":"client1@fish.dev"} with the app's publishable key
  found: HTTP 200 in 29ms; user_recovery_requested audit event logged; recovery_sent_at set; "Reset your password" email in Mailpit within the same second; link = http://localhost:3001/auth/confirm?token_hash=...&type=recovery&next=/reset-password (exactly what UAT test 10 expects).
  implication: The entire recovery pipeline — GoTrue, template, SMTP, Mailpit, site_url, routing params — is fully functional. The only variable left is the request payload the browser sent.

- timestamp: 2026-07-03T15:30:00Z
  checked: Differential signature experiments against GoTrue
  found: nobody@fish.dev -> 200 in 10.7ms, no audit (identical signature to all three UAT requests). CLIENT2@FISH.DEV -> 200 in 24.8ms, audit + email (case normalized). Empty email -> 400 validation_failed. Malformed "client1@fish" -> 200 no-send (GoTrue does not reject TLD-less addresses on /recover, and HTML type=email validation also accepts them — a truncated paste passes silently end-to-end).
  implication: The UAT requests' signature (fast 200, no audit) is uniquely produced by a non-matching email address. Case, emptiness, and infrastructure are all excluded.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "The email addresses actually submitted through /forgot-password during UAT tests 9/10 did not match any account in auth.users. All three browser-originated POST /recover requests (07:14:54Z, 07:15:03Z, 07:16:19Z) bear GoTrue's 'unknown email' signature — HTTP 200 in 5-12ms with no user_recovery_requested audit event and recovery_sent_at left NULL for every user — which GoTrue returns identically for unknown addresses to prevent account enumeration. The seeded account client1@fish.dev existed and was confirmed at that time, and a direct API call with that exact address delivers the recovery email to Mailpit instantly with the expected type=recovery&next=/reset-password link — so the address typed into the form was not client1@fish.dev (typo, truncation, or a different address; note both HTML email validation and GoTrue /recover silently accept TLD-less strings like 'client1@fish'). Compounding factor by design: apps/web/app/forgot-password/page.tsx discards resetPasswordForEmail's result and unconditionally shows success (anti-enumeration D-07), so the tester had no signal that nothing matched. There is NO code, config, or infrastructure defect in the recovery path."
fix: "(diagnose-only session — no fix applied)"
verification: "(n/a — root cause verified by live end-to-end reproduction: the exact UAT expectation passes when the seeded address is submitted verbatim)"
files_changed: []
