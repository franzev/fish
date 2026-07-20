# iOS account settings implementation plan

Status: implementation-ready. Platform order: follows the Android plan. Scope: the existing SwiftUI direct-chat app only.

## Outcome

Replace the Inbox person icon's direct sign-out action with one compact Account settings sheet. The sheet progressively opens focused pages for notifications, privacy, appearance, accessibility, and password recovery; Sign out remains one quiet action at the bottom. The signed-out screen gains Forgot password. No global navigation or non-chat product surface is added.

Lean implementation: one provider-free `AccountSettings` FishKit target depending only on `DesignSystem` and `UIComponents`; device preferences stored in existing `UserDefaults`; platform/auth/backend actions supplied by `FishApp` as values and closures; small additions to the existing `ChatLive` Supabase boundary for deployed presence/blocked-person contracts. No settings data target, dependency-injection framework, native auth callback, or new backend.

## Current-state audit

- `FishApp.swift` owns the production shell, auth, push, deep-link routing, and sign-out. `FishAppDelegate` currently requests notification authorization at launch, then registers with APNs.
- Inbox's person icon currently calls `FishAppModel.signOut()` directly. That method stops chat/uploads, stops the directory, unregisters the server push installation, then calls `ChatLive.signOut`, clears in-memory session state, and shows signed-out UI. Preserve this order and route.
- `ChatLive` is the Supabase boundary; feature UI must not import Supabase.
- `PresenceAccountSheet` is a useful account/status visual precedent but is not wired into the production shell. It must not become a settings dependency or owner.
- `Palette` already resolves light/dark from traits. Root `preferredColorScheme` is the correct seam for a device-local override. Typography already uses relative custom fonts and Dynamic Type.
- Seven current views read `accessibilityReduceMotion` directly: Skeleton, TypingIndicator, MessageImageTile, GifMedia, GifPanel, MediaPickerSheet, and AttachmentViewer. They are the bounded migration set for an effective FISH motion value.
- APNs message alerts contain sender name plus generic `New message`, not the message body. Notification authorization/settings are not persisted locally.
- `UserDefaults` already stores a push installation ID and call video preference. No `PrivacyInfo.xcprivacy` exists.
- Web `/forgot-password` is the hardened recovery flow. No production privacy-policy route/URL is configured in the native target yet.
- Backend contracts already provide authenticated own presence preference, `list_blocked_users()`, and `unblock_user`; the iOS production app lacks account adapters/UI.

## Locked decisions and non-goals

- Keep native direct-chat-only: no dashboard, lessons, booking, assigned work, exercises, community, marketplace, or settings tab.
- No account export/deletion/retention tooling in this slice. Record the App Review risk; do not silently expand scope.
- Privacy is limited to presence visibility, client-supported blocked people, privacy-policy access, and notification preview facts/system controls. Do not invent read-receipt, typing, quiet-hours, per-conversation notification, message-preview, consent, or retention toggles.
- Theme is exactly System/Light/Dark, local, immediate, default System. No dynamic color or sync.
- Accessibility is exactly System/Reduce motion. Preserve Dynamic Type and OS behavior. Effective reduction is `accessibilityReduceMotion || explicitReduced`; FISH never forces motion against the OS.
- Notification status is `UNUserNotificationCenter` authority. Prompt only from an explicit user action, refresh on scene active, and open app notification settings. Persist no enabled/requested flag.
- Forgot password and signed-in Reset password both open configured web `/forgot-password` with `openURL`. No native request/callback, custom redirect, PKCE, associated domain, or email-routing change.
- Sign out stays quiet at the Account bottom and calls `FishAppModel.signOut()`, never raw Supabase from UI. Preserve current sign-out scope semantics.

## User flow and screen/state contract

Inbox person action -> modal `Account settings` -> one nested detail at a time. Root rows:

1. `Notifications` — `On` or `Off` from current OS status.
2. `Privacy` — `Presence and blocked people`.
3. `Appearance` — `System`, `Light`, or `Dark`.
4. `Accessibility` — `System` or `Reduce motion`.
5. `Reset password` — `Opens the secure FISH website`.
6. `Sign out` — quiet/ghost action separated at the bottom.

Every page has Back/Close, sentence-case copy, 44×44 pt targets, Dynamic Type reflow, token spacing, and at most one primary action.

| Page | State/copy contract |
| --- | --- |
| Notifications | Show `.notDetermined`, authorized/provisional/ephemeral, or denied as calm user-facing status. Before decision: primary `Allow notifications`; afterward: primary `Open notification settings`. Copy: `Message alerts show who sent them, but not the message.` and `Your iPhone controls previews, sounds, and delivery.` |
| Privacy | Rows `Presence visibility`, client-only `Blocked people`, and `Privacy policy`; notification facts link back to Notifications rather than a toggle. |
| Presence visibility | Existing Automatic/Away/Busy/Invisible semantics and durations; Invisible copy `Appear offline.` |
| Blocked people | Loading, list, empty `No one is blocked right now.`, failure `Blocked people aren’t available yet. Try again.`, per-row busy, success `{name} is no longer blocked.` Explain that unblocking does not restore a relationship/conversation. |
| Appearance | Radio rows System/Light/Dark, immediate. Unknown stored strings become System. |
| Accessibility | Radio rows System/Reduce motion. Copy: `System follows your device accessibility settings.` No custom text size. |
| Recovery | External `${WEB_BASE_URL}/forgot-password`; on invalid configuration/open failure: `Password help isn’t available in this build.` Signed-out label is `Forgot password`. |

## Lean architecture and data flow

```text
Inbox person -> FishApp sheet state -> AccountSettingsView
  values/callbacks from FishAppModel
    notification center / UIApplication / openURL (App only)
    ChatLive account safety + presence methods (Supabase stays in ChatData)
    FishAppModel.signOut (existing cleanup)

DeviceSettingsStore (AccountSettings, UserDefaults)
  theme -> FishRoot.preferredColorScheme(nil/.light/.dark)
  explicit motion + OS motion -> fishReduceMotion environment
  -> bounded current animation consumers
```

Architecture decision: one `AccountSettings` target gives the reusable screen a clear owner without making `Presence` or `PersonalChat` own account behavior. It depends only on presentation libraries and receives closures/value models from App. `ChatLive` remains the sole Supabase boundary. Rejected alternatives: a settings data target/protocol stack for two local enums, importing Supabase into settings, or promoting the non-production Presence sheet into the app shell.

Apple recommends contextual notification requests, live settings reads, the notification-settings URL, root color-scheme overrides, and respecting the system Reduce Motion environment: [permission](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications), [settings read](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/getnotificationsettings%28completionhandler%3A%29), [notification settings URL](https://developer.apple.com/documentation/uikit/uiapplication/opennotificationsettingsurlstring), [ColorScheme](https://developer.apple.com/documentation/swiftui/colorscheme), and [Reduce Motion](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion).

## Ordered incremental implementation steps

### Step 1 — Remove launch-time notification prompting

**Goal:** Stop unsolicited prompts while preserving delegate notification handling.

**Why necessary:** Authorization must follow an explicit user action; delegate registration and notification response routing remain valid.

**Dependencies/assumptions:** Existing authorized users should continue receiving pushes without another prompt.

**Actions:** Remove `requestAuthorization` from `didFinishLaunching`; keep `center.delegate = self`. Query current settings without prompting and call `registerForRemoteNotifications()` only for already authorized/provisional/ephemeral states. Keep token callbacks, foreground suppression, and conversation routing. Add a regression test or source guard proving launch never requests authorization.

**Files:** `apps/ios/App/Sources/FishApp.swift`; focused App test/guard if supported.

**Verification:** `pnpm ios:guard`; `pnpm ios:test`; `pnpm ios:app:build`.

**Completion criteria:** Fresh launch/sign-in shows no prompt; previously authorized installs still register with APNs; delegate routing remains intact.

### Step 2 — Add AccountSettings target and wire the existing person action

**Goal:** Establish the compact settings root without breaking sign-out.

**Why necessary:** The current icon hides account context and makes sign-out accidental; settings need a provider-free owner.

**Dependencies/assumptions:** Reuse current tokens, TopBar, buttons, notices, avatars, and sheet conventions.

**Actions:** Add `AccountSettings` product/target and test target to `Package.swift`, depending only on DesignSystem/UIComponents; add it to App's XcodeGen dependencies. Create view/value models, root/detail navigation, loading/error states, and previews/snapshots. Change Inbox trailing action accessibility label to `Account settings` and present the sheet. Pass `Task { await model.signOut() }`; do not call `ChatLive` from the view. Use PresenceAccountSheet only as a visual reference, not an import/dependency.

**Files:** `apps/ios/FishKit/Package.swift`; new `Sources/AccountSettings/{AccountSettings.swift,Models/AccountSettingsModels.swift,Views/AccountSettingsView.swift}`; new tests/snapshots; `apps/ios/App/project.yml`; `apps/ios/App/Sources/FishApp.swift`.

**Verification:** `pnpm ios:tokens:check`; `pnpm ios:guard`; `pnpm ios:test`; `pnpm ios:app:build`.

**Completion criteria:** Person action opens Account settings; each nested page has Back/Close; Sign out invokes the existing model once; no global destination or Supabase import exists in AccountSettings.

### Step 3 — Add device theme and effective reduced motion

**Goal:** Implement the two approved local preferences immediately and safely.

**Why necessary:** Theme must override the root presentation; explicit motion reduction must combine with—not replace—the OS preference.

**Dependencies/assumptions:** `UserDefaults.standard` is sufficient. Invalid/missing values default to System.

**Actions:** Add a small observable `DeviceSettingsStore` in AccountSettings with allowlisted raw enums and app-only keys. Apply `.preferredColorScheme(nil/.light/.dark)` at FishRoot. Add one DesignSystem `fishReduceMotion` environment value populated at root from `systemReduceMotion || explicitReduced`; migrate only the seven audited consumers from direct system reads to this effective seam. Keep Dynamic Type/relative fonts untouched. Add parsing, persistence, environment, animation/no-autoplay, and snapshot tests.

**Files:** AccountSettings store/models/tests; `apps/ios/FishKit/Sources/DesignSystem/Motion/FishReduceMotion.swift`; seven audited UIComponents/PersonalChat view files; `apps/ios/App/Sources/FishApp.swift`.

**Verification:** `pnpm ios:tokens:check`; `pnpm ios:guard`; `pnpm ios:test`; manually toggle OS Reduce Motion while app active/backgrounded; `pnpm ios:app:build`.

**Completion criteria:** Theme changes immediately; System follows traits; explicit reduction stops FISH motion; OS Reduce Motion always wins; no text-size control appears.

### Step 4 — Add OS-authoritative notification settings

**Goal:** Show current status, request in context, open system settings, and refresh on active.

**Why necessary:** Users can change authorization outside the app; a local boolean would become false authority.

**Dependencies/assumptions:** `FishApp` owns `UNUserNotificationCenter` and `UIApplication`; AccountSettings receives values/closures.

**Actions:** Add a presentation enum mapped from `notificationSettings().authorizationStatus`. On explicit Allow, call `requestAuthorization`; if granted, register for remote notifications, then refresh. Open `UIApplication.openNotificationSettingsURLString` for decided states. Observe `scenePhase` and refresh on `.active`. Do not store notification state. Display current generic APNs preview facts. Test not-determined/allow/deny/provisional/revoked/return-from-Settings cases.

**Files:** `apps/ios/App/Sources/FishApp.swift`; AccountSettings models/view/tests.

**Verification:** `pnpm ios:test`; `pnpm ios:app:build`; physical-device fresh/deny/allow/revoke matrix.

**Completion criteria:** No prompt before Allow; status refreshes after the callback and every active transition; system settings open; delivery state has no UserDefaults key.

### Step 5 — Add privacy: presence, blocked people, and policy

**Goal:** Expose only deployed direct-chat privacy controls and facts.

**Why necessary:** Users need understandable visibility and a reversible unblock path; App Review requires an easily accessible privacy-policy link.

**Dependencies/assumptions:** Presence preference RPC/function supports authenticated users. Block list/unblock is client-only and RLS/security-definer constrained. Production `${WEB_BASE_URL}/privacy` must exist before release.

**Actions:** Add thin provider-neutral ChatData models and `ChatLive` methods for own presence preference/set, list blocked people, and unblock; keep Supabase SDK/internal wire types in ChatData and test URL/RPC mapping with injectable URLSession/internal adapter, not an extra public protocol/target. Resolve current account role/display name at the auth boundary so unsupported coaches do not see Blocked people. Pass value state/actions into AccountSettings; load blocked people only on detail open, single-flight unblocks, remove locally only after success, and never log identifiers. Open policy externally from trusted configuration. Do not import PresenceData/Presence UI solely to reuse its sheet.

**Files:** `apps/ios/FishKit/Sources/ChatData/Adapters/ChatLive.swift`; focused AccountSafety models/adapter/tests in ChatData; AccountSettings privacy views/tests; `apps/ios/App/Sources/FishApp.swift`.

**Verification:** `pnpm ios:test`; local two-client RPC/RLS and presence command check; `pnpm ios:app:build`.

**Completion criteria:** Client sees only own blocked people and can unblock once; coaches see no unsupported row; Invisible uses the real backend; privacy policy opens the trusted production page.

### Step 6 — Add external web password recovery and URL configuration

**Goal:** Provide signed-out Forgot password and signed-in Reset password through the existing hardened web flow.

**Why necessary:** A native callback/PKCE flow would duplicate hardened auth routing and expand attack surface.

**Dependencies/assumptions:** Add `FISH_WEB_BASE_URL` -> `WEB_BASE_URL` in XcodeGen/Info.plist/configuration. Release requires HTTPS; debug may explicitly configure a local origin.

**Actions:** Extend `FishAppConfiguration` with validated web base URL. Build `/forgot-password` and `/privacy` via URL path APIs; reject non-http(s), user-info, unexpected query/fragment, and non-HTTPS release values. Pass fixed URLs to App-owned `openURL`; no user input or email in the URL. Add Forgot password below sign-in password and Reset password in settings. Keep the current `onOpenURL` handler limited to existing `fish://messages` routing; do not add recovery handling.

**Files:** `apps/ios/App/project.yml`; `apps/ios/App/Sources/Info.plist`; `apps/ios/App/Sources/FishApp.swift`; App/config tests; AccountSettings recovery row/tests; `apps/ios/App/README.md`.

**Verification:** `pnpm ios:test`; `pnpm ios:app:build`; complete email/reset in external browser on release-like device; `pnpm build`.

**Completion criteria:** Both actions open exactly `/forgot-password`; invalid configuration fails closed with calm copy; no callback, associated domain, PKCE, token URL, or email prefill is added.

### Step 7 — Add privacy manifest and prove release behavior

**Goal:** Complete platform disclosure, cleanup, accessibility, and release checks.

**Why necessary:** The app already uses UserDefaults and this slice adds app-only settings; Apple designates UserDefaults a required-reason API.

**Dependencies/assumptions:** App-only UserDefaults access matches reason `CA92.1`; final privacy-policy/App Store disclosures require product/legal review.

**Actions:** Add `Sources/PrivacyInfo.xcprivacy` to the App target with `NSPrivacyAccessedAPICategoryUserDefaults` / `CA92.1`, no tracking declaration, and data-collection entries only when verified from the whole built app. Confirm XcodeGen copies it to the root app bundle. Add end-to-end settings tests and assert sign-out preserves stop chat -> unregister server push installation -> `ChatLive.signOut` -> clear state. Do not call `unregisterForRemoteNotifications()` on sign-out: server device unregister stops account delivery, while APNs registration is installation/process lifecycle and the token can be reused after next sign-in. Test VoiceOver, Dynamic Type accessibility sizes, RTL, themes, Reduce Motion, offline/error states, and physical notification behavior.

**Files:** `apps/ios/App/Sources/PrivacyInfo.xcprivacy`; `apps/ios/App/project.yml` only if resource inclusion is not automatic; AccountSettings/App/ChatData tests.

**Verification:** `pnpm ios:tokens:check`; `pnpm ios:guard`; `pnpm ios:test`; `pnpm ios:app:build`; inspect built `.app/PrivacyInfo.xcprivacy`; `pnpm build`.

**Completion criteria:** Manifest is valid/in bundle; UserDefaults reason is accurate; full settings flow passes accessibility/release tests; sign-out clears server/local account state through the existing path.

Apple's required-reason declaration and privacy manifest integration are documented at [NSPrivacyAccessedAPIType](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype). App Review privacy-policy and account rules remain release inputs: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## File map and verification matrix

| Owner | Responsibility |
| --- | --- |
| `AccountSettings` | Provider-free views, value models, device preference store, snapshots/unit tests. |
| `FishApp` / `FishAppModel` | Presentation, notification/APNs lifecycle, scene refresh, openURL, configuration, existing sign-out orchestration. |
| `ChatData/ChatLive` | Supabase boundary for identity/presence/blocked-person operations and existing auth/push sign-out. |
| `DesignSystem` + audited consumers | One effective reduced-motion environment seam; no general redesign. |

| Risk | Required proof |
| --- | --- |
| Automatic prompt | fresh launch/sign-in plus source/unit guard |
| Notification drift | physical allow/deny/revoke/scene-active matrix |
| Preference corruption | unknown raw values -> System tests |
| Motion override | OS true + explicit false still reduces; loops/autoplay stop |
| Backend privacy | two-client list/unblock and coach capability/RLS checks |
| Auth-link safety | fixed trusted HTTPS origin/path tests; external browser flow |
| Sign-out residue | ordered cleanup spy/integration tests, including remote failure |
| UI accessibility | VoiceOver, accessibility Dynamic Type, RTL, themes, no competing primary action |

## Security/privacy notes, rollout, and rollback

- Fixed configured URLs only; no arbitrary URL/intents, credentials, email, token, or redirect query. Release URLs must be HTTPS.
- OS notification settings remain authority; APNs token presence is not permission state. Message payload contains sender/generic copy, not body.
- Backend authorizes blocked/presence operations; UI hiding is not authorization. Never log blocked identities or preference payloads.
- Parse UserDefaults with allowlists and safe defaults. Store no account identity, token, or server privacy state in settings preferences.
- Keep Supabase inside ChatData. Preserve existing sign-out scope; Supabase sign-out removes the stored session, while current app cleanup happens before it: [Supabase sign-out](https://supabase.com/docs/guides/auth/signout).
- Land steps independently green. Internal/TestFlight rollout first; verify fresh and upgrading users. If UI must roll back, retain the launch-prompt removal, safe URL validation, and valid privacy manifest. No backend migration needs rollback.

## Assumptions, tradeoffs, risks, and explicit deferrals

- Assumption: production provides stable HTTPS `/forgot-password` and `/privacy` pages plus final privacy copy before release.
- Assumption: client-only blocked-person capability remains intentional; no coach contract is inferred.
- Tradeoff: one feature target adds a package boundary but prevents App/Presence/PersonalChat from accumulating the whole settings UI. No companion data target is justified.
- Tradeoff: nested details cost taps but reduce simultaneous choices for FISH's audience.
- Risk: App Review Guideline 5.1.1(v) can require in-app deletion when an app supports account creation. Account deletion is locked out of this slice; product/legal must resolve it before public submission.
- Risk: privacy-manifest collected-data declarations require a whole-app/SDK audit; this plan confidently specifies only verified UserDefaults required-reason use.
- Deferred: export/deletion/retention/consent tooling; all invented chat/notification toggles; dynamic color/theme sync/custom text size; native recovery/callback/PKCE/associated domains; `unregisterForRemoteNotifications` on sign-out; any non-chat mobile surface.

## Release/manual checks

- Confirm production web/policy URLs, privacy manifest/report, App Store privacy metadata, review demo account, and deletion-scope decision.
- Test fresh install, already authorized upgrade, deny, allow, revoke in Settings, scene-active refresh, APNs delivery, and generic preview on physical device.
- Complete external password email/reset without changing native URL routing or leaking app state.
- Test presence Invisible and blocked list/unblock with target Supabase accounts.
- Sign out during upload, offline, and notification registration; verify chat/upload shutdown, server push-device unregister, auth removal, and clean signed-out UI.
- Run VoiceOver, Switch Control where available, accessibility Dynamic Type, RTL, System/Light/Dark, OS and explicit Reduce Motion, iPhone/iPad, and all verification commands.

## Definition of done

- Existing person action opens the approved compact sheet; direct chat remains the only native product surface.
- No launch-time permission request or persisted notification flag exists; status/action are OS-authoritative and refresh on active.
- Theme and motion exactly satisfy local/default/effective rules, preserving Dynamic Type.
- Privacy exposes only real presence, blocked-person, policy, and notification facts/contracts.
- Forgot/Reset password uses the hardened external web flow with no native auth redirect machinery.
- Sign out uses the current FishAppModel -> ChatLive cleanup path and current scope; UI imports no Supabase.
- Privacy manifest is valid and bundled; all iOS and monorepo checks plus manual release matrix pass.
