---
status: resolved
trigger: "UAT test 3 (Verify by Email): internal server error upon clicking the verification email link"
created: 2026-07-03T00:00:00Z
updated: 2026-07-03T13:55:00Z
---

## Current Focus

hypothesis: CONFIRMED — site_url/port mismatch. supabase/config.toml pins site_url to http://127.0.0.1:3000, but port 3000 is occupied by an unrelated project (Timberyard commerce, Next 15.2.2); FISH dev server runs on port 3001. The email link therefore hits the foreign app, whose /auth/confirm route 500s.
test: complete — reproduced headlessly on both ports
expecting: n/a
next_action: none — diagnosis returned to orchestrator (goal: find_root_cause_only)

## Symptoms

expected: User signs up at /signup, receives verification email in Mailpit, clicks its action link, ends up signed in at /home
actual: "internal server error upon clicking the link" (verbatim user report) — browser shows 500 when the emailed confirmation link is clicked
errors: Internal server error (500) in browser. No stack trace reported by user.
reproduction: UAT test 3 — sign up fresh account at /signup, open Mailpit at http://127.0.0.1:54324, click the confirmation email's action link
started: Discovered during UAT immediately after full cold restart (`supabase stop && supabase start`, `pnpm db:reset`, `pnpm seed`, dev server restarted). Same flow passed during plan 02-04's pre-merge human-verify walk (before the cold restart). Tests 1 and 2 passed after restart.

## Eliminated

- hypothesis: (b) apps/web/app/auth/confirm/route.ts throws (real code bug — env mismatch, cookie API misuse, verifyOtp type mismatch)
  evidence: Curling the exact email link path against FISH's real port (3001) returned 307 -> /home with sb-127-auth-token cookie set and email_confirmed_at populated in the JWT. The handler works end-to-end, including the pkce_-prefixed token_hash with type=email.
  timestamp: 2026-07-03T05:13:53Z
- hypothesis: (c) stale env keys in apps/web/.env.local after the cold `supabase stop && supabase start` (rotated publishable/service keys)
  evidence: verifyOtp succeeded via the server client factory using current .env.local values — a stale key would have produced an auth error (and the calm /expired-link redirect), not success.
  timestamp: 2026-07-03T05:13:53Z

## Evidence

- timestamp: 2026-07-03T05:05:00Z
  checked: .planning/debug/knowledge-base.md
  found: Does not exist — no prior resolved sessions to match
  implication: No known-pattern shortcut; investigate from scratch
- timestamp: 2026-07-03T05:10:00Z
  checked: lsof -nP -iTCP:3000 -iTCP:3001 -sTCP:LISTEN + ps
  found: Port 3000 = node PID 94014, next-server v15.2.2, started 8:25AM. Port 3001 = node PID 5037, next-server v16.2.9 (FISH is on Next 16.2.9), started 12:54PM, launched from /Users/franz/Work/Personal/fish/apps/web.
  implication: FISH is NOT on port 3000; something else is. Known port wrinkle from plan 02-05 recurred.
- timestamp: 2026-07-03T05:10:30Z
  checked: lsof -p 94014 / -p 5037 cwd
  found: PID 94014 (port 3000) cwd = /Users/franz/Work/Timberyard/timberyard-commerce/nextjs-app (unrelated project). PID 5037 (port 3001) cwd = /Users/franz/Work/Personal/fish/apps/web.
  implication: Confirmed the foreign app owns port 3000; FISH answers only on 3001.
- timestamp: 2026-07-03T05:11:00Z
  checked: supabase/config.toml [auth]
  found: site_url = "http://127.0.0.1:3000"; additional_redirect_urls = ["http://127.0.0.1:3000"]
  implication: {{ .SiteURL }} in email templates resolves to port 3000 — the port FISH is not on.
- timestamp: 2026-07-03T05:12:00Z
  checked: Mailpit API (message 0pgeWQvjpBJ4NdrjvLovwp, "Confirm your email address", 2026-07-03T05:00:53Z)
  found: Action link = http://127.0.0.1:3000/auth/confirm?token_hash=pkce_3a264d...&type=email
  implication: The emailed link targets port 3000 (Timberyard), exactly matching the site_url value.
- timestamp: 2026-07-03T05:13:42Z
  checked: curl -si of the exact email link (port 3000)
  found: HTTP/1.1 500 Internal Server Error, body "Internal Server Error"; response carries a Content-Security-Policy frame-ancestors list referencing sanity.io — fingerprint of the Timberyard/Sanity app, not FISH.
  implication: Reproduces the user's exact symptom; the 500 is emitted by the FOREIGN app, before FISH code is ever reached.
- timestamp: 2026-07-03T05:13:53Z
  checked: curl -si of the same path+params on FISH's port 3001
  found: HTTP/1.1 307 -> http://localhost:3001/home, sb-127-auth-token session cookie set, JWT shows email_confirmed_at=2026-07-03T05:13:53Z for evangelistafranz@gmail.com.
  implication: FISH's /auth/confirm handler is fully correct; only the link's host:port is wrong. NOTE: this reproduction CONSUMED the token and verified the UAT account — re-running UAT test 3 needs a fresh signup (or the old link will now land on /expired-link by design).

## Resolution

root_cause: Port/site_url mismatch, not a code bug. supabase/config.toml sets site_url (and additional_redirect_urls) to http://127.0.0.1:3000, so {{ .SiteURL }} in supabase/templates/confirmation.html renders verification links pointing at port 3000. But port 3000 is held by an unrelated project (Timberyard commerce, next-server v15.2.2, cwd /Users/franz/Work/Timberyard/timberyard-commerce/nextjs-app), so the FISH dev server auto-fell-back/ran on port 3001 (next-server v16.2.9, cwd /Users/franz/Work/Personal/fish/apps/web). Clicking the emailed link therefore requests /auth/confirm on the Timberyard app, which returns a raw 500 "Internal Server Error". FISH's own handler, proxied session middleware, and env keys are all healthy — the identical request against port 3001 verifies the email and redirects to /home with a session cookie. This is the recurrence of the known port wrinkle from plan 02-05.
fix: (not applied — goal is find_root_cause_only) Align the port FISH serves on with site_url: either free port 3000 (stop the Timberyard dev server) and run FISH on 3000, or change site_url + additional_redirect_urls in supabase/config.toml to the port FISH actually uses (requires a supabase restart to take effect) — and make the choice deterministic (e.g., pin the dev port in the dev script) so an occupied port can't silently divert auth emails again.
verification: n/a (diagnosis only). Headless reproduction: link on :3000 -> 500 (foreign app); same path on :3001 -> 307 /home + session cookie.
files_changed: []

## Resolution Update (gap-closure plan 02-06)

The port-only fix (pinning `apps/web/package.json` dev script to `next dev -p 3001` and `supabase/config.toml` site_url to `http://127.0.0.1:3001`) was necessary but NOT sufficient. First human re-verification still failed: session cookies are host-scoped, and Next.js's post-verify redirect lands the browser on `localhost:3001` (its default dev origin) regardless of the `127.0.0.1` host in the incoming request. The `127.0.0.1`-scoped cookie set by `/auth/confirm` was therefore invisible on `localhost`, where all normal browsing in this environment happens — the user landed unauthenticated on `/login` even though `/auth/confirm` itself correctly 307'd to `/home`.

The fix required BOTH corrections together:
1. Pin the dev port deterministically (`next dev -p 3001`) — removes Next's silent port-fallback nondeterminism.
2. Align `site_url` + `additional_redirect_urls` to the exact HOST the browser session lives on, `http://localhost:3001`, not `http://127.0.0.1:3001` — cookie host-scoping means port alignment alone is insufficient.

Verified via a full click-through (not just a curl of `/auth/confirm`): fresh signup on `http://localhost:3001/signup`, Mailpit email link inspected and clicked, landed signed in at `/home` with a working session. See `.planning/phases/02-secure-account-you-can-return-to/02-06-SUMMARY.md` for the full evidence chain and commits (`9cca5b9`, `31bcf8b`).
