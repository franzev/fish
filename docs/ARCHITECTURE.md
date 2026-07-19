# FISH Architecture

Last verified: 2026-07-14

FISH is a pnpm monorepo with one production application: a Next.js App Router
web app backed directly by Supabase. It deliberately has no standalone
Node/Express API.

## System overview

```text
Browser
  -> Next.js App Router (routes, components, use cases)
     -> FISH-owned ports and DTOs
     -> browser/server/proxy composition roots
     -> Supabase adapters
        -> Auth
        -> Postgres + RLS + RPCs
        -> Realtime
        -> Edge Functions

apps/web application -> packages/core
apps/web infrastructure -> packages/supabase -> packages/core
```

- `apps/web` owns routes, server composition, React UI, and the web chat adapter.
- `packages/core` owns backend-neutral roles, transport contracts, and the pure
  chat-state reducer.
- `packages/supabase` owns generated database types and row aliases used only
  by infrastructure and operational code.
- `supabase` owns schema evolution, authorization policies, command RPCs,
  Realtime configuration, and Edge Functions.

## Web boundaries

Protected routes live under `apps/web/app/(authenticated)`. The shared layout
verifies the current user and loads shell preferences; leaf pages enforce
role-specific redirects. The `app` tree is the route layer: it owns route
files and genuinely route-local UI, while reusable domain implementations live
outside it.

Auth, profile, coach, and chat code is organized under `apps/web/features`.
Each feature exposes a client-safe presentation entry point from `index.ts`
and a separate server entry point from `server/index.ts`. Server page-data and
factory modules import `server-only`; browser client factories, session
listeners, and hooks import `client-only`. Server Actions remain explicit
`"use server"` RPC boundaries so Client Components can invoke them without
pulling their implementation dependencies into the browser graph.

Routes and shared components import the owning feature entry points directly.
Client-safe barrels never re-export poisoned server entries, and the app does
not retain legacy re-export files for internal paths.

Application-owned interfaces and DTOs live in the bounded-context modules under
`apps/web/lib/services/contracts/`, with `contracts.ts` retained as a stable
forwarding entry point.
Routes, features, hooks, and components depend on these capabilities rather
than SDK clients or generated database rows. Concrete adapters live only in
`apps/web/lib/services/supabase/`; table names, RPCs, bearer-token transport,
Realtime channels, provider payload mapping, and cookie mechanics stay there.

`apps/web/lib/services/runtime/` contains the browser and server composition
roots. These are the only application modules that select concrete adapters.
They return FISH-owned interfaces; they never re-export adapter implementations.
Feature use cases are created through focused factories such as auth navigation,
profile action, chat action, and realtime bindings, so tests inject only the
interface methods they exercise. Proxy session refresh is an infrastructure
entry operation because it owns SDK cookie synchronization.

Reusable primitives live in `apps/web/components/ui`; domain components live
beside chat, profile, coach, and home features. Tailwind CSS v4 tokens and
global accessibility behavior live in `apps/web/app/globals.css`. There is no
`tailwind.config.js`.

Every reusable component lives in a same-named folder with its tests, stories,
private helpers, and an `index.ts` entry point. Grouping folders organize those
component folders but do not contain loose component implementations.

## Authentication and authorization

Supabase Auth owns identity and sessions. The Next.js proxy refreshes session
cookies but does not authorize requests.

Postgres RLS is the authoritative boundary for reads. Database triggers protect
roles and relational integrity. Sensitive writes cross explicit command
boundaries implemented with Next.js Server Actions, Supabase Edge Functions,
and Postgres RPCs. Edge Functions preserve the caller's bearer token so RLS and
RPC checks execute as that user.

## Chat architecture

The current product route is `/channels/[id]`. The shipped milestone exposes
one seeded `general` channel backed by the demo-community conversation.

Initial data is server-rendered as a bounded newest-message window. The client
uses two state layers:

1. `packages/core/src/chat-state` — pure events, reducer transitions,
   selectors, deterministic merges, optimistic reconciliation, and pagination.
2. `apps/web/features/chat/model/store` — a Zustand adapter that adds
   React integration, hydration keys, and identity-safe cache ownership.

Sending follows this command path:

```text
composer
  -> optimistic reducer event
  -> Next.js sendMessageAction (framework composition)
  -> injected ChatCommandService interface
  -> Supabase chat command adapter
     -> send-message Edge Function
     -> local send_chat_message RPC fallback when the local function is unavailable
  -> persisted row
  -> optimistic reconciliation + Realtime merge
```

Other chat commands use the `chat-command` Edge Function. Realtime subscriptions
cover messages, reactions, read state, typing, recording, and presence.
Realtime is treated as a hint: bounded refreshes and reconnect backfills recover
authoritative Postgres state after missed or duplicated events.

## Data model

Core tables include:

- `profiles`, `client_profiles`, and `coach_clients`
- `lesson_slots`, which begins as coach availability and becomes the durable
  booking through an atomic command RPC
- `channels` and `conversations`
- `messages`, `message_reads`, and `message_reactions`
- `presence_sessions`

Schema changes are ordered under `supabase/migrations`. Generated TypeScript
types are committed in `packages/supabase/src/database.generated.ts`.

## Architectural guardrails

- Dependency direction is application -> ports <- adapters; provider packages
  and generated rows never appear in application contracts.
- Application interfaces use domain-shaped camelCase DTOs. Adapters alone map
  database columns, provider error codes, HTTP responses, and realtime payloads.
- Feature action handlers and auth navigation use cases receive focused
  interfaces explicitly; framework entry points obtain production adapters from
  composition roots and delegate immediately.
- Simple authorized reads use repositories over RLS-protected Supabase access.
- Sensitive writes use actions, Edge Functions, and database RPCs.
- Lesson booking uses the `booking-command` Edge Function and the
  `book_lesson_slot` RPC so RLS, idempotency, and slot conflicts are enforced
  at the database boundary.
- `packages/core` must not import React, Next.js, Zustand, or Supabase.
- Client chat state is a cache and interaction model, never an authorization source.
- Message windows and recovery reads remain bounded.
- User-facing learning features require manual coach validation before implementation.
- Tailwind v4 remains CSS-first; keep `tailwindcss` and
  `@tailwindcss/postcss` on the same version.
- `tests/service-boundary.test.ts` scans production `.ts` and `.tsx` files and
  rejects provider imports, raw-client factories, SDK types, and client escape
  hatches outside the adapter/composition allow-list.

For detailed generated maps, see `../.planning/codebase/`. Those files should
be regenerated after meaningful architecture changes.
