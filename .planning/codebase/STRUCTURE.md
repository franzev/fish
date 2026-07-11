---
last_mapped_commit: ffc0af5c4a67160e838b07ffa6e26652f9ca337d
---
# Codebase Structure

**Analysis Date:** 2026-07-11

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
│   │   │   │       ├── page.tsx     # Chat page (loads chat reducer, renders UI)
│   │   │   │       ├── chat-client.tsx  # Rendering shell for chat UI
│   │   │   │       └── hooks/       # Focused local-state chat hooks
│   │   │   │           ├── use-chat-messages.ts
│   │   │   │           ├── use-chat-read-state.ts
│   │   │   │           ├── use-chat-realtime.ts
│   │   │   │           ├── use-chat-presence.ts
│   │   │   │           └── use-chat-composer.ts
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
│
├── packages/
│   ├── core/                       # Shared domain contracts (no impl, types only)
│   │   ├── src/
│   │   │   ├── index.ts            # Barrel export (re-exports roles, chat, chat-state)
│   │   │   ├── roles.ts            # UserRole type + isUserRole() guard
│   │   │   ├── chat.ts             # Chat domain types (Conversation, Message, Command)
│   │   │   ├── chat-state/         # Portable event-driven state machine (NEW)
│   │   │   │   ├── index.ts        # Barrel export (types, reducer, selectors)
│   │   │   │   ├── types.ts        # ChatState, ChatConversationState, ChatMessageState, ChatEvent (13+ event types)
│   │   │   │   ├── reducer.ts      # reduceChatState(state, event) → next state
│   │   │   │   ├── selectors.ts    # Derived outputs (compare, merge, read status, unread count, snippets)
│   │   │   │   └── fixtures/       # JSON test vectors for cross-platform parity
│   │   │   │       └── chat-state-vectors.json
│   │   │   └── docs/               # Protocol documentation
│   │   │       └── chat-state-protocol.md
│   │   ├── package.json            # @fish/core (no dependencies)
│   │   └── tsconfig.json           # TypeScript (strict mode)
│   │
│   └── supabase/                   # Supabase integration layer
│       ├── src/
│       │   ├── index.ts            # Barrel export
│       │   ├── auth.ts             # FishAuthClaims, authRedirects
│       │   └── database.types.ts   # Generated from Supabase schema
│       ├── package.json            # @fish/supabase (depends on @fish/core)
│       └── tsconfig.json
│
├── supabase/                       # Backend config & Edge Functions
│   ├── config.toml                 # Supabase project config (project_id, functions)
│   └── functions/
│       ├── send-message/
│       │   └── index.ts            # Deno Edge Function (validates SendMessageCommand, calls RPC send_chat_message)
│       └── chat-command/           # Deno Edge Function (edit, delete, react, read-state, refresh)
│           └── index.ts
│
├── .planning/
│   └── codebase/                   # Architecture & structure docs (this output)
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
│
├── .claude/
│   ├── CLAUDE.md                   # Project instructions (references AGENTS.md)
│   └── skills/
│       └── sketch-findings-fish/   # Design system sketches (UI/UX reference)
│           ├── SKILL.md
│           └── references/
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
- Purpose: End-user applications (web).
- Contains: Web (Next.js).

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
- Contains: `layout.tsx` (root wrapper), `page.tsx` (home), authenticated route groups, `(authenticated)/chat/`, `(authenticated)/coach/`, and validated future routes.
- Naming: kebab-case folders for routes (e.g., `/chat` → `chat/page.tsx`); `layout.tsx` applies to folder and children.
- Pattern: Route-local hooks (use-chat-messages, use-chat-read-state, use-chat-realtime, use-chat-presence, use-chat-composer) live in route `hooks/` subdirectory; dispatch chat-state events on user actions.

**apps/web/app/(authenticated)/chat/ (Chat Page):**
- Purpose: 1-on-1 chat between client and coach.
- Contains:
  - `page.tsx` — Route entry point (fetches initial conversation, initializes chat-state reducer)
  - `chat-client.tsx` — React component shell (renders message list, composer, calls Edge Functions on user actions)
  - `hooks/` — Chat-specific hooks wrapping chat-state reducer events
- Lifecycle: Initialize chat-state reducer from server fetch → subscribe to realtime (future) → dispatch events on user actions → selector outputs feed UI

**apps/web/components/ui/ (Design System):**
- Purpose: Centralized, reusable UI controls conforming to FISH rules.
- Contains: Button, Input, Card, Progress (future: Modal, Textarea, Select, Avatar).
- Pattern: ForwardRef-wrapped, Tailwind-styled, no hardcoded colors (use design tokens).

**packages/ (Shared Libraries):**
- Purpose: Code reused across apps.
- Contains: `core` (domain types), `supabase` (backend integration).

**packages/core/ (Domain Contracts):**
- Purpose: Shared product types (no implementation); used by all apps + Edge Functions.
- Contains:
  - `roles.ts` — UserRole type + isUserRole() guard
  - `chat.ts` — ChatConversation, ChatMessage, SendMessageCommand, SendMessageResult, chatLimits
  - `chat-state/` — Event-driven state machine (portable across web/iOS/Android)
- Pattern: TypeScript interfaces + type guards; immutable; no side effects.

**packages/core/src/chat-state/ (Portable Chat State Machine):**
- Purpose: Platform-neutral event-reducer-selector contract for chat state; reusable by web (Zustand), iOS (Swift), Android (Kotlin).
- Contains:
  - `types.ts` — State shape (ChatState, ChatConversationState, ChatMessageState, ChatReadState, ChatComposerState, ChatPaginationState, ChatEvent union, ChatResult)
  - `reducer.ts` — `reduceChatState(state: ChatState, event: ChatEvent): ChatState` function
  - `selectors.ts` — Derived outputs (compareChatMessages, mergeChatMessage, mergeReadState, getOutgoingMessageStatus, countUnreadMessages, getMessageSnippet, toReplyPreview)
  - `fixtures/chat-state-vectors.json` — Cross-platform parity test vectors (20+ fixture cases)
- Dependency: TypeScript only (no React, Supabase, browser APIs)
- Reference: `packages/core/docs/chat-state-protocol.md` is authoritative spec for all adapters

**packages/core/docs/chat-state-protocol.md (Protocol Doc):**
- Purpose: Human-readable, platform-neutral specification for chat state machine.
- Defines: State shape, events, selector behavior, adapter rules, fixture contract.
- Audience: Web devs, iOS devs, Android devs — all must implement the same event types and selector outputs.
- Authority: When reducer, selectors, or fixtures change, this doc must be updated first; implementations follow.

**packages/supabase/ (Supabase Integration):**
- Purpose: Supabase-specific types and auth config.
- Contains:
  - `auth.ts` — FishAuthClaims (sub, role), authRedirects (`/login`, `/home`, `/coach`)
  - `database.types.ts` — Generated DB schema types
- Dependency: Depends on `@fish/core` (for UserRole type).

**supabase/ (Backend):**
- Purpose: Backend config, database schema, Edge Functions, RLS policies.
- Contains: `config.toml` (project settings), `functions/` (Deno Edge Functions).
- Key files:
  - `config.toml` — Project ID, function configs (e.g., `[functions.send-message]` with `verify_jwt = true`).

**supabase/functions/send-message/ (Edge Function):**
- Purpose: Validates and persists new messages.
- Contains: `index.ts` — Deno handler
- Responsibilities:
  - Validate SendMessageCommand (conversationId, body, clientRequestId, replyToMessageId)
  - Check message length ≤ 4000 chars
  - Verify caller auth via Supabase `/auth/v1/user`
  - Call Supabase RPC `send_chat_message` with message + reply target
  - Return calm error on validation failure, full message on success
- Dependencies: Deno runtime, `@fish/core` types (SendMessageCommand, chatLimits)
- Config: `config.toml` section `[functions.send-message]` with `verify_jwt = true`

**supabase/functions/chat-command/ (Edge Function):**
- Purpose: Handles chat mutations (edit, delete, react) and refresh queries (messages, conversation, read state).
- Contains: `index.ts` — Deno handler
- Responsibilities:
  - Route action to appropriate Supabase RPC (edit_chat_message, delete_chat_message, toggle_message_reaction, mark_chat_read_state)
  - Fetch messages or read state from database
  - Enrich messages with reactions (paginated from `message_reactions` table)
  - Return calm error on failure, updated message/read state on success
- Dependencies: Deno runtime, `@fish/core` types (ChatMessageState, ChatReadState)
- Config: `config.toml` section `[functions.chat-command]` with `verify_jwt = true`

**.planning/codebase/ (Architecture Docs):**
- Purpose: Consumed by `/gsd:plan-phase` and `/gsd:execute-phase` to guide new work.
- Contains: ARCHITECTURE.md (patterns, layers, data flow), STRUCTURE.md (this file; directory guide).

**.claude/skills/sketch-findings-fish/ (Design System Skill):**
- Purpose: Validated UI design decisions (navigation, chat, profile, theme).
- Contains: SKILL.md index + references/ (navigation-and-shell.md, chat.md, responsive.md, states.md, theme-and-tokens.md, profile-and-progress.md, coach-experience.md).
- Usage: Load before building/reviewing any client-facing screen to apply settled design direction and anti-patterns.

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

**Core Domain Types:**
- `packages/core/src/roles.ts` — UserRole type + validation.
- `packages/core/src/chat.ts` — Chat DTO types (Conversation, Message, Command, Result, chatLimits).
- `packages/core/src/chat-state/types.ts` — Chat state machine types.
- `packages/core/src/chat-state/reducer.ts` — reduceChatState function.
- `packages/core/src/chat-state/selectors.ts` — Selector functions.

**Backend Integration:**
- `packages/supabase/src/auth.ts` — Auth claims, redirect paths.
- `packages/supabase/src/database.types.ts` — Generated DB schema.

**Edge Functions:**
- `supabase/functions/send-message/index.ts` — Message validation + creation.
- `supabase/functions/chat-command/index.ts` — Mutations (edit/delete/react) + reads (refresh/hydrate).

**Design System:**
- `apps/web/components/ui/button.tsx` — Button control (primary/secondary/ghost).
- `apps/web/components/ui/input.tsx` — Input control (label, hint, notice).
- `apps/web/components/ui/card.tsx` — Card container + Progress bar.
- `apps/web/lib/utils.ts` — cn() utility (class name merging).

**Documentation:**
- `packages/core/docs/chat-state-protocol.md` — Authoritative spec for chat state machine.
- `AGENTS.md` — Product rules, stack, conventions, build order.
- `.claude/CLAUDE.md` — Project instructions (references AGENTS.md).
- `.claude/skills/sketch-findings-fish/SKILL.md` — Design system validations.

## Naming Conventions

**Files:**
- **Pages:** kebab-case, e.g., `chat.tsx`, `coach-dashboard.tsx`, `client-onboarding.tsx`.
- **Components:** PascalCase, e.g., `Button.tsx`, `Input.tsx`, `ChatMessage.tsx`.
- **Utilities:** camelCase, e.g., `utils.ts`, `helpers.ts`, `selectors.ts`.
- **Types/Domain:** camelCase or PascalCase, e.g., `chat.ts` (file) exporting PascalCase types (ChatMessage), `chat-state` (directory).
- **Tests:** `*.test.ts` or `*.spec.ts`, co-located with source or in `__tests__/` folder.

**Functions:**
- **Components:** PascalCase, e.g., `export function Button(props) { }`, `export const Card = ({ ... }) => { }`.
- **Utilities:** camelCase, e.g., `export function cn(...inputs)`, `export function isUserRole(value)`.
- **Type guards:** camelCase `is*`, e.g., `isUserRole()`.
- **Reducer:** camelCase `reduceChatState`, `applyChatEvents`.
- **Selectors:** camelCase `compareChatMessages`, `mergeChatMessage`, `getOutgoingMessageStatus`, `countUnreadMessages`, `getMessageSnippet`, `toReplyPreview`.

**Variables:**
- **Constants:** camelCase (e.g., `chatLimits`, `authRedirects`, `defaultPagination`), e.g., `const chatLimits = { messageBodyMaxLength: 4000 }`.
- **let/const:** camelCase, e.g., `const userName = "Alice"`.
- **React state:** camelCase, e.g., `const [isOpen, setIsOpen] = useState(false)`.

**Types:**
- **Interfaces:** PascalCase, e.g., `interface ChatMessage`, `interface FishAuthClaims`, `interface ChatMessageState`.
- **Type aliases:** PascalCase, e.g., `type UserRole = "client" | "coach"`, `type LocalMessageStatus = "pending" | "sending" | "sent" | "failed"`.
- **Branded/opaque types:** camelCase suffix, e.g., `type ConversationId = string` (semantic clarity, not nominal typing).

## Where to Add New Code

**New Feature (e.g., Client Tracker, Coach Client List):**
- **Primary code:** `apps/web/app/[route]/page.tsx` (new page component).
- **Tests:** `apps/web/__tests__/[route].test.tsx` or co-located `[route].test.tsx`.
- **Types:** Add to `packages/core/src/[domain].ts` (e.g., `tracker.ts` for tracker types); if chat-related, extend `packages/core/src/chat-state/types.ts` for state shape or add new event types.
- **Supabase queries:** Call `supabase.from('table').select()` inline in page (protected by RLS); for complex logic, add Edge Function in `supabase/functions/[name]/index.ts`.

**New Chat State Event:**
- **Define event type:** Add to `ChatEvent` union in `packages/core/src/chat-state/types.ts`.
- **Handle in reducer:** Add case in `reduceChatState` in `packages/core/src/chat-state/reducer.ts`.
- **Test:** Add fixture case to `packages/core/src/chat-state/fixtures/chat-state-vectors.json`.
- **Document:** Update `packages/core/docs/chat-state-protocol.md` with new event behavior.

**New Component/Module:**
- **Shared UI control:** `apps/web/components/ui/[name].tsx` (e.g., `modal.tsx`).
- **Page layout component:** `apps/web/components/[name].tsx` (e.g., `chat-header.tsx`).
- **Domain utility:** `packages/core/src/[domain].ts` (e.g., `validation.ts` for shared validators).

**Utilities:**
- **Web-specific helpers:** `apps/web/lib/[name].ts` (e.g., `date-utils.ts`).
- **Shared across apps:** `packages/core/src/[name].ts` (e.g., `formatter.ts`).
- **Chat state helpers (selectors):** Add to `packages/core/src/chat-state/selectors.ts`.

**Styling:**
- **New design token:** Add to `@theme { }` block in `apps/web/app/globals.css`, e.g., `--color-new: oklch(...);`.
- **New component variant:** Extend component file, e.g., add `tertiary` variant to `Button` in `apps/web/components/ui/button.tsx`.
- **No `tailwind.config.js`:** Tailwind v4 is CSS-first; keep config in globals.css.

**Supabase Schema & Edge Functions:**
- **New table/policy:** Edit via Supabase Studio or migration files (stored in `supabase/migrations/` if using CLI; not yet scaffolded).
- **New Edge Function:** Create folder `supabase/functions/[name]/index.ts` with Deno entry point; import `@fish/core` types, use pattern from send-message or chat-command.
- **Edge Function config:** Add `[functions.[name]]` section to `supabase/config.toml`, e.g., `verify_jwt = true` for auth.

**Chat-Related Hooks (Web):**
- **Route-local hooks:** `apps/web/app/(authenticated)/chat/hooks/use-[concern].ts`
- **Examples:** use-chat-messages (fetch + subscribe), use-chat-read-state, use-chat-realtime, use-chat-presence, use-chat-composer.
- **Pattern:** Dispatch chat-state events from hooks; selectors drive UI.

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

**packages/core/src/chat-state/fixtures/ (Test Vectors):**
- Purpose: JSON cross-platform parity fixtures for chat state reducer + selectors.
- Generated: No (hand-written JSON).
- Committed: Yes.
- Format: Each fixture has `name`, `initialState`, `events`, `expectedState` or `expectedSelectors`.

**supabase/functions/ (Edge Functions):**
- Purpose: Deno-based serverless functions deployed to Supabase.
- Generated: No (hand-written Deno/TypeScript).
- Committed: Yes.
- Deploy: Automatic on `supabase deploy` (requires Supabase CLI).

---

*Structure analysis: 2026-07-11*
