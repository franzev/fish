# Release sign-off, mobile safety actions, and read receipts plan

Status: Part 2 implemented and independently reviewed (2026-08-07), as-built
deviations and review fixes recorded below. Part 1 is doc-prep only (1.1, 1.2
done); 1.3-1.6 need external device/account access this session does not
have. Part 3 has not started (hard-gated on 3.0).
Written: 2026-08-07

## Independent review (Part 2, 2026-08-07)

A second, adversarial pass (fresh context, ran the actual build/test gates
rather than reading only) found three real bugs and four smaller issues.
Fixed in this pass:

- **iOS: a stale in-flight command could hijack the confirmation UI.**
  Backing out of one confirmation (e.g. Report) and arming another (e.g.
  Block) before the first's network call resolved let the late answer
  overwrite the newer confirmation — including silently succeeding it. Fixed
  by re-checking the model is still working on the *same* action before any
  async completion writes state, and disabling "Go back" while a command is
  in flight. Caught mid-fix, by re-reading my own patch rather than trusting
  it: the first attempt (`case .confirming(action, true, _)`) silently didn't
  compare `action` at all — Swift's pattern matching treats a bare identifier
  as a new binding, not an equality check, unless bound with `let` and
  compared explicitly. Regression test added
  (`aStaleReportCompletionDoesNotClobberANewerBlockConfirmation`).
- **iOS: the safety UI was shown to accounts the backend always rejects** — a
  coach viewing their client's conversation, or a client on a build with
  `FRIENDS_ENABLED=false`. Every other friends surface in the app already
  gates on `friendsAvailable`; the new one didn't. One-line fix in
  `FishAppModel.openConversation`.
- **Reports hitting the rate limit showed friend-request copy** ("Pause
  before sending more requests") — confusing for someone who just reported
  someone, not sent a request. Added a dedicated `friend-command` branch.
- The rate-limit query had no supporting index; added one.
- `user_reports.reporter_id` was `on delete cascade`, so a reporter deleting
  their account would silently erase the report itself — undermining the one
  thing the table exists to preserve (a record about the *target*). Changed
  to `on delete set null`.
- Web: starting a new confirmation didn't clear a leftover notice from the
  previous one (e.g. reporting, then immediately opening Unfriend, showed the
  report's "Thanks" notice above the unfriend prompt). Fixed; regression test
  added.
- `packages/supabase/src/database.generated.ts` had not been updated for
  `user_reports`/`report_user`; added by hand to match the migration.

Deferred, flagged as a follow-up rather than fixed here: iOS's confirmation
state is scoped to the conversation (deliberately, to survive unrelated
re-renders while mid-confirmation) rather than to the details sheet, so
closing and reopening the sheet without tapping "Go back" can land back on a
stale confirmation screen. Low severity — nothing executes without an
explicit tap — and the safe fix needs SwiftUI lifecycle work this pass
couldn't fully validate without a device run.

## Outcome

Three workstreams, executed in order:

1. Every already-implemented mobile feature is verified on physical devices
   and the apps reach TestFlight / Play internal testing. No new features.
2. A client can block, unblock, and report another client from both native
   apps, matching the web's existing block surface. Closes the App Store
   Guideline 1.2 gap (apps with user-to-user content need block + report).
3. A single calm "Seen" indicator on the sender's latest message — built only
   if a coach validates it helps rather than pressures. Gated, smallest last.

Order rationale: Part 1 unblocks everything already built (a dozen plan docs
end with "physical-device pass remains external") and requires no code.
Part 2 is the one real feature gap, and its backend already exists. Part 3 is
speculative until coach-validated, so it goes last and may be dropped.

---

## Part 1 — Physical-device verification and release sign-off

### Goal

All device-dependent behavior (push, quick reply, PushKit/CallKit calls,
background uploads, offline reconnect, notification focus/clearing) proven on
real hardware against hosted infrastructure, with results recorded.

### Why

Simulators cannot prove APNs/FCM delivery, VoIP wake-from-terminated,
`URLSession` background transfer, or real network-loss reconnection. Every
implemented plan is gated on this; it is accumulated risk, not new work.

### Steps

- [x] **1.1 Refresh `deploy-checklist.md`.** Done: migration high-water mark
      now reads `0067_user_reports.sql`, function list gained
      `chat-image-command`, `link-preview`, and `friend-command` (with its
      `FRIENDS_ENABLED` gate documented), RLS spot-check table extended with
      `friendships`, `friend_requests`, `user_blocks`, `user_reports`,
      `conversation_mutes`, `conversation_pins`.
- [x] **1.2 Consolidate the device checklist.** Done:
      [device-verification-checklist.md](device-verification-checklist.md),
      four tiers by prerequisite (no-infra → push → calling → restrictive
      network), every item pointing back to its source plan, plus a
      status-line table for step 1.6. Source plans untouched.
- [ ] **1.3 Provision hosted infra and credentials** by executing the
      refreshed deploy checklist top to bottom: hosted Supabase project +
      `db push` + function deploys, APNs `.p8` key, VoIP push entitlement,
      FCM service account, LiveKit Cloud project, all as Edge Function
      secrets. External accounts required; nothing here is code.
- [ ] **1.4 Distribute builds.** iOS: archive with push + VoIP entitlements,
      upload to TestFlight internal testing. Android: signed release bundle to
      the Play internal testing track. Reuse existing build tooling; add only
      the signing configuration each store requires.
- [ ] **1.5 Execute the checklist on hardware.** Two devices per platform
      where flows are two-sided (calls, presence, push receipt). Work the
      groups in prerequisite order; check items off with date and device.
- [ ] **1.6 Fix what fails, re-verify, sign off.** Each fix is an ordinary
      change with the normal build/test gates. When a source plan's section is
      fully green, flip that plan's "physical-device pass remains" status
      line to verified.

### Dependencies and assumptions

- Apple Developer Program membership with the VoIP push entitlement granted;
  a Firebase project; a LiveKit Cloud project; ideally two iPhones and two
  Android phones (one of each is workable but slows two-sided checks).
- Assumes no code changes until a check fails on hardware.

---

## Part 2 — Block and report on mobile

### Current baseline (verified in-repo)

- Backend block is **complete**: `user_blocks` table, `block_user` /
  `unblock_user` security-definer RPCs (`0021_friendships.sql:655`), and
  `friend-command` actions `block-user` / `unblock-user` already deployed.
  Blocks already gate friend search, requests, direct-conversation security
  (`0042`), and friend calls (`0037`).
- Web UI is **complete** for block: `friend-safety-actions`,
  `blocked-people-list`, `/friends/blocked`.
- Mobile has the friends feature and `friend-command` client plumbing on both
  platforms, but exposes **no block, unblock, or report** action.
- Report exists only for GIFs (`message_gif_reports`). There is no
  report-a-person mechanism on any platform.

So the work is: one small backend addition (report), then mobile UI that
calls what already exists. Backend → Android → iOS → web, the same order the
pinning and friends features used; each step leaves a releasable app.

### Steps

- [x] **2.1 Backend: minimal report sink.** Landed as
      `supabase/migrations/0067_user_reports.sql` + a `report-user` action in
      `friend-command`. **As-built:** the RPC is `report_user(p_target_id)` —
      no `p_reason` parameter. The `reason` column exists on `user_reports`
      for future use, but nothing populates it yet: no client sends one, so a
      parameter with zero callers would have been unused API surface. Added a
      rate limit (10 reports/5 min/reporter) mirroring
      `send_friend_request`'s existing pattern — cheap reuse of an established
      convention, not in the original plan text. The reported person is never
      notified, mirroring block's privacy contract. No moderation dashboard.
- [x] **2.2 Android.** **As-built, corrects the baseline above:** block,
      unblock, and remove-friend were **already fully implemented** — not in
      `data/friends` as assumed, but in `data/chat`/`feature/chat`, reached
      from `ConversationDetailsSheet`'s inline confirm-then-act flow (a
      friendship *is* a conversation in this app's model). A "Blocked people"
      settings screen already existed too. The only real gap was `reportUser`.
      Added it through the same chat-module path used by block/remove
      (`ChatRemoteDataSource.reportUser` → `SupabaseChatRemoteDataSource`
      reuses the existing `friendCommand` helper → `ChatRepository` →
      `ChatViewModel.reportParticipant()`), plus a third
      `SafetyConfirmation.Report` branch in `ConversationDetailsSheet`
      alongside the existing Unfriend/Block ones. Unlike block/remove, a
      successful report does not close the conversation — it shows a calm
      notice and stays (nothing about the relationship changed). Tests:
      `SupabaseContractTest` (wire shape), `ChatViewModelTest` (success +
      failure notice, conversation stays open), plus every `ChatRepository`
      fake/implementer updated for the new interface method.
      `pnpm android:test`, parity registry (`onReport` prop) — all green.
- [x] **2.3 iOS.** **As-built, corrects the baseline above:** `unblockUser`
      already worked, but through an older, separate direct-RPC path
      (`ChatData` → the existing `AccountSettingsSheet` "Blocked people" list)
      — not `friend-command`. There was **no way to block anyone on iOS at
      all**: no UI trigger existed anywhere. Added `blockUser`/`reportUser`
      (not unblock — left the working old path alone) to `FriendsData` /
      `EdgeFunctionFriendCommands`, which needed a second response shape
      (`{done: Bool}`, factored a shared `post()` helper out of the existing
      `{request: {...}}`-decoding `send()`). The confirm-first UI is a new
      `ConversationSafetyModel`/`ConversationSafetyView` (matching the
      web/Android inline-reveal pattern, not a native `.confirmationDialog`,
      for cross-platform copy/flow consistency on this specific feature) slotted
      into `ConversationDetailsSheet`'s pre-existing, previously-unused
      `safetyContent: AnyView?` extension point — its doc comment already said
      "hosts may append existing safety actions without widening this
      feature's scope". Required one new module edge (`PersonalChat` →
      `FriendsData`) and a new `participantRole: ChatUserRole` on
      `ConversationStore` (iOS had no way to know the counterpart's role once
      inside an open conversation, only in the conversation list). Gated the
      new UI on that new property rather than the existing `currentUserRole`,
      which a separate investigation found is mis-inferred for client-to-client
      conversations — flagged as its own follow-up, not fixed here. swift-testing
      wire tests (`EdgeFunctionFriendCommandsTests`), a model test suite
      (`ConversationSafetyModelTests`), and themed/accessibility snapshots
      (`ConversationSafetySnapshotTests`) recorded and visually reviewed.
      `pnpm ios:test` green; parity registry updated (new iOS-only
      `ConversationSafetyView` entry, `onReport` on the shared
      `ConversationDetailsSheet` entry).
- [x] **2.4 Web parity: report.** Added to `friend-safety-actions` as planned
      (stays on the screen with a "Thanks" notice, unlike block/unfriend which
      navigate away — nothing about the relationship changed). **Found but not
      fixed, flagged separately:** `member-profile-popover.tsx` (the community
      chat message-author popover) has its own independent block-confirmation
      UI that does not reuse `friend-safety-actions` and still lacks Report —
      a pre-existing asymmetry, not introduced here. `pnpm --filter web test`
      and `tsc --noEmit` green.

### Dependencies and assumptions

- No external dependencies; ships independently of Part 1 (though the App
  Store review argument only matters once Part 1 submits a build).
- Blocking stays client-to-client: `require_client_caller` already excludes
  coaches, and coach conversations are untouched. No new decision needed.
- Report targets a **person**, not a message. Message-level evidence
  (attaching a message id) is deferred until moderation actually asks for it.
- Reuses the friend-command idempotency/error conventions wholesale; no new
  service, table beyond `user_reports`, or client abstraction.

---

## Part 3 — "Seen" indicator (gated on coach validation)

### Goal

One quiet "Seen" label under the sender's most recent message once the other
person's read watermark passes it. No delivered/unread states, no timestamps,
no per-message ticks.

### Why (and why gated)

Closing the last common-chat-expectation gap — but read receipts are a known
anxiety generator for the ADHD audience, and the coach-first rule applies:
don't build until a coach has proven the technique manually. The absence
today may be correct.

### Steps

- [ ] **3.0 Coach validation gate.** A coach trials the concept with real
      clients (e.g. verbally confirming "seen, no need to reply" norms). If
      the verdict is pressure rather than calm, close this part as
      won't-build and record why. **Do not proceed past this box unchecked.**
- [ ] **3.1 Expose the counterpart watermark.** `message_reads` is already a
      per-(conversation, user) watermark with RLS and realtime driving unread
      badges — the data and its updates exist. Work is read-side only: let
      each client observe the counterpart's row for the open conversation.
      Expected to need no migration; at most a narrow select policy check.
- [ ] **3.2 Render it.** In each client's conversation view, compare the
      counterpart watermark to the newest own message; render one muted
      "Seen" caption when passed. Core logic as a pure function with fixture
      tests in the reference implementation first, then Android, iOS, web.
      Never render a negative state ("not seen yet" does not exist).

### Dependencies and assumptions

- Hard-gated on 3.0. Depends on nothing in Parts 1–2.
- Assumes `message_reads` realtime updates are already visible to the
  counterpart client (they drive unread badges); if a policy blocks the
  cross-member read, that is the only backend change.

---

## Deferred until there is a concrete need

- **Moderation UI** for `user_reports` (dashboard, statuses, audit trail) —
  the table plus Supabase dashboard reads suffice at current scale.
- **Message-level reporting** (attaching message ids as evidence).
- **Blocking from the message action sheet** — the friend profile /
  conversation details placement covers discovery; add a second entry point
  only if users can't find it.
- **Delivered/read per-message ticks, timestamps, or "seen" in lists** —
  the single label is the whole feature, by design.
- **Automated store-release pipeline (Fastlane etc.)** — manual archive and
  upload is fine for the first sign-off; automate when releases recur.

## Assumptions and tradeoffs (explicit)

1. **Part 1 before Part 2** trades a slightly later safety-feature landing
   for de-risking everything already built; Part 2 is small enough to slot in
   whenever Part 1 stalls on external account approvals.
2. **Report is a sink, not a workflow.** Satisfies the store requirement and
   gives moderation real data with ~one migration and one action; anything
   richer is speculation today.
3. **Seen-label-only receipts** trade feature completeness for the product's
   calm contract; if coaches want more, that is a new validated decision.
4. Throughout: no new services, dependencies, or abstractions — every step
   extends a surface that already exists (`friend-command`, friends data
   layers, `message_reads`, existing plan-doc conventions).
