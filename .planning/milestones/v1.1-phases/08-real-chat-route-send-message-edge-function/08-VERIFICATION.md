---
phase: 08
slug: real-chat-route-send-message-edge-function
status: passed
verified: 2026-07-06T07:43:12+08:00
requirements:
  CHAT-02: passed
  CHAT-03: passed
  CHAT-05: passed
  CHAT-07: passed
  XC-04: passed
gaps_found: 0
human_verification: 0
---

# Phase 08 Verification

## Goal Check

Phase goal: a client and coach hold a real, persistent 1-on-1 conversation on live data through the real `send-message` Edge Function; the chat route sends and reads real history with optimistic send lifecycle, draft preservation on failure, calm invalid-message handling, and the three cross-role flows are covered end-to-end.

Status: passed.

## Must-Haves

| Must-have | Result | Evidence |
|-----------|--------|----------|
| Real `send-message` function persists messages | passed | Direct signed-in Edge Function POST returned 200 and persisted a `messages` row; Playwright client-send->coach-read passed. |
| Sender identity is trusted, not body-supplied | passed | Request body accepts only `conversationId`, `body`, `clientRequestId`; `send_chat_message` derives sender role; `pnpm verify:rls` passed sender-role assertions. |
| Membership is re-checked before write/read | passed | `pnpm verify:rls` passed member read, unassigned denial, cross-client denial, direct insert rejection, and unavailable conversation send rejection. |
| Idempotent optimistic lifecycle | passed | Chat client tests passed optimistic send/retry behavior; RLS verifier passed duplicate and conflicting duplicate assertions. |
| Draft preserved on failure | passed | Chat client tests passed failed-send state and retry without losing message body. |
| Calm validation for blank/oversized messages | passed | Chat action tests and RLS verifier passed whitespace and 4001-character message assertions. |
| XC-04 cross-role flows | passed | `pnpm --filter @fish/web e2e` passed onboarding save->resume, tracker assignment render, and client send->coach read. |

## Commands

| Command | Result |
|---------|--------|
| `pnpm supabase:start` | Passed; local Supabase available. |
| `pnpm db:reset` | Passed; migrations 0001-0010 applied. |
| `pnpm seed` | Passed. |
| `supabase functions serve --env-file apps/web/.env.local --network-id supabase_network_fish` | Passed; local Edge Function runtime served `send-message`. |
| Direct signed-in POST to `/functions/v1/send-message` | Passed; 200 response and persisted message row. |
| `pnpm verify:rls` | Passed; all assertions passed. |
| `pnpm --filter @fish/web e2e` | Passed; 3 tests passed. |
| `pnpm --filter @fish/web test -- --run apps/web/app/\(authenticated\)/tracker/actions.test.ts apps/web/components/tracker/tracker-entry-flow.test.tsx apps/web/lib/validation/tracker.test.ts apps/web/app/\(authenticated\)/chat/actions.test.ts apps/web/app/\(authenticated\)/chat/chat-client.test.tsx apps/web/app/\(authenticated\)/home/page.test.tsx` | Passed; 53 files, 354 tests. |
| `pnpm typecheck` | Passed. |
| `pnpm lint` | Passed. |
| `pnpm build` | Passed. |
| `git diff --check` | Passed. |

## Gaps

None.

## Human Verification

None required. The user requested the recommended non-interrupting route, so UAT was completed with deterministic Playwright browser flows and supporting unit/RLS checks.
