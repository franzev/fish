---
title: Technology stack
mapped_at: 2026-07-11
last_mapped_commit: 8db370815b16e6563aae8c1d7e1992697f5fd9d0
focus: tech
---

# Technology Stack

## Repository and Runtime

- The project is a private TypeScript monorepo managed by pnpm workspaces; the root pins `pnpm@11.7.0` in `package.json` and includes `apps/*` plus `packages/*` through `pnpm-workspace.yaml`.
- The principal runtime is the Next.js application in `apps/web`; shared packages are source-level TypeScript libraries and do not emit JavaScript.
- Root scripts in `package.json` delegate development, build, lint, and typechecking to workspace packages. The web development server listens on port 3001.
- Node is used for local administration scripts with native type stripping (`node --experimental-strip-types`) in `scripts/seed.ts`, `scripts/verify-rls.ts`, and `scripts/verify-chat-realtime.ts`.
- Supabase Edge Functions use the Deno runtime and the built-in Fetch/Response APIs; their entry points are `supabase/functions/send-message/index.ts` and `supabase/functions/chat-command/index.ts`.

## Application Framework

- `apps/web/package.json` pins Next.js 16.2.9, React 19.2.7, and React DOM 19.2.7.
- The web app uses the Next.js App Router under `apps/web/app`, including Server Components, Client Components, Server Actions, Route Handlers, and the Next.js 16 `proxy.ts` request interception convention.
- `apps/web/next.config.mjs` intentionally contains no custom framework configuration.
- TypeScript 5.7.3 is used throughout. `apps/web/tsconfig.json` enables strict mode, bundler module resolution, no emit, isolated modules, and the `@/*` alias rooted at `apps/web`.
- `packages/core/tsconfig.json` and `packages/supabase/tsconfig.json` target ES2022 and expose TypeScript source directly through package exports.

## UI and Styling

- Tailwind CSS 4.3.x is configured through the CSS-first `@theme` block in `apps/web/app/globals.css`; PostCSS loads only `@tailwindcss/postcss` from `apps/web/postcss.config.mjs`.
- There is no `tailwind.config.js`. Design colors, spacing, typography, radii, control sizes, and motion values are semantic CSS variables in `apps/web/app/globals.css`.
- `next/font/google` loads Lexend and Fraunces in `apps/web/app/layout.tsx` and exposes them as CSS variables.
- Reusable primitives are implemented in `apps/web/components/ui`; Base UI 1.6 provides accessible low-level behavior and `@tabler/icons-react` supplies icons.
- Component variant and class composition use `class-variance-authority`, `clsx`, `tailwind-merge`, and the `cn()` helper in `apps/web/lib/utils.ts`.
- Color parsing and contrast assertions use `colorjs.io`; emoji picker data comes from `unicode-emoji-json`.

## State, Validation, and Domain Packages

- Zustand 5 is the client-side state container for chat state in `apps/web/app/(authenticated)/chat/store/chat-store.ts`.
- Zod 4 validates form and Server Action input, notably chat commands in `apps/web/app/(authenticated)/chat/actions.ts` and profile data in `apps/web/lib/validation/profile.ts`.
- `packages/core` owns framework-independent product contracts: roles, chat limits/types, and the chat-state reducer/selectors under `packages/core/src`.
- `packages/supabase` owns generated and curated database/auth contracts in `packages/supabase/src`, and depends only on `@fish/core`.
- Supabase access is wrapped behind typed service interfaces in `apps/web/lib/services`; compatibility adapters remain in `apps/web/lib/supabase` for existing call sites.

## Backend and Persistence

- Supabase is the sole backend platform. PostgreSQL schema, triggers, RLS policies, RPC functions, and Realtime publication changes are versioned in `supabase/migrations`.
- Browser/server connectivity uses `@supabase/supabase-js` 2.110.0; cookie-aware SSR clients use `@supabase/ssr` 0.12.0.
- Simple authorized reads go directly through the typed Supabase client and RLS. Sensitive command-style chat writes go through Deno Edge Functions and database RPCs.
- Realtime Postgres changes and broadcast channels drive chat messages, read state, typing, recording, and presence handling in `apps/web/app/(authenticated)/chat/realtime.ts`.
- Storage is exposed through the service abstraction in `apps/web/lib/services/supabase/core.ts`, although no concrete application bucket workflow is currently evident.

## Quality Toolchain

- ESLint 9 with `eslint-config-next` 16.2.9 supplies Core Web Vitals and TypeScript rules via `apps/web/eslint.config.mjs`.
- Vitest 4.1.9, jsdom 29.1.1, React Testing Library, and jest-dom cover unit/component tests; configuration lives in `apps/web/vitest.config.ts` and `apps/web/vitest.setup.ts`.
- Playwright 1.61.1 runs Chrome end-to-end tests from `apps/web/e2e`; `apps/web/playwright.config.ts` starts or reuses the web server and retains traces on failure.
- Storybook 10.4.6 with the Next.js Vite integration documents components; stories sit beside components as `*.stories.tsx`.
- The required pre-commit build contract is `pnpm build`; root scripts also expose `pnpm lint` and `pnpm typecheck`.

## Important Constraints

- Keep `tailwindcss` and `@tailwindcss/postcss` on the same version and preserve CSS-first configuration.
- Use pnpm and the existing workspace boundary; do not introduce npm lockfiles or a separate Express API by default.
- Treat `packages/core` as product-domain code and `packages/supabase` as backend contracts, keeping framework-specific service implementations in `apps/web`.
