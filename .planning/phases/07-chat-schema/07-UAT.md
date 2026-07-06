---
phase: 07-chat-schema
status: complete
created: 2026-07-05
verified: 2026-07-05
source:
  - 07-01-PLAN.md
  - 07-VALIDATION.md
  - 07-01-SUMMARY.md
---

# Phase 7 - UAT

## Scope

Phase 7 is a backend chat data-boundary phase. There is no user-facing chat route in this phase, so UAT is expressed as acceptance checks against the user-visible promises the future UI depends on: assigned conversations, member-only access, calm retry behavior, immutable message history, and generated contracts that match the database.

## Current Test

[testing complete]

## Acceptance Tests

| Test | User Promise | Evidence | Result |
|------|--------------|----------|--------|
| Assigned conversation exists | A client is presented their assigned coach conversation, not a room picker. | `pnpm db:reset` and `pnpm seed` created one conversation per seeded `coach_clients` assignment. | passed |
| Members can read, outsiders cannot | The client and assigned coach can see the same conversation; other users see nothing. | `pnpm verify:rls` passed client, coach, unassigned coach, and cross-client conversation/message assertions. | passed |
| Sending is reliable and quiet | Retried sends do not create duplicates, and conflicting retries fail safely. | `pnpm verify:rls` passed same-key idempotency and conflicting duplicate rejection checks through `send_chat_message`. | passed |
| Message history is stable | Messages cannot be edited or deleted directly by authenticated users. | `pnpm verify:rls` passed direct insert, update, delete, and body-constraint checks. | passed |
| App contracts are real | Web/shared code compiles against generated Supabase chat rows. | `supabase gen types typescript --local`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. | passed |

## Result

UAT status: passed.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.

No manual UI session was required or appropriate for this phase because Phase 7 exposes no screen. The acceptance surface is the persisted data contract that Phase 8 can safely build on.
