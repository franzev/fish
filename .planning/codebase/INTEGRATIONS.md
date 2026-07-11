---
title: External integrations
mapped_at: 2026-07-11
last_mapped_commit: 8db370815b16e6563aae8c1d7e1992697f5fd9d0
focus: tech
---

# External Integrations

## Supabase Platform

- Supabase is the backend of record for authentication, PostgreSQL data, PostgREST, Realtime, storage, and Edge Functions. The intended boundary is documented in `README.md` and `AGENTS.md`.
- Public web clients require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; validation and client-safe build-time access are centralized in `apps/web/lib/services/env.ts`.
- Browser and SSR client construction is separated in `apps/web/lib/services/supabase/browser.ts`, `apps/web/lib/services/supabase/server.ts`, and `apps/web/lib/services/supabase/proxy.ts`.
- Next.js request proxying refreshes Supabase session claims for navigations via `apps/web/proxy.ts`; authenticated server reads verify the user rather than trusting cookie session data.
- Database tables, grants, RLS policies, triggers, RPC functions, and Realtime publication configuration are versioned in `supabase/migrations/0001_profiles.sql` through `supabase/migrations/0016_channels.sql`.
- Generated database typings live in `packages/supabase/src/database.generated.ts`; application-facing types are re-exported through `packages/supabase/src/database.types.ts` and `packages/supabase/src/index.ts`.

## Authentication and Email

- Supabase Auth supports password signup/sign-in, required email confirmation, password recovery, sign-out, and session refresh. Application methods are implemented in `apps/web/lib/services/supabase/core.ts`.
- OAuth/email callback routes are `apps/web/app/auth/callback/route.ts` and `apps/web/app/auth/confirm/route.ts`; reset and expired-link experiences live under `apps/web/app/reset-password` and `apps/web/app/expired-link`.
- Local Auth configuration in `supabase/config.toml` sets an eight-character password minimum, requires confirmations, and sets email OTP expiry to 86,400 seconds.
- Branded confirmation and recovery templates are stored at `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`.
- Hosted Supabase does not automatically consume those local template paths; the manual production upload/configuration process is recorded in `docs/deploy-checklist.md`.
- Production may initially use Supabase's built-in mail sender. Custom SMTP is explicitly deferred; `docs/deploy-checklist.md` mentions Resend only as a future example, not a current dependency.

## Google Services

- Google is configured as an external Supabase Auth provider in `supabase/config.toml`; local credentials come from `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.
- Login and signup trigger `signInWithOAuth({ provider: "google" })` through `apps/web/lib/services/supabase/core.ts`, with UI entry points in `apps/web/app/login/login-form.tsx` and `apps/web/app/signup/signup-form.tsx`.
- The local Google OAuth callback is `http://127.0.0.1:54321/auth/v1/callback`; hosted callback and redirect allow-list setup is an explicit deploy step in `docs/deploy-checklist.md`.
- Google Fonts are integrated at build time through `next/font/google` in `apps/web/app/layout.tsx`, which loads Lexend and Fraunces and self-hosts the optimized output through Next.js.

## Edge Functions and PostgREST

- Server Actions in `apps/web/app/(authenticated)/chat/actions.ts` call `/functions/v1/send-message` and `/functions/v1/chat-command` with the caller's Supabase bearer token.
- `supabase/functions/send-message/index.ts` verifies the caller through `/auth/v1/user`, then invokes the `send_chat_message` PostgreSQL RPC through `/rest/v1/rpc/send_chat_message`.
- `supabase/functions/chat-command/index.ts` handles message edits/deletes, reactions, read state, and refresh operations through authenticated PostgREST RPC/table calls.
- Both functions are configured with JWT verification in `supabase/config.toml` and use runtime-provided `SUPABASE_URL` plus `SUPABASE_ANON_KEY`/publishable-key variants.
- Authorization is enforced again in PostgreSQL through RLS and RPC logic, so Edge Functions are an orchestration/validation boundary rather than a service-role bypass.

## Realtime

- Chat clients subscribe to Supabase Realtime Postgres changes for `messages` and `message_reads` in `apps/web/app/(authenticated)/chat/realtime.ts`.
- Typing and voice-recording indicators use Realtime broadcast channels; presence sessions combine client heartbeat behavior with the `presence_sessions` table.
- The client explicitly restores the access token into the Realtime connection before subscribing, avoiding anonymous channel joins during session hydration.
- `scripts/verify-chat-realtime.ts` provides an integration verifier for authenticated channels, broadcasts, presence, commands, and message delivery behavior.

## Local and Deployment Operations

- Local Supabase is operated through the Supabase CLI commands in root `package.json`: `supabase start` and `supabase db reset`.
- `scripts/seed.ts` uses `SUPABASE_SERVICE_ROLE_KEY` for local-only administrative seeding; the key bypasses RLS and must never be browser-exposed or used for production seeding.
- `scripts/verify-rls.ts` creates authenticated test sessions plus an admin client to exercise row-level security boundaries.
- `PLAYWRIGHT_BASE_URL` optionally points browser tests at a non-default deployment; otherwise `apps/web/playwright.config.ts` uses `http://localhost:3001`.
- Hosted-project linking, migrations, redirect URLs, environment variables, Auth parity checks, and email setup are manual checklist items in `docs/deploy-checklist.md`.

## Integration Inventory and Gaps

- No separate REST/GraphQL application server, payment processor, analytics SDK, error-tracking service, object-storage vendor, AI provider, calendar, CRM, or messaging SaaS integration appears in the repository.
- Supabase storage has a typed wrapper in `apps/web/lib/services/supabase/core.ts`, but no bucket creation migration or active upload/download feature is currently present.
- Deployment hosting is not pinned to a provider in repository configuration; production web origin and hosted Supabase project details remain environment-specific.
- Custom SMTP is not configured, and production Google OAuth credentials are intentionally external secrets rather than committed configuration.
