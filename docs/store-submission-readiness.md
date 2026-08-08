# Store submission readiness

Status: Draft for review — derived from code audit 2026-08-08; placeholders need real values before submission.

Scope: the two native mobile apps only — iOS (`apps/ios`) and Android (`apps/android`). Every claim below is grounded in a repo file cited in parentheses. Items that could not be confirmed from code are marked `UNVERIFIED:`.

## Submission blockers (read first)

1. **No account deletion path exists.** There is no in-app account deletion on either platform (the Android account-settings plan explicitly scopes it out: "Do not build account export, deletion, consent, retention…" — `docs/android-account-settings-implementation-plan.md`; no deletion UI exists in `apps/android/feature/settings/src/main/kotlin/space/fishhub/android/feature/settings/views/` or `apps/ios/FishKit/Sources/AccountSettings/`), and no `delete-account` Edge Function exists (`supabase/functions/` contains only avatar/booking/call/chat/chat-image/friend/link-preview/livekit-webhook/notification/presence/push/send-message commands). Apple (Guideline 5.1.1(v)) and Google Play both require an account-deletion path for apps that support account sign-in. The schema is already deletion-ready (`profiles.id … references auth.users (id) on delete cascade` — `supabase/migrations/0001_profiles.sql`; `user_reports.reporter_id … on delete set null` — `supabase/migrations/0067_user_reports.sql`), but there is no user-facing or web-based trigger.
2. **No privacy policy page exists.** Settings link to `${WEB_BASE_URL}/privacy`, which the Android plan itself calls "a release dependency" (`docs/android-account-settings-implementation-plan.md`); no `privacy` route exists under `apps/web/app`. Both stores require a live privacy policy URL.

## Third parties user data reaches (summary)

| Party | What they receive | Where verified |
|---|---|---|
| Supabase (backend host) | All core data: auth email/password, profiles, messages, attachments, voice messages, presence, read state, push device rows, reports/blocks | `apps/android/core/supabase/`, `apps/ios/FishKit/Sources/ChatData/Adapters/ChatLive.swift`, `supabase/migrations/` |
| Google Firebase Cloud Messaging | Android push transport: Firebase installation id, notification payloads containing sender display name + conversation/message ids (no message text) | `apps/android/app/src/main/kotlin/space/fishhub/android/FishApplication.kt`, `supabase/functions/_shared/fcm.ts` |
| Apple APNs | iOS push transport: APNs and VoIP device tokens; alert payloads are sender name + "New message" (no message text) | `apps/ios/App/Sources/FishAppModel.swift`, `supabase/functions/_shared/apns.ts` |
| LiveKit Cloud | Live call audio/video relayed in real time; access via short-lived server-minted token | `supabase/functions/call-command/index.ts` (LIVEKIT_URL/API keys, `AccessToken`), `apps/ios/FishKit/Package.swift` (client-sdk-swift), `apps/android/gradle/libs.versions.toml` (io.livekit:livekit-android) |
| KLIPY (GIF provider) | GIF search terms (max 50 chars), device locale, a random per-install UUID `customer_id` (not the user's account id), API/client keys; also share-registration pings with the chosen GIF id | `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/KlipyGifRepository.kt`, `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/GifCustomerIdStore.kt`, `apps/ios/FishKit/Sources/ChatData/Adapters/KlipyGifProvider.swift` |

No analytics, advertising, or crash-reporting SDK is present in either mobile app: the only Firebase product on Android is `firebase-messaging` (`apps/android/app/build.gradle.kts`, `apps/android/gradle/libs.versions.toml` — no analytics/crashlytics entries), and the iOS project has zero references to analytics, Crashlytics, or Sentry (`apps/ios/FishKit/Package.swift`, `apps/ios/App/Fish.xcodeproj/project.pbxproj`). Link previews are fetched server-side by an Edge Function, so linked sites never see the user's device IP (`supabase/functions/link-preview/index.ts`).

---

## 1. Apple App Privacy details (nutrition label)

Tracking (in Apple's ATT sense): **None.** No ad or analytics SDK, no AppTrackingTransparency usage, no IDFA access (zero matches for `AppTrackingTransparency`/`ASIdentifierManager` in `apps/ios`), and the privacy manifest already declares `NSPrivacyTracking = false` (`apps/ios/App/Sources/PrivacyInfo.xcprivacy`). Answer "No" to every "used for tracking" question.

| Apple category | Collected? | Linked to identity? | Tracking? | Purpose / grounding |
|---|---|---|---|---|
| Contact Info — Email Address | Yes | Yes | No | App functionality: email + password sign-in via Supabase auth (`apps/ios/App/Sources/SignInView.swift`; sign-in only, no signup field) |
| Contact Info — Name | Yes | Yes | No | App functionality: profile `display_name` (`supabase/migrations/0001_profiles.sql`) and `username` (`supabase/migrations/0019_chat_search_filters.sql`) |
| Contact Info — Phone / Physical address | No | — | — | Not requested anywhere; no contacts permission in `apps/ios/App/Sources/Info.plist` |
| User Content — Emails or Text Messages | Yes (messages) | Yes | No | App functionality: chat messages stored in Supabase (`supabase/migrations/0010_chat.sql`), edits/deletes/reactions/pins (`ChatOperation` list in `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDiagnostics.kt` mirrors the shared feature set) |
| User Content — Photos or Videos | Yes | Yes | No | App functionality: photo/video/file attachments and avatar photos in Supabase Storage buckets (`supabase/migrations/0017_chat_images.sql`, `0018_chat_file_attachments.sql`, `0060_chat_video_attachments.sql`, `0025_avatar_photos.sql`) |
| User Content — Audio Data | Yes (voice messages) | Yes | No | App functionality: voice messages recorded on demand (`apps/ios/FishKit/Sources/PersonalChat/ViewModels/VoiceMessageRecorder.swift`) and uploaded to storage (`supabase/migrations/0055_chat_voice_messages.sql`). **Call audio/video is not recorded**: the call flow only mints a LiveKit room token — no egress/recording API is invoked anywhere (`supabase/functions/call-command/index.ts` and `supabase/functions/livekit-webhook/index.ts` contain no egress/record calls; the only "record" hit in `apps/ios/FishKit/Sources/CallMediaLiveKit/LiveKitCallMedia.swift` is the `.playAndRecord` AVAudioSession category required for two-way audio) |
| User Content — Other (reports, presence status) | Yes | Yes | No | App functionality/safety: user reports (`supabase/migrations/0067_user_reports.sql`), block list (`list_blocked_users` per `docs/android-account-settings-implementation-plan.md`), presence status choice (`supabase/functions/presence-command/index.ts`), per-conversation mute and pinned message state |
| Search History | Yes | Partly | No | App functionality: in-chat message search runs server-side against the user's own conversations (`public.search_chat_messages` — `supabase/migrations/0019_chat_search_filters.sql`; linked to the account). GIF search terms go to KLIPY with a random per-install UUID rather than the user's identity (`KlipyGifRepository.kt`, `GifCustomerIdStore.kt`) — not linked by FISH. UNVERIFIED: whether Supabase logs retain search query strings beyond request handling |
| Identifiers — User ID | Yes | Yes | No | App functionality: Supabase auth user id keys every table (`supabase/migrations/0001_profiles.sql`) |
| Identifiers — Device ID | Yes | Yes | No | App functionality (push): app-generated installation UUID stored in UserDefaults plus APNs standard and VoIP tokens, registered per user (`apps/ios/App/Sources/FishAppModel.swift` — `fish.push.installation-id`; `supabase/migrations/0056_ios_voip_push_devices.sql`; `supabase/functions/push-command/index.ts`). Not the IDFA/IDFV-for-ads kind — used solely to deliver notifications and calls |
| Usage Data (Product Interaction / Advertising) | No | — | — | No analytics SDK; nothing reports launches, taps, or feature usage anywhere off-device |
| Diagnostics (Crash / Performance) | No | — | — | No crash SDK on iOS or Android. Android's `ChatDiagnostics` writes operation-name/success/duration only, "deliberately contain no user, conversation, or message data", to local logcat, and only in debuggable builds — release builds get `NoOpChatDiagnostics` (`apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDiagnostics.kt`; the `FLAG_DEBUGGABLE` gate in `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/ChatDataModule.kt`). Nothing is transmitted |
| Location | No | — | — | No location permission or API on either platform (`apps/ios/App/Sources/Info.plist` has no NSLocation keys; `apps/android/app/src/main/AndroidManifest.xml` has no location permissions) |
| Contacts / Health / Financial / Browsing History / Sensitive Info | No | — | — | Not requested or referenced anywhere |

### iOS permission purpose strings (already written, in the product voice)

From `apps/ios/App/Sources/Info.plist`:

- Camera: "FISH uses your camera when you choose to take a photo for a conversation."
- Microphone: "FISH uses your microphone when you hold the record button to send a voice message." (Note: the microphone is also used during audio/video calls — consider widening this string before submission so Review doesn't flag the mismatch.)
- Photo library (read): "FISH uses photos you choose to share in a conversation."
- Photo library (add): "FISH can save photos you choose to your library."
- Background modes: `audio`, `voip` (calls). Privacy manifest present with UserDefaults reason CA92.1 (`apps/ios/App/Sources/PrivacyInfo.xcprivacy`).
- No ATS exceptions are declared (no `NSAppTransportSecurity` key), so all traffic is HTTPS by OS default.

---

## 2. Google Play Data Safety form answers

App package: `space.fishhub.android` (`apps/android/app/build.gradle.kts`).

Security practices answers:

- **Encrypted in transit: Yes.** `android:usesCleartextTraffic="false"` and no network security config override (`apps/android/app/src/main/AndroidManifest.xml`); Supabase is HTTPS/WSS; KLIPY code rejects any non-HTTPS URL (`httpsHost` check in `KlipyGifRepository.kt`); LiveKit URL comes from the server (`supabase/functions/call-command/index.ts`).
- **Backup/device transfer: fully excluded.** `android:allowBackup="false"` plus exclusion of everything from cloud backup and device transfer (`apps/android/app/src/main/AndroidManifest.xml`, `apps/android/app/src/main/res/xml/backup_rules.xml`, `data_extraction_rules.xml`).
- **Deletion request path: MISSING — see blocker #1.** Play's form requires a way for users to request account and data deletion; there is currently neither an in-app flow nor a web URL.
- No `AD_ID` permission is declared or merged (no analytics/ads SDK), so answer "No" to advertising ID collection.

"Shared" below follows Play's definition. FCM, APNs, LiveKit Cloud, and KLIPY all act as service providers processing data on FISH's behalf, which Play exempts from "sharing" disclosure — but confirm a data-processing agreement exists with KLIPY and LiveKit before relying on that exemption. UNVERIFIED: contractual status of KLIPY and LiveKit as processors.

| Play data type | Collected? | Shared? | Ephemeral? | Required or optional? | Purpose |
|---|---|---|---|---|---|
| Personal info — Email address | Yes | No | No | Required (sign-in) | Account management (`SignInScreen.kt` — `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/screens/SignInScreen.kt`) |
| Personal info — Name (display name, username) | Yes | No | No | Required (coach-provisioned profile) | App functionality (`supabase/migrations/0001_profiles.sql`, `0019_chat_search_filters.sql`) |
| Messages — In-app messages | Yes | No | No | Required for the product's purpose; sending is user-initiated | App functionality; stored in Supabase and cached locally in Room for offline reading, cleared on sign-out (`docs/android-account-settings-implementation-plan.md` describes the sign-out cleanup path; `apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/local/`) |
| Photos and videos | Yes | No | No | Optional (only what the user attaches) | App functionality (`supabase/migrations/0017_chat_images.sql`, `0060_chat_video_attachments.sql`, `0025_avatar_photos.sql`) |
| Audio — Voice or sound recordings | Yes (voice messages only) | No | No | Optional | App functionality; recorded via `apps/android/app/src/main/kotlin/space/fishhub/android/VoiceMessageRecorder.kt`, stored per `supabase/migrations/0055_chat_voice_messages.sql`. Call audio/video is relayed live through LiveKit and **never recorded** (no egress usage anywhere — see Apple table) |
| Files and docs | Yes (attachments) | No | No | Optional | App functionality (`supabase/migrations/0018_chat_file_attachments.sql`; share-sheet intake in the manifest SEND intent filters) |
| App activity — In-app search history | Yes | See note | Largely ephemeral | Optional | Message search runs a server RPC over the user's own data (`search_chat_messages` — `supabase/migrations/0019_chat_search_filters.sql`); GIF search terms + locale + random install UUID go to KLIPY (service-provider transfer — `KlipyGifRepository.kt`) |
| App activity — Other actions (presence, read state, mute, pins, blocks, reports) | Yes | No | No | Optional / user-initiated | App functionality and safety (`supabase/functions/presence-command/index.ts`, `supabase/migrations/0067_user_reports.sql`) |
| Device or other IDs | Yes | No | No | Required for push and calls | App functionality: app-generated installation UUID + Firebase installation id + app version registered to `push_devices` (`apps/android/data/call/src/main/kotlin/space/fishhub/android/data/call/SupabaseCallRepository.kt` `registerPushDevice` payload; `supabase/migrations/0049_android_call_push_devices.sql`); unregistered on sign-out (`apps/android/app/src/main/kotlin/space/fishhub/android/FishApplication.kt`) |
| Location / Contacts / Calendar / Health / Financial / Web browsing / Installed apps | No | — | — | — | No such permissions or APIs (`apps/android/app/src/main/AndroidManifest.xml`) |
| Crash logs / Diagnostics / Performance | No | — | — | — | No crash/analytics SDK; debug-builds-only redacted logcat, never transmitted (`ChatDiagnostics.kt`, gate in `ChatDataModule.kt`) |

Android runtime permissions and why (all from `apps/android/app/src/main/AndroidManifest.xml`): `RECORD_AUDIO` (voice messages, calls), `CAMERA` (taking photos to share, video calls), `POST_NOTIFICATIONS`/`USE_FULL_SCREEN_INTENT`/`VIBRATE` (message and incoming-call notifications), `MANAGE_OWN_CALLS`/`BLUETOOTH_CONNECT`/foreground-service permissions (in-progress call handling), `INTERNET`. Camera and microphone hardware are declared `required="false"`.

---

## 3. App Review notes (draft for the first iOS submission)

> **About FISH**
>
> FISH is a 1-on-1 chat app where neurodivergent professionals practice English with their coach. It is deliberately minimal: direct conversations only, with attachments, voice messages, audio/video calls, and safety controls. There is no feed, no public content, and no user-to-user discovery beyond exact-username friend requests between clients.
>
> **Accounts are provisioned, not self-serve.** The app has sign-in only — email, password, and a "Forgot password" link; there is no signup screen (`apps/ios/App/Sources/SignInView.swift`, and the same on Android). Coaches create client accounts on the web product, so reviewers need the demo credentials below.
>
> **Demo accounts** (please provision two client accounts that are already friends with an existing conversation, so chat, calling, and the safety flow can all be exercised):
> - Account A: <demo email A> / <demo password A>
> - Account B: <demo email B> / <demo password B>
>
> **Server configuration the demo environment needs** (from `docs/deploy-checklist.md`): the `friend-command` Edge Function secret `FRIENDS_ENABLED` set to `true` AND the `feature_flags` database row with key `friends` set to enabled. Both switches gate every friends/block/report RPC; with either off those features return a calm unavailable state.
>
> **Guideline 1.2 — user-generated content safety walkthrough:**
> 1. Sign in as Account A and open the conversation with Account B.
> 2. Tap the conversation title to open conversation details.
> 3. **Report:** choose "Report", confirm in the confirmation step (`apps/ios/FishKit/Sources/PersonalChat/Views/ConversationSafetyView.swift`; Android: `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/views/ConversationDetailsSheet.kt`). Reports go to a moderation-only table; the reported person is never notified (comment and design in `supabase/migrations/0067_user_reports.sql`), and reports are rate-limited server-side against abuse. Individual GIF messages can also be reported ("report-gif" action — `supabase/functions/chat-command/index.ts`).
> 4. **Block:** from the same details view, choose "Block" and confirm. Blocking immediately ends the conversation and the friendship for the blocker.
> 5. **Blocked people list:** open Settings from your avatar → Privacy → Blocked people to see and unblock (`apps/ios/FishKit/Sources/AccountSettings/Views/AccountSettingsSheet.swift`; Android: `.../feature/settings/views/BlockedPeoplePage.kt`). Unblocking never silently restores the friendship or conversation.
>
> **To receive a push notification:** sign in as Account A on the review device, background the app, then send a message from Account B (second device or the web app). The alert shows only the sender's name and "New message" — message content is never in the push payload (`supabase/functions/_shared/apns.ts`).
>
> **To receive a call:** with Account A signed in, start an audio or video call from Account B's conversation screen. The device receives a VoIP push and shows the native incoming-call UI (`UIBackgroundModes` `voip` — `apps/ios/App/Sources/Info.plist`; VoIP token registration in `apps/ios/App/Sources/FishAppModel.swift`). Call media is relayed live via LiveKit and is not recorded.
>
> **Privacy:** no analytics or tracking SDKs; camera, microphone, and photo access are requested only at the moment of use with purpose strings in the app's voice.
>
> Support contact: <support email>
> Privacy policy: <privacy policy URL — must exist before submission, see blockers>

---

## 4. First-release notes ("What's new" for 1.0)

Store-listing copy in the product voice (sentence case, plain verbs, no hype — per `AGENTS.md`):

> FISH is a calm place to practice English with your coach.
>
> - Message your coach in one focused conversation
> - Send photos, files, and voice messages
> - Talk face to face with audio and video calls
> - Search, pin, and quietly mute when you need a pause
> - Block or report anyone who makes you uncomfortable

Shorter variant if the field is tight:

> A calm place to practice English with your coach. Chat, share photos and voice messages, and call when talking is easier than typing.
