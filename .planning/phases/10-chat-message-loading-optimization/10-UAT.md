---
status: testing
phase: 10-chat-message-loading-optimization
source: [10-VERIFICATION.md]
started: 2026-07-10T00:15:00Z
updated: 2026-07-10T00:15:00Z
---

## Current Test

number: 1
name: Reading-position preservation across older-page loads
expected: |
  With a seeded conversation (>40 messages), scrolling up through 3+ older pages —
  via both the near-top sentinel and the "Load earlier messages" button — the message
  under the eye never visibly moves (instant restore, no jump/jank), skeleton rows
  never shift surrounding layout, and no duplicate messages appear across pages.
awaiting: user response

## Tests

### 1. Reading-position preservation across older-page loads
expected: Open a real seeded conversation (pnpm seed) with >40 messages and scroll up through 3+ older pages using both the sentinel (scroll near top) and the "Load earlier messages" button. The message under the eye never visibly moves; skeletons reserve their space; no duplicates across pages.
result: [pending]

### 2. Perceptual calm of loading/offline/reconnect states
expected: Toggle the network offline then online while a conversation is open. All loading/offline/reconnect states read calm — notice/muted tone only, never red or alarming, non-scolding sentence-case copy, no spinner storms, reduced-motion respected.
result: [pending]

### 3. Real reconnect coalescing (one backfill, not three)
expected: Force a real Supabase Realtime reconnect (suspend/resume tab or toggle network) with the messages/reads/reactions channels subscribed. Exactly one coalesced bounded gap-backfill fires per genuine reconnect; each channel's very first post-mount SUBSCRIBED triggers zero backfills; history stays gap-free with no duplicates.
result: [pending]

### 4. Gap-exceeds-bound reset path
expected: With a reconnect gap exceeding 40 newer messages, the client resets to the bounded newest window (needsReset → loadNewestMessagesAction → hydrateWindow) with correct hasMoreOlder/oldestCursor/readStates — no hang, no unbounded refetch, no gap or duplicate in the transcript.
result: [pending]

### 5. Channel error → "disconnected" status wiring
expected: Force the messages realtime channel to emit CHANNEL_ERROR/TIMED_OUT/CLOSED (e.g. kill the websocket). The store's realtime status flips to "disconnected" (offline banner + "Reconnecting…" pill appear), then recovers to "connected" on re-subscribe.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
