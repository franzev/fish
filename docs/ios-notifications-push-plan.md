# Native iOS notifications and push plan

Status: direct-message implementation landed; credentials and physical-device verification remain
Written: 2026-07-18

## Outcome

Deliver calm direct-message notifications on iOS and deep-link into the one
authorized conversation. Incoming call push is intentionally deferred until
the iOS call experience is ready.

## Implemented slice

- The production iOS app requests notification permission, registers the native
  APNs token, and removes its registration on sign-out.
- The backend accepts `ios` push devices and sends direct-message alerts through
  APNs beside the existing Android FCM delivery.
- Tapping a message notification queues `fish://messages/<conversation-id>`;
  the app resolves it only after auth restoration and the authorized directory
  read complete.
- APNs delivery is configured with `APNS_TEAM_ID`, `APNS_KEY_ID`,
  `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`, and `APNS_ENDPOINT`. No key is stored in
  the repository.

## Contract and backend work

1. Extend `push_devices` with an `ios` platform value and native device token.
   Tokens are user-scoped, unique, rotated on every registration, removed on
   sign-out, and never logged.
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

- The current app boundary owns authorization, token registration, and
  deep-link routing; feature modules remain notification-provider agnostic.
- Standard APNs handles direct messages. PushKit and CallKit delivery remain
  deferred with iOS call push.

## Categories and actions requiring product approval

- Direct message: Open. No inline reply until privacy, moderation, and draft
  behavior are approved.
- Incoming call: deferred with iOS call push.
- Missed call: deferred with iOS call push.
- No streak, score, urgency, or scolding copy; previews respect the system's
  notification privacy setting.

## Deep links

Resolve identifiers only after auth restoration and an RLS-protected read.
Exactly one authorized conversation opens directly. Unknown, revoked, or
deleted entities land on the calm root state.

## Verification matrix

- Fresh install: deny, provisional, allow, later revoke in Settings.
- Token rotation, reinstall, multi-device sign-in, sign-out revocation, and
  development/production environment separation.
- Foreground, background, force-quit, offline delivery, duplicate notification,
  collapse behavior, and notification clearing after opening the conversation.
- Direct messages on two physical devices: locked/unlocked, foreground,
  background, token rotation, sign-out, and notification tap routing.
- VoiceOver labels, Dynamic Type for notification settings, localization, and
  privacy-preview modes.

## Release gates

- APNs signing key and topics installed in the deployment environment.
- Push Notifications entitlement and APNs topic approved for the production
  bundle.
- Backend integration tests pass against APNs sandbox; notification vector and
  iOS unit suites pass.
- The physical direct-message matrix above is signed off. Simulator-only or
  code-only verification cannot release push to users.
