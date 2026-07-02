# Technology Stack

**Analysis Date:** 2026-07-02

## Languages

**Primary:**
- TypeScript 5.7.3 - All shared packages (`packages/core`, `packages/supabase`) and web frontend (`apps/web`)
- Kotlin 1.x (from AGP 9.2.1) - Android native app (`apps/android`)
- Swift - iOS native app (`apps/ios`)

**Secondary:**
- JavaScript (ESM) - Configuration files (`.mjs`)
- TOML - Gradle version catalogs (`apps/android/gradle/libs.versions.toml`)
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
- Jetpack Compose (via Material library 1.10.0) - Android UI framework in `apps/android`
- SwiftUI - iOS UI framework in `apps/ios`

**Testing:**
- Not yet detected in codebase (lint and typecheck only via tsc and eslint)

**Build/Dev:**
- PostCSS with `@tailwindcss/postcss` 4.3.1 - CSS transformation pipeline (`apps/web/postcss.config.mjs`)
- ESLint 9.39.4 - Code quality linting (`apps/web/eslint.config.mjs`, uses Next.js ESLint config)
- TypeScript compiler (tsc) - Type checking via `typecheck` script
- Gradle 9.2.1 (AGP) - Android build system with version catalog (`apps/android`)
- Xcode build system - iOS project build

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

**Android:**
- `androidx.core:core-ktx` 1.10.1 - Kotlin extensions for Android
- `androidx.appcompat:appcompat` 1.6.1 - Backward-compatible Android UI
- `com.google.android.material:material` 1.10.0 - Material Design components
- `junit` 4.13.2 - Unit testing (test scope)
- `androidx.test.espresso:espresso-core` 3.5.1 - Instrumented testing (androidTest scope)

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
- `apps/android/build.gradle.kts` - Top-level Gradle config with Android Application plugin
- `apps/android/app/build.gradle.kts` - App-level config (Android 24+, targetSdk 36)
- `apps/android/gradle.properties` - JVM settings and Gradle optimizations (configuration-cache enabled, parallel disabled)
- `apps/android/gradle/libs.versions.toml` - Centralized dependency version catalog

## Platform Requirements

**Development:**
- Node.js 16+ (inferred from pnpm 11.7.0 and Next.js 16 compatibility)
- pnpm 11.7.0+
- TypeScript 5.7.3 (installed globally or via pnpm)
- ESLint for linting
- For Android: Android Studio, JDK 11+, AGP 9.2.1
- For iOS: Xcode (macOS required)

**Production:**
- **Web:** Node.js runtime or static export (Next.js deployment target not explicitly specified; Edge Runtime required for Supabase Edge Functions)
- **Android:** Android 7.0+ (minSdk 24, targetSdk 36)
- **iOS:** iOS target version not yet specified; SwiftUI requires iOS 13+
- **Backend:** Supabase-managed infrastructure (PostgreSQL database, authentication, Edge Functions runtime)

---

*Stack analysis: 2026-07-02*
