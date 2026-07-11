---
last_mapped_commit: 8db370815b16e6563aae8c1d7e1992697f5fd9d0
---

# Codebase Concerns

**Analysis date:** 2026-07-11

## Immediate Failures

### The committed unit-test suite is not green

- `pnpm typecheck` passes, but `pnpm --filter @fish/web test run` currently reports 1 failure out of 504 tests.
- `apps/web/tests/chat-state-fixtures.test.ts` unconditionally reads `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md`, which was removed by the recent planning-archive cleanup (`8db37081`). The test now fails with `ENOENT` on a clean checkout.
- This couples an executable product test to a planning artifact whose lifecycle differs from source code. Restore a durable checked-in protocol document or change the test to validate only canonical files under `packages/core/docs/`.

## Security and Privacy

### Community access is intentionally global, not membership-scoped

- `supabase/migrations/0014_demo_community_conversation.sql` changes `private.is_conversation_member` so every authenticated profile is a member of one fixed conversation. `supabase/migrations/0016_channels.sql` likewise lets every authenticated user read every channel row.
- This is acceptable only as a demo bridge. Any authenticated account can read and post in `general`; there is no channel membership, cohort, coach assignment, block, ban, or moderation boundary.
- The broad rule also makes future channel additions dangerous: adding rows without replacing the policy can expose channel metadata to the entire authenticated population.
- Replace the fixed-room exception with an explicit membership model before real client data or additional channels use this surface, and extend `scripts/verify-rls.ts` with cross-channel and removed-member denial cases.

### Chat commands have no application-level abuse controls

- `supabase/functions/send-message/index.ts` and `supabase/functions/chat-command/index.ts` authenticate callers and delegate authorization to database RPCs, but contain no per-user rate limit, payload-rate budget, spam control, or moderation hook.
- The database functions in `supabase/migrations/0013_realtime_chat_features.sql` enforce ownership and data integrity, not request frequency. An authenticated account can generate sustained messages, reactions, read writes, and realtime fan-out.
- Add rate limiting at the Edge Function boundary before public onboarding; the community room makes this higher priority than in a two-person coaching chat.

### Edge Function request validation is weaker than the server-action validation

- The Zod schemas in `apps/web/app/(authenticated)/chat/actions.ts` validate UUIDs and strict object shapes, but the public Edge Functions accept partial TypeScript casts at runtime.
- `supabase/functions/chat-command/index.ts` interpolates `conversationId` directly into PostgREST URLs for `refresh-conversation`, and does not validate it as a UUID. RLS limits direct data exposure, but malformed filters can still alter query behavior and create avoidable load/error paths.
- Share runtime schemas or repeat strict validation in the Edge Functions; URL-encode all filter values and reject unknown actions/fields early.

### Auth verification adds a network dependency and logs upstream bodies

- Both files under `supabase/functions/` call `/auth/v1/user` on every command even though `supabase/config.toml` also enables `verify_jwt = true`.
- This adds latency and makes Auth availability part of every chat write. Failure logging includes the upstream response body; today it should not include secrets, but logging raw authentication responses is an unnecessary privacy risk.
- Standardize one documented identity-validation path and log only status plus a correlation identifier.

## Performance and Scaling

### The deep refresh path is unbounded and performs N+1 reaction reads

- `supabase/functions/chat-command/index.ts` implements `refresh-conversation` by fetching the complete ordered message history, then calling `enrichMessage` for every message. Each enrichment paginates reactions with a separate HTTP request.
- `apps/web/app/(authenticated)/chat/actions.ts` has a local fallback with the same unbounded conversation read, although its reaction aggregation is batched more efficiently.
- Normal reconnects now use bounded gap backfill in `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts`, but `refreshConversation` remains a deep fallback in `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts`. A degraded client can therefore trigger work proportional to all history and message count.
- Remove or cap the full-history fallback, use the existing keyset/newest-window actions, and aggregate reactions in one bounded query or database view/RPC.

### Community read-state and profile visibility grow with every participant

- Initial hydration in `apps/web/lib/services/supabase/core.ts` reads all `message_reads` rows for the conversation, while `apps/web/app/(authenticated)/chat/chat-client.tsx` derives a member count from read states and loaded senders because no membership table exists.
- In a long-lived shared room this payload and derived count grow without a meaningful membership lifecycle; people who once read a message remain part of the inferred count.
- A real membership table should become the source of truth, with a bounded/count query rather than transferring all read-state rows just to infer room size.

### Presence creates continuous writes without cleanup infrastructure

- `apps/web/app/(authenticated)/chat/realtime.ts` maintains durable `presence_sessions` heartbeats; `supabase/migrations/0013_realtime_chat_features.sql` stores each session row and has no retention or cleanup job.
- Ended and abandoned rows will accumulate. The `(user_id, last_heartbeat_at desc)` index helps reads but does not bound storage.
- Add scheduled expiry/deletion and document the retention window before usage grows.

## Product and Data-Model Debt

### Routing ignores the requested channel ID

- `apps/web/app/(authenticated)/channels/[id]/page.tsx` accepts `[id]` but does not read route params; every URL resolves through `getChatPageData()` to the single hard-coded demo room.
- `apps/web/lib/services/supabase/core.ts` also hard-codes the demo conversation and channel identifiers instead of querying `public.channels`.
- Invalid or future channel URLs can silently display `general`, and the `channels` table is currently a naming layer that the application does not consume. Resolve the slug/ID from the route and enforce membership before adding a second channel.

### Generated database types are already behind the migrations

- `supabase/migrations/0016_channels.sql` creates `public.channels`, but `packages/supabase/src/database.generated.ts` contains no `channels` table entry.
- The current hard-coded service path hides this drift because it never queries the table. A future typed channel query will fail or encourage unsafe casts.
- Regenerate types after migrations and add a CI drift check against a reset local schema.

### Several visible controls are deliberate stubs

- `apps/web/components/chat/composer/add-menu.tsx` renders focusable Upload File, Audio Recording, and Create Poll menu items without handlers. `apps/web/components/chat/search-filters/filters-dialog.tsx` presents inert filter fields and closes on Apply without applying filters.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` searches only the currently loaded message window, so results are incomplete when older messages exist.
- These placeholders can feel broken and add choices contrary to the product's calm-focus rule. Hide unimplemented actions or label them honestly; implement server-backed search before implying whole-conversation results.

### The demo community surface conflicts with the repository's own product gate

- `AGENTS.md` says not to build the community feed before foundations are complete and coach validation is established, while `supabase/migrations/0014_demo_community_conversation.sql` and `/channels/[id]` expose a shared community room.
- The design spec calls this a demo bridge, but the production code path prefers it over the assigned 1-on-1 conversation in `apps/web/lib/services/supabase/core.ts`.
- Confirm and record the coach-validation/product decision before treating the community route as a release feature; otherwise keep it seed/dev-only and restore 1-on-1 assignment as the primary path.

## Fragile Areas

### Chat state reconciliation has many synchronized representations

- Message state crosses SQL rows, generated Supabase types, service-layer DTOs, Edge Function response maps, `@fish/core` reducer state, Zustand hydration keys, and realtime payload conversion.
- `apps/web/app/(authenticated)/chat/store/chat-store.ts`, `packages/core/src/chat-state/reducer.ts`, and `packages/core/src/chat-state/selectors.ts` rely on explicit field-by-field mapping/equality. Adding a message field requires updating every path or stale data can win reconciliation.
- Preserve fixture-driven coverage, but keep its canonical documentation under stable source paths so archive operations cannot break the suite again.

### Error classification depends on message text

- `supabase/functions/send-message/index.ts`, `supabase/functions/chat-command/index.ts`, and `apps/web/app/(authenticated)/chat/actions.ts` map database failures by checking substrings such as `"too long"`, `"conflicts"`, and `"not found"`.
- Renaming a PostgreSQL exception silently changes the HTTP status and user notice. Prefer stable SQLSTATE/detail codes or structured RPC results, and test the mapping contract.

### Fixed UUIDs and migration ordering are operational assumptions

- The community conversation/channel IDs are duplicated across `supabase/migrations/0014_demo_community_conversation.sql`, `supabase/migrations/0016_channels.sql`, `apps/web/lib/services/supabase/core.ts`, and seed scripts.
- `0016_channels.sql` may skip channel creation on an empty database until `scripts/seed.ts` creates profiles/conversation data. Production must not run that dev seed, so deploy behavior depends on separate manual setup.
- Replace duplicated constants with database lookups and provide an explicit production-safe provisioning path.

## Test and Operational Gaps

- There is no `.github/workflows/` directory, so build, lint, unit tests, generated-type drift, migration reset, RLS verification, and Playwright checks are not enforced by repository CI.
- The Vitest suite heavily covers web/state behavior, but there are no colocated tests for `supabase/functions/send-message/index.ts` or `supabase/functions/chat-command/index.ts`.
- `scripts/verify-rls.ts` and `scripts/verify-chat-realtime.ts` are valuable manual checks but require local Supabase and are not part of the default `pnpm build` or test command.
- `docs/deploy-checklist.md` is stale: it describes pushing only early migrations and does not cover the current chat, realtime, demo community, reactions, and channels migrations or Edge Function deployment/secrets.
- Add a clean-checkout CI pipeline and update the deployment runbook before the first hosted release.

## Prioritized Remediation

1. Fix the clean-checkout test failure caused by the archived planning document.
2. Decide whether the community bridge is releaseable; if yes, add membership, moderation, and rate limits before real client use.
3. Make channel routing/data lookup real and regenerate database types.
4. Bound or remove full-conversation refresh and N+1 reaction enrichment.
5. Add CI for build/lint/tests, schema reset/RLS checks, type generation drift, and Edge Function tests.
6. Remove inert UI actions and refresh the hosted deployment checklist.
