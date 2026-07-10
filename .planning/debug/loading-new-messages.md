---
status: diagnosed
trigger: "User reported verbatim: \"loading new messages is broken\" during UAT Test 1"
created: 2026-07-10T00:00:00+08:00
updated: 2026-07-10T10:26:00+08:00
---

## Current Focus

hypothesis: No current message-delivery failure is established. Two independent authenticated sessions rendered both synthetic messages exactly once without receiver refresh, including after fresh receiver restoration, but the controlled browser surfaces did not expose the raw WebSocket/request evidence required for a conclusive protocol result.
test: Record the two authenticated send/receive attempts, exact route and backing conversation identities, database rows, receiver DOM/count/scroll results, capture limitations, and the separate avatar/timestamp presentation observation.
expecting: Functional delivery remains not reproduced, while the overall protocol classification is inconclusive because raw WebSocket frames, callback status transitions, and HTTP response status were not exposed.
next_action: No delivery remediation in this plan. Scope the avatar/timestamp grouping behavior separately if a presentation change is desired.

## Symptoms

expected: Open /chat and confirm the screen still shows one assigned conversation, one send action, no conversation picker/menu, calm notice copy, and no obvious layout movement. Truth from UAT: loading new messages on /chat works as expected after the refactor.
actual: User reported verbatim: "loading new messages is broken".
errors: No runtime error supplied.
reproduction: Test 1 in UAT; discovered during UAT. Focus runtime loading/refresh/realtime path for newly arriving messages, including hooks, store hydration keys, subscriptions, and route rendering.
started: Discovered during UAT after the phase 09 refactor; exact onset not otherwise supplied.

## Eliminated

## Evidence

- timestamp: 2026-07-10T00:03:00+08:00
  checked: Phase 09 UAT, project STATE, and ROADMAP
  found: UAT Test 1 is marked issue solely from the report "loading new messages is broken", while the supplied diagnosis context says the loading behavior works after the refactor. Phase 10 is complete and introduced bounded newest-window hydration, cursor loading, realtime reconnect backfill, and ChatClient rendering changes.
  implication: The report is not sufficient to identify a failing mechanism; the current runtime path and its tests must be checked directly, with Phase 10 changes treated as likely integration boundaries.

- timestamp: 2026-07-10T00:06:00+08:00
  checked: /chat page, /channels/[id] page, ChatClient, useChatMessages, useChatRealtime, useLoadOlderMessages, Zustand store/selectors, and shared reducer/selectors/types
  found: /chat is only a redirect to the general channel; /channels/[id] gets one chat payload from getChatPageData and injects backfillMessagesAction/loadNewestMessagesAction. Realtime INSERT callbacks dispatch mergeRemoteMessage; the reducer merges by message id/client request id and sorts. useChatMessages hydrates initial state with a key based on messages/read states and selects store state after that key is recorded.
  implication: The central event-to-render path has matching conversationId plumbing and no immediate missing dispatch. The remaining high-value boundaries are the server payload/action row conversion, subscription authentication/filtering, and route/UAT mismatch.

- timestamp: 2026-07-10T00:09:00+08:00
  checked: realtime.ts subscription setup
  found: subscribeAfterAuth awaits one getSession() call, sets realtime auth only when that call returns a token, and otherwise immediately builds/subscribes the channel as the current client holds it. There is no auth-state listener, retry, or deferred build after a later session restoration. The file comment itself describes the anon-subscription failure mode.
  implication: A fresh-load session-restoration race is a concrete, falsifiable candidate for messages not arriving despite a SUBSCRIBED callback. It must be tested against the actual auth bootstrap and existing tests before being called root cause.

- timestamp: 2026-07-10T00:15:00+08:00
  checked: focused workspace test command for ChatClient/actions/store/core chat tests
  found: The combined pnpm Vitest command produced no output and did not complete within the test polling window; it was terminated without a result.
  implication: This run is inconclusive and cannot validate behavior. A narrower explicit Vitest invocation is needed; no product code was changed.

- timestamp: 2026-07-10T00:19:00+08:00
  checked: ChatClient test setup and `displays new messages received through realtime`
  found: The test passes (38/38), but it calls `realtimeMock.messageHandlers[0]` directly after render. The mocked browser client has channel/removeChannel/from only, no auth object; production getSession therefore throws into the catch branch under test. No test models getSession returning no session followed by a later session or verifies realtime.setAuth before build.
  implication: The suite proves reducer/render handling after a callback exists, not that an authenticated browser channel receives callbacks on a fresh load. This supports, but does not yet prove, the auth/subscription race hypothesis.

- timestamp: 2026-07-10T00:23:00+08:00
  checked: Resolved debug session `realtime-chat-not-updating.md` and installed `@supabase/auth-js@2.110.0`
  found: The prior exact symptom was caused by an anon realtime join and was fixed in commit `72ad5826` by the current `subscribeAfterAuth` helper. Current auth-js `getSession()` awaits `initializePromise` before reading the session, so the suspected “build before session restoration” race is not supported by the installed implementation. The prior session's reproduction and fix are historical evidence, not a current failure.
  implication: The previous root cause is eliminated for this checkout unless a different session/client construction path bypasses auth-js initialization. Investigate the render/scroll path and preserve the possibility that the UAT report is stale or refers to a different environment.

- timestamp: 2026-07-10T00:28:00+08:00
  checked: use-stick-to-bottom.ts, its focused tests, and ChatClient realtime tests
  found: The scroll hook keys new-message detection on the newest message identity, auto-scrolls near-bottom readers, raises the New messages pill for far-scrolled readers, and ignores prepended older pages. Focused tests passed: 3 scroll tests plus the ChatClient realtime insertion/offline subset; the full ChatClient file previously passed 38/38.
  implication: No store-to-visible-list or new-message scroll divergence was observed in the tested path.

- timestamp: 2026-07-10T00:30:00+08:00
  checked: current /chat and channel route/server rendering
  found: `apps/web/app/(authenticated)/chat/page.tsx` redirects `/chat` to the fixed `generalChannelHref`; `channels/[id]/page.tsx` ignores the dynamic id and renders `getChatPageData()`; `SupabaseChatRepository.getAssignedConversation()` prefers the fixed demo community conversation and returns `kind: "community"` when present. This is not the Phase 09 UAT's one assigned direct conversation contract.
  implication: Test 1 is not exercising the route described by its expected text. The mismatch can explain a misleading UAT report, but it does not prove that newly arriving messages fail in the community route.

- timestamp: 2026-07-10T00:31:00+08:00
  checked: current local test suite and runtime availability
  found: ChatClient, actions, store, core fixture tests passed (5 files, 56 tests); the focused new-message/scroll subset passed (5 tests). No local web server was listening on port 3001, and `supabase status` could not report service state because the CLI lacked permission to write its telemetry file. No live authenticated two-tab or websocket reproduction was available.
  implication: Local automated evidence supports the loading path, but the only remaining way to confirm a current failure is a real authenticated browser/Supabase session with channel status/error payloads.

- timestamp: 2026-07-10T00:35:00+08:00
  checked: current TypeScript sources with direct package-local `tsc --noEmit` for web, core, and Supabase packages
  found: All three package typechecks completed successfully. The root `pnpm typecheck` invocation itself produced no output and did not complete in the polling window, so it was terminated; the direct equivalent checks passed.
  implication: There is no compile-time error in the current chat loading path; this does not replace live websocket verification.

- timestamp: 2026-07-10T10:16:05+08:00 through 2026-07-10T10:18:36+08:00
  checked: two independent authenticated browser sessions using the seeded client receiver and coach sender, including a second attempt after navigating the receiver afresh through `/chat`
  found: Both synthetic coach messages were persisted in the backing conversation and rendered exactly once in the client DOM without a post-send refresh. The receiver remained pinned to the bottom, showed no `New messages` indicator, and had no unexpected scroll or layout shift. No realtime failure signal was observed, but the browser-control surfaces did not expose raw WebSocket frames, subscription callback statuses, or the sender HTTP response status.
  implication: The functional delivery failure was not reproduced. The protocol result remains inconclusive because its required WebSocket/request capture could not be completed, so no auth, realtime, route, store, or rendering delivery root cause is established.

- timestamp: 2026-07-10T10:18:36+08:00
  checked: receiver DOM rows for both synthetic messages and the current community-row grouping logic in `chat-client.tsx`
  found: Neither synthetic row contained an avatar image or `<time>` element. `groupedWithPrevious` compares only adjacent `senderId` values, and community avatars plus `MessageMeta` render only when a group starts (or a reply restates its author). There is no elapsed-time cutoff, so consecutive same-sender rows can suppress avatar and timestamp indefinitely.
  implication: Missing avatar/time is a separate presentation behavior, not evidence of a realtime delivery failure. Any grouping/layout change belongs in separately scoped work; this diagnostic plan does not edit production code.

## Resolution

root_cause: Not established. The functional delivery failure was not reproduced: both independent-session messages rendered exactly once without receiver refresh, including after fresh receiver restoration. The required raw WebSocket/request capture was not exposed, so the overall protocol classification is inconclusive.
fix: None. No production code or delivery boundary changed; the missing avatar/timestamp observation is deferred as separate presentation work.
verification: Focused ChatClient/actions/store/core tests and direct package typechecks passed. Local Supabase, seed, and web startup succeeded; both authenticated live attempts delivered exactly once with no receiver refresh, duplicate, indicator, or unexpected scroll/layout change. Raw WebSocket frames, subscription callback transitions, and sender HTTP response status were not exposed.
files_changed: [`.planning/debug/loading-new-messages.md` (evidence only)]

## Live reproduction protocol

This protocol is the remaining D-09/D-13/D-14 evidence gate. It observes the
current browser, Supabase, route, store, and rendering path without changing
product behavior. The completed attempts and final `root_cause: not established`
classification are recorded below.

### Scope and evidence safety

- Use only synthetic message text unique to this run, for example
  `realtime-check-YYYYMMDD-HHMMSS`. Do not copy real conversation content.
- Redact access tokens, refresh tokens, JWTs, `Authorization` values, cookies,
  passwords, and token-bearing request URLs before adding evidence here. Record
  an exposed token as `[REDACTED]`, not a partial token.
- Use the seeded account identities below, but obtain their local-only passwords
  from `apps/web/e2e/chat-send.spec.ts` (client) and `scripts/seed.ts` (coach).
  Never copy the passwords into this log.
- Do not edit `realtime.ts`, hooks, the Zustand store, route behavior, any
  Supabase/server boundary, or other production code in this plan. A failed or
  incomplete reproduction remains evidence, not permission to remediate.

### Deterministic local setup

From the repository root, prepare the current local stack in this order:

1. Run `pnpm supabase:start` and wait for the local Supabase services to be
   healthy. Record any startup failure as an observation.
2. Run `pnpm seed` so the local client/coach membership, conversation, and
   messages match the current checkout.
3. Run `pnpm dev` and use exactly `http://localhost:3001`. Do not substitute
   `127.0.0.1`, another hostname, or another port because the auth cookies are
   host-scoped and the project pins this origin.
4. Open two independent browser contexts, not two tabs sharing one cookie jar:
   - **Receiver:** `client1@fish.dev` (`client` role)
   - **Sender:** `coach@fish.dev` (`coach` role)
5. In each context, sign in and navigate explicitly through
   `http://localhost:3001/chat`. Record the final redirected URL, visible
   conversation/channel label, authenticated role label, and actual
   conversation id before treating the two contexts as valid. A route mismatch,
   missing auth session, missing membership, or unavailable local service is an
   observation to record, not a root cause.

### Capture before sending

In both contexts, open DevTools before the synthetic send:

1. In **Network**, enable preserved logs, select **WS**, open the Supabase
   Realtime socket, and retain its Messages/Frames view.
2. In **Console**, enable preserved logs. In the regular Network panel, also
   preserve the sender's chat write request and response status.
3. From the WebSocket join topics/frames, record the actual conversation id and
   the three channel names expected from the current boundary:
   `conversation:<conversationId>:messages`,
   `conversation:<conversationId>:reads`, and
   `conversation:<conversationId>:reactions`.
4. For each channel and each context, record every observable transition among
   `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, and `CLOSED`, with timestamps and
   any redacted payload. If DevTools exposes only raw `phx_join`/`phx_reply`,
   heartbeat, error, or close frames rather than callback status names, record
   those raw frame types and explicitly write `callback status not exposed`.
   Do not translate a frame into a callback status by assumption.
5. Record raw WebSocket error/close event code, reason, topic, and payload when
   exposed. If no such details are exposed, write `none exposed`; do not leave
   the field blank.

### Two send/receive attempts

**Attempt 1 — current authenticated sessions**

1. After all three channel joins have been captured, send one unique synthetic
   message through the coach UI.
2. Record the click/request timestamp, request URL boundary (without tokens),
   HTTP result, redacted response/error, and the sender's visible message state.
3. In the client context, wait without refreshing. Record whether the exact
   synthetic text appears in the DOM, how many matching rows exist, whether the
   transcript moved, whether the `New messages` indicator appeared, and whether
   scroll/layout state changed unexpectedly.

**Attempt 2 — fresh receiver restoration**

1. Reload only the receiver through `/chat`, then again record the final URL,
   conversation identity, role, and all three channel joins/status evidence.
2. Send a second unique synthetic message from the still-authenticated coach
   context.
3. Repeat the sender request and receiver DOM/count/indicator/scroll capture
   without refreshing the receiver after the send.

### Evidence record

Complete one row per attempt; use `none exposed` or `callback status not exposed`
where applicable rather than guessing.

| Field | Attempt 1 | Attempt 2 (fresh receiver load) |
|---|---|---|
| Capture start/end timestamps and timezone | `2026-07-10T02:16:05.389Z` → `2026-07-10T02:17:04.688Z` (UTC; Asia/Manila UTC+8). The end is the delayed observation time, not delivery latency. | `2026-07-10T02:17:16.816Z` → `2026-07-10T02:18:36.513Z` (UTC; Asia/Manila UTC+8). |
| Receiver identity and role label | `client1@fish.dev` / client; visible identity `Alex Rivera` | `client1@fish.dev` / client; visible identity `Alex Rivera` |
| Sender identity and role label | `coach@fish.dev` / coach; visible identity `Coach Dana` | `coach@fish.dev` / coach; visible identity `Coach Dana` |
| Receiver final URL after `/chat` | `http://localhost:3001/channels/22222222-2222-4222-8222-222222222222` | `http://localhost:3001/channels/22222222-2222-4222-8222-222222222222` after navigating afresh through `/chat`; Attempt 1 message present on the fresh SSR load |
| Sender final URL after `/chat` | `http://localhost:3001/channels/22222222-2222-4222-8222-222222222222` | `http://localhost:3001/channels/22222222-2222-4222-8222-222222222222` |
| Visible conversation/channel label | `# general`; route channel id `22222222-2222-4222-8222-222222222222` | `# general`; route channel id `22222222-2222-4222-8222-222222222222` |
| Actual conversation id | `11111111-1111-4111-8111-111111111111`, confirmed by the persisted message row; distinct from the route channel id | `11111111-1111-4111-8111-111111111111`, confirmed by the persisted message row; distinct from the route channel id |
| Messages channel name and initial evidence | `conversation:11111111-1111-4111-8111-111111111111:messages`; exact name derived from the confirmed backing conversation id and current `realtime.ts`; raw join frame not exposed | Same exact channel name; raw join frame not exposed after fresh receiver restoration |
| Messages status sequence (`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`) | callback status not exposed in either context; receiver console showed none of these status/error strings, and sender status capture was unavailable after its controlled tab closed | callback status not exposed in either context; receiver and sender consoles showed none of these status/error strings |
| Reads channel name and initial evidence | `conversation:11111111-1111-4111-8111-111111111111:reads`; exact name derived from the confirmed backing conversation id and current `realtime.ts`; raw join frame not exposed | Same exact channel name; raw join frame not exposed after fresh receiver restoration |
| Reads status sequence (`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`) | callback status not exposed in either context; receiver console showed none of these status/error strings, and sender status capture was unavailable after its controlled tab closed | callback status not exposed in either context; receiver and sender consoles showed none of these status/error strings |
| Reactions channel name and initial evidence | `conversation:11111111-1111-4111-8111-111111111111:reactions`; exact name derived from the confirmed backing conversation id and current `realtime.ts`; raw join frame not exposed | Same exact channel name; raw join frame not exposed after fresh receiver restoration |
| Reactions status sequence (`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`) | callback status not exposed in either context; receiver console showed none of these status/error strings, and sender status capture was unavailable after its controlled tab closed | callback status not exposed in either context; receiver and sender consoles showed none of these status/error strings |
| Raw WebSocket error/close evidence | none exposed; no raw frame, close code/reason, topic, or payload was available through the browser-control surface | none exposed; no raw frame, close code/reason, topic, or payload was available through the browser-control surface. Local Realtime logs showed database-event/channel counters and no error lines or explicit subscription-error payload. |
| Synthetic message text | `realtime-check-20260710-1016-a1` | `realtime-check-20260710-1018-a2` |
| Sender action/request timestamp and result | Coach composer submitted at `2026-07-10T02:16:41.158Z`; HTTP status/response not exposed. Database row created at `2026-07-10 02:16:41.713779+00` with sender `28804486-83e7-410e-bcdb-8c80cd3b4b6b`, confirmed conversation id, and client request id `2077582a-ec87-40e4-9d0e-7cc39941d8f2`. | Coach composer submitted at `2026-07-10T02:18:35.531Z`; HTTP status/response not exposed. Database row created at `2026-07-10 02:18:36.332408+00` with the same sender/conversation and client request id `969f3e13-2be5-4ba7-b129-1fdefd4a89d9`. |
| Sender-visible message state | Immediate sender-row capture unavailable because the Chrome-controlled tab closed after send; database persistence plus the independent receiver DOM confirm completion | Exact sender text row count `1`; sender console contained two non-failing `Realtime send()` REST-fallback warnings for broadcast behavior, with no observed delivery failure |
| Receiver-visible DOM result and timestamp | Exact synthetic text appeared without refresh; observed at `2026-07-10T02:17:04.688Z`. Row contained the message and Reply/Add reaction actions, but no avatar image and no `<time>`. | Exact synthetic text appeared without refresh; observed at `2026-07-10T02:18:36.513Z`. Row again contained no avatar image and no `<time>`. |
| Receiver matching-row count / duplicate count | matching rows `1`; duplicates `0` | matching rows `1`; duplicates `0` |
| Transcript movement / `New messages` indicator | Stayed pinned to bottom; before `scrollTop/scrollHeight/clientHeight = 7068.5/7554/486`, after `7108.5/7594/486`; indicator count `0` | Fresh baseline `7050/7536/486`; after send `7090/7576/486`; stayed pinned; indicator count `0` |
| Scroll or layout change | Expected 40px transcript growth only; no unexpected scroll or layout shift | Expected 40px transcript growth only; no unexpected scroll or layout shift |
| Capture limitations | Raw WebSocket frames, callback status transitions, and sender HTTP response status were not exposed. Receiver observation was delayed by browser-controller recovery and must not be treated as network latency. | Raw WebSocket frames, callback status transitions, and sender HTTP response status were not exposed. Console and local Realtime logs are absence-of-observed-error evidence only, not proof of a particular channel status. |

### Live classification

classification: inconclusive

functional_delivery_failure: not reproduced. Both synthetic messages rendered
exactly once in the independent receiver session without a post-send refresh,
including after navigating the receiver afresh through `/chat`. No failure
signal, duplicate, unexpected scroll/layout shift, or `New messages` indicator
was observed.

classification_basis: The protocol requires `inconclusive` when its
WebSocket/request capture cannot be completed. The controlled browser surfaces
did not expose raw WebSocket frames, callback status transitions, or the sender
HTTP response status. Database persistence and DOM delivery establish the
functional outcome, but they do not establish the missing protocol boundaries.

root_cause: not established. Do not promote the route/channel-id distinction,
absence of console errors, REST-fallback broadcast warnings, or avatar/time
grouping behavior to an auth, realtime, route, store, or rendering delivery
root cause.

presentation_observation: The two received rows had no avatar or `<time>`.
Current community grouping suppresses both for consecutive messages from the
same sender without a time-gap cutoff. This is separate from delivery and is
deferred to separately scoped layout work; no production code changes belong
to this plan.

### Classification rule

- **reproduced:** delivery fails and the capture contains a direct, repeatable
  boundary signal identifying where the current path failed.
- **not reproduced:** the receiver renders each synthetic message exactly once
  without refresh and the capture contains no failure signal.
- **inconclusive:** authentication, services, route identity, membership, the
  WebSocket/request capture, or either attempt cannot be completed; also use
  this classification when delivery fails without a boundary signal.

Append the classification and the evidence supporting it after the table. A
route mismatch, missing auth session, or missing service may explain why the
test could not run, but it must not be promoted to an auth, realtime, route,
store, or rendering root cause without a direct and repeatable failure boundary.
If the outcome is not reproduced or inconclusive, keep
`root_cause: not established`. If a repeatable failure is reproduced, preserve
the redacted evidence for a separate follow-up fix plan; do not implement or
speculate about the fix here.
