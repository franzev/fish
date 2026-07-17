# Android audio and video calling

**Status:** Implemented; host and local-backend verification complete, physical-device release gates remain

**Scope:** Native Android audio/video calls from authorized one-to-one chat, plus every incoming call authorized by the shared call control plane

## Product behavior

Calling stays inside the existing assigned coach/client relationship. A signed-in user can start one audio or video call from the direct-chat header. The recipient sees one primary **Answer** action and one secondary **Decline** action. During a call the screen exposes only the controls needed for the current session: mute, camera, camera switch, audio route, data saver, messages, and end call.

The Compose UI uses the shared semantic tokens, sentence-case copy, 48 dp interaction targets, no alarming error color, and no meeting lobby or device-choice screen. Camera permission denial quietly converts a requested video call to audio with camera off; microphone denial prevents the call and explains how to continue.

## Architecture

```text
app (lifecycle, permissions, Telecom, notifications, FCM)
 ├── feature:call (state coordinator + Compose UI)
 ├── data:call (Supabase control plane + LiveKit media + preferences)
 ├── core:supabase (one authenticated client shared with chat)
 └── feature:chat (authorized direct-chat entry points)

Supabase Auth/RLS/Edge Functions ── durable authorization and call state
Firebase Cloud Messaging (FID) ──── background Android wake-up
LiveKit Android SDK ──────────────── WebRTC media, TURN, SFU, reconnect
Android Core Telecom ────────────── system call/audio-route integration
```

The call coordinator is the single lifecycle owner. Realtime events are wake-ups; every startup and reconnect performs an authoritative RLS-protected call read. Command writes remain in `call-command`. The app never stores LiveKit tokens, media, SDP, ICE candidates, message contents, or account identifiers in logs.

### Dependencies

- Kotlin, coroutines, Jetpack Compose, Lifecycle, DataStore, and AndroidX Core Telecom.
- Supabase Kotlin using the same process-wide authenticated client as chat.
- LiveKit Android `2.27.0` with adaptive stream, dynacast, simulcast, and provider reconnect handling.
- Firebase Messaging through the Firebase BOM `34.16.0`, using Firebase Installation IDs rather than deprecated registration tokens.

No Google Services Gradle plugin or checked-in `google-services.json` is required. Firebase public Android configuration is injected into `BuildConfig`; the service-account JSON exists only as a Supabase Edge Function secret.

## Call flows

### Outgoing

1. The user taps the audio or video control in an authorized direct chat.
2. The coordinator rejects duplicate taps, checks local device capability, and requests required runtime permissions.
3. `call-command` initiates the call. The database transaction revalidates assignment, rate limits, busy state, idempotency, and transition legality.
4. Android registers the outgoing call with Core Telecom and starts a call-style foreground notification.
5. The recipient receives both the durable/realtime call state and, when backgrounded, a high-priority FCM data message addressed to its Firebase Installation ID.
6. After acceptance, each participant receives a short-lived room token and connects to LiveKit. The microphone starts; camera publication follows the accepted permission state.
7. Provider and Supabase changes reduce into the local state. End, cancel, reject, miss, and fail are terminal and release tracks, renderers, Telecom, notification, and foreground-service state.

### Incoming

1. FCM parses a versioned data-only payload. Invalid, expired, unsupported, or malformed payloads are ignored.
2. The coordinator deduplicates by call ID, verifies the deadline, then restores the authoritative call row once auth is available.
3. Core Telecom and `NotificationCompat.CallStyle` present the call. Full-screen intent is used only when Android permits it.
4. Answer requests microphone permission and camera permission for video. Decline works from the notification without opening the UI.
5. A terminal push or authoritative database state always dismisses native surfaces and releases media, even after process restoration.

### Recovery

- Process recreation restores auth, queries active calls, and refreshes the FID registration.
- Realtime reconnect triggers authoritative backfill; stale ringing calls expire locally and through the server cron transition.
- LiveKit reconnect maps to a calm reconnecting state. The media SDK performs ICE/TURN recovery while the app keeps Telecom and notification ownership.
- Double-taps and repeated push/realtime deliveries are idempotent.
- A user can have only one non-terminal call. Crossed calls resolve through the database lock, not client timing.

## Media quality policy

Auto mode begins at 720p/30 fps and promotes to 1080p/30 only when the camera reports 1080p output and the connection remains excellent. It degrades to 360p/20, then 360p/15, under poor/lost connection or thermal pressure. Recovery uses hysteresis and moves one tier at a time to avoid oscillation. Data saver fixes the low-bandwidth tier.

Remote subscriptions request high quality in normal mode and 360p/15 in low/data-saver modes. LiveKit simulcast, dynacast, and adaptive stream allow the SFU and subscriber view size to avoid sending unused layers. Camera capture uses Camera2 capabilities; WebRTC encoding remains hardware/provider selected through LiveKit and MediaCodec.

Audio is always prioritized over video stability. Camera can be disabled independently, and video calls remain usable as audio calls when camera hardware or permission is unavailable.

## Android lifecycle and permissions

- Required: `RECORD_AUDIO`; optional by call kind/capability: `CAMERA`, `BLUETOOTH_CONNECT`, and `POST_NOTIFICATIONS`.
- Foreground-service types are `phoneCall`, `microphone`, and `camera`; the service safely falls back if a type is unavailable.
- Core Telecom owns system audio endpoints and exposes speaker, earpiece, wired, and Bluetooth routes when available.
- Active video calls opt into Android 12+ auto-enter picture-in-picture with a source rectangle and 16:9 aspect ratio.
- Renderers and tracks are detached on disposal, terminal state, sign-out, and failed connection.
- App backup and device transfer exclude all local state.

## Push security and operations

Migration `0049_android_call_push_devices.sql` adds an RLS-enabled, command-only `push_devices` table. Authenticated clients can execute only the register/unregister RPCs; they cannot select provider identifiers. A registration belongs to the current user and install UUID, conflicts revoke the previous owner, and registrations unseen for 90 days are revoked.

`push-command` validates the authenticated user and the versioned register/unregister body. `call-command` dispatches minimal call data through FCM HTTP v1 after a successful database transition. Ringing TTL is capped at 45 seconds; terminal events use 45 seconds. One bounded retry handles 429/5xx responses, and FCM-unregistered installations are revoked. Service credentials and OAuth access tokens remain server-side.

## Configuration

Android build inputs, supplied as environment variables or Gradle properties:

```bash
SUPABASE_URL=https://project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
FISH_FIREBASE_PROJECT_ID=project-id
FISH_FIREBASE_APPLICATION_ID=1:123456789:android:abcdef
FISH_FIREBASE_API_KEY=public-android-api-key
FISH_FIREBASE_SENDER_ID=123456789
```

Supabase Edge Function secret:

```bash
FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

Never put the service-account JSON, Supabase service-role key, LiveKit secret, or signing passwords in the APK.

## Test strategy and evidence

Automated coverage includes:

- Pure state/quality policy tests: transition parity, duplicate commands, expiration, auth restoration, realtime recovery, poor-network downgrade, thermal downgrade, data saver, and staged recovery.
- Push contract tests: required fields, version, event/kind parsing, invalid/expired input, and terminal behavior.
- Compose device tests: 48 dp targets, labels, incoming hierarchy, active controls, large font, dark theme, RTL, and reconnect state.
- Screenshot regression: incoming audio, active audio dark, active video, reconnect at 200% font, plus updated direct-chat entry-point snapshots.
- Local Supabase: migration application, RLS denial, RPC grants, authenticated register/unregister, invalid request, unauthenticated request, and cleanup.
- Build gates: design-token verification, host unit tests, lint, minified/resource-shrunk release APK, shared package type checks, and existing chat regressions.

Verification completed on 2026-07-17:

- `pnpm android:check`: passed all Android host checks, lint, design guards, release assembly, R8/resource shrinking, and chat/call screenshot validation.
- `pnpm android:instrumented`: passed all 19 device tests on the Android 17 emulator (7 chat UI, 2 call UI, and 10 chat data tests).
- `pnpm android:benchmark`: passed both measured release startup scenarios with five iterations each; Perfetto traces and benchmark JSON were captured for review.
- Installed debug APK smoke test: process remained healthy after a launcher cold start and the Android crash buffer was empty.
- `pnpm verify:calls`: passed all 25 authenticated local control-plane checks, including authorization, idempotency, realtime, webhook ordering, reconnect grace, and failure transitions.
- iOS simulator tests passed, including the native call data, media, state, copy, and snapshot suites; shared web call-state fixture tests passed on the same vectors.
- Repository gates passed: web/package type checking, lint, production build, and all 10 component/module-boundary checks.

These results verify the implementation and shared contracts available in the repository. They do not substitute for the signed physical-device network, push-delivery, and media-quality release matrix below.

Release-device matrix:

| Area | Required coverage |
|---|---|
| Android versions | API 26, 30, 31, 33, 34, current target API |
| Form factors | Small phone, large phone, tablet/foldable, portrait/landscape, PiP |
| Calls | Android↔Android, Android↔web, Android↔iOS; both directions; audio and video |
| Interruption | Background/locked launch, process death, incoming GSM call, audio focus, Bluetooth connect/disconnect, camera/mic revocation |
| Network | Wi-Fi↔cellular, high latency, loss, offline/recovery, TURN/TLS-only restrictive network |
| Quality | 360p/720p/1080p tier changes, audio continuity, echo/noise, lip sync, camera switch, thermal load |
| Performance | Cold start, time-to-ring, time-to-first-audio/video, frames, CPU, memory, battery, thermal throttling |

The repository can verify shared contracts and native test suites for iOS, but a real Android↔iOS background incoming-call test requires signed builds, APNs/FCM credentials, and two physical devices. It remains a release gate and must not be represented as passing from simulator or host-only evidence.

## Platform limitations and deviations

- Android uses Core Telecom, a foreground service, CallStyle notifications, runtime notification permission, and PiP. The web app has none of these system surfaces.
- Android 14+ may deny full-screen call intents according to user/system policy. The high-priority call notification remains available.
- FCM high priority is best effort; OEM battery restrictions can delay background delivery. Durable Supabase recovery catches the call when the app resumes but cannot make an already expired ring answerable.
- 1080p is a ceiling, not a promise. Camera capability, encoder load, thermal state, bandwidth, SFU policy, and the remote display determine actual quality.
- Bluetooth route availability is system-owned and may change during a call.
- Android does not expose the web device picker. This intentionally removes a pre-call choice; route controls appear only in the active call settings.
- iOS uses its own CallKit/APNs lifecycle. Shared call state and LiveKit room contracts are portable, but native incoming-call delivery must be validated under the iOS implementation plan.

## Release recommendation

Enable calling first for staff and a small coach/client pilot. Require successful staging FCM service-account setup, LiveKit webhook verification, Android↔web and Android↔iOS physical-device calls, restrictive-network TURN validation, notification/full-screen policy checks, and target-user review before general rollout. Monitor only aggregate connection category, join duration, reconnect count, and terminal reason; never media content or provider tokens.
