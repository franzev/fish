# Native iOS notifications and push plan

Status: implementation gated by credentials and physical-device verification  
Written: 2026-07-18

## Outcome

Deliver calm direct-message and call notifications on iOS, keep the app badge
equal to authoritative navigation attention, and deep-link into the one
authorized destination. This milestone starts only after APNs credentials,
entitlements, notification-category copy, and physical test devices are
available.

## Contract and backend work

1. Extend `push_devices` with an `ios` platform value, APNs environment,
   opaque device token, app version, locale, last-seen timestamp, and revoked
   timestamp. Tokens are user-scoped, unique, rotated on every registration,
   removed on sign-out, and never logged.
2. Add service-role APNs delivery beside the existing Android FCM dispatcher.
   Persist no message body beyond existing data. Payloads carry stable entity
   identifiers and minimal calm copy; the app re-reads canonical RLS data.
3. Direct-message payload: kind, conversation id, message id, sender id, sender
   display name, and collapse/thread identifiers. Calls additionally carry call
   id, caller id/name, kind, expiry, and a server-generated nonce.
4. Use development and production APNs topics separately. Store APNs keys only
   in deployment secrets. Treat invalid/unregistered-token responses as device
   revocation and retry transient provider failures with bounded backoff.

## iOS architecture

- An application-scoped notification repository owns authorization state,
  token registration, badge refresh, category registration, and deep-link
  routing. Feature modules receive typed intents; they do not import
  `UserNotifications`.
- Replay `notification-state-vectors.json` through a small Swift state port so
  foreground/background delivery, seen/read transitions, coalescing, and badge
  math match web/Android.
- Standard APNs handles direct messages. Incoming call ringing uses PushKit to
  wake the app and CallKit to report the call immediately. A PushKit wake that
  cannot resolve a valid, unexpired call reports an ended call to CallKit; it
  never opens custom UI silently.
- The badge is refreshed from `list_navigation_attention`, not incremented from
  payloads. Foreground notifications become in-app attention wake-ups without
  banners unless product explicitly approves them.

## Categories and actions requiring product approval

- Direct message: Open. No inline reply until privacy, moderation, and draft
  behavior are approved.
- Incoming call: Answer and Decline through CallKit only.
- Missed call: Open conversation. This supplies the deferred Phase 8 deep-link.
- No streak, score, urgency, or scolding copy; previews respect the system's
  notification privacy setting.

## Deep links

Resolve identifiers only after auth restoration and an RLS-protected read.
Exactly one authorized conversation opens directly. Unknown, revoked, or
deleted entities land on the calm root state. A missed-call link opens its
conversation and may focus the call event only when that event is present.

## Verification matrix

- Fresh install: deny, provisional, allow, later revoke in Settings.
- Token rotation, reinstall, multi-device sign-in, sign-out revocation, and
  development/production environment separation.
- Foreground, background, force-quit, offline delivery, expired call, duplicate
  notification, collapse behavior, and badge clearing from web or iOS reads.
- Voice and video calls on two physical devices: locked/unlocked, declined,
  answered, missed, app killed, weak network, and audio interruption.
- VoiceOver labels, Dynamic Type for notification settings, localization, and
  privacy-preview modes.

## Release gates

- APNs signing key and topics installed in the deployment environment.
- Push Notifications, Background Modes, PushKit, and CallKit entitlements
  approved for the production bundle.
- Notification category copy approved by product and privacy review complete.
- Backend integration tests pass against APNs sandbox; notification vector and
  iOS unit suites pass.
- The complete physical-device matrix above is signed off. Simulator-only or
  code-only verification cannot release this milestone.
