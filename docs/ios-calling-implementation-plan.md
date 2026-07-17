# Native iOS (SwiftUI) audio and video calling plan

**Goal:** Bring FISH one-to-one audio and video calling to iOS, mirroring the web
implementation's functionality, visual design, copy, and contracts as closely as
the platform allows — built on the existing FishKit architecture so the feature
is testable today (fixtures + catalog) and production-ready the moment the app
gains auth and a realtime session.

**Status:** Implemented with this plan · Prepared 2026-07-17 · Companion to
`docs/realtime-calling-implementation-plan.md` (backend + web architecture,
already shipped) and `docs/ios-personal-chat-foundation-plan.md` (the FishKit
conventions this feature follows).

---

## What already exists (and is not rebuilt)

The entire call backend and the web client are live. iOS only **consumes**
these contracts:

- **Database + RPCs** (`supabase/migrations/0020_calls.sql`, `0037`, `0038`,
  `0045`): `calls` / `call_participants` / `call_events`, RLS, atomic lifecycle
  RPCs, 45-second ring expiry, pg_cron sweeper, busy/rate-limit/idempotency
  enforcement.
- **`call-command` Edge Function**: one authenticated POST endpoint,
  discriminated by `action` (`initiate`, `initiateLesson`, `checkMedia`,
  `accept`, `reject`, `cancel`, `end`, `join`). Success returns the camelCase
  `call` row and — for `accept`/`join` — a `connection`
  `{ serverUrl, participantToken }` (LiveKit JWT, 5-minute TTL, room-scoped,
  microphone-only for audio calls, microphone+camera for video).
- **`livekit-webhook` Edge Function**: reconciles LiveKit room/participant
  events into durable state (`connecting → active`, disconnect grace, etc.).
- **Realtime signaling**: private broadcast channel `calls:user:<userId>`,
  event `call.changed`, payload `{ callId, status, occurredAt }` — a wakeup
  only; clients always re-read the RLS-protected `calls` row.
- **Portable state machine**: `packages/core/src/call-state/`
  (`types.ts`, `reducer.ts`, `selectors.ts`) — the canonical lifecycle model
  the web provider drives. The architecture doc explicitly plans for native
  clients to replay the same transitions.
- **Web UI** (`apps/web/features/calls/`): `CallPopoverView` (single view, two
  presentations), `CallPopover` (floating card + auto-navigation), `CallScreen`
  (full-screen video route), `DraggableVideoPreview` (self-view PiP),
  `CallButton`/`CallEntryAction` (entry points), `LiveKitCallMedia` (media
  adapter), `call-provider.tsx` (orchestration).

## iOS starting point (constraints that shape this plan)

- `apps/ios` is **FishKit** (local SPM package, Swift 6 strict concurrency,
  iOS 17) + an XcodeGen **Catalog** host app. Views are stateless (state in,
  intent out); the only store pattern is `@MainActor @Observable` with a
  projected `Equatable` state struct (`GifSearchModel`).
- **There is no Supabase client, no auth, no realtime, and no push on iOS.**
  The documented staging (foundation plan, RN audit) adopts `supabase-swift`
  behind FISH-owned protocols in a later data milestone. Calling must therefore
  ship behind **provider protocols** with (a) deterministic fixtures for the
  catalog/tests and (b) real Foundation-only HTTP adapters that work as soon as
  a session token exists — plus a real LiveKit media adapter, which needs no
  Supabase at all.
- Tokens are generated (`design/tokens/fish.tokens.json` →
  `pnpm ios:tokens`), icons are curated Tabler SVGs behind the `Icon` enum,
  and `pnpm ios:guard` enforces token purity and one-way module imports.

## Architecture

Two new FishKit library targets plus one adapter target, following the
DesignSystem ← UIComponents ← feature layering and the ChatData
protocol/adapter precedent:

```text
CallData            (Foundation only — no UI, no SDK dependencies)
  Models/           CallSessionState, CallEvent, CallState, ClientCall,
                    CallConnection, CallCommandOutcome, CallRealtimeEvent
  State/            CallStateReducer (verbatim port), CallStateSelectors
  Providers/        CallCommandProviding, CallRealtimeProviding (protocols)
  Adapters/         EdgeFunctionCallCommands (URLSession → call-command),
                    RestCallDirectory + PollingCallRealtime (PostgREST reads,
                    foreground polling wakeups until a websocket adapter lands)

Calls               (feature UI — depends on DesignSystem, UIComponents, CallData)
  Logic/            CallCopy (headings/status/notices — exact web strings),
                    VideoQualityPreference (auto | dataSaver, UserDefaults)
  Providers/        CallMediaProviding + CallMediaEvents + MediaPermissionRequesting
                    (media is feature-local, exactly like web's call-media.ts)
  ViewModels/       CallSessionModel (@MainActor @Observable port of
                    call-provider.tsx) + CallPanelState projection
  Views/            CallPanel (port of CallPopoverView), CallControls,
                    CallActivityPanel, MicrophoneLevelMeter, RemoteVideoStage,
                    LocalVideoPreview (draggable self-view), CallPromptActions
  Screens/          CallOverlay (floating-card presentation + video handoff),
                    CallScreen (full-screen video presentation + chat slot)

CallMediaLiveKit    (adapter — depends on Calls + livekit/client-sdk-swift)
  LiveKitCallMedia  Room lifecycle, tracks, reconnection, speaking monitor,
                    quality preference, speaker route, camera flip
  Video views       SwiftUI wrappers vending local/remote video for the stage
```

- `TestSupport` gains `FixtureCallProviders` (scripted command/realtime/media
  fakes) and the shared reducer vectors resource.
- The Catalog app wires everything at the boundary (KLIPY precedent):
  fixture-driven call pages always; a **live call lab** page appears only when
  dev configuration is injected at `xcodegen generate` time.
- `scripts/ios-token-guard.mjs` gains the new modules' one-way import rules
  (`CallData` may import nothing internal; `Calls` may not import
  `TestSupport`/`CallMediaLiveKit`; `CallMediaLiveKit` may not import
  `TestSupport`).

### Why the media protocol lives in `Calls`, not `CallData`

On web, `LiveKitCallMedia` is feature-local (`features/calls/client/`), not a
`lib/services` contract — media is inherently platform UI (video surfaces).
Mirroring that: `CallData` stays a pure control-plane module (portable,
Foundation-only, trivially testable), while `Calls` owns the media port and the
SwiftUI-facing video-view vending. `CallMediaLiveKit` is a separate target so
the heavy WebRTC dependency never taints reducer/UI tests or any future
consumer that only needs the control plane.

### State machine (verbatim port)

`packages/core/src/call-state/reducer.ts` is ported 1:1 to
`CallStateReducer.reduce(_:_:)` with the same semantics:

- Statuses: `idle, requestingPermission, ringing, connecting, active,
  reconnecting, ended, rejected, cancelled, missed, failed`.
- Events: `permissionRequested, permissionDenied, outgoingCallCreated,
  incomingCallReceived, callAccepted, mediaConnected, muteChanged,
  cameraChanged, reconnecting, reconnected, callRejected, callCancelled,
  callMissed, callEnded, callFailed, clearCall, identityChanged`.
- Guards preserved exactly: live-call busy ignore for foreign incoming calls,
  stale-event no-ops by `callId`, camera changes only for live video calls,
  `reconnecting` only from `active`, first `connectedAt` wins,
  `clearCall`/`identityChanged` reset.

**Shared conformance vectors**: a new
`packages/core/src/call-state/fixtures/call-state-vectors.json` (same shape as
the existing `chat-state-vectors.json`) is replayed by BOTH platforms —
a new web test (`apps/web/tests/call-state-fixtures.test.ts`) and the Swift
test suite (`CallDataTests/CallStateVectorTests`). A byte-identity check keeps
the copy bundled into `TestSupport/Resources` from drifting (the
`ios:tokens --check` precedent, enforced in the web test).

### Orchestration (`CallSessionModel` ⇄ `call-provider.tsx`)

Port the provider's behavior exactly, including its asymmetries:

1. `startCall(recipientId:recipientName:kind:)` — refuse when a live call
   exists ("Finish the current call before starting another one."), dispatch
   `permissionRequested`, request device permission (explicit user gesture
   only), then `initiate`; failure maps to the web notice strings.
2. Invitations arrive from `CallRealtimeProviding` wakeups → always re-read the
   call (`findCall`) and `applyCall` (same status→event mapping, including
   hydration of missed transitions on recovery).
3. **Callee** joins media via `accept` (token in response). **Caller** joins
   when the realtime wakeup reports `connecting` and `initiatedBy == self`,
   via `join`. Single-flight connection attempts per call id.
4. Terminal statuses disconnect media immediately; failures run the
   best-effort `end` + disconnect + `callFailed(connectFailed)` path with
   "The call didn’t connect. Messages still work."
5. Recovery: on subscribe/foreground, `findCurrentCall` (or `findCall` for a
   known id) re-hydrates state — the durable row is the source of truth.
6. `identityChanged` on teardown; media always disconnected on deinit/sign-out.
7. Terminal panel auto-clears after 5 seconds (web `call-popover.tsx`).

## Dependencies

| Dependency | Where | Why |
| --- | --- | --- |
| `livekit/client-sdk-swift` (2.x, SPM) | `CallMediaLiveKit` target only | The official Swift SDK for the already-chosen media plane. Matches web's `livekit-client`: room connect via `{serverUrl, participantToken}`, adaptive stream, dynacast, simulcast, reconnection, track events. |
| (none) for the control plane | `CallData` | `call-command` is plain HTTPS + JSON; PostgREST reads are plain GETs. Foundation's `URLSession` keeps the domain module dependency-free until the `supabase-swift` milestone. |

No other new dependencies. `supabase-swift` adoption (auth + websocket
Realtime) remains its own milestone per the foundation plan; this feature's
protocols are shaped so that adapter swap is additive.

## Design tokens, icons, typography

- **New manifest tokens** (then `pnpm ios:tokens` + `pnpm android:tokens`):
  - `color.successPressed` — web `--color-success-press` (Answer button press).
  - `sizePt.callPanel: 360` (web `--container-call-popover`),
    `sizePt.callSettings: 336`, `sizePt.callPreview: 112` (self-view width).
- **New `Icon` cases** (Tabler outline, stroke 1.75, template SVG imagesets,
  copied from the pinned `@tabler/icons` package): `phone`, `phoneOff`,
  `video`, `videoOff`, `microphone`, `microphoneOff`, `settings`, `messages`,
  `volume` (speaker route), `cameraRotate` (flip camera).
- Typography/spacing/radius: existing roles only — prompt headings use
  `.heading` (Fraunces 20), compact headings `.ui`/`.label`, statuses
  `.caption`/`.label`; radii `card`/`control`/`pill`; spacing tokens as on web
  (`gap-sm` grid for Answer/Decline, `p-page` prompt padding, `p-md` compact).

## Visual design (mirrors `CallPopoverView` state-for-state)

One SwiftUI view tree (`CallPanel`) renders every lifecycle state; two
presentations mirror the web exactly:

1. **Overlay card** (web popover): floating card, width
   `min(callPanel token, screen − 2×page)`, pinned bottom-leading above the
   safe area, `surface` fill + `divider` hairline, radius `card`. Shown for
   audio calls, ringing/incoming prompts, and terminal states.
2. **Full screen** (web `/calls/[id]` screen): when a **video** call is
   `connecting/active/reconnecting`, the UI switches to a full-screen stage
   (web auto-navigates the same way): remote video aspect-fit on `surface2`,
   camera-off placeholder ("{Name}’s camera is off" + `videoOff` glyph),
   remote-muted pill ("{Name} is muted"), remote-speaking meter pill,
   **draggable mirrored self-view** (16:9, `callPreview` width, defaults
   bottom-trailing), controls row at the bottom above the home indicator, and
   an optional **Messages pane** slot (chat while calling — the host injects
   the conversation UI; on iPhone the pane replaces the stage exactly like the
   web's mobile behavior).

Exact copy is ported from `getCallCopy` and the provider notices — headings
("{Name} is calling", "Calling {name}", "Connecting with {name}",
"Reconnecting with {name}", "In call with {name}", "You missed this call",
"Call declined", "Call cancelled", "The call didn’t connect", "Call ended"),
statuses ("Audio call. Answer when you’re ready.", "This usually takes a
moment.", "The call will continue when the connection returns.", "Your
microphone is muted.", "Messages are still available.", …) — with one wording
adaptation: permission guidance says "in Settings" instead of "in your
browser" (recorded under deviations).

Controls (all ≥ 44 pt targets, 20 pt glyphs, one primary action per view):

- **Incoming ring**: two-column grid — `Decline` (secondary, error border +
  error text, 56 pt) and `Answer` (success fill, on-primary text, 56 pt — the
  single emphasized action; `phone`/`video` glyph by kind). Single-flight,
  loading preserves geometry.
- **Outgoing ring**: quiet `Cancel` (secondary + error accents, 56 pt).
- **In call**: centered icon-button row — mute/unmute (with inline level meter
  on video), camera on/off + flip (video), speaker toggle (audio route),
  messages (chat slot toggle), settings (sheet: "Use less data" quality switch
  for video + audio-route note), end call (critical tone). While `connecting`,
  only **End call** shows (web parity).
- **Audio active**: the two-cell "Call activity" panel — You:
  Muted/Voice detected/Listening; {Name}: Muted/Speaking/Listening with the
  live level meter — `surface2` well, `divider` split, `control` radius.
- Notices render through the shared `Notice` component (calm `notice` tone,
  never alarming red); reduced motion collapses meter/entrance animation.

## Media plane (LiveKit Swift adapter)

Room configuration mirrors `call-media.ts` value-for-value:

- `adaptiveStream: true`, `dynacast: true`.
- Camera capture + publish at **720p** with **simulcast** enabled,
  degradation preference favoring resolution (web
  `degradationPreference: "maintain-resolution"`).
- Microphone publish with echo cancellation, noise suppression, and auto gain
  control; `autoSubscribe: true`; mute = disable the published mic track.
- Quality preference: `auto` → prefer HIGH publish/subscribe quality;
  `dataSaver` → reduced publish quality and ~360p remote request (persisted
  under the web's key semantics: `fish.video-quality-preference`).
- Events → `CallMediaEvents`: remote participant connected (→ `mediaConnected`
  the moment a counterpart is present — web parity), reconnecting/reconnected,
  unintentional disconnect (→ `callFailed(networkLost)`), remote mute changes,
  local/remote video availability, speaking levels (timer-driven monitor with
  the web's smoothing: attack 0.35 / release 0.12, `audioLevel/0.3`
  normalization, ≥ 0.025 activity threshold, 250 ms hold, change-deduped).
- iOS-specific session handling (no web equivalent): `AVAudioSession`
  voice/video chat modes, receiver output for audio calls with a speaker
  toggle, speaker default for video calls, interruption → surfaced through the
  reconnecting path, camera flip front/back, idle-timer disabled while a video
  call is on screen.

**Highest available quality** = 720p capture/publish + simulcast layers +
adaptive stream + dynacast, so the SFU serves the best layer the device and
network sustain without destabilizing the call — identical policy to web.

## Permissions and app integration

- First permission strings in the repo (Catalog `project.yml`
  `info.properties`, sentence case, calm):
  - `NSMicrophoneUsageDescription` — "FISH uses your microphone so you can
    talk during calls."
  - `NSCameraUsageDescription` — "FISH uses your camera so your coach can see
    you during video calls."
- `UIBackgroundModes: [audio]` so an active call keeps its audio when the app
  backgrounds (the platform analog of the web tab staying open).
- Permission is requested only from the explicit Call/Answer gesture, exactly
  like web (`permissionRequested` → prompt → denied/unavailable notices with
  the ported copy). Simulator camera unavailability maps to the web's
  "no device" notice path.
- Entry points (`CallEntryButtons`, the `CallButton` port) mount in the chat
  top bar in the catalog host — two quiet icon buttons ("Voice call {name}",
  "Video call {name}") — ready to mount in any future conversation shell.

## Call flow summary (who talks to what)

```text
Caller taps Call → permission → POST call-command {initiate}
  → row(ringing, expires 45 s) → broadcast wakeup (or poll) on both sides
Callee panel rings → Answer → permission → POST {accept} → token
  → LiveKit room connect (mic[, camera])
Caller wakeup sees connecting + initiatedBy==me → POST {join} → token
  → LiveKit room connect
Webhook flips connecting→active when both joined; clients also flip on
  remote-participant-connected. Mute/camera are local track ops.
End/Decline/Cancel → POST {end|reject|cancel} → terminal broadcast both sides
  → media disconnect → terminal panel → auto-clear after 5 s
Missed: server sweeper flips ringing→missed at expiry; clients pick it up via
  wakeup/poll/recovery. Reload/foreground recovery: findCurrentCall → re-join.
```

## Edge cases (each has a test or a documented manual check)

| Case | Behavior (mirrors web) |
| --- | --- |
| Second incoming call while live | Reducer ignores foreign `incomingCallReceived` while a live call exists; server would also refuse (`participant_busy`). |
| Start while live | Local guard notice "Finish the current call before starting another one." |
| Permission denied on start | `failed(permissionDenied)` + Settings-guidance notice; no call row created. |
| Permission denied on answer | Stays ringing + notice, retry allowed. |
| No device (simulator camera) | `deviceUnavailable` path — "We couldn’t find a camera and microphone. Check your devices and try again." |
| Accept races cancel/expiry | Server CAS decides; `accept` on a missed call returns `call_already_finished` → "This call has ended." |
| Stale realtime events | Reducer no-ops by `callId`; wakeups always re-read the row. |
| Reconnection | LiveKit resume/ICE restart → `reconnecting` (only from `active`) → `reconnected`; unintentional disconnect → `failed(networkLost)`. |
| Command failure / timeout | 15 s request timeout; `{code, error}` mapped to calm notices; fallback "Calling is taking a break. Messages still work." |
| Backgrounding mid-call | `audio` background mode keeps the session; on return, recovery re-syncs state. |
| PSTN interruption | Audio session interruption surfaces as reconnecting; ends cleanly if the room drops. |
| Token expiry (5 m TTL) | Connect uses a fresh token from `accept`/`join`; rejoin path requests a new one — never cached. |
| Identity change / teardown | `identityChanged` reset + media disconnect (web unmount parity). |
| Mute/camera while not live | Reducer guards ignore. |
| Terminal panel | Auto-clears after 5 s; no scolding copy; messages remain available. |

## Testing strategy

Automated (all runnable headless; commands are the repo's existing gates):

1. **Cross-platform reducer conformance** — shared JSON vectors replayed by
   vitest (web) and Swift Testing (iOS); byte-identity drift check between the
   canonical fixture and the bundled copy. Covers every event, every guard,
   and the races above.
2. **`CallSessionModel` behavior** (Swift Testing, fake providers, injected
   clock): outgoing/incoming happy paths, caller-join-on-connecting, busy
   guard, permission denial copy, command-failure notices, recovery
   hydration, single-flight connect, terminal auto-clear, media teardown.
3. **`EdgeFunctionCallCommands`** (URLProtocol stubs): request body/headers
   (action unions, auth bearer), success decode (call ± connection), error
   decode (`{code,error}` → notice), malformed/HTML fallback, timeout config.
4. **Copy conformance** — exact-string tests against the web sources for
   headings, statuses, notices, and control labels.
5. **Snapshot tests** (light/dark on iPhone 13 + AX-XL + RTL for key states):
   incoming/outgoing prompts, connecting, active audio (meter states),
   reconnecting, terminal, video stage (camera off, remote muted, chat open),
   settings sheet, entry buttons.
6. **Catalog UI + accessibility audit** — new pages (Call states gallery,
   scripted interactive demo, live lab) join the existing
   `performAccessibilityAudit` sweep; VoiceOver labels/traits asserted in
   component tests.
7. **Regression gates** — `pnpm ios:tokens:check`, `pnpm ios:guard`,
   `pnpm ios:test`, `pnpm ios:catalog`, plus web `pnpm lint`,
   `pnpm typecheck`, `pnpm build` and the vitest suites (core fixtures are a
   new web test), keeping cross-workspace health proven.

Manual (requires hardware/accounts; scripted in the live lab):

- Two-party audio and video calls against the local stack
  (`pnpm supabase:start` + `pnpm dev:livekit` + `pnpm dev`, seeded
  `coach@fish.dev`/`client1@fish.dev`) — device ⇄ web browser.
- Real-device matrix: microphone/camera permission prompts, receiver vs
  speaker routes, Bluetooth route change, camera flip, backgrounding,
  PSTN interruption, network switch Wi-Fi ⇄ cellular, thermal/battery
  observation on long video calls.

## Platform limitations, deviations, and recommendations

Documented up front; the full list with rationale lives in the closing section
of this document and must ship with the feature:

1. **Incoming calls ring only while the app is open with an active session**
   (web has the identical limitation for a closed tab). Production ringing
   needs APNs + PushKit/CallKit — a dedicated milestone.
2. **Realtime wakeups poll in the foreground** until the `supabase-swift`
   Realtime adapter lands (protocol seam already in place). The durable-row
   recovery path is the same one web relies on after missed events.
3. **No auth on iOS yet** — the live control-plane adapter takes an injected
   session (dev lab); the fixture providers drive all UI/testing. This is the
   established FishKit staging, not a calling-specific gap.
4. **Lesson calls and the pre-lesson media check are web-only** until iOS has
   a booking surface.
5. **Microphone picker → system audio routes**: iOS manages input with the
   active route; the web's mic dropdown becomes a speaker toggle (+ system
   route behavior), which is the platform-correct equivalent.
6. **Additions with no web counterpart**: camera flip, speaker toggle,
   audio-session/interruption handling, idle-timer management — required by
   the platform, kept visually quiet.
7. **"Hear call" autoplay recovery is web-only** (no autoplay policy on iOS).
8. **Self-view PiP** supports drag (with edge clamping); web's pointer-edge
   resize is not ported (no hover affordance on touch) — size uses the
   `callPreview` token.
9. **CallKit** integration (system call UI, lock-screen answer, call
   directory) is recommended alongside push in the production shell milestone;
   adopting it earlier would couple the catalog to entitlements it cannot use.

## Implementation order

1. Token manifest additions + regeneration (iOS + Android) + icon assets.
2. `packages/core` call-state fixture vectors + web replay/drift tests.
3. `CallData` module: models, reducer/selectors port, provider protocols,
   URLSession adapters + tests (vectors, decoding, request shapes).
4. `Calls` module: copy, media port, `CallSessionModel`, panel/stage views,
   overlay/screen presentations + behavior/copy/snapshot tests.
5. `CallMediaLiveKit` adapter (SDK dependency added to `Package.swift`).
6. `TestSupport` fixtures/fakes; Catalog pages, `project.yml` permissions +
   background mode; guard-script module rules.
7. Full gate run (iOS + web), snapshot baselines, manual-lab notes.
8. Final documentation pass (this file's limitations section is the record).
