# Quick reply hardening — remaining work

Status: code follow-ups complete; physical-device verification remains
release-blocking (2026-07-31). The original implementation shipped in commits
`13016c0c..464d5dd3`; the follow-ups below are now implemented in the working
tree. Full as-built record:
`docs/superpowers/plans/2026-07-30-notification-quick-reply-hardening.md`.

## 1. Physical-device verification (blocks release)

None of the push, background, or airplane-mode behavior is provable on
simulators. The six rows below joined the already-outstanding release matrix
(`docs/native-mobile-feature-completion-plan.md`, execution matrix item 8) and
share its prerequisites (APNs/FCM credentials deployed to the target
environment, signed device builds):

1. Android: a push shows the real message text; offline receipt falls back to
   "Sent you a message".
2. Android: a quick reply appends "You: …" to the notification without
   re-alerting; the conversation opens read.
3. Android: a reply in airplane mode survives process death and sends when
   connectivity returns; after seven failed attempts the calm notice appears
   and the text survives as a failed transcript message or composer draft.
4. iOS: a lock-screen reply with the app terminated sends without opening the
   app; the badge settles after the drain.
5. iOS: a rejected send (401/403/`conversation_not_available`) produces
   "Your reply didn’t send" once per conversation with the text kept as the
   composer draft; a conversation missing from the local directory preserves
   the text as a draft with no notice; a failed directory read keeps replies
   queued.
6. Both: no message text, token, or ID appears in logs during any of the
   above.

## 2. Completed: Android trusts a stale directory (last text-destroy path)

`DefaultChatRepository.listAuthorizedConversations` falls back to the Room
cache on remote failure. The fallback now marks the directory
`isAuthoritative = false`, and `ChatReplyDrain` returns `Retry` before
mutating any queued reply. The cached directory remains available for
rendering, but cannot authorize destructive background work.

## 3. Completed: iOS has no background owner for the text outbox

Android's worker flushes the composer text outbox for every authorized
conversation each run. iOS now has a model-level
`ChatTextOutboxFlusher` invoked on session attach and after notification-reply
draining. It flushes text-only rows without requiring a conversation screen,
preserves per-conversation order, and reuses stored `clientRequestId`s for
idempotency. Attachment rows remain with the live store, which owns their
upload resolver.

## 4. Completed: programmatic iOS draft writes fire a false typing signal

`ConversationStore.draft`'s `didSet` schedules a typing broadcast, so the
drain's live-store draft append (and two pre-existing recovery call sites)
made the other participant see "typing…" from a background process.
`ConversationStore.appendDraft(_:)` and its quiet setter now persist recovered
text without scheduling typing, and all three recovery sites use it.

Items 2–4 are implemented. Item 1 still requires signed physical-device
verification with APNs/FCM credentials and cannot be completed by simulator
builds alone.

## 5. Smaller accepted residuals (awareness, no action planned)

Recorded with rationale in the plan's per-task "As-built amendments":

- Failure notices are not withdrawn when their conversation is later opened
  (both platforms; they collapse per conversation and auto-cancel on tap).
- Android's degraded failure notice (entries without a message id) opens the
  app root while its copy says "the conversation".
- Android's worker completion is coupled to the whole text outbox — a send
  stuck on an attachment upload keeps the retry chain alive (backoff-paced,
  self-healing).
- A live FCM burst serializes at up to 5 s per message on one thread; offline
  backlogs collapse per conversation, and the degraded outcome is the generic
  line, never loss.
- A conversation with a non-empty composer attachment tray rejects body-only
  quick replies; the reply burns its retry budget (~31 min) and then lands on
  the non-destructive draft-plus-notice path.
- A brand-new conversation's first push renders the generic line (its row is
  not yet in the local cache).
- iOS: the readiness poll and the drain share one ~30 s background budget;
  expiry degrades to "stays queued". The App test target compiles at Swift 5
  while the app compiles at Swift 6, so strict-concurrency shapes are proven
  at the app call sites, not in tests.
