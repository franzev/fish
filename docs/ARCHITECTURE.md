# FISH Architecture

Last verified: 2026-07-11

FISH is a pnpm monorepo with one production application: a Next.js App Router
web app backed directly by Supabase. It deliberately has no standalone
Node/Express API.

## System overview

```text
Browser
  -> Next.js App Router
     -> server components and server actions
     -> Supabase service/repository boundary
        -> Auth
        -> Postgres + RLS + RPCs
        -> Realtime
        -> Edge Functions

apps/web -> packages/supabase -> packages/core
         -> packages/core
```

- `apps/web` owns routes, server composition, React UI, and the web chat adapter.
- `packages/core` owns backend-neutral roles, transport contracts, and the pure
  chat-state reducer.
- `packages/supabase` owns generated database types, row aliases, and
  Supabase-specific auth contracts.
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

Supabase access is wrapped by repositories in
`apps/web/lib/services/supabase/`, with separate browser, server, and proxy
factories. UI components do not construct low-level Supabase clients.

Reusable primitives live in `apps/web/components/ui`; domain components live
beside chat, profile, coach, and home features. Tailwind CSS v4 tokens and
global accessibility behavior live in `apps/web/app/globals.css`. There is no
`tailwind.config.js`.

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
  -> Next.js sendMessageAction
  -> send-message Edge Function
  -> send_chat_message Postgres RPC
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
- `channels` and `conversations`
- `messages`, `message_reads`, and `message_reactions`
- `presence_sessions`

Schema changes are ordered under `supabase/migrations`. Generated TypeScript
types are committed in `packages/supabase/src/database.generated.ts`.

## Architectural guardrails

- Simple authorized reads use repositories over RLS-protected Supabase access.
- Sensitive writes use actions, Edge Functions, and database RPCs.
- `packages/core` must not import React, Next.js, Zustand, or Supabase.
- Client chat state is a cache and interaction model, never an authorization source.
- Message windows and recovery reads remain bounded.
- User-facing learning features require manual coach validation before implementation.
- Tailwind v4 remains CSS-first; keep `tailwindcss` and
  `@tailwindcss/postcss` on the same version.

For detailed generated maps, see `../.planning/codebase/`. Those files should
be regenerated after meaningful architecture changes.
