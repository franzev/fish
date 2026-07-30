# Notification quick reply hardening — design

Status: Implemented (2026-07-30) — see
`docs/superpowers/plans/2026-07-30-notification-quick-reply-hardening.md` for
the as-built record; physical-device rows joined the outstanding release pass
Scope: the existing native direct-chat apps only. Platform order: Android first.

## Background

Notification quick reply already shipped on both platforms
(`f9b6b5d6` Android, `6890025d` iOS) without a plan doc. Both platforms share
one architecture: the notification carries a text-input Reply action, the typed
text goes into a durable on-disk outbox, and the outbox drains through the
`send-message` Edge Function once the authenticated app is running. Trimming,
the 4000-character cap, and `clientRequestId` idempotency are already correct.

Two doc references predate the feature and still call it deferred or gated:
`docs/native-mobile-feature-completion-plan.md` (deferred list) and
`docs/ios-notifications-push-plan.md` ("No inline reply until … approved").
This design supersedes both references; fixing them is part of the work.

## Problems this design closes

1. **Delivery is best-effort.** iOS transmits a reply only when the app next
   runs with a restored session; a lock-screen reply from a terminated app can
   sit unsent indefinitely. Android drains on an app coroutine scope
   (`FishApplication.processPendingChatReplies` on `callScope`), so process
   death mid-drain parks the reply until the next trigger.
2. **Failure is silent.** Android dismisses the notification on reply
   (`ChatReplyReceiver`); iOS shows nothing. A reply that later fails is lost
   without the user ever learning it.
3. **Android notifications are content-free and the reply vanishes.**
   `ChatNotificationFactory` uses a plain builder with "Sent you a message";
   users reply to a message they cannot read, and their reply is not echoed.
   Notification IDs hash into 800 buckets, so two conversations can overwrite
   each other's notification.
4. **Badges lie after a reply.** Neither platform marks the conversation read,
   so unread badges keep pointing at a message the user already answered.
5. **Dual outboxes.** When a quick-reply send hits a network failure inside
   `sendMessage`, the message is silently re-queued into the composer's Room
   text outbox and the call reports optimistic success, so the notification
   reply store drops its copy and ownership shifts to a queue that only
   flushes when the app's UI pathways next run. The server dedupes by
   `clientRequestId`, but locally no single owner is responsible for delivery.

## Decisions

### Notification content: Android fetches, iOS stays generic

Push payloads remain content-free — that privacy stance (message text never
transits FCM/APNs) is kept. Android pushes are data-only and the app already
builds the notification locally, so on receipt it performs a bounded (~5 s)
authorized fetch of the pushed message by ID and shows real text, reusing the
repository's existing `refreshMessages(conversationId, messageIds)` read. A
conversation not yet present in the local cache (a brand-new conversation's
first message) falls back to the generic line. Any fetch failure — offline, revoked,
timeout — falls back to today's generic copy. iOS alerts stay "New message";
showing content there requires a Notification Service Extension with session
access, which is deliberately deferred to a future slice.

Rejected: putting a bounded excerpt in both payloads (reverses the privacy
choice); iOS NSE now (largest and most security-sensitive slice); keeping both
platforms generic (quick reply stays reply-without-reading).

### Android drain: WorkManager owns it

`ChatReplyReceiver` and the signed-in auth transition enqueue unique
WorkManager work with a network constraint and backoff. The worker holds the
existing drain logic: signed-in gate, authorized-conversation filter, removal
on success and on terminal failures (authentication, authorization,
`conversation_not_available`, `invalid_request`). Delivery ownership is
unified rather than duplicated: when a send hands the message to the
composer's Room text outbox (the repository does this on a network failure,
reporting optimistic success), the reply leaves the notification store and the
worker takes responsibility for flushing that outbox — it calls the existing
`flushTextOutbox` for every conversation it touched and keeps retrying with
backoff until no pending sends remain. One delivery owner, no phantom
transcript states, and the composer send path is untouched. The worker
infrastructure (worker factory, DI) already exists for attachment uploads.

Rejected: keeping `callScope` with more triggers (still dies with the
process); a send variant that bypasses the Room outbox (leaves the optimistic
transcript message stranded in a failed state while retries continue);
rewriting reply capture onto the Room outbox directly (drags the composer
path into this change).

### iOS drain: immediately, under a background-task assertion

The reply handler in `FishAppDelegate` enqueues the reply, then awaits session
restoration and `processPendingNotificationReplies()` under a
`beginBackgroundTask` assertion with a ~20 s ceiling before releasing. iOS
launches the app into the background to deliver notification actions, so
lock-screen replies from a terminated app now send right then. Anything that
cannot finish inside the window stays durably queued exactly as today.

### Reply echo and grouping (Android)

`ChatNotificationFactory` switches to `NotificationCompat.MessagingStyle` with
a `Person` per sender (names only; no avatar fetch). Incoming lines show the
fetched text or the generic fallback line. A quick reply appends the user's
text to the existing notification instead of dismissing it, restoring prior
lines via the standard extract-from-active-notification pattern — no new
persistence. The channel keeps `VISIBILITY_PRIVATE`, so secure lock screens
continue redacting. The notification ID derivation widens from its 800-bucket
modulo to a range large enough that same-range collisions are negligible,
chosen disjoint from the call-notification IDs (calls occupy 6100–6899 via
their own 800-bucket scheme).

### Mark read on reply (both)

Reply store entries gain the pushed `messageId` (entries persisted before this
change may lack it; those skip the mark-read call). After a reply sends
successfully, call the existing `mark-read-state` command with the notified
message ID — never a newer one, so the client claims only what the
notification represented. No client-side clamp is needed: the
`mark_chat_read_state` RPC already keeps the later of the stored and
submitted markers per column (`private.later_chat_message_id`, under a row
lock), so the call can never regress a further-along read state. iOS
refreshes the app badge through its existing badge path; the Android badge
already rides on the notification.

### Honest failure (both)

On terminal failure or retry exhaustion, post one calm notice-toned
notification — copy in the app's voice, e.g. "Your reply didn’t send. Tap to
open the conversation and try again." — whose tap deep-links into the
conversation. The reply text is preserved: on Android, a reply that reached
the send pipeline survives as the transcript's failed message with its
existing retry affordance, and a reply that never got that far is saved as
the composer draft; on iOS, terminal failures save the composer draft. Never
silent loss, never alarming red, no repeat nagging.

## Constraints carried over

- Never log message text, push tokens, account IDs, or conversation IDs.
- Push payloads are wake-up hints; canonical data is re-read behind RLS.
- No backend, schema, or Edge Function changes.
- No new iOS targets; FishKit stays notification-provider-agnostic.
- Group/channel conversations receive no pushes today; this design stays
  direct-only.

## Verification

Unit coverage: notification factory states (fetched content, fallback, echo,
restore-from-active, ID scheme), reply-store `messageId` migration, worker
drain paths (success, network-retry, terminal, signed-out), iOS drain under
timeout, mark-read clamping and skip cases, failure-notice emission and
deep-link payload. Gates: `pnpm android:test`, `pnpm android:check`,
`pnpm ios:test`, `pnpm ios:app:build`, `pnpm build`. Physical-device push
behavior joins the already-outstanding device release matrix.

## Out of scope

iOS Notification Service Extension (content on iOS), bubbles/shortcuts/avatar
notifications, per-conversation notification settings beyond the shipped mute,
notification quick actions other than Reply, group-conversation pushes, and
any web-product surface.
