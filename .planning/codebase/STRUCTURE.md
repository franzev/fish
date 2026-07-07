# Codebase Structure

**Analysis Date:** 2026-07-02

## Directory Layout

```
fish/                              # Monorepo root (pnpm workspaces)
├── apps/
│   ├── web/                        # Next.js web app (primary delivery surface)
│   │   ├── app/                    # App Router pages & layout
│   │   │   ├── layout.tsx          # Root layout (fonts, metadata)
│   │   │   ├── page.tsx            # Home / design system showcase
│   │   │   ├── globals.css         # Tailwind v4 CSS-first theme (@theme, @layer)
│   │   │   ├── (authenticated)/     # Protected app surfaces
│   │   │   │   └── chat/            # One assigned-conversation route
│   │   │   │       ├── chat-client.tsx  # Rendering shell for chat UI
│   │   │   │       └── hooks/       # Focused local-state chat hooks
│   │   │   └── [future pages]      # Additional routes as validated
│   │   ├── components/
│   │   │   └── ui/                 # Design-system controls
│   │   │       ├── button.tsx      # Button (primary/secondary/ghost variants)
│   │   │       ├── input.tsx       # Input (label, hint, notice states)
│   │   │       ├── card.tsx        # Card (container) + Progress (visual fill)
│   │   │       └── [future]        # Modal, Textarea, Select, etc. (as needed)
│   │   ├── lib/
│   │   │   └── utils.ts            # cn() helper (clsx + tailwind-merge)
│   │   ├── public/                 # Static assets (logo.svg, favicon, etc.)
│   │   ├── package.json            # @fish/web dependencies
│   │   ├── tsconfig.json           # TypeScript config (paths: @/* → ./*))
│   │   ├── next.config.mjs         # Next.js config (empty; no overrides)
│   │   └── eslint.config.mjs       # ESLint rules
│   │
│   ├── ios/                        # SwiftUI app (native, not yet scaffolded)
│   │   └── [placeholder]
│   │
│   └── android/                    # Kotlin + Jetpack Compose (native)
│       ├── app/src/
│       │   ├── main/
│       │   │   └── java/space/fishhub/app/  # App entry point
│       │   ├── test/
│       │   └── androidTest/
│       └── build.gradle            # Gradle config
│
├── packages/
│   ├── core/                       # Shared domain contracts (no impl, types only)
│   │   ├── src/
│   │   │   ├── index.ts            # Barrel export (re-exports roles, chat)
│   │   │   ├── roles.ts            # UserRole type + isUserRole() guard
│   │   │   └── chat.ts             # Chat domain types (Conversation, Message, Command)
│   │   ├── package.json            # @fish/core (no dependencies)
│   │   └── tsconfig.json           # TypeScript (strict mode)
│   │
│   └── supabase/                   # Supabase integration layer
│       ├── src/
│       │   ├── index.ts            # Barrel export
│       │   ├── auth.ts             # FishAuthClaims, authRedirects
│       │   └── database.types.ts   # Generated from Supabase schema (future)
│       ├── package.json            # @fish/supabase (depends on @fish/core)
│       └── tsconfig.json
│
├── supabase/                       # Backend config & Edge Functions
│   ├── config.toml                 # Supabase project config (project_id, functions)
│   └── functions/
│       └── send-message/
│           └── index.ts            # Deno Edge Function (validates SendMessageCommand)
│
├── .planning/
│   └── codebase/                   # Architecture & structure docs (this output)
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
│
├── .git/                           # Git history
├── .gitignore                      # Files to ignore (node_modules, .env*, etc.)
├── package.json                    # Workspace root (pnpm scripts: dev, build, lint, typecheck)
├── pnpm-workspace.yaml             # Workspace definition (apps/*, packages/*)
├── pnpm-lock.yaml                  # Dependency lockfile
├── AGENTS.md                       # Product rules, stack, conventions, build order
├── CLAUDE.md                       # References AGENTS.md (user instructions)
└── README.md                       # High-level project overview
```

## Directory Purposes

**fish/ (Monorepo Root):**
- Purpose: Container for all apps and shared packages; defines workspace via pnpm.
- Contains: Workspace config, shared scripts, root tsconfig.
- Key files: `package.json` (dev: next, typescript), `pnpm-workspace.yaml` (defines apps/*, packages/*), `AGENTS.md` (product rules).

**apps/ (Applications):**
- Purpose: End-user applications (web, iOS, Android).
- Contains: Web (Next.js), iOS (SwiftUI placeholder), Android (Kotlin + Compose).

**apps/web/ (Web App):**
- Purpose: Primary client interface (coaches, clients).
- Contains: Next.js App Router pages, React components, design system, Tailwind config.
- Key files:
  - `app/layout.tsx` — Root layout; loads fonts (Lexend, Fraunces), sets metadata.
  - `app/page.tsx` — Home; design system showcase.
  - `app/globals.css` — Tailwind v4 CSS-first theme; all design tokens via `@theme`.
  - `components/ui/` — Reusable controls (Button, Input, Card, Progress).
  - `lib/utils.ts` — cn() helper (clsx + tailwind-merge).
  - `tsconfig.json` — Path alias `@/*` → `./*` (local root-relative imports).

**apps/web/app/ (Next.js App Router Pages):**
- Purpose: Route handlers and page components.
- Contains: `layout.tsx` (root wrapper), `page.tsx` (home), authenticated route groups, `chat/page.tsx`, `coach/page.tsx`, and validated future routes.
- Naming: kebab-case folders for routes (e.g., `/chat` → `chat/page.tsx`); `layout.tsx` applies to folder and children.
- Pattern: Complex route clients may keep route-local hooks in `hooks/`; for chat these are `use-chat-messages`, `use-chat-read-state`, `use-chat-realtime`, `use-chat-presence`, and `use-chat-composer`.

**apps/web/components/ui/ (Design System):**
- Purpose: Centralized, reusable UI controls conforming to FISH rules.
- Contains: Button, Input, Card, Progress (future: Modal, Textarea, Select, Avatar).
- Pattern: ForwardRef-wrapped, Tailwind-styled, no hardcoded colors (use design tokens).

**packages/ (Shared Libraries):**
- Purpose: Code reused across apps.
- Contains: `core` (domain types), `supabase` (backend integration).

**packages/core/ (Domain Contracts):**
- Purpose: Shared product types (no implementation); used by all apps + Edge Functions.
- Contains: `roles.ts` (UserRole), `chat.ts` (ChatConversation, ChatMessage, SendMessageCommand).
- Pattern: TypeScript interfaces + type guards; immutable; no side effects.

**packages/supabase/ (Supabase Integration):**
- Purpose: Supabase-specific types and auth config.
- Contains: `auth.ts` (FishAuthClaims, authRedirects), `database.types.ts` (generated DB schema).
- Dependency: Depends on `@fish/core` (for UserRole).

**supabase/ (Backend):**
- Purpose: Backend config, database schema, Edge Functions, RLS policies.
- Contains: `config.toml` (project settings), `functions/` (Deno Edge Functions).
- Key files:
  - `config.toml` — Project ID, function configs (e.g., `[functions.send-message]` with `verify_jwt = true`).
  - `functions/send-message/index.ts` — Validates SendMessageCommand; returns 400 or acknowledgement.

**.planning/codebase/ (Architecture Docs):**
- Purpose: Consumed by `/gsd:plan-phase` and `/gsd:execute-phase` to guide new work.
- Contains: ARCHITECTURE.md (patterns, layers, data flow), STRUCTURE.md (this file; directory guide).

## Key File Locations

**Entry Points:**
- `apps/web/app/layout.tsx` — Next.js root layout; fonts, metadata, routes.
- `apps/web/app/page.tsx` — Home page (GET `/`); design system showcase.

**Configuration:**
- `apps/web/app/globals.css` — Tailwind v4 CSS-first theme (@theme, @layer, design tokens).
- `apps/web/tsconfig.json` — TypeScript config (strict, path aliases).
- `apps/web/next.config.mjs` — Next.js config (empty; no overrides).
- `packages/core/src/index.ts` — Core package exports.
- `supabase/config.toml` — Supabase project settings.

**Core Logic:**
- `packages/core/src/roles.ts` — UserRole type + validation.
- `packages/core/src/chat.ts` — Chat domain (Conversation, Message, Command).
- `packages/supabase/src/auth.ts` — Auth claims, redirect paths.
- `supabase/functions/send-message/index.ts` — Message validation + Edge Function.

**Design System:**
- `apps/web/components/ui/button.tsx` — Button control (primary/secondary/ghost).
- `apps/web/components/ui/input.tsx` — Input control (label, hint, notice).
- `apps/web/components/ui/card.tsx` — Card container + Progress bar.
- `apps/web/lib/utils.ts` — cn() utility (class name merging).

**Testing:**
- `apps/web/` — Jest config (future; not yet added).
- `packages/core/` — Unit tests for type guards (future).
- `apps/android/app/src/test/java/space/fishhub/app/` — Android test stubs.

## Naming Conventions

**Files:**
- **Pages:** kebab-case, e.g., `chat.tsx`, `coach-dashboard.tsx`, `client-onboarding.tsx`.
- **Components:** PascalCase, e.g., `Button.tsx`, `Input.tsx`, `ChatMessage.tsx`.
- **Utilities:** camelCase, e.g., `utils.ts`, `helpers.ts`, `validators.ts`.
- **Types:** PascalCase (interface/type name), exported from barrel or dedicated file, e.g., `chat.ts`, `auth.ts`.
- **Tests:** `*.test.ts` or `*.spec.ts`, co-located with source or in `__tests__/` folder.

**Functions:**
- **Components:** PascalCase, e.g., `export function Button(props) { }`, `export const Card = ({ ... }) => { }`.
- **Utilities:** camelCase, e.g., `export function cn(...inputs)`, `export function isUserRole(value)`.
- **Type guards:** camelCase `is*`, e.g., `isUserRole()`.

**Variables:**
- **Constants:** UPPER_SNAKE_CASE (e.g., `chatLimits`, `authRedirects`), e.g., `const chatLimits = { messageBodyMaxLength: 4000 }`.
- **let/const:** camelCase, e.g., `const userName = "Alice"`.
- **React state:** camelCase, e.g., `const [isOpen, setIsOpen] = useState(false)`.

**Types:**
- **Interfaces:** PascalCase, e.g., `interface ChatMessage`, `interface FishAuthClaims`.
- **Type aliases:** PascalCase, e.g., `type UserRole = "client" | "coach"`.
- **Branded types:** camelCase suffix, e.g., `type ConversationId = string` (semantic, not nominal, but named clearly).

## Where to Add New Code

**New Feature (e.g., Client Tracker, Coach Client List):**
- **Primary code:** `apps/web/app/[route]/page.tsx` (new page component).
- **Tests:** `apps/web/__tests__/[route].test.tsx` or co-located `[route].test.tsx`.
- **Types:** Add to `packages/core/src/[domain].ts` (e.g., `tracker.ts` for tracker types).
- **Supabase queries:** Call `supabase.from('table').select()` inline in page (protected by RLS); for complex logic, add Edge Function in `supabase/functions/[name]/index.ts`.

**New Component/Module:**
- **Shared UI control:** `apps/web/components/ui/[name].tsx` (e.g., `modal.tsx`).
- **Page layout component:** `apps/web/components/[name].tsx` (e.g., `chat-header.tsx`).
- **Domain utility:** `packages/core/src/[domain].ts` (e.g., `validation.ts` for shared validators).

**Utilities:**
- **Web-specific helpers:** `apps/web/lib/[name].ts` (e.g., `date-utils.ts`).
- **Shared across apps:** `packages/core/src/[name].ts` (e.g., `formatter.ts`).

**Styling:**
- **New design token:** Add to `@theme { }` block in `apps/web/app/globals.css`, e.g., `--color-new: oklch(...);`.
- **New component variant:** Extend component file, e.g., add `tertiary` variant to `Button` in `apps/web/components/ui/button.tsx`.
- **No `tailwind.config.js`:** Tailwind v4 is CSS-first; keep config in globals.css.

**Supabase Schema & Edge Functions:**
- **New table/policy:** Edit via Supabase Studio or migration files (stored in `supabase/migrations/` if using CLI; not yet scaffolded).
- **New Edge Function:** Create folder `supabase/functions/[name]/index.ts` with Deno entry point; import `@fish/core` types.
- **Edge Function config:** Add `[functions.[name]]` section to `supabase/config.toml`, e.g., `verify_jwt = true` for auth.

## Special Directories

**apps/web/.next/ (Generated):**
- Purpose: Next.js build output; generated at build time.
- Generated: Yes (by `next build`).
- Committed: No (in .gitignore).
- Contains: Compiled routes, static assets, server chunks, type definitions.

**apps/web/node_modules/ & Root node_modules/ (Dependencies):**
- Purpose: Installed packages.
- Generated: Yes (by `pnpm install`).
- Committed: No (in .gitignore).

**packages/core/src/ & packages/supabase/src/ (Shared Code):**
- Purpose: Reusable domain contracts and integrations.
- Generated: No (hand-written TypeScript).
- Committed: Yes.

**supabase/functions/ (Edge Functions):**
- Purpose: Deno-based serverless functions deployed to Supabase.
- Generated: No (hand-written Deno/TypeScript).
- Committed: Yes.
- Deploy: Automatic on `supabase deploy` (requires Supabase CLI).

---

*Structure analysis: 2026-07-02*
