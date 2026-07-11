# Phase 7: Chat Schema - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** `$gsd-discuss-phase 7`; user selected all gray areas and authorized recommended defaults

<domain>
## Phase Boundary

Deliver the chat data foundation before any route, Edge Function persistence, UI, subscriptions, presence, or typing indicators:

- `conversations`, `messages`, and `message_reads` exist in Supabase with one 1-on-1 conversation per assigned coach-client pair.
- Both members of a conversation can read persisted history through membership-scoped RLS.
- Message writes are proven through a database-owned command path that derives the sender from `auth.uid()`, enforces membership, validates body constraints, and preserves idempotency.
- Stored messages are immutable to authenticated users: no update/delete grant, no update/delete policy, and verification proves attempted mutation fails.
- Ordering is stable and realtime-ready through `(conversation_id, created_at, id)` indexing, but realtime subscriptions themselves stay out.
- `pnpm verify:rls` proves member-read, outsider denial, cross-client denial, immutable messages, and duplicate `client_request_id` idempotency.
- Legacy handwritten chat database contracts are removed from `packages/supabase`; generated `*Row` aliases become the canonical surface after migration/type generation.

**Not in this phase:** chat route, web composer, optimistic UI, retry UI, Edge Function persistence, realtime subscriptions, presence, typing, read-receipt UI, message edit/delete/reactions/search, attachments, group chat, notifications, moderation, AI replies, assignment UI, or community features.

</domain>

<decisions>
## Implementation Decisions

### Write posture and sender trust
- **D-01:** Use a database-owned authenticated write path: expose a `send_chat_message` RPC (or equivalently named PostgreSQL function) as the Phase 7 insert surface. It must derive `sender_id` from `auth.uid()` and derive/check sender role from `profiles`; callers never supply trusted sender identity.
- **D-02:** The RPC must enforce conversation membership before inserting. It should compose the conversation's stored `client_id`/`coach_id` pair with the existing `private.is_coach_of` / `private.is_client_of` discipline rather than trusting application-side filtering.
- **D-03:** Phase 8's real `send-message` Edge Function should call this RPC rather than duplicating message-integrity logic. The Edge Function will still verify JWT and membership before service-role-sensitive operations, but the database remains the un-bypassable integrity layer.
- **D-04:** Do not allow broad authenticated direct table inserts into `messages`. Grant authenticated callers execute permission on the RPC and select permissions through RLS; keep table writes either RPC-owned or service-role-owned. Verification can prove member writes by calling the RPC as real anon-key sessions.

### Conversation lifecycle
- **D-05:** Seed exactly one conversation for each existing `coach_clients` assignment in v1.1 dev seed data. The Phase 7 schema should enforce one active thread per assigned pair with a unique `(client_id, coach_id)` constraint or equivalent unique index.
- **D-06:** Conversations preserve history for the pair they were created for. Assignment UI/reassignment is out of scope, so do not design complex reassignment behavior now. If a future assignment changes, a future phase can decide archive/visibility rules explicitly; this phase should avoid destructive cascades that would erase message history unexpectedly.
- **D-07:** `conversations` should store explicit `client_id` and `coach_id` references to `profiles`, not infer membership only through `coach_clients` joins. RLS can require the current assignment relationship for access in v1.1, while the row itself keeps stable historical intent.
- **D-08:** Use calm default-deny behavior for non-members: selects return zero rows rather than distinguish "conversation does not exist" from "not your conversation."

### Read-state footprint
- **D-09:** Implement `message_reads` as a quiet per-member pointer, not per-message receipts: one row per `(conversation_id, user_id)` with `last_read_message_id` and `read_at` (or similarly named fields). This keeps the data model realtime-ready without building read-receipt UI.
- **D-10:** `message_reads` belongs in Phase 7 because the roadmap explicitly names read-state tables, but all visible read receipts, unread badges, live updates, and typing/presence indicators are deferred.
- **D-11:** Members may read only their own read-state row and, if useful for later coach/client parity, the other participant's row through conversation membership. Writes should be constrained so a user can only mark their own membership as read, never mutate the other participant's state.
- **D-12:** The initial seed may create read-state rows for each seeded conversation member, but missing rows should not break message history reads. Planners can choose seed rows plus an upsert RPC if that keeps verification clean.

### Message integrity guardrails
- **D-13:** Enforce message body constraints in the database now: non-empty after trim and length `<= 4000`, matching `chatLimits.messageBodyMaxLength` and the existing Edge Function stub's user-facing behavior. Empty, whitespace-only, and oversized copy handling remains Phase 8, but invalid data must not persist.
- **D-14:** Make `client_request_id` required for the authenticated send RPC and store it on `messages`. The database enforces idempotency with a unique index on `(conversation_id, client_request_id)`. Phase 8 can require the client/Edge Function to generate this value for every send.
- **D-15:** Implement duplicate `client_request_id` behavior as idempotent return, not an unhandled hard failure: a retry with the same `(conversation_id, client_request_id)` should return the existing message when the sender/body match. If the same key is reused with conflicting body/sender, reject it.
- **D-16:** Stored messages are immutable for authenticated users. Do not add edit/delete/soft-delete/redaction columns in this phase. If moderation or retention needs redaction later, design a future service-role-only moderation path deliberately rather than exposing ambiguous message mutation now.
- **D-17:** Stable ordering uses server timestamps plus a deterministic tie-breaker: index messages on `(conversation_id, created_at, id)`. The route in Phase 8 can order by these columns without relying on client clocks.

### Verification and release gates
- **D-18:** `pnpm verify:rls` must add Phase 7 assertions for: member-read as client, member-read as coach, unassigned-coach denial, cross-client denial, outsider direct table/RPC send denial, immutable update rejection, duplicate `client_request_id` idempotency, conflicting duplicate rejection, and body constraint rejection.
- **D-19:** Generate Supabase database types after migration, remove `LegacyChatContracts`, and add real aliases for `ConversationRow`, `MessageRow`, and `MessageReadRow` in `packages/supabase/src/database.types.ts`.
- **D-20:** `pnpm build` must be green. If existing chat core DTOs need to align with generated snake_case rows, prefer adding explicit mapper/row aliases rather than pretending old camelCase legacy contracts are live database tables.

### the agent's Discretion
- Exact migration number, SQL function names, enum/check strategy, whether `message_reads` stores `last_read_message_id` nullable or a separate `last_read_at` only, and whether the idempotent RPC returns a table row or a compact result object.
- Exact seed message bodies, provided they are neutral dev fixtures and do not imply learning-content validation.
- Exact verifier helper names and assertion ordering, provided the required security/integrity cases above are covered by real anon-key sessions and service-role is used only for setup/negative fixture resolution.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` section "Phase 7: Chat Schema" - phase goal, no-UI/no-subscription boundary, success criteria, and chat-specific gates.
- `.planning/REQUIREMENTS.md` - CHAT-01, CHAT-04, CHAT-06, plus XC-01. Phase 8 owns CHAT-02/03/05/07 and XC-04.
- `.planning/PROJECT.md` sections "Current Milestone: v1.1 The Coaching Loop", "Constraints", and "Key Decisions" - coach-first, seed-only assignment, Supabase-only backend, RLS-as-read-boundary.
- `.planning/STATE.md` sections "v1.1 roadmap decisions", "Accumulated Context", and "Todos / open questions" - chat split rationale and note that Phase 7/8 is the highest-complexity surface.

### Prior dependency context
- `.planning/phases/04-client-profiles/04-CONTEXT.md` - coach-client relationship discipline, RLS helper reuse, protected field patterns.
- `.planning/phases/05-data-driven-onboarding/05-CONTEXT.md` - versioning/immutability discipline, zod-out-of-core precedent, verifier extension patterns.
- `supabase/migrations/0003_coach_clients.sql` - seeded assignment relationship and role-integrity trigger.
- `supabase/migrations/0004_rls_helpers.sql` - `private.is_coach_of` helper and recursion-safe SECURITY DEFINER style.
- `supabase/migrations/0006_client_reads_coach_name.sql` - `private.is_client_of` helper and reverse member-read discipline.
- `supabase/migrations/0008_onboarding.sql` - newest schema/RLS/RPC style, grants, trigger/function conventions.
- `scripts/verify-rls.ts` - live anon-session RLS assertion harness to extend.

### Existing chat contracts
- `packages/core/src/chat.ts` - current chat DTOs and `chatLimits.messageBodyMaxLength = 4000`; update carefully if database row shape requires it.
- `packages/supabase/src/database.types.ts` - remove `LegacyChatContracts`; add generated chat row aliases after migration/type generation.
- `packages/supabase/src/database.generated.ts` - generated schema output after local Supabase migration is applied.
- `supabase/functions/send-message/index.ts` - current validation-only stub; Phase 8 replaces persistence, but Phase 7 should leave it compatible with the new RPC boundary.

### Product and platform rules
- `AGENTS.md` - product rule, API boundary, design rules, Supabase command-write guidance, and no community/gamification/streaks.
- `docs/ui-ux-agent-guidelines.md` - mandatory only for user-facing UI; Phase 7 has no UI, but Phase 8 agents must read it before route work.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/0004_rls_helpers.sql` - recursion-safe helper template using SECURITY DEFINER, stable SQL, and `set search_path = ''`.
- `supabase/migrations/0008_onboarding.sql` - latest migration style for RLS-protected tables, service-role grants, authenticated select grants, and authenticated RPCs.
- `scripts/verify-rls.ts` - existing pattern signs in with the publishable anon key so policies are genuinely in force; extend this rather than creating a separate verifier.
- `scripts/seed.ts` - existing seeded coach/client accounts and assignments; extend it to create one conversation per seeded assignment and optional starter messages/read-state.
- `packages/core/src/chat.ts` - central message limit and DTO surface used by the Edge Function stub.

### Established Patterns
- RLS is the sole read authorization boundary; app code does not substitute manual filtering for policy.
- Security definer helper functions are acceptable when they avoid recursive RLS reads and explicitly set `search_path = ''`.
- Server/service-role paths may seed or administer data, but user-facing authorization must be proven through anon-key authenticated sessions.
- New tables require explicit grants before RLS behavior can be tested.
- Protected or immutable data is enforced at the database layer, not just through UI or TypeScript.
- Planning should keep zod out of `packages/core`; Phase 7 probably does not need zod because it is schema/RPC-only and Phase 8 owns command payload validation.

### Integration Points
- New migration after `supabase/migrations/0008_onboarding.sql`, likely `0009_chat.sql`.
- `scripts/seed.ts` must create dev conversations/messages after profiles and coach-client rows exist.
- `scripts/verify-rls.ts` must add chat setup/reset helpers and assertions after existing onboarding checks.
- `packages/supabase/src/database.types.ts` must export real generated row aliases once `database.generated.ts` includes chat tables/functions.
- Phase 8 will connect `supabase/functions/send-message/index.ts` and the web chat route to the RPC created here.

</code_context>

<specifics>
## Specific Ideas

- Prefer SQL names that mirror the rest of the repo: snake_case columns in Supabase, generated row aliases in TypeScript, and explicit comments where RLS or idempotency behavior is security-sensitive.
- Message fixtures should be boring and service-like, e.g. "Welcome. This is your coaching thread." Avoid implying validated lesson technique or automated AI advice.
- Idempotency should be kind to retries: same key returns the existing message; conflicting key reuse is rejected so accidental duplicate taps are safe but corrupted clients are caught.

</specifics>

<deferred>
## Deferred Ideas

- Realtime subscriptions, presence, typing, read-receipt UI, unread badges, and live updates - future chat layer; schema should be ready but behavior is out of scope.
- Message edit/delete/redaction/moderation - future service-role-only moderation/privacy design, not an authenticated user feature now.
- Attachments, voice notes, search, reactions, group chat, notifications, community feed, and AI replies - future milestones or explicitly barred until foundations and coach validation.
- Assignment/reassignment UI and historical archive rules - future assignment/admin phase.
- Chat route, composer, optimistic send lifecycle, calm oversized/empty validation copy, and draft preservation - Phase 8.

</deferred>

---

*Phase: 7-Chat Schema*
*Context gathered: 2026-07-05*
