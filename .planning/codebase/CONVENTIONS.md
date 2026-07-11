---
last_mapped_commit: 8db370815b16e6563aae8c1d7e1992697f5fd9d0
---

# Coding Conventions

**Analysis Date:** 2026-07-11

## Naming Patterns

**Files:**
- Use lowercase kebab-case for implementation files: `apps/web/lib/prefs/time-format.ts`, `apps/web/components/chat/message-body/message-body.tsx`.
- Colocate tests with their source as `*.test.ts` or `*.test.tsx`; browser tests are `*.spec.ts` under `apps/web/e2e/`.
- Place component Storybook examples beside components as `*.stories.tsx`.
- Component folders commonly expose a small public surface through `index.ts`, as in `apps/web/components/ui/button/index.ts` and `apps/web/components/chat/avatar/index.ts`.
- Next.js App Router reserved files keep framework names (`page.tsx`, `layout.tsx`, `route.ts`); dynamic route segments use bracket folders such as `apps/web/app/(authenticated)/channels/[id]/page.tsx`.

**Functions and variables:**
- Use camelCase for functions and values (`createSupabaseServices`, `selectMessagesForConversation`, `validInput`).
- Prefix UI event callbacks with `handle` and domain commands with a verb (`handleSubmit`, `sendMessageAction`, `markReadStateAction`).
- Local test doubles describe the dependency and end in `Mock` (`getCurrentUserMock`, `fetchMock`); reusable data builders use nouns or `create*` (`messageRow`, `createChainStub`).
- Constants are usually camelCase at module scope (`baseURL`, `menuItemClass`); uppercase snake case is not the dominant convention.

**Types:**
- Use PascalCase with no `I` prefix for interfaces and type aliases (`ButtonProps`, `ServiceResult`, `ChatStoreState`).
- Prefer string-literal unions and discriminated unions over enums, visible in `apps/web/lib/services/errors.ts` and `packages/core/src/chat-state/types.ts`.
- Use `type` imports where a symbol is type-only (`import type { Metadata } from "next"`); mixed imports use inline `type` modifiers.
- Props interfaces normally remain private to their component unless callers need them.

## Code Style

**Formatting:**
- TypeScript and TSX use two-space indentation, double quotes, semicolons, trailing commas in multiline literals, and parenthesized multiline expressions.
- No Prettier configuration or formatting script is present. Match nearby files and let ESLint/TypeScript be the executable style checks.
- Keep strict typing: `apps/web/tsconfig.json` enables `strict`, `isolatedModules`, `noEmit`, and bundler module resolution.
- Prefer `const`; use explicit return types for exported service/domain functions when they clarify contracts, while React components often rely on inference.

**Linting and verification:**
- `apps/web/eslint.config.mjs` extends Next.js core-web-vitals and TypeScript flat configs.
- Run `pnpm lint` for workspace linting, `pnpm typecheck` for TypeScript, and `pnpm build` before committing as required by `AGENTS.md`.
- The root uses pnpm workspaces (`pnpm-workspace.yaml`, `pnpm-lock.yaml`); do not use npm or create another lockfile.

## Import Organization

- Import external packages, then workspace/path-alias modules, then relative modules. Small files may keep these contiguous rather than forcing blank-line groups.
- `@/*` maps to the `apps/web/` root via `apps/web/tsconfig.json` and is mirrored in `apps/web/vitest.config.ts`.
- Use `@fish/core` for shared product contracts and `@fish/supabase` for backend contracts; avoid duplicating these types in the web app.
- Relative imports are conventional within one feature directory, especially tests and barrels (`./button`, `./chat-selectors`).
- Barrels are used at deliberate component/package boundaries, but internal feature modules also import concrete files when that makes dependencies explicit.

## React and Next.js Patterns

- Prefer named exports for reusable components (`Button`, `Avatar`, `UserMenu`); framework entry points such as `page.tsx` and `layout.tsx` use required default exports.
- Add `"use client"` only for components that need hooks, browser APIs, or event handlers; keep pages/server loaders server-side by default.
- Focusable base controls use `forwardRef`, as demonstrated by `apps/web/components/ui/button/button.tsx` and `apps/web/components/ui/input/input.tsx`, and set `displayName`.
- Compose conditional class names through `cn()` from `apps/web/lib/utils.ts`; reusable visual variants use `class-variance-authority`.
- Reuse primitives in `apps/web/components/ui/` rather than hand-rolling buttons, inputs, cards, alerts, or progress controls.
- Tailwind v4 is CSS-first. Tokens live under `@theme` in `apps/web/app/globals.css`; never add `tailwind.config.js` or raw hexadecimal colors.
- Layout spacing uses named token utilities (`gap-md`, `px-page`, `mt-lg`) rather than one-off numeric utilities. Product-level UI rules are maintained in `docs/ui-ux-agent-guidelines.md` and `AGENTS.md`.

## Error Handling

- Service-layer expected outcomes use `ServiceResult<T>` with `{ ok: true, data }` or `{ ok: false, error }` from `apps/web/lib/services/errors.ts`.
- Normalize infrastructure failures into `ServiceError` subclasses with a stable `code`, operation, recoverability flag, optional details, and original cause.
- Throw for invalid construction/invariants or when a server loader cannot continue; return calm status/notice objects for expected user-facing action failures.
- Catch browser form/action failures at the interaction boundary and translate them to plain, non-scolding copy; avoid exposing provider messages directly.
- Async code predominantly uses `async`/`await` and `try`/`catch`; promise chaining is mainly used to implement thenable test doubles.
- Supabase command writes and sensitive logic stay behind server actions or Edge Functions; TSX service-boundary rules are executable in `apps/web/tests/service-boundary.test.ts`.

## Logging

- There is no shared logging library. Production web modules generally avoid console output.
- Edge Functions use structured `console.error(message, context)` at authentication/configuration boundaries in `supabase/functions/send-message/index.ts` and `supabase/functions/chat-command/index.ts`.
- Developer scripts use `console.log`/`console.error` for progress and final verification summaries, for example `scripts/verify-rls.ts`.
- Never log secrets, access tokens, message bodies, or sensitive profile data; include identifiers and operation context only when diagnostics require them.

## Comments and Documentation

- Comments explain constraints and reasons, not syntax. `apps/web/components/ui/button/button.tsx` records RSC serialization and layout-stability rationale near the affected code.
- Tests often preserve product or architecture intent in comments, including why a specific assertion prevents a regression.
- JSDoc is selective for public abstractions and surprising contracts rather than mandatory for every function.
- No established TODO annotation format is visible; prefer a tracked issue or planning artifact over unowned TODO/FIXME comments.
- Update architecture protocols and product guidance when changing a boundary documented in `docs/ARCHITECTURE.md`, `packages/core/docs/chat-state-protocol.md`, or `docs/ui-ux-agent-guidelines.md`.

## Function and Module Design

- Use early guards for authentication, validation, and no-op states; keep the main success path readable.
- Use parameter objects when a function carries several related inputs, and `Partial<T>` overrides for local test factories.
- Put pure product state and selectors in `packages/core/`; keep Zustand as a web-only adapter and Supabase behind service interfaces.
- Keep browser/server Supabase construction separated in `apps/web/lib/services/supabase/browser.ts` and `apps/web/lib/services/supabase/server.ts`.
- Export package APIs from `packages/core/src/index.ts` and `packages/supabase/src/index.ts`; component subdirectories use narrow `index.ts` barrels.
- Keep UI modules focused, but do not extract helpers solely to satisfy a line-count rule; the repository favors cohesive domain modules with private helpers.

---

*Convention analysis: 2026-07-11*
*Update when patterns change*
