---
phase: 07-chat-schema
plan: 07-01
status: complete
subsystem: database
tags:
  - supabase
  - postgres
  - rls
  - chat
  - idempotency
requires:
  - phase: v1.0-foundations
    provides: profiles, coach_clients, RLS helpers
provides:
  - conversations/messages/message_reads schema
  - member-scoped chat RLS
  - idempotent send_chat_message RPC
  - seeded coach-client conversations
  - generated Supabase chat row aliases
affects:
  - phase-08-real-chat-route
tech-stack:
  added: []
  patterns:
    - database-owned command path
    - anon-session RLS verifier
key-files:
  created:
    - supabase/migrations/0010_chat.sql
    - .planning/phases/07-chat-schema/07-UAT.md
    - .planning/phases/07-chat-schema/07-SECURITY.md
  modified:
    - scripts/seed.ts
    - scripts/verify-rls.ts
    - packages/supabase/src/database.generated.ts
    - packages/supabase/src/database.types.ts
    - .planning/phases/07-chat-schema/07-VALIDATION.md
requirements-completed:
  - CHAT-01
  - CHAT-04
  - CHAT-06
  - XC-01
completed: 2026-07-05
---

# Phase 7 - Chat Schema Summary

## Summary

Phase 7 delivered the database-owned chat boundary: assigned coach-client conversations, member-scoped RLS reads, RPC-only authenticated message sends, idempotent client request handling, read-state ownership, seeded conversations, regenerated Supabase types, and live verifier coverage.

The implementation keeps the FISH product rule intact: clients do not choose from chat rooms or plans. The database creates exactly one conversation per assigned coach-client relationship, and all access is scoped to that assignment.

## Modified Files

| File | Purpose |
|------|---------|
| `supabase/migrations/0010_chat.sql` | Chat schema, RLS policies, membership helper, read-state trigger, and `send_chat_message` RPC. |
| `scripts/seed.ts` | Seeds deterministic conversations and read-state rows for coach-client assignments. |
| `scripts/verify-rls.ts` | Adds live Phase 7 membership, denial, send, idempotency, conflict, mutation, body, and read-state assertions. |
| `packages/supabase/src/database.generated.ts` | Regenerated from the local Supabase schema. |
| `packages/supabase/src/database.types.ts` | Exports real chat row aliases and removes the legacy fake chat contract. |
| `.planning/phases/07-chat-schema/07-VALIDATION.md` | Records executed validation evidence. |
| `.planning/phases/07-chat-schema/07-UAT.md` | Records user acceptance validation for the non-UI chat boundary. |
| `.planning/phases/07-chat-schema/07-SECURITY.md` | Records threat mitigation evidence and security sign-off. |

Tracker files were stabilized only to keep existing Phase 6 work compatible with regenerated database types and app gates. They are not part of the Phase 7 chat feature scope.

## Deviations

- The plan originally referenced `supabase/migrations/0009_chat.sql`; the actual migration is `supabase/migrations/0010_chat.sql` because `0009_tracker.sql` already occupies the previous migration slot.
- `send_chat_message` is marked `volatile`, matching its write behavior and the final generated type checks.
- No manual UI UAT was added because this phase has no client-facing screen.

## Commands Run

| Command | Result |
|---------|--------|
| `pnpm supabase:start` | passed |
| `pnpm db:reset` | passed |
| `pnpm seed` | passed |
| `pnpm verify:rls` | passed |
| `supabase gen types typescript --local > /tmp/fish-db-types.ts` | passed |
| `pnpm typecheck` | passed |
| `pnpm lint` | passed |
| `pnpm build` | passed |

## Self-Check

PASSED.

- [x] Conversations, messages, and message reads exist with member-scoped RLS.
- [x] Both seeded conversation members can read their persisted conversation through RLS.
- [x] Outsiders receive zero rows and cannot send messages into another conversation.
- [x] `send_chat_message` derives sender identity from `auth.uid()` and does not accept caller-supplied sender or participant identity.
- [x] Duplicate `client_request_id` behavior is idempotent for matching retries and conflict-safe for mismatched retries.
- [x] Authenticated users cannot directly insert, update, or delete stored messages.
- [x] Supabase generated types include real chat rows and `LegacyChatContracts` is gone.
- [x] Final reset, seed, RLS, typecheck, lint, and build gates are green.
