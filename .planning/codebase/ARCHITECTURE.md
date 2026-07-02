<!-- refreshed: 2026-07-02 -->
# Architecture

**Analysis Date:** 2026-07-02

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Web Clients (Next.js)                     │
│  `apps/web` — App Router, React 19, TypeScript              │
│  Pages: `/`, `/chat` (clients), `/coach` (coaches)           │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Shared Types │ │ Supabase     │ │ Design       │
│ @fish/core   │ │ Integration  │ │ System UI    │
│ `packages/`  │ │ @fish/supabase  │ `components/` │
└──────────────┘ └────┬─────────┘ └──────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │   Supabase Backend          │
        │ Auth + DB + Realtime + Fcns │
        │ Edge Function: send-message │
        │ `supabase/functions/`       │
        └─────────────────────────────┘
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

**Overall:** Foundation-first, coach-validated, neurodivergent-focused monorepo. Multi-platform (web, iOS, Android) with a single Supabase backend. Web is the primary delivery surface during build-out of foundational features.

**Key Characteristics:**
- **Simplicity by design:** UI removes choices (one primary action per screen); never build what a coach hasn't validated first.
- **Shared contracts:** Product domain (Chat, Roles) lives in `packages/core`; Supabase integration lives in `packages/supabase`.
- **Calm aesthetic:** Dark, spacious layout with one lime accent button; no scores, streaks, or alarming red. Errors guide, never scold.
- **Large tap targets:** 56px minimum control height; readable fonts (Lexend for body, Fraunces for headings).

## Layers

**Web Layer (Next.js App Router):**
- Purpose: Client-facing UI; renders pages, handles routing, calls API functions.
- Location: `apps/web/app/` (App Router pages), `apps/web/components/` (reusable components)
- Contains: Page components (`*.tsx`), layout wrappers, form controls
- Depends on: React 19, Next.js 16, Tailwind v4, `@fish/core`, `@fish/supabase` (for types + auth redirects)
- Used by: End users (coaches, clients) in browser

**UI Component Library:**
- Purpose: Centralized, reusable design-system controls conforming to FISH rules.
- Location: `apps/web/components/ui/` (Button, Input, Card, Progress)
- Contains: ForwardRef-wrapped controls, variants for Button (primary/secondary/ghost), conditional Tailwind classes
- Depends on: `clsx`, `tailwind-merge`, React forwardRef
- Used by: All page components in `apps/web/app/`

**Styling Layer (Tailwind CSS v4):**
- Purpose: CSS-first design system without `tailwind.config.js`. All tokens defined via `@theme` in globals.css.
- Location: `apps/web/app/globals.css` (@theme block, @layer base)
- Contains: Design tokens (colors, fonts, radius, sizing); base resets; accessibility rules (focus, reduced-motion)
- Depends on: Tailwind CSS v4.3.1, @tailwindcss/postcss v4.3.1 (must match version)
- Used by: All components via Tailwind utility classes (e.g., `bg-primary`, `rounded-card`)

**Core Domain Layer:**
- Purpose: Shared TypeScript contracts for product domain (no implementation, only types + validation).
- Location: `packages/core/src/`
- Contains: `roles.ts` (UserRole type), `chat.ts` (ChatConversation, ChatMessage, SendMessageCommand interfaces)
- Depends on: TypeScript only
- Used by: Web (`apps/web`), Supabase package (`packages/supabase`), Edge Functions (`supabase/functions/`)

**Supabase Integration Layer:**
- Purpose: Supabase-specific contracts (auth claims, database types, redirect paths).
- Location: `packages/supabase/src/`
- Contains: `auth.ts` (FishAuthClaims, authRedirects), `database.types.ts` (generated from DB schema)
- Depends on: `@fish/core` (for UserRole type)
- Used by: Web app for auth redirects; future services for DB queries

**Edge Function Layer (Deno):**
- Purpose: Serverless validators and command handlers for sensitive operations (send message, assign client, etc.).
- Location: `supabase/functions/send-message/index.ts`
- Contains: HTTP request handler validating SendMessageCommand against `chatLimits`
- Depends on: Deno runtime, `@fish/core` (chat.ts)
- Used by: Web clients calling `/send-message` Edge Function via Supabase client

**Backend (Supabase):**
- Purpose: Auth (JWT + RLS), database (PostgreSQL), realtime subscriptions, file storage, Edge Function runtime.
- Location: `supabase/` (config.toml) and Supabase Cloud
- Contains: Auth policies, database tables (users, conversations, messages), RLS rules, function configurations
- Depends on: PostgreSQL, Supabase cloud infrastructure
- Used by: Web app, iOS app, Android app via `supabase-js` or platform SDKs

## Data Flow

### Primary Request Path (Web → Edge Function)

1. **User types message on `/chat` page** (`apps/web/app/chat/page.tsx` — not yet built)
   - Calls `SendMessageCommand` with conversationId + body

2. **Web client invokes Supabase Edge Function** (future)
   - POST to `/send-message` with JWT auth header (verified in Supabase config.toml)
   - Body: `{ conversationId, body, clientRequestId? }`

3. **Edge Function validates** (`supabase/functions/send-message/index.ts`)
   - Checks: conversationId + body present, body length ≤ 4000 chars (from `chatLimits`)
   - Returns 400 if invalid, 200 + acknowledgement if valid
   - Does NOT insert message into DB yet (future: will call trigger or Edge Function that does)

4. **Web receives response** and updates local optimistic UI
   - On success: show message in chat with pending state, await server confirmation
   - On error: display validation message (soft notice color, never red)

### Data Sources & State Management

- **Auth state:** Supabase JWT in localStorage, decoded in `packages/supabase/src/auth.ts` to extract `FishAuthClaims` (sub, role)
- **Conversations:** Fetched via Supabase RLS-protected SELECT (future: endpoint not yet built)
- **Messages:** Fetched from `messages` table (RLS ensures clients see only own conversations); realtime subscription for incoming messages (future: not yet built)
- **User profile:** Pulled from `users` table after auth (role: client or coach)

**State Management Strategy:**
- No Redux/Zustand yet; foundation-first phase uses React 19 state (useState, useContext)
- Future: may add React Query/SWR for server state once patterns stabilize
- Optimistic updates for chat messages (insert to local state, await server acknowledgement)

## Key Abstractions

**UserRole:**
- Purpose: Represents participant type (client or coach); determines which UI screens are shown.
- Examples: `packages/core/src/roles.ts`, `packages/supabase/src/auth.ts`
- Pattern: Branded type union + type guard (`isUserRole()`); used in auth claims and message routing

**ChatConversation:**
- Purpose: Represents a 1-on-1 conversation between one client and one coach.
- Examples: `packages/core/src/chat.ts` (ChatConversation interface)
- Pattern: Immutable DTO; createdAt/updatedAt for audit; clientId + coachId for explicit intent (coach always initiates, clients never choose)

**ChatMessage:**
- Purpose: Represents a single message in a conversation; includes sender role for permission checks.
- Examples: `packages/core/src/chat.ts`
- Pattern: Immutable; conversationId + senderId for routing; senderRole cached to avoid join on read

**SendMessageCommand:**
- Purpose: Input contract for sending a message; keeps UI decoupled from server implementation.
- Examples: `packages/core/src/chat.ts`, `supabase/functions/send-message/index.ts`
- Pattern: Validation happens in Edge Function against chatLimits (4000 char max); client-side validation in form onSubmit (future)

**FishAuthClaims:**
- Purpose: JWT payload shape after Supabase auth; minimal: sub (user ID) + role (client|coach).
- Examples: `packages/supabase/src/auth.ts`
- Pattern: Decoded from JWT in auth middleware; passed to RLS policies for data filtering

## Entry Points

**Web Application:**
- Location: `apps/web/app/layout.tsx` (Root layout)
- Triggers: Browser load of https://fish.app/ (or dev: http://localhost:3000)
- Responsibilities: Font loading (Lexend + Fraunces), metadata, child routing via App Router, globals.css injection

**Home/Design System Page:**
- Location: `apps/web/app/page.tsx`
- Triggers: GET `/`
- Responsibilities: Displays design tokens, component showcase (Button, Input, Card, Progress variants)

**Chat Page (Future):**
- Location: `apps/web/app/chat/page.tsx` (not yet built)
- Triggers: Redirect from auth on client login; manual nav to `/chat`
- Responsibilities: Fetch conversations, display chat list, open 1-on-1 conversation view, render message feed, invoke send-message function

**Coach Dashboard (Future):**
- Location: `apps/web/app/coach/page.tsx` (not yet built)
- Triggers: Redirect from auth on coach login; manual nav to `/coach`
- Responsibilities: Show assigned clients, client profiles, conversation list, 1-on-1 chat

**Edge Function (send-message):**
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

**What happens:** Pages offer N options (e.g., "Choose your English level" or "Pick a template") where users browse and select.

**Why it's wrong:** Neurodivergent users (especially ADHD) freeze under choice. FISH rule: coach assigns, never chosen. This violates the core product thesis.

**Do this instead:** Coach assigns via admin panel (not yet built). App receives assignment in DB. Client sees only one thing: "Here's your today." Reference: `AGENTS.md` "Assigned, never chosen" rule; see `packages/supabase/src/auth.ts` (authRedirects has `/chat` and `/coach` — no intermediate chooser).

### Gamification with Streaks

**What happens:** Implement streak counters, leaderboards, or unlock badges.

**Why it's wrong:** Broken streaks are the top abandonment trigger for ADHD users. Gamification is reward-only in FISH; never punish gaps.

**Do this instead:** Reward returning with consistency bonus (e.g., "+5 points for coming back") but no reset on miss. Progress bars only (visual, not scored). Reference: `AGENTS.md` "Gamification is reward-only" rule; see `apps/web/components/ui/card.tsx` Progress component — no numbers, only visual fill.

### Shared State without Types

**What happens:** Pass state through context or global Redux without TypeScript interfaces, leaving consumers unsure of shape.

**Why it's wrong:** Leads to runtime errors on missing fields, especially in chat (messages, participants).

**Do this instead:** Define all state shapes in `packages/core/src/` as exported TypeScript interfaces (e.g., ChatMessage, ChatConversation). Use those in all consumers. Reference: `packages/core/src/chat.ts` — all chat types live here; Edge Function and future web pages import and validate against these.

### Styling with Raw Hex

**What happens:** Write `className="bg-[#1b7ba5]"` instead of using design tokens.

**Why it's wrong:** Breaks consistency; makes dark-mode swaps impossible; token changes require grep-and-replace.

**Do this instead:** Use Tailwind utilities mapped to `@theme` tokens in `apps/web/app/globals.css`. E.g., `bg-primary` instead of `bg-[#1b7ba5]`. All colors are defined once in `@theme { --color-primary: ... }`. Reference: `apps/web/app/page.tsx` uses only token utilities (`bg-primary`, `text-body`, `rounded-card`); no hardcoded colors.

### ForwardRef Without DisplayName

**What happens:** Export a forwardRef component without `displayName` property.

**Why it's wrong:** React DevTools and error messages show "Unknown" instead of component name; debugging is harder.

**Do this instead:** Add `ComponentName.displayName = "ComponentName"` after forwardRef definition. Reference: `apps/web/components/ui/button.tsx` and `input.tsx` both set `Button.displayName` and `Input.displayName`.

## Error Handling

**Strategy:** Graceful, conversational error messages in soft yellow (notice color), never alarming red. Errors explain and guide.

**Patterns:**
- **Validation errors (client-side):** Display alongside the field (notice state in Input component; see `apps/web/components/ui/input.tsx` prop `notice`).
- **API errors (Edge Function):** Return 400 with plain-language message (e.g., "This message is a little long. Try sending it in two parts." from `supabase/functions/send-message/index.ts`). Never say "Invalid input" or "400 Bad Request."
- **Auth errors:** Redirect to signin page (via authRedirects in `packages/supabase/src/auth.ts`).
- **Network errors (future):** Show a "Connection lost" state with retry button; no harsh language.

## Cross-Cutting Concerns

**Logging:** Not yet implemented in web or Edge Functions. Future: add structured logging (e.g., Vercel Logs or Supabase Realtime Logs for Edge Functions) for debugging. For now, use console.log in dev; strip in production build.

**Validation:** Lives in three places:
1. **Client (forms):** Input component with HTML5 (type="email") + custom validation on submit (future)
2. **Edge Function:** SendMessageCommand validation in `supabase/functions/send-message/index.ts` (checks conversationId, body, length)
3. **Database (RLS):** Supabase RLS policies enforce auth and data ownership (future: not yet built)

**Authentication:** Supabase JWT flow:
1. User signs in → Supabase Auth returns JWT + refresh token
2. JWT stored in localStorage (or cookie, future)
3. All requests include JWT in Authorization header (Supabase client does this automatically)
4. Edge Function verifies JWT via config.toml `verify_jwt = true`; Deno receives user claims in request context

**Authorization:** Role-based (client vs. coach) via `UserRole` in JWT claims; RLS policies in Supabase enforce it (future: not yet built).

---

*Architecture analysis: 2026-07-02*
