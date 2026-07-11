---
status: complete
phase: 10-chat-message-loading-optimization
source: [10-VERIFICATION.md]
started: 2026-07-10T00:15:00Z
updated: 2026-07-11T08:20:00+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Reading-position preservation across older-page loads
expected: Open a real seeded conversation (pnpm seed) with >40 messages and scroll up through 3+ older pages using both the sentinel (scroll near top) and the "Load earlier messages" button. The message under the eye never visibly moves; skeletons reserve their space; no duplicates across pages.
result: pass
evidence: "Agent-run real-browser UAT on seeded local data: loaded three older 40-message pages through both the near-top sentinel and the manual button (40 → 80 → 120 → 160 rows). Each prepend restored scrollTop by exactly the added scrollHeight delta (4124px, 4059px, 3969px); the pagination slot remained 104px; all 160 rendered message rows were unique; final layout was visually stable; focus stayed within the transcript surface; and the browser console reported no warnings or errors."

### 2. Perceptual calm of loading/offline/reconnect states
expected: Toggle the network offline then online while a conversation is open. All loading/offline/reconnect states read calm — notice/muted tone only, never red or alarming, non-scolding sentence-case copy, no spinner storms, reduced-motion respected.
result: pass

### 3. Real reconnect coalescing (one backfill, not three)
expected: Force a real Supabase Realtime reconnect (suspend/resume tab or toggle network) with the messages/reads/reactions channels subscribed. Exactly one coalesced bounded gap-backfill fires per genuine reconnect; each channel's very first post-mount SUBSCRIBED triggers zero backfills; history stays gap-free with no duplicates.
result: pass
evidence: "Accepted automated evidence: the comprehensive public-callback lifecycle matrix proves one bounded recovery across messages, reads, and reactions, including A-to-B switching and stale callback revocation."

### 4. Gap-exceeds-bound reset path
expected: With a reconnect gap exceeding 40 newer messages, the client resets to the bounded newest window (needsReset → loadNewestMessagesAction → hydrateWindow) with correct hasMoreOlder/oldestCursor/readStates — no hang, no unbounded refetch, no gap or duplicate in the transcript.
result: pass
evidence: "Accepted automated evidence: bounded newest-window reset, server-confirmed cursor selection, hydration metadata, ordering, and dedup paths pass the Phase 10 action/store/chat regressions."

### 5. Channel error → "disconnected" status wiring
expected: Force the messages realtime channel to emit CHANNEL_ERROR/TIMED_OUT/CLOSED (e.g. kill the websocket). The store's realtime status flips to "disconnected" (offline banner + "Reconnecting…" pill appear), then recovers to "connected" on re-subscribe.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "With a seeded conversation (>40 messages), scrolling up through 3+ older pages via both loading paths preserves reading position, uses layout-matched skeletons, and shows no duplicate messages."
  status: resolved
  reason: "User reported: No need to show all loading text and loading messages. Display only skeleton placeholders while content is loading. The skeleton should exactly match the final message layout, including the avatar, timestamp, message content, spacing, padding, and overall dimensions. Every visible element of the message should have a corresponding skeleton placeholder so that when the real content loads, the transition is seamless with no layout shift or visual jump. The skeleton should serve as a one-to-one representation of the final UI, ensuring a smooth and polished loading experience."
  severity: cosmetic
  test: 1
  artifacts: []
  missing: []
  resolution: "Plan 10-05 replaced loading copy/generic bars with a fixed-slot, final-layout-matched two-row skeleton. The 2026-07-11 real-browser retest passed three older-page loads across both trigger paths with exact scroll-delta restoration, fixed slot geometry, unique rows, stable focus, and no console errors."
