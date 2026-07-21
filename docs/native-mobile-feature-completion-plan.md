# Native mobile feature completion plan

Status: Implemented; physical-device release sign-off remains external
Written: 2026-07-21

## Outcome

Close the remaining obvious gaps in the direct-chat mobile apps without
expanding mobile into lessons, dashboards, community, assigned work, or other
web-product surfaces.

The finished result is:

- Android and iOS can copy the text of a message.
- iOS can take a photo from the attachment menu, matching Android's existing
  behavior.
- An iOS message-notification tap focuses the notified message after the
  conversation is authorized and opened, matching Android.
- Opening a conversation clears that conversation's delivered message
  notification on both platforms.
- The existing iOS call implementation is connected to the production app.
- iOS calls use CallKit and can arrive while the app is backgrounded, locked,
  or system-terminated after a prior launch through PushKit.

This plan deliberately reuses the existing chat, attachment, call-control,
LiveKit, push-device, and design-system code. It does not introduce another
service, dependency-injection framework, navigation system, or generic mobile
abstraction.

## Current baseline

| Capability | Android | iOS | Work in this plan |
| --- | --- | --- | --- |
| Direct chat, replies, edit/delete, reactions, voice messages, search | Complete | Complete | Preserve |
| Copy message text | Missing | Missing | Add on both |
| Photo library and files | Complete | Complete | Preserve |
| Take a photo | Complete | Missing | Add on iOS |
| Direct-message push and deep link | Complete, including message focus | Conversation opens, but the APNs message ID is discarded; physical verification remains | Focus the notified message on iOS and clear delivered notifications on both |
| Conversation unread indicators | Complete | Complete | Reuse as authority in the app |
| Audio/video calling | Production-wired, including background incoming calls | Call modules and LiveKit adapter exist, but the production app does not link or mount them | Finish iOS production integration |

Android has no remaining large feature gap in the current direct-chat scope.
Its work here is intentionally limited to copy-message and notification
cleanup. The larger work is completing the already-built iOS calling stack.

## Execution order

| Step | Shippable result | Depends on |
| --- | --- | --- |
| 1 | Copy message text on Android and iOS | Current chat actions |
| 2 | Take and send a photo on iOS | Current attachment pipeline |
| 3 | Focus iOS notification targets and clear stale notifications on both platforms | Current authorized routing and focus-by-message-ID path |
| 4 | Foreground calling in the production iOS app | Existing FishKit call modules |
| 5 | CallKit-managed iOS calls | Step 4 |
| 6 | Background/locked/system-terminated incoming iOS calls | Step 5, Apple entitlements, backend migration |
| 7 | Target-environment release sign-off | Steps 1–6 |

Steps 1–3 are technically independent, but keeping this order gives three
small, low-risk releases before calling changes the production iOS lifecycle.
Steps 4–6 are strictly sequential.

## Rules for execution

1. Implement and merge the steps in order. Each step must leave the affected
   app working and independently releasable.
2. Do not start the next step while the current step's automated checks fail.
3. Keep device and OS integration in the application target. Keep portable
   chat and call behavior in the existing FishKit/feature modules.
4. Treat push payloads as wake-up hints. Re-read the RLS-protected call or
   conversation before acting on protected data.
5. Never log message text, attachment bytes, APNs/PushKit tokens, call tokens,
   account IDs, or conversation IDs.
6. Run `pnpm build` before each implementation commit, in addition to the
   platform checks named below.

## Step 1 — Copy message text on Android and iOS

### Goal

Add one `Copy` action to the existing message-action surface on both platforms.
Copy the exact stored message body, not its rendered Markdown, sender, time, or
delivery state.

Show `Copy` only when the message:

- is not deleted;
- is not in a sending or failed-only state; and
- has a non-empty text body.

Attachment-only, GIF-only, sticker-only, and voice-only messages do not show
`Copy` in this slice.

### Why it is necessary

Copying a useful phrase is basic chat behavior and especially relevant to an
English coaching conversation. It is local-only, low-risk, and requires no
backend contract.

### Dependencies and assumptions

- Existing action availability remains authoritative.
- Copying does not need a server event, analytics event, or permission.
- The OS clipboard confirmation is sufficient; do not add a custom toast or
  success dialog unless device testing shows that users cannot tell the action
  succeeded.

### Lean implementation

#### Android

- Update
  `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/ChatMessageActionsSheet.kt`.
- Add a local `onCopy` callback and a secondary `Copy` row in the existing
  Actions view.
- At the screen boundary, use the Compose clipboard API already supplied by
  the current Compose BOM. Do not route clipboard state through
  `ChatViewModel` or `ChatRepository`.
- Add `copy_message` to the feature's string resources.
- Close the sheet after a successful copy.

#### iOS

- Update
  `apps/ios/FishKit/Sources/PersonalChat/Views/MessageBubble.swift`.
- Add `Copy` to the existing context menu and write the original body to
  `UIPasteboard.general`.
- Keep this local to the view. Do not add a `MessageAction` case or send the
  operation through `ConversationStore` because no domain state changes.

### Working-state checkpoint

- Incoming and outgoing text messages expose `Copy`.
- Copying preserves whitespace and Unicode exactly.
- Deleted and bodyless messages do not expose it.
- Reply, edit, delete, reaction, and report behavior is unchanged.

### Verification

- Add Android UI assertions for the visible/hidden action cases and clipboard
  content.
- Add iOS `MessageBubbleTests` coverage for menu availability and manually
  verify paste into Notes or the composer on a simulator/device.
- Run `pnpm android:test`, `pnpm android:screenshots`, `pnpm ios:test`, and
  `pnpm ios:catalog`.

## Step 2 — Take a photo from the iOS composer

### Goal

Add `Take photo` to the existing iOS `Add to message` dialog. A captured still
image must enter the same attachment preparation, validation, staging, upload,
preview, retry, and send path used by photo-library images.

### Why it is necessary

Android already supports camera capture. On iOS, users currently have to leave
the conversation, take a photo, and return through the photo library. The gap
is visible and can be closed using the system camera without a custom capture
stack.

### Dependencies and assumptions

- Still images only; video capture is out of scope.
- One camera capture consumes one of the existing five attachment slots.
- Captured images are sent to FISH but are not automatically saved to the
  user's photo library.
- Existing `ImagePreparation` remains responsible for downsampling,
  re-encoding, metadata removal, size enforcement, and staging.

### Lean implementation

- Add `NSCameraUsageDescription` to
  `apps/ios/App/project.yml` and the generated/source Info.plist contract.
- Add a small `UIViewControllerRepresentable` wrapper around the system
  `UIImagePickerController` with `.camera` and still-image media only. Do not
  introduce AVFoundation or a custom camera UI.
- Keep the wrapper next to the composer or in a narrowly named PersonalChat
  view file; do not create a camera framework.
- Update
  `apps/ios/FishKit/Sources/PersonalChat/Views/MessageComposer.swift`:
  - show `Take photo` only when `UIImagePickerController.isSourceTypeAvailable(.camera)`;
  - reserve an attachment slot before processing;
  - convert the returned image to image bytes;
  - create the existing `AttachmentCandidate` with name `Photo` and the
    detected source MIME type;
  - pass it to `AttachmentUploadsModel.fulfillLoadingItem`.
- On cancellation, release the reservation without a notice.
- On denied permission or unreadable image data, use the existing calm
  attachment failure treatment. Keep `Photo library` available.

Apple documents `UIImagePickerController` as the system interface for taking a
picture and recommends it instead of AVFoundation when a custom camera is not
needed: <https://developer.apple.com/documentation/uikit/uiimagepickercontroller>.

### Working-state checkpoint

- A physical iPhone can take a photo and see it in the existing attachment
  preview before sending.
- Cancel returns to the composer without leaving a placeholder.
- A denied permission explains that the photo library remains available.
- Simulators and devices without a camera omit `Take photo`.
- Attachment-count, size, retry, offline, and send rules are unchanged.

### Verification

- Add unit coverage for captured-data admission, cancellation, failure, and
  the attachment limit.
- Add a catalog/snapshot state showing the attachment dialog with and without
  camera availability.
- Run `pnpm ios:test`, `pnpm ios:catalog`, `pnpm ios:guard`, and
  `pnpm ios:app:build`.
- Perform the successful and denied-permission paths on a physical iPhone.

## Step 3 — Finish message-notification navigation and cleanup

### Goal

On iOS, carry the existing APNs `messageId` through authorized routing and
focus that message after its conversation opens. On both platforms, remove
only the delivered message notification(s) for the opened conversation. Do not
clear notifications belonging to another conversation.

### Why it is necessary

Android already focuses the message named by its push payload; iOS currently
discards the same identifier even though its search feature already supports
focus by message ID. Both apps can also leave stale OS notifications behind
when a conversation is opened from inside the app. Completing navigation and
cleanup makes the existing notification contract coherent without inventing
another unread-state system.

### Dependencies and assumptions

- The existing server read-state command remains authoritative for unread
  counts.
- Clearing an OS notification is presentation cleanup, not proof that the
  server read-state write succeeded.
- Android launcher badges continue to be derived by the launcher from active
  notifications. Exact iOS app-icon counts are not part of this step.

### Lean implementation

#### Android

- Make the existing conversation-derived notification ID reusable inside
  `ChatNotificationFactory` and add `cancel(context, conversationId)`.
- Call it after `ChatViewModel` accepts an authorized conversation selection
  or notification destination. Do not cancel before authorization/routing
  succeeds.
- Do not add a notification repository or persist notification IDs.

#### iOS

- Add one app-owned helper that calls
  `UNUserNotificationCenter.getDeliveredNotifications`, selects requests whose
  payload has `type == "chat_message"` and the opened `conversationId`, and
  removes those request identifiers.
- Replace the conversation-only notification bridge with a small app-local
  destination value containing both `conversationId` and `messageId`.
- After `FishAppModel.openConversation` authorizes and starts the conversation
  store, call its existing `focusMessage(messageId)` path. If the target is not
  in the initial page, reuse the existing authoritative fetch-by-ID behavior
  added for message search.
- Invoke it after `FishAppModel.openConversation` resolves the ID against the
  authorized directory.
- Keep the helper in the application target; FishKit remains notification
  provider-agnostic.

Apple exposes delivered notification enumeration and targeted removal through
`UNUserNotificationCenter`: <https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/getdeliverednotifications(completionhandler:)>.

### Working-state checkpoint

- Opening conversation A removes A's message notifications.
- Conversation B's notifications remain.
- Invalid or revoked conversation IDs clear nothing.
- Android notification taps continue to focus the intended message.
- iOS notification taps focus the intended message, including a target outside
  the initial transcript window.

### Verification

- Add Android tests for stable IDs, targeted cancellation, and invalid
  destination behavior.
- Inject or wrap `UNUserNotificationCenter` only at the existing app boundary
  needed for tests; do not create a general notification module.
- Add iOS tests with delivered notifications from two conversations plus
  authorized, unauthorized, initially loaded, and fetch-by-ID message targets.
- Run `pnpm android:test`, `pnpm android:check`, `pnpm ios:test`, and
  `pnpm ios:app:build`.

## Step 4 — Wire foreground iOS calling into the production app

### Goal

Make the existing iOS call implementation usable in the production `Fish`
target while the app is active:

- show quiet audio and video call buttons in an authorized conversation;
- start, receive, answer, decline, cancel, and end calls;
- mount the existing call overlay once at the application root;
- render LiveKit local/remote video and the current transcript in the call
  surface when a conversation is open.

### Why it is necessary

`CallData`, `Calls`, and `CallMediaLiveKit` are implemented and tested, but the
production app target does not depend on them. The work already exists but is
currently reachable only from development/catalog hosts.

### Dependencies and assumptions

- The current Supabase call-control plane and LiveKit deployment remain the
  source of truth.
- `PollingCallRealtime` is acceptable for this first production wiring. A new
  websocket adapter is unnecessary until foreground polling latency causes a
  measured problem.
- One signed-in account has at most one live call, matching the existing
  backend and reducer rules.
- Calls are available only from an authorized direct conversation.

### Lean implementation

- Add the existing `CallData`, `Calls`, and `CallMediaLiveKit` FishKit products
  to `apps/ios/App/project.yml`.
- Add the production camera usage description required by video calls. Reuse
  the microphone description already used by voice messages.
- Let `FishAppModel` own exactly one `LiveKitCallMedia` and one
  `CallSessionModel` for the signed-in session:
  - build `CallBackendConfiguration` from `ChatLiveSession.backend`;
  - reuse `EdgeFunctionCallCommands`, `RestCallDirectory`, and
    `PollingCallRealtime` exactly as the live catalog does;
  - start after session attachment;
  - shut down before push unregister and auth sign-out.
- Mount `CallOverlay` once above the root app content. Do not create one model
  per conversation.
- In `ConversationView`, combine the existing `CallEntryButtons` with the
  search icon in the current trailing-content slot. These remain quiet icon
  actions; the screen still has no competing primary button.
- Pass the authorized participant ID/name to `CallSessionModel.startCall`.
- Disable both call buttons while the call model is busy or already owns a
  live call.
- Reuse the current transcript for the in-call chat pane when it is available;
  omit the chat toggle when no conversation store is mounted rather than
  building a second transcript owner.

### Working-state checkpoint

- iOS can place and receive audio/video calls while foregrounded.
- Navigation between inbox and conversation does not destroy an active call.
- Sign-out reliably ends local media and call observation.
- Starting a second call is prevented by the existing reducer/model.
- Message, voice recording, and attachment behavior remain available when no
  call is active.

### Verification

- Add app-host tests for session attach/teardown and call-button routing.
- Preserve existing call reducer, snapshot, permission, and LiveKit adapter
  tests; do not duplicate them in the app target.
- Run `pnpm ios:test`, `pnpm ios:catalog`, `pnpm ios:guard`,
  `pnpm ios:app:build`, and `pnpm verify:calls`.
- Manually validate foreground iOS-to-web and iOS-to-Android audio/video calls
  on physical devices before continuing.

## Step 5 — Give iOS calls system ownership with CallKit

### Goal

Coordinate active iOS calls with the system so answer/end actions, audio
routing, interruptions, and lock-screen presentation use CallKit.

This step is complete before PushKit is introduced. That ordering matters:
Apple requires VoIP pushes to be reported promptly through CallKit.

### Why it is necessary

An in-app call overlay alone does not provide correct phone-call behavior.
CallKit is the system boundary for incoming/outgoing call UI and device-level
call coordination. Apple requires CallKit for PushKit VoIP calls on modern iOS:
<https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit>.

### Dependencies and assumptions

- Step 4's single app-level `CallSessionModel` is available.
- Call IDs are UUIDs and can be used as the stable `CXCall` UUID.
- The existing FISH call overlay remains the in-app media/control surface;
  CallKit owns system presentation and actions.

### Lean implementation

- Add one app-owned `CallKitCoordinator`; do not add another FishKit target.
- Own one long-lived `CXProvider` and one `CXCallController`.
- Route outgoing calls through a `CXStartCallAction`; after CallKit accepts the
  action, invoke the existing `CallSessionModel.startCall`.
- Report foreground incoming ringing state with
  `CXProvider.reportNewIncomingCall`.
- Map `CXAnswerCallAction` to `CallSessionModel.answer` and `CXEndCallAction`
  to decline, cancel, or end according to the current call lifecycle.
- Report backend terminal states to CallKit with the nearest system end reason.
- Keep CallKit and the reducer synchronized by call ID; do not create a second
  call state machine.
- Follow LiveKit's existing CallKit integration path:
  - disable automatic LiveKit audio-session configuration before connecting;
  - hold the LiveKit audio engine unavailable outside CallKit activation;
  - on `provider(_:didActivate:)`, configure the supplied audio session for
    play-and-record with voice/video chat mode and enable the LiveKit engine;
  - on deactivation, disable the LiveKit engine.
- Expose only the few concrete audio-coordination methods needed on
  `LiveKitCallMedia`; do not introduce a generic media-session framework.

LiveKit documents the required CallKit audio timing through its Swift
`AudioManager`: <https://github.com/livekit/client-sdk-swift#integration-with-callkit>.

### Working-state checkpoint

- Foreground incoming and outgoing calls appear in the system call UI.
- Answer/end actions from both the system UI and FISH converge on the same
  backend call row.
- Audio starts only after CallKit activates the session and stops on
  deactivation.
- Wired headset, Bluetooth, receiver, and speaker routes remain under system
  control.
- Voice-message recording works again after a call ends.

### Verification

- Unit-test call-state-to-CallKit mapping with closures/fakes around the
  coordinator's model commands; do not attempt to instantiate a real
  `CXProvider` in pure tests.
- Add physical-device checks for answer, decline, cancel, end, interruption by
  a cellular call, audio-route changes, and returning to voice recording.
- Run `pnpm ios:test`, `pnpm ios:catalog`, `pnpm ios:app:build`, and
  `pnpm verify:calls`.

## Step 6 — Add iOS PushKit delivery for background incoming calls

### Goal

Deliver only new incoming-call invitations through APNs VoIP pushes so iOS can
wake or launch FISH, report the call to CallKit, restore auth, re-read the
canonical call row, and answer or decline it.

### Why it is necessary

Without PushKit, the recipient must already have FISH active. PushKit is the
platform mechanism for waking or launching a VoIP app for a real incoming
call: <https://developer.apple.com/documentation/pushkit>.

### Dependencies and assumptions

- Step 5's CallKit coordinator is complete and initialized early in app launch.
- The Apple developer account can enable Push Notifications and Voice over IP
  background mode for `app.fish.mobile`.
- Deployment can provide APNs credentials for the `.voip` topic.
- Standard APNs tokens for messages and PushKit tokens for calls are different
  registrations and must coexist for the same installation.
- Only the `ringing` event uses a VoIP push. Later call state changes continue
  through the durable row plus the existing realtime/polling connection; do
  not misuse VoIP pushes as a general signaling channel.

### Lean implementation

#### Backend and database

- Add one migration that extends `push_devices` with a constrained
  `push_kind` (`standard` or `voip`) defaulting existing rows to `standard`.
- Replace the uniqueness rule with `(user_id, installation_id, push_kind)` so
  one iOS installation can retain both its standard APNs token and VoIP token.
- Preserve the unique active provider-token index.
- Keep the existing standard `register_push_device` behavior unchanged and
  add narrowly named VoIP registration and VoIP-only unregistration
  RPC/actions. Sign-out unregistration revokes both kinds for the installation.
- Extend `push-command` with the VoIP registration action; accept only iOS,
  validate token length, and never log the token.
- Add a dedicated APNs VoIP dispatcher beside the existing standard APNs
  dispatcher:
  - query active iOS `voip` rows only;
  - use topic `${APNS_BUNDLE_ID}.voip`;
  - set `apns-push-type: voip`, priority `10`, and expiration `0` or the
    remaining few seconds of the call invitation;
  - include only call ID, kind, caller display name/ID, and expiry needed for
    immediate system presentation;
  - revoke invalid/unregistered tokens and retry only transient provider
    failures once, matching the existing APNs helper.
- Invoke the VoIP dispatcher only for `CallPush.event == "ringing"` while
  preserving the existing Android FCM path.

This step modifies Supabase schema. After the migration is complete, run the
local reset and contract checks before any target push:

1. `pnpm db:reset`
2. `pnpm verify:calls`
3. `pnpm verify:rls`
4. `supabase db push` for the selected target environment

The target push is blocking for real-device verification; a local migration
alone cannot prove PushKit delivery.

#### iOS application

- Add the Voice over IP background mode and required entitlements through
  `apps/ios/App/project.yml`; regenerate the Xcode project.
- Create one `PKPushRegistry` early and request `.voIP` tokens.
- Register token updates through the existing authenticated push-command
  boundary using the same installation UUID as standard APNs but `voip` kind.
- On token invalidation, revoke the VoIP registration without affecting the
  standard message token.
- On an incoming payload:
  1. validate the minimum payload shape and UUID;
  2. immediately report it through the existing `CallKitCoordinator`;
  3. always invoke the PushKit completion handler;
  4. after auth restoration, call a small public `CallSessionModel.recover(callId:)`
     method that re-reads the RLS-protected row;
  5. if the row is missing, unauthorized, expired, or terminal, end the
     CallKit call calmly without exposing payload data.
- Keep one pending call ID across cold-start auth restoration. Do not persist
  caller names, media tokens, or full push payloads.

Apple warns that a VoIP push must be reported quickly to CallKit and may stop
launching an app that repeatedly fails to do so:
<https://developer.apple.com/documentation/pushkit/pkpushtype/voip>.

### Working-state checkpoint

- A signed-in iPhone receives an incoming call while foregrounded,
  backgrounded, locked, and system-terminated after FISH has been launched at
  least once.
- The system call UI appears promptly and answer/decline reaches the existing
  backend command exactly once.
- Expired or replayed payloads cannot reopen a completed call.
- Message APNs registration and delivery still work on the same installation.
- Sign-out revokes both standard and VoIP tokens.
- Android incoming calling is unchanged.

### Verification

- Add migration/RPC tests for standard-plus-VoIP coexistence, token rotation,
  revocation, cross-user takeover prevention, and RLS denial.
- Add APNs request tests for topic, headers, short expiry, payload shape,
  transient retry, and invalid-token revocation.
- Add iOS tests for token update/invalidation, malformed payloads, pending
  cold-start recovery, unauthorized calls, duplicate delivery, and guaranteed
  completion-callback execution.
- Run `pnpm db:reset`, `pnpm verify:calls`, `pnpm verify:rls`,
  `pnpm ios:test`, `pnpm ios:app:build`, `pnpm android:test`, and
  `pnpm build`.

## Step 7 — Physical-device release pass

### Goal

Prove the combined result in the target environment and stop treating
simulator/build success as release evidence.

### Why it is necessary

Camera capture, APNs, PushKit, CallKit, lock-screen behavior, audio routing,
and process restoration cannot be validated completely in unit tests or an
iOS simulator.

### Dependencies and assumptions

- Target Supabase migrations and Edge Functions are deployed.
- APNs standard and VoIP topics, LiveKit, Firebase, and signing credentials
  are installed in the target environment.
- At least one physical iPhone and one physical Android device are available;
  web supplies the third interoperability endpoint.

### Execution matrix

1. Repeat the existing direct-message push matrix on iOS and Android:
   foreground, background, locked, system-terminated cold start, token
   rotation, sign-out, and conversation-specific clearing. Explicitly test and
   document user force-quit as an OS limitation: Apple does not resume remote
   notification delivery until the user relaunches the app.
2. Test iOS incoming and outgoing audio/video against:
   - Android;
   - web; and
   - another iPhone where available.
3. For each pairing test ringing, answer, decline, caller cancel, expiry,
   connected end, temporary network loss, and reconnect.
4. Test Wi-Fi, mobile data, network switching, and a TURN/TLS-only network.
5. Test receiver, speaker, wired headset, Bluetooth, interruption by a normal
   phone call, lock/unlock, background/foreground, and voice recording after
   the call.
6. Test camera denied, microphone denied, notifications denied, and later
   permission restoration from Settings.
7. Run one coach/client usability pass focused only on finding the next action,
   answering a call, returning to chat, copying a phrase, and taking a photo.

### Completion criteria

- Every matrix row has a recorded pass or a named release blocker.
- No message or call content appears in logs.
- No stale call or message notification remains after the corresponding
  conversation is opened or call ends.
- Both stores' release builds pass their platform checks.
- `pnpm build`, `pnpm android:check`, `pnpm ios:test`,
  `pnpm ios:app:build`, `pnpm verify:calls`, and `pnpm verify:rls` pass at the
  release commit.

## Assumptions and tradeoffs

- **Small parity work lands before calling.** Copy, camera capture, and
  notification clearing are independent, low-risk releases. Completing them
  first prevents the much larger iOS calling change from absorbing unrelated
  behavior.
- **Existing iOS call modules are reused as-is.** Production wiring should not
  redesign reducers, screens, commands, or LiveKit media unless integration
  exposes a demonstrated defect.
- **Polling remains initially.** The existing three-second iOS foreground
  polling adapter is less elegant than a native Supabase Broadcast adapter but
  is already implemented and durable-state-correct. Replace it only if pilot
  latency is unacceptable.
- **CallKit is app-owned.** It is platform lifecycle glue, not portable call
  domain behavior, so a new shared target would add indirection without reuse.
- **System camera over custom camera.** `UIImagePickerController` is enough for
  one still image. AVFoundation would add permission, lifecycle, orientation,
  and capture-session code without a current requirement.
- **Notification clearing is not unread state.** The server's read marker and
  conversation directory remain authoritative. OS cleanup is best effort.
- **No exact iOS launcher badge yet.** A truthful badge while backgrounded
  requires recipient-specific absolute unread counts in each APNs payload and
  careful multi-device reconciliation. The current conversation badges already
  provide correct in-app state; add launcher counts only after a concrete user
  need.
- **PushKit is invitation-only.** Call acceptance and terminal changes remain
  canonical backend state. VoIP pushes are not a replacement realtime bus.
- **User force-quit is not a supported incoming-call state.** Apple documents
  that an app force-quit from the multitasking UI does not receive remote
  notifications until the user launches it again. System termination and a
  user force-quit must not be treated as the same release case.

## Deferred until there is concrete need

- Link previews, message forwarding, pinning, and a general share-message
  action.
- Notification quick reply, custom notification actions, quiet hours, and
  per-conversation notification settings.
- Exact iOS app-icon unread counts across background and multiple devices.
- A native missed-call inbox or call-history screen; the existing conversation
  remains the destination.
- A custom camera, video attachments, image editing, or automatic photo-library
  saving.
- Replacing iOS call polling with Supabase Broadcast.
- iOS video picture-in-picture.
- Call recording, transcription, screen sharing, group calls, or scheduled
  lesson-call surfaces.
- Any mobile dashboard, lesson booking, assigned work, exercise, community,
  marketplace, or gamification surface.

## Definition of done

The plan is complete only when Steps 1–7 pass in order, the physical-device
matrix is signed off, and the production iOS app—not only FishKit or Catalog—can
receive and complete a background call with Android and web while normal direct
messages continue to work.
