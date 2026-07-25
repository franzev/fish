# Per-conversation quiet (mute) implementation plan

Status: Implemented 2026-07-25; physical-device push sign-off remains external
Written: 2026-07-25

## What changed against this plan during execution

- **A read RPC was added.** The plan had each client read `conversation_mutes`
  directly under RLS. Doing that would have put the expiry predicate in Swift,
  in Kotlin, and again in the step 4 preview column. `public.conversation_mute`
  and the shared `private.conversation_mute_state` keep it in one place, and
  the table is not reachable by `authenticated` at all.
- **Both clients ignore an expired quiet period at render time.** Without this
  a quiet period that ran out while the screen was open kept claiming to be
  quiet until a reload, while the server had already resumed pushes.
- **Snapshot baselines carry no clock time.** The "Quiet until 4:32 PM" wording
  renders through the machine's timezone, which would have made the recorded
  images depend on where they were recorded. That wording is asserted in the
  copy tests against a fixed zone and locale instead; the baselines show the
  states whose wording is timezone-independent.
- **The row's glyph tracks the state** (speaker when on, moon when quiet).
  The first recorded baseline showed a sound-is-on icon on a quiet row.
- **`"type": "module"` was added to the root `package.json`** so the new
  dependency-free Deno-shared module can be unit tested with `node --test`
  without a `MODULE_TYPELESS_PACKAGE_JSON` warning. Deno is not installed in
  this environment, so the two existing `_shared/*.test.ts` files cannot run
  here; the new one is wired into `pnpm verify:conversation-mute`.

## Outcome

A person can silence message notifications for one direct conversation, for a
fixed period or until they turn them back on, from that conversation's details
surface on Android and iOS. Nothing else changes: the messages still arrive,
the unread count still counts, calls still ring.

The finished result is:

- `Notifications` row in the conversation details surface on both platforms,
  showing `On` or `Quiet until 4:32 PM` / `Quiet until you turn it back on`.
- Four choices behind that row: quiet for 1 hour, 8 hours, 24 hours, or until
  turned back on — plus turning it back on.
- The server stops sending that person's message pushes for that conversation
  while the quiet period is active, and resumes on its own when it expires.
- A quiet marker on the conversation list row.

Naming: the code and database use `mute` (unambiguous); user-facing copy uses
"quiet", which is already this product's word for it (`"Let people know you
need quiet."` in presence copy).

## Why this feature

The only notification control today is the operating-system on/off switch
surfaced in account settings. For an audience that abandons apps over
interruption load, "all notifications or none" is the wrong granularity — the
usual outcome is that the whole app gets silenced and the coaching
relationship goes quiet with it.

## Scope

In scope: direct conversations, message pushes, both native apps.

Out of scope, deliberately: call pushes (a muted conversation still rings —
calls are explicitly initiated and time-bound), channels, the web app (it has
no push), per-conversation sound/vibration choices, scheduled quiet hours.

## Design decisions

**One new table, keyed by (conversation, user).** Direct conversations have no
membership row — `public.conversations` carries `client_id` and `coach_id`
directly — so the preference cannot hang off an existing row.

**`muted_until timestamptz` nullable; absent row means not muted; `null` means
until turned back on.** This is the shape migration `0048_presence_status_durations.sql`
already established for presence expiry, and it makes expiry self-healing: no
cleanup job, no scheduled sweep, just `muted_until is null or muted_until > now()`
at read time.

**Fixed durations validated server-side.** Same reasoning as 0048: keep
arbitrary expiry values out of the command boundary.

**Write through `chat-command`, read through RLS.** Matches the API boundary in
AGENTS.md and adds no new Edge Function — `chat-command` already dispatches to
security-definer RPCs with the caller's auth header.

**Inline expansion, not a new screen.** Tapping `Notifications` reveals the
options in place. iOS routes pushed destinations through a
`ConversationDestination` enum and Android uses a modal bottom sheet; expanding
in place avoids adding a destination to either.

## Execution order

| Step | Shippable result | Depends on |
| --- | --- | --- |
| 1 | Mute state can be stored, read, and changed; pushes honor it | — |
| 2 | iOS can set and see conversation quiet | 1 |
| 3 | Android can set and see conversation quiet | 1 |
| 4 | Quiet marker on both conversation lists | 1 |

Steps 2 and 3 are independent of each other and can land in either order. Each
step leaves both apps working and releasable.

---

## Step 1 — Mute state and push suppression

### Goal

Store one mute preference per (conversation, user), let the owner set and read
it, and stop message pushes to a recipient whose mute for that conversation is
active.

### Why it is necessary

It is the whole feature. Every client change after this is presentation of
state this step creates. Shipped alone it changes no observable behavior — no
UI can set a mute yet — so it is safe to land first.

### Dependencies and assumptions

- `private.is_conversation_member(uuid)` (migration 0029) remains the
  authorization predicate; this step reuses it rather than re-deriving
  membership.
- `send-message`'s `dispatchMessagePush` is the only fan-out path for direct
  message pushes. Confirmed: `dispatchDirectMessagePush` in
  `supabase/functions/_shared/fcm.ts` has exactly one caller, and it covers
  both FCM and APNs.
- Expired mutes are not deleted. A stale row is inert because every read
  compares against `now()`.

### Lean implementation

**Migration `supabase/migrations/0064_conversation_mutes.sql`**

```sql
create table public.conversation_mutes (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_mutes enable row level security;
```

RLS: one `for select` policy — `user_id = (select auth.uid())`. No insert,
update, or delete policy for `authenticated`; all writes go through the
security-definer function below, matching how `message_reads` is handled.

Function `public.set_conversation_mute(p_conversation_id uuid, p_muted boolean,
p_duration_seconds integer default null)`, `security definer`,
`set search_path = ''`, returning `public.conversation_mutes`:

1. `raise exception 'not authenticated'` when `auth.uid()` is null.
2. `raise exception 'conversation not found'` when
   `not private.is_conversation_member(p_conversation_id)`.
3. Reject any `p_duration_seconds` outside `{3600, 28800, 86400, null}`.
4. `p_muted = false` → delete the row and return it.
5. `p_muted = true` → upsert `muted_until = case when p_duration_seconds is
   null then null else now() + make_interval(secs => p_duration_seconds) end`.

Then `revoke execute … from public` / `grant execute … to authenticated`,
mirroring the tail of `0013_realtime_chat_features.sql`.

**`supabase/functions/chat-command/index.ts`** — one more action in the union
and one more branch, alongside `mark-read-state`:

```ts
} else if (command.action === "set-conversation-mute") {
  if (!command.conversationId || typeof command.muted !== "boolean") {
    return calmError("That conversation is not available.", 400);
  }
  response = await rpc(supabaseUrl, apiKey, authHeader, "set_conversation_mute", {
    p_conversation_id: command.conversationId,
    p_muted: command.muted,
    p_duration_seconds: command.durationSeconds ?? null,
  });
}
```

**`supabase/functions/_shared/fcm.ts`** — a pure helper so the rule is
testable without network:

```ts
export function unmutedRecipients(
  recipientIds: string[],
  mutes: { user_id: string; muted_until: string | null }[],
  now: Date,
): string[] {
  const silenced = new Set(
    mutes
      .filter((m) => m.muted_until === null || new Date(m.muted_until) > now)
      .map((m) => m.user_id),
  );
  return recipientIds.filter((id) => !silenced.has(id));
}
```

**`supabase/functions/send-message/index.ts`** — in `dispatchMessagePush`,
between building `recipientIds` and computing unread counts: read
`conversation_mutes` for those recipients with the admin client, pass the rows
through `unmutedRecipients`, and return early when nothing is left. Everything
downstream already operates on the recipient array.

### Verification

- `deno test supabase/functions/_shared/fcm.test.ts` — active mute silenced,
  expired mute not silenced, `null` (until turned back on) silenced, unrelated
  user untouched. Same manual pattern as the existing `_shared` tests
  (`link-preview.test.ts`, `chat-attachment-security.test.ts`).
- Extend `scripts/verify-rls.ts` with three `report()` assertions using the
  seeded fixtures: a member can set and read their own mute; the other party
  cannot read it; a non-member's `set_conversation_mute` call fails.
- `pnpm build`.

### Working state at the end of this step

Unchanged behavior for every user; the contract exists and is proven.

---

## Step 2 — iOS quiet control

### Goal

A `Notifications` row in `ConversationDetailsSheet` that shows the current
state and expands to the four choices.

### Why it is necessary

It is the first surface where the feature is reachable, and iOS is where the
sheet is a pushed destination — worth landing before Android so the inline
expansion pattern is settled.

### Dependencies and assumptions

- Step 1 is deployed.
- The sheet reads its own state on appear via a single RLS-protected select
  rather than threading a new field through the conversation-open pipeline.
  This is one round trip on a rarely-opened surface, and AGENTS.md explicitly
  allows direct Supabase reads for simple authorized data.
- The duration labels are defined locally in `PersonalChat` rather than reusing
  `AccountPresenceDuration`, which lives in the `AccountSettings` module. Four
  duplicated strings is cheaper than a new cross-module dependency.

### Lean implementation

- `apps/ios/FishKit/Sources/ChatData/Models/ConversationMute.swift` — a
  `ConversationMute` value (`isMuted: Bool`, `mutedUntil: Date?`) and a
  `ConversationMuteDuration` enum with `oneHour`, `eightHours`, `oneDay`,
  `untilTurnedBackOn` and their `durationSeconds`.
- `ChatCommandProviding` in
  `apps/ios/FishKit/Sources/ChatData/Providers/ChatMessagingProviding.swift`
  gains `func setMute(conversationId:muted:durationSeconds:) async throws ->
  ConversationMute` and `func mute(conversationId:) async throws ->
  ConversationMute`.
- `EdgeFunctionChatCommands` implements the write with a `MuteCommand: Encodable`
  and a `MuteResponse: Decodable`, following the existing `ReadCommand` /
  `ReadResponse` pair exactly. The read is a `conversation_mutes` select through
  the same REST helper `RestConversationDirectory` already uses.
- `ConversationStore` gains `var mute: ConversationMute?` and
  `func setMute(_ duration: ConversationMuteDuration?) async`, which applies the
  new state optimistically and reverts on failure with the existing calm-notice
  path used by `saveEdit`.
- `ConversationDetailsSheet` gains `mute: ConversationMute?` and
  `onSetMute: (ConversationMuteDuration?) -> Void`, rendering one row plus a
  disclosure-expanded option list. `ConversationView.destinationView` wires both
  from `store`.

Copy: row label `Notifications`; values `On`, `Quiet until 4:32 PM`,
`Quiet until you turn it back on`. Options: `Turn on notifications`,
`Quiet for 1 hour`, `Quiet for 8 hours`, `Quiet for 24 hours`,
`Quiet until I turn it back on`. Failure notice: `That did not save yet. Keep
this open and try again.` — the string this codebase already uses.

### Verification

- Snapshot tests in `Tests/PersonalChatTests` for the three row states and the
  expanded list. Record, then look at every recorded PNG against
  `docs/ui-ux-agent-guidelines.md` before committing — a passing record-mode run
  proves nothing on its own.
- A `ConversationStore` test for optimistic apply and revert-on-failure.
- `pnpm ios:test`, `pnpm ios:app:build`, `pnpm build`.
- `pnpm parity:scan` to refresh `ConversationDetailsSheet`'s prop list in
  `design/parity/native-components.json`, then `pnpm parity:verify`.

---

## Step 3 — Android quiet control

### Goal

The same row and options in Android's `ConversationDetailsSheet`.

### Why it is necessary

Feature parity is a hard rule for these two apps, and `parity:verify` gates it.

### Dependencies and assumptions

- Steps 1 and 2 are done; step 2's copy and option list are copied verbatim
  into `apps/android/feature/chat/src/main/res/values/strings.xml`.
- The existing `ChatResult` error type and calm-notice handling in
  `ChatViewModel` cover the failure path; no new error plumbing.

### Lean implementation

- `ChatRepository` gains `suspend fun setConversationMute(conversationId: String,
  muted: Boolean, durationSeconds: Int?): ChatResult<ConversationMute>` and
  `suspend fun conversationMute(conversationId: String): ChatResult<ConversationMute>`;
  `ConversationMute` joins `apps/android/data/chat/.../model/ChatModels.kt`.
- `SupabaseChatRemoteDataSource` invokes `chat-command` with a
  `SetConversationMuteRequest` and decodes a `ConversationMuteDto`, following
  the `markRead` / `MarkReadRequest` / `ReadStateDto` shape already in that file.
- `ChatViewModel` holds the mute in its existing UI state and exposes
  `onSetMute(duration: ConversationMuteDuration?)`.
- `ConversationDetailsSheet` gains `mute` and `onSetMute` parameters and renders
  the row plus its expanded options with `SettingsRow`-equivalent composables
  already in the chat feature.

### Verification

- Screenshot tests in `feature/chat` `screenshotTest` for the same states as
  iOS, reviewed visually the same way.
- A `ChatViewModel` unit test for apply and revert.
- Accessibility test coverage in the existing `androidTest` sheet test: the row
  is a 44dp-minimum target and announces its current value.
- `pnpm android:check` (which runs `parity:verify`), `pnpm build`.

---

## Step 4 — Quiet marker in the conversation list

### Goal

Show at a glance which conversations are quiet, on both list screens.

### Why it is necessary

Without it, a quiet conversation looks identical to one nobody has written in,
which is the exact confusion that makes people distrust a mute feature and turn
it off.

### Dependencies and assumptions

- Step 1 is deployed. Steps 2 and 3 should be done first so the marker cannot
  appear before anything can set it.
- `list_direct_conversation_previews()` is the single source for both lists.

### Lean implementation

- Migration `0065_conversation_preview_mute.sql` replaces
  `list_direct_conversation_previews()` with two extra output columns: `muted
  boolean` (`mute.conversation_id is not null and (mute.muted_until is null or
  mute.muted_until > now())`) and `muted_until timestamptz`, from one
  `left join public.conversation_mutes mute on mute.conversation_id =
  conversation.id and mute.user_id = (select auth.uid())`. Ordering is
  unchanged — quiet conversations do not sink in the list.
- iOS: two fields on `ChatConversationPreview`, decoded in
  `RestConversationDirectory`, rendered as a small quiet glyph beside the
  timestamp in `ConversationListScreen`.
- Android: the same two fields on the preview model and one marker in
  `views/ConversationRow.kt`.
- The unread badge is unchanged. Quiet suppresses the alert, not the count.

### Verification

- Snapshot/screenshot coverage for a quiet row with and without unread.
- `pnpm ios:test`, `pnpm android:check`, `pnpm build`.
- Manual device check on both platforms: mute, have the other account send,
  confirm no banner and no sound, confirm the message is present when opening
  the app, confirm the marker.

---

## Deferred until there is a concrete need

- **Badge accuracy while quiet.** Suppressing the push also skips the APNs badge
  update, so a muted conversation's unread count reaches the iOS home screen
  late — at the next non-muted push, or on next launch. Fixing it properly means
  a silent `content-available` push (the payload shape already exists in
  `_shared/apns.ts:209`). Defer until someone actually reports a stale badge.
- **Muting from the conversation list.** A swipe action is the obvious follow-up,
  but the details surface is the discoverable home for it and one entry point is
  enough to learn whether the feature is used at all.
- **Scheduled quiet hours** (nightly, recurring). A real want for this audience,
  but it is a different data model (recurrence, timezone) and should not be
  guessed at inside a one-off mute.
- **Muting calls.** Explicitly excluded above; revisit only if someone asks.
- **Expired-row cleanup.** Rows are inert once expired. If the table ever grows
  enough to matter, the existing `pg_cron` setup from
  `0052_schedule_chat_attachment_cleanup.sql` is the place for it.
- **Web parity.** The web app has no push, so a mute there would control nothing.

## Assumptions and tradeoffs

- **Assumed request.** This plan implements per-conversation quiet, the
  recommendation from the preceding discussion. Nothing else from that list
  (pinned message, offline outbox) is included.
- **A muted conversation is muted on every device.** The preference is
  server-side and per-user, not per-device. Simpler, and matches how people
  describe it ("mute this chat"), but someone who wants quiet only on their
  phone cannot have it.
- **Four durations plus off is five rows.** More choices than this product
  normally allows on one surface. Justified by the shipped precedent of the
  presence duration picker, which is the same interaction with six options. If
  it feels loud in review, drop `24 hours` first.
- **Duration labels are duplicated across the two platforms and across
  `AccountPresenceDuration`.** Deliberate: sharing them would mean either a
  cross-module dependency on `AccountSettings` or a new shared module, both of
  which cost more than four strings.
- **Mute state is fetched by the details surface on open** rather than carried
  in the conversation-open payload. One extra round trip on a rarely-opened
  sheet, in exchange for not touching the open pipeline or the realtime
  reducers.
- **No realtime sync of mute state across a user's own devices.** Changing it on
  one device leaves another device's open sheet stale until it is reopened. The
  server is authoritative for push suppression regardless, so the only cost is a
  briefly wrong label.
