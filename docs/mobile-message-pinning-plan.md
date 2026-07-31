# Mobile message pinning plan

Status: Implemented (backend, Android, iOS, web)
Written: 2026-07-31

## As-built notes

Implementation matched this plan closely; a few real-codebase specifics
turned out differently than the plan guessed:

- **Web command routing.** Web has no "message-row" component; the real
  per-message action surface is `chat-message-list/message-actions`. Writes
  route through Next.js Server Actions → `ChatCommandService` → the same
  `chat-command` edge function Android/iOS use (with a local-dev RPC fallback
  in `local-chat-commands.ts` for when the edge function isn't reachable
  locally) — not a direct client-side Supabase call.
- **Web pin state lives outside `packages/core`'s chat-state protocol.** That
  protocol is fixture-tested with hardcoded case counts shared by Android/iOS
  parity tests; pinning is a Zustand-only slice in `chat-store.ts` instead of
  a new `ChatEvent` case, so it never touches that cross-platform contract.
- **Web's "focus a message" mechanism is a page-load `?message=` param**, not
  a wired click handler anywhere else. The banner's tap layers a
  `manualFocusMessageId` override on top of the existing fetch-if-missing +
  scroll-into-view effects rather than building a second mechanism.
- **`MessageBubble` and `PinnedMessageBanner` are intentionally
  `propsAligned: false`** in `design/parity/native-components.json`
  (`propsBreak: "platform-idiom"`): iOS puts `isPinned` on the bubble itself
  (its context menu lives there) and resolves the pin-or-nil banner render
  inside the view body; Android puts `isPinned` on `ChatMessageActionsSheet`
  (a separate modal) and resolves pin-or-nil at the screen call site.
- **iOS's pinned-message snippet never fetches by ID** — it resolves only
  from the already-loaded transcript window, so the banner can never block on
  network the way `focusMessage` may when tapped.

## Outcome

A conversation can hold **at most one pinned message**. Either participant can
pin a text message from the existing message action surface; the conversation
then shows one quiet pinned banner above the transcript. Tapping the banner
focuses the pinned message using the focus-by-message-ID path that message
search and notification taps already use. Pinning again replaces the pin;
unpinning removes it. The pin is visible on Android, iOS, and web.

This is deliberately not "pins" (plural). One pinned phrase per conversation
matches the product's remove-choices rule and avoids a pin-list surface, pin
ordering, and pin management UI entirely.

## Why this feature

Coaches already tell clients "keep this phrase handy" in chat; the message then
scrolls away. A single pinned phrase is the smallest durable answer inside the
direct-chat-only mobile scope.

This is chat infrastructure, not a pedagogical technique — the same category
as Copy, Search, and notification-focus, none of which required coach
validation. It operates entirely inside one already-open conversation, so it
also does not expand the native mobile apps beyond their direct-chat-only
scope (no dashboard, lesson booking, assigned work, exercise, community, or
marketplace surface).

## Design decisions (simplest that satisfies the requirements)

- **One pin per conversation, last write wins.** Enforced by the primary key,
  not application logic.
- **A separate `conversation_pins` table**, not a column on `conversations`.
  The conversations table is not in the realtime publication; a dedicated table
  follows the `conversation_mutes` (0064) and `message_link_previews` (0058)
  precedents, broadcasts only pin changes, and gives free cleanup via
  `on delete cascade` when the pinned message is deleted.
- **Writes go through `chat-command`**, matching every other chat mutation
  (`edit-message`, `set-conversation-mute`, …). Clients get `select` only,
  RLS-scoped to conversation members. No direct table writes.
- **Text messages only** in this slice, mirroring the Copy action's rule:
  not deleted, non-empty text body. Attachment/voice/GIF pinning is deferred.
- **Both participants may pin.** Restricting to coaches would add role plumbing
  to the chat command and both mobile action surfaces before any evidence it is
  needed. Revisit only if client-set pins cause a real problem.
- **The banner has exactly one behavior: tap → focus the message.** Unpin lives
  in the pinned message's existing action surface, not as a second control on
  the banner. No competing primary action is introduced on any screen.
- **Realtime rides the existing per-conversation channel.** Both platforms
  already subscribe one channel per open conversation to `messages`,
  `message_reads`, and `message_reactions` postgres changes
  (`SupabaseChatRemoteDataSource.kt` ~646, `SupabaseChatRealtime.swift` ~133).
  `conversation_pins` becomes a fourth table on that same channel, filtered by
  conversation ID — no new channel, no inbox-wide subscription. A pin changed
  while the conversation is closed is simply read on next open.

## Banner specification (per the UI guidelines preflight)

- **Default:** one full-width row above the transcript. `surface-2` fill, no
  border, no shadow (FISH separates layers by surface lightness), radius per
  the control role. Pin glyph + single-line snippet of the pinned body in
  `text-body`; the glyph carries the "pinned" meaning — no "Pinned" label.
- **Empty:** no pin ⇒ the row does not exist. No placeholder, no reserved
  space.
- **Loading:** render only from cached or fetched data; never a skeleton row.
- **Long copy:** one line, tail-truncated. The banner never wraps or grows.
- **Narrow screens:** same rule; truncation does the work.
- **Touch/keyboard:** the whole row is the target (≥44px tall), focusable,
  with an accessibility label like "Pinned message: <snippet>". Activation
  focuses the message — the same behavior as tap.
- **Motion:** appear/disappear with the platform's default list change
  animation; nothing custom, honoring reduced-motion settings by default.
- **Error:** an unreadable or missing pinned message renders nothing. A failed
  pin/unpin command leaves the previous state and uses the existing calm
  notice treatment (`notice` color, never red).

## Step 1 — Backend contract

### Goal

One migration plus one new `chat-command` action, releasable with no client
change.

### Why it is necessary

All three clients consume the same contract; landing it first lets each client
ship independently afterwards.

### Dependencies and assumptions

- The existing `private.is_conversation_member` helper remains the membership
  authority (already used by the link-preview RLS policy).
- Realtime postgres_changes on a small table is sufficient; no broadcast
  channel work.

### Lean implementation

- New migration `00xx_conversation_pins.sql`:
  - `conversation_pins (conversation_id uuid primary key references
    public.conversations(id) on delete cascade, message_id uuid not null
    references public.messages(id) on delete cascade, pinned_by uuid not null
    references auth.users(id), pinned_at timestamptz not null default now())`.
  - RLS: members `select` via `private.is_conversation_member`; all writes
    `service_role` only — copy the shape of 0058/0064.
  - `alter publication supabase_realtime add table public.conversation_pins`.
- `chat-command` gains `set-pinned-message` with body
  `{ conversationId, messageId | null }`:
  - verify caller membership;
  - `null` deletes the row (unpin), idempotent;
  - otherwise verify the message belongs to the conversation, is not deleted,
    and has a non-empty body, then upsert the row.
- Regenerate `packages/supabase` database types.

### Working-state checkpoint / verification

- RPC tests: member pin, non-member denial, cross-conversation message
  rejection, deleted/bodyless rejection, replace, idempotent unpin, cascade on
  message delete.
- `pnpm db:reset`, `pnpm verify:rls`, `pnpm build`.

## Step 2 — Android

### Goal

Pin/unpin from the actions sheet; pinned banner with tap-to-focus; offline
cache; realtime updates.

### Dependencies and assumptions

- Step 1 deployed to the target environment.
- `ChatViewModel.focusMessage(conversationId, messageId)` (ChatViewModel.kt:266)
  is reused as-is, including its fetch-by-ID fallback for messages outside the
  loaded window.

### Lean implementation

- Data (`apps/android/data/chat`):
  - Room: `ConversationPinEntity` + DAO + database migration
    (`ChatEntities.kt`, `ChatDatabase.kt`, `ChatEntityMappers.kt`).
  - Remote: select from `conversation_pins` alongside the existing
    conversation reads in `SupabaseChatRemoteDataSource.kt`; DTO in
    `SupabaseDtos.kt`; `set-pinned-message` invocation next to the existing
    `set-conversation-mute` call; add a `conversation_pins` postgresChangeFlow
    to the existing per-conversation channel beside `message_reactions`.
  - Repository: expose `pinnedMessage(conversationId): Flow<…>` and
    `setPinnedMessage(conversationId, messageId?)`.
- Feature (`apps/android/feature/chat`):
  - Add `Pin`/`Unpin` to `model/MessageAction.kt` and a secondary row in
    `views/ChatMessageActionsSheet.kt`, shown only for eligible messages.
  - One quiet banner composable above the transcript: surface-2 fill, pin
    glyph, single-line snippet of the pinned body, tap → `focusMessage`. If the
    pinned message row is no longer readable, render nothing — never an error.
  - Strings for `pin_message`, `unpin_message`, and the banner content
    description.

### Working-state checkpoint / verification

- Unit tests: eligibility, replace-on-second-pin, unpin, banner state from a
  realtime change, cache round-trip, Room migration test in
  `ChatDatabaseMigrationTest.kt`.
- Screenshot test for the banner in light/dark.
- `pnpm android:test`, `pnpm android:check`, `pnpm android:screenshots`.

## Step 3 — iOS

### Goal

Same behavior as Step 2 via FishKit.

### Dependencies and assumptions

- Step 1 deployed. `ConversationStore.focusMessage(_:)`
  (ConversationStore.swift:322) is reused as-is.

### Lean implementation

- ChatData:
  - Pin model + wire type (`ChatWire.swift` pattern), read via the existing
    REST adapter, `set-pinned-message` in `EdgeFunctionChatCommands.swift`,
    and a `conversation_pins` entry in `SupabaseChatRealtime.swift`'s
    per-conversation table list beside `message_reactions`.
- PersonalChat:
  - Add `pin`/`unpin` cases to `Models/MessageAction.swift`; menu entries in
    the `MessageBubble` context menu with the same eligibility rule as Copy.
  - `ConversationStore` holds the current pin (updated by realtime) and
    forwards pin/unpin commands.
  - Banner view above the transcript in the conversation screen: DesignSystem
    tokens, single-line snippet, tap → `focusMessage`. Missing/unreadable pin
    renders nothing.

### Working-state checkpoint / verification

- `ConversationStoreTests` coverage: pin visible on open, realtime replace,
  unpin, command failure leaves prior pin intact with a calm notice, focus on
  a message outside the loaded window (reuses the search fetch-by-ID path).
- Catalog state for the banner.
- `pnpm ios:test`, `pnpm ios:catalog`, `pnpm ios:guard`, `pnpm ios:app:build`.

## Step 4 — Web parity

### Goal

A pin set anywhere is visible and manageable where coaches work.

### Why it is necessary

Coaches primarily use web; a mobile-only pin would be invisible to the person
most likely to set it.

### Lean implementation

- `apps/web/features/chat`: banner component (own folder + `index.ts` per the
  component rules) rendered above `chat-message-list`; pin/unpin entry in the
  existing `message-row` action surface; realtime + command call through the
  existing chat client plumbing. Design tokens only; banner uses `bg-surface-2`,
  no border, no red.

### Verification

- Component tests for banner render/tap-focus and action eligibility;
  `pnpm build`, `pnpm lint`, `pnpm typecheck`.

## Deferred until there is a concrete need

- Multiple pins, pin history, or a pin list surface.
- "X pinned a message" transcript/system events and pin push notifications.
- Coach-only pin permission.
- Pinning attachments, voice, GIF, or sticker messages.
- Any pin analytics.

## Assumptions and tradeoffs

- **Last write wins with no conflict UI.** Two simultaneous pins resolve by
  timestamp; the table's primary key makes this safe and the stakes are low.
- **Both members can pin.** Cheapest correct rule today; revisit with evidence.
- **Banner steals one row of transcript height.** Accepted: only when a pin
  exists, and it serves the focus goal (the pinned phrase is the thing the
  learner should see).
- **Deleted pinned message ⇒ pin silently disappears** (cascade). No tombstone
  banner, matching copy-never-scolds.
- **Realtime uses postgres_changes on the new table.** If a client misses the
  event, the next conversation open re-reads the row — the durable state is
  authoritative, matching the app's existing realtime posture.
