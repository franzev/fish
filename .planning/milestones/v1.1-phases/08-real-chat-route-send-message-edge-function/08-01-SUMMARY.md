---
phase: 08
plan: 01
subsystem: chat-route
status: complete
completed: 2026-07-06T07:43:12+08:00
requirements:
  - CHAT-02
  - CHAT-03
  - CHAT-05
  - CHAT-07
  - XC-04
key-files:
  created:
    - apps/web/e2e/coaching-loop.spec.ts
    - apps/web/playwright.config.ts
  modified:
    - supabase/functions/send-message/index.ts
    - apps/web/app/(authenticated)/chat/actions.ts
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/app/(authenticated)/chat/page.tsx
    - apps/web/app/(authenticated)/chat/actions.test.ts
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx
    - apps/web/lib/services/supabase/core.ts
    - apps/web/lib/services/supabase/types.ts
    - apps/web/components/tracker/milestone-progress.tsx
    - apps/web/components/tracker/tracker-entry-flow.tsx
    - apps/web/vitest.config.ts
    - apps/web/package.json
    - pnpm-lock.yaml
---

# Phase 08-01 Summary: Real Chat Route + send-message Edge Function

## Outcome

Phase 8 is executed and verified. The real `send-message` Edge Function verifies the caller from the bearer JWT, delegates the trusted write to `send_chat_message`, and returns the persisted message row to the web app. The `/chat` route reads the assigned conversation from live Supabase data and the client UI reconciles optimistic messages by `clientRequestId`.

The dev-only Playwright smoke suite covers the three cross-role flows required by XC-04:

1. Onboarding save -> resume at the next assigned question.
2. Tracker assignment -> client render without a chooser.
3. Client send -> coach reads the same persisted conversation.

## Implementation Notes

- Replaced the Edge Function monorepo source import with self-contained Deno-compatible types/constants and raw Supabase Auth/RPC HTTP calls, avoiding runtime npm resolution during local Edge Function boot.
- Kept `sender_id` and `sender_role` trusted at the database boundary: the request body carries only `conversationId`, `body`, and `clientRequestId`.
- Preserved the calm send lifecycle in the client: sending, sent, failed, retry, no silent drop, and the draft remains on failure.
- Added Playwright config and an E2E suite that seeds local data, resets only the tested client state, and uses direct role logins for client and coach.
- Separated Playwright specs from Vitest discovery with `vitest.config.ts` excludes.
- Stabilized the tracker saved-entry/milestone service contract so XC-04 can exercise tracker assignment without stale draft-era code.

## Deviations

- During verification, the Edge Function initially returned `503 BOOT_ERROR`; the cause was the function importing from the workspace package path at boot. The function was made self-contained and direct function verification returned 200 with a persisted `messages` row.
- The tracker service had stale draft-era types and helpers (`draftAnswers`, `progress.steps`, draft loader) reappear during verification. Those were removed in favor of saved entries plus `get_tracker_milestone_steps`.
- During final E2E, the local Edge runtime first returned `503 {"message":"name resolution failed"}` because the function used an `npm:` import path. The function now uses raw HTTP with the caller JWT plus public API key; `supabase functions serve --network-id supabase_network_fish` verified it locally.

## Current Verification Evidence

- Strict stale tracker draft contract scan -> no matches.
- `pnpm --filter @fish/web test -- --run apps/web/app/\(authenticated\)/tracker/actions.test.ts apps/web/components/tracker/tracker-entry-flow.test.tsx apps/web/lib/validation/tracker.test.ts apps/web/app/\(authenticated\)/chat/actions.test.ts apps/web/app/\(authenticated\)/chat/chat-client.test.tsx apps/web/app/\(authenticated\)/home/page.test.tsx` -> 53 files, 354 tests passed.
- `pnpm db:reset` -> migrations 0001-0010 applied.
- Direct signed-in POST to `/functions/v1/send-message` -> 200 response and persisted `messages` row.
- `pnpm verify:rls` -> all assertions passed.
- `pnpm --filter @fish/web e2e` -> 3 passed.
- `pnpm typecheck` -> passed.
- `pnpm lint` -> passed.
- `pnpm build` -> passed with network escalation for Google Fonts.

## Self-Check: PASSED

The phase goal is met against live local Supabase. The browser E2E path proves persistence across client and coach sessions, and the security/RLS gates are green.
