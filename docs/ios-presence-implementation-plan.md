# Native iOS (SwiftUI) presence indicator plan

Status: implemented (2026-07-17) — see "As-built notes" at the end. Parity target: the shipped web presence feature
(`apps/web/features/presence/`) and the shipped Android native implementation
(ADR 0004, `apps/android/data/presence/` + `apps/android/feature/presence/`).
This plan adds no backend changes: migrations `0034`, `0035`, `0048` and the
`presence-command` Edge Function are the deployed, shared contract.

Everything in sections 1–2 is **confirmed by reading the code**. Assumptions
and open product/design questions are collected in section 12 and marked
inline as *(assumption)* where they first appear.

---

## 1. How the web feature behaves today (confirmed)

### 1.1 Model

Shared contract in `packages/core/src/presence/types.ts` + `resolve.ts`:

- **User preference** (`presence_preferences.mode`): `automatic | away | busy | invisible`,
  with optional `expires_at`. Durations are a fixed allowlist:
  **15 m (900), 1 h (3 600), 8 h (28 800), 24 h (86 400), 3 d (259 200), or Forever (null)** —
  validated in the Edge Function *and* in `set_presence_mode` SQL.
- **Effective status** (`presence_snapshots.status`): `online | idle | away | busy | offline`.
  Derived **server-side** by `private.refresh_presence_snapshot`:
  - `invisible` → `offline` with `last_heartbeat_at`/`last_seen_at` **nulled** (privacy: no
    last-seen leaks).
  - no fresh session (heartbeat within **90 s**, not ended) → `offline`.
  - fresh + preference `away`/`busy` → that status.
  - fresh + `automatic` → `online` if any session was active within **5 min**, else `idle`.
  - expired preference is treated as `automatic` (since 0048).
- **Snapshot**: `{ userId, status, lastHeartbeatAt?, lastSeenAt?, revision, updatedAt }`.
  `revision` increments monotonically per user and is the client's ordering key.
- `packages/core/src/presence/resolve.ts` is the executable spec of the SQL
  derivation (constants `PRESENCE_HEARTBEAT_MS = 30_000`, `PRESENCE_STALE_MS = 90_000`,
  `PRESENCE_IDLE_MS = 300_000`); no app code calls it at runtime.

### 1.2 Who can see whom

`private.can_view_presence(viewer, subject)`: self, or (not blocked) ∧
(friends ∨ coach–client pair). `list_visible_presence()` returns snapshots for
the whole visible set — including **synthetic offline rows (revision 0)** for
trusted subjects who have never had a session, so clients can subscribe before
first data. It also re-masks staleness at read time (heartbeat older than 90 s
→ reported `offline`).

### 1.3 Session + heartbeat (write path)

`apps/web/lib/services/supabase/presence-realtime.ts` `startSession()`:

- One client-generated UUID session per page lifetime; RPC
  `touch_presence_session(p_session_id, p_activity, p_ended)` immediately on
  start, then every **30 s**. The RPC upserts the session row, garbage-collects
  the user's dead sessions, refreshes the snapshot under a per-user advisory
  lock, and returns the caller's own snapshot.
- **Activity** is tracked locally (`pointerdown/keydown/scroll/focus`,
  visibility→visible, network→online). Ordinary activity just bumps a version
  that piggybacks on the next heartbeat (`p_activity=true`); a return from
  ≥5 min idle forces an immediate heartbeat.
- Failure: single-flight writes, retry backoff **5 s → 10 s → 30 s** (then 30 s
  repeating), one operational report per failure streak, `onError` surfaces the
  reconnecting notice.
- Teardown (`pagehide`/unmount/sign-out): best-effort final
  `p_ended=true`; failures during teardown are deliberately not reported.
- Server-side coalescing (0048): the snapshot row only rewrites when status
  changes or heartbeat advances ≥ **60 s** — so a healthy peer's visible
  `lastHeartbeatAt` can legitimately be up to ~89 s old. **Client staleness
  thresholds must stay at 90 s; tightening them would flap.**

### 1.4 Realtime (read path)

`subscribe(userId, subjectIds, …)` opens:

- **Private broadcast channel `presence:user:{userId}`** (requires
  `realtime.setAuth()`; RLS on `realtime.messages` restricts to own topic):
  - `presence.preference.changed` `{ mode, expiresAt?, revision, updatedAt }` —
    own preference changed (any device).
  - `presence.subjects.changed` `{ reason, occurredAt }` — friendship /
    coach-assignment / block changed (DB triggers); client refreshes the roster.
- **Snapshot channels**: `postgres_changes` on `public.presence_snapshots`
  filtered `user_id=in.(…)`, **chunked 100 ids per channel**, topic
  `presence:snapshots:{userId}:{randomUUID}:{index}`. Per-event authorization is
  the table's RLS (revoked relationships stop receiving events server-side).
- Connection accounting: **connected only when every channel is subscribed**;
  any drop → `disconnected` → notice "Status is reconnecting. We'll keep
  trying."; on recovery → clear notice, `markActive()`, full refresh.
  The per-viewer snapshot broadcast fanout from 0034 was **removed in 0035** —
  postgres_changes is the only snapshot delivery path.

### 1.5 Client state rules (`presence-provider.tsx`)

- Snapshot map keyed by userId; merge only if `incoming.revision > current.revision`.
- Snapshots accepted only for self + the visible-subject allowlist from the
  last `listVisible()`; roster changes rebuild subscriptions (subject-set key).
- A **15 s presentation clock** re-renders relative labels and re-applies the
  staleness rule.
- **Local staleness guard** (`model/presentation.ts`): a non-offline snapshot
  whose heartbeat is missing/invalid or older than 90 s renders as `offline`
  (defense against missed realtime events).
- **Optimistic preference change**: single-flight; apply setting locally, call
  the `presence-command` Edge Function (15 s timeout), on success adopt the
  returned `{snapshot, setting}` + revision; on failure roll back and show the
  server's calm notice (fallback: "Your status could not change. Try again.").
- **Expiry**: a timer reverts the local setting to `automatic` when
  `expiresAt` passes (web additionally fires `setPreference("automatic")`; the
  server independently expires it — see decision D6).
- `useOwnPresence()` display status: preference wins for `invisible/away/busy`
  (shown as Invisible/Away/Do not disturb even while the snapshot lags);
  `automatic` shows the resolved status (optimistically `online` while a change
  is in flight).

### 1.6 Presentation

Labels: Online, Idle, Away, **Do not disturb** (busy), Invisible (self only),
Offline. Detail line **only when offline and `lastSeenAt` exists**:

- < 1 h → "Last seen N minute(s) ago" (min 1)
- < 24 h and same local day → "Last seen N hour(s) ago"
- start-of-day difference exactly 1 day → "Last seen yesterday at {time}"
  (12/24 h per stored profile pref on web)
- else → "Last seen on {Mon D, YYYY}"

Icons + colors (`presence-indicator.tsx`): status is **glyph + color, never
color alone** — filled circle/green (online), filled moon/amber (idle),
clock/orange (away), circle-minus/red (busy), eye-off/grey (invisible),
outline circle/grey (offline). Tokens `--color-presence-*` exist in
`design/tokens/fish.tokens.json` for all platforms.

### 1.7 Surfaces

- `PresenceProvider` wraps the authenticated layout (`app/(authenticated)/layout.tsx`).
- **Chat header** (1-on-1): `PresenceAvatar` (badge dot, 8 px, on a `bg-surface`
  ring) + status label as subtitle.
- **Friends list**: `PresenceSummary` (14 px glyph + label); **friend detail** and
  **coach client detail**: `PresenceSummary showLastSeen`.
- **User menu** (self): avatar badge trigger → drill-down **Account → Status →
  Duration**; Automatic applies immediately, Away/DND/Invisible ask for a
  duration; rows disabled while a change is in flight; notice rendered inside
  the menu; `aria-current` on the active choice.

## 2. Starting points (confirmed)

### 2.1 Android — the native reference (ADR 0004, accepted 2026-07-17)

`:data:presence` (models, repository, Supabase adapter) + `:feature:presence`
(formatter, ViewModel, indicator/avatar/summary, account sheet). Decisions that
bind iOS too, per the ADR's cross-platform intent:

- Availability = **process visibility**: started/visible app maintains the
  session; fully hidden app ends it best-effort; process death is covered by
  the 90 s server cutoff. No background service, no push wake-ups, no
  persistence — presence state is in-memory only.
- One random per-process session id; all writes serialized; revision-ordered
  merges; authoritative `listVisible()` refresh on every (re)connect;
  channel rebuild when the subject set changes.
- Feature layer owns the 15 s clock, local stale/expiry rules, optimistic
  commands, locale formatting, and the account/status/duration sheet.
- Diagnostics may record only operation/result/duration/failure-category —
  never identifiers, modes, or timestamps.
- Constants identical to web: 30 s heartbeat, 90 s stale, 5 min idle, 15 s
  clock, retries 5/10/30 s, realtime retry 5 s, end-session timeout 3 s,
  command timeout 15 s, snapshot chunk 100.

### 2.2 iOS — what exists and what is missing

Exists (from the personal-chat foundation + calling milestones):

- `PersonalChat/Models/PersonalChatUiModel.swift` defines
  `PresenceTone { online, idle, away, busy, offline }` and
  `PresenceUiModel { label, tone }`; `PersonalChatTopBar` renders a **static**
  6 pt dot (`Spacing.nudge`) + label; fixtures/catalog/a11y audit cover
  "Online"/"Offline" states.
- All five presence colors are generated (`Palette.presenceOnline…Offline`)
  with ≥3:1 contrast tests in `DesignSystemTests/ContrastTests.swift`.
- The data-layer blueprint: `CallData` (Models / Providers / Adapters / State,
  protocol ports, URLSession adapters, `CallBackendConfiguration` with an
  injected `accessToken` closure), `TestSupport` scripted fakes, catalog live
  lab (`LiveCallLab.swift`) with `FISH_SUPABASE_*` keys and seeded dev users.
- Gates: `pnpm ios:test`, `ios:catalog`, `ios:guard`, `ios:tokens(:check)`.

Missing:

- **No Supabase SDK and no websocket realtime anywhere** — calls poll
  (`PollingCallRealtime`) and the calling plan records "until the
  `supabase-swift` Realtime adapter lands (protocol seam already in place)".
- **No app-lifecycle plumbing** (`scenePhase` is unused today) and **no auth
  layer** (the live lab injects a dev session) — presence introduces the first
  lifecycle observer and consumes the same injected-session staging.
- `presenceIndicatorSmall: 14` exists only in the Android `sizeDp` token block,
  **not** in `sizePt` — the iOS `Metrics` enum lacks it (hence the hardcoded
  6 pt dot).
- No localization infrastructure (hardcoded English is the convention).

## 3. Requirements for iOS

### Functional (parity with web/Android behavior)

- FR1 Maintain own presence while the app is in the foreground: session start
  on foreground/auth, 30 s heartbeats, activity piggyback, immediate heartbeat
  on return-from-idle (≥5 min), best-effort `ended=true` on background and on
  sign-out.
- FR2 Show each visible subject's status (glyph + color + label) and, when
  offline, the last-seen detail with the exact copy tiers of §1.6.
- FR3 Apply the 90 s local staleness guard and the 15 s presentation clock.
- FR4 Receive realtime snapshot updates, preference changes, and roster
  changes; refresh authoritatively on every (re)connect; rebuild subscriptions
  when the subject set changes; revision-guard all merges.
- FR5 Self-status control: Account → Status → Duration drill-down with the
  four preferences, six durations, optimistic apply + rollback + calm notice,
  disabled-while-updating, auto-dismiss on confirmation.
- FR6 Own display status derives preference-first (invisible/away/busy shown
  immediately; automatic shows resolved status).
- FR7 Local expiry of timed modes back to Automatic (server remains the
  authority — D6).
- FR8 Reconnecting state surfaces a calm notice; recovery clears it silently.
- FR9 Privacy: never render last-seen for privacy-sanitized (invisible)
  snapshots; diagnostics carry no identifiers/modes/timestamps.
- FR10 Unconfigured builds (no Supabase keys) degrade to a no-op repository
  with calm copy ("This build is not connected yet." — Android precedent).

### Technical (repo constraints, all confirmed conventions)

- Swift 6 strict concurrency; every UI-facing model `Sendable`; stateless
  views (models in, closures out); no provider types outside the adapter.
- Tokens only (guard-script enforced); status never color-alone; 44 pt touch
  floor; reduced-motion honored; sentence-case calm copy; `notice` tone for
  errors (never alarming red).
- Module boundaries mirror `CallData`/`Calls`: data target without UI imports,
  feature target consuming it, TestSupport fakes, catalog-only live wiring.
- Swift Testing (`@Test`/`#expect`); snapshot tests light/dark + AX-XL/RTL via
  the existing `SnapshotSupport` helpers; catalog accessibility audit pages.

## 4. Proposed iOS architecture and data flow

Two new SPM targets in `apps/ios/FishKit/Package.swift`, mirroring the
CallData/Calls split:

```
DesignSystem ──► UIComponents ──► PersonalChat            (existing edges)
     ▲                ▲
     │                ├──────────► Presence  ──► PresenceData
     │                │             (feature)     (data, no UI imports)
     └────────────────┘
TestSupport ──► + PresenceData, Presence          (fixtures + fakes)
Catalog app ──► builds live adapter, owns lifecycle + lab wiring
```

### 4.1 `PresenceData` (new target; Foundation only)

`Models/PresenceModels.swift` — direct ports of the Android shapes:

```swift
public enum PresenceStatus: String, Sendable, Equatable { case online, idle, away, busy, offline }
public enum PresencePreference: String, Sendable, Equatable, CaseIterable { case automatic, away, busy, invisible }
public enum PresenceDuration: Sendable, Equatable, CaseIterable {
    case fifteenMinutes, oneHour, eightHours, oneDay, threeDays, forever
    public var seconds: Int? { … } // 900, 3_600, 28_800, 86_400, 259_200, nil
}
public struct PresenceSnapshot: Sendable, Equatable {
    public let userId: String
    public let status: PresenceStatus
    public let lastHeartbeatAt: Date?
    public let lastSeenAt: Date?
    public let revision: Int64
    public let updatedAt: Date
}
public struct PresencePreferenceSetting: Sendable, Equatable {
    public var preference: PresencePreference = .automatic
    public var expiresAt: Date? = nil
}
public enum PresenceConnectionState: Sendable, Equatable { case signedOut, connecting, connected, disconnected }
public struct PresenceCommandResult: Sendable, Equatable {
    public let snapshot: PresenceSnapshot
    public let setting: PresencePreferenceSetting
}
public enum PresenceCommandOutcome: Sendable, Equatable {
    case success(PresenceCommandResult)
    case failure(notice: String)     // calm server copy, or the local fallback
}
public struct PresenceState: Sendable, Equatable {
    public var currentUserId: String?
    public var snapshots: [String: PresenceSnapshot]
    public var ownPreference: PresencePreferenceSetting
    public var preferenceRevision: Int64
    public var connection: PresenceConnectionState
}
```

`Providers/PresenceRemoteProviding.swift` — the port (analog of Android's
`PresenceRemoteDataSource` and `CallData`'s `*Providing` protocols):

```swift
public enum PresenceRealtimeEvent: Sendable {
    case snapshotChanged(PresenceSnapshot)
    case preferenceChanged(PresencePreferenceSetting, revision: Int64)
    case subjectsChanged
    case connected
    case disconnected
}
public protocol PresenceRemoteProviding: Sendable {
    func listVisible() async throws -> [PresenceSnapshot]
    func ownPreference() async throws -> PresencePreferenceSetting
    func touchSession(id: String, activity: Bool, ended: Bool) async throws -> PresenceSnapshot
    func setPreference(_ preference: PresencePreference, duration: PresenceDuration) async throws -> PresenceCommandResult
    func realtimeEvents(userId: String, subjectIds: [String]) -> AsyncStream<PresenceRealtimeEvent>
}
```

`Logic/PresenceRepository.swift` — an **actor** (`DefaultPresenceRepository`)
owning the session loop; public surface mirrors Android exactly:

```swift
public protocol PresenceRepository: Sendable {
    var state: AsyncStream<PresenceState> { get }   // replay-1 semantics
    func setAppForegrounded(_ foregrounded: Bool)
    func markActive()
    func setPreference(_ preference: PresencePreference, duration: PresenceDuration) async -> PresenceCommandOutcome
    func endSession() async                          // sign-out hook
}
```

Behavior (all pinned by tests, §11): one `UUID().uuidString` session per
process; driver reacts to (authenticated userId × foregrounded); heartbeat
loop = 30 s timer raced against an immediate-heartbeat channel; activity
version piggyback; retry backoff 5/10/30 s under a write mutex (single-flight,
end-request queued behind an in-flight write); authoritative refresh on
connect/subjects-change with higher-revision-wins merge; revoked subjects
dropped and late events for them rejected; background → best-effort
`ended=true` within a 3 s timeout, state keeps snapshots but marks
`.disconnected`; sign-out → `endSession()` then reset to `.signedOut`.
Injectable `now: @Sendable () -> Date`, `sleep: @Sendable (Duration) async throws -> Void`,
and session id — deterministic tests, mirroring Android's injected
`nowMs`/`delayMs` and `CallData`'s testability.

`Diagnostics/PresenceDiagnostics.swift`: `operation × succeeded × duration ×
failureCategory` only (ADR 0004 privacy rule); no-op default.

`Adapters/` — the live implementation (§5) plus
`UnconfiguredPresenceRepository` (FR10).

### 4.2 `Presence` (new feature target; depends on PresenceData, UIComponents, DesignSystem)

- `Logic/PresenceFormatter.swift` — pure port of Android's
  `PresenceFormatter` / web `presentation.ts`: preference-first own display,
  90 s stale override, labels, last-seen tiers via `Calendar`/`Locale`
  (system 12/24 h handling — D7), producing
  `PresencePresentation { status: PresenceDisplayStatus, label, detail? }`
  where `PresenceDisplayStatus` adds `.invisible` for self.
- `ViewModels/PresenceModel.swift` — `@MainActor @Observable` (the analog of
  Android's `PresenceViewModel` and calls' `CallSessionModel`): consumes
  `repository.state` + a 15 s clock (injectable stream), exposes
  `PresenceUiState` with `presentationFor(userId:) -> PresencePresentation`,
  own presentation, `updating`, `notice`, connection; optimistic
  `setPreference` guarded by a mutation token (base-revision check so a
  superseding realtime broadcast wins), local expiry revert, and a
  `preferenceConfirmed` signal for sheet auto-dismiss.
- `Views/PresenceIndicator.swift`, `PresenceAvatar.swift`,
  `PresenceSummary.swift` — glyph+color indicator (14 pt via new
  `Metrics.presenceIndicatorSmall`), avatar with bottom-trailing badge on a
  `Palette.surface` ring, summary row (label + optional detail). Decorative vs
  labelled accessibility modes exactly as Android.
- `Views/PresenceAccountSheet.swift` + `PresenceAccountTrigger.swift` — the
  three-page sheet (Account / Status / Duration) and the avatar trigger
  (≥44 pt target, merged label "{name}, {status}, account and status").

### 4.3 Data flow

```
scenePhase / auth ─► PresenceRepository (actor) ─► PresenceState stream ─► PresenceModel (@Observable)
touches/keys      ─► markActive()                                          │ 15 s clock, formatter
                                                                            ▼
   PersonalChatScreen (stateless, unchanged seam) ◄─ host maps PresencePresentation → PresenceUiModel
   PresenceAccountTrigger/Sheet ◄─ own presentation + setPreference
```

The host (catalog lab today, product shell later) binds `PresenceModel`
output into `PersonalChatUiModel.presence` and hosts the trigger/sheet —
`PersonalChat` stays stateless and does **not** import `Presence`
(mirrors Android, where `ChatRoute` does the binding).

## 5. Backend / API integration (no backend changes)

| Call | Transport | Contract |
| --- | --- | --- |
| `touch_presence_session(p_session_id, p_activity, p_ended)` | PostgREST RPC | snake_case body; returns own snapshot row (snake_case) |
| `list_visible_presence()` | PostgREST RPC | returns snapshot rows incl. synthetic revision-0 offline rows |
| `presence_preferences` own row | PostgREST `select mode, expires_at` limit 1 | expired → treat as automatic client-side |
| `presence-command` | Edge Function POST `{ mode, durationSeconds }` (camelCase) | 15 s timeout; success `{ snapshot, setting }` camelCase; error `{ code, error }` calm copy passthrough |
| Preference/roster events | Realtime **private** broadcast `presence:user:{uid}` | events `presence.preference.changed`, `presence.subjects.changed`; requires realtime auth token |
| Snapshot events | Realtime `postgres_changes` on `public.presence_snapshots`, filter `user_id=in.(…)` | chunk 100 ids/channel; topic `presence:snapshots:{uid}:{uuid}:{index}`; RLS per event |

**Transport decision (D1, recommended): adopt `supabase-swift` inside
`PresenceData/Adapters` only.** Android proved the identical channel contract
on supabase-kt; the calling plan already reserved this seam. The SDK stays
invisible outside the adapter (foundation-plan rule: provider types never
reach feature/view code). The catalog lab constructs the client, signs in with
the existing seeded dev accounts (`FISH_SUPABASE_EMAIL/PASSWORD`), and passes
the repository in — same staging as `LiveCallLab`. *(Assumption to verify in
the Phase 0 spike: supabase-swift Realtime V2 supports private broadcast
channels (`isPrivate`), `postgres_changes` with an `in.(…)` filter of 100 ids,
and `setAuth` token propagation, under Swift 6 strict concurrency. supabase-kt
parity makes this very likely but it is unverified in this repo.)*

Fallback if the spike fails: `PollingPresenceRemote` — foreground polling of
`list_visible_presence` + own preference every 30 s over URLSession (the
`PollingCallRealtime` precedent). The port protocol makes the swap invisible
to every other layer; latency and roster-change lag are the documented cost.

Auth staging: unchanged from calling — **no iOS auth layer yet**; the live
adapter takes an injected session/token closure
(`CallBackendConfiguration.accessToken` pattern). Production auth is a
separate milestone; fixtures drive everything else.

## 6. UI states, interactions, accessibility

States (all in fixtures + snapshots):

1. Indicator per display status × light/dark × AX-XL type × RTL.
2. Avatar badge per status (ring on `surface`).
3. Summary: label only; label + each last-seen tier (minutes / hours /
   yesterday / date); privacy-sanitized offline (no detail).
4. Top bar: presence live label; `presence == nil` (unknown participant —
   existing `unavailable` fixture).
5. Account sheet: Account page (avatar, name, status row, sign-out ghost);
   Status page (4 options, current selected, radio semantics); Duration page
   (6 options); `updating` (rows disabled + "Updating status…" polite
   announcement); command-failure notice; reconnecting notice.
6. Reconnecting: calm notice copy (D3); own indicator meanwhile shows
   preference-derived status.

Interactions: trigger tap → sheet; Automatic commits immediately; other
statuses drill into Duration; selection commits optimistically and the sheet
auto-dismisses on confirmation; failure keeps the sheet open with the notice;
no destructive actions.

Accessibility (floor from the foundation plan, patterns from Android):

- Decorative indicators hidden from VoiceOver; labelled ones expose the status
  label. Avatar merges "{name}, {label}". Summary merges "{label}, {detail}".
- Status rows: `.isSelected` trait for the active preference, ≥44 pt targets,
  Dynamic Type scaling of labels (glyph stays 14 pt fixed — Android parity).
- Sheet pages announce titles; "Updating status…" and notices are polite
  announcements, not focus steals; reduced motion: standard sheet transitions
  only, no pulsing/animated dots anywhere.
- Contrast: presence colors already pass ≥3:1 on `surface` in both themes
  (existing `ContrastTests`); glyph shapes keep status legible without color.
- Catalog audit: new pages join `CatalogAccessibilityAuditTests.pages`.

## 7. Realtime synchronization and lifecycle

- **Foreground definition (D4)**: `scenePhase == .active || .inactive` ⇒
  foregrounded; `.background` ⇒ backgrounded. This is the iOS analog of
  Android's STARTED (which deliberately includes PiP). Observed once at the
  app entry point (catalog root today) via `.onChange(of: scenePhase)` —
  the first lifecycle plumbing in the iOS tree.
- Foreground → repository starts/resumes: initial touch (`activity=true`),
  refresh, subscribe realtime, refresh again (gap coverage), heartbeat loop.
- Background → best-effort `ended=true` (3 s budget; iOS grants ~5 s of
  runway before suspension), connection marked `.disconnected`, snapshots
  retained for instant redisplay. Suspension kills timers naturally — the
  heartbeat loop only runs while foregrounded, so no BGTask machinery
  (ADR 0004: no background execution, no push wake-ups).
- Re-foreground → same session id is resurrected (`touch` with `ended=false`
  clears `ended_at` server-side), realtime resubscribes, authoritative
  refresh reconciles anything missed. Process death needs nothing: the 90 s
  server cutoff flips the user offline.
- Activity signals: repository `markActive()` from user interaction. Catalog
  root installs a window-level gesture observer *(assumption: a simultaneous
  `DragGesture(minimumDistance: 0)` or `UIWindow.sendEvent` hook at the app
  boundary — to be settled in Phase 0; Android uses `dispatchTouchEvent`)*;
  scene re-activation also marks active (web's visibility analog).
- Reconnect semantics: `connected` only when **all** channels subscribe;
  every reconnect triggers refresh + `markActive` + notice clear; subject-set
  change tears down and rebuilds snapshot channels (Android's
  `RebuildRealtimeSubscription` loop); flat 5 s retry between realtime
  attempts.
- Multi-device: server aggregates sessions; revisions order updates; an iOS
  preference change reaches web via the broadcast and vice versa.
- Sign-out: host calls `repository.endSession()` **before** tearing down the
  token (Android's `onBeforeSignOut` hook), then state collapses to
  `.signedOut`.

## 8. Error, offline, and edge-case behavior

Each row lands as a unit/behavior test (§11) unless marked manual.

| Case | Behavior |
| --- | --- |
| Heartbeat failure | keep last state; retry 5/10/30 s; reconnect notice via connection state; report once per streak (diagnostics only) |
| Final `ended` write fails during teardown | swallow silently (web pins this exact behavior) |
| Realtime drops mid-session | notice; snapshots stay; refresh-on-reconnect reconciles; stale peers degrade to offline via the 90 s guard + 15 s clock |
| Device offline at launch | `listVisible` fails → calm degradation: connection `.disconnected`, empty roster, retry loop; UI renders offline states, never an error screen |
| Snapshot regression (lower/equal revision) | ignored |
| Late event for revoked subject | rejected (allowlist from last refresh) |
| Preference broadcast vs in-flight command | higher revision wins; superseded command result does not clobber |
| Timed mode expires while foregrounded | local revert to Automatic at `expiresAt`; server is authoritative (D6) |
| Invisible self | own UI shows Invisible; others see plain offline; **no last-seen detail ever** (nulled server-side) |
| Snapshot heartbeat up to ~89 s old (60 s coalescing) | still "fresh" — 90 s threshold is load-bearing, do not tighten |
| Clock skew (future heartbeat) | stays fresh; elapsed clamps at 0 (Android pins this) |
| Unknown wire enum (new server status) | decode failure → categorized `malformed`, event dropped, no crash (Android throws + drops; port the same) |
| Cold start, friend never seen | synthetic revision-0 offline row renders and is subscribable |
| Unconfigured build (no keys) | no-op repository; sheet's set-status fails calmly with "This build is not connected yet." |
| Backgrounded mid-command | command continues (async), result merges on return to foreground; manual check |
| In-call backgrounding | see D5 — recommended: keep the session alive while a call is active |

## 9. Files and modules

New (`apps/ios/FishKit/`):

- `Sources/PresenceData/PresenceData.swift` (module marker),
  `Models/PresenceModels.swift`,
  `Providers/PresenceRemoteProviding.swift`,
  `Logic/DefaultPresenceRepository.swift`,
  `Diagnostics/PresenceDiagnostics.swift`,
  `Adapters/SupabasePresenceRemote.swift`,
  `Adapters/PresenceBackendConfiguration.swift`,
  `Adapters/UnconfiguredPresenceRepository.swift`,
  `Adapters/PresenceWire.swift` (snake/camel DTOs + mappers).
- `Sources/Presence/Presence.swift` (marker),
  `Logic/PresenceFormatter.swift`,
  `Models/PresencePresentation.swift`,
  `ViewModels/PresenceModel.swift`,
  `Views/PresenceIndicator.swift`, `Views/PresenceAvatar.swift`,
  `Views/PresenceSummary.swift`, `Views/PresenceAccountSheet.swift`,
  `Views/PresenceAccountTrigger.swift`.
- `Sources/TestSupport/FixturePresenceProviders.swift` (scripted remote +
  repository fakes), `Fixtures/PresenceFixtures.swift`.
- `Tests/PresenceDataTests/…`, `Tests/PresenceTests/…` (suites in §11).

Modified:

- `apps/ios/FishKit/Package.swift` — two targets, two test targets,
  TestSupport deps; `supabase-swift` product dependency on **PresenceData
  only** (D1).
- `design/tokens/fish.tokens.json` — add `presenceIndicatorSmall: 14` to
  `sizePt` (+ regenerate: `pnpm ios:tokens`); Android `sizeDp` already has it.
- `apps/ios/FishKit/Sources/PersonalChat/Models/PersonalChatUiModel.swift` +
  `Views/PersonalChatTopBar.swift` — `PresenceUiModel` adopts the shared
  display vocabulary; top bar renders the shared glyph indicator instead of
  the plain 6 pt circle; optional `accountContent` trailing slot (D2).
- `apps/ios/FishKit/Sources/TestSupport/Fixtures/PersonalChatFixtures.swift` —
  presence fixtures move to the shared type.
- `apps/ios/Catalog/Sources/CatalogPages.swift` + `CatalogRoot`/`CatalogApp`
  (scenePhase + activity observer + lab wiring), new `PresenceLab` page
  (mirrors `LiveCallLab`), `Catalog/UITests/CatalogAccessibilityAuditTests.swift`
  (page list), `Catalog/project.yml` if new env keys are needed (reuses
  `FISH_SUPABASE_*`).
- `scripts/` guard config if module-boundary rules enumerate targets
  (`pnpm ios:guard`).

Explicitly untouched: all `supabase/` migrations and functions, web app,
Android app, `packages/core` (unless D8 is approved).

## 10. Phased breakdown (dependencies in parentheses)

- **Phase 0 — transport spike (½–1 day).** Minimal supabase-swift client in a
  scratch catalog page against the local stack (`supabase start`, seeded
  users): sign-in, `touch_presence_session` RPC, private broadcast receive on
  `presence:user:{uid}` after `set_presence_mode` from a web session, and a
  100-id `postgres_changes` subscription. Exit: D1 confirmed or fallback
  engaged; activity-observer approach picked. **Gates everything.**
- **Phase 1 — tokens (independent).** `sizePt.presenceIndicatorSmall`,
  regenerate, drift gate green.
- **Phase 2 — PresenceData core (after 0).** Models, wire DTOs, port
  protocol, repository actor with injected clock/sleep/session-id,
  diagnostics, unconfigured fallback. Tests: the five Android repository
  behaviors ported + DTO snake/camel + unknown-enum rejection.
- **Phase 3 — live adapter (after 2; parallel with 4).** supabase-swift
  wiring: RPCs, preference select, Edge Function invoke (15 s timeout, calm
  error passthrough), realtime channels with chunking + all-subscribed
  accounting + rebuild-on-subjects-change. Tests: request/decoding shapes
  (CallData wire-test style); live behavior via the Phase 6 lab.
- **Phase 4 — Presence feature (after 2; parallel with 3).** Formatter port
  (+ the web/Android test matrix), `PresenceModel` (clock, optimistic
  mutation, expiry, notices), indicator/avatar/summary views, account
  sheet/trigger. Snapshot + behavior tests.
- **Phase 5 — integration (after 1, 4).** PersonalChat model/top-bar swap,
  fixtures, snapshot re-baselines (visual review per repo rule), catalog
  pages + audit list, scenePhase + activity wiring in catalog root.
- **Phase 6 — live lab + verification (after 3, 5).** `PresenceLab` page
  (sign-in, live status vs a web session, set-status round-trip), full gate
  run (`pnpm ios:test`, `ios:catalog`, `ios:guard`, `ios:tokens:check`; web
  `pnpm build` untouched-but-verified), manual device checklist
  (backgrounding, re-foreground resurrection, multi-device vs web, in-call
  backgrounding), as-built notes appended to this doc.

## 11. Testing and rollout

Test inventory (names mirror the pinned behaviors on the other platforms):

- `PresenceDataTests/RepositoryTests` — heartbeat cadence + retry at
  5/10/30 s; foreground start (`activity=true`) / background end
  (`ended=true`); idle-return forces immediate activity heartbeat; revision
  ordering + revoked-subject rejection; preference supersession; sign-out
  reset; unconfigured fallback copy.
- `PresenceDataTests/WireTests` — snake_case row decode, camelCase command
  encode, broadcast payload decode, unknown enums rejected, calm-error body
  parse.
- `PresenceTests/FormatterTests` — stale/missing/future heartbeat handling;
  preference-first own display incl. invisible; every last-seen tier across
  local-day boundaries; sanitized snapshots produce no detail.
- `PresenceTests/PresenceModelTests` — optimistic single-flight, rollback +
  notice on failure, confirmation signal, local expiry revert, 15 s clock
  re-evaluation.
- Snapshots — indicator matrix, avatar badge, summary tiers, sheet pages ×
  light/dark + AX-XL/RTL (baselines eyeballed against
  `docs/ui-ux-agent-guidelines.md` before committing, per repo rule).
- Catalog audit — new pages pass `performAccessibilityAudit`; top-bar label
  expectation updates from static "Online" to the live-bound label.
- Backend unchanged — `scripts/verify-presence.ts` already covers RLS/RPC
  behavior; CI for iOS runs the existing `ios:*` gates.

Rollout: there is **no shipping iOS app yet** — "rollout" = FishKit modules +
catalog lab proof, identical to the calling milestone. No feature flag needed
(nothing user-facing ships); the backend is already live for web/Android, so
iOS adds only additive read/write load equivalent to one more web tab per
user. The deploy checklist gains no new steps (migrations + function already
listed). When the product shell milestone arrives, presence needs: auth
session wiring, the account-trigger placement decision (D2), and the
`onBeforeSignOut` hook — recorded here so that milestone inherits them.

## 12. Assumptions, gaps, and decisions needing input

Confirmed-vs-assumed: everything in §1–2 and the endpoint table is read from
code. The items below are the judgment calls.

- **D1 (technical, recommended: yes).** Adopt `supabase-swift` for the
  PresenceData adapter (Realtime + PostgREST + Functions), verified by the
  Phase 0 spike; polling fallback documented in §5. Also decides whether
  calls' `PollingCallRealtime` later migrates to the same client (out of
  scope here).
- **D2 (design).** Where does the self-status trigger live on iOS while the
  only surface is the chat screen? Recommendation: optional `accountContent`
  trailing slot on `PersonalChatTopBar` (Android's `ChatTopBar` precedent).
  Needs a design nod because the foundation plan forbids speculative slots —
  this one is consumed immediately by this feature.
- **D3 (product/copy).** Web and Android copy diverge: status descriptions
  ("Automatic while you use FISH." vs "Online while you are using FISH."),
  reconnect notice ("We'll keep trying." vs "Your chat is still here."), and
  the first option's name (web "Online" / Android "Automatic"). iOS should
  not mint a third variant — pick the canonical set (recommendation: web's,
  as the coach-validated original) and note whether Android should follow up.
- **D4 (product).** Foreground = `.active || .inactive` (recommended; matches
  Android's visible-includes-PiP stance) vs `.active` only (stricter, flaps
  during app-switcher peeks and permission dialogs).
- **D5 (product).** During an active call the app may run in background
  (audio mode): keep the presence session alive while a call session exists
  (recommended — the caller *is* present; closest analog to Android PiP
  staying STARTED), or strictly end on `.background` (simpler, but shows a
  mid-call user as Offline).
- **D6 (parity nit).** At local expiry web actively sends
  `setPreference("automatic")`; Android reverts locally and lets the server
  expire it. Recommendation: Android behavior (server is already
  authoritative since 0048; fewer writes); confirm no product expectation of
  the extra broadcast.
- **D7 (parity nit).** Web formats "yesterday at {time}" using the stored
  profile 12/24 h pref; iOS has no profile prefs yet — use the system
  locale/12-24 h setting (Android uses the system setting too). Revisit when
  profile preferences reach iOS.
- **D8 (optional hardening, cross-platform).** Presence has no shared fixture
  vectors (unlike call-state's byte-pinned `call-state-vectors.json` replayed
  on all three platforms). Adding `packages/core/src/presence/fixtures/` +
  replay tests (web formatter, Android formatter, iOS formatter) would pin
  parity permanently — touches web/Android, so it's a separate approval.
- **Gap (accepted repo staging, not new).** No iOS auth; live behavior is
  dev-lab only with injected sessions. Production presence rides the future
  app-shell/auth milestone.
- **Gap (backend, pre-existing).** Web relies on `pagehide` for the final
  `ended` write and iOS on the ~5 s background runway — both are best-effort;
  the 90 s cutoff is the real guarantee. No action.

## As-built notes (2026-07-17)

Everything above shipped as planned; these are the specifics resolved during
implementation.

- **D1 resolved: `supabase-swift` 2.52.0 adopted**, linked by `PresenceData`
  only. A live spike against the local stack verified every contract point
  before adoption: password sign-in, `touch_presence_session` and
  `list_visible_presence` RPCs, the **private** `presence:user:{id}` broadcast
  channel, `postgres_changes` with an `user_id=in.(…)` filter, and the
  `presence-command` Edge Function. The polling fallback was never needed.
- **Replication readiness matters.** The join ack alone does not guarantee
  WAL delivery — an event fired immediately after `subscribeWithError()` can
  be missed. The adapter therefore counts a snapshot channel as connected
  only on the Realtime **system ok** confirmation (`channel.system()`), the
  same rule the web client applies. The end-to-end check reproduced the
  missed-event bug before this fix and passes after it.
- **`SupabaseClient` is the configuration.** The planned
  `PresenceBackendConfiguration` was unnecessary — the signed-in client
  carries URL, key, and auth (token propagation to Realtime is automatic),
  so the adapter takes the client directly. The dev-lab seam is
  `PresenceLive.signIn(...)` in `PresenceData/Adapters/PresenceLive.swift`,
  which keeps SDK types out of the catalog and uses in-memory auth storage
  (no keychain, no persisted lab sessions).
- **Functions timeout**: the SDK has no per-invoke timeout, so the adapter
  races `presence-command` against the web-parity 15 s budget itself.
- **Wire format notes**: PostgREST decoding does **not** snake_case-convert
  (explicit `CodingKeys` on every row DTO), Postgres emits microsecond
  timestamp fractions (`PresenceTimestamp.parse` normalizes before
  `ISO8601DateFormatter`), and unknown wire enums fail decoding and drop the
  event — pinned by `PresenceWireTests`.
- **Simplification vs Android**: the repository is an actor, so Android's
  mutex pair collapses into single-flight flags; the final `ended` write runs
  on an unstructured task (cancellation-immune) raced against the 3 s budget,
  and waits for any in-flight heartbeat so the single-flight guard cannot
  swallow the end.
- **Sheet dismissal copy pin**: at local expiry the model reverts the
  preference to Automatic but the **effective own status comes from the
  snapshot again** — if the snapshot is stale (no heartbeat in 90 s) the
  owner reads Offline until the next heartbeat merges. Web behaves the same;
  the model test pins it.
- **Time formatting**: `Date.FormatStyle` separates day periods with a
  narrow no-break space (`11:30\u{202F}PM`) — modern browser `Intl` does the
  same, so the copy is byte-different from the plan's ASCII examples but
  platform-correct. The formatter pins locale, calendar, and time zone
  together so tests are deterministic in en_US/UTC.
- **Avatar badge**: the 14 pt indicator plate obscured initials on 32 pt
  avatars in the first recorded baselines; the badge is now corner-centered
  (`offset(Spacing.xs)`) with a `surface` ring, which keeps initials legible
  — caught by the mandatory visual review of recorded snapshots.
- **Verification run**: `pnpm ios:test` (repository behaviors ported from
  Android's five pins, wire tests, formatter/model tests, 18 new presence
  snapshot baselines light/dark + AX-XL/RTL, PersonalChat matrix re-recorded
  for the glyph indicator), `pnpm ios:guard` (new module rules for
  PresenceData/Presence, Supabase forbidden outside PresenceData),
  `pnpm ios:tokens:check`, `pnpm ios:chat-media:check`, and on web
  `pnpm lint`, `pnpm typecheck`, `pnpm build` — all green at hand-off. The
  `pnpm ios:catalog` audit walks every page including the new Presence page
  cleanly; the run still ends red on the **pre-existing, separately tracked**
  transcript issue from the calling milestone (the chat transcript can open
  away from its latest message; the mis-positioned viewport then yields one
  cascade contrast finding on a fold-clipped bubble fragment — element
  screenshot confirms no presence involvement). A headless
  end-to-end harness (scratch package driving `DefaultPresenceRepository`
  over the live adapter against the local stack with two seeded accounts)
  passes 8/8: connect, peer heartbeat via realtime, busy round-trip,
  server-side offline on backgrounding, snapshot retention, same-session
  resurrection, and sign-out reset.
- **Deferred, unchanged from the plan**: product auth/app-shell wiring
  (scenePhase + activity signals live in the catalog lab pages for now — a
  product shell should feed `markActive()` from a window-level gesture),
  D2's final trigger placement blessing, D3's cross-platform copy
  reconciliation (iOS ships the web-canonical set), and D8's shared fixture
  vectors.
