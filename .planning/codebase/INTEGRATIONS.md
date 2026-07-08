# External Integrations

**Analysis Date:** 2026-07-02

## APIs & External Services

**Supabase (Primary Backend):**
- Supabase - All-in-one backend service (auth, database, realtime, storage, Edge Functions)
  - SDK/Client: Not yet integrated in `apps/web`; types defined in `packages/supabase`
  - Project ID: `fish` (in `supabase/config.toml`)
  - Auth: JWT-based (custom claims in `FishAuthClaims` with `role` and `sub`)

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
    - `conversations` - 1-on-1 chat conversations (clientId, coachId)
    - `messages` - Chat messages (conversationId, senderId, senderRole, body, createdAt)
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
- Supabase Auth (custom JWT with role-based access)
  - Implementation: User roles (`client` or `coach`) embedded in JWT claims
  - Redirect paths defined in `packages/supabase/src/auth.ts`:
    - `signedOut: "/"` - Unauthenticated users
    - `clientHome: "/chat"` - Authenticated client users
    - `coachHome: "/coach"` - Authenticated coach users
  - Email/password authentication (standard Supabase offering)

**Role-Based Access Control:**
- Two roles defined in `packages/core/src/roles.ts`: `"client"` and `"coach"`
- RLS (Row-Level Security) policies enforced on Supabase tables (not yet visible in database schema)

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or error tracking service configured

**Logs:**
- Console/Next.js default logging
- Supabase Edge Functions logs (available via Supabase dashboard)

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
- `SUPABASE_ANON_KEY` - Public API key for client-side requests (not yet used in web app)

**Secrets location:**
- Not yet configured - Should use `.env.local` for development, platform-specific secrets manager for production (Vercel Secrets for Vercel deployment, or AWS Secrets Manager if self-hosted)

## Edge Functions

**Supabase Edge Functions:**
- `send-message` - Command-style endpoint for message sending with JWT verification
  - Location: `supabase/functions/send-message/`
  - Config in `supabase/config.toml`:
    - `verify_jwt = true` - Requires valid JWT token in Authorization header
  - Implementation details:
    - Receives `SendMessageCommand` (conversationId, body, optional clientRequestId)
    - Returns `SendMessageResult` with message object (defined in `packages/core/src/chat.ts`)
    - Enforces message body length limit (`chatLimits.messageBodyMaxLength = 4000`)

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

## Type Contracts

**Located in `packages/supabase/src/database.types.ts`:**
- Fully typed row, insert, and update shapes for each table
- Matches TypeScript types in `packages/core` (e.g., `ChatConversation`, `ChatMessage`, `UserRole`)

**Located in `packages/core/src/`:**
- `UserRole` - Union type of `"client" | "coach"`
- `ChatConversation`, `ChatMessage`, `ChatParticipant` - Domain models
- `SendMessageCommand`, `SendMessageResult` - API contracts for Edge Functions

## Integration Status

**Ready:**
- Supabase project configured (`project_id = "fish"`)
- Type definitions for auth and database in place
- Edge Function for message sending defined

**Not Yet Integrated:**
- Supabase JavaScript client library not in `apps/web/package.json`
- Environment variables for Supabase URL/keys not configured
- Web app does not yet call Supabase APIs or use auth

---

*Integration audit: 2026-07-02*
