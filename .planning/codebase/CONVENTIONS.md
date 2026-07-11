---
last_mapped_commit: ffc0af5c4a67160e838b07ffa6e26652f9ca337d
---

# Coding Conventions

**Analysis Date:** 2026-07-11

## Naming Patterns

**Files:**
- Components: lowercase with hyphens (`button.tsx`, `card.tsx`, `input.tsx`)
- Utilities: lowercase with hyphens (`utils.ts`)
- Index files: `index.ts` for barrel exports
- Type definition files: `.ts` extension; types exported inline, not in separate `.d.ts` files (except `next-env.d.ts` auto-generated)
- Edge Functions: `index.ts` in handler directory (e.g., `supabase/functions/send-message/index.ts`)

**Functions:**
- Named exports: camelCase (`cn`, `Card`, `Progress`, `Button`, `Input`)
- Components exported as named exports (not default exports)
- React components use PascalCase (`Card`, `Button`, `Input`, `Progress`)
- React hooks use `use*` named exports and live near the route/component they coordinate when the state is route-specific
- Utility functions use camelCase (`cn`)
- Type guard functions: `isUserRole` (verb-subject pattern)
- Helper functions in Edge Functions: camelCase (`calmError`, `readJson`, `rpc`, `getCaller`)

**Variables:**
- Local variables: camelCase (`clamped`, `inputId`, `autoId`, `incoming`, `existing`)
- Constants (non-exported): camelCase (`jsonHeaders`, `lexend`, `fraunces`, `chatLimits`)
- Exported constants: camelCase, marked `as const` where appropriate (`userRoles`, `chatLimits`, `authRedirects`)

**Types:**
- Interfaces: PascalCase, prefixed with purpose (`ButtonProps`, `InputProps`, `ProgressProps`, `ChatMessage`, `ChatParticipant`, `SendMessageCommand`)
- Type aliases: PascalCase (`UserRole`, `ConversationId`, `MessageId`, `UserId`, `Variant`)
- Record/discriminated unions: PascalCase (`Record<Variant, string>`)
- Discriminated union types: `ChatEvent` union with `type` field for discrimination
- Import type syntax: `import type` for types-only imports to ensure tree-shaking

## Code Style

**Formatting:**
- Tool: ESLint (eslint v9.39.4 with `eslint-config-next` core-web-vitals + typescript)
- No Prettier: ESLint handles style directly
- Automatic formatting is NOT enforced; developers use `eslint` command manually
- Max line length: No explicit limit configured; pragmatic wrapping based on readability

**Linting:**
- Config: `apps/web/eslint.config.mjs` (flat config, ESLint v9 style)
- Base configs: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Rules applied: Next.js Web Vitals (performance, accessibility) + TypeScript best practices
- Ignored paths: `.next/**`, `node_modules/**`

**TypeScript:**
- Target: `ES2017` (web), `ES2022` (packages)
- Strict mode: enabled (`"strict": true`)
- Module resolution: `bundler` (web), `Bundler` (packages)
- Path aliases: `@/*` in web app maps to project root for absolute imports
- No `baseUrl` used; rely on path aliases

## Import Organization

**Order:**
1. Built-in Node modules (`fs`, `path`, etc.) — rarely used
2. External packages (`react`, `next`, `clsx`, `tailwind-merge`)
3. Type imports: `import type` for types only
4. Local imports (relative paths or `@/*` aliases)
5. No blank lines between groups (imports are compact)

**Path Aliases:**
- Web app: `@/*` → root of `apps/web/` (e.g., `@/components/ui/button`, `@/lib/utils`)
- Packages use workspace imports: `@fish/core`, `@fish/supabase`, resolved via pnpm workspaces
- Edge Functions: relative imports from shared packages (e.g., `../../../packages/core/src`)

**Export Patterns:**
- Barrel files re-export submodules: `export * from "./module"`
- Examples: `packages/core/src/index.ts` exports `./chat`, `./chat-state`, `./roles`

## Error Handling

**Response Format:**
- JSON responses with `content-type: application/json; charset=utf-8` header
- Error responses: `{ error: "Plain-language message" }` with HTTP status code
- Success responses: `{ message: data }` or domain-specific keys like `{ readState: data }`

**Validation & Error Messages:**
- Errors use plain, calm language — never alarming or technical jargon
- Status codes: 400 (validation), 401 (auth), 403 (permission), 404 (not found), 405 (method), 409 (conflict), 500 (server)
- Examples from `supabase/functions/send-message/index.ts`:
  - `400`: "Add a message before sending." (empty message)
  - `400`: "This message is a little long. Try sending it in two parts." (exceeds 4000 char limit)
  - `405`: "Send messages with a post request." (wrong HTTP method)
  - `401`: "That did not send yet. Keep this open and try again." (auth failure)

**Type Narrowing:**
- Use type guards (`isUserRole()`) to discriminate union types
- Discriminated union pattern for event handling: check `event.type` before accessing type-specific fields
- Example from `packages/core/src/chat-state/reducer.ts`:
  ```typescript
  switch (event.type) {
    case "hydrateConversation": { /* type-specific logic */ }
    case "draftChanged": { /* type-specific logic */ }
  }
  ```

**Input Validation:**
- Client-side: HTML5 attributes + prop-based hints (`hint`, `notice` on `Input`)
- Server-side: explicit checks on parsed input before processing (Edge Functions)
- Null/undefined handling: nullish coalescing (`??`) for fallbacks; early returns for invalid cases
- Example: trim strings and validate presence before processing

## Logging

**Framework:** Native `console` object in browser; Deno's `Deno` module in Edge Functions

**Patterns:**
- Minimal logging in product code (not yet implemented; Supabase Edge Functions do not log)
- Error logging in Edge Functions: `console.error()` with context object, e.g., `{ status, hasSupabaseUrl, hasApiKey }`
- Console output used for development debugging only
- No structured logging framework in place

## Comments

**When to Comment:**
- Explain WHY, not WHAT — the code already shows WHAT
- Design decisions and product constraints should be documented
- Non-obvious heuristics and calculations
- Warnings about neurodivergent audience impact (e.g., "most ND screens have one big action")
- Edge cases in state management logic

**JSDoc/TSDoc:**
- Used sparingly; only on public exports and complex props
- Format: `/** Single-line summary. */` for simple cases
- No `@param`, `@returns` tags (types are explicit in code)
- Multi-line comments explain implementation intent and edge cases
- Example from `packages/core/src/chat-state/types.ts`:
  ```typescript
  /** Display name resolved at fetch time. Command/realtime payloads often
   *  omit it — merges must not let a null overwrite a known name. */
  senderDisplayName?: string | null;
  ```

**Inline Comments:**
- Prefix with reasoning: "// The ONE action on a screen. Use at most one primary per view."
- Mark variants with context for maintainers
- Example from pagination: "// The marker id is set but not present among the currently loaded messages..."

## Function Design

**Size:** 
- Utility functions: 1–5 lines (e.g., `cn()`)
- React components: 10–50 lines (small, single responsibility)
- Edge Functions: 30–50 lines including validation, with helper functions extracted
- Reducer/selector functions: 20–60 lines (complex state logic)

**Parameters:**
- React components: receive props object (typed interface extending `HTMLAttributes` or similar)
- Utilities: variadic where appropriate (e.g., `cn(...inputs)`)
- Commands/payloads: typed objects (e.g., `SendMessageCommand`)
- Helper functions: focused, single purpose (e.g., `calmError(error, status)`)

**Return Values:**
- React components: JSX element
- Utilities: transformed value (string for `cn`, boolean for type guards)
- Edge Functions: `Response` object with JSON body and status code
- Reducer functions: new state object or reference to existing state (avoid mutation)
- Selectors: computed value or filtered data

## Module Design

**Exports:**
- Named exports preferred over default exports (allows tree-shaking, explicit in imports)
- React components: `export const Component = ...` or `export const Component = forwardRef(...)`
- Route-local hooks: `export function useFeatureName(...)`; pass server actions and realtime callbacks in as dependencies when the hook coordinates command behavior
- Utilities: `export function utils(...)`
- Index files use barrel pattern: `export * from "./module"`
- Type exports: `export type` or `export interface`

**Barrel Files:**
- `packages/core/src/index.ts`: re-exports `./chat`, `./chat-state`, `./roles`
- `packages/core/src/chat-state/index.ts`: re-exports `./types`, `./selectors`, `./reducer`
- `packages/supabase/src/index.ts`: re-exports `./auth`, `./database.types`
- `apps/web/components/ui/`: no index file; imports directly from component file

**Component Props:**
- Extend HTML element props where appropriate: `ButtonHTMLAttributes<HTMLButtonElement>`, `HTMLAttributes<HTMLDivElement>`
- Add custom props as optional fields with JSDoc
- Use discriminated union patterns for variants: `type Variant = "primary" | "secondary" | "ghost"`

## Accessibility & Inclusive Design Conventions

**Always included:**
- `forwardRef` on focusable components (`Button`, `Input`) to allow parent focus management
- `displayName` on forwardRef components for debugging: `Button.displayName = "Button"`
- ARIA attributes where semantic HTML is insufficient: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Visible keyboard focus already set globally in `globals.css`: 3px solid outline on `:focus-visible`
- Respects `prefers-reduced-motion` globally in `globals.css`

**Design system:**
- Components integrate design tokens from `globals.css` — no raw hex or magic numbers in component code
- Tailwind classes use `@theme` tokens: `bg-primary`, `text-on-primary`, `rounded-control`
- Merge utility: `cn()` helper prevents Tailwind utility conflicts

## Class Names & Tailwind

**Conventions:**
- Use `cn()` utility from `@/lib/utils.ts` to merge conditional classes and resolve conflicts
- No raw `className` strings; use Tailwind utilities only
- Responsive design: Tailwind's responsive prefixes (`sm:`, `md:`, etc.) — not yet heavily used in current codebase
- Full-width layouts as default (fits neurodivergent audience, reduces choice)

**Example Pattern:**
```typescript
className={cn(
  "inline-flex items-center justify-center rounded-control px-6",
  "min-h-[var(--size-control)] text-[17px] transition-colors",
  "disabled:opacity-50 disabled:pointer-events-none",
  fullWidth && "w-full",
  variants[variant],
  className
)}
```

## Shared Package Contracts

**`packages/core`:**
- Pure TypeScript types and constants — no dependencies on Supabase or React
- Shared between web and Edge Functions
- Examples: `UserRole`, `ChatMessage`, `chatLimits`, `ChatEvent`, type guards, reducer, selectors

**`packages/supabase`:**
- Supabase-specific contracts (auth, database types, redirects)
- Depends on `@fish/core`
- Exported types: `FishAuthClaims`, `authRedirects`

**Chat State as Contract:**
- `packages/core/src/chat-state/` is the platform-neutral contract for local chat state
- Reducer (`reduceChatState`) applies events to state
- Selectors (`mergeChatMessage`, `getOutgoingMessageStatus`, etc.) compute derived values
- Test vectors in `fixtures/chat-state-vectors.json` are executable parity tests for the protocol
- No React, browser APIs, or Supabase client required — enables reuse on native platforms

---

*Convention analysis: 2026-07-11*
