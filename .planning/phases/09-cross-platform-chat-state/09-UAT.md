---
status: complete
phase: 09-cross-platform-chat-state
source: [09-07-SUMMARY.md, 09-08-SUMMARY.md, 09-09-SUMMARY.md, 09-10-SUMMARY.md, 09-11-SUMMARY.md, 09-VERIFICATION.md]
started: 2026-07-10T05:49:32Z
updated: 2026-07-10T06:05:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Automated coverage confirmation
expected: |
  These deliverables from gap-closure plans 09-07 and 09-11 are covered by
  passing automated tests (re-run directly at HEAD by 09-VERIFICATION.md,
  460/460 tests green) rather than manual observation:

  - Cross-account leak closed: signing out clears the chat store before the
    next login (chat-store.test.ts, logout-button.test.tsx)
  - Full gate green: typecheck, lint, build, full web suite
  - Same-sender messages regroup avatar/author name after a gap
    (message-grouping.test.ts, chat-client.test.tsx)
  - Offline banner never promises a queue that doesn't exist
    (chat-client.test.tsx)
  - Message action buttons meet the 56px touch floor
    (chat-client.test.tsx)

  Reply to accept these on the strength of the automated evidence, or name
  one to spot-check by hand.
result: pass
coverage_id: 09-07-D1,09-07-D2,09-07-D3,09-11-D1,09-11-D2,09-11-D3,09-11-D4

### 2. Community room — calm layout after the /chat removal
expected: |
  Open the community room at `/channels/general`. Confirm the screen shows
  one conversation (no picker/menu), one send action, calm notice-tone
  copy, and no obvious layout jump — the same calm shape the old `/chat`
  screen had, just at the new canonical URL.
result: issue
reported: "loading earlier messages breaks the app"
severity: blocker

### 3. New messages appear live, and same-sender messages regroup
expected: |
  Send a message from a second account/tab into the community room. It
  appears in the first tab without a manual refresh. Then, after pausing
  more than 5 minutes (or checking an existing long same-sender run),
  confirm the avatar and author name reappear instead of staying hidden
  indefinitely — this is the fix for the originally reported "loading new
  messages is broken," which turned out to be a missing regroup cutoff,
  not a delivery failure.
result: pass

### 4. Native chat-state notes are complete for a future implementer
expected: |
  Read `packages/core/docs/chat-state-protocol.md` alongside
  `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md`.
  Confirm the native notes now list the pagination events, fixture cases,
  and the `markMessageFailedPreservesNewerDraft` case — the gap from the
  original UAT report — so a future Android/iOS implementer has a complete
  contract without needing the Phase 10 notes as a second source.
result: pass
reported: "Verified by direct file comparison (Claude): all 18 fixture cases, all 15 events, pagination state, dispatch mapping, and the out-of-window marker rule match between the two documents."

### 5. e2e spec targets the community channel, not the deleted /chat route
expected: |
  Open `apps/web/e2e/chat-send.spec.ts` (or run it against a live server).
  Confirm it navigates to `/channels/22222222-2222-4222-8222-222222222222`
  instead of the removed `/chat` URL.
result: pass
reported: "Verified by direct file read (Claude): line 13 navigates to /channels/22222222-2222-4222-8222-222222222222; no /chat reference anywhere in the file."

### 6. Revisiting a channel doesn't get stuck on a stale "Reconnecting…"
expected: |
  Open a channel, navigate away to a different channel or screen, then
  come back. Confirm the realtime status does not falsely show
  "Reconnecting…" on an ordinary revisit — the per-channel subscribe
  tracker should reset cleanly for the new conversation.
result: pass
reported: "Verified by direct source read (Claude): use-chat-realtime.ts lines 74-77 reset seenFirstSubscribeRef and backfillInFlightRef in a useEffect keyed on [chat.conversationId], which React re-runs on any conversationId change, mounted or not."

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Open the community room at `/channels/general`. Confirm the screen shows one conversation (no picker/menu), one send action, calm notice-tone copy, and no obvious layout jump."
  status: failed
  reason: "User reported: loading earlier messages breaks the app"
  severity: blocker
  test: 2
  artifacts: []
  missing: []
