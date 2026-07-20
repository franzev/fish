# Native iOS chat parity implementation plan (live spine + web-parity features)

Status: implemented — phases 1–8 complete; the Phase 9 direct-message slice is
implemented, with credentials/device verification and iOS call push deferred.
Written 2026-07-18 from a full parity audit of the web direct-chat feature set,
the iOS codebase, the Supabase backend contracts, and the existing iOS plan
documents. The companion audit (feature matrix, per-feature evidence, and the
verified-vs-assumed register) was delivered alongside this plan; its
load-bearing findings are restated here so the plan stands alone.

---

## 1. Outcome and scope

Close the gap between web direct chat and iOS personal chat. After this plan,
an iOS client or coach in a live conversation can: receive messages in
realtime (no polling), page backward through history, see and produce
delivered/read receipts and typing signals, reply/edit/delete/react/report,
send attachments end-to-end, move between multiple authorized conversations,
and start calls from the chat header — all with reducer-level behavior that
provably matches web because both platforms replay the same fixture vectors.

The iOS presentation layer is already built and heavily tested (transcript,
grouping, dividers, composer, emoji/GIF/sticker picker, attachment pipeline
and UI, presence, calls). This plan supplies the missing **live conversation
spine** and the parity features stacked on it.

### Baseline (verified 2026-07-18)

- Attachment UI integration has **landed** (`96d4435f feat(ios): add native
  chat attachments`, docs in `3e45c8fb`): `MessageUiModel.attachments`,
  staged-media send gating, transcript rendering, viewer, and the
  `LiveAttachmentLab` catalog host. This plan builds on that baseline; the
  former "Phase 0 (in flight)" is complete.
- iOS chat transport today: one-shot REST fetch with **no pagination limit**
  (`ChatData/Adapters/RestChatMessaging.swift:40`), 3-second polling in the
  lab, no realtime ("Realtime remains outside this feature", RestChatMessaging
  header), no read-state or typing transport, `onSend` wired only in the lab.
- Message bodies render as plain `Text` (`PersonalChat/Views/MessageBubble.swift:106`)
  while web renders a sanitized markdown subset — same message, different look.
- Backend is ready for direct chat and the iOS direct-message push slice. The
  `0054_ios_direct_message_push` migration extends push registration and the
  APNs dispatcher runs beside Android FCM. iOS call push remains deferred.

### Included

- Swift port of the shared chat-state reducer/selectors with fixture-vector
  parity (the `call-state-vectors` mechanism, applied to chat).
- Markdown message-body parity renderer.
- Realtime receive, keyset pagination, reconnect gap-backfill, read receipts,
  unread transport, typing transport.
- A production-shaped `ConversationStore` fusing chat + presence + connection
  state behind the existing stateless views, hosted by the native iOS app shell
  and still available in the Catalog live lab for isolated verification.
- Message actions: reply, edit, delete, reactions, report GIF.
- Attachments bound to the live send/receive path.
- Conversation list + navigation attention (assigned-never-chosen rules).
- Call entry from the chat header; real transcript in the in-call pane.
- The direct-message APNs implementation and the remaining notification plan
  for iOS call push, plus iOS ADR coverage of the decisions made here.

### Excluded (deliberate; matching web's own deferrals and product rules)

- Voice messages and polls (inert placeholders on web — do not build).
- Search inside direct chat (web gates search to community channels).
- Link previews (`message_embeds` has no producer anywhere).
- Copy/forward/pin actions (absent on web; copy is a product decision, not
  parity — do not add without one).
- iOS call push (PushKit/CallKit), badge state-vector parity, and notification
  action categories — separate workstreams until the call experience is ready.
- Durable (cross-relaunch) drafts — web loses drafts on reload too; parity
  is per-conversation in-memory drafts. A durable outbox is a product call.

---

## 2. Priorities

- **P0 — the spine (Phases 1, 3, 4).** Everything else is blocked or
  diminished without it. This is exactly the foundation plan's follow-on
  milestones 1–2 ("ChatCore" then "ChatData integration").
- **P1 — daily-use parity (Phases 2, 5, 6, 7, 8).** Mutually independent
  once the spine exists; each is a small, shippable slice. Markdown parity
  (Phase 2) has no dependencies at all and can land first or in parallel.
- **P2 — platform maturity (Phase 9).** Direct-message APNs is implemented;
  APNs credentials and physical-device testing remain release gates. Call push
  is deferred.

---

## 3. Conventions that bind every phase

These are the settled FishKit rules, restated once so each phase below can
stay terse. They mirror the foundation/attachments/presence/calling plans and
the as-built code.

- **Module shape:** Foundation-only data target with `*Providing` protocols +
  `Adapters/` (network) + `Logic/` (pure) → one `@MainActor @Observable`
  orchestrator per feature → stateless value-fed views ("models in, closures
  out") → live adapters constructed only at the Catalog/app boundary.
- **supabase-swift** is permitted only inside a data module's adapters
  (PresenceData precedent, decision D1 there). Chat realtime follows the same
  rule: the SDK becomes an internal dependency of `ChatData`, invisible in
  its public surface; everything else stays raw URLSession.
- **Parity mechanism:** pure logic is ported, not approximated, and replays
  `packages/core` JSON fixture vectors synced into the package with a
  `--check` drift gate (SPM cannot reference files outside the package, so
  vectors are copied like `call-state-vectors.json` into
  `TestSupport/Resources/` and verified by script).
- **Copy is ported verbatim from web sources**; errors use calm notice tones,
  never alarming red, never the word "Error". One primary action per screen
  (Send). Tokens only — no raw colors, fonts, spacing, or shadows; 44 pt
  targets, 56 pt primary.
- **Testing:** Swift Testing (`@Test`/`#expect`) for logic; pointfree
  snapshot tests light/dark + XL Dynamic Type + RTL for every new view state
  with committed baselines that get human visual review before commit;
  scripted providers from `TestSupport` for orchestration tests; catalog
  accessibility audit stays green. Gates: `pnpm ios:tokens:check`,
  `pnpm ios:guard` (extended for any new import rules), `pnpm ios:test`,
  `pnpm ios:catalog`.
- **Contract discipline:** ordering and cursors always use the composite
  `(created_at, id)` key, never `created_at` alone. Idempotency keys are
  resent verbatim on retry (`client_request_id`, `client_upload_id`).
  Realtime broadcast payloads are wake-up hints — canonical state is always
  re-read from RLS-protected rows/RPCs. Tolerate, do not "fix", the two
  documented drifts: `call_completed` exists in enums but is never emitted;
  `images` is a deprecated alias of `attachments`. Unknown `sticker_id`s
  degrade to the calm fallback.

---

## 4. Phases

Each phase is independently deliverable and ends with green gates. Dependency
arrows are noted; unlisted phases are order-free after their dependencies.

### Phase 1 — ChatCore parity port (P0; no dependencies)

New `ChatCore` target: Swift port of `packages/core/src/chat-state` — state
and event types, `reduceChatState`, and the selectors web relies on
(`compareChatMessages`, `mergeChatMessage`, `mergeReadState`,
`getOutgoingMessageStatus`, `getUnreadMessageSummary`, `countUnreadMessages`,
`getMessageSnippet`, `toReplyPreview`). Sync
`chat-state-vectors.json` + `chat-media-merge-vectors.json` into
`TestSupport/Resources/` behind the existing drift-gate script family
(`pnpm ios:chat-vectors` / `:check`, mirroring `ios:chat-media`). This also
closes the attachments plan's noted gap that the media-merge vectors were not
yet replayed on iOS.

**Acceptance criteria**

- Every vector in both files replays to an identical result on iOS.
- Reducer and selectors are pure, `Sendable` value types; no provider or UI
  imports (guard-enforced).
- Optimistic sends survive hydration merges (unresolved local rows are
  preserved); a late failure never downgrades a row already confirmed sent
  (monotonic status guard); failed sends restore the draft only when nothing
  newer was typed.
- Unread math excludes own and deleted messages and treats markers outside
  the loaded window as older-than-window.

**Test scenarios**

- Vector replay suite fails on any divergence (drift gate fails on stale
  copies).
- Property/edge tests: composite-key ordering with equal timestamps and
  sub-millisecond ties; `mergeChatMessage` idempotency on
  `clientRequestId` replay; read-marker monotonicity (backwards timestamps
  rejected); snippet rules ("Message deleted", "Sticker", "GIF", "N files",
  96-code-point truncation).

### Phase 2 — Markdown message-body parity (P1; no dependencies)

Port the web renderer's grammar (`message-body.tsx`): bold, italic, inline
and fenced code, bullet/numbered/nested lists, h1–3, blockquotes, and links
sanitized to http/https/mailto. Implement as a pure parser in
`PersonalChat/Logic/` producing a value model, rendered with existing type
and palette tokens; wire into `MessageBubble.bodyText`. Emoji-only display
sizing and bubble tokens are unchanged.

**Acceptance criteria:** the mirrored web test corpus renders equivalently;
only http/https/mailto become tappable links; `javascript:` and other
schemes stay plain text; no HTML/attributed-string injection path; XL type
and RTL hold up.

**Test scenarios:** ported unit corpus from the web message-body tests;
snapshot per construct (each block type, mixed documents, emoji-only,
outgoing vs incoming palettes); malicious-input cases; long-content
wrapping unchanged.

### Phase 3 — ChatData live slice (P0; independent of Phase 1)

Extend `ChatData` (Foundation-only surface unchanged):

- **Keyset pagination:** `messages(conversationId, before: cursor?, limit:)`
  ordered by `(created_at, id)`, N+1 probe for `hasMoreOlder`, plus a
  newest-window fetch. Replaces the current fetch-all query.
- **Realtime adapter:** `SupabaseChatRealtime` conforming to a new
  `ChatRealtimeProviding` protocol; supabase-swift internally (PresenceData
  precedent). Channels per conversation: `postgres_changes` INSERT/UPDATE on
  `messages`, `message_reads`, `message_reactions` (RLS-filtered), plus the
  broadcast topic `conversation:{id}:typing` (event `typing`, payload
  `{userId, typing}`, self-events excluded) — the exact web wire shape
  (`apps/web/lib/services/supabase/chat-realtime.ts:295`). Join only after
  auth is set; readiness counted on the system-ok rule presence already
  applies; events surface as one `AsyncStream` of typed change events plus a
  connection-state stream.
- **Commands adapter:** `chat-command` Edge Function actions
  `mark-read-state`, `edit`, `delete`, `toggle-reaction`, `report-gif`
  (URLSession idiom of `RestChatMessaging`, calm typed failures) and the
  `get_chat_unread_summary` RPC.

**Acceptance criteria**

- Page fetches return stable windows at exact boundaries (equal-timestamp
  ties split by id); `hasMoreOlder` is correct at the first message.
- Subscription lifecycle: no events before auth; drop → resubscribe emits a
  reconnect signal exactly once per recovery (coalesced across channels);
  typing self-events never surface; duplicate postgres events never produce
  duplicate rows downstream.
- Command failures map to calm, typed notices; unauthenticated calls
  surface the established "Sign in to continue." copy.

**Test scenarios:** scripted-transport unit tests for cursor math and N+1
probe; lifecycle tests (subscribe/drop/resubscribe/backfill-signal-once,
stale-generation guard); wire-shape tests asserting exact
topic/event/payload keys and `chat-command` bodies; failure mapping incl.
401/403/timeouts. Live verification lands with Phase 4's lab.

### Phase 4 — ConversationStore + LiveChatLab (P0; depends on 1 + 3)

One `@MainActor @Observable ConversationStore` in `PersonalChat` adapting
ChatCore state → `PersonalChatUiModel` with **zero view changes**:

- Hydrate newest window; dispatch realtime changes through the reducer;
  targeted re-fetch enrichment on INSERT (attachments/GIF/reactions arrive
  complete, mirroring web's refresh-on-insert).
- Bounded reconnect gap-backfill; when the gap exceeds one page, reset to
  the newest window instead of stitching.
- Older-page loading driven by the existing `OlderMessagesSlot` intents,
  including the failed→manual-retry state (never auto-loop).
- Typing: send on draft activity with 3 s idle stop (and stop on send/blur/
  empty); receive with the 4 s watchdog.
- Read state: delivered advances on receipt while the conversation is open;
  read advances on transcript viewing (viewing ≠ acknowledging split);
  markers never regress; unread divider feeds from the summary + markers.
- Failed sends retry with the same `clientRequestId`; presence and
  connection chrome fused into the top bar exactly as the fixtures stage
  them.

Upgrade `LiveAttachmentLab` into **LiveChatLab**: same config/auth seams,
subscription replaces the 3 s poll; attachments continue to work unchanged.

**Acceptance criteria**

- A message sent from web appears on iOS via subscription in under ~2 s on
  a healthy connection, and vice versa; no polling remains.
- Backgrounding the app ≥5 minutes then returning backfills exactly the gap
  (or resets to newest when larger than a page) with no duplicates and no
  scroll jump; the reserved older-slot geometry never shifts layout.
- iOS read/typing state is visible on web and vice versa; delivered vs read
  glyphs match web semantics for the same script; "New" divider appears at
  the first unread and combines with a coincident day divider.
- Mark-read failure shows "Messages weren't marked as read. Try again."
  without resurrecting the divider; store never re-enters a send loop.

**Test scenarios:** store unit tests with scripted providers for every flow
above (hydrate/receive/backfill/reset/pagination-failure/typing timers with
injected clock/read-monotonicity/in-flight double-acknowledge guard);
existing snapshot states (reconnecting, offline, typing, unread) driven by
store output instead of raw fixtures; two-client live-lab checks against
web: bidirectional send, network kill mid-session, background/catch-up,
read-receipt round-trip. The catalog accessibility audit runs on the lab
page.

### Phase 5 — Message actions (P1; depends on 4)

Context menu on bubbles (the platform-appropriate equivalent of web's hover
bar) plus the flows:

- **Reply:** quote preview above the composer with cancel; sent replies
  render the quoted preview; tapping a quote scrolls to the target if
  loaded. (`toReplyPreview` from ChatCore.)
- **Edit:** sender-only, non-deleted rows; ack-based (no optimistic body
  swap); "Edited" caption on success; escape/cancel restores.
- **Delete:** two-step confirm; optimistic tombstone ("Message deleted") with
  rollback on failure — but never roll back a tombstone realtime already
  confirmed.
- **Reactions:** the fixed 👍 ❤️ 🎉 🙏 set as pills with counts and own-state;
  optimistic toggle; repeated realtime reaction events coalesce.
- **Report GIF** on GIF rows only; server-side dedup is trusted.

**Acceptance criteria:** all actions meet 44 pt targets; destructive copy
never scolds; actions are hidden on deleted rows; concurrent edit/delete/
reaction from web converges to server state; menu is fully labeled for
VoiceOver.

**Test scenarios:** reducer/store units for optimistic edit/delete/reaction
+ rollback and coalescing; snapshot states (menu on own/other/deleted/
failed/GIF rows, reply strip, edited caption, reaction pills incl. XL/RTL);
cross-client convergence in the lab; accessibility audit.

### Phase 6 — Attachments live end-to-end (P1; depends on 4)

Bind the shipped attachment pipeline into the store's send path:
`attachmentIds` + optimistic attachments flow through `ConversationStore`
send/retry; received rows hydrate enriched attachments; signed-URL refresh
on expiry keeps working from transcript context; GIF ⊕ sticker ⊕ attachments
exclusivity is enforced end-to-end.

**Acceptance criteria:** "everything settled or nothing sends" gating holds
through the store; web sees iOS uploads (JPEG-staged → WebP variants) and
iOS sees web uploads; kill-app-mid-upload sweeps staging on relaunch;
2-hour staging expiry surfaces the calm expiry copy; viewer zoom/share works
on received media.

**Test scenarios:** existing `ChatDataTests` suites stay green; store-level
send-with-attachments units (bind order, retry with same ids, exclusivity);
lab e2e mirroring `verify:chat-attachments` including cross-client render
checks both directions.

### Phase 7 — Conversation list + attention (P1; depends on 3; store reuse from 4)

`RestConversationDirectory` adapter (`list_direct_conversation_previews`,
`list_navigation_attention`, per-conversation `attention:conversation:{id}`
broadcast) + `ConversationListScreen` with rows (avatar, name, snippet via
ChatCore `getMessageSnippet` incl. "You: " prefix, relative time, quiet
unread count badge — never a score), calm empty state, and navigation that
honors **assigned, never chosen**: exactly one authorized conversation goes
straight in with no list ever shown; a list renders only for >1 (friend DMs
or a coach's clients).

**Acceptance criteria:** ordering matches the RPC (server recency); the
active conversation's row updates live from store state; attention
broadcasts bump badges without refetch storms; routing rule holds at 1 vs
>1; badge clears when the conversation is read on either platform.

**Test scenarios:** routing unit (1 vs >1 vs 0); snippet parity cases
mirrored from web selector tests; list snapshots (empty, unread, long
names, XL/RTL); scripted attention-event units (debounced refresh); lab
check: web message bumps the iOS row, preview, and badge.

### Phase 8 — Calls fusion in chat (P1; depends on 4)

Add an optional trailing-content slot to `PersonalChatTopBar` (mirroring the
existing `accountContent` seam) and mount `CallEntryButtons` there in the
lab/production host wiring; disabled while a call is busy; labels
"Call {name}". Host the real transcript in `CallChatPane` in the catalog
call lab, replacing the placeholder. Missed-call deep-links into the
conversation are **deferred to Phase 9** (they arrive with notifications).

**Acceptance criteria:** buttons meet 44 pt, never render as a competing
primary action, and are absent when the participant can't be called; busy
guard prevents double-start; in-call pane shows the live transcript.

**Test scenarios:** top-bar snapshots with/without call slot (light/dark/
XL/RTL); busy-guard unit; catalog audit on the fused page; lab check that
starting a call from the header reaches the existing `CallSessionModel`
lifecycle.

### Phase 9 — Notifications + push (P2; direct messages landed; call push gated)

The direct-message slice is implemented: the native app registers APNs tokens,
the backend stores iOS devices and dispatches message alerts beside Android
FCM, and notification taps resolve authorized conversation deep-links after
auth restoration. Remaining work is externally gated: install APNs
credentials, verify development/production entitlements on physical devices,
and decide whether iOS call push should use PushKit/CallKit. App badge state
vectors and notification actions remain deferred until those product decisions
are made.

---

## 5. Cross-platform hygiene (small, any time; separate approvals)

- Document the typing broadcast topic as a shared contract in
  `packages/core` (today it exists only implicitly in web code).
- Add presence fixture vectors (presence plan open decision D8).
- Hoist `send-message`'s re-declared limits/schemas into `@fish/core`
  (flagged in the reusability audit). Touches web/server; coordinate.
- Add iOS ADRs mirroring Android's 0001–0004 for: the ChatCore/ChatData
  split, supabase-swift placement, and the conversation-list navigation
  rule.

## 6. Open decisions (recommendations inline)

1. **supabase-swift linkage for chat realtime** — recommended: internal to
   `ChatData` adapters (PresenceData precedent) rather than a separate
   SDK-isolation target; revisit only if calls adopt the same adapter and a
   shared realtime target earns its keep.
2. **Store placement** — recommended: `PersonalChat/ViewModels/` (feature
   orchestrator, like `GifSearchModel`), not a new module.
3. **Typing contract** — recommended: document in core (§5) during Phase 3
   so Android can adopt the same wire shape without reverse-engineering web.
4. **Durable drafts / copy action** — product decisions; excluded here.

## 7. Verified findings vs assumptions carried from the audit

Verified in code this session: the no-limit fetch
(`RestChatMessaging.swift:40`); plain-`Text` bodies (`MessageBubble.swift:106`);
the typing wire shape (`chat-realtime.ts:295`); JPEG staging merged (`0051`);
typing has no backend schema (ad-hoc broadcast by design); pin columns have
no write RPC; voice/polls are inert web placeholders; search is
community-gated; attachment work landed as `96d4435f`.

Assumptions to re-verify during implementation: preview-list ordering is
server-side recency (RPC body not read line-by-line); supabase-swift joins
the non-private typing topic with web-equivalent auth semantics (presence
proved private broadcast + postgres_changes; this exact topic is untested
from Swift — verify in the Phase 3 spike before building on it); the
  app-shell/auth milestone is now complete for the direct-chat slice; the
  Catalog remains a verification host rather than the production delivery
  vehicle.
