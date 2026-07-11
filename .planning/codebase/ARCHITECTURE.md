---
title: Codebase Architecture
last_mapped: 2026-07-11
last_mapped_commit: e25c937627b8f19251c791ed6878e6522f802959
---

# Codebase Architecture

## System Shape

FISH is a pnpm monorepo centered on one Next.js App Router application in
`apps/web`. Supabase is the only backend platform: it supplies identity,
Postgres persistence, row-level authorization, Realtime, storage, RPCs, and
Edge Functions. There is no standalone Node or Express service.

The top-level dependency shape is:

```text
Next.js routes and React UI
  -> feature use cases and presentation models
     -> FISH-owned service ports and DTOs
        <- runtime composition roots
           <- Supabase adapters
              -> Supabase Auth / Postgres / Realtime / Edge Functions

apps/web -> packages/core
apps/web infrastructure -> packages/supabase -> packages/core
```

`packages/core` is the provider- and framework-neutral center. It contains role
contracts, auth contracts, chat transport types, and the pure chat-state
reducer. `packages/supabase` contains generated database types and row aliases;
application and feature modules do not consume those persistence shapes.

## Architectural Layers

### Framework and entry layer

Next.js entry points live in `apps/web/app` and `apps/web/proxy.ts`.

- `apps/web/app/layout.tsx` establishes the root document, fonts, and global
  presentation shell.
- `apps/web/app/(authenticated)/layout.tsx` is the shared authenticated route
  boundary and loads the signed-in shell profile.
- `apps/web/app/**/page.tsx` files are route composition points; they call
  feature page-data functions and render feature or route-local components.
- `apps/web/app/auth/callback/route.ts` and
  `apps/web/app/auth/confirm/route.ts` are authentication HTTP boundaries.
- `apps/web/proxy.ts` performs Supabase session-cookie refresh for matched
  requests; it deliberately does not make authorization decisions.
- Server Actions in `apps/web/features/chat/server/actions.ts` and
  `apps/web/features/profile/server/actions.ts` are framework RPC boundaries
  for browser-initiated commands.

### Feature/application layer

Feature modules are organized under `apps/web/features/{auth,chat,coach,profile}`.
Each feature owns its presentation contracts, server page-data/use cases,
components, validation, and hooks as applicable.

Server-only public surfaces are separated into `server/index.ts` files carrying
the `server-only` marker. Client-safe feature barrels are exposed from each
feature's root `index.ts`; client modules use `client-only` where a runtime
constraint is required. This prevents accidental server implementation imports
from Client Components.

Application behavior accepts narrow ports where practical. Examples include:

- `getCurrentProfile` in `apps/web/features/auth/server/page-data.ts`, which
  receives `AuthService` and `ProfileRepository` capabilities.
- `createChatActionHandlers` in
  `apps/web/features/chat/server/action-handlers.ts`, which receives a
  `ChatCommandService`.
- `createProfileActionHandlers` in
  `apps/web/features/profile/server/action-handlers.ts`, which receives the
  profile-related repositories it needs.

Framework wrappers obtain production services and immediately delegate to
these injected handlers. Tests provide focused fakes rather than provider SDK
clients.

### Ports and application DTOs

Provider-neutral service contracts live in
`apps/web/lib/services/contracts.ts`. The primary boundaries are:

- `AuthService` for identity and session operations.
- `ProfileRepository`, `ClientProfileRepository`, and
  `CoachClientRepository` for profile and assignment reads/writes.
- `ChatRepository` for initial authorized chat data.
- `ChatCommandService` for message, reaction, read-state, refresh, pagination,
  and recovery commands.
- `ChatRealtimeService` for messages, reactions, reads, typing, recording, and
  participant presence subscriptions.
- `AppServices` and `ServerServices` as composition aggregates.

The ports return domain-shaped camelCase DTOs such as `Profile`,
`ClientProfile`, and `ClientChatMessage`. Generic infrastructure failures are
normalized through `ServiceResult` and `ServiceError` in
`apps/web/lib/services/errors.ts`. Transport concepts such as native
`Response`, bearer tokens, Edge Function names, generated rows, and Supabase
SDK types are absent from the public contracts.

### Composition and adapters

Runtime selection happens in `apps/web/lib/services/runtime`:

- `runtime/server.ts` builds request-scoped server adapters and adds the lazy
  `ChatCommandService` implementation.
- `runtime/browser.ts` memoizes browser auth/database services and supplies the
  browser Realtime adapter.

Concrete provider implementations live in
`apps/web/lib/services/supabase`. The directory owns client creation, cookie
mechanics, row mapping, table/RPC names, Edge Function invocation and fallback,
Realtime channel lifecycle, and provider error translation. It implements the
inward-facing contracts rather than exposing raw clients to features.

`apps/web/lib/services/supabase/core.ts` assembles auth and database adapter
implementations around an injected Supabase client. Server and browser client
factories in `server.ts` and `browser.ts` supply the runtime-specific client.
`chat-command-service.ts` encapsulates command transport and recovery reads;
`chat-realtime.ts` converts provider events to application-owned events.

The intended dependency direction is application -> ports <- infrastructure.
Composition roots may import both sides to connect them, but adapters do not
import feature implementations and features do not import provider adapters.

## Core Chat State

`packages/core/src/chat-state` is a pure state machine. Its reducer, events,
selectors, deterministic merge behavior, optimistic reconciliation, and
pagination logic do not import React, Next.js, Zustand, or Supabase.

`apps/web/features/chat/model/store` adapts that state machine to Zustand and
React. The store is a UI cache and interaction model, not an authorization
source. Server data and Postgres/RLS remain authoritative.

The chat read/render flow is:

```text
authenticated channel page
  -> feature page-data
  -> AuthService + ProfileRepository + ChatRepository
  -> bounded application DTO
  -> ChatClient hydration
  -> Zustand adapter over core reducer
  -> chat components
```

The message command flow is:

```text
composer -> optimistic reducer event -> Next.js Server Action
  -> injected ChatCommandService -> Supabase command adapter
  -> Edge Function (or local RPC fallback where defined)
  -> persisted domain result -> reconciliation + Realtime merge
```

Realtime is recovery-aware rather than treated as the sole source of truth.
Reconnect callbacks trigger bounded refresh/backfill operations, allowing the
client to recover from missed, duplicated, or reordered provider events.

## Authentication and Authorization

Supabase Auth owns user identity and session issuance. The web proxy refreshes
cookies so Server Components and route handlers can read current session state.
Feature auth use cases translate authentication outcomes into product redirect
paths and role-aware page data.

Postgres RLS is the authoritative authorization boundary for direct reads.
Sensitive or command-style writes use Server Actions, Supabase Edge Functions,
and database RPCs. Edge Function calls retain the caller's access context so
database policy and RPC checks run as the user, not as an implicit trusted API.

## Persistence and Backend

Schema evolution is ordered in `supabase/migrations`. Main persisted concepts
include profiles, coach/client assignments, channels, conversations, messages,
read states, reactions, and presence sessions. Generated database types are
committed at `packages/supabase/src/database.generated.ts`.

Edge Function entry points are:

- `supabase/functions/send-message/index.ts` for message creation.
- `supabase/functions/chat-command/index.ts` for other sensitive chat commands.

Operational verification and seeding live under `scripts`; these modules may
use provider types because they are infrastructure tooling, not application
code.

## Boundary Enforcement

Architecture is executable through tests rather than documentation alone.

- `apps/web/tests/service-boundary.test.ts` rejects Supabase imports, raw
  client factories, provider types, and adapter escape hatches outside the
  infrastructure/composition allow-list. It also checks adapter direction,
  transport-neutral contracts, and injected use-case independence.
- `apps/web/tests/module-boundaries.test.ts` checks route/feature placement,
  client/server import direction, reusable-code independence from `app`, pure
  core chat state, and component colocation rules.
- `apps/web/tests/server-only-poisoning.test.ts` and related marker fixtures
  verify runtime poisoning boundaries.

These checks preserve the distinction between hiding a provider import and
actually inverting the dependency: application modules depend on FISH-owned
interfaces, while provider details remain replaceable adapter concerns.
