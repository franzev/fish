<!-- GSD:project-start source:PROJECT.md -->

## Project

**FISH**

FISH is a ChatHub that teaches English to neurodivergent professionals, many with ADHD. Coaches assign everything; clients are never given menus or choices — the product's whole job is to remove choices, not add them. This milestone builds the monochrome design system and the auth foundation everything else stands on.

**Core Value:** A calm, choice-free experience: the coach assigns, the app presents, and nothing on screen competes for the client's attention.

### Constraints

- **Tech stack**: Next.js App Router + TypeScript + Tailwind v4 (CSS-first) + Supabase — locked by AGENTS.md; web-only, no Express/Node API service
- **Design**: Pure monochrome (black/white/greys), both light and dark themes — user decision, hierarchy before color
- **Iconography**: Tabler Icons (https://tabler.io/icons) — single icon set, consistent stroke style
- **Typography**: Lexend (body/UI — designed for reading fluency, fits the neurodivergent audience) + Fraunces (headings/display serif)
- **Product**: Coach-first, code-second — no learning features without manual coach validation
- **Security**: Signup can only create clients; coach role granted manually; every table gets RLS
- **Package manager**: pnpm only (lockfile is pnpm-lock.yaml)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.7.3 - All shared packages (`packages/core`, `packages/supabase`) and web frontend (`apps/web`)
- JavaScript (ESM) - Configuration files (`.mjs`)
- CSS - Design tokens and utilities (`apps/web/app/globals.css`)

## Runtime

- Node.js (version not explicitly specified; inferred from pnpm 11.7.0 compatibility)
- pnpm 11.7.0 (specified in `package.json` as packageManager)
- Supports: JavaScript/TypeScript execution on Node for development, builds, and Supabase Edge Functions
- pnpm 11.7.0 (with pnpm workspaces)
- Lockfile: `pnpm-lock.yaml` (lockfileVersion 9.0)

## Frameworks

- Next.js 16.2.9 - React app framework with App Router; web frontend in `apps/web`
- React 19.2.7 - Component library and UI framework
- Tailwind CSS 4.3.1 - Utility-first CSS framework (CSS-first config via `@theme` in `globals.css`; no `tailwind.config.js`)
- Not yet detected in codebase (lint and typecheck only via tsc and eslint)
- PostCSS with `@tailwindcss/postcss` 4.3.1 - CSS transformation pipeline (`apps/web/postcss.config.mjs`)
- ESLint 9.39.4 - Code quality linting (`apps/web/eslint.config.mjs`, uses Next.js ESLint config)
- TypeScript compiler (tsc) - Type checking via `typecheck` script

## Key Dependencies

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
- `@fish/core` - Product domain types (roles, chat contracts) - workspace package
- `@fish/supabase` - Supabase auth and database types - workspace package
- TypeScript 5.7.3 - Language and compiler (used across all packages)

## Configuration

- Supabase project ID: `fish` (defined in `supabase/config.toml`)
- Environment variables: Not yet defined in `.env` files (Web app has no `.env*` files present)
- Recommended env vars for Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (standard for client-side Supabase libraries, but not yet integrated)
- `apps/web/next.config.mjs` - Minimal Next.js config (no custom plugins)
- `apps/web/tsconfig.json` - Strict TypeScript with JSX support and path alias `@/*` mapping to `app/` directory
- `apps/web/postcss.config.mjs` - PostCSS with `@tailwindcss/postcss` plugin
- `apps/web/eslint.config.mjs` - ESLint config using Next.js core-web-vitals and TypeScript rulesets

## Platform Requirements

- Node.js 16+ (inferred from pnpm 11.7.0 and Next.js 16 compatibility)
- pnpm 11.7.0+
- TypeScript 5.7.3 (installed globally or via pnpm)
- ESLint for linting
- **Web:** Node.js runtime or static export (Next.js deployment target not explicitly specified; Edge Runtime required for Supabase Edge Functions)
- **Backend:** Supabase-managed infrastructure (PostgreSQL database, authentication, Edge Functions runtime)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Components: lowercase with hyphens (`button.tsx`, `card.tsx`, `input.tsx`)
- Utilities: lowercase with hyphens (`utils.ts`)
- Index files: `index.ts` for barrel exports
- Type definition files: `.ts` extension; types exported inline, not in separate `.d.ts` files (except `next-env.d.ts` auto-generated)
- Named exports: camelCase (`cn`, `Card`, `Progress`, `Button`, `Input`)
- Components exported as named exports (not default exports)
- React components use PascalCase (`Card`, `Button`, `Input`, `Progress`)
- Utility functions use camelCase (`cn`)
- Type guard functions: `isUserRole` (verb-subject pattern)
- Local variables: camelCase (`clamped`, `inputId`, `autoId`)
- Constants (non-exported): camelCase (`jsonHeaders`, `lexend`, `fraunces`)
- Exported constants: camelCase, marked `as const` where appropriate (`userRoles`, `chatLimits`, `authRedirects`)
- Interfaces: PascalCase, prefixed with purpose (`ButtonProps`, `InputProps`, `ProgressProps`, `ChatMessage`, `ChatParticipant`, `SendMessageCommand`)
- Type aliases: PascalCase (`UserRole`, `ConversationId`, `MessageId`, `UserId`, `Variant`)
- Record/discriminated unions: PascalCase (`Record<Variant, string>`)
- Import type syntax: `import type` for types-only imports to ensure tree-shaking

## Code Style

- Tool: ESLint (eslint v9.39.4 with `eslint-config-next` core-web-vitals + typescript)
- No Prettier: ESLint handles style directly
- Automatic formatting is NOT enforced; developers use `eslint` command manually
- Max line length: No explicit limit configured; pragmatic wrapping based on readability
- Config: `apps/web/eslint.config.mjs` (flat config, ESLint v9 style)
- Base configs: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Rules applied: Next.js Web Vitals (performance, accessibility) + TypeScript best practices
- Ignored paths: `.next/**`, `node_modules/**`
- Target: `ES2017` (web), `ES2022` (packages)
- Strict mode: enabled (`"strict": true`)
- Module resolution: `bundler` (web), `Bundler` (packages)
- Path aliases: `@/*` in web app maps to project root for absolute imports
- No `baseUrl` used; rely on path aliases

## Import Organization

- Web app: `@/*` → root of `apps/web/` (e.g., `@/components/ui/button`, `@/lib/utils`)
- Packages use workspace imports: `@fish/core`, `@fish/supabase`, resolved via pnpm workspaces
- Edge Functions: relative imports from shared packages (e.g., `../../../packages/core/src`)

## Error Handling

- Validation errors returned as HTTP responses with status codes (e.g., `400`, `405`)
- Error messages are calm and instructive, never alarming (design rule enforced)
- Error response format: `{ error: "Plain-language guidance" }` (JSON)
- Type narrowing with guards: `isUserRole()` guard function for discriminating type-safe values
- Client-side: HTML5 attributes + prop-based hints (`hint`, `notice` on `Input`)
- Server-side: explicit checks on parsed input before processing (Edge Functions)
- Null/undefined handling: nullish coalescing (`??`) for fallbacks; early returns for invalid cases

## Logging

- Minimal logging in product code (not yet implemented; Supabase Edge Functions do not log)
- Console output used for development debugging only
- No structured logging framework in place

## Comments

- Explain WHY, not WHAT — the code already shows WHAT
- Design decisions and product constraints should be documented
- Non-obvious heuristics and calculations
- Warnings about neurodivergent audience impact (e.g., "most ND screens have one big action")
- Used sparingly; only on public exports and complex props
- Format: `/** Single-line summary. */` for simple cases
- No `@param`, `@returns` tags (types are explicit in code)
- Example from `Button`:
- Prefix with reasoning: "// The ONE action on a screen. Use at most one primary per view."
- Mark variants with context for maintainers

## Function Design

- Utility functions: 1–5 lines (e.g., `cn()`)
- React components: 10–50 lines (small, single responsibility)
- Edge Functions: 30–40 lines (validation + response)
- React components: receive props object (typed interface extending `HTMLAttributes` or similar)
- Utilities: variadic where appropriate (e.g., `cn(...inputs)`)
- Commands/payloads: typed objects (e.g., `SendMessageCommand`)
- React components: JSX element
- Utilities: transformed value (string for `cn`, boolean for type guards)
- Edge Functions: `Response` object with JSON body and status code

## Module Design

- Named exports preferred over default exports (allows tree-shaking, explicit in imports)
- React components: `export const Component = ...` or `export const Component = forwardRef(...)`
- Utilities: `export function utils(...)`
- Index files use barrel pattern: `export * from "./module"`
- `packages/core/src/index.ts`: re-exports `chat` and `roles`
- `packages/supabase/src/index.ts`: re-exports `auth` and `database.types`
- `apps/web/components/ui/`: no index file; imports directly from component file
- Extend HTML element props where appropriate: `ButtonHTMLAttributes<HTMLButtonElement>`, `HTMLAttributes<HTMLDivElement>`
- Add custom props as optional fields with JSDoc
- Use discriminated union patterns for variants: `type Variant = "primary" | "secondary" | "ghost"`

## Accessibility & Inclusive Design Conventions

- `forwardRef` on focusable components (`Button`, `Input`) to allow parent focus management
- `displayName` on forwardRef components for debugging: `Button.displayName = "Button"`
- ARIA attributes where semantic HTML is insufficient: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Visible keyboard focus already set globally in `globals.css`: 3px solid outline on `:focus-visible`
- Respects `prefers-reduced-motion` globally in `globals.css`
- Components integrate design tokens from `globals.css` — no raw hex or magic numbers in component code
- Tailwind classes use `@theme` tokens: `bg-primary`, `text-on-primary`, `rounded-control`
- Merge utility: `cn()` helper prevents Tailwind utility conflicts

## Class Names & Tailwind

- Use `cn()` utility from `@/lib/utils.ts` to merge conditional classes and resolve conflicts
- No raw `className` strings; use Tailwind utilities only
- Responsive design: Tailwind's responsive prefixes (`sm:`, `md:`, etc.) — not yet heavily used in current codebase
- Full-width layouts as default (fits neurodivergent audience, reduces choice)

## Shared Package Contracts

- Pure TypeScript types and constants — no dependencies on Supabase or React
- Shared between web and Edge Functions
- Examples: `UserRole`, `ChatMessage`, `chatLimits`, type guards
- Supabase-specific contracts (auth, database types, redirects)
- Depends on `@fish/core`
- Exported types: `FishAuthClaims`, `authRedirects`

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Web App | Next.js entry point, routing, layouts | `apps/web/app/layout.tsx`, `app/page.tsx` |
| UI Components | Reusable design-system controls (Button, Input, Card, Progress) | `apps/web/components/ui/` |
| Styles | Tailwind v4 CSS-first theme with tokens via @theme | `apps/web/app/globals.css` |
| Design Tokens | Color palette, typography, spacing, radius scales | `apps/web/app/globals.css` (@theme section) |
| Utils | Conditional class merging (cn helper) | `apps/web/lib/utils.ts` |
| Core Types | Shared domain contracts (Chat, Roles, Messages) | `packages/core/src/` |
| Supabase Types | Auth claims, database schemas, auth redirects | `packages/supabase/src/` |
| Edge Functions | Deno-based serverless handlers (send-message validation) | `supabase/functions/send-message/index.ts` |

## Pattern Overview

- **Simplicity by design:** UI removes choices (one primary action per screen); never build what a coach hasn't validated first.
- **Shared contracts:** Product domain (Chat, Roles) lives in `packages/core`; Supabase integration lives in `packages/supabase`.
- **Calm aesthetic:** Dark, spacious layout with one lime accent button; no scores, streaks, or alarming red. Errors guide, never scold.
- **Large tap targets:** 56px minimum control height; readable fonts (Lexend for body, Fraunces for headings).

## Layers

- Purpose: Client-facing UI; renders pages, handles routing, calls API functions.
- Location: `apps/web/app/` (App Router pages), `apps/web/components/` (reusable components)
- Contains: Page components (`*.tsx`), layout wrappers, form controls
- Depends on: React 19, Next.js 16, Tailwind v4, `@fish/core`, `@fish/supabase` (for types + auth redirects)
- Used by: End users (coaches, clients) in browser
- Purpose: Centralized, reusable design-system controls conforming to FISH rules.
- Location: `apps/web/components/ui/` (Button, Input, Card, Progress)
- Contains: ForwardRef-wrapped controls, variants for Button (primary/secondary/ghost), conditional Tailwind classes
- Depends on: `clsx`, `tailwind-merge`, React forwardRef
- Used by: All page components in `apps/web/app/`
- Purpose: CSS-first design system without `tailwind.config.js`. All tokens defined via `@theme` in globals.css.
- Location: `apps/web/app/globals.css` (@theme block, @layer base)
- Contains: Design tokens (colors, fonts, radius, sizing); base resets; accessibility rules (focus, reduced-motion)
- Depends on: Tailwind CSS v4.3.1, @tailwindcss/postcss v4.3.1 (must match version)
- Used by: All components via Tailwind utility classes (e.g., `bg-primary`, `rounded-card`)
- Purpose: Shared TypeScript contracts for product domain (no implementation, only types + validation).
- Location: `packages/core/src/`
- Contains: `roles.ts` (UserRole type), `chat.ts` (ChatConversation, ChatMessage, SendMessageCommand interfaces)
- Depends on: TypeScript only
- Used by: Web (`apps/web`), Supabase package (`packages/supabase`), Edge Functions (`supabase/functions/`)
- Purpose: Supabase-specific contracts (auth claims, database types, redirect paths).
- Location: `packages/supabase/src/`
- Contains: `auth.ts` (FishAuthClaims, authRedirects), `database.types.ts` (generated from DB schema)
- Depends on: `@fish/core` (for UserRole type)
- Used by: Web app for auth redirects; future services for DB queries
- Purpose: Serverless validators and command handlers for sensitive operations (send message, assign client, etc.).
- Location: `supabase/functions/send-message/index.ts`
- Contains: HTTP request handler validating SendMessageCommand against `chatLimits`
- Depends on: Deno runtime, `@fish/core` (chat.ts)
- Used by: Web clients calling `/send-message` Edge Function via Supabase client
- Purpose: Auth (JWT + RLS), database (PostgreSQL), realtime subscriptions, file storage, Edge Function runtime.
- Location: `supabase/` (config.toml) and Supabase Cloud
- Contains: Auth policies, database tables (users, conversations, messages), RLS rules, function configurations
- Depends on: PostgreSQL, Supabase cloud infrastructure
- Used by: Web app via `supabase-js`

## Data Flow

### Primary Request Path (Web → Edge Function)

### Data Sources & State Management

- **Auth state:** Supabase JWT in localStorage, decoded in `packages/supabase/src/auth.ts` to extract `FishAuthClaims` (sub, role)
- **Conversations:** Fetched via Supabase RLS-protected SELECT (future: endpoint not yet built)
- **Messages:** Fetched from `messages` table (RLS ensures clients see only own conversations); realtime subscription for incoming messages (future: not yet built)
- **User profile:** Pulled from `users` table after auth (role: client or coach)
- No Redux/Zustand yet; foundation-first phase uses React 19 state (useState, useContext)
- Future: may add React Query/SWR for server state once patterns stabilize
- Optimistic updates for chat messages (insert to local state, await server acknowledgement)

## Key Abstractions

- Purpose: Represents participant type (client or coach); determines which UI screens are shown.
- Examples: `packages/core/src/roles.ts`, `packages/supabase/src/auth.ts`
- Pattern: Branded type union + type guard (`isUserRole()`); used in auth claims and message routing
- Purpose: Represents a 1-on-1 conversation between one client and one coach.
- Examples: `packages/core/src/chat.ts` (ChatConversation interface)
- Pattern: Immutable DTO; createdAt/updatedAt for audit; clientId + coachId for explicit intent (coach always initiates, clients never choose)
- Purpose: Represents a single message in a conversation; includes sender role for permission checks.
- Examples: `packages/core/src/chat.ts`
- Pattern: Immutable; conversationId + senderId for routing; senderRole cached to avoid join on read
- Purpose: Input contract for sending a message; keeps UI decoupled from server implementation.
- Examples: `packages/core/src/chat.ts`, `supabase/functions/send-message/index.ts`
- Pattern: Validation happens in Edge Function against chatLimits (4000 char max); client-side validation in form onSubmit (future)
- Purpose: JWT payload shape after Supabase auth; minimal: sub (user ID) + role (client|coach).
- Examples: `packages/supabase/src/auth.ts`
- Pattern: Decoded from JWT in auth middleware; passed to RLS policies for data filtering

## Entry Points

- Location: `apps/web/app/layout.tsx` (Root layout)
- Triggers: Browser load of https://fish.app/ (or dev: http://localhost:3000)
- Responsibilities: Font loading (Lexend + Fraunces), metadata, child routing via App Router, globals.css injection
- Location: `apps/web/app/page.tsx`
- Triggers: GET `/`
- Responsibilities: Displays design tokens, component showcase (Button, Input, Card, Progress variants)
- Location: `apps/web/app/chat/page.tsx` (not yet built)
- Triggers: Redirect from auth on client login; manual nav to `/chat`
- Responsibilities: Fetch conversations, display chat list, open 1-on-1 conversation view, render message feed, invoke send-message function
- Location: `apps/web/app/coach/page.tsx` (not yet built)
- Triggers: Redirect from auth on coach login; manual nav to `/coach`
- Responsibilities: Show assigned clients, client profiles, conversation list, 1-on-1 chat
- Location: `supabase/functions/send-message/index.ts`
- Triggers: Supabase client POST to `/send-message` with JWT header
- Responsibilities: Validate SendMessageCommand, return 400 or acknowledgement, future: insert + broadcast

## Architectural Constraints

- **Threading:** Single-threaded JavaScript (Next.js server-side rendering may use Node worker threads internally, but user code is single-threaded via event loop). Edge Functions (Deno) are also event-loop based.
- **Global state:** Minimal; Supabase client is typically a singleton per app instance. Design tokens are CSS custom properties (no JS mutation). React state is component-scoped (future: may centralize with Context or Zustand if needed).
- **Circular imports:** Not detected in current codebase; all packages export cleanly. `@fish/supabase` depends on `@fish/core` (one-way).
- **No tailwind.config.js:** Tailwind v4 is CSS-first; all config lives in `@theme` block in `apps/web/app/globals.css`. Creating `tailwind.config.js` will break the build.
- **Monorepo dependency resolution:** pnpm workspace defines all packages in workspace.yaml; import paths use package names (e.g., `import { ChatMessage } from "@fish/core"`).

## Anti-Patterns

### Multi-choice UI (Plan picker, template gallery, learner profiles)

### Gamification with Streaks

### Shared State without Types

### Styling with Raw Hex

### ForwardRef Without DisplayName

## Error Handling

- **Validation errors (client-side):** Display alongside the field (notice state in Input component; see `apps/web/components/ui/input.tsx` prop `notice`).
- **API errors (Edge Function):** Return 400 with plain-language message (e.g., "This message is a little long. Try sending it in two parts." from `supabase/functions/send-message/index.ts`). Never say "Invalid input" or "400 Bad Request."
- **Auth errors:** Redirect to signin page (via authRedirects in `packages/supabase/src/auth.ts`).
- **Network errors (future):** Show a "Connection lost" state with retry button; no harsh language.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
