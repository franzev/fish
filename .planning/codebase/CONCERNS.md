# Codebase Concerns

**Analysis Date:** 2026-07-02

## Tech Debt

**Incomplete product foundation:**
- Issue: Core features foundational to the product are not yet implemented. The codebase is in early-stage setup, with only a design system landing page, type contracts, and a stub Edge Function. Chat functionality, auth flows, client profiles, onboarding, and tracker engine are missing.
- Files: `apps/web/app/page.tsx` (design system demo only), `supabase/functions/send-message/index.ts` (stub, no actual message persistence), `packages/core/src/`, `packages/supabase/src/` (types only, no implementations)
- Impact: Product is not usable by real users. Coach-first validation cannot proceed until these foundations exist.
- Fix approach: Follow the build order in AGENTS.md strictly: 1) Auth + roles, 2) Client profiles, 3) Onboarding (data-driven), 4) Tracker engine, 5) 1-on-1 chat. Implement each layer before moving to next.

**Supabase Edge Function is a pass-through stub:**
- Issue: `supabase/functions/send-message/index.ts` validates the message body and limits but does NOT persist to the database, does NOT authenticate the user, and does NOT trigger any side effects (e.g., coach notifications).
- Files: `supabase/functions/send-message/index.ts`
- Impact: Calling this function does nothing. End-to-end chat is blocked.
- Fix approach: Implement the real function: verify JWT claims (extract userId/role), validate conversationId exists and user has access, persist ChatMessage to messages table, trigger coach notification, return created message with server timestamp.

**Database types have no implementation:**
- Issue: `packages/supabase/src/database.types.ts` defines the schema contract but there is no `supabase/migrations/` directory and no actual database schema created. The RLS policies, table definitions, and functions do not exist.
- Files: `packages/supabase/src/database.types.ts`, missing `supabase/migrations/`
- Impact: Any attempt to read or write from Supabase will fail. Database does not exist.
- Fix approach: Create `supabase/migrations/` directory. Use `supabase migration create init` to scaffold initial schema. Define tables: `profiles`, `conversations`, `messages`. Add RLS policies to enforce coach-client relationships.

**No authentication layer in web app:**
- Issue: `apps/web/` has no auth middleware, no protected routes, no Supabase client initialization, and no way to know who the user is. The home page is a static design system demo, not a login or onboarding screen.
- Files: `apps/web/app/`, missing auth context/provider, missing route middleware
- Impact: Cannot build client/coach experiences or protect sensitive data.
- Fix approach: Add Supabase client setup in `apps/web/lib/supabase.ts`. Create auth context (`apps/web/context/auth.tsx`) and middleware (`apps/web/middleware.ts`). Redirect unauthenticated users to `/login` or sign-up. Implement redirects per `authRedirects` in `packages/supabase/src/auth.ts`.

**No test suite exists:**
- Issue: No test files (jest, vitest, or other framework). No `jest.config` or test configuration. Codebase cannot verify correctness of business logic (chat limits, role checks, form validation).
- Files: No test files found. No test runner config.
- Impact: Changes are unverified. Regressions will ship to production undetected. Design system components and validation logic are untested.
- Fix approach: Add vitest to `apps/web/` and `packages/core/`. Write unit tests for: `cn()` utility, Button/Input/Card/Progress components, chat limits, role validation, message length checks. Add integration tests for Edge Functions (mock Deno environment or use Supabase emulator).

**Missing Android and iOS projects:**
- Issue: `apps/ios/` contains only a `.DS_Store` file. `apps/android/` has skeleton Gradle project with no FISH-specific code. No native clients exist to test product behavior.
- Files: `apps/ios/`, `apps/android/`
- Impact: Web is the only client surface; cross-platform rollout is blocked. Design tokens have not been ported to native platforms.
- Fix approach: This is lower priority (foundation-first approach). When ready: port design tokens to `apps/ios/` (SwiftUI constants) and `apps/android/` (Compose Theming). Implement auth flow and chat UI in both platforms.

## Known Bugs

**No open bugs identified in code comments or patterns.** Codebase is too early-stage to have bugs; it has missing features instead.

## Security Considerations

**Edge Function JWT verification is incomplete:**
- Risk: `supabase/functions/send-message/index.ts` does not extract the JWT claims or validate user ownership of the conversation. An authenticated user could send messages on behalf of another user or in conversations they don't belong to.
- Files: `supabase/functions/send-message/index.ts` (lines 7–14)
- Current mitigation: Supabase's `verify_jwt = true` in `supabase/config.toml` ensures the function rejects unauthenticated requests, but does not enforce authorization at the function level.
- Recommendations: Extract JWT claims from `request.headers.get("authorization")` or use Supabase's `auth` context (available in Deno Edge Functions). Verify userId from JWT matches senderId. Query the conversations table and confirm the user is either clientId or coachId. Reject if authorization check fails.

**No RLS policies exist yet:**
- Risk: Once the database is created, Supabase RLS policies must protect sensitive data. Without them, a coach can read all clients' messages, a client can see other clients' conversations, etc.
- Files: Missing `supabase/migrations/` (RLS policies not defined)
- Current mitigation: None. Database does not exist yet.
- Recommendations: Every table (profiles, conversations, messages) must have RLS policies. Coaches can only read conversations where they are coachId. Clients can only read their own profile and conversations. Messages are filtered by conversation membership. Use Supabase's policy editor or migration SQL.

**Auth state not synchronized between web and Supabase:**
- Risk: If Supabase auth is set up but `apps/web/` doesn't check session state on load, users might be logged in on Supabase but the web app shows them as signed-out, or vice versa. This can lead to UI/backend mismatch and failed requests.
- Files: `apps/web/` (no auth context yet), missing `middleware.ts`
- Current mitigation: None. Auth is not yet implemented.
- Recommendations: On app load, call `supabase.auth.getSession()` in a root-level effect or middleware. If session exists, initialize auth context and redirect to home page (client or coach). If not, redirect to sign-up.

**Secrets management not documented:**
- Risk: Supabase API keys, signing keys, and JWT secrets must not be checked into git. If they leak, attackers can impersonate users.
- Files: `.env` files (not readable per forbidden_files, but should exist)
- Current mitigation: `.env.local` and `.env.production` should be in `.gitignore` (check current `.gitignore`).
- Recommendations: Ensure `.env*` files are in `.gitignore`. Use `.env.example` to document required vars (names only, no values). In CI/CD, inject secrets via environment variables, not committed files.

## Performance Bottlenecks

**No identified bottlenecks yet** — codebase is too small and early-stage. Once chat and tracker features are added, monitor:
- Message query time: As conversation history grows, paginate messages and lazy-load.
- Real-time performance: Supabase Realtime can become slow with many subscribers; limit subscriptions to active conversations.
- Image uploads: Client profile avatars and tracker screenshots should be resized before upload to Supabase Storage.

## Fragile Areas

**Design system relies on Tailwind v4 CSS-first approach:**
- Files: `apps/web/app/globals.css` (defines `@theme`), `tailwind.config.js` must NOT exist
- Why fragile: Tailwind v4 uses CSS-first config (no JS config file). If a developer accidentally creates `tailwind.config.js`, the build breaks silently. The postcss plugin must match the tailwind version exactly or colors won't apply.
- Safe modification: Keep design tokens only in `globals.css` under `@theme`. Document in ARCHITECTURE.md that v4 config is CSS-first. Ensure `tailwindcss` and `@tailwindcss/postcss` are on the same version (currently both ^4.3.1 in `apps/web/package.json`). If upgrading Tailwind, test the entire UI in dev mode before merging.
- Test coverage: Home page renders all design tokens (colors, buttons, inputs, progress). Add a test that compares rendered styles against expected color values.

**UI components have no fallback for missing props:**
- Files: `apps/web/components/ui/input.tsx` (label required), `apps/web/components/ui/button.tsx` (no disabled state tested), `apps/web/components/ui/card.tsx`, `apps/web/components/ui/progress.tsx`
- Why fragile: If a developer forgets to pass `label` to Input, TypeScript will catch it, but there's no runtime guard. Button's disabled state uses CSS opacity; unclear if it works on all browsers. Progress clamping is hardcoded inline.
- Safe modification: Test all components with edge cases (empty strings, missing props, min/max values). For Input, make label optional if ever needed, but prefer required for accessibility. Extract Progress clamping to a util function. Add visual tests in the home page for all variants.

**Chat limits are hard-coded:**
- Files: `packages/core/src/chat.ts` (chatLimits object), `supabase/functions/send-message/index.ts` (uses chatLimits.messageBodyMaxLength)
- Why fragile: If the limit needs to change, both files must update. If the Edge Function is updated but packages/core is not rebuilt, they fall out of sync.
- Safe modification: Define limits in `packages/core/` and export from there (already correct). Ensure the build step (`pnpm build`) typechecks packages/core before web build. Document the limit in a comment explaining why 4000 chars was chosen.

**Database schema is not yet created:**
- Files: `packages/supabase/src/database.types.ts` (types only), missing `supabase/migrations/`
- Why fragile: Once created, schema changes require migrations. Breaking changes (renaming columns, deleting tables) must be coordinated across web, iOS, Android, and Edge Functions. Without a migration system in place, deployments will be chaotic.
- Safe modification: Use Supabase CLI migrations from the start. Every schema change goes through `supabase migration create [name]` and is version-controlled. Document the migration step in STRUCTURE.md. Before any release, test migrations on a staging database.

## Scaling Limits

**Real-time messaging relies on Supabase Realtime:**
- Current capacity: Unknown — Supabase Realtime scales horizontally, but free tier has limits.
- Limit: If thousands of clients and coaches are chatting simultaneously, Realtime subscriptions may become expensive or slow.
- Scaling path: Implement message pagination (load last N messages on conversation open, then fetch newer on scroll). Use Realtime subscriptions only for new messages, not entire history. Consider batching notifications (send digest rather than per-message).

**No CDN for static assets:**
- Current capacity: Default Next.js deployment uses Vercel's global CDN (if deployed there).
- Limit: Images and fonts are served from a single region if not using Vercel or another CDN.
- Scaling path: Ensure images are optimized via Next.js `Image` component (already in use in home page). Use Supabase Storage with a CDN for user uploads. Preload fonts via `<link rel="preload">` in layout.

**Database row limits:**
- Current capacity: Supabase PostgreSQL instances scale, but free tier has limits on storage and connection count.
- Limit: Not tested yet. Once chat history grows (thousands of conversations, millions of messages), query performance may degrade.
- Scaling path: Implement indexes on `conversations.clientId` and `messages.conversationId`. Archive old conversations to a separate table. Use connection pooling.

## Dependencies at Risk

**Tailwind CSS v4 is new:**
- Risk: Tailwind v4 was released recently. CSS-first config is a breaking change from v3. Plugins and third-party integrations may lag. Upgrading to a newer v4.x minor release could break the CSS-first config.
- Impact: Design tokens won't render. UI breaks. Team gets blocked.
- Migration plan: Before upgrading Tailwind, test in a branch. Ensure `@tailwindcss/postcss` is updated together. Check for breaking changes in release notes. Run full visual regression test on all screens.

**Next.js 16.2 is stable but actively changing:**
- Risk: Next.js updates frequently. Version 16.2 is current but not long-term. Breaking changes in App Router patterns, Image component behavior, or font loading could force rewrites.
- Impact: Build might fail. Components might not render correctly after upgrade.
- Migration plan: Keep Next.js on LTS versions when possible. Before upgrading minor versions, test locally. Pin minor versions in `package.json` (currently "16.2.9", which is good).

**React 19 is new:**
- Risk: React 19 just shipped. useId, forwardRef, and other patterns used in components may have subtle changes. Server Components behavior could differ from React 18 patterns.
- Impact: Component behavior might break. Form state might behave unexpectedly.
- Migration plan: Monitor React release notes. Test thoroughly after any React upgrade. If issues arise, consider staying on React 18 until 19.x.1 or later (more stable).

**Supabase JavaScript client is not yet integrated:**
- Risk: `packages/supabase/src/auth.ts` and `database.types.ts` define contracts but the actual Supabase client (`@supabase/supabase-js`) is not listed in any `package.json`. When it's added, it introduces a large dependency tree.
- Impact: Auth and database features cannot be built. Package size increases.
- Migration plan: Add `@supabase/supabase-js` to `apps/web/` and `packages/supabase/` when building auth. Lock to a major version. Test client initialization and basic operations.

## Missing Critical Features

**No authentication system:**
- Problem: Users cannot sign up, log in, or authenticate. No session management.
- Blocks: Everything. All features depend on knowing who the user is.
- Priority: **CRITICAL — build first.**

**No client or coach profiles:**
- Problem: User metadata (display name, role, avatar) has a type contract but no UI, no API, no storage.
- Blocks: Personalization, onboarding, coach-client assignment.
- Priority: **HIGH — build second.**

**No onboarding:**
- Problem: New clients cannot fill out an assessment. Coaches cannot be assigned.
- Blocks: Coach-first validation. Product is not usable by end users.
- Priority: **HIGH — build third (data-driven form pattern).**

**No tracker engine:**
- Problem: Trackers are not rendered from configs. Templates are hard-coded (not implemented yet).
- Blocks: Learning feature validation. Core product value is missing.
- Priority: **HIGH — build fourth (configurable, not template-specific).**

**No 1-on-1 chat UI:**
- Problem: Edge Function stub exists but there's no web UI, no message history, no Realtime subscription, no typing indicators.
- Blocks: Coach-client communication (the core use case).
- Priority: **HIGH — build fifth.**

**No community or gamification:**
- Problem: Not planned yet. AGENTS.md explicitly says not to build this before foundations.
- Blocks: Stretch features.
- Priority: **LOW — wait until chat and tracker are validated and working.**

## Test Coverage Gaps

**No tests for UI components:**
- What's not tested: Button variants (primary, secondary, ghost), Input states (error/notice/hint), Card styling, Progress clamping and animation.
- Files: `apps/web/components/ui/`, `apps/web/app/page.tsx`
- Risk: A small CSS change to a component could break all screens. A refactor of Input logic could lose the autoId or notice styling.
- Priority: **MEDIUM — add vitest + React Testing Library after foundations are built. Start with Button and Input.**

**No tests for core types and logic:**
- What's not tested: `isUserRole()` role validation, `chatLimits` enforcement, message length validation logic (currently in Edge Function only).
- Files: `packages/core/src/`
- Risk: A bug in role checking or message validation could ship undetected.
- Priority: **MEDIUM — add vitest to packages/core and test all exported functions.**

**No integration tests for Edge Functions:**
- What's not tested: send-message function: missing conversationId, body > limit, invalid JWT, user not in conversation, successful message save.
- Files: `supabase/functions/send-message/index.ts`
- Risk: The function doesn't actually work yet; once implemented, regressions are invisible.
- Priority: **HIGH — after function is implemented, add Deno/Supabase emulator tests.**

**No E2E tests:**
- What's not tested: Full user journeys (sign up → onboarding → send message → receive notification).
- Files: N/A (no E2E framework set up)
- Risk: Product feels broken in production even if unit tests pass.
- Priority: **MEDIUM — add Playwright or Cypress after chat UI is built. Focus on critical flows (auth, chat send/receive).**

---

*Concerns audit: 2026-07-02*
