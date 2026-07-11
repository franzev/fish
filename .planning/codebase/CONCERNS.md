---
last_mapped_commit: ffc0af5c4a67160e838b07ffa6e26652f9ca337d
---

# Codebase Concerns

**Analysis Date:** 2026-07-11

## Tech Debt

**Incomplete product foundation (legacy concern):**
- Issue: Core features foundational to the product were not yet implemented as of 2026-07-02. The codebase is now substantially further along with chat features, auth, and sophisticated state management, but work remains on learning features (tracker engine, coaching tools).
- Files: Auth context exists; chat schema created; Edge Functions partially implemented
- Impact: Product is usable by early users for 1-on-1 and community chat. Tracker/coaching features still missing.
- Fix approach: Follow roadmap phases in `.planning/phases/` — phases 04–10 completed; roadmap extends beyond v1.2.

**Pagination retry logic lacks backoff and error visibility:**
- Issue: `.planning/debug/loading-earlier-messages-retry-storm.md` diagnosed an unbounded retry loop. When `loadOlderMessagesAction` fails, `use-load-older-messages.ts` re-attaches an `IntersectionObserver` immediately. Since the sentinel (top-of-list) remains visible, the observer callback fires again, re-triggering the load with no delay, backoff cap, or retry counter. No visible error affordance exists for a stuck older-page load — only the loading skeleton flickers.
- Files: `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts` (47–64), `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` (225–265), `packages/core/src/chat-state/reducer.ts` (184–196)
- Impact: A failed older-message load can create a tight retry loop that hammers the server and leaves the UI flickering. User reads this as "the app breaks."
- Fix approach: Add a bounded backoff (e.g., exponential delay with max attempts, e.g., 3 tries then stop) in `use-load-older-messages.ts`. Disconnect the observer after a failure until the user manually retries (or add a distinct error affordance + retry button in `chat-client.tsx`, separate from the loading skeleton). Add a component-level test that mocks `loadOlderMessagesAction` to reject, observes the sentinel remains visible, and asserts the action is not called an unbounded number of times.

**Chat message merge equality comparisons are extensive:**
- Issue: `packages/core/src/chat-state/selectors.ts` contains complex deep-equality checks for messages and read states (`areChatMessagesEqual`, `areReactionsEqual`, `areReadStatesEqual`). Any missed field in a comparison can cause stale state to survive a merge, leading to stale UI or missed updates.
- Files: `packages/core/src/chat-state/selectors.ts` (68–112)
- Impact: A missed field in equality comparison (e.g., a new optional field added to `ChatMessageState` that is not in the equality check) can cause the reducer to skip an update when it should commit. Messages appear to freeze or revert to stale values.
- Fix approach: Unit test each equality function with a comprehensive suite of mutation cases (e.g., toggling each field to a different value and asserting the result is `false`). Consider a generic deep-equality utility to reduce manual comparison logic. Document why `senderDisplayName` is treated specially (server ACKs omit it; client retains known values).

**Edge Functions verify JWT via HTTP fetch fallback:**
- Issue: `supabase/functions/send-message/index.ts` (67–79) and `supabase/functions/chat-command/index.ts` (56–82) call `/auth/v1/user` via fetch to verify the caller. This is a fallback for environments where Supabase's built-in auth context is not available (e.g., local Deno). If Supabase's auth or the function's JWT verification becomes misconfigured, this fallback may succeed when it should fail, or vice versa.
- Files: `supabase/functions/send-message/index.ts` (67–79), `supabase/functions/chat-command/index.ts` (56–82)
- Impact: Auth boundary unclear. If the `/auth/v1/user` endpoint changes or is redirected, the function may not receive the correct caller ID, leading to authorization bypass or incorrect user attribution.
- Fix approach: Document the auth fallback strategy (e.g., "local Deno does not expose Supabase auth context; production may use built-in Deno context instead"). Add logging that records which auth path was used (built-in vs. fallback). Consider raising an error in production if the fallback is triggered unexpectedly.

## Known Bugs

**Loading newer messages inconclusive (phase 10 investigation):**
- Issue: `.planning/debug/loading-new-messages.md` documents an inconclusive investigation. User reported "loading new messages is broken" during UAT, but functional delivery was not reproduced in two independent browser sessions. Both synthetic messages rendered exactly once without refresh, including after receiver restoration. However, raw WebSocket frames, callback status transitions, and HTTP response statuses were not exposed, so the protocol classification remains inconclusive.
- Files: `apps/web/app/(authenticated)/chat/` (route, ChatClient, hooks, store)
- Current mitigation: Functional delivery tests pass locally. The issue may be stale UAT report, environment-specific (live Supabase), or related to avatar/timestamp grouping (separate presentation concern).
- Recommendations: Reproduce with WebSocket/request capture exposed (e.g., browser DevTools or Supabase realtime logs). If a real delivery failure exists, it likely involves auth state, realtime subscriptions, route/channel mismatch, or store hydration.

**Stale subscription callbacks retained reconnect ownership (phase 10 resolved):**
- Issue: `.planning/debug/knowledge-base.md` records a resolved bug: subscription effect generations had no synchronous callback-ownership revocation. When a user switched conversations, stale callback handlers from the previous conversation's unsubscribe could remain authoritative, reassigning state refs already belonging to the new conversation.
- Files: `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts`, `apps/web/app/(authenticated)/chat/chat-client.test.tsx`
- Fix applied: Added effect-local active guards to messages, reads, and reactions callbacks; revoked ownership before unsubscribe; retained promise-identity settlement.
- Residual risk: Ensure any future subscription cleanup (e.g., realtime channel removal, auth logout) also revokes callback ownership synchronously. Test conversation switch and logout flows end-to-end.

## Security Considerations

**Edge Function JWT verification is incomplete (historical):**
- Risk: `supabase/functions/send-message/index.ts` does not extract JWT claims or validate user ownership of the conversation at the function level. An authenticated user could send messages on behalf of another user.
- Files: `supabase/functions/send-message/index.ts` (24–125)
- Current mitigation: Supabase's `verify_jwt = true` in `supabase/config.toml` (lines 30–31) ensures the function rejects unauthenticated requests. The underlying `/auth/v1/user` call (line 67) extracts the caller's identity. The `/rpc/send_chat_message` RPC (line 81) delegates authorization to database RLS policies.
- Recommendations: Document the auth delegation explicitly. Add a comment in the function explaining: "JWT verification is delegated to Supabase's `verify_jwt` gate; caller identity is extracted via `/auth/v1/user`; authorization (conversation membership) is enforced at the RLS level in the `send_chat_message` RPC."

**No RLS policies documented in scope (schema exists):**
- Risk: Database RLS policies control who can read/write messages and read states. If policies are missing or misconfigured, a coach can read all clients' messages, a client can see other clients' conversations, etc.
- Files: `packages/supabase/src/database.types.ts` (generated from schema), `supabase/migrations/` (outside scope but critical)
- Current mitigation: Schema tables exist (messages, conversations, message_reads, message_reactions) per `database.types.ts`. RLS policies are defined in migrations (outside current scope).
- Recommendations: Add a `supabase/migrations/README.md` documenting the RLS strategy for each table. Verify that `messages`, `conversations`, and `message_reads` tables all have policies preventing cross-conversation/cross-role access.

**Auth state not synchronized between web and Supabase (session handling):**
- Risk: If the web app and Supabase auth become out of sync (e.g., token expires but session context doesn't refresh), users may see stale auth state or failed requests with no clear error.
- Files: Auth context exists (outside scoped paths); Supabase client initialization expected in `apps/web/lib/` (outside current scope)
- Current mitigation: Session restore is handled on app load (code exists outside scope). Logout likely clears both web and Supabase state.
- Recommendations: Add a synchronized session listener that re-fetches user profile and role on auth state changes. Log auth state transitions for debugging.

**Secrets management not verified in scope:**
- Risk: Supabase API keys, signing keys, and JWT secrets must not be checked into git.
- Files: `.env` files (not readable per forbidden_files); `.gitignore` should exclude `*.env*`
- Current mitigation: `.env.local` and `.env.production` should be in `.gitignore` (verify with `git check-ignore`).
- Recommendations: Ensure `.env*` files are in `.gitignore`. Use `.env.example` to document required var names (not values). In CI/CD, inject secrets via environment variables, not committed files.

## Performance Bottlenecks

**Message equality comparisons on every merge:**
- Issue: `mergeChatMessage` calls `areChatMessagesEqual` for every incoming message to check if state changed (selectors.ts:42). The equality function iterates through all message fields including reactions. With thousands of messages in history, this could add measurable overhead during batch merges (e.g., pagination load, reconnect backfill).
- Files: `packages/core/src/chat-state/selectors.ts` (16–48, 68–88), `packages/core/src/chat-state/reducer.ts` (224–244)
- Impact: Not yet measured; likely negligible for single-message updates. Becomes a concern if pagination loads 50+ messages at once and each calls the full equality check.
- Improvement path: Profile message merge perf with realistic data volumes. If equality check is a bottleneck, consider shallow equality (id + timestamp only), or cache the last-merged state to avoid recomputation.

**Realtime reconnect may backfill stale messages:**
- Issue: When realtime reconnects after a network hiccup, the app may re-hydrate the full conversation history. If the reconnect delay is long, the backfilled messages may be slightly older than the last known newest message, causing duplicates or out-of-order display.
- Files: `apps/web/app/(authenticated)/chat/` (realtime hooks, store actions — outside scope but relevant to merged state)
- Improvement path: Implement a `lastKnownMessageId` checkpoint so reconnect backfill can start from "last known + 1" rather than re-fetching the entire history. Document the exact backfill boundaries in comments.

**No indexed queries for conversation participants:**
- Issue: `supabase/functions/chat-command/index.ts` (302–335) fetches all messages in a conversation to render the conversation view. If a conversation has thousands of messages, this query could slow down.
- Files: `supabase/functions/chat-command/index.ts` (302–335)
- Improvement path: Already uses pagination (no `limit` in the query shown, but context suggests pagination exists elsewhere). Document any cursor-based pagination strategy. Add a database index on `messages.conversation_id` if not present. Consider a cursor-based `limit=50` strategy for the initial hydration.

## Fragile Areas

**Chat state reducer merges complex message reconciliation logic:**
- Files: `packages/core/src/chat-state/reducer.ts` (entire file, especially 224–377)
- Why fragile: The reducer handles multiple message states (pending, sending, sent, failed) and must reconcile optimistic sends, retries, server ACKs, and realtime updates. The `mergeHydratedMessages` function (255–269) specifically preserves unresolved local sends during a reconnect snapshot, then merges the server snapshot on top. Any mistake in merge order or deduplication logic can cause:
  - Duplicate messages (same message rendered twice)
  - Lost messages (optimistic send dropped during merge)
  - Out-of-order display (sort comparator bug)
  - Stale state (equality check misses a field)
- Safe modification: Add extensive test coverage for all combinations: optimistic send + server ACK (success), optimistic send + server rejection + local retry, optimistic send + reconnect before ACK (preserve local), server ACK while user is typing (don't restore draft). Use fixtures from `packages/core/src/chat-state/fixtures/chat-state-vectors.json` and add new vectors for edge cases. Document the merge strategy in comments referencing the test file.
- Test coverage: `packages/core/src/chat-state/` has fixtures and tests (outside scope), but the gap from earlier concerns is whether failure cases are tested.

**Pagination cursor logic with optional fields:**
- Files: `packages/core/src/chat-state/types.ts` (53–68), `packages/core/src/chat-state/reducer.ts` (179–197)
- Why fragile: `ChatMessageCursor` has `createdAt` and `id` fields. The pagination state tracks `oldestLoadedCursor` (null if no older messages yet) and `hasMoreOlder`. If the cursor becomes null but `hasMoreOlder` is true, a later load attempt might re-fetch duplicates or skip a page. If the sort comparator (selectors.ts:8–13) incorrectly orders messages with the same `createdAt`, pagination boundaries may overlap.
- Safe modification: Add tests that exercise cursor boundaries, including messages with identical `createdAt` timestamps (millisecond precision matters). Verify the sort comparator is stable (same timestamp + ID always produces the same order). Document the cursor invariant: "After a successful load, `oldestLoadedCursor` is the message at the boundary of the loaded range; `hasMoreOlder` is true iff there are unpaginated messages older than the cursor."

**Edge Function error handling uses string matching:**
- Files: `supabase/functions/send-message/index.ts` (96–122), `supabase/functions/chat-command/index.ts` (160–188)
- Why fragile: Error classification relies on `.toLowerCase().includes()` pattern matching. If Supabase's RPC error messages change, the mapping will silently fail and return the generic 500 error instead of a specific calm error. Users see "that did not send yet" instead of "the message was too long" and cannot understand the issue.
- Safe modification: Implement proper error code mapping. Ask Supabase to return a structured error code (not just a message). Parse the code and dispatch to the correct calm error. Add a test that mocks different error messages and verifies the correct calm error is returned. Document the expected error messages in comments referencing the RPC signatures.

**Database types are generated (not hand-written):**
- Files: `packages/supabase/src/database.generated.ts` (630 lines, auto-generated), `packages/supabase/src/database.types.ts` (hand-written re-export)
- Why fragile: `database.generated.ts` is regenerated from the Supabase schema via `supabase gen types`. If a developer changes the schema in migration but forgets to regenerate the types, TypeScript type definitions are stale. If a developer manually edits `database.generated.ts`, the next regeneration will overwrite the changes.
- Safe modification: Add a CI check that runs `supabase gen types` and verifies `database.generated.ts` matches the schema. Document the regeneration step in `.planning/DEVELOPMENT.md` or similar. Never manually edit `database.generated.ts` — all changes go through migrations and regeneration.

## Scaling Limits

**Real-time messaging relies on Supabase Realtime:**
- Current capacity: Unknown — Supabase Realtime scales horizontally; free tier has rate limits.
- Limit: If thousands of clients and coaches chat simultaneously, Realtime subscriptions may slow down or become expensive. Reaction updates (toggling emoji per message) create additional broadcast overhead.
- Scaling path: Implement message pagination (load last N on open, fetch newer on scroll or poll). Use Realtime subscriptions only for new messages and reactions to already-loaded messages, not entire history. Batch notifications if needed (e.g., "3 new messages" digest instead of per-message push).

**No CDN for static assets (outside scoped paths):**
- Current capacity: Default Next.js deployment uses Vercel's global CDN (if deployed there).
- Limit: Images and fonts are served from a single region if not using Vercel or another CDN.
- Scaling path: Ensure images are optimized via Next.js `Image` component. Use Supabase Storage with a CDN for user uploads. Preload fonts via `<link rel="preload">` in layout.

**Database row limits:**
- Current capacity: Supabase PostgreSQL instances scale, but free tier has limits on storage and connection count.
- Limit: Not tested. Once chat history grows (millions of messages across thousands of conversations), query performance may degrade.
- Scaling path: Implement indexes on `conversations.clientId`, `messages.conversation_id`, `message_reads.conversation_id`. Archive old conversations to a separate table if needed. Use connection pooling.

## Dependencies at Risk

**Tailwind CSS v4 is new:**
- Risk: Tailwind v4 was released recently. CSS-first config is a breaking change from v3. Plugins and third-party integrations may lag. Upgrading to a newer v4.x minor release could break the CSS-first config.
- Impact: Design tokens won't render. UI breaks. Team gets blocked.
- Migration plan: Before upgrading Tailwind, test in a branch. Ensure `@tailwindcss/postcss` is updated together (same version). Check for breaking changes in release notes. Run full visual regression test on all screens.

**Next.js 16.2 is stable but actively changing:**
- Risk: Next.js updates frequently. Version 16.2 is current but not long-term. Breaking changes in App Router patterns, Image component behavior, or font loading could force rewrites.
- Impact: Build might fail. Components might not render correctly after upgrade.
- Migration plan: Keep Next.js on stable versions when possible. Before upgrading minor versions, test locally. Pin minor versions in `package.json` (currently "16.2.9", which is good).

**React 19 is new:**
- Risk: React 19 just shipped. `useId`, `forwardRef`, and other patterns used in components may have subtle changes. Server Components behavior could differ from React 18 patterns.
- Impact: Component behavior might break. Form state might behave unexpectedly.
- Migration plan: Monitor React release notes. Test thoroughly after any React upgrade. If issues arise, consider staying on React 18 until 19.x.1 or later (more stable).

**Supabase JavaScript client integration:**
- Risk: `packages/supabase/src/auth.ts` and `database.types.ts` define contracts but the actual Supabase client (`@supabase/supabase-js`) is expected to exist in `apps/web/package.json` (outside scope). If it's missing or locked to an old version, auth and database features don't work.
- Impact: Auth and database features are broken. Package size increases if version is bloated.
- Migration plan: Verify Supabase client is present and up-to-date in `apps/web/package.json`. Lock to a major version (e.g., `^3.0.0`). Test client initialization and basic operations after any Supabase version upgrade.

## Missing Critical Features (Legacy)

**No tracker engine:**
- Problem: Trackers (habit tracking, learning progress) are not rendered from configs. Templates are hard-coded (not implemented).
- Blocks: Learning feature validation. Core product value.
- Priority: **HIGH — in later phases beyond v1.2**

**No community or gamification:**
- Problem: Not planned yet. AGENTS.md explicitly says not to build before foundations.
- Blocks: Stretch features.
- Priority: **LOW — wait until chat and tracker are validated**

## Test Coverage Gaps

**No tests for older-message pagination failure case:**
- What's not tested: `loadOlderMessagesAction` rejecting or returning `status: "notice"` with the sentinel still visible. The retry behavior and user affordance for a stuck load.
- Files: `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts`, `apps/web/app/(authenticated)/chat/chat-client.test.tsx`
- Risk: A failed older-message load can create an unbounded retry loop (as diagnosed in `.planning/debug/loading-earlier-messages-retry-storm.md`), and there's no test to catch regressions.
- Priority: **HIGH — block fix until test is added**

**Limited message merge edge-case coverage:**
- What's not tested: All combinations of message state transitions (optimistic + ACK, optimistic + rejection + retry, optimistic + reconnect before ACK, server update while drafting, etc.). Equality function coverage for all message fields.
- Files: `packages/core/src/chat-state/`
- Risk: A missed field in equality comparison or a wrong merge order can cause duplicates, lost messages, or stale state.
- Priority: **MEDIUM — add comprehensive merge test suite**

**No integration tests for Edge Functions:**
- What's not tested: `send-message` and `chat-command` functions end-to-end. Testing variations: missing conversationId, body > limit, invalid JWT, user not in conversation, successful message save with reaction enrichment.
- Files: `supabase/functions/send-message/index.ts`, `supabase/functions/chat-command/index.ts`
- Risk: Edge Functions don't actually work until tested. Regressions are invisible.
- Priority: **MEDIUM — use Supabase CLI local emulator or Deno test runner**

**No E2E tests for auth flows:**
- What's not tested: Full auth journeys (sign up → verify email → set password → login). Edge cases (expired link, already verified, wrong password, token refresh).
- Files: Auth routes (outside scope)
- Risk: Auth feels broken in production even if unit tests pass.
- Priority: **MEDIUM — add Playwright or Cypress after chat is stable**

---

*Concerns audit: 2026-07-11*
