# Android account settings implementation plan

Status: implementation-ready. Platform order: Android first. Scope: the existing native direct-chat app only.

## Outcome

Replace the current presence-owned account sheet with one compact Account settings sheet entered from the existing avatar/person action. The sheet progressively opens one focused detail page for notifications, privacy, appearance, accessibility, and password recovery; Sign out remains one quiet action at the bottom. The work preserves the app's direct-chat-only information architecture and current authentication cleanup path.

The smallest implementation that satisfies the product is:

- one new `feature:settings` Compose module for provider-free presentation;
- a tiny app-owned Preferences DataStore for device-local theme and reduced-motion values;
- platform permission, notification-settings, and browser callbacks owned by `MainActivity`;
- existing `data:chat` and `data:presence` seams extended only where the backend contract already exists;
- no `data:settings` module, settings service, global navigation destination, or new backend.

## Current-state audit

- `feature:chat/ChatRoute.kt` opens `feature:presence/PresenceAccountSheet.kt` from `PresenceAccountTrigger`; the sheet combines presence status and Sign out.
- Sign out is correctly routed through `ChatViewModel.signOut()` to `DefaultChatRepository.signOut()`. That repository cancels user and attachment upload work, best-effort cancels remote uploads, calls the remote sign-out, deletes staged files, clears Room user data, and resets delivery state. `FishApplication`'s `onBeforeSignOut` hook ends presence and unregisters the call push device. This path is load-bearing.
- `FishTheme` defaults to `isSystemInDarkTheme()`. `MainActivity` samples `ValueAnimator.areAnimatorsEnabled()` once with `remember`, so it does not yet combine a local preference or refresh the system value.
- `MainActivity.observeNotificationPermission()` automatically requests `POST_NOTIFICATIONS` after sign-in and records `notification-requested` in raw `SharedPreferences`. This conflicts with the locked user-driven permission policy.
- `POST_NOTIFICATIONS` is already declared. Message and call channels are created lazily. Message notifications show the sender name plus generic “Sent you a message,” hide message text, and use `VISIBILITY_PRIVATE`.
- Call notifications currently show counterpart name and call type with `VISIBILITY_PUBLIC`. This is a real lock-screen privacy risk but requires a product decision; this slice documents the fact and does not invent a toggle or silently change call behavior.
- Presence already supports `Automatic`, `Away`, `Busy`, and `Invisible`; Invisible is the existing presence-visibility control and is enforced by the shared backend.
- A participant can already be blocked from direct chat. The backend additionally provides caller-scoped `list_blocked_users()` and `unblock_user`, but Android has no list/unblock adapter or UI.
- Preferences DataStore 1.2.1 is already in the version catalog and used by chat/call data. Password recovery exists only at web `/forgot-password`; Android has no configured web URL or handoff.

## Locked decisions and non-goals

- Native remains direct-chat-only. Do not add home/dashboard, lessons, booking, assigned work, learning exercises, community, marketplace, or global settings navigation.
- Do not build account export, deletion, consent, retention, or retention-policy tooling in this slice.
- Privacy contains only direct-chat safety and understandable existing permissions: presence visibility, blocked people where the client-only backend contract supports it, privacy-policy access, and notification preview facts/system controls.
- Do not add read-receipt, typing, quiet-hours, per-conversation notification, message-preview, consent, or retention toggles.
- Theme is exactly `System`, `Light`, or `Dark`; it is device-local, immediate, defaults to System, and is not synced. No dynamic color.
- Accessibility is exactly `System` or `Reduce motion`; preserve Android font scaling and other OS accessibility behavior. Effective reduced motion is `systemDisabledAnimations || explicitReduced`. The app must never force motion against the OS.
- Notification permission and enabled status are OS-authoritative. Persist no enabled/requested mirror. Prompt only after an explicit user action, show status, open the app's notification settings, and refresh on resume.
- Password recovery opens the hardened web `/forgot-password` page in an external browser. Do not add a native reset request, auth callback, PKCE, app link, or shared email-routing change.
- Signed-out UI says `Forgot password`; signed-in Account settings says `Reset password`. Both open the same web flow.
- Sign out stays quiet and at the bottom, calls `ChatViewModel.signOut()`, and preserves the current Supabase sign-out scope. UI must never call Supabase auth directly.

## User flow and screen/state contract

The existing avatar/person action opens a modal Account settings sheet; it does not navigate away from chat. The root sheet shows the user's name/current presence followed by quiet rows:

1. `Notifications` — trailing status `On` or `Off`.
2. `Privacy` — supporting copy `Presence and blocked people`.
3. `Appearance` — trailing `System`, `Light`, or `Dark`.
4. `Accessibility` — trailing `System` or `Reduce motion`.
5. `Reset password` — supporting copy `Opens the secure FISH website`.
6. `Sign out` — ghost/quiet treatment, separated at the bottom.

Each detail keeps Back and Close, a single title, no unrelated actions, at least 44×44 dp targets, token spacing, sentence case, and calm notices.

| Detail | Exact behavior and useful copy |
| --- | --- |
| Notifications | Show live OS status. If permission can be requested, the one primary action is `Allow notifications`; otherwise it is `Open notification settings`. Copy: `Message alerts show who sent them, but not the message.` and `Call alerts may show the caller’s name and call type on the lock screen.` Do not imply an in-app toggle controls delivery or previews. |
| Privacy | Rows for `Presence visibility`, client-only `Blocked people`, and `Privacy policy`. Also link to Notifications for the preview facts rather than duplicate a toggle. |
| Presence visibility | Reuse the current Automatic/Away/Busy/Invisible meanings and duration flow. Copy for Invisible remains `Appear offline.` |
| Blocked people | Loading, list, empty (`No one is blocked right now.`), failure (`Blocked people aren’t available yet. Try again.`), and in-row busy states. Successful action: `{name} is no longer blocked.` Unblocking never restores friendship or a conversation. |
| Appearance | Radio rows `System`, `Light`, `Dark`; save and apply immediately. Invalid stored text safely resolves to System. |
| Accessibility | Radio rows `System` and `Reduce motion`. Explain: `System follows your device accessibility settings.` No text-size control. |
| Password handoff | Open `${WEB_BASE_URL}/forgot-password` externally. If the URL is absent/invalid or no browser resolves it, keep the sheet open with `Password help isn’t available in this build.` |
| Sign-in | Add an underlined `Forgot password` link below the password field; it uses the same browser handoff and does not alter entered email/password. |

Closing/reopening returns to the Account root. Rotation/process restoration need only preserve persisted device preferences, not the currently open nested page. Async failure keeps the current page and its recovery action visible.

## Lean architecture and data flow

```text
avatar/person action
  -> ChatRoute opens AccountSettingsSheet (feature:settings)
      -> value state + callbacks only for Activity/Settings/browser APIs
      -> ChatViewModel.signOut() for the existing cleanup chain
      -> ChatRepository listBlockedPeople/unblockUser
      -> PresenceViewModel setPreference for existing presence behavior

Preferences DataStore (app composition root)
  -> theme preference -> MainActivity -> FishTheme(darkTheme = effective)
  -> motion preference -> systemDisabledAnimations OR explicitReduced
                         -> FishTheme(reducedMotion = effective)

Android OS
  -> permission/NotificationManagerCompat status -> MainActivity -> settings UI
  <- explicit request or ACTION_APP_NOTIFICATION_SETTINGS callback
```

Architecture decision: create `feature:settings` because `feature:presence` should not own unrelated account, auth, notification, theme, and accessibility UI. Keep the two local preferences in `app` because they are consumed at the composition root and do not justify a repository/data module. `feature:settings` receives state and callbacks and does not import `Activity`, `Intent`, `Settings`, or notification APIs. Rejected alternative: adding both `feature:settings` and `data:settings`; two device-local enum values with one consumer do not establish a data boundary worth another module.

Android's guidance supports requesting notification permission from an explicit Compose action, checking live delivery capability with `areNotificationsEnabled()`, and opening per-app notification settings; DataStore is appropriate for small related user settings. See [notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission), [NotificationManagerCompat](https://developer.android.com/reference/androidx/core/app/NotificationManagerCompat), [Settings](https://developer.android.com/reference/android/provider/Settings), and [DataStore](https://developer.android.com/topic/libraries/architecture/datastore). System animator state comes from [ValueAnimator](https://developer.android.com/reference/android/animation/ValueAnimator).

## Ordered incremental implementation steps

### Step 1 — Remove the unsolicited notification prompt

**Goal:** Make the current app stop prompting automatically without changing any other behavior.

**Why necessary:** Permission must be requested only after an explicit user action; the current observer and `notification-requested` SharedPreferences shadow OS state.

**Dependencies/assumptions:** `POST_NOTIFICATIONS` stays declared. Explicit call-start permission behavior is evaluated separately and may remain because it follows a user-initiated call; no launch/sign-in observer may request notification permission.

**Focused implementation actions:**

- Delete `observeNotificationPermission()`, its `onCreate` call, the dedicated launcher used only by it, and raw `fish-permissions`/`notification-requested` access.
- Remove now-unused imports. Do not remove notification factories, channels, permission declaration, or push registration.
- Add a regression test/static boundary assertion that `MainActivity` contains no sign-in-driven notification launcher and no notification-requested preference.

**Files likely changed/created:** `apps/android/app/src/main/kotlin/space/fishhub/android/MainActivity.kt`; app test or design-boundary script fixture if that is the existing convention.

**Verification:** `pnpm android:test`; `pnpm android:check`.

**Completion criteria:** Fresh install and sign-in do not show a notification prompt; no duplicate notification-enabled/requested state remains on disk; chat/call notification code still builds.

### Step 2 — Add the provider-free settings shell and rewire the account entry

**Goal:** Establish the compact Account settings root while preserving status editing and sign-out.

**Why necessary:** Presence currently owns unrelated account behavior; later settings need a stable, testable UI boundary.

**Dependencies/assumptions:** Existing design-system sheet, top-bar, button, notice, avatar, and tokens are reused. The existing avatar/person trigger remains the only entry.

**Focused implementation actions:**

- Add `:feature:settings` to Gradle settings and app dependencies. Its dependencies should be `core:designsystem` plus Compose/test libraries; add no Supabase or Activity dependency.
- Create immutable UI models for root/detail state and an `AccountSettingsSheet` with internal root/detail page navigation.
- Move/re-express the current status row/duration flow through provider-neutral values and callbacks; do not make `feature:settings` depend on `feature:presence`.
- Change `ChatRoute` to open the settings sheet from its existing account trigger and pass presence presentation/actions plus `viewModel::signOut`.
- Remove `PresenceAccountSheet` after its status behavior and screenshot coverage are represented in settings; keep presence trigger/indicator/model components in `feature:presence`.
- Add root/status screenshots and accessibility tests, including compact, dark, RTL, and 200% font cases. Update existing Android aggregate scripts to include settings unit/instrumented/screenshot tasks rather than inventing new script names.

**Files likely changed/created:** `apps/android/settings.gradle.kts`; `apps/android/app/build.gradle.kts`; `apps/android/feature/settings/build.gradle.kts`; `apps/android/feature/settings/src/main/AndroidManifest.xml`; `apps/android/feature/settings/src/main/kotlin/space/fishhub/android/feature/settings/AccountSettingsModels.kt`; `.../AccountSettingsSheet.kt`; settings tests/screenshots; `apps/android/feature/chat/.../ChatRoute.kt`; `apps/android/feature/chat/build.gradle.kts`; `apps/android/feature/presence/.../PresenceAccountSheet.kt`; `package.json` aggregate task lists.

**Verification:** `pnpm android:verify-design`; `pnpm android:test`; `pnpm android:screenshots`; `pnpm android:instrumented` with API 33+ device; `pnpm android:check`.

**Completion criteria:** The avatar opens Account settings, current presence editing still works, Sign out still calls `ChatViewModel.signOut()`, every detail has Back/Close, and no new global destination exists.

### Step 3 — Persist and apply theme and reduced-motion preferences

**Goal:** Add immediate System/Light/Dark and System/Reduce motion behavior.

**Why necessary:** These are the only approved device-local preferences, and the current one-time system motion sample is insufficient.

**Dependencies/assumptions:** Preferences DataStore already exists in the catalog. Preference keys are app-scoped and excluded from account sync. Default/invalid/corrupt values resolve safely to System.

**Focused implementation actions:**

- Add an app-owned `AppPreferenceStore` with one DataStore file and enum string keys for theme and explicit reduced motion. Catch read corruption/I/O failures and expose defaults plus a calm non-blocking notice only if a write fails.
- Collect preferences at the root. Resolve theme as System -> `isSystemInDarkTheme()`, Light -> false, Dark -> true, and pass the result to `FishTheme` for immediate recomposition.
- Track `systemDisabledAnimations = !ValueAnimator.areAnimatorsEnabled()` and refresh it on resume (and with the duration-scale listener where supported if it simplifies current lifecycle code). Resolve `effectiveReduced = systemDisabledAnimations || explicitReduced`.
- Never offer a setting that can force animations on. Keep OS font scale/Dynamic Type-equivalent Compose behavior untouched.
- Add parser/default/write tests and theme/motion UI state tests.

**Files likely changed/created:** `apps/android/app/.../settings/AppPreferenceStore.kt`; `apps/android/app/.../MainActivity.kt`; `apps/android/app/build.gradle.kts`; settings models/sheet/tests.

**Verification:** `pnpm android:test`; `pnpm android:screenshots`; manually change Android animator duration scale while the app backgrounds/resumes; `pnpm android:check`.

**Completion criteria:** All three themes apply without restart; new installs and invalid stored values follow System; explicit Reduce motion stops FISH motion; OS-disabled animation always wins.

### Step 4 — Add OS-authoritative notification settings

**Goal:** Show truthful status, request permission only from the explicit action, and open system notification settings.

**Why necessary:** Notification availability can change outside the app and must not be represented by a persisted toggle.

**Dependencies/assumptions:** Message/call channels remain lazy. `ACTION_APP_NOTIFICATION_SETTINGS` is used with the package extra, with guarded fallback to application details if no handler exists.

**Focused implementation actions:**

- Add MainActivity-owned state derived from Android 13 permission plus `NotificationManagerCompat.from(this).areNotificationsEnabled()`; expose only presentation values/callbacks to settings.
- Add an Activity Result permission launcher invoked only by `Allow notifications`. Refresh status in its callback and every `onResume`.
- Add `Open notification settings` using `Settings.ACTION_APP_NOTIFICATION_SETTINGS`; guard intent resolution and use `ACTION_APPLICATION_DETAILS_SETTINGS` fallback.
- Register/create no channel merely to manufacture a status. Show message preview facts and the existing public call-preview risk as copy, not toggles.
- Cover Android 12 and below, Android 13 first request/allow/deny/dismiss, settings revocation, and resume refresh.

**Files likely changed/created:** `apps/android/app/.../MainActivity.kt`; settings models/sheet/tests; app lifecycle/permission tests.

**Verification:** `pnpm android:test`; `pnpm android:instrumented`; use the official ADB grant/revoke/clear-permission-flags cases; `pnpm android:check`.

**Completion criteria:** No prompt occurs before tapping Allow; status changes after callback and Settings return; no enabled/requested boolean is persisted; system settings open safely on supported devices.

### Step 5 — Add privacy safety: presence, blocked people, and policy access

**Goal:** Complete the allowed direct-chat privacy surface using existing server authorization.

**Why necessary:** Users need an understandable presence-visibility path and a reversible unblock path for existing blocks.

**Dependencies/assumptions:** `list_blocked_users()` returns only the authenticated client's own blocked profiles; `unblock_user`/friend-command does not restore a friendship. The row is client-only; coaches do not receive a broken or unauthorized control. Production `${WEB_BASE_URL}/privacy` is a release dependency.

**Focused implementation actions:**

- Add `BlockedPerson(userId, displayName, username)`, `listBlockedPeople()`, and `unblockUser(id)` to `ChatRepository`, `ChatRemoteDataSource`, the Supabase adapter, default repository, and unconfigured/fake implementations.
- Read blocked people through the RLS/security-definer RPC; unblock through the existing friend-command action. Map malformed/authorization/network failures to calm typed failures and never log IDs/names.
- Pass current-user role/capability to settings. Load only when Blocked people opens, single-flight unblocks, remove the row only after server success, and preserve it on failure.
- Place existing presence mode/duration under Privacy -> Presence visibility while retaining optimistic rollback/realtime behavior.
- Open the privacy policy in an external browser from a trusted configured base only. No WebView.

**Files likely changed/created:** `apps/android/data/chat/.../ChatRepository.kt`; `.../remote/ChatRemoteDataSource.kt`; `.../remote/SupabaseChatRemoteDataSource.kt`; DTO/contract tests; `DefaultChatRepository.kt`; `ChatDataModule.kt`; `ChatViewModel.kt` or a focused settings coordinator; settings sheet/models/tests; `MainActivity.kt` browser callback.

**Verification:** `pnpm android:test`; `pnpm android:instrumented`; `pnpm verify:presence`; local two-client block/list/unblock RLS check; `pnpm android:check`.

**Completion criteria:** A supported client sees only their blocked people, can unblock exactly once, and learns that relationships are not restored; coaches do not see an unsupported row; presence Invisible remains backend-enforced; policy opens only the configured HTTPS destination in release.

### Step 6 — Add hardened web password recovery handoff

**Goal:** Provide Forgot password when signed out and Reset password when signed in without adding a native auth flow.

**Why necessary:** The web flow is already hardened and owns email routing; duplicating it creates auth-link and redirect risk.

**Dependencies/assumptions:** Add `FISH_ANDROID_WEB_BASE_URL`/Gradle property fallback -> `BuildConfig.WEB_BASE_URL`. Release value must be HTTPS and point to the production FISH web origin; debug may use an explicitly configured local origin.

**Focused implementation actions:**

- Configure the base URL in Gradle/README and build `${base}/forgot-password` with URI path APIs, not string concatenation or user input. Reject non-http(s), user-info, unexpected query/fragment, and non-HTTPS release values.
- Add a MainActivity external-browser callback using `ACTION_VIEW`, guarded resolution, and no custom deep-link handler.
- Add `Forgot password` to `SignInScreen` and `Reset password` to Account settings; both use the same callback. Do not prefill email in the URL.
- Add configuration/URL-policy tests and unavailable-browser copy tests.

**Files likely changed/created:** `apps/android/app/build.gradle.kts`; `apps/android/app/.../MainActivity.kt`; `apps/android/app/src/test/.../ExternalWebLinkPolicyTest.kt`; `apps/android/feature/chat/.../ChatRoute.kt`; settings sheet/tests; `apps/android/README.md`.

**Verification:** `pnpm android:test`; `pnpm android:instrumented`; manually complete the browser flow through email and web reset on a release-like build; `pnpm android:check`; `pnpm build`.

**Completion criteria:** Both labels open exactly `/forgot-password` externally; no native callback/app-link/PKCE is introduced; invalid configuration fails closed with calm copy; the app session does not leak into URL parameters.

### Step 7 — Prove cleanup, accessibility, and release behavior end to end

**Goal:** Ship the slice only after its cross-cutting behavior is verified.

**Why necessary:** Settings touch auth cleanup, system permissions, external intents, theme, accessibility, and RLS safety.

**Dependencies/assumptions:** Prior steps pass their focused tests. A target Supabase project, web origin, physical Android device, and client test account are available for release checks.

**Focused implementation actions:**

- Add an instrumentation flow: open avatar -> each detail/back -> theme -> reduced motion -> notifications -> policy/recovery handoff -> Sign out.
- Assert Sign out invokes the existing ViewModel/repository path once and leaves uploads cancelled, files/Room/delivery state cleared, presence ended, call push device unregistered, and signed-out UI visible.
- Verify TalkBack names/state, switch/radio semantics, 44 dp targets, font scale 200%, RTL, light/dark, narrow/expanded widths, offline failures, rotation, and no competing primary actions.
- Inspect the release manifest and minified build for only intended permissions/activities and no exported settings/browser component.

**Files likely changed/created:** settings instrumentation/screenshot tests; existing app/repository sign-out tests; aggregate verification scripts only as required to include the new module.

**Verification:** `pnpm android:verify-design`; `pnpm android:test`; `pnpm android:screenshots`; `pnpm android:instrumented`; `pnpm android:check`; `pnpm build`.

**Completion criteria:** Every command passes; the full flow works on a physical API 33+ device; no stale private chat data remains after sign-out; direct chat remains the only native product surface.

## File map

| Area | Planned ownership |
| --- | --- |
| `feature:settings` | Provider-free sheet, pages, value models, UI/accessibility/snapshot tests. |
| `app/MainActivity` | Permission launcher/status, system settings intent, external browser, lifecycle refresh, root theme/motion composition. |
| `app/settings/AppPreferenceStore` | Two local preferences only; no auth/server state. |
| `data:chat` | Existing backend boundary for list/unblock; existing sign-out cleanup unchanged. |
| `feature:chat` | Existing trigger, signed-out Forgot password link, and routing callbacks; no settings state machine. |
| `feature:presence` / `data:presence` | Existing presentation and backend preference semantics; account sheet ownership removed. |

## Verification matrix

| Risk | Automated proof | Manual/release proof |
| --- | --- | --- |
| Unsolicited prompt | boundary/unit test; `android:test` | fresh install + sign-in has no prompt |
| OS notification drift | permission/lifecycle tests | allow, deny, dismiss, revoke, resume on API 33+ |
| Theme/motion parsing | enum/DataStore tests | immediate three-theme switch; OS animations disabled wins |
| Block authorization | adapter/RLS tests | two clients plus coach unsupported-row check |
| Auth-link safety | URL-policy tests | production HTTPS origin and email-return flow |
| Sign-out residue | repository/instrumentation tests | inspect Room/files/uploads/push/presence after sign-out |
| Cognitive/accessibility | screenshots/accessibility assertions | TalkBack, 200% font, RTL, one task/detail |

## Security, privacy, and threat considerations

- Treat notification permission, channel settings, and preview policy as OS-owned. Never infer permission from the presence of a token or channel.
- Construct settings and browser intents explicitly, set the package extra, avoid accepting arbitrary destination URLs, guard intent resolution, and keep all settings components non-exported.
- Allow only configured http(s) origins; require HTTPS for release; never include email, access token, refresh token, session ID, or redirect query in recovery/policy links.
- Parse DataStore enum strings with an allowlist and safe System defaults. Preferences contain no identity or sensitive server data and remain device-local.
- Rely on authenticated RPC/RLS for blocked people; never broaden reads or reveal a blocked person's relationship state. Do not optimistically unblock server-side safety state.
- Preserve repository cleanup even when remote sign-out fails. Current Supabase sign-out scope semantics remain unchanged; see [Supabase Kotlin sign-out](https://supabase.com/docs/reference/kotlin/auth-signout).
- The public call notification remains a documented risk. Changing its visibility/copy without deciding incoming-call usability and lock-screen behavior is explicitly outside this implementation.

## Rollout and rollback

- Land each numbered step as an independently green change. Do not combine permission removal, backend adapter work, and UI expansion into one unreviewable commit.
- Roll out internally/Test track first with fresh-install and upgrade cohorts. Existing notification authorization must be reflected without prompting again.
- If settings UI regresses, roll back the trigger/sheet integration while retaining Step 1's auto-prompt removal and any safe preference parsing fixes.
- Local theme/motion keys can remain across rollback; unknown keys are inert. Do not add destructive preference migrations.
- Backend rollback is unnecessary: this plan consumes deployed RPC/function contracts and adds no migration.

## Assumptions, tradeoffs, and risks

- Assumption: the production web team will provide a stable HTTPS base with `/forgot-password` and `/privacy` before release.
- Assumption: client-only blocked-people semantics remain intentional; a coach-facing contract is not inferred.
- Tradeoff: app-owned DataStore is less layered than a data module, but keeps the composition-root preferences close to their only consumer and avoids module proliferation.
- Tradeoff: nested pages add taps, intentionally reducing simultaneous choices and keeping one task at a time.
- Risk: notification channel settings and runtime permission can disagree; the UI therefore uses overall OS capability and sends users to the authoritative system screen.
- Risk: call lock-screen content is currently public. It is disclosed and release-reviewed, not silently redefined here.
- Risk: App/browser availability and OEM Settings activities vary; all external intents require guarded fallback.

## Explicit deferrals

- Account deletion/export/retention tooling and consent management.
- Read-receipt, typing, quiet-hours, per-conversation notification, message-preview, or retention toggles.
- Call notification `VISIBILITY_PUBLIC` product decision and any revised call preview policy.
- Dynamic color, cross-device theme sync, custom text-size controls, or “force animations” controls.
- Native password reset, email initiation, auth callbacks, app links, PKCE, and shared email-routing changes.
- New mobile destinations or any non-chat product surface.

## Release and manual checks

- Confirm production web and privacy URLs, Play listing privacy disclosures, and support ownership.
- Test fresh install, upgrade with previously allowed notifications, denied notifications, and later Settings revocation.
- Complete password email/reset in the system browser and return to an unchanged app auth state.
- Test block/list/unblock with two target-project clients; confirm no relationship restoration or blocked-user disclosure.
- Test sign-out during upload, offline, presence reconnect, and after a call; verify local cleanup completes even if remote sign-out fails.
- Verify TalkBack, switch access, 200% font, RTL, dark/light/system, OS disabled animations, screenshots, minified release, and physical device behavior.

## Definition of done

- Account settings is reachable only from the existing chat account action and contains exactly the approved categories plus quiet Sign out.
- Notification permission is never auto-requested and no duplicate enabled/requested flag exists.
- Theme and reduced motion meet the locked local/default/effective rules immediately.
- Privacy exposes existing presence visibility, authorized blocked people/unblock, policy access, and truthful notification facts only.
- Forgot/Reset password uses the external hardened web flow with release-safe URL validation.
- Sign out uses the current ViewModel/repository/hook chain and preserves its current scope and cleanup behavior.
- All Android and monorepo verification commands pass, manual release checks are recorded, and no non-chat native surface or deferred setting was added.
