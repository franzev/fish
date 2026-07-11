---
status: complete
phase: 08-real-chat-route-send-message-edge-function
source:
  - 08-01-SUMMARY.md
started: 2026-07-05T20:28:30+08:00
updated: 2026-07-06T07:43:12+08:00
---

# Phase 08 UAT

## Current Test

[testing complete]

## Tests

### 1. Onboarding save and resume
expected: A client answers the first onboarding question, sees a saved status, reloads, and resumes at question 2 without scolding copy.
result: pass
evidence: `pnpm --filter @fish/web e2e`

### 2. Tracker assignment renders without client choice
expected: A seeded active tracker assignment renders on `/tracker` for the client, shows the assigned daily check-in and milestone path, exposes one primary save action, and does not show score/streak/grade copy.
result: pass
evidence: `pnpm --filter @fish/web e2e`

### 3. Client sends and coach reads the same conversation
expected: A client sends a message in `/chat`; the message persists through the real `send-message` Edge Function; the coach logs in separately and reads the same message in the conversation log.
result: pass
evidence: `pnpm --filter @fish/web e2e`

### 4. Invalid chat send guidance
expected: Empty, whitespace-only, and oversized messages are rejected with calm notice copy and no red/scolding state.
result: pass
evidence: `pnpm --filter @fish/web test -- --run apps/web/app/\(authenticated\)/chat/actions.test.ts`, `pnpm verify:rls`

### 5. Failed-send draft preservation and retry
expected: When a send fails, the typed draft is not lost, the message shows a failed state, and retry uses the same `clientRequestId`.
result: pass
evidence: `pnpm --filter @fish/web test -- --run apps/web/app/\(authenticated\)/chat/chat-client.test.tsx`

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.
