# Coding Conventions

**Analysis Date:** 2026-07-02

## Naming Patterns

**Files:**
- Components: lowercase with hyphens (`button.tsx`, `card.tsx`, `input.tsx`)
- Utilities: lowercase with hyphens (`utils.ts`)
- Index files: `index.ts` for barrel exports
- Type definition files: `.ts` extension; types exported inline, not in separate `.d.ts` files (except `next-env.d.ts` auto-generated)

**Functions:**
- Named exports: camelCase (`cn`, `Card`, `Progress`, `Button`, `Input`)
- Components exported as named exports (not default exports)
- React components use PascalCase (`Card`, `Button`, `Input`, `Progress`)
- React hooks use `use*` named exports and live near the route/component they coordinate when the state is route-specific
- Utility functions use camelCase (`cn`)
- Type guard functions: `isUserRole` (verb-subject pattern)

**Variables:**
- Local variables: camelCase (`clamped`, `inputId`, `autoId`)
- Constants (non-exported): camelCase (`jsonHeaders`, `lexend`, `fraunces`)
- Exported constants: camelCase, marked `as const` where appropriate (`userRoles`, `chatLimits`, `authRedirects`)

**Types:**
- Interfaces: PascalCase, prefixed with purpose (`ButtonProps`, `InputProps`, `ProgressProps`, `ChatMessage`, `ChatParticipant`, `SendMessageCommand`)
- Type aliases: PascalCase (`UserRole`, `ConversationId`, `MessageId`, `UserId`, `Variant`)
- Record/discriminated unions: PascalCase (`Record<Variant, string>`)
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

## Error Handling

**Patterns:**
- Validation errors returned as HTTP responses with status codes (e.g., `400`, `405`)
- Error messages are calm and instructive, never alarming (design rule enforced)
- Error response format: `{ error: "Plain-language guidance" }` (JSON)
- Type narrowing with guards: `isUserRole()` guard function for discriminating type-safe values

**Input Validation:**
- Client-side: HTML5 attributes + prop-based hints (`hint`, `notice` on `Input`)
- Server-side: explicit checks on parsed input before processing (Edge Functions)
- Null/undefined handling: nullish coalescing (`??`) for fallbacks; early returns for invalid cases

## Logging

**Framework:** Native `console` object in browser; Deno's `Deno` module in Edge Functions

**Patterns:**
- Minimal logging in product code (not yet implemented; Supabase Edge Functions do not log)
- Console output used for development debugging only
- No structured logging framework in place

## Comments

**When to Comment:**
- Explain WHY, not WHAT — the code already shows WHAT
- Design decisions and product constraints should be documented
- Non-obvious heuristics and calculations
- Warnings about neurodivergent audience impact (e.g., "most ND screens have one big action")

**JSDoc/TSDoc:**
- Used sparingly; only on public exports and complex props
- Format: `/** Single-line summary. */` for simple cases
- No `@param`, `@returns` tags (types are explicit in code)
- Example from `Button`:
  ```typescript
  /** Full-width is the default — most ND screens have one big action. */
  fullWidth?: boolean;
  ```

**Inline Comments:**
- Prefix with reasoning: "// The ONE action on a screen. Use at most one primary per view."
- Mark variants with context for maintainers

## Function Design

**Size:** 
- Utility functions: 1–5 lines (e.g., `cn()`)
- React components: 10–50 lines (small, single responsibility)
- Edge Functions: 30–40 lines (validation + response)

**Parameters:**
- React components: receive props object (typed interface extending `HTMLAttributes` or similar)
- Utilities: variadic where appropriate (e.g., `cn(...inputs)`)
- Commands/payloads: typed objects (e.g., `SendMessageCommand`)

**Return Values:**
- React components: JSX element
- Utilities: transformed value (string for `cn`, boolean for type guards)
- Edge Functions: `Response` object with JSON body and status code

## Module Design

**Exports:**
- Named exports preferred over default exports (allows tree-shaking, explicit in imports)
- React components: `export const Component = ...` or `export const Component = forwardRef(...)`
- Route-local hooks: `export function useFeatureName(...)`; pass server actions and realtime callbacks in as dependencies when the hook coordinates command behavior
- Utilities: `export function utils(...)`
- Index files use barrel pattern: `export * from "./module"`

**Barrel Files:**
- `packages/core/src/index.ts`: re-exports `chat` and `roles`
- `packages/supabase/src/index.ts`: re-exports `auth` and `database.types`
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
- Examples: `UserRole`, `ChatMessage`, `chatLimits`, type guards

**`packages/supabase`:**
- Supabase-specific contracts (auth, database types, redirects)
- Depends on `@fish/core`
- Exported types: `FishAuthClaims`, `authRedirects`

---

*Convention analysis: 2026-07-02*
