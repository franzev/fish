---
last_mapped: 2026-07-11
last_mapped_commit: e25c937627b8f19251c791ed6878e6522f802959
focus: technology
---

# Technology Stack

## Repository Shape

- FISH is a private TypeScript monorepo managed by pnpm workspaces; the root manifest pins `pnpm@11.7.0` in `package.json`.
- Workspace discovery is limited to `apps/*` and `packages/*` by `pnpm-workspace.yaml`.
- The browser application is the `@fish/web` package in `apps/web`.
- Framework-neutral product contracts live in `@fish/core` under `packages/core/src`.
- Supabase-generated database types and provider-facing shared types live in `@fish/supabase` under `packages/supabase/src`.
- Database migrations, email templates, and Edge Functions live in `supabase/`.
- Operational seed and verification programs live in `scripts/` and run directly through Node's TypeScript stripping support.

## Languages and Runtimes

- TypeScript 5.7.3 is the primary implementation language across the web app, shared packages, scripts, and tests.
- React components use TSX and React 19.2.7.
- The web package targets ES2017 and uses DOM plus `esnext` libraries in `apps/web/tsconfig.json`.
- Shared packages target ES2022 ESM with bundler resolution and `verbatimModuleSyntax` in `packages/core/tsconfig.json` and `packages/supabase/tsconfig.json`.
- Supabase Edge Functions use TypeScript on the Deno runtime and start through `Deno.serve`, as shown in `supabase/functions/send-message/index.ts` and `supabase/functions/chat-command/index.ts`.
- PostgreSQL SQL defines the persistent model, RLS policies, triggers, RPCs, and Realtime publication setup in `supabase/migrations/`.
- CSS is maintained directly in `apps/web/app/globals.css`; Tailwind configuration is CSS-first rather than JavaScript-based.

## Application Framework

- Next.js 16.2.9 provides the web runtime and App Router. Route segments and special files are under `apps/web/app`.
- React 19.2.7 and React DOM 19.2.7 render Server and Client Components.
- Next.js runtime boundaries are explicit: provider factories import `server-only` or `client-only` in `apps/web/lib/services/supabase/server.ts` and `apps/web/lib/services/supabase/browser.ts`.
- `apps/web/proxy.ts` and `apps/web/lib/services/supabase/proxy.ts` implement request-time session refresh using the Next.js proxy API.
- `apps/web/next.config.mjs` currently uses the default Next.js configuration with no custom plugins or runtime overrides.
- The web development server runs on port 3001 via the `dev` script in `apps/web/package.json`.

## UI and State

- Tailwind CSS 4.3.1 and `@tailwindcss/postcss` 4.3.1 provide utility generation through `apps/web/postcss.config.mjs` and `@theme` tokens in `apps/web/app/globals.css`.
- Shared primitive dependencies include Base UI 1.6, Class Variance Authority, clsx, and tailwind-merge.
- Icons come from `@tabler/icons-react`; emoji metadata comes from `unicode-emoji-json`.
- Zustand 5.0.14 owns client-side chat state in `apps/web/features/chat/model/store`.
- Zod 4.4.3 validates application input, including feature validation modules such as `apps/web/features/profile/validation.ts`.
- Lexend and Fraunces are loaded through Next font support in `apps/web/app/layout.tsx` and exposed as CSS font variables.

## Backend and Persistence

- Supabase is the sole backend platform: PostgreSQL, Auth, Realtime, and Edge Functions are configured under `supabase/`.
- The browser/server SDK is `@supabase/supabase-js` 2.110.0, with cookie-aware Next.js integration through `@supabase/ssr` 0.12.0.
- Application code depends on provider-neutral service interfaces in `apps/web/lib/services/contracts.ts`.
- Concrete Supabase adapters and composition factories are isolated in `apps/web/lib/services/supabase/`.
- The immutable dependency container is implemented in `apps/web/lib/services/container.ts`; runtime composition entry points are in `apps/web/lib/services/runtime/`.
- Database schema types originate in `packages/supabase/src/database.generated.ts` and are refined/exported through `packages/supabase/src/database.types.ts`.

## Testing and Quality Tooling

- Vitest 4.1.9 with jsdom, Testing Library, and jest-dom covers unit, component, architecture-boundary, and utility tests.
- Vitest configuration and test setup are in `apps/web/vitest.config.ts` and `apps/web/vitest.setup.ts`.
- Playwright 1.61.1 runs Chrome end-to-end scenarios from `apps/web/e2e`; configuration is in `apps/web/playwright.config.ts`.
- Storybook 10.4.6 with `@storybook/nextjs-vite` and addon-docs provides isolated component development.
- ESLint 9.39.4 with `eslint-config-next` 16.2.9 enforces Next.js and TypeScript rules through `apps/web/eslint.config.mjs`.
- TypeScript strict mode and no-emit checking are enabled across all workspace packages.
- Specialized architecture tests in `apps/web/tests/service-boundary.test.ts`, `apps/web/tests/module-boundaries.test.ts`, and `apps/web/tests/nextjs-boundaries.test.ts` enforce dependency direction and module layout.
- Operational backend verification is implemented by `scripts/verify-rls.ts` and `scripts/verify-chat-realtime.ts`.

## Commands and Build

- Root scripts in `package.json` fan out with pnpm recursive/filter commands.
- `pnpm dev` runs the web development server; `pnpm build` runs all workspace build scripts.
- `pnpm lint` and `pnpm typecheck` run every package's available checks.
- `pnpm storybook` and `pnpm build-storybook` target the web package's component catalog.
- `pnpm supabase:start` and `pnpm db:reset` operate the local Supabase stack.
- `pnpm seed`, `pnpm verify:rls`, and `pnpm verify:chat-realtime` load `apps/web/.env.local` and exercise the local backend.

## Configuration and Environment

- Public application configuration is restricted to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documented in `apps/web/.env.example`.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and used by the seed/verification workflow; the example file explicitly forbids a public prefix.
- Environment parsing and URL validation are centralized in `apps/web/lib/services/env.ts`.
- Local Supabase behavior, auth redirects, Google OAuth, email templates, and JWT verification are configured in `supabase/config.toml`.
- Auth callback origins currently target the local web server at port 3001 and a `fish://auth/callback` deep link.
- There is no `tailwind.config.js`; design tokens are defined in the Tailwind v4 `@theme` block.

## Not Present

- No standalone Express or Node API service exists.
- No second database, cache, message broker, or search service is configured.
- No deployment platform SDK, analytics SDK, error-reporting SDK, or payment SDK appears in current workspace dependencies.
