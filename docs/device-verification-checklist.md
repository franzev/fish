# Device verification checklist

Status: Not started
Written: 2026-08-07

Every item below is copied from an existing plan doc's own verification
section — nothing here is new scope, this is one worklist instead of a dozen
scattered ones. Work the tiers top to bottom: each tier's prerequisite is a
superset of the one before it, so working in order means never blocking on a
credential you haven't set up yet. Within a tier, order doesn't matter.

Do not edit the source plan docs while working this list. When every item
from one source doc is checked, go to that doc and flip its `Status:` line
from "physical-device pass remains" (or equivalent) to verified, per
[release-signoff-safety-and-read-receipts-plan.md](release-signoff-safety-and-read-receipts-plan.md)
step 1.6.

## Tier 1 — A built app on a real device, no other infrastructure

Prerequisite: a signed development or release build installed on at least one
physical iPhone and one physical Android phone. No push credentials, no
calling stack, no special network setup. Two devices/accounts only where
noted.

- [ ] **Accessibility and appearance, iOS** — VoiceOver reading order, Full
      Keyboard Access, keyboard open/close/rotate, light/dark switch, Reduce
      Motion, largest Dynamic Type, a copy review with a coach.
      ([ios-personal-chat-foundation-plan.md:4508](ios-personal-chat-foundation-plan.md))
- [ ] **Accessibility sign-off, iOS** — VoiceOver, Full Keyboard Access,
      keyboard/IME, reduced-motion, and large-type manual checks pass on a
      real device. ([ios-personal-chat-foundation-plan.md:4528](ios-personal-chat-foundation-plan.md))
- [ ] **Accessibility, Android** — keyboard, D-pad, Switch Access, touch, IME,
      safe-area, and edge-to-edge checks pass on real devices.
      ([android-personal-chat-foundation-plan.md:705](android-personal-chat-foundation-plan.md))
- [ ] **Account settings screenshots and release build, Android** —
      screenshots, minified release, and physical-device behavior.
      ([android-account-settings-implementation-plan.md:312](android-account-settings-implementation-plan.md))
- [ ] **Notification permission matrix, iOS** — fresh/deny/allow/revoke states
      on a physical device. ([ios-account-settings-implementation-plan.md:139](ios-account-settings-implementation-plan.md))
- [ ] **Two-account direct chat, Android** — two authorized users load, send,
      fail, retry, reconnect, and read a one-to-one text conversation on real
      devices with no duplicates or lost drafts. Needs 2 devices/accounts.
      ([android-personal-chat-foundation-plan.md:668](android-personal-chat-foundation-plan.md))
- [ ] **Lifecycle matrix, Android** — process death, background/foreground
      transitions, network switching, token refresh, realtime duplication;
      run a real-device matrix. ([android-personal-chat-foundation-plan.md:676](android-personal-chat-foundation-plan.md))
- [ ] **Performance measurements, Android** (external gate).
      ([android-personal-chat-foundation-plan.md:23](android-personal-chat-foundation-plan.md))
- [ ] **Message search device matrix, Android** — IME Search, keyboard
      dismissal, font scaling, TalkBack, RTL, dark/light, rotation,
      background/resume, network loss/retry. Needs the target project
      deployed. ([android-message-search-implementation-plan.md:322](android-message-search-implementation-plan.md))
- [ ] **Message search two-account matrix, Android** — manual two-account
      target-project and physical-device matrix. Needs target Supabase
      project + 2 accounts. ([android-message-search-implementation-plan.md:334](android-message-search-implementation-plan.md))
- [ ] **Message search device matrix, iOS** — software/hardware keyboard
      Search, VoiceOver, network loss/retry, background/resume. Needs the
      target project deployed. ([ios-message-search-implementation-plan.md:371](ios-message-search-implementation-plan.md))
- [ ] **Message search two-account matrix, iOS** — manual two-account
      target-project and physical-device parity matrix. Needs target
      Supabase project + 2 accounts. ([ios-message-search-implementation-plan.md:384](ios-message-search-implementation-plan.md))
- [ ] **Offline cache device pass, iOS** (6 rows) — force-quit → airplane mode
      → launch; offline drafts survive force-quit; exactly-once send on
      reconnect; locked-device launch (file protection); sign-out cache
      isolation; no PII in logs. Needs a signed build.
      ([ios-offline-chat-cache-plan.md:250](ios-offline-chat-cache-plan.md))
- [ ] **Offline attachment outbox airplane-mode walkthrough, both platforms**
      — stage and send a photo and a voice message offline, kill the app,
      relaunch still offline, reconnect, confirm exactly-once delivery. Needs
      a signed build. ([offline-attachment-outbox-plan.md:347](offline-attachment-outbox-plan.md))
- [ ] **Friends two-device matrix, both platforms** (7 steps) — send, accept,
      decline, crossed requests, coach exclusion, flag-off, iPad-rail check.
      Needs target project with `FRIENDS_ENABLED=true` + 2 devices. No push
      involved. ([mobile-friends-implementation-plan.md:16](mobile-friends-implementation-plan.md))
- [ ] **Friends realtime confirmation, both platforms** — conversation
      appears on both devices post-accept without relaunch; presence/typing/
      messages work immediately. Same prerequisite as above.
      ([mobile-friends-implementation-plan.md:364](mobile-friends-implementation-plan.md))
- [ ] **Camera capture, iOS** — a physical iPhone can take a photo and see it
      in the existing attachment preview before sending.
      ([native-mobile-feature-completion-plan.md:197](native-mobile-feature-completion-plan.md))
- [ ] **Camera permission paths, iOS** — successful and denied-permission
      paths on a physical iPhone. ([native-mobile-feature-completion-plan.md:212](native-mobile-feature-completion-plan.md))
- [ ] **Permission matrix, both platforms** — camera denied, microphone
      denied, notifications denied, and later restoration from Settings.
      ([native-mobile-feature-completion-plan.md:589](native-mobile-feature-completion-plan.md))
- [ ] **Attachment device pass B, iOS** (oldest supported: iOS 17 device) —
      memory behavior on a 5×12 MP send, Dynamic Type XL, VoiceOver
      transcript sweep. ([ios-chat-attachments-plan.md:1001](ios-chat-attachments-plan.md))
- [ ] **Attachment device/accessibility/perf matrices, Android** — managed
      device, physical device, accessibility, screenshot, baseline profile,
      macrobenchmark, low-storage, Doze, and cross-client matrices.
      ([android-chat-attachments-implementation-plan.md:1059](android-chat-attachments-implementation-plan.md))
- [ ] **Attachment scroll/upload perf, Android** — p95 thumbnail list scroll
      and upload-stage UI meet baseline on a low-memory physical device.
      ([android-chat-attachments-implementation-plan.md:1068](android-chat-attachments-implementation-plan.md))
- [ ] **Presence device checklist, iOS** — backgrounding, re-foreground
      resurrection, multi-device vs. web. (The in-call-backgrounding sub-item
      moves to Tier 3 below — it needs a live call.)
      ([ios-presence-implementation-plan.md:584](ios-presence-implementation-plan.md))
- [ ] **Attachment device pass A, iOS** — PhotosPicker with iCloud-offloaded
      originals on cellular, backgrounding mid-upload, airplane-mode drop →
      reconnect auto-retry. Needs a cellular plan and an iCloud account with
      offloaded originals, no push/call infra.
      ([ios-chat-attachments-plan.md:997](ios-chat-attachments-plan.md))
- [ ] **Attachment network/process-death gate, Android** — physical-device
      release gates include network switching and process death, not only
      emulator happy paths. ([android-chat-attachments-implementation-plan.md:945](android-chat-attachments-implementation-plan.md))
- [ ] **Block/report safety actions, both platforms** — confirm block and
      report from a live conversation on a real device on both platforms
      (this feature has no automated device test; verify Block and Report
      copy, the confirm step, and — for block — that the conversation closes
      and no notification reaches the blocked person).
      ([release-signoff-safety-and-read-receipts-plan.md](release-signoff-safety-and-read-receipts-plan.md) Part 2)

## Tier 2 — Needs push credentials (APNs / FCM), not calling

Prerequisite: everything in Tier 1, plus APNs and/or FCM credentials
configured per `deploy-checklist.md` step 3, and signed builds capable of
receiving push.

- [ ] **Direct-message push matrix, iOS** (two physical devices) — locked/
      unlocked, foreground, background, token rotation, sign-out, and
      notification-tap routing. ([ios-notifications-push-plan.md:70](ios-notifications-push-plan.md))
- [ ] **Direct-message push sign-off, iOS** — the matrix above is the release
      gate; simulator-only or code-only verification does not count.
      ([ios-notifications-push-plan.md:82](ios-notifications-push-plan.md))
- [ ] **Push credentials and device testing, iOS** (chat parity gate).
      ([ios-chat-parity-implementation-plan.md:84](ios-chat-parity-implementation-plan.md))
- [ ] **APNs entitlements on physical devices, iOS** — install credentials,
      verify development/production entitlements.
      ([ios-chat-parity-implementation-plan.md:365](ios-chat-parity-implementation-plan.md))
- [ ] **APNs message-focus verification, iOS** — the APNs message ID is
      currently discarded on tap; physical verification of message-focus
      routing remains. ([native-mobile-feature-completion-plan.md:38](native-mobile-feature-completion-plan.md))
- [ ] **Direct-message push matrix, both platforms** — repeat the matrix
      above (foreground, background, locked, system-terminated cold start,
      token rotation, sign-out, conversation-specific clearing); document
      user force-quit as an OS limitation.
      ([native-mobile-feature-completion-plan.md:574](native-mobile-feature-completion-plan.md))
- [ ] **Quick-reply hardening matrix** (6 rows, mixed platforms) — real push
      text/fallback; quick-reply "You: …" without re-alert; airplane-mode
      reply survives process death; iOS terminated-app lock-screen reply
      sends; rejected-send draft preservation; no content/token/ID in logs.
      ([quick-reply-hardening-remaining-work.md:17](quick-reply-hardening-remaining-work.md))
- [ ] **Sign-out push unregister, iOS** — offline/error states and physical
      notification behavior. ([ios-account-settings-implementation-plan.md:183](ios-account-settings-implementation-plan.md))
- [ ] **Scene-active refresh, iOS** — scene-active refresh, APNs delivery,
      generic preview on a physical device.
      ([ios-account-settings-implementation-plan.md:235](ios-account-settings-implementation-plan.md))
- [ ] **Quiet conversation push suppression, both platforms** — mute a
      conversation, have the other account send, confirm no banner and no
      sound. Needs badge-only APNs/FCM push configured.
      ([conversation-quiet-implementation-plan.md:370](conversation-quiet-implementation-plan.md))

## Tier 3 — Needs calling infrastructure (LiveKit, VoIP/CallKit, two devices)

Prerequisite: everything in Tier 2, plus a LiveKit Cloud project wired per
`deploy-checklist.md`, the APNs VoIP push entitlement, CallKit configured on
iOS, and at least two physical devices for two-sided flows.

- [ ] **Foreground call sanity, iOS** — validate foreground iOS-to-web and
      iOS-to-Android audio/video calls before continuing.
      ([native-mobile-feature-completion-plan.md:363](native-mobile-feature-completion-plan.md))
- [ ] **CallKit control matrix, iOS** — answer, decline, cancel, end,
      interruption by a cellular call, audio-route changes, returning to
      voice recording. ([native-mobile-feature-completion-plan.md:431](native-mobile-feature-completion-plan.md))
- [ ] **VoIP push delivery, iOS** — the target push is blocking for
      real-device verification; a local migration alone cannot prove PushKit
      delivery. ([native-mobile-feature-completion-plan.md:497](native-mobile-feature-completion-plan.md))
- [ ] **Wake-from-terminated incoming call, iOS** — a signed-in iPhone
      receives an incoming call while foregrounded, backgrounded, locked, and
      system-terminated after FISH has launched at least once. The canonical
      VoIP/CallKit case. ([native-mobile-feature-completion-plan.md:526](native-mobile-feature-completion-plan.md))
- [ ] **Cross-platform call matrix, iOS** — iOS incoming and outgoing audio/
      video against Android, web, and another iPhone where available.
      ([native-mobile-feature-completion-plan.md:579](native-mobile-feature-completion-plan.md))
- [ ] **Call lifecycle per pairing, both platforms** — ringing, answer,
      decline, caller cancel, expiry, connected end, temporary network loss,
      reconnect, for each platform pairing.
      ([native-mobile-feature-completion-plan.md:583](native-mobile-feature-completion-plan.md))
- [ ] **Coach/client usability pass, both platforms** — includes answering a
      call and returning to chat. ([native-mobile-feature-completion-plan.md:591](native-mobile-feature-completion-plan.md))
- [ ] **Android↔iOS background incoming call** — needs signed builds, APNs/
      FCM credentials, and two physical devices.
      ([android-audio-video-calling.md:146](android-audio-video-calling.md))
- [ ] **Release-device call matrix, Android** — Android↔Android, Android↔web,
      Android↔iOS; both directions; audio and video.
      ([android-audio-video-calling.md:140](android-audio-video-calling.md))
- [ ] **Local-stack two-party call, iOS** — audio and video against the local
      LiveKit dev stack, device to web browser. One device suffices.
      ([ios-calling-implementation-plan.md:354](ios-calling-implementation-plan.md))
- [ ] **In-call backgrounding, iOS** (presence). ([ios-presence-implementation-plan.md:585](ios-presence-implementation-plan.md))

## Tier 4 — Needs specific network conditions (Wi-Fi/cellular handoff, TURN-only, Bluetooth)

Prerequisite: everything in Tier 3, plus access to a restrictive/TURN-only
network (e.g. a hotspot or VPN that blocks direct UDP) and a Bluetooth audio
accessory for the routing checks.

- [ ] **Full call verification matrix, both platforms** — the most
      comprehensive single item found: locked/background incoming calls,
      accept/reject/end, notification denial, process death, Wi-Fi↔cellular
      handoff, Bluetooth, camera/microphone revocation, PiP, quality
      adaptation, and a TURN/TLS-only restrictive network.
      ([deploy-checklist.md](deploy-checklist.md), hosted verification section)
- [ ] **Network conditions, both platforms** — Wi-Fi, mobile data, network
      switching, and a TURN/TLS-only network.
      ([native-mobile-feature-completion-plan.md:585](native-mobile-feature-completion-plan.md))
- [ ] **Audio routing and interruption, both platforms** — receiver, speaker,
      wired headset, Bluetooth, interruption by a normal phone call, lock/
      unlock, background/foreground, voice recording after the call.
      ([native-mobile-feature-completion-plan.md:586](native-mobile-feature-completion-plan.md))
- [ ] **Interruption matrix, Android** — background/locked launch, process
      death, incoming GSM call, audio focus, Bluetooth connect/disconnect,
      camera/mic revocation. ([android-audio-video-calling.md:141](android-audio-video-calling.md))
- [ ] **Network matrix, Android** — Wi-Fi↔cellular, high latency, loss,
      offline/recovery, TURN/TLS-only restrictive network.
      ([android-audio-video-calling.md:142](android-audio-video-calling.md))
- [ ] **Restrictive-network TURN validation, Android** (release
      recommendation). ([android-audio-video-calling.md:160](android-audio-video-calling.md))
- [ ] **Real-device call matrix, iOS** — receiver vs. speaker routes,
      Bluetooth route change, camera flip, backgrounding, PSTN interruption,
      network switch Wi-Fi ⇄ cellular, thermal/battery observation.
      ([ios-calling-implementation-plan.md:357](ios-calling-implementation-plan.md))

## Adjacent: web calling (not native mobile, included for completeness)

These are browser/web items, not iOS or Android, but share the LiveKit
dependency and were surfaced by the same source-doc sweep.

- [ ] Real-device network matrix — home Wi-Fi, mobile hotspot, corporate VPN,
      UDP-blocked network. ([realtime-calling-implementation-plan.md:503](realtime-calling-implementation-plan.md))
- [ ] Microphone permission, mute, device switching, network switch,
      UDP-blocked/TURN path, Safari/iOS audio playback.
      ([realtime-calling-implementation-plan.md:610](realtime-calling-implementation-plan.md))
- [ ] Cross-browser/network matrix — Chrome, Firefox, Safari; desktop and
      mobile; Wi-Fi, mobile, VPN/UDP-blocked.
      ([realtime-calling-implementation-plan.md:767](realtime-calling-implementation-plan.md))

## Source docs to flip once their tier is green

| Doc | Current status line |
| --- | --- |
| [android-audio-video-calling.md](android-audio-video-calling.md) | "Implemented; host and local-backend verification complete, physical-device release gates remain" |
| [conversation-quiet-implementation-plan.md](conversation-quiet-implementation-plan.md) | "Implemented 2026-07-25; physical-device push sign-off remains external" |
| [ios-notifications-push-plan.md](ios-notifications-push-plan.md) | "direct-message implementation landed; credentials and physical-device verification remain" |
| [ios-offline-chat-cache-plan.md](ios-offline-chat-cache-plan.md) | "Steps 1-2 implemented and merged; Step 3 (physical-device pass) remains external" |
| [native-mobile-feature-completion-plan.md](native-mobile-feature-completion-plan.md) | "Implemented; physical-device release sign-off remains external" |
| [offline-attachment-outbox-plan.md](offline-attachment-outbox-plan.md) | "Steps 1–5 implemented, tested, and merged (2026-07-28); Step 6 (physical-device pass) remains external" |
| [quick-reply-hardening-remaining-work.md](quick-reply-hardening-remaining-work.md) | "code follow-ups complete; physical-device verification remains release-blocking (2026-07-31)" |
| [realtime-calling-implementation-plan.md](realtime-calling-implementation-plan.md) | "real-device, network, privacy, and pilot gates remain" |
| [ios-chat-parity-implementation-plan.md](ios-chat-parity-implementation-plan.md) | "credentials/device verification and iOS call push deferred" |
| [android-personal-chat-foundation-plan.md](android-personal-chat-foundation-plan.md) | "external pilot gates remain" (physical-device performance measurements specifically) |

Each row's tier is whatever its highest-tier checklist item above requires —
most are Tier 3 or 4 (calling-dependent). Do not flip a status line until
every item sourced from that doc, across every tier, is checked.
