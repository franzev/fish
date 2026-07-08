# Technology Stack

**Analysis Date:** 2026-07-02

## Languages

**Primary:**
- TypeScript 5.7.3 - All shared packages (`packages/core`, `packages/supabase`) and web frontend (`apps/web`)

**Secondary:**
- JavaScript (ESM) - Configuration files (`.mjs`)
- CSS - Design tokens and utilities (`apps/web/app/globals.css`)

## Runtime

**Environment:**
- Node.js (version not explicitly specified; inferred from pnpm 11.7.0 compatibility)
- pnpm 11.7.0 (specified in `package.json` as packageManager)
- Supports: JavaScript/TypeScript execution on Node for development, builds, and Supabase Edge Functions

**Package Manager:**
- pnpm 11.7.0 (with pnpm workspaces)
- Lockfile: `pnpm-lock.yaml` (lockfileVersion 9.0)

## Frameworks

**Core:**
- Next.js 16.2.9 - React app framework with App Router; web frontend in `apps/web`
- React 19.2.7 - Component library and UI framework
- Tailwind CSS 4.3.1 - Utility-first CSS framework (CSS-first config via `@theme` in `globals.css`; no `tailwind.config.js`)

**Testing:**
- Not yet detected in codebase (lint and typecheck only via tsc and eslint)

**Build/Dev:**
- PostCSS with `@tailwindcss/postcss` 4.3.1 - CSS transformation pipeline (`apps/web/postcss.config.mjs`)
- ESLint 9.39.4 - Code quality linting (`apps/web/eslint.config.mjs`, uses Next.js ESLint config)
- TypeScript compiler (tsc) - Type checking via `typecheck` script

## Key Dependencies

**Critical:**

**Web Frontend:**
- `next` 16.2.9 - Web framework, server components, routing
- `react` 19.2.7 - UI rendering
- `react-dom` 19.2.7 - DOM rendering and lifecycle
- `@tailwindcss/postcss` 4.3.1 - Tailwind CSS plugin for PostCSS pipeline (must match `tailwindcss` version)
- `tailwindcss` 4.3.1 - CSS generation from design tokens
- `clsx` 2.1.1 - Conditional className composition (used in `cn()` utility)
- `tailwind-merge` 2.6.0 - Resolves Tailwind class conflicts
- `@types/react` 19.2.17 - Type definitions for React
- `@types/react-dom` 19.2.3 - Type definitions for React DOM
- `@types/node` 22.10.7 - Node.js type definitions for Next.js

**Shared Packages:**
- `@fish/core` - Product domain types (roles, chat contracts) - workspace package
- `@fish/supabase` - Supabase auth and database types - workspace package

**Infrastructure:**
- TypeScript 5.7.3 - Language and compiler (used across all packages)

## Configuration

**Environment:**
- Supabase project ID: `fish` (defined in `supabase/config.toml`)
- Environment variables: Not yet defined in `.env` files (Web app has no `.env*` files present)
- Recommended env vars for Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (standard for client-side Supabase libraries, but not yet integrated)

**Build:**
- `apps/web/next.config.mjs` - Minimal Next.js config (no custom plugins)
- `apps/web/tsconfig.json` - Strict TypeScript with JSX support and path alias `@/*` mapping to `app/` directory
- `apps/web/postcss.config.mjs` - PostCSS with `@tailwindcss/postcss` plugin
- `apps/web/eslint.config.mjs` - ESLint config using Next.js core-web-vitals and TypeScript rulesets

## Platform Requirements

**Development:**
- Node.js 16+ (inferred from pnpm 11.7.0 and Next.js 16 compatibility)
- pnpm 11.7.0+
- TypeScript 5.7.3 (installed globally or via pnpm)
- ESLint for linting

**Production:**
- **Web:** Node.js runtime or static export (Next.js deployment target not explicitly specified; Edge Runtime required for Supabase Edge Functions)
- **Backend:** Supabase-managed infrastructure (PostgreSQL database, authentication, Edge Functions runtime)

---

*Stack analysis: 2026-07-02*
