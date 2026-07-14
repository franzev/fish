# Deploy checklist — hosted Supabase setup (D-14)

Phase 2 ran entirely against local Supabase (`supabase start`, Docker, Mailpit). Everything
below was deliberately deferred and must be executed once, in order, when the app first
deploys to a real host. Work through it top to bottom — each step assumes the previous one
is done.

## 1. Create and link the hosted Supabase project

- [ ] Create the production project in the Supabase dashboard (choose the region closest to
      the coaching audience; note the project ref).
- [ ] From the repo root, link the local workspace to it: `supabase link --project-ref <ref>`.
      Linking is what lets `supabase db push` and config comparison target the hosted project
      instead of the local stack.

## 2. Set the production Site URL and redirect allow-list

- [ ] In the hosted project's Auth settings, set the production `Site URL` to the deployed
      web origin (for example `https://app.example.com`). Every `{{ .SiteURL }}` placeholder
      in the email templates resolves from this value — if it still points at localhost, every
      verification and reset link in production email will be broken.
- [ ] Add the deployed origin's `/auth/confirm` and `/auth/callback` paths to the redirect
      allow-list so email token links and Google OAuth callbacks are permitted destinations.
      If preview deployments get their own origins, each origin that should accept auth links
      needs an allow-list entry.

## 3. Push migrations to the hosted database

- [ ] Run `supabase db push` against the linked project. This applies every
      committed migration through `0036_lesson_booking.sql`, including profiles,
      client profiles, assignments, chat, realtime features, reactions, the
      seeded `general` channel, call control plane, presence, notifications,
      and conflict-safe lesson slots.
- [ ] Spot-check that RLS is enabled on `profiles`, `client_profiles`,
      `coach_clients`, `channels`, `conversations`, `messages`,
      `message_reads`, `message_reactions`, `presence_sessions`, and
      `lesson_slots`.
- [ ] Deploy the chat command functions:
      `supabase functions deploy send-message` and
      `supabase functions deploy chat-command`.
- [ ] Confirm both functions require JWT verification and preserve the caller's
      bearer token when invoking PostgREST/RPCs.
- [ ] Deploy `presence-command` with JWT verification, then change a staging
      user's status through the account menu and confirm a trusted viewer sees
      the update.
- [ ] Create a LiveKit Cloud project and set `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
      and `LIVEKIT_API_SECRET` as Supabase Edge Function secrets.
- [ ] Deploy `call-command` with JWT verification and `livekit-webhook` without
      Supabase JWT verification; the webhook validates LiveKit's signature.
- [ ] Deploy `booking-command` with JWT verification. Create the initial
      production coach availability through a trusted service-role or SQL
      administration path; never run the local development seed in production.
- [ ] Add the deployed webhook URL in LiveKit and send a test event before
      enabling calls for users.
- [ ] Confirm the `expire-stale-calls` pg_cron job exists and runs once per
      minute in the hosted database.
- [ ] Deploy `avatar-command` with JWT verification and set its
      `AVATAR_UPLOADS_ENABLED` secret to `true` only after staging verification.
- [ ] Confirm the `avatars` Storage bucket is private, accepts only WebP, and
      has a 2 MB object limit.
- [ ] Create a daily Supabase Cron job that invokes `avatar-command` with
      `{"action":"cleanup-expired"}` using a service-role credential stored in
      Vault. Confirm the job removes expired staging uploads without deleting
      avatar paths still referenced by `profiles`.

## 4. Upload and confirm the production email templates

- [ ] Copy the two templates from `supabase/templates/` (confirmation and recovery) into the
      hosted project's Auth email template settings. Hosted projects do not read the local
      `config.toml` template paths — the HTML must be pasted or uploaded in the dashboard.
- [ ] Confirm the confirmation template's action link points at
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` —
      never the default `{{ .ConfirmationURL }}`, whose tokens land in the URL fragment and
      are invisible to the server-side handler. The server-side handler defaults successful
      email confirmations to `/home` when no `next` query parameter is present.
- [ ] Confirm the recovery template's action link points at
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
- [ ] Keep the templates' plain single-column layout and calm sentence-case FISH voice; the
      product is pure monochrome (black, white, greys), so templates carry no brand color.

## 5. Set hosted environment variables in the deploy platform

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — the hosted project's API URL.
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the hosted project's publishable (anon) key.
- [ ] `NEXT_PUBLIC_KLIPY_API_KEY` — the production KLIPY application key used
      by the browser GIF picker. GIF search stays unavailable unless this is set.
- [ ] `NEXT_PUBLIC_KLIPY_CLIENT_KEY` — the stable KLIPY client identifier for
      search and share analytics (use `fish_chat` unless the provider assigns another value).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — required only in trusted administrative
      environments that run seed or verification scripts. The production web
      runtime does not require it. Never give it a `NEXT_PUBLIC_` prefix,
      commit it, or expose it to the browser; it bypasses RLS entirely.
- [ ] `AVATAR_UPLOADS_ENABLED` — server-side web rollout switch. Avatar
      mutations stay hidden unless this is explicitly set to `true`; existing
      avatar reads remain available either way.

## 6. Confirm the hosted auth config matches local

- [ ] Verify the hosted project's auth settings carry `minimum_password_length = 8` (D-16),
      matching the local `[auth]` section in `supabase/config.toml`. Hosted config is set in
      the dashboard (or via `supabase config push` where supported) — the same
      CLI-version-sensitivity note from local applies: confirm against what the dashboard
      actually shows, not what a tutorial claims the key is called.
- [ ] Confirm email confirmations are required on signup (the hosted equivalent of the local
      `enable_confirmations = true` under `[auth.email]`).
- [ ] Set the hosted email OTP expiry to 86400 seconds (24 hours), matching the local
      `otp_expiry = 86400` under `[auth.email]`. Both email templates state "expires in
      24 hours" as fact — if the hosted project keeps the 1-hour default, that copy is wrong.
      Note: the hosted security advisor flags expiries above 1 hour; if that trade-off is
      rejected later, shorten the expiry AND update the copy in both templates together.
- [ ] Enable Google as a hosted Auth provider using the Google OAuth client ID and secret.
      The Google OAuth app's authorized redirect URI should be the hosted Supabase auth
      callback shown by the dashboard (local development uses
      `http://127.0.0.1:54321/auth/v1/callback`).

## 7. Email sending: built-in sender now, custom SMTP later

- [ ] Be aware the built-in Supabase email sender has tight rate limits (a small number of
      emails per hour) and is meant for development-scale traffic. It is acceptable for the
      first deploy while user counts are tiny.
- [ ] When real users onboard and deliverability starts to matter, configure a custom SMTP
      provider (for example Resend) in the hosted Auth settings. This is deliberately
      deferred — see the deferred-ideas note in the phase context.

## 8. Do not run the dev seed against production

- [ ] `pnpm seed` (scripts/seed.ts) creates accounts with fixed, documented dev credentials.
      It is local-only. Never point it at the hosted project: production coach accounts are
      created manually (dashboard or a one-off admin action with the hosted service-role
      key), and real client accounts arrive through signup.

## 9. Run hosted verification

- [ ] Against staging, run the RLS and realtime verification scripts with
      staging-only credentials and disposable test users.
- [ ] Verify signup, confirmation, sign-in, password recovery, profile editing,
      client and coach avatar upload/removal, channel loading, message send,
      reaction, read state, presence status changes, lesson booking and conflict
      handling, upcoming-lesson display, and realtime recovery.
- [ ] Do not point destructive reset or seed commands at production.

---
*Deliverable of Phase 2 (D-14). Execute at first deploy; keep updated if the auth flow's
routes or templates change before then.*
