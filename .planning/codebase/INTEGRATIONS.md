---
last_mapped_commit: ffc0af5c4a67160e838b07ffa6e26652f9ca337d
---

# External Integrations

**Analysis Date:** 2026-07-11

## APIs & External Services

**Supabase (Primary Backend):**
- Supabase - All-in-one backend service (auth, database, realtime, storage, Edge Functions)
  - SDK/Client: Not yet integrated in `apps/web`; types defined in `packages/supabase`
  - Project ID: `fish` (in `supabase/config.toml`)
  - Auth: JWT-based (custom claims in `FishAuthClaims` with `role` and `sub`)

**Google OAuth:**
- Google OAuth 2.0 - External auth provider for sign-in
  - Configured in `supabase/config.toml` under `[auth.external.google]`
  - Env vars: `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
  - Status: Configured but not yet integrated in web UI

**Google Fonts:**
- Google Fonts API - Used in web app for font delivery
  - SDK/Client: Next.js `next/font/google`
  - Fonts loaded: `Lexend` (sans-serif for body/UI, neurodivergent-optimized) and `Fraunces` (serif for headings)

**Next.js Built-in Services:**
- Image optimization - `next/image` component
- Font optimization - `next/font/google` and `next/font/local` support

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Tables defined in `packages/supabase/src/database.types.ts`:
    - `profiles` - User profiles with role (client/coach), display name, timestamps
    - `coach_clients` - Coach-client relationship mapping for assignment workflow
    - `client_profiles` - Client-specific extended profile data
    - `conversations` - 1-on-1 chat conversations (clientId, coachId)
    - `messages` - Chat messages (conversationId, senderId, senderRole, body, createdAt, editedAt, deletedAt, replyToMessageId)
    - `message_reads` - Read state tracking per user per conversation (lastDeliveredMessageId, lastReadMessageId)
    - `message_reactions` - Emoji reactions on messages (user_id, emoji, message_id, removed_at for soft deletes)
    - `presence_sessions` - User presence state tracking for online/offline status
  - Connection: Via Supabase client libraries (not yet integrated in web app)
  - Client: Supabase JavaScript client (not yet in `apps/web/package.json`)

**File Storage:**
- Supabase Storage (not yet integrated)
  - Default for profile pictures, documents, or lesson materials

**Caching:**
- Next.js built-in caching (data cache, request cache)
- Redis not explicitly configured

## Authentication & Identity

**Auth Provider:**
- Supabase Auth with JWT (custom role-based claims)
  - Implementation: User roles (`client` or `coach`) embedded in JWT claims
  - Email/password authentication (standard Supabase offering)
  - Google OAuth sign-in configured (not yet UI-integrated)
  - Redirect paths defined in `packages/supabase/src/auth.ts`:
    - `signedOut: "/"` - Unauthenticated users
    - `clientHome: "/chat"` - Authenticated client users
    - `coachHome: "/coach"` - Authenticated coach users

**Email Configuration:**
- Email verification required before sign-in (AUTH-02)
  - `enable_confirmations = true` in `supabase/config.toml`
- Custom email templates:
  - Confirmation template: `./supabase/templates/confirmation.html` (FISH voice, expires in 24h)
  - Recovery template: `./supabase/templates/recovery.html` (FISH voice, expires in 24h)
- OTP expiry: 24 hours (86400s) to match email copy
- Minimum password length: 8 characters (D-16: no complexity rules, default Supabase requirements)

**Role-Based Access Control:**
- Two roles defined in `packages/core/src/roles.ts`: `"client"` and `"coach"`
- RLS (Row-Level Security) policies enforced on Supabase tables for data isolation

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or error tracking service configured

**Logs:**
- Console/Next.js default logging
- Supabase Edge Functions logs (available via Supabase dashboard)
- Edge Functions log errors to console with structured context (request validation, auth failures, RPC errors)

## CI/CD & Deployment

**Hosting:**
- Not explicitly configured; assumed to be Vercel (Next.js default) or self-hosted Node.js
- Supabase Edge Functions deployment via Supabase CLI (`supabase deploy`)

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or other CI service configured yet

**Build Commands:**
- `pnpm build` - Production build of all packages (Next.js build + TypeScript type checks)
- `pnpm dev` - Local development server
- `pnpm lint` - ESLint across all packages
- `pnpm typecheck` - TypeScript compilation check

## Environment Configuration

**Required env vars:**
- `SUPABASE_URL` - Supabase project URL (not yet used in web app)
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` - Public API key for client-side requests (not yet used in web app)

**Edge Function env vars (fallback chain):**
- `SUPABASE_URL` (or inferred from request origin)
- `SUPABASE_ANON_KEY` → `SUPABASE_PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (fallback order in functions)

**Secrets location:**
- Not yet configured - Should use `.env.local` for development, platform-specific secrets manager for production (Vercel Secrets for Vercel deployment, or AWS Secrets Manager if self-hosted)

## Edge Functions

**Supabase Edge Functions (Deno-based):**

**send-message** - Message sending with validation
- Location: `supabase/functions/send-message/index.ts`
- Config in `supabase/config.toml`: `verify_jwt = true`
- Responsibilities:
  - Accepts `SendMessageCommand` (conversationId, body, clientRequestId, replyToMessageId)
  - Validates JWT token via Supabase auth endpoint
  - Calls RPC `send_chat_message` with parameters
  - Enforces message body length limit (`messageBodyMaxLength = 4000`)
  - Returns calm error messages (never technical jargon)
- Error handling:
  - 400: Invalid/missing required fields, message too long
  - 401: Invalid/missing auth header
  - 403: Conversation not found or unauthorized
  - 409: Conflict (send already in progress, duplicate request)
  - 500: Server error

**chat-command** - Message editing, deletion, reactions, read state, pagination
- Location: `supabase/functions/chat-command/index.ts`
- Config in `supabase/config.toml`: `verify_jwt = true`
- Handles discriminated union of commands:
  - `edit-message` - Update message body
  - `delete-message` - Soft-delete a message
  - `toggle-reaction` - Add/remove emoji reaction on message
  - `mark-read-state` - Update user's read/delivered state for conversation
  - `refresh-messages` - Fetch up to 50 messages by ID with reactions enriched
  - `refresh-conversation` - Full hydration: all messages in conversation + read states for all users
- Reaction enrichment:
  - Fetches `message_reactions` table (1000-row pagination)
  - Aggregates by emoji with count and `by_me` flag
- Returns:
  - `{ message: ChatMessageState, reactions: [...] }` for single-message commands
  - `{ readState: ChatReadState }` for mark-read-state
  - `{ messages: [...], readStates: [...] }` for refresh-conversation
- Error handling:
  - 400: Invalid parameters, message too long, invalid reaction
  - 404: Message/conversation not found
  - 401: Invalid/missing auth
  - 405: Non-POST request
  - 500: Server error

## Webhooks & Callbacks

**Incoming:**
- Not detected

**Outgoing:**
- Not detected (future: potential email notifications, external AI coaching services)

## Database Schema

**Tables:**

**profiles**
- `id` (uuid, primary key) - User ID from Supabase Auth
- `role` (enum: 'client' | 'coach') - User role
- `display_name` (text) - User's display name
- `created_at` (timestamp) - Profile creation time
- `updated_at` (timestamp) - Last update time

**coach_clients**
- Mapping of coach-client relationships (who is assigned to whom)
- Coach initiates assignment; client role is manually granted by system

**client_profiles**
- Client-specific extended profile data (separate from base profiles table)

**conversations**
- `id` (uuid, primary key) - Conversation ID
- `clientId` (uuid, foreign key) - Client participant
- `coachId` (uuid, foreign key) - Coach participant
- `createdAt` (timestamp) - Conversation creation time
- `updatedAt` (timestamp) - Last message time

**messages**
- `id` (uuid, primary key) - Message ID
- `conversationId` (uuid, foreign key) - Reference to conversation
- `senderId` (uuid, foreign key) - User who sent the message
- `senderRole` (enum: 'client' | 'coach') - Sender's role at time of message
- `body` (text, max 4000 chars) - Message content
- `createdAt` (timestamp) - Message creation time
- `editedAt` (timestamp, nullable) - Last edit time
- `deletedAt` (timestamp, nullable) - Soft delete time
- `replyToMessageId` (uuid, foreign key, nullable) - Message this is replying to (thread support)

**message_reads**
- `userId` (uuid) - User who read
- `conversationId` (uuid) - Conversation reference
- `lastDeliveredMessageId` (uuid, nullable) - Last message delivered to user's device
- `deliveredAt` (timestamp, nullable) - When delivery was confirmed
- `lastReadMessageId` (uuid, nullable) - Last message user has read
- `readAt` (timestamp, nullable) - When read state was confirmed

**message_reactions**
- `messageId` (uuid, foreign key) - Message being reacted to
- `userId` (uuid) - User adding reaction
- `emoji` (text) - Emoji character
- `removedAt` (timestamp, nullable) - Soft delete time (enables undo)

**presence_sessions**
- User presence/online status tracking

## Type Contracts

**Located in `packages/core/src/`:**
- `UserRole` - Union type of `"client" | "coach"`
- `ChatConversation`, `ChatMessage`, `ChatParticipant` - Domain models
- `SendMessageCommand`, `SendMessageResult` - API contracts for Edge Functions
- `ChatCommand` - Discriminated union for chat-command Edge Function (edit, delete, toggle reaction, etc.)
- `ChatState`, `ChatEvent`, `ChatConversationState` - Client-side state machine types for message pagination, optimistic updates, realtime sync
- `ChatReactionState`, `ChatReadState`, `ChatComposerState` - Sub-state types for reactions, read tracking, draft composition

**Located in `packages/supabase/src/database.types.ts`:**
- Row types for all tables (ProfileRow, ConversationRow, MessageRow, MessageReadRow, MessageReactionRow, PresenceSessionRow, etc.)
- Fully typed row, insert, and update shapes for each table
- Matches TypeScript types in `packages/core`

## Integration Status

**Ready:**
- Supabase project configured (`project_id = "fish"`)
- Type definitions for auth and database in place
- Two Edge Functions for message operations defined and configured
- Email templates and auth configuration in place
- Google OAuth configured (not yet UI-integrated)
- Chat state machine and reducer in place for client-side pessimistic/optimistic updates
- Database schema includes message reactions, read states, presence tracking

**Not Yet Integrated:**
- Supabase JavaScript client library not in `apps/web/package.json`
- Environment variables for Supabase URL/keys not configured in web app
- Web app does not yet call Supabase APIs, Edge Functions, or use realtime subscriptions
- Google OAuth UI integration not started
- Email template files not found in repo (referenced but may be managed in Supabase dashboard)

---

*Integration audit: 2026-07-11*
