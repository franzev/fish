---
last_mapped_commit: e25c937627b8f19251c791ed6878e6522f802959
---

# Coding Conventions

**Analysis date:** 2026-07-11

## Sources of Truth

- Repository-specific rules live in `AGENTS.md`; they override generic framework conventions.
- Product and dependency direction are documented in `docs/ARCHITECTURE.md`.
- UI work must also follow `docs/ui-ux-agent-guidelines.md` and the design tokens in `apps/web/app/globals.css`.
- Executable architecture rules live in `apps/web/tests/module-boundaries.test.ts`, `apps/web/tests/nextjs-boundaries.test.ts`, and `apps/web/tests/service-boundary.test.ts`.
- The repository is a pnpm workspace. Use the root scripts and `pnpm-lock.yaml`; do not introduce npm lockfiles.

## Naming and File Layout

- TypeScript implementation files and directories use lowercase kebab-case, for example `apps/web/lib/prefs/time-format.ts` and `apps/web/features/chat/model/message-grouping.ts`.
- Functions and local values use camelCase. Types, interfaces, classes, and React components use PascalCase without an `I` prefix.
- Interfaces describe capabilities or repositories (`AuthService`, `ChatCommandService`, `ProfileRepository`); concrete provider adapters carry a provider name (`SupabaseChatCommandService`, `SupabaseProfileRepository`).
- Reusable React components are named exports. Next.js special files (`page.tsx`, `layout.tsx`, and `route.ts`) use framework-required default exports where applicable.
- Every component implementation lives in a same-named folder: `components/component-name/component-name.tsx` or route-private `_components/component-name/component-name.tsx`.
- Component tests and stories are colocated in that folder, and every component folder has an `index.ts` entry point.
- Next.js route filenames retain framework names; route groups and dynamic segments use App Router syntax such as `apps/web/app/(authenticated)/channels/[id]/page.tsx`.
- Unit and component tests use `*.test.ts` or `*.test.tsx`; browser tests use `*.spec.ts` under `apps/web/e2e/`; stories use `*.stories.tsx`.

## TypeScript and Formatting

- The established format is two-space indentation, double quotes, semicolons, and trailing commas in multiline constructs.
- Prefer `const`, `async`/`await`, early returns, and parameter objects for operations with related inputs.
- `apps/web/tsconfig.json` enables `strict`, `isolatedModules`, bundler resolution, and `noEmit`; avoid weakening these checks with broad assertions or `any`.
- Use `import type` or inline `type` modifiers for type-only dependencies.
- Prefer discriminated unions and literal unions over enums. Examples include `ServiceResult<T>` in `apps/web/lib/services/errors.ts` and chat-state events in `packages/core/src/chat-state/types.ts`.
- Exported boundary functions commonly state return types; private React helpers may rely on inference when the type remains obvious.
- There is no Prettier configuration or format script. Match the surrounding source, then use ESLint, TypeScript, and `git diff --check` as executable checks.

## Imports and Public APIs

- `@/*` resolves from `apps/web/`; workspace packages use `@fish/core` and `@fish/supabase` exports.
- Use relative imports within a cohesive feature or component folder and public aliases/package exports across architectural boundaries.
- External imports generally precede workspace/alias imports, followed by relative imports; small modules do not enforce blank-line groups mechanically.
- Barrels that expose a module's complete public surface use `export * from "..."` (or `export type *`). Explicit re-exports are reserved for intentional API subsets, boundary shielding, renames, or collisions.
- Client-safe feature barrels must not pull in server entry points. Server modules use `server-only`; browser composition uses `client-only`.
- Do not import provider APIs from application code. Direct `@supabase/*`, `@fish/supabase`, and provider types are confined to `apps/web/lib/services/supabase/` and the runtime composition roots.

## Architecture and Dependency Injection

- Business-facing ports and DTOs are owned by the application in `apps/web/lib/services/contracts.ts`; provider-neutral failure types live in `apps/web/lib/services/errors.ts`.
- Concrete Supabase adapters live under `apps/web/lib/services/supabase/` and map database snake_case rows to application camelCase objects before returning them.
- Runtime composition is isolated in `apps/web/lib/services/runtime/server.ts` and `apps/web/lib/services/runtime/browser.ts`.
- Use-case factories accept narrow interfaces instead of constructing infrastructure. Examples are `createChatActionHandlers` in `apps/web/features/chat/server/action-handlers.ts` and `createProfileActionHandlers` in `apps/web/features/profile/server/action-handlers.ts`.
- Next.js Server Action modules are thin entry adapters: resolve production services, construct handlers, and forward input/output.
- Pure shared product rules and cross-runtime chat state belong in `packages/core/`; Supabase database/auth contracts belong in `packages/supabase/`.
- Simple authorized reads may use Supabase through repositories and RLS. Command writes and sensitive behavior use Supabase Edge Functions rather than a separate Express API.

## React, Next.js, and UI

- Server Components are the default. Add `"use client"` only for hooks, browser APIs, state, or interactions; add `"use server"` to Server Action entry modules.
- Focusable shared controls use `forwardRef` and preserve visible keyboard focus behavior.
- Reuse primitives from `apps/web/components/ui/` and combine conditional classes with `cn()` from `apps/web/lib/utils.ts`.
- Tailwind is v4 and CSS-first. Do not add `tailwind.config.js`; keep `tailwindcss` and `@tailwindcss/postcss` on matching versions.
- Use semantic colors and named spacing utilities from `apps/web/app/globals.css`; raw hex values, arbitrary visual values, and numeric spacing utilities are forbidden by source-scanning tests.
- Each screen has at most one primary action, controls remain at least 56px high, and copy uses calm guidance rather than alarming or scolding language.
- Respect visible focus and `prefers-reduced-motion`; progress is visual rather than a grade, and gamification never punishes a return after a gap.

## Validation and Error Handling

- Validate untrusted form and action inputs with Zod at the application boundary. Chat schemas use strict objects in `apps/web/features/chat/server/schemas.ts`; profile validation is in `apps/web/features/profile/validation.ts`.
- Expected service outcomes use `ServiceResult<T>`: `{ ok: true, data }` or `{ ok: false, error }`.
- Infrastructure adapters translate provider failures through `mapInfrastructureError`, `normalizeServiceError`, and `ServiceError`; provider error shapes do not cross into features.
- Chat commands expose the behavior-specific `ChatOperationResult<T>` and calm notices instead of HTTP `Response` objects, bearer tokens, function names, or database rows.
- Throw for broken invariants, invalid configuration, or unrecoverable loader conditions. Return typed result/status objects for expected authentication, validation, network, and persistence failures.
- Preserve user input on action failure and use sentence-case recovery copy, as demonstrated by `apps/web/features/profile/server/action-handlers.ts` and `apps/web/features/chat/server/action-handlers.ts`.
- Use early authentication and validation guards so rejected input cannot cross repository or command seams.

## Logging and Comments

- Production web modules generally avoid console logging; no shared logging framework is installed.
- Supabase Edge Functions and verification scripts use `console.error`/`console.log` at operational boundaries and include enough context to identify the failed operation.
- Never log access tokens, passwords, private message bodies, or sensitive profile fields.
- Comments document reasons, security assumptions, framework behavior, or regression constraints rather than restating syntax.
- Update nearby architecture or protocol documentation when a change alters a boundary described in `docs/ARCHITECTURE.md` or `packages/core/docs/chat-state-protocol.md`.

## Required Verification

- Run `pnpm lint` and `pnpm typecheck` for static checks.
- Run `pnpm --filter @fish/web test run` for the Vitest suite.
- Run `pnpm build` before every commit, as required by `AGENTS.md`.
- For component structure changes, specifically verify `apps/web/tests/module-boundaries.test.ts` reports no loose component implementations and no missing `index.ts` files.
- Database, realtime, or persisted-chat changes also require the targeted verification commands documented in `.planning/codebase/TESTING.md`.

---

*Convention map refreshed 2026-07-11 at `e25c937627b8f19251c791ed6878e6522f802959`.*
