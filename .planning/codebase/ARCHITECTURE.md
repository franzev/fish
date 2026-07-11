---
mapped_at: 2026-07-11
last_mapped_commit: 8db370815b16e6563aae8c1d7e1992697f5fd9d0
focus: architecture
---

# Architecture

## System Overview

FISH is a pnpm monorepo whose production surface is a Next.js App Router web application backed directly by Supabase. The architecture deliberately has no standalone Node/Express API: server-rendered reads use narrow Supabase repositories, while sensitive chat and profile writes cross command boundaries implemented as Next.js Server Actions, Supabase Edge Functions, and Postgres RPCs.

The active dependency direction is `apps/web` -> `packages/supabase` -> `packages/core`, with `apps/web` also importing `packages/core` directly. Shared product state and role contracts remain backend-neutral in `packages/core/src/`; generated database shapes and auth redirects live in `packages/supabase/src/`.

## Runtime Boundaries

- The browser renders React client components and owns interaction state under `apps/web/components/` and `apps/web/app/(authenticated)/chat/`.
- Next.js Server Components load verified user/profile data through `apps/web/lib/auth/server.ts` and service registries created by `apps/web/lib/services/supabase/server.ts`.
- Next.js Server Actions validate profile/chat inputs with Zod before invoking Supabase or Edge Functions; examples are `apps/web/app/(authenticated)/profile/edit/actions.ts` and `apps/web/app/(authenticated)/chat/actions.ts`.
- `apps/web/proxy.ts` only refreshes Supabase session cookies. Authorization is not delegated to the proxy.
- Supabase Auth owns identity, Postgres owns product data, RLS is the authoritative read boundary, and RPCs/Edge Functions enforce command invariants.
- Realtime table changes and broadcast/presence channels are consumed by `apps/web/app/(authenticated)/chat/realtime.ts` and orchestrated by hooks in `apps/web/app/(authenticated)/chat/hooks/`.

## Web Layering

### Routing and server composition

`apps/web/app/layout.tsx` is the global shell and font/style entry point. `apps/web/app/page.tsx` computes the role-aware landing redirect. Public auth routes live directly under `apps/web/app/`, while protected routes live in `apps/web/app/(authenticated)/`.

`apps/web/app/(authenticated)/layout.tsx` is the default-deny session boundary. It calls `getAuthenticatedShellProfile()`, redirects signed-out users, resets chat state on identity changes through `apps/web/components/auth/chat-identity-guard.tsx`, and supplies role/preferences to `apps/web/components/shell/app-shell.tsx`. Leaf pages retain responsibility for role-specific guards because the shared layout cannot reliably infer the active leaf.

Server-facing page DTO assembly is concentrated in `apps/web/lib/auth/server.ts`. That module resolves the current verified user, narrows database strings into domain types, composes repository calls, and returns view-specific data such as `AuthenticatedShellProfile`, `CoachHomeData`, `ProfileData`, and `ChatPageData`.

### Service and repository boundary

`apps/web/lib/services/supabase/core.ts` wraps one typed Supabase client in implementations for auth, profiles, client profiles, coach-client assignments, chat, storage, and realtime. Every method returns the shared `ServiceResult<T>` contract from `apps/web/lib/services/errors.ts`, normalizing provider errors before they reach UI code.

Runtime-specific factories are separated:

- `apps/web/lib/services/supabase/browser.ts` creates browser clients and service registries.
- `apps/web/lib/services/supabase/server.ts` creates request-scoped clients from Next.js cookies.
- `apps/web/lib/services/supabase/proxy.ts` implements the cookie refresh sequence for the Next.js proxy.
- `apps/web/lib/services/container.ts` provides a small immutable dependency-injection container.
- `apps/web/lib/supabase/` is a compatibility adapter layer; new UI code should prefer `apps/web/lib/services/`.

The boundary is mechanically protected by `apps/web/tests/service-boundary.test.ts`, which prevents `.tsx` files from constructing or importing low-level Supabase dependencies directly.

### Presentation layer

Reusable design primitives live in `apps/web/components/ui/`; product-specific presentational components live beside their domains in `apps/web/components/chat/`, `apps/web/components/profile/`, `apps/web/components/coach/`, and `apps/web/components/home/`. The authenticated chrome is isolated in `apps/web/components/shell/`.

Tailwind v4 tokens and global accessibility behavior are defined in `apps/web/app/globals.css`. Components compose classes with `apps/web/lib/utils.ts` and follow the calm, single-primary-action rules described in `docs/ui-ux-agent-guidelines.md`.

## Chat Architecture

The current channel route is `apps/web/app/(authenticated)/channels/[id]/page.tsx`. It accepts a stable dynamic URL, but the milestone currently resolves all requests through the single seeded `general` channel constants in `apps/web/lib/channels.ts` and the demo-community conversation path in `apps/web/lib/services/supabase/core.ts`.

Initial chat data is server rendered: the route calls `getChatPageData()`, which uses the chat repository to load a bounded newest window, sender profiles, read states, reactions, and conversation metadata. The client receives that DTO in `apps/web/app/(authenticated)/chat/chat-client.tsx`.

Client chat state uses a two-layer design:

1. `packages/core/src/chat-state/` owns pure types, reducer transitions, selectors, deterministic merging, optimistic reconciliation, and pagination state.
2. `apps/web/app/(authenticated)/chat/store/chat-store.ts` adapts that reducer into a Zustand singleton and adds hydration-key/cache-owner lifecycle behavior. UI access goes through selectors in `apps/web/app/(authenticated)/chat/store/chat-selectors.ts`.

Feature hooks split interaction concerns: composer/send logic, message-window loading, read receipts, realtime subscriptions, presence, pagination observation, and scroll anchoring each live in their own file under `apps/web/app/(authenticated)/chat/hooks/`. `ChatClient` composes them and renders the chat component kit.

### Chat write path

Sending follows this path:

1. `use-chat-composer.ts` creates an optimistic local message with a client request ID.
2. `sendMessageAction()` in `apps/web/app/(authenticated)/chat/actions.ts` validates the untrusted payload and obtains the current access token.
3. The action calls `supabase/functions/send-message/index.ts` with the bearer token.
4. The Edge Function verifies the caller and invokes the `send_chat_message` Postgres RPC.
5. SQL in `supabase/migrations/0010_chat.sql`, extended by `0013_realtime_chat_features.sql` and `0014_demo_community_conversation.sql`, enforces membership, idempotency, reply integrity, and persistence.
6. The returned persisted row reconciles with the optimistic message; Supabase Realtime later merges the same row idempotently.

Editing, deleting, reactions, and read-state updates follow the analogous `chat-command` path through `supabase/functions/chat-command/index.ts`. Bounded refresh/backfill reads also cross server actions so reconnect recovery and pagination remain validated and controlled.

### Realtime and recovery

`apps/web/app/(authenticated)/chat/realtime.ts` creates subscriptions for messages, read states, reactions, typing broadcast, voice-recording broadcast, and presence. `use-chat-realtime.ts` maps remote events into reducer events, tracks connection status, and coalesces reconnect recovery so simultaneous channel resubscriptions trigger one bounded gap backfill.

Realtime events are hints, not the sole source of truth. Initial SSR data, explicit targeted refreshes, keyset pagination, and reconnect backfills all re-read RLS-protected Postgres state. This lets the client recover from missed or duplicated events while keeping merge behavior deterministic.

## Backend and Data Authority

Schema evolution is ordered in `supabase/migrations/`. Core tables are `profiles`, `client_profiles`, `coach_clients`, `channels`, `conversations`, `messages`, `message_reads`, `message_reactions`, and `presence_sessions`. Generated TypeScript database types are committed in `packages/supabase/src/database.generated.ts` and re-exported through `packages/supabase/src/database.types.ts`.

Authorization is database-first:

- RLS policies control authenticated reads and permitted direct state operations.
- Helper functions in the private schema, beginning in `supabase/migrations/0004_rls_helpers.sql`, centralize relationship checks without recursive policy reads.
- Triggers prevent role/level self-escalation and validate relational integrity.
- Public RPCs in chat migrations perform command-style writes and expose execution only to authenticated callers.
- Edge Functions preserve the caller's bearer token when calling PostgREST, so RPC checks and RLS evaluate as that user rather than a service-role bypass.

`supabase/config.toml` enables JWT verification for both `send-message` and `chat-command`, configures email verification/templates, and declares Google auth redirect settings.

## Shared Package Contracts

`packages/core/src/roles.ts` defines roles and narrowing helpers. `packages/core/src/chat.ts` defines transport-level chat contracts and limits. `packages/core/src/chat-state/` defines the richer client state machine, kept pure so reducer behavior can be exhaustively unit tested without React, Next.js, or Supabase.

`packages/supabase/src/auth.ts` contains auth redirect contracts. `packages/supabase/src/database.types.ts` layers useful row aliases over the generated schema. This package may depend on `@fish/core`; the reverse dependency is intentionally forbidden.

## Primary Entry Points

- Web development and build: root scripts in `package.json`, targeting `apps/web/package.json`.
- Global application root: `apps/web/app/layout.tsx`.
- Role-aware root redirect: `apps/web/app/page.tsx`.
- Protected application shell: `apps/web/app/(authenticated)/layout.tsx`.
- Community chat page: `apps/web/app/(authenticated)/channels/[id]/page.tsx`.
- Session refresh: `apps/web/proxy.ts`.
- Service registry: `apps/web/lib/services/supabase/core.ts`.
- Send command: `supabase/functions/send-message/index.ts`.
- Other chat commands: `supabase/functions/chat-command/index.ts`.
- Database evolution: `supabase/migrations/0001_profiles.sql` through `supabase/migrations/0016_channels.sql`.

## Architectural Guardrails

- Simple authorized reads may use Supabase directly through repository abstractions; sensitive writes belong in commands/RPCs.
- UI components should not import low-level Supabase modules.
- `packages/core` stays free of web and backend implementation imports.
- The authenticated route group is default-deny, while role-specific pages enforce their own wrong-role redirects.
- The client store is a cache and interaction state machine, never an authorization source.
- Chat windows and reaction fetches are bounded/paginated; realtime gaps are repaired from persisted state.
- New client-facing learning flows must be manually coach-validated before implementation, per `AGENTS.md`.
