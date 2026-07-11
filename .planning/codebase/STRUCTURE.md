---
mapped_at: 2026-07-11
last_mapped_commit: 8db370815b16e6563aae8c1d7e1992697f5fd9d0
focus: structure
---

# Repository Structure

## Top-Level Layout

```text
fish/
├── apps/
│   ├── web/                 # Active Next.js product application
│   └── ios/                 # Empty/untracked placeholder directory; no source files
├── packages/
│   ├── core/                # Backend-neutral product contracts and chat state machine
│   └── supabase/            # Generated DB types and Supabase-specific contracts
├── supabase/                # Local backend config, SQL migrations, Edge Functions, templates
├── scripts/                 # Seed and backend verification utilities
├── docs/                    # Architecture, UX guidance, plans, and change notes
├── .planning/               # GSD project/milestone state and generated codebase map
├── package.json             # Workspace orchestration scripts
├── pnpm-workspace.yaml      # `apps/*` and `packages/*` workspaces
└── AGENTS.md                # Repository-wide product and implementation constraints
```

Generated/local directories such as `.next/`, `.pnpm-store/`, `apps/web/storybook-static/`, `supabase/.temp/`, and `supabase/.branches/` are not source architecture and should not be edited as product code.

## `apps/web`: Application Surface

`apps/web/app/` follows Next.js App Router conventions:

- `apps/web/app/layout.tsx` is the global layout; `apps/web/app/globals.css` owns Tailwind v4 theme tokens and global behavior.
- `apps/web/app/page.tsx` is the root role-aware redirect.
- `apps/web/app/(authenticated)/layout.tsx` protects every route in the authenticated group and renders the shared shell.
- `apps/web/app/(authenticated)/home/page.tsx` is the client landing page.
- `apps/web/app/(authenticated)/coach/page.tsx` and `apps/web/app/(authenticated)/coach/clients/[id]/page.tsx` are coach list/detail surfaces.
- `apps/web/app/(authenticated)/profile/page.tsx` and `apps/web/app/(authenticated)/profile/edit/` cover client settings; mutations are colocated in `actions.ts`.
- `apps/web/app/(authenticated)/channels/[id]/page.tsx` renders the current single community channel.
- `apps/web/app/(authenticated)/chat/` is a supporting feature module, not its own route: it contains the chat client, actions, reducer adapters, realtime client, hooks, and tests used by the channel route.
- `apps/web/app/auth/callback/route.ts` and `apps/web/app/auth/confirm/route.ts` are auth route handlers.
- Public auth/status pages are under `apps/web/app/login/`, `signup/`, `forgot-password/`, `reset-password/`, `check-inbox/`, and `expired-link/`.
- `apps/web/app/kit/page.tsx` is the component-kit preview surface.

Route-specific components are colocated with pages when they are not shared, for example `apps/web/app/login/login-form.tsx` and `apps/web/app/(authenticated)/profile/edit/edit-profile-form.tsx`. Tests normally sit beside the implementation as `*.test.ts` or `*.test.tsx`.

## `apps/web/components`: UI Organization

`apps/web/components/ui/` contains reusable base primitives. Each primitive usually has a folder with implementation, `index.ts` barrel, unit test, and Storybook story; examples include `button/`, `input/`, `card/`, `progress/`, `alert/`, and `scroll-area/`.

Domain components are grouped by product concern:

- `apps/web/components/chat/` contains presentational chat building blocks such as composer, bubble, avatar, message body/meta/status, reactions, quoted message, typing indicator, search filters, and empty states.
- `apps/web/components/shell/` owns the authenticated app shell, user menu, initial preference script, and preference hydration.
- `apps/web/components/auth/` owns logout and identity-change cache safety.
- `apps/web/components/profile/`, `coach/`, and `home/` contain feature-specific display components.
- `apps/web/components/kit/` contains design-system demonstration controls.

Focusable reusable controls are expected to use named exports and `forwardRef`; conditional class composition uses `cn()` from `apps/web/lib/utils.ts`.

## `apps/web/lib`: Cross-Route Application Logic

- `apps/web/lib/auth/` contains browser/server auth helpers, redirect constants, signed-in redirect logic, and logout behavior.
- `apps/web/lib/services/` is the preferred provider boundary. `errors.ts` defines service results/errors, `container.ts` defines immutable service maps, `env.ts` validates public configuration, and `testing.ts` supplies test helpers.
- `apps/web/lib/services/supabase/` contains the core repository implementations plus browser, server, proxy, and type modules.
- `apps/web/lib/supabase/` contains legacy compatibility wrappers that delegate to the service layer.
- `apps/web/lib/validation/` contains reusable Zod schemas such as profile validation.
- `apps/web/lib/prefs/` contains preference application and time-format helpers.
- `apps/web/lib/channels.ts` centralizes the seeded general channel ID, slug, name, and URL.
- `apps/web/lib/utils.ts` contains generic web utilities, notably Tailwind class merging.

Keep route orchestration in `app/`, reusable presentation in `components/`, and cross-route/provider logic in `lib/`. Do not move database authorization assumptions into UI modules.

## Chat Feature Substructure

The chat feature intentionally separates pure state, browser orchestration, and visual components:

```text
packages/core/src/chat-state/                   # Pure state machine
apps/web/app/(authenticated)/chat/
├── actions.ts                                  # Validated server command/read boundary
├── chat-client.tsx                             # Client composition root
├── chat-state.ts                               # View-specific derived helpers
├── message-grouping.ts                         # Visual grouping logic
├── presence.ts                                 # Presence calculations
├── realtime.ts                                 # Supabase subscription primitives
├── hooks/                                      # One concern per interaction hook
└── store/                                      # Zustand adapter and selectors
apps/web/components/chat/                       # Stateless/reusable rendering pieces
```

The core state machine files are `packages/core/src/chat-state/types.ts`, `reducer.ts`, `selectors.ts`, and `index.ts`; fixture vectors live in `packages/core/src/chat-state/fixtures/chat-state-vectors.json`. The protocol is documented in `packages/core/docs/chat-state-protocol.md`.

Within the web feature, use hooks for lifecycle-heavy concerns (`use-chat-realtime.ts`, `use-chat-presence.ts`, `use-stick-to-bottom.ts`, `use-load-older-messages.ts`) and keep state transitions routed through `apps/web/app/(authenticated)/chat/store/chat-store.ts` rather than mutating parallel component state.

## Shared Packages

`packages/core/` is a TypeScript-only package with no runtime framework dependency:

- `packages/core/src/index.ts` is the root barrel.
- `packages/core/src/roles.ts` defines role contracts.
- `packages/core/src/chat.ts` defines chat DTO/command contracts and limits.
- `packages/core/src/chat-state/` implements the deterministic client state protocol.
- `packages/core/package.json` exposes `.`, `./roles`, `./chat`, and `./chat-state` entry points.

`packages/supabase/` is also TypeScript-only and depends on `@fish/core`:

- `packages/supabase/src/database.generated.ts` is generated from the migrated Supabase schema.
- `packages/supabase/src/database.types.ts` provides re-exported database types and row aliases.
- `packages/supabase/src/auth.ts` contains auth claim/redirect contracts.
- `packages/supabase/src/index.ts` is the public barrel.

Shared packages typecheck through their `build`/`typecheck` scripts; they do not emit compiled artifacts in this repository.

## Supabase Backend Layout

`supabase/config.toml` is the local project configuration for auth, external Google login, email templates, and Edge Function JWT verification.

`supabase/migrations/` uses zero-padded chronological SQL filenames. The current sequence has intentional gaps and runs from `0001_profiles.sql` through `0016_channels.sql`. Later migrations amend earlier chat functions/policies, so behavior must be read cumulatively rather than inferred from `0010_chat.sql` alone.

`supabase/functions/send-message/index.ts` is the dedicated send command. `supabase/functions/chat-command/index.ts` handles edit, delete, reaction, read-state, and refresh commands. Both are Deno entry points and talk to Supabase Auth/PostgREST using the caller's bearer token.

`supabase/templates/confirmation.html` and `supabase/templates/recovery.html` contain branded auth email content. `supabase/snippets/` currently has no tracked product source.

## Scripts and Verification

- `scripts/seed.ts` provisions local demo accounts, assignments, conversations, messages, reads, and related data.
- `scripts/seed-reaction-randomizer.ts` supports deterministic seeded reaction variation.
- `scripts/verify-rls.ts` exercises database authorization boundaries.
- `scripts/verify-chat-realtime.ts` verifies realtime behavior against a running local Supabase stack.

Web unit/component tests are colocated or live in `apps/web/tests/` for architectural/design invariants. Browser journeys live in `apps/web/e2e/`. Vitest configuration is in `apps/web/vitest.config.ts`; Playwright configuration is in `apps/web/playwright.config.ts`; Storybook configuration is under `apps/web/.storybook/`.

## Documentation and Planning

- `AGENTS.md` is the controlling engineering/product instruction set.
- `docs/ui-ux-agent-guidelines.md` must be read before user-facing UI work.
- `docs/ARCHITECTURE.md` is a human-authored architecture narrative but currently contains stale pre-chat statements; use the implementation and this generated map when they conflict.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` preserve feature design/implementation plans.
- `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, and `.planning/milestones/` store GSD lifecycle state.
- `.planning/codebase/` contains generated repository mapping documents and should describe the current commit named in frontmatter.

## Naming and Placement Rules

- React components and exported component symbols use PascalCase, while filenames and directories use kebab-case.
- Hooks use `use-*.ts`; server mutations use colocated `actions.ts`; Next route handlers use `route.ts`; App Router pages/layouts use `page.tsx` and `layout.tsx`.
- Tests use `*.test.ts(x)`, Storybook files use `*.stories.tsx`, and E2E tests use `*.spec.ts`.
- Component folders expose public imports through `index.ts` barrels where the component family is intended for reuse.
- Database changes belong in a new ordered file under `supabase/migrations/`, followed by regeneration of `packages/supabase/src/database.generated.ts`.
- Product contracts shared across runtimes belong in `packages/core`; Supabase-specific contracts belong in `packages/supabase`; web-only DTOs and provider interfaces belong in `apps/web/lib/services/`.

## Where to Add New Work

- Add a new authenticated screen under `apps/web/app/(authenticated)/` so it inherits the session boundary.
- Add reusable visual primitives under `apps/web/components/ui/`; extend existing primitives before creating new controls.
- Add feature presentation under `apps/web/components/<feature>/` and feature orchestration near its route in `apps/web/app/`.
- Add provider-neutral domain transitions/types to `packages/core` only when more than the web runtime should share them.
- Add simple authorized reads as repository methods in `apps/web/lib/services/supabase/core.ts` and corresponding interfaces in `apps/web/lib/services/supabase/types.ts`.
- Add sensitive writes through an Edge Function/Postgres RPC, with schema/RLS changes in `supabase/migrations/`.
- Add architectural invariant tests under `apps/web/tests/` when a boundary should be mechanically enforced across many source files.
