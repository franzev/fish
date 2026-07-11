---
title: Codebase Structure
last_mapped: 2026-07-11
last_mapped_commit: e25c937627b8f19251c791ed6878e6522f802959
---

# Codebase Structure

## Repository Layout

```text
fish/
├── apps/
│   └── web/                 Next.js App Router application
├── packages/
│   ├── core/                Framework/provider-neutral product logic
│   └── supabase/            Generated database types and row aliases
├── supabase/
│   ├── functions/           Deno Edge Function entry points
│   ├── migrations/          Ordered schema, policy, RPC, and seed migrations
│   └── templates/           Supabase email templates
├── scripts/                 Seed and backend verification tooling
├── docs/                    Human-maintained architecture and product guidance
├── .planning/               GSD plans, state, and generated codebase maps
├── package.json             Workspace scripts and pinned tooling
├── pnpm-workspace.yaml      Workspace package discovery
└── pnpm-lock.yaml           pnpm dependency lockfile
```

The repository is a pnpm workspace. Use root scripts such as `pnpm build`,
`pnpm lint`, and `pnpm typecheck`; package-local scripts are coordinated through
recursive pnpm execution.

## Web Application

`apps/web` is the only production application and contains four major areas:
the App Router entry tree, reusable components, feature modules, and shared web
infrastructure.

### App Router tree

`apps/web/app` contains framework-recognized entries and route-private UI.

```text
apps/web/app/
├── (authenticated)/
│   ├── channels/[id]/page.tsx
│   ├── coach/
│   │   ├── page.tsx
│   │   └── clients/[id]/page.tsx
│   ├── home/page.tsx
│   ├── profile/
│   │   ├── page.tsx
│   │   └── edit/
│   │       ├── page.tsx
│   │       └── _components/edit-profile-form/
│   └── layout.tsx
├── auth/
│   ├── callback/route.ts
│   └── confirm/route.ts
├── check-inbox/
├── expired-link/
├── forgot-password/
├── login/
├── reset-password/
├── signup/
├── kit/page.tsx
├── globals.css
├── layout.tsx
└── page.tsx
```

Route files should remain thin composition points. UI private to one route
segment lives below `_components`; reusable domain UI is moved to a feature or
shared component directory. Next.js special files (`page.tsx`, `layout.tsx`,
`route.ts`, `loading.tsx`, `error.tsx`, and similar framework entries) are the
only normal loose `.tsx` implementations in the route tree.

`apps/web/proxy.ts` is the Next.js 16 proxy entry and owns session refresh.
`apps/web/app/globals.css` is the Tailwind CSS v4 CSS-first theme source; the
repository intentionally has no `tailwind.config.js`.

### Feature modules

Feature ownership is explicit under `apps/web/features`:

```text
apps/web/features/
├── auth/
│   ├── client/              Browser auth factories and hooks
│   ├── components/          Auth-owned reusable components
│   ├── server/              Auth page data and navigation use cases
│   ├── contracts.ts         Auth presentation/page-data models
│   ├── redirects.ts         Product redirect destinations
│   └── index.ts             Client-safe public entry point
├── chat/
│   ├── components/          Chat UI organized by component folder
│   ├── hooks/               Composer, messages, presence, reads, realtime
│   ├── model/               State adapters, grouping, presence, realtime binding
│   ├── server/              Actions, handlers, schemas, and page data
│   ├── contracts.ts         Feature-specific UI contracts
│   └── index.ts             Client-safe public entry point
├── coach/
│   ├── components/client-list/
│   ├── server/page-data.ts
│   └── index.ts
└── profile/
    ├── components/          Profile and preference UI
    ├── server/              Server Actions and injected handlers
    ├── validation.ts
    └── index.ts
```

The feature root `index.ts` is the client-safe presentation surface. A feature
with server APIs uses `server/index.ts` as a separate `server-only` entry. This
split matters for the Next.js module graph: client barrels must not forward
server implementations.

### Shared components

`apps/web/components` is organized by ownership:

- `components/ui` contains design-system primitives: `Alert`, `Button`,
  `Card`, `Input`, `Progress`, and `ScrollArea`.
- `components/shell` contains the application shell, preference hydration,
  initial preference script, and user menu.
- `components/home` contains reusable home presentation.
- `components/kit` contains design-kit demonstration controls.

Every React component implementation uses a same-named kebab-case folder:

```text
components/ui/button/
├── button.tsx
├── button.test.tsx
├── button.stories.tsx
└── index.ts
```

The same rule applies under feature `components` and route `_components`.
Tests, stories, and private helpers are colocated. Grouping directories may
contain component folders, helpers, and barrels, but no loose component
implementation files. Each component folder has an `index.ts` entry point.

### Shared web services and utilities

```text
apps/web/lib/
├── prefs/                   Browser preference constants and utilities
├── services/
│   ├── contracts.ts         Application-owned ports and camelCase DTOs
│   ├── errors.ts            Provider-neutral result/error model
│   ├── container.ts         Typed service container helper
│   ├── env.ts               Public environment parsing
│   ├── runtime/
│   │   ├── browser.ts       Browser composition root
│   │   └── server.ts        Server composition root
│   └── supabase/            Concrete Supabase adapters only
└── utils.ts                 Shared `cn()` class-name helper
```

Inside `lib/services/supabase`:

- `auth.ts` maps Supabase Auth to `AuthService`.
- `profile-repositories.ts` implements profile and assignment ports.
- `chat-repository.ts` provides initial bounded chat reads.
- `chat-command-service.ts` implements behavioral chat commands.
- `chat-mapping.ts` translates database/provider shapes to application DTOs.
- `chat-realtime.ts` owns Realtime channels and payload conversion.
- `edge-function-transport.ts` owns Edge Function HTTP mechanics.
- `local-chat-commands.ts` owns local RPC fallback implementation.
- `browser.ts`, `server.ts`, and `proxy.ts` own runtime client/cookie setup.
- `core.ts` and `runtime-services.ts` assemble cohesive adapter sets.
- `types.ts` keeps provider-specific internal type aliases out of features.

Only `lib/services/runtime` selects these concrete implementations. Public
service exports come from `apps/web/lib/services/index.ts` and expose
application contracts/errors, not provider adapters.

## Shared Packages

### `packages/core`

`packages/core/src` contains reusable product logic:

- `roles.ts` defines recognized user roles and role guards.
- `auth.ts` contains shared auth-facing contracts.
- `chat.ts` contains shared chat transport/domain contracts.
- `chat-state/` contains reducer types, transitions, selectors, and fixture
  vectors for deterministic chat behavior.
- `index.ts` is the package public entry point.

`packages/core` must remain free of React, Next.js, Zustand, and Supabase
imports. Tests and consumers can therefore run its state logic without a web
or backend runtime.

### `packages/supabase`

`packages/supabase/src/database.generated.ts` is generated from the database
schema. `database.types.ts` and `auth.ts` add provider-facing type aliases, and
`index.ts` is the package entry point. These types are consumed by web
infrastructure, scripts, and backend-related tooling rather than application
features.

## Supabase Backend

`supabase/migrations` is the source of truth for database changes. Migration
filenames use ordered timestamp prefixes. They define tables, policies,
triggers, RPCs, indexes, Realtime publication configuration, and seed-related
backend changes.

`supabase/functions/send-message/index.ts` and
`supabase/functions/chat-command/index.ts` are Deno Edge Function entries.
They are command boundaries, not a general-purpose API tier.

`scripts/seed.ts`, `scripts/verify-rls.ts`, and
`scripts/verify-chat-realtime.ts` exercise backend setup and policy/realtime
behavior against a configured Supabase environment.

## Tests and Generated Artifacts

Web unit and architecture tests are under `apps/web/tests` and colocated beside
feature/component sources. Browser flows live in `apps/web/e2e`. Storybook
configuration is in `apps/web/.storybook`; component stories remain colocated
with their implementations.

Build outputs such as `apps/web/.next`, `apps/web/storybook-static`, and
`apps/web/test-results` are generated artifacts, not architectural source.
Dependency directories under `node_modules` are likewise excluded from source
mapping and boundary scans.

## Naming and Export Conventions

- Component folders and implementation filenames use matching kebab-case.
- Components use named exports; focusable controls use `forwardRef`.
- Full-surface barrels use `export * from "..."`; explicit named re-exports
  are reserved for intentional API subsets, renames, collisions, compatibility,
  or client/server/provider boundaries.
- Server-only entry points include `import "server-only"`; browser-only helper
  modules include `import "client-only"` where appropriate.
- Route-private directories start with `_`; route groups use parentheses.
- Supabase migration files retain timestamp-prefixed snake_case names, while
  application-facing TypeScript DTOs use camelCase.
- Tests use `.test.ts` or `.test.tsx`; stories use `.stories.tsx` and are
  colocated with their component.
