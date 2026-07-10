---
status: partial
phase: 10-chat-message-loading-optimization
source: [10-VERIFICATION.md]
started: 2026-07-10T00:15:00Z
updated: 2026-07-11T05:40:00+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Reading-position preservation across older-page loads
expected: Open a real seeded conversation (pnpm seed) with >40 messages and scroll up through 3+ older pages using both the sentinel (scroll near top) and the "Load earlier messages" button. The message under the eye never visibly moves; skeletons reserve their space; no duplicates across pages.
result: issue
reported: "No need to show all loading text and loading messages. Display only skeleton placeholders while content is loading. The skeleton should exactly match the final message layout, including the avatar, timestamp, message content, spacing, padding, and overall dimensions. Every visible element of the message should have a corresponding skeleton placeholder so that when the real content loads, the transition is seamless with no layout shift or visual jump. The skeleton should serve as a one-to-one representation of the final UI, ensuring a smooth and polished loading experience."
severity: cosmetic

### 2. Perceptual calm of loading/offline/reconnect states
expected: Toggle the network offline then online while a conversation is open. All loading/offline/reconnect states read calm — notice/muted tone only, never red or alarming, non-scolding sentence-case copy, no spinner storms, reduced-motion respected.
result: pass

### 3. Real reconnect coalescing (one backfill, not three)
expected: Force a real Supabase Realtime reconnect (suspend/resume tab or toggle network) with the messages/reads/reactions channels subscribed. Exactly one coalesced bounded gap-backfill fires per genuine reconnect; each channel's very first post-mount SUBSCRIBED triggers zero backfills; history stays gap-free with no duplicates.
result: blocked
blocked_by: other
reason: "A real local Realtime disconnect/reconnect recovered with 65 message paragraphs before and after and zero duplicates, but available browser instrumentation cannot count internal backfill calls to prove exactly one rather than three."

### 4. Gap-exceeds-bound reset path
expected: With a reconnect gap exceeding 40 newer messages, the client resets to the bounded newest window (needsReset → loadNewestMessagesAction → hydrateWindow) with correct hasMoreOlder/oldestCursor/readStates — no hang, no unbounded refetch, no gap or duplicate in the transcript.
result: blocked
blocked_by: other
reason: "Requires creating more than 40 messages while the authenticated conversation is disconnected; this could not be safely produced without mutating substantial test data."

### 5. Channel error → "disconnected" status wiring
expected: Force the messages realtime channel to emit CHANNEL_ERROR/TIMED_OUT/CLOSED (e.g. kill the websocket). The store's realtime status flips to "disconnected" (offline banner + "Reconnecting…" pill appear), then recovers to "connected" on re-subscribe.
result: pass

## Summary

total: 5
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "With a seeded conversation (>40 messages), scrolling up through 3+ older pages via both loading paths preserves reading position, uses layout-matched skeletons, and shows no duplicate messages."
  status: failed
  reason: "User reported: No need to show all loading text and loading messages. Display only skeleton placeholders while content is loading. The skeleton should exactly match the final message layout, including the avatar, timestamp, message content, spacing, padding, and overall dimensions. Every visible element of the message should have a corresponding skeleton placeholder so that when the real content loads, the transition is seamless with no layout shift or visual jump. The skeleton should serve as a one-to-one representation of the final UI, ensuring a smooth and polished loading experience."
  severity: cosmetic
  test: 1
  artifacts: []
  missing: []
