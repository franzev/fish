---
status: diagnosed
phase: 09-cross-platform-chat-state
source: [09-VERIFICATION.md]
started: 2026-07-07T00:55:09Z
updated: 2026-07-10T00:39:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Visual calm after refactor
expected: Open `/chat` and confirm the screen still shows one assigned conversation, one send action, no conversation picker/menu, calm notice copy, and no obvious layout movement.
result: issue
reported: "loading new messages is broken"
severity: major

### 2. Native notes readability
expected: Read the canonical pair — `packages/core/docs/chat-state-protocol.md` and `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md` — and confirm a future Android/iOS implementer can understand the event contract, fixture replay path, native state-container mapping, and scope boundary. `.planning/phases/10-chat-message-loading-optimization/10-NATIVE-CHAT-STATE-NOTES.md` is supplementary Phase 10 pagination history only, not a second canonical contract.
result: issue
reported: "The protocol includes pagination events and fixture cases that the native notes do not list or map, so the future native implementation contract is incomplete."
severity: major

## Summary

total: 2
passed: 0
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Open `/chat` and confirm the screen still shows one assigned conversation, one send action, no conversation picker/menu, calm notice copy, and no obvious layout movement."
  status: failed
  reason: "User reported: loading new messages is broken"
  severity: major
  test: 1
  root_cause: "Investigation inconclusive: focused tests pass, but no live authenticated browser reproduction was available. The current /chat route redirects to the fixed general community channel, which conflicts with the UAT's assigned-conversation expectation; an environment-specific realtime failure or stale/wrong-route UAT report remains possible."
  artifacts:
    - path: ".planning/debug/loading-new-messages.md"
      issue: "Realtime subscription, auth setup, hydration keys, Zustand reducer, rendering, and scroll behavior were checked; no failing code path was isolated."
    - path: "apps/web/app/(authenticated)/chat/chat-client.tsx"
      issue: "Current route behavior was found to redirect to the fixed general channel rather than the assigned-conversation flow expected by this UAT."
  missing:
    - "Re-run the flow in a real authenticated two-tab session."
    - "Capture realtime channel status and errors while a new message is delivered."
  debug_session: ".planning/debug/loading-new-messages.md"
- truth: "A future Android/iOS implementer can understand the event contract, fixture replay path, native state-container mapping, and scope boundary."
  status: failed
  reason: "The protocol includes pagination events and fixture cases that the native notes do not list or map, so the future native implementation contract is incomplete."
  severity: major
  test: 2
  root_cause: "Phase 10 extended the portable chat contract but created a separate native-notes document without synchronizing the Phase 09 notes referenced by this UAT. The Phase 09 notes are a stale pre-pagination snapshot."
  artifacts:
    - path: ".planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md"
      issue: "Omits pagination state, four pagination events, seven pagination fixture cases, native pagination dispatch mapping, and the out-of-window marker selector rule."
    - path: "packages/core/docs/chat-state-protocol.md"
      issue: "Defines the pagination events, fixture cases, and selector rule that the Phase 09 native notes fail to mirror."
    - path: ".planning/phases/10-chat-message-loading-optimization/10-NATIVE-CHAT-STATE-NOTES.md"
      issue: "Contains the later pagination additions, confirming documentation drift between phase notes."
  missing:
    - "Synchronize the Phase 09 native notes with the pagination contract."
    - "Clarify which native-notes document is canonical and update UAT references if needed."
  debug_session: ".planning/debug/native-chat-pagination-contract.md"
