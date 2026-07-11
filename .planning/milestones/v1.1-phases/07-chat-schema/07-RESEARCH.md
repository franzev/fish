# Phase 7: Chat Schema - Research

**Researched:** 2026-07-05  
**Domain:** Supabase/Postgres chat schema, RLS, database RPC idempotency, generated types  
**Confidence:** HIGH for codebase fit; HIGH for RLS/RPC/security-definer guidance from official Supabase/PostgreSQL docs.

## Summary

Phase 7 should be implemented as one tightly coupled schema/security slice: a chat migration, seeded one-conversation-per-assignment fixtures, generated Supabase row aliases, and live `verify:rls` assertions. The phase should not build route/UI/realtime. The key risk is not table creation; it is proving that only the assigned coach/client pair can read or write messages, that message rows cannot be mutated, and that retry idempotency cannot duplicate messages.

Recommended approach:

- Add `supabase/migrations/0009_chat.sql` with `conversations`, `messages`, `message_reads`, RLS policies, a private membership helper, and `public.send_chat_message(...)`.
- Keep authenticated users away from direct `messages` inserts. Grant `execute` on the RPC and `select` through RLS.
- Derive `sender_id` and `sender_role` from `auth.uid()` / `profiles`; never trust sender identity from payload.
- Enforce trimmed non-empty body, max 4000 chars, required `client_request_id`, unique `(conversation_id, client_request_id)`, immutable messages, and stable `(conversation_id, created_at, id)` ordering in the DB.
- Extend `scripts/seed.ts` with seeded conversations and `scripts/verify-rls.ts` with real anon-key session assertions.
- Regenerate `packages/supabase/src/database.generated.ts`, remove `LegacyChatContracts`, and export `ConversationRow`, `MessageRow`, `MessageReadRow`.

## Official Guidance Used

- Supabase RLS docs describe RLS as defense-in-depth and show policy enforcement tied to `auth.uid()`; FISH already follows this with `private.is_coach_of` and `private.is_client_of`. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Database Functions docs and JS `rpc` docs support calling Postgres functions from clients, which fits the planned authenticated command surface. Sources: https://supabase.com/docs/guides/database/functions and https://supabase.com/docs/reference/javascript/rpc
- Supabase Edge Function auth docs recommend keeping JWT verification enabled and using a user-scoped Supabase client for signed-in callers. Phase 8 should call the Phase 7 RPC through that boundary. Source: https://supabase.com/docs/guides/functions/auth
- Supabase troubleshooting docs clarify that security-definer helper functions used inside RLS do not need to be exposed to the API if referenced with an explicit schema. Source: https://supabase.com/docs/guides/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw
- PostgreSQL docs warn that `SECURITY DEFINER` functions require a controlled `search_path`; the repo already uses `set search_path = ''` and schema-qualified references, which should continue here. Source: https://www.postgresql.org/docs/current/sql-createfunction.html

## Codebase Fit

| Existing asset | Phase 7 use |
|----------------|-------------|
| `supabase/migrations/0004_rls_helpers.sql` | Pattern for recursion-safe `private.is_coach_of` helper. |
| `supabase/migrations/0006_client_reads_coach_name.sql` | Pattern for reverse helper `private.is_client_of`. |
| `supabase/migrations/0008_onboarding.sql` | Latest style for grants, RLS, RPCs, `revoke execute`, and service-role-only config writes. |
| `scripts/seed.ts` | Service-role seed pattern and seeded users/coach-client relationships. |
| `scripts/verify-rls.ts` | Real `signInWithPassword` anon-key verifier; extend rather than creating a parallel harness. |
| `packages/supabase/src/database.types.ts` | Remove legacy chat contracts and add real generated row aliases. |
| `packages/core/src/chat.ts` | Keep `chatLimits.messageBodyMaxLength = 4000`; database CHECK/RPC must match this. |

## Recommended Data Model

### `public.conversations`

- `id uuid primary key default gen_random_uuid()`
- `client_id uuid not null references public.profiles(id) on delete restrict`
- `coach_id uuid not null references public.profiles(id) on delete restrict`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique (client_id, coach_id)`

Policy: members read via `private.is_conversation_member(id)`. No authenticated insert/update/delete.

### `public.messages`

- `id uuid primary key default gen_random_uuid()`
- `conversation_id uuid not null references public.conversations(id) on delete cascade`
- `sender_id uuid not null references public.profiles(id) on delete restrict`
- `sender_role public.user_role not null`
- `body text not null`
- `client_request_id text not null`
- `created_at timestamptz not null default now()`
- `check (char_length(btrim(body)) > 0)`
- `check (char_length(body) <= 4000)`
- unique index on `(conversation_id, client_request_id)`
- index on `(conversation_id, created_at, id)`

Policy: members read by joining to conversations. No authenticated insert/update/delete policies or grants.

### `public.message_reads`

- `id uuid primary key default gen_random_uuid()`
- `conversation_id uuid not null references public.conversations(id) on delete cascade`
- `user_id uuid not null references public.profiles(id) on delete cascade`
- `last_read_message_id uuid references public.messages(id) on delete set null`
- `read_at timestamptz not null default now()`
- `unique (conversation_id, user_id)`

Policy: conversation members read rows for that conversation. Authenticated users can insert/update only their own row when they are a member and `last_read_message_id` belongs to the same conversation or is null.

## Recommended Functions

### `private.is_conversation_member(conversation_uuid uuid)`

Use `security definer`, `stable`, `set search_path = ''`. It should return true when the caller is:

- the conversation's `client_id` and `private.is_client_of(coach_id)` is true, or
- the conversation's `coach_id` and `private.is_coach_of(client_id)` is true.

This composes current assignment helpers and avoids recursive policies on the chat tables.

### `public.send_chat_message(p_conversation_id uuid, p_body text, p_client_request_id text)`

Use `security definer`, `volatile`, `set search_path = ''`.

Required behavior:

- reject null `auth.uid()`
- trim and reject empty `p_body`
- reject body length greater than `chatLimits.messageBodyMaxLength` (4000)
- reject missing/blank `p_client_request_id`
- load conversation, verify `private.is_conversation_member(p_conversation_id)`
- derive `sender_role` from `public.profiles`
- if `(conversation_id, client_request_id)` exists:
  - return existing message if `sender_id` and `body` match the request
  - reject if the existing row conflicts
- otherwise insert and return the message row
- update `conversations.updated_at`

## Verification Architecture

`pnpm verify:rls` should prove the phase with real anon-key sessions:

- client member reads exactly their own conversation
- assigned coach reads the same conversation
- unassigned coach reads zero rows
- cross-client reads zero rows
- client sends through RPC; coach sends through RPC
- duplicate same `client_request_id` returns the same message id
- conflicting duplicate key is rejected
- direct insert into `messages` is rejected
- update/delete of stored messages is rejected
- empty/whitespace/oversized bodies are rejected
- `message_reads` direct insert/update cannot target another user's `user_id`

## Validation Architecture

Phase validation should sample across four dimensions:

1. **Authorization:** member read/write allowed; outsider/cross-client denied.
2. **Integrity:** message body constraints, idempotency, immutability.
3. **Schema realism:** generated types include real chat tables/functions; legacy hand contracts are gone.
4. **Execution proof:** `pnpm db:reset`, `pnpm seed`, `supabase gen types typescript --local`, `pnpm verify:rls`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| SECURITY DEFINER misuse | Use `set search_path = ''`, schema-qualified references, no caller-supplied sender identity. |
| RLS recursion | Put membership lookup in a private helper, mirroring existing helpers. |
| Duplicate retries | Unique `(conversation_id, client_request_id)` plus idempotent return/reject behavior. |
| Message mutation | No authenticated update/delete grants or policies; verifier attempts mutation. |
| Assignment drift | Current RLS composes `coach_clients`; future reassignment/archive rules are deferred deliberately. |
| Phase 8 duplication | Edge Function should call `send_chat_message` rather than re-implementing inserts. |

## Packages

No new npm packages are needed. Use existing Supabase CLI, `@supabase/supabase-js`, TypeScript, and pnpm scripts.

## Research Complete

Phase 7 is ready for one coarse executable plan with a mandatory Supabase schema apply/typegen/RLS gate and a threat model.
