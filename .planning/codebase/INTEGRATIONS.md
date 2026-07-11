---
last_mapped: 2026-07-11
last_mapped_commit: e25c937627b8f19251c791ed6878e6522f802959
focus: integrations
---

# External Integrations

## Integration Summary

| System | Purpose | Entry points | Configuration |
| --- | --- | --- | --- |
| Supabase Auth | Email/password, OAuth, verification, password recovery, sessions | `apps/web/lib/services/supabase/auth.ts` | `supabase/config.toml`, public Supabase environment variables |
| Supabase PostgreSQL/PostgREST | Profiles, assignments, conversations, messages, reactions, presence, channels | `apps/web/lib/services/supabase/profile-repositories.ts`, `apps/web/lib/services/supabase/chat-repository.ts` | `supabase/migrations/` |
| Supabase Realtime | Message/read/reaction database events plus typing and recording broadcasts | `apps/web/lib/services/supabase/chat-realtime.ts` | Realtime publication changes in migrations |
| Supabase Edge Functions | Authenticated chat command writes and refresh operations | `supabase/functions/send-message/index.ts`, `supabase/functions/chat-command/index.ts` | Function JWT settings in `supabase/config.toml` |
| Google OAuth | Federated sign-in through Supabase Auth | `apps/web/lib/services/supabase/auth.ts` | Google provider block in `supabase/config.toml` |
| Supabase Auth email delivery | Confirmation and password-recovery links | `supabase/templates/confirmation.html`, `supabase/templates/recovery.html` | Auth email settings in `supabase/config.toml` |

## Supabase Platform Boundary

- Supabase is the only configured backend provider and combines authentication, PostgreSQL persistence, Realtime, and Edge Functions.
- Provider-neutral application ports are declared in `apps/web/lib/services/contracts.ts`; feature code consumes those contracts rather than SDK types.
- Concrete provider adapters are kept in `apps/web/lib/services/supabase/` and composed by `apps/web/lib/services/supabase/core.ts` and runtime factories.
- Browser clients use `createBrowserClient` from `@supabase/ssr` in `apps/web/lib/services/supabase/browser.ts`.
- Server Components, Server Actions, and route handlers use request-cookie-aware clients from `apps/web/lib/services/supabase/server.ts`.
- The Next.js proxy refreshes auth claims and mirrors cookie writes onto the response in `apps/web/lib/services/supabase/proxy.ts`.
- Generated database types are isolated in the `@fish/supabase` package; they are consumed by adapters, not feature modules.

## Authentication

- `SupabaseAuthServiceImpl` in `apps/web/lib/services/supabase/auth.ts` adapts provider operations to the application-owned `AuthService` interface.
- Supported flows are current-user lookup, authorization-code exchange, OTP verification, auth-state subscription, claim refresh, email/password sign-in, sign-up, Google OAuth, resend confirmation, password reset, password update, and sign-out.
- The app maps Supabase users and sessions into `AuthUser` and `AuthSession` instead of returning SDK objects.
- Cookie transport is handled by `@supabase/ssr`; feature code does not manipulate provider cookies directly.
- Email confirmation is required and the OTP lifetime is set to 86,400 seconds in `supabase/config.toml`.
- Application redirect URLs include local browser callback routes and `fish://auth/callback` for a future/native deep-link consumer.

## Google OAuth

- Google is the only enabled external identity provider in `supabase/config.toml`.
- Supabase receives the Google client ID from `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and secret from `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.
- The local provider callback is `http://127.0.0.1:54321/auth/v1/callback`.
- The web adapter initiates OAuth with `signInWithOAuth({ provider: "google" })` in `apps/web/lib/services/supabase/auth.ts`.
- No direct Google API SDK is installed; Google is accessed only through Supabase Auth.

## Database and Authorization

- SQL migrations in `supabase/migrations/` are the source of truth for profiles, client profiles, coach-client assignments, conversations, messages, read state, reactions, presence sessions, and channels.
- Row Level Security policies authorize direct reads and safe profile updates.
- Sensitive chat writes execute through PostgreSQL RPCs including `send_chat_message`, `edit_chat_message`, `delete_chat_message`, `toggle_message_reaction`, and `mark_chat_read_state`.
- Provider adapters map snake_case database rows into camelCase application models in `apps/web/lib/services/supabase/chat-mapping.ts` and repository implementations.
- `scripts/verify-rls.ts` signs in as seeded roles and tests authorization boundaries and RPC behavior against a running Supabase instance.
- `scripts/seed.ts` uses the service-role key for local fixture provisioning; this credential is not part of the browser configuration.

## Realtime

- PostgreSQL change subscriptions cover `messages`, `message_reads`, `message_reactions`, and `presence_sessions`.
- Migration files `supabase/migrations/0011_messages_realtime.sql` and `supabase/migrations/0013_realtime_chat_features.sql` add the relevant tables to the `supabase_realtime` publication.
- Ephemeral typing and voice-recording indicators use Supabase Realtime broadcast channels in `apps/web/lib/services/supabase/chat-realtime.ts`.
- Presence heartbeat/session persistence is backed by the `presence_sessions` table rather than only ephemeral channel presence.
- The application-facing realtime contracts return unsubscribe/controller handles and provider-neutral event payloads.
- `scripts/verify-chat-realtime.ts` checks database events, broadcast behavior, authentication, and multi-client scenarios against the local backend.

## Edge Functions and HTTP

- Both deployed functions require verified JWTs according to `[functions.send-message]` and `[functions.chat-command]` in `supabase/config.toml`.
- The web adapter posts bearer-authenticated JSON to `/functions/v1/send-message` and `/functions/v1/chat-command` from `apps/web/lib/services/supabase/edge-function-transport.ts`.
- `send-message` validates the caller through `/auth/v1/user`, then calls the `send_chat_message` PostgREST RPC.
- `chat-command` validates the caller and dispatches edit, delete, reaction, read-state, and refresh operations through PostgREST/RPC requests.
- Edge Functions read `SUPABASE_URL` and one of the available anon/publishable-key variables from the Deno environment.
- For local development only, the command adapter can recognize an unavailable Edge Function and fall back to local server-side Supabase commands; this behavior is contained within the infrastructure adapter.
- Edge Functions return calm application-facing error text while logging provider failures to the function console.

## Auth Email Templates

- Supabase Auth owns confirmation and recovery email delivery.
- Custom HTML bodies are stored in `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`.
- The templates are registered through `content_path` entries in `supabase/config.toml`.
- No separate transactional-email SDK or provider-specific API appears in application dependencies.

## Environment and Secrets

- `NEXT_PUBLIC_SUPABASE_URL` identifies the Supabase project endpoint and is intentionally exposed to browser bundles.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the browser-safe project key.
- `SUPABASE_SERVICE_ROLE_KEY` is restricted to local seed and verification scripts and must never use a `NEXT_PUBLIC_` prefix.
- Google OAuth credentials are read by the Supabase local runtime from `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.
- Public environment validation is centralized in `apps/web/lib/services/env.ts` and occurs lazily when a provider client is constructed.
- Local commands load secrets from `apps/web/.env.local`; only blank placeholders are tracked in `apps/web/.env.example`.

## Webhooks and Inbound Integrations

- No application webhook endpoint is currently implemented.
- OAuth and email verification callbacks are the only third-party-originated callback flows.
- No Slack, calendar, CRM, payment, analytics, monitoring, object-storage, or AI-provider integration is present in the current dependency graph.

## Operational Failure Behavior

- Adapter errors are normalized into application-owned `ServiceResult`/`ServiceError` values by `apps/web/lib/services/supabase/shared.ts` and `apps/web/lib/services/errors.ts`.
- A local Edge Function timeout is limited to 1.5 seconds in `apps/web/lib/services/supabase/edge-function-transport.ts` before local fallback policy is evaluated.
- Realtime subscriptions expose teardown methods so features do not own Supabase channel cleanup details.
- Seed, RLS, and Realtime verification scripts are explicit operational integration tests rather than production application modules.
