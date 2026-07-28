# Mobile Parity Implementation Plan

> **For agentic workers:** execute task-by-task with superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the verified feature-parity gaps between the iOS and Android direct-chat apps with the smallest change that ships each capability.

**Architecture:** No new modules, no new libraries. Each gap is closed by extending the existing feature module on the lagging platform, mirroring the pattern the other platform already shipped. Platform-native APIs only (MediaRecorder amplitude, background URLSession, size-class layout).

**Philosophy:** Simplest solution that satisfies the requirement. Every task lands in a working, committed state before the next begins. Commits are incremental and logical, no co-author trailer.

**Priority order** (smallest and most certain first; each is independently shippable):

| # | Task | Platform | Size |
|---|------|----------|------|
| 1 | Voice-recording level meter | Android | S |
| 2 | Mid-call chat access (minimize to compact bar) + delete dormant `CallChatPane` | iOS | S–M |
| 3 | Durable background attachment uploads | iOS | M |
| 4 | Two-pane iPad layout | iOS | M–L |

Deferred items and the reasoning are at the end.

---

## Task 1 — Android: microphone level meter while recording

**Goal:** Show a live three-bar input-level meter during voice-message recording, visually matching iOS's `MicrophoneLevelMeter`.

**Why:** iOS ships recording feedback (`FishKit/Sources/UIComponents/Feedback/MicrophoneLevelMeter.swift`, driven by `AVAudioRecorder` metering); Android shows only elapsed time, so users can't tell the mic is picking anything up.

**Dependencies / assumptions:**
- Android records with `MediaRecorder` (`apps/android/app/src/main/kotlin/space/fishhub/android/VoiceMessageRecorder.kt`), whose `maxAmplitude` property returns the max amplitude *since the last call* — it is inherently a polling API, which fits the existing elapsed-time tick.
- A ticker already updates `VoiceRecordingUiState.elapsedMillis` somewhere between `MainActivity.kt` (which wires the recorder, ~line 315) and `ChatRoute.kt`. Step 1 locates it; the meter piggybacks on that tick rather than adding a second timer.

**Scope:** Meter UI + level plumbing only. No waveform persistence, no recording format changes.

**Steps:**

- [x] **1.1 Locate the recording ticker.** Grep `elapsedMillis` in `apps/android/feature/chat/.../ChatRoute.kt` and `apps/android/app/src/main/kotlin/space/fishhub/android/MainActivity.kt` and find the coroutine that increments it while recording.

- [x] **1.2 Expose a normalized level from the recorder.** In `VoiceMessageRecorder.kt` add:

```kotlin
/** 0f..1f snapshot of input loudness since the last poll. */
fun currentLevel(): Float {
    val raw = try { recorder?.maxAmplitude ?: 0 } catch (_: IllegalStateException) { 0 }
    return (raw / 32767f).coerceIn(0f, 1f)
}
```

- [x] **1.3 Carry the level in UI state.** Add `val level: Float = 0f` to `VoiceRecordingUiState` (`apps/android/feature/chat/.../model/ChatModels.kt:116-120`). In the ticker from 1.1, poll `currentLevel()` each tick and smooth with an exponential moving average so bars don't flicker: `smoothed = 0.6f * smoothed + 0.4f * sample`. Write a small unit test for the smoothing function (pure function, extract it as `internal fun smoothLevel(previous: Float, sample: Float): Float`).

- [x] **1.4 Add the meter composable.** New file `apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/views/MicrophoneLevelMeter.kt`: three rounded bars whose height scales mirror iOS (`0.2 + level * 0.8`, `0.15 + level * 0.85`, `0.1 + level * 0.9` — see `MicrophoneLevelMeter.swift:20-22`), using existing design tokens for color (active tint while recording, muted otherwise). Include a `@Preview`. If composer animations already gate on the reduce-motion preference, apply the same gate; otherwise plain size changes are acceptable (no springs).

- [x] **1.5 Render it in the composer recording row** (`apps/android/feature/chat/.../views/MessageComposer.kt`, recording UI around lines 72-236), next to the elapsed-time label.

- [x] **1.6 Verify and commit.** Run the feature-chat unit tests and the module build. If the existing `screenshotTest` source set covers the composer, record and visually review the new baseline. Commit: `feat(android): show mic level meter while recording voice messages`.

---

## Task 2 — iOS: mid-call chat access + remove dormant CallChatPane

**Goal:** Let the user read and send messages during an active call by minimizing the call to a compact bar — the pattern Android ships — and delete the unwired `CallChatPane`.

**Why:** On Android, `CallRoute.kt:70` maps "open messages" to minimizing the call (`CompactCallBar.kt`), so users can text mid-call. On iOS, `CallOverlay` is z-stacked over the whole app (`App/Sources/FishRoot.swift:40-44`) with no way out, so messages are unreachable during a call. The alternative — wiring the existing `CallChatPane` — looks cheaper but isn't: the pane needs a second live conversation surface injected into the overlay (only the Catalog lab ever does this, `Catalog/Sources/LiveAttachmentLab.swift:241`), duplicating chat state that already exists right under the overlay. Minimizing reuses the entire existing chat stack and gives identical cross-platform behavior.

**Dependencies / assumptions:**
- `CallSessionState` already exposes what the bar needs (counterpart name — see `CallChatPane.swift:17` — call status/duration, and hang-up goes through the existing model command path).
- The inbox/conversation UI stays mounted beneath the overlay's ZStack in `FishRoot`, so hiding the overlay body reveals a working app. (Verified: `FishRoot` switches phases independently of the overlay.)
- Product accepts Android's minimize pattern over the web's side-pane pattern on iOS. Tradeoff: the deleted pane is the web-parity design; git history keeps it if the product ever wants a true iPad side-pane.

**Scope:** Minimize/restore + compact bar + deletion of the dormant pane. No in-overlay chat rendering, no PiP, no changes to call media.

**Steps:**

- [x] **2.1 Delete the dormant pane (pure removal, working state).** Delete `FishKit/Sources/Calls/Views/CallChatPane.swift`. Remove the `chatContent` parameter and the `chatOpen`/`chatAvailable` plumbing from `CallSurface.swift` (lines 15, 23, 30, 73-74, 87) and `CallOverlay.swift` (lines 18, 26, 31, 41). Update `Catalog/Sources/LiveAttachmentLab.swift:241` to construct `CallOverlay` without `chatContent`. Build FishKit + Catalog, run FishKit tests. Commit: `refactor(ios): remove unwired in-call chat pane`.

- [x] **2.2 Add minimized state.** Shipped as `@State private var isCallMinimized` hoisted in `App/Sources/FishRoot.swift` (the call site, mirroring Android's `CallRoute` hoisting `minimized`/`onMinimizedChange` rather than owning it inside the overlay), with the reset-on-call-change decision extracted as a pure, tested function `shouldResetMinimized` in `FishKit/Sources/Calls/Logic/CallMinimizeReset.swift` — not a flag/`minimize()`/`restore()` pair on the call model itself as originally sketched.

- [x] **2.3 Build `CompactCallBar`.** New file `FishKit/Sources/Calls/Views/CompactCallBar.swift`, mirroring Android's `feature/call/.../views/CompactCallBar.kt`: one-line bar with counterpart name, live duration, a hang-up control, tap anywhere else to restore. Use existing `DesignSystem` tokens; keep touch targets ≥ 44pt.

- [x] **2.4 Wire it in `FishRoot.swift`.** When the call model is active and minimized, render `CompactCallBar` (safe-area-pinned, above the app content) instead of the full `CallOverlay`. Add a minimize affordance to the overlay's header/controls (`CallStatusHeader.swift` or `CallControls.swift` — match where Android places it).

- [x] **2.5 Verify and commit.** FishKit test suite + app build. Exercise minimize/restore/hang-up in the Catalog `LiveCallLab` if convenient. Commit: `feat(ios): minimize active calls to a compact bar so chat stays reachable`.

---

## Task 3 — iOS: durable background attachment uploads

**Goal:** Attachment uploads keep running when the app is backgrounded or killed by the OS, matching Android's WorkManager behavior.

**Why:** Android schedules uploads through `AttachmentUploadWorker.kt` (survives process death). iOS uses an **ephemeral** in-process `URLSession` (`FishKit/Sources/ChatData/Adapters/SignedUrlByteUploader.swift:13`) plus a ~30s `beginBackgroundTask` grace window (`AttachmentUploadsModel.swift:39,410-422`) — a large video on cellular dies when the user switches apps, and only restarts from the outbox on next launch.

**Why background URLSession (and not a port of WorkManager):** it is the platform's built-in answer — the OS runs the transfer out-of-process, no library needed, and uploads are already file-based (`uploadTask(with:fromFile:)`, `SignedUrlByteUploader.swift:41`), which is the one hard prerequisite.

**Dependencies / assumptions:**
- One shared session replaces per-upload sessions: background sessions must be created once per identifier, with a session-level delegate — per-task closure delegates don't survive relaunch.
- The durable outbox + relaunch restore already exist (`AttachmentUploadsModel.swift:88-115`); relaunch reattachment plugs into it.
- **Verify before 3.3:** signed upload URL expiry. If Supabase signed upload URLs expire quickly (commonly ~2h, config-dependent), reattaching to a *running* OS task is still fine (the request was already sent), but restarting a *failed* task after relaunch must re-request authorization via the existing `EdgeFunctionAttachmentCommands` path rather than reuse the stored URL.

**Scope:** Transport durability only. Public API of `AttachmentByteUploading` (an `AsyncThrowingStream<Double, Error>` of progress) stays unchanged, so `AttachmentUploadsModel` is barely touched. No retry-policy redesign, no upload queue changes.

**Steps:**

- [x] **3.1 Introduce a shared session + delegate registry (still foreground, working state).** Shipped as `BackgroundAttachmentUploadCoordinator` (`FishKit/Sources/ChatData/Adapters/`), a `.shared` singleton keyed by `attachmentId` (not `clientUploadId` — `attachmentId` is what's actually stable across repeat `initializeUpload` calls for the same logical upload, and it's already on hand as `authorization.attachmentId`, so no protocol change was needed to thread `clientUploadId` through separately).

- [x] **3.2 Switch to a background configuration.** Shipped with identifier `"app.fish.chat-attachment-uploads"` (matching the app's real bundle-ID convention, not the placeholder guessed here). `FishAppDelegate` eagerly touches the coordinator from `didFinishLaunchingWithOptions` (a stored property, so `@UIApplicationDelegateAdaptor` constructs it before any delegate callback fires) and implements `handleEventsForBackgroundURLSession`/`urlSessionDidFinishEvents` as described.

- [x] **3.3 Reconcile on relaunch.** Shipped as designed, via `session.getAllTasks` inside the coordinator. Review surfaced one gap the original plan didn't anticipate: a PUT that completes while the app is fully *terminated* (not just backgrounded) has no live task for `getAllTasks` to find and no observer registered — the completion was silently dropped, and a relaunch retry would then collide with the server's `upsert: false` policy and get permanently stuck. Fixed with `CompletedAttachmentUploadMarks`, a small file-backed, TTL'd durable marker (separate from the outbox) that `upload()` consults before reissuing a PUT for an `attachmentId` whose completion already landed unobserved.

- [x] **3.4 Delete the now-redundant `beginBackgroundTask` grace-window code** in `AttachmentUploadsModel.swift:410-422`. Run the full FishKit test suite. Commit: `feat(ios): move attachment uploads to a background URLSession`.

---

## Task 4 — iOS: two-pane iPad layout

**Goal:** On regular-width iPad, show the conversation list and the open conversation side by side, mirroring Android's `ChatAdaptiveLayout.kt`.

**Why:** The app targets iPad (`TARGETED_DEVICE_FAMILY = "1,2"` in `App/Fish.xcodeproj/project.pbxproj`) but renders the single-route phone flow with width clamping (`Metrics.chatContentMaxWidth`) — a stretched phone app. Android tablets already get list + detail (`ChatRoute.kt:328,467`).

**Why a size-class two-pane and not `NavigationSplitView`:** the app's navigation is a phase enum (`FishAppModel.swift:19`: loading/signedOut/inbox/opening/conversation), not a `NavigationStack`. `NavigationSplitView` would force restructuring that state machine for sidebar-collapse behaviors nobody has asked for. A conditional two-pane keeps the state machine intact and mirrors exactly what Android shipped.

**Dependencies / assumptions:**
- **Step 4.1 must verify:** whether `FishAppModel` keeps the conversation-list state alive when the phase moves to `.conversation`, since the two-pane keeps `InboxView` mounted while a conversation is open. If the list model is torn down on phase change, keep it resident (this is the real work in this task, and why it is ordered last).
- Sheets (settings, details, search, shared content) stay sheets in both layouts — no popover redesign.
- Compact width (iPhone, iPad split-screen narrow) keeps today's behavior untouched.

**Scope:** Layout only. No sidebar collapse, no drag-to-resize, no multitasking polish beyond what size classes give for free.

**Steps:**

- [x] **4.1 Read `FishAppModel` + `InboxView` and confirm list-state lifetime across phases.** If the list is torn down when opening a conversation, refactor so the inbox model lives on `FishAppModel` for the app session (smallest change that lets both panes share it). Commit any refactor separately: `refactor(ios): keep inbox state resident across phases`.

- [x] **4.2 Add the two-pane container.** New file `App/Sources/ChatSplitLayout.swift`: a single, always-mounted `HStack(spacing: 0)` with an optional *leading* rail (`InboxView` at a fixed sidebar width — mirror Android's pane width from `ChatAdaptiveLayout.kt`, using an existing `Metrics` token or adding one — plus a divider) shown only when `@Environment(\.horizontalSizeClass) == .regular` and there's more than one conversation, followed by an unconditional trailing `mainContent` that switches on phase (`.opening`/`.conversation` content, or a quiet empty-state — "No conversation selected" — when `.inbox`). Keep the rail as a *sibling*, not a branch of an outer `if/else` between two different view trees — a top-level structural conditional would rebuild `ConversationView` (and lose its local nav/sheet state) every time the rail's visibility flips, including on rotation or a conversation-count change mid-conversation.

- [x] **4.3 Wire selection.** In regular width, tapping a conversation drives the same `FishAppModel` open-conversation intent it does today — no parallel selection state. Verify back/close semantics: closing a conversation returns the detail pane to the empty state without touching the list.

- [x] **4.4 Verify and commit.** FishKit + app build, full test suite. Layout is best judged visually: build the Catalog or run the app once on an iPad simulator and eyeball list+detail, rotation, and split-screen compact fallback. Commit: `feat(ios): side-by-side list and conversation on regular-width iPad`.

---

## Deferred until there is a concrete need

- **iOS picture-in-picture for calls.** High complexity (AVKit PiP requires sample-buffer video layers wired into LiveKit's rendering) for an unproven need. The Task 2 compact bar already covers "do something else while on a call" in-app. Revisit only on user demand.
- **iOS in-call audio route picker.** Deliberate platform convention — the system owns the route (comment at `CallSettingsSheet.swift:7-8`). If ever wanted, `AVRoutePickerView` is a drop-in; nothing to build today.
- **iOS structured message persistence (Room equivalent).** The file cache is an explicit design choice ("presentation continuity only", `FileChatCacheStore.swift:7-9`) and there is no observed user pain. Migrating to SQLite/CoreData is a rewrite with real migration risk. Wait for concrete symptoms (slow cold start on long histories, offline complaints).
- **Dev-infra asymmetries.** Android benchmarks/baseline profiles and the iOS Catalog app serve their own platforms; parity here has no user value.
- **Sidebar collapse / `NavigationSplitView` migration on iPad.** Only if the Task 4 two-pane proves insufficient.

## Assumptions and tradeoffs (explicit)

1. **Minimize-over-pane (Task 2)** trades the web's side-pane design for cross-platform behavioral parity and far less code. Deleting `CallChatPane` is recoverable from git history.
2. **Amplitude polling (Task 1)** at the existing tick rate is assumed sufficient; `MediaRecorder.maxAmplitude` resets per read, so the tick is the sampling window. No `AudioRecord` rewrite for smoother metering unless the meter visibly stutters.
3. **Background-session reattach (Task 3)** assumes signed upload URLs outlive an in-flight OS transfer; the relaunch path re-requests authorization for restarts, which covers short expiries. If verification in 3.3 finds URLs expiring mid-transfer, uploads fall back to restart-with-fresh-URL — still durable, slightly less efficient.
4. **Two-pane via size class (Task 4)** accepts less "free" iPad behavior than `NavigationSplitView` in exchange for not restructuring the app's navigation state machine. The container is one file; migrating later is not made harder.
5. Throughout: no new third-party dependencies; every capability uses the platform API the other platform's implementation already implies.
