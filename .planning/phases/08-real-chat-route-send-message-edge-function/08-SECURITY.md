---
phase: 08
slug: real-chat-route-send-message-edge-function
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-05T20:28:30+08:00
updated: 2026-07-06T07:43:12+08:00
---

# Phase 08 - Security

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser -> Server Action | Authenticated user submits chat command from `/chat` | `conversationId`, `body`, `clientRequestId` |
| Server Action -> Edge Function | Server forwards current Supabase access token to `send-message` | Bearer JWT plus validated JSON command |
| Edge Function -> Supabase RPC | Edge Function validates caller and delegates write | Trusted JWT context, command body |
| RPC -> Tables | `send_chat_message` writes `messages` and updates `conversations` | Message row, derived sender role, idempotency key |
| RLS -> Reads | Browser reads conversation/message history directly through RLS-scoped Supabase client | Member-scoped conversation and message rows |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Spoofing | `send-message` Edge Function | mitigate | Function requires bearer token and calls `auth.getUser()` before RPC. | closed |
| T-08-02 | Tampering | Message sender fields | mitigate | Request body never accepts `sender_id` or `sender_role`; `send_chat_message` derives both from authenticated user/profile. | closed |
| T-08-03 | Information disclosure | Conversations/messages | mitigate | RLS and `private.is_conversation_member` restrict reads; unauthorized sends return the same calm unavailable state. | closed |
| T-08-04 | Repudiation / duplicate send | `clientRequestId` retry path | mitigate | Unique `(conversation_id, client_request_id)` plus RPC idempotency returns the existing row for same sender/body and rejects conflicts. | closed |
| T-08-05 | Tampering | Direct table writes | mitigate | Authenticated users have no direct insert/update/delete grant for `messages`; RLS verifier covers direct insert and immutable update/delete denial. | closed |
| T-08-06 | Denial of service / validation | Message body | mitigate | Server Action, Edge Function, RPC, and table CHECK reject blank and >4000 character bodies. | closed |
| T-08-07 | Reliability security | Edge Function boot path | mitigate | Removed workspace source import from Edge Function; direct local function POST returned 200 and persisted a message row. | closed |

## Accepted Risks Log

No accepted risks.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Evidence |
|------------|---------------|--------|------|----------|
| 2026-07-05 | 7 | 7 | 0 | `pnpm verify:rls`, direct Edge Function POST, `pnpm --filter @fish/web e2e` |
| 2026-07-06 | 7 | 7 | 0 | `pnpm db:reset`, direct signed-in Edge Function POST, `pnpm verify:rls`, `pnpm --filter @fish/web e2e` all passed. |

## Current Security Gate

Status: verified.

The live RLS/security verifier passed against the current migration set after a fresh `pnpm db:reset`. The local Edge Function runtime was served on `supabase_network_fish`; a direct signed-in POST to `send-message` returned 200 and persisted a message row before the full browser E2E suite passed.

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks log has no entries.
- [x] `threats_open: 0` confirmed.
- [x] Fresh `pnpm verify:rls` passes on the current migration set.
- [x] `status: verified` set in frontmatter.

Approval: verified 2026-07-06
