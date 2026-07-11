---
last_mapped_commit: ffc0af5c4a67160e838b07ffa6e26652f9ca337d
---
<!-- refreshed: 2026-07-11 -->
# Architecture

**Analysis Date:** 2026-07-11

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
┌──────────────────┐┌──────────────────┐┌──────────────────┐
│  Shared Domains  │ │ Supabase         │ │ Design System    │
│  @fish/core      │ │ Integration      │ │ UI Components    │
│ - types          │ │ @fish/supabase   │ │ `components/ui/` │
│ - chat-state     │ │ - auth           │ │ Tailwind v4      │
│ - roles          │ │ - database.types │ │                  │
└──────────┬───────┘ └────┬─────────────┘ └──────────────────┘
           │              │
           ▼              ▼
        ┌────────────────────────────────────┐
        │   Supabase Backend                  │
        │ Auth + DB + Realtime + Edge Fns    │
        │ ├─ send-message (message creation) │
        │ └─ chat-command (mutations/reads)   │
        │ `supabase/functions/`               │
        └─────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Web App | Next.js entry point, routing, layouts | `apps/web/app/layout.tsx`, `app/page.tsx` |
| UI Components | Reusable design-system controls (Button, Input, Card, Progress) | `apps/web/components/ui/` |
| Styles | Tailwind v4 CSS-first theme with tokens via @theme | `apps/web/app/globals.css` |
| Design Tokens | Color palette, typography, spacing, radius scales | `apps/web/app/globals.css` (@theme section) |
| Utils | Conditional class merging (cn helper) | `apps/web/lib/utils.ts` |
| Core Domain Types | Shared chat + roles contracts, no implementation | `packages/core/src/` |
| Chat State Protocol | Platform-neutral event/reducer/selector contract | `packages/core/src/chat-state/` |
| Supabase Types | Auth claims, database schemas, auth redirects | `packages/supabase/src/` |
| Edge Functions | Deno-based serverless handlers (send-message, chat-command) | `supabase/functions/` |

## Pattern Overview

**Overall:** Foundation-first, coach-validated, neurodivergent-focused monorepo. Web-only client with a single Supabase backend. Chat state is portable: event-based reducer + selectors in `packages/core/src/chat-state/` usable by any platform (web Zustand, native iOS/Android).

**Key Characteristics:**
- **Simplicity by design:** UI removes choices (one primary action per screen); never build what a coach hasn't validated first.
- **Portable chat state:** Chat reducer and selectors in shared TypeScript (`packages/core/src/chat-state/`) define a platform-neutral contract, documented in `packages/core/docs/chat-state-protocol.md`. Web, iOS, Android replay the same event types and achieve parity.
- **Event-driven state:** Chat mutations are modeled as events (`sendOptimisticMessage`, `confirmSentMessage`, `markMessageFailed`, `mergeRemoteMessage`, `mergeReadState`, etc.). Reducer applies events; selectors derive UI-facing state.
- **Calm aesthetic:** Dark, spacious layout with one high-contrast primary button; no scores, streaks, or alarming red. Errors guide, never scold.
- **Large tap targets:** 56px minimum control height; readable fonts (Lexend for body, Fraunces for headings).

## Layers

**Web Layer (Next.js App Router):**
- Purpose: Client-facing UI; renders pages, handles routing, dispatches chat events, calls Edge Functions.
- Location: `apps/web/app/` (App Router pages), `apps/web/components/` (reusable components)
- Contains: Page components (`*.tsx`), layout wrappers, form controls, Zustand stores (future: wrapping chat-state reducer)
- Depends on: React 19, Next.js 16, Tailwind v4, `@fish/core` (types + chat-state), `@fish/supabase` (auth redirects)
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
- Contains:
  - `roles.ts`: UserRole type + `isUserRole()` guard
  - `chat.ts`: ChatConversation, ChatMessage, SendMessageCommand, SendMessageResult, chatLimits constant
  - `chat-state/`: Portable event-driven state machine
- Depends on: TypeScript only
- Used by: Web (`apps/web`), Supabase package (`packages/supabase`), Edge Functions (`supabase/functions/`)

**Chat State Protocol Layer:**
- Purpose: Platform-neutral event-reducer-selector contract for chat state. Usable by web (Zustand), iOS (Swift), Android (Kotlin).
- Location: `packages/core/src/chat-state/`
- Contains:
  - `types.ts`: ChatState, ChatConversationState, ChatMessageState, ChatReadState, ChatComposerState, ChatEvent (union of 13+ event types), ChatResult
  - `reducer.ts`: `reduceChatState(state, event)` function applying events to immutable state
  - `selectors.ts`: Derived state (compareChatMessages, mergeChatMessage, mergeReadState, getOutgoingMessageStatus, countUnreadMessages, getMessageSnippet, toReplyPreview)
  - `fixtures/`: JSON test vectors for cross-platform parity
- Depends on: TypeScript only, no platform specifics
- Used by: Web Zustand store, Edge Functions for message enrichment, native apps for offline-first state
- Reference: `packages/core/docs/chat-state-protocol.md` is the authoritative human-readable spec

**Supabase Integration Layer:**
- Purpose: Supabase-specific contracts (auth claims, database types, redirect paths).
- Location: `packages/supabase/src/`
- Contains: `auth.ts` (FishAuthClaims, authRedirects), `database.types.ts` (generated from DB schema)
- Depends on: `@fish/core` (for UserRole type)
- Used by: Web app for auth redirects; Edge Functions for auth context

**Edge Function Layer (Deno):**
- Purpose: Serverless command handlers for sensitive operations: message creation, mutations (edit, delete, react), refresh/hydrate queries.
- Location: `supabase/functions/`
- Contains:
  - `send-message/index.ts`: Validates SendMessageCommand (body length, required fields), calls Supabase RPC `send_chat_message`, supports `replyToMessageId`
  - `chat-command/index.ts`: Handles edit-message, delete-message, toggle-reaction, mark-read-state, refresh-messages, refresh-conversation; enriches messages with reactions (paginated)
- Depends on: Deno runtime, `@fish/core` (chat types)
- Error handling: Calm, conversational error messages (notice color); no technical jargon
- Used by: Web clients calling functions via Supabase client (JWT auth automatic)

**Backend (Supabase):**
- Purpose: Auth (JWT + RLS), database (PostgreSQL), realtime subscriptions, file storage, Edge Function runtime.
- Location: `supabase/config.toml` and Supabase Cloud
- Contains: Auth policies, database tables (users, conversations, messages, message_reactions, message_reads), RLS rules, function configurations
- Depends on: PostgreSQL, Supabase cloud infrastructure
- Used by: Web app via `supabase-js`, Edge Functions via Supabase client

## Data Flow

### Primary Flow: Send Message (Web → Edge Function → DB)

1. **User composes message on `/chat` page** (`apps/web/app/chat/page.tsx`)
   - User types in composer input, presses send
   - Web generates `clientRequestId` (UUID)
   - Dispatch `sendOptimisticMessage` event to chat-state reducer → local UI shows "sending" status immediately

2. **Web client invokes send-message Edge Function** (via Supabase client)
   - POST to `/send-message` with JWT auth header (verified in Supabase config.toml)
   - Body: `{ conversationId, body, clientRequestId, replyToMessageId? }`

3. **send-message validates** (`supabase/functions/send-message/index.ts`)
   - Checks: conversationId + body present, body length ≤ 4000 chars (from `chatLimits`)
   - Verifies auth via Supabase `/auth/v1/user` endpoint
   - Calls Supabase RPC `send_chat_message` with message + metadata
   - Returns 400 if validation fails, 200 + message if success
   - Returns calm error messages (e.g., "This message is a little long. Try sending it in two parts.")

4. **Web receives response** and updates local state
   - On success: Dispatch `confirmSentMessage` event → local UI shows "sent" status
   - On error: Dispatch `markMessageFailed` event → local UI shows "failed", restores body to composer if draft is empty
   - Realtime subscription (future) receives new message from other participants → dispatch `mergeRemoteMessage`

### Secondary Flow: Chat Command (Mutations & Reads)

1. **User edits, deletes, reacts, or requests refresh** (`apps/web/app/chat/page.tsx`)
   - Call chat-command Edge Function with action + parameters

2. **chat-command processes command** (`supabase/functions/chat-command/index.ts`)
   - Actions: edit-message, delete-message, toggle-reaction, mark-read-state, refresh-messages, refresh-conversation
   - Verifies caller auth; calls corresponding Supabase RPC (edit_chat_message, delete_chat_message, toggle_message_reaction, mark_chat_read_state)
   - For message reads (refresh-messages, refresh-conversation), fetches from `messages` table + enriches with reactions (paginated from `message_reactions`)
   - Returns message(s) with reactions populated

3. **Web updates local state**
   - Dispatch `mergeRemoteMessage` event for server response
   - Dispatch `mergeReadState` event for read-state updates
   - Dispatch `hydrateWindow` event for full-conversation refresh

### Realtime Flow (Future)

- Supabase Realtime subscription on `messages` channel sends new/edited/deleted messages to connected clients
- Web receives subscription event → dispatch `mergeRemoteMessage` event
- Chat-state reducer merges into local message list (dedup by id/clientRequestId)

### Pagination Flow (Older Messages)

1. **User scrolls to top of message window, messages list is not yet complete** (`apps/web/app/chat/page.tsx`)
   - Dispatch `olderMessagesRequested` event → set `pagination.isLoadingOlder = true`

2. **Web calls chat-command refresh-messages or refresh-conversation** (keyset pagination via cursor)
   - Fetch messages with `created_at < oldestLoadedCursor` and `id != oldestLoadedId` (for tie-break)
   - Return with `hasMoreOlder` flag and new `oldestCursor`

3. **Web receives page**
   - Dispatch `olderPageLoaded` event → merge new messages, update pagination cursor/hasMoreOlder, set isLoadingOlder = false
   - On error: dispatch `olderPageLoadFailed` → set hasLoadError = true, leave cursor untouched so retry is possible

## Key Abstractions

**UserRole:**
- Purpose: Represents participant type (client or coach); determines which UI screens are shown.
- Examples: `packages/core/src/roles.ts`, `packages/supabase/src/auth.ts`
- Pattern: Branded type union + type guard (`isUserRole()`); used in auth claims and message routing

**ChatConversation (DTO):**
- Purpose: Represents a 1-on-1 conversation between one client and one coach.
- Examples: `packages/core/src/chat.ts` (ChatConversation interface)
- Pattern: Immutable DTO; clientId + coachId for explicit intent (coach always initiates, clients never choose)

**ChatMessage (DTO):**
- Purpose: Represents a single message in a conversation; immutable server record.
- Examples: `packages/core/src/chat.ts`
- Pattern: Immutable; conversationId + senderId for routing; senderRole cached to avoid join on read

**ChatMessageState (Local State):**
- Purpose: Message representation in local chat state, enriched with UI-facing metadata.
- Examples: `packages/core/src/chat-state/types.ts`
- Pattern: Extends ChatMessage with `clientRequestId`, `localStatus` (pending/sending/sent/failed), `failureReason`, `senderDisplayName`, reactions, reply target, edited/deleted timestamps
- Lifecycle: Optimistic (pending/sending) → confirmed (sent) or failed; failures restore body to composer

**ChatState (Portable Machine):**
- Purpose: Root state container; normalized by conversation id, includes messages, read states, composer, realtime status, pagination.
- Examples: `packages/core/src/chat-state/types.ts`
- Pattern: Event-driven reducer + selector contract; platform-agnostic (web Zustand, iOS, Android all replay same JSON events)

**SendMessageCommand:**
- Purpose: Input contract for sending a message; keeps UI decoupled from server implementation.
- Examples: `packages/core/src/chat.ts`, `supabase/functions/send-message/index.ts`
- Pattern: Validation happens in Edge Function against chatLimits (4000 char max); client-side validation in form (future)

**FishAuthClaims:**
- Purpose: JWT payload shape after Supabase auth; minimal: sub (user ID) + role (client|coach).
- Examples: `packages/supabase/src/auth.ts`
- Pattern: Decoded from JWT in auth middleware; passed to RLS policies for data filtering

**ChatEvent (Discriminated Union):**
- Purpose: Represents a state transition: optimistic send, confirmation, failure, remote merge, read marker update, composer state change, realtime status, pagination load.
- Examples: `packages/core/src/chat-state/types.ts`
- Pattern: 13+ event types (hydrateConversation, sendOptimisticMessage, confirmSentMessage, markMessageFailed, mergeRemoteMessage, mergeReadState, setReplyTarget, setEditTarget, setRealtimeStatus, clearComposer, hydrateWindow, olderMessagesRequested, olderPageLoaded, olderPageLoadFailed)
- Portable: Each event is JSON-serializable; native apps and web replay identically

## Entry Points

**Web Application:**
- Location: `apps/web/app/layout.tsx` (Root layout)
- Triggers: Browser load of https://fish.app/ (or dev: http://localhost:3000)
- Responsibilities: Font loading (Lexend + Fraunces), metadata, child routing via App Router, globals.css injection

**Home/Design System Page:**
- Location: `apps/web/app/page.tsx`
- Triggers: GET `/`
- Responsibilities: Displays design tokens, component showcase (Button, Input, Card, Progress variants)

**Chat Page:**
- Location: `apps/web/app/chat/page.tsx` (or `(authenticated)/chat/page.tsx`)
- Triggers: Redirect from auth on client login; manual nav to `/chat`
- Responsibilities: Initialize chat-state reducer, fetch initial message window, subscribe to realtime (future), render message list + composer, dispatch events on user actions

**Coach Dashboard:**
- Location: `apps/web/app/coach/page.tsx` (or `(authenticated)/coach/page.tsx`)
- Triggers: Redirect from auth on coach login; manual nav to `/coach`
- Responsibilities: Show assigned clients, client profiles, conversation list, open 1-on-1 chat (same chat-state reducer as client, one instance per conversation)

**Edge Function: send-message**
- Location: `supabase/functions/send-message/index.ts`
- Triggers: Web client POST to `/send-message` with JWT header
- Responsibilities: Validate SendMessageCommand, call Supabase RPC `send_chat_message`, return message or calm error

**Edge Function: chat-command**
- Location: `supabase/functions/chat-command/index.ts`
- Triggers: Web client POST to `/chat-command` with JWT header + action + parameters
- Responsibilities: Route action (edit/delete/react/read/refresh), call Supabase RPC, enrich with reactions (paginated), return updated message or read state or message list

## Architectural Constraints

- **Threading:** Single-threaded JavaScript (Next.js server-side rendering may use Node worker threads internally, but user code is single-threaded via event loop). Edge Functions (Deno) are also event-loop based.
- **Global state:** Minimal; Supabase client is typically a singleton per app instance. Design tokens are CSS custom properties (no JS mutation). Chat state is component-local or Zustand store (future: one store instance per conversation).
- **Circular imports:** Not detected in current codebase; all packages export cleanly. `@fish/supabase` depends on `@fish/core` (one-way). `packages/core/src/chat-state/` has no external dependencies.
- **No tailwind.config.js:** Tailwind v4 is CSS-first; all config lives in `@theme` block in `apps/web/app/globals.css`. Creating `tailwind.config.js` will break the build.
- **Monorepo dependency resolution:** pnpm workspace defines all packages in workspace.yaml; import paths use package names (e.g., `import { ChatMessage } from "@fish/core"`).
- **Portable chat state:** Chat-state reducer and selectors in `packages/core/src/chat-state/` are platform-agnostic TypeScript (no React, no Supabase client, no browser APIs). iOS/Android implementations must replay the same event types and achieve identical selector outputs.

## Anti-Patterns

### Multi-choice UI (Plan picker, template gallery, learner profiles)

**What happens:** Pages offer N options (e.g., "Choose your English level" or "Pick a template") where users browse and select.

**Why it's wrong:** Neurodivergent users (especially ADHD) freeze under choice. FISH rule: coach assigns, never chosen. This violates the core product thesis.

**Do this instead:** Coach assigns via admin panel (not yet built). App receives assignment in DB. Client sees only one thing: "Here's your today." Reference: `AGENTS.md` "Assigned, never chosen" rule; see `packages/supabase/src/auth.ts` (authRedirects has `/home` and `/coach` — no intermediate chooser).

### Gamification with Streaks

**What happens:** Implement streak counters, leaderboards, or unlock badges.

**Why it's wrong:** Broken streaks are the top abandonment trigger for ADHD users. Gamification is reward-only in FISH; never punish gaps.

**Do this instead:** Reward returning with consistency bonus (e.g., "+5 points for coming back") but no reset on miss. Progress bars only (visual, not scored). Reference: `AGENTS.md` "Gamification is reward-only" rule; see `apps/web/components/ui/card.tsx` Progress component — no numbers, only visual fill.

### Shared State without Types

**What happens:** Pass state through context or global Redux without TypeScript interfaces, leaving consumers unsure of shape.

**Why it's wrong:** Leads to runtime errors on missing fields, especially in chat (messages, participants).

**Do this instead:** Define all state shapes in `packages/core/src/` as exported TypeScript interfaces (e.g., ChatMessageState, ChatConversationState). Use those in all consumers. Reference: `packages/core/src/chat-state/types.ts` — all chat state types live here; web Zustand adapter and native apps import and validate against these.

### Styling with Raw Hex

**What happens:** Write `className="bg-[#1b7ba5]"` instead of using design tokens.

**Why it's wrong:** Breaks consistency; makes dark-mode swaps impossible; token changes require grep-and-replace.

**Do this instead:** Use Tailwind utilities mapped to `@theme` tokens in `apps/web/app/globals.css`. E.g., `bg-primary` instead of `bg-[#1b7ba5]`. All colors are defined once in `@theme { --color-primary: ... }`. Reference: `apps/web/app/page.tsx` uses only token utilities (`bg-primary`, `text-body`, `rounded-card`); no hardcoded colors.

### ForwardRef Without DisplayName

**What happens:** Export a forwardRef component without `displayName` property.

**Why it's wrong:** React DevTools and error messages show "Unknown" instead of component name; debugging is harder.

**Do this instead:** Add `ComponentName.displayName = "ComponentName"` after forwardRef definition. Reference: `apps/web/components/ui/button.tsx` and `input.tsx` both set `Button.displayName` and `Input.displayName`.

### Chat State in React Component Only

**What happens:** Manage chat state locally in a component with useState; no reducer or portable contract.

**Why it's wrong:** iOS/Android implementations cannot reuse the state logic; multiple web pages would duplicate the same logic; testing is coupled to React.

**Do this instead:** Use the chat-state reducer in `packages/core/src/chat-state/reducer.ts`; wrap it in a Zustand store (or platform-specific state container). Dispatch events from components; selector outputs feed UI. Reference: `packages/core/docs/chat-state-protocol.md` defines the portable contract; web, iOS, Android all replay the same event types.

## Error Handling

**Strategy:** Graceful, conversational error messages in soft yellow (notice color), never alarming red. Errors explain and guide.

**Patterns:**
- **Validation errors (client-side):** Display alongside the field (notice state in Input component; see `apps/web/components/ui/input.tsx` prop `notice`).
- **API errors (Edge Functions):** Return 400 or 5xx with plain-language message. Examples from Edge Functions:
  - "This message is a little long. Try sending it in two parts." (body exceeds 4000 chars)
  - "Add a message before sending." (missing conversationId or body)
  - "That conversation is not available." (404 on RPC)
  - "That did not send yet. Keep this open and try again." (generic network/server error)
  - Never say "Invalid input" or return raw HTTP error codes in user-facing messages.
- **Auth errors:** Redirect to signin page (via authRedirects in `packages/supabase/src/auth.ts`).
- **Network errors (future):** Show a "Connection lost" state with retry button; no harsh language.

## Cross-Cutting Concerns

**Logging:** Not yet implemented in web or Edge Functions. Future: add structured logging (e.g., Vercel Logs or Supabase Logs for Edge Functions) for debugging. For now, use console.log in dev; strip in production build.

**Validation:** Lives in three places:
1. **Client (forms):** Input component with HTML5 (type="email") + custom validation on submit (future)
2. **Edge Functions:** SendMessageCommand validation in `supabase/functions/send-message/index.ts` (checks conversationId, body, length, replyToMessageId validity); ChatCommand validation in `supabase/functions/chat-command/index.ts`
3. **Database (RLS + Functions):** Supabase RLS policies enforce auth and data ownership; database functions (send_chat_message, edit_chat_message, etc.) validate on write

**Authentication:** Supabase JWT flow:
1. User signs in → Supabase Auth returns JWT + refresh token
2. JWT stored in localStorage (or cookie, future)
3. All requests include JWT in Authorization header (Supabase client does this automatically)
4. Edge Function verifies JWT via config.toml `verify_jwt = true`; Deno receives user claims in request context

**Authorization:** Role-based (client vs. coach) via `UserRole` in JWT claims; RLS policies in Supabase enforce it. Chat-state reducer has no authorization logic (that's Supabase's job); reducer only transforms events → state.

**State Portability:** Chat state is platform-agnostic: event → reducer → selector outputs. Web (Zustand), iOS (Swift), Android (Kotlin) all implement the same event types and reducer logic; parity is verified via fixtures in `packages/core/src/chat-state/fixtures/chat-state-vectors.json`.

---

*Architecture analysis: 2026-07-11*
