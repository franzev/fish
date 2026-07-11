---
phase: 7
slug: chat-schema
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-05
verified: 2026-07-05
---

# Phase 7 - Validation Strategy

> Executed validation contract for chat schema delivery.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Supabase CLI + TypeScript verifier + pnpm monorepo gates |
| Config files | `supabase/config.toml`; `scripts/verify-rls.ts`; `package.json` scripts |
| Quick run command | `pnpm db:reset && pnpm seed && pnpm verify:rls` |
| Full suite command | `pnpm db:reset && pnpm seed && pnpm verify:rls && pnpm typecheck && pnpm lint && pnpm build` |
| Estimated runtime | 2-5 minutes, depending on local Supabase state |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 07-01 | 1 | CHAT-01, CHAT-04, CHAT-06, XC-01 | T-07-01..T-07-08 | Chat tables, RLS, RPC, immutable messages, idempotency, stable ordering | migration/source | `rg -n "send_chat_message|client_request_id|is_conversation_member" supabase/migrations/0010_chat.sql` | yes | passed |
| 07-01-02 | 07-01 | 1 | CHAT-01 | T-07-02 | Seed one conversation per assignment with no chooser surface | seed | `pnpm db:reset && pnpm seed` | yes | passed |
| 07-01-03 | 07-01 | 1 | CHAT-01, CHAT-04, CHAT-06, XC-01 | T-07-01..T-07-08 | Live RLS proves member access, outsider denial, idempotency, immutable messages, body constraints | RLS/integration | `pnpm verify:rls` | yes | passed |
| 07-01-04 | 07-01 | 1 | CHAT-01, CHAT-04 | T-07-07 | Generated types include real chat rows and legacy contracts are removed | type/source | `supabase gen types typescript --local`; `pnpm typecheck` | yes | passed |

## Wave 0 Requirements

- [x] `supabase/migrations/0010_chat.sql` exists with chat schema, RLS, helper, RPC, grants, constraints, and indexes.
- [x] `scripts/seed.ts` creates deterministic chat conversations for seeded coach-client assignments.
- [x] `scripts/verify-rls.ts` contains live `checkChat*` assertions wired into `main()`.
- [x] `packages/supabase/src/database.generated.ts` is regenerated from the local schema.
- [x] `packages/supabase/src/database.types.ts` exports `ConversationRow`, `MessageRow`, `MessageReadRow` and no longer exports `LegacyChatContracts`.

## Execution Evidence

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm supabase:start` | passed | Local Supabase stack was available for reset, generation, and RLS tests. |
| `pnpm db:reset` | passed | Applied migrations through `0009_tracker.sql` and `0010_chat.sql`. |
| `pnpm seed` | passed | Seeded coach/client users, assignments, tracker data, and one chat conversation per assignment. |
| `pnpm verify:rls` | passed | All assertions passed, including Phase 7 chat membership, denial, send, duplicate, conflict, immutability, body, and read-state checks. |
| `supabase gen types typescript --local > /tmp/fish-db-types.ts` | passed | Generated output was copied into `packages/supabase/src/database.generated.ts`; the final diff check only found a trailing newline before copy. |
| `pnpm typecheck` | passed | Generated chat row aliases compile against the web/shared packages. |
| `pnpm lint` | passed | No lint errors after Phase 7 closeout. |
| `pnpm build` | passed | Production web build and shared package gates completed successfully. |

## Source Scans

| Scan | Result |
|------|--------|
| `rg -n "create table public\\.conversations|create table public\\.messages|create table public\\.message_reads|send_chat_message|is_conversation_member|client_request_id" supabase/migrations/0010_chat.sql` | matched expected schema/RPC symbols |
| `rg -n "send_chat_message\\([^)]*(sender_id|sender_role|client_id|coach_id)" supabase/migrations/0010_chat.sql` | no matches |
| `rg -n "on public\\.messages\\s+for (insert|update|delete)" supabase/migrations/0010_chat.sql` | no matches |
| `rg -n "LegacyChatContracts" packages/supabase/src/database.types.ts` | no matches |

## Manual-Only Verifications

None required. Phase 7 has no UI. All acceptance criteria are source, migration, RLS, type, lint, and build gates.

## Validation Sign-Off

- [x] All tasks have automated verification.
- [x] Sampling covers authorization, integrity, schema/type realism, and final full-suite gates.
- [x] No watch-mode commands.
- [x] Feedback latency target under 15 minutes.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** verified 2026-07-05
