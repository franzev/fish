---
phase: 07-chat-schema
slug: chat-schema
status: verified
created: 2026-07-05
verified: 2026-07-05
threats_open: 0
asvs_level: 1
source_plans:
  - 07-01-PLAN.md
---

# Phase 7 - Security Review

## Trust Boundaries

| Boundary | Risk | Control |
|----------|------|---------|
| Authenticated user to `send_chat_message` RPC | Caller chooses conversation id, body, and idempotency key. | RPC derives sender from `auth.uid()`, verifies membership, validates body/key, and writes through one database-owned path. |
| Authenticated user to RLS-protected chat reads | Caller could attempt to enumerate conversations, messages, or read-state rows. | RLS composes `private.is_conversation_member`; denial behavior is zero-row reads. |
| Authenticated user to `message_reads` mutation | Caller could attempt to update another member's read pointer. | Policies require `user_id = auth.uid()` and same-conversation message pointers. |
| Service-role seed/verifier setup | Admin setup can bypass RLS if confused with proof. | Service role is used only for setup/reset; authorization assertions use real signed-in anon sessions. |
| Future Phase 8 Edge Function to database | Function could duplicate insert logic incorrectly. | Phase 7 establishes `send_chat_message` as the durable command boundary. |

## Threat Register

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-07-01 | Spoofing/Elevation | `send_chat_message` | mitigate | closed | RPC accepts only conversation id, body, and `client_request_id`; source scan found no sender/client/coach identity parameters. |
| T-07-02 | Information Disclosure | conversation/message RLS | mitigate | closed | `pnpm verify:rls` passed member reads and unassigned/cross-client zero-row denial checks. |
| T-07-03 | Tampering | stored messages | mitigate | closed | No authenticated message insert/update/delete policies exist; verifier rejected direct insert, update, and delete attempts. |
| T-07-04 | Repudiation/Tampering | duplicate sends | mitigate | closed | Unique `(conversation_id, client_request_id)` plus verifier coverage for same-key idempotency and conflicting-key rejection. |
| T-07-05 | Denial/Integrity | invalid bodies | mitigate | closed | DB and RPC validation reject blank and oversized bodies; verifier checked whitespace-only and 4001-character messages. |
| T-07-06 | Information Disclosure | read-state rows | mitigate | closed | Own-row insert/update policy and trigger integrity checks; verifier rejected mutating another participant's row. |
| T-07-07 | Supply chain | dependencies | mitigate | closed | No package install or upgrade was introduced for Phase 7. |
| T-07-08 | RLS verifier bypass | verification harness | mitigate | closed | RLS assertions use `signInAs(...)` sessions; service role is limited to setup/reset. |

## Accepted Risks Log

No accepted risks.

## Security Evidence

| Check | Result |
|-------|--------|
| `rg -n "create table public\\.conversations|create table public\\.messages|create table public\\.message_reads|send_chat_message|is_conversation_member|client_request_id" supabase/migrations/0010_chat.sql` | matched expected schema and command symbols |
| `rg -n "send_chat_message\\([^)]*(sender_id|sender_role|client_id|coach_id)" supabase/migrations/0010_chat.sql` | no matches |
| `rg -n "on public\\.messages\\s+for (insert|update|delete)" supabase/migrations/0010_chat.sql` | no matches |
| `rg -n "LegacyChatContracts" packages/supabase/src/database.types.ts` | no matches |
| `pnpm verify:rls` | passed all chat authorization and integrity assertions |
| `pnpm typecheck` | passed |
| `pnpm lint` | passed |
| `pnpm build` | passed |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-05 | 8 | 8 | 0 | Codex |

## Sign-Off

Security status: verified.

- [x] All threats have a disposition.
- [x] Accepted risks documented.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

There are no open Phase 7 security findings. Phase 8 should call `send_chat_message` rather than inserting into `messages` directly.
