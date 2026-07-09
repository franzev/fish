---
phase: 260709-qag
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/kit/chat/page.tsx
  - apps/web/app/kit/chat/mock-data.ts
  - apps/web/app/kit/chat-live/page.tsx
  - apps/web/components/chat/attachments/
  - apps/web/components/chat/chat-container/
  - apps/web/components/chat/chat-header/
  - apps/web/components/chat/chat-input/
  - apps/web/components/chat/conversation-list/
  - apps/web/components/chat/link-preview/
  - apps/web/components/chat/message-actions/
  - apps/web/components/chat/message-list/
  - apps/web/components/chat/message/
  - apps/web/components/chat/notification-badge/
  - apps/web/components/chat/presence-indicator/
  - apps/web/components/chat/skeleton/
  - apps/web/components/chat/unread-divider/
  - apps/web/components/chat/voice-player/
  - apps/web/components/kit/reactions-demo.tsx
  - apps/web/components/chat/bubble/bubble.tsx
  - apps/web/components/chat/bubble/bubble.stories.tsx
  - apps/web/components/chat/index.ts
  - apps/web/components/chat/chat.test.tsx
  - apps/web/components/chat/story-data.ts
  - scripts/seed.ts
autonomous: true
requirements: [QAG-cleanup, QAG-seed]

must_haves:
  truths:
    - "The dev-only 1:1 chat kit demo pages no longer exist and are not routable"
    - "Every kit-only chat component directory is deleted from the repo"
    - "Production chat (chat-client.tsx, channels/[id], profile, coach-card) still typechecks, lints, tests, and builds after the removal"
    - "The bubble module still exports getBubbleRadiusClasses but no longer exports the Bubble component"
    - "Re-running the seed inserts real long-form community messages into the general channel idempotently"
  artifacts:
    - path: "apps/web/components/chat/bubble/bubble.tsx"
      provides: "getBubbleRadiusClasses helper only (Bubble component removed)"
      contains: "export function getBubbleRadiusClasses"
    - path: "apps/web/components/chat/index.ts"
      provides: "Trimmed barrel exporting only surviving modules"
    - path: "scripts/seed.ts"
      provides: "Real long-form community message seeding step"
      contains: "demoCommunityConversationId"
  key_links:
    - from: "apps/web/app/(authenticated)/chat/chat-client.tsx"
      to: "apps/web/components/chat/index.ts"
      via: "named imports (Avatar, Composer, EmojiPickerButton, getBubbleRadiusClasses, MessageBody, MessageMeta, MessageStatus, QuotedMessage, Reactions, SearchFilterPopover, TypingIndicator)"
      pattern: "getBubbleRadiusClasses"
    - from: "scripts/seed.ts"
      to: "public.messages"
      via: "service-role insert/upsert on demoCommunityConversationId"
      pattern: "onConflict.*conversation_id,client_request_id"
---

<objective>
Remove the entire dead dev-only chat "kit" (the outdated 1:1-messaging mock demo) and its
kit pages, then replace it with real long-form seed messages inserted directly into the
community "general" channel conversation in the database. The product has moved to a
Discord-like community/channel chat; the kit demo and its many mock components are dead code
that only the deleted kit pages referenced. Production chat imports a small curated subset
from the same `@/components/chat` barrel — that subset must keep working untouched.

Purpose: Delete dead surface area so the chat component directory reflects only what
production uses, and make the real community chat visually exercise long/rich text via seeded
messages.
Output: A trimmed `components/chat/`, a surgically edited `bubble.tsx`, a trimmed barrel/test/
story-data, and a new idempotent message-seeding step in `scripts/seed.ts`.
</objective>

<execution_context>
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/workflows/execute-plan.md
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./AGENTS.md
@./CLAUDE.md

<interfaces>
<!-- Extracted from codebase. Use directly — no exploration. -->

Production imports from `@/components/chat` (apps/web/app/(authenticated)/chat/chat-client.tsx)
— ALL must keep working after the trim:
  Avatar, Composer, EmojiPickerButton, getBubbleRadiusClasses, MessageBody, MessageMeta,
  MessageStatus, QuotedMessage, Reactions, SearchFilterPopover, TypingIndicator

Other production importers (must keep working):
  apps/web/app/(authenticated)/profile/page.tsx        → Avatar from "@/components/chat/avatar/avatar"
  apps/web/components/profile/coach-card.tsx            → Avatar from "@/components/chat/avatar/avatar"
  apps/web/app/(authenticated)/channels/[id]/page.tsx  → EmptyState from "@/components/chat"

bubble.tsx currently exports: getBubbleRadiusClasses (KEEP), BubbleRadiusOptions (KEEP),
Bubble component (REMOVE), BubbleProps interface (REMOVE).

public.messages columns for a direct insert (from supabase/migrations/0010_chat.sql +
0013_realtime_chat_features.sql):
  conversation_id uuid  (→ demoCommunityConversationId)
  sender_id uuid        (→ a seeded profile id)
  sender_role text      (check: in ('client','coach') — MUST match the sender identity's real role)
  body text             (check: char_length(btrim(body)) > 0 AND char_length(body) <= 4000)
  client_request_id text (unique per conversation_id — constraint messages_conversation_client_request_unique)
  reply_to_message_id uuid null (optional)
  created_at timestamptz default now()

Seeded identities available in scripts/seed.ts main(): coachId (Coach Dana, role coach),
coach2Id (Coach Jordan, role coach), clientIds[] (Alex Rivera / Sam Okafor / Priya Nair, role client).
demoCommunityConversationId = "11111111-1111-4111-8111-111111111111" (the general channel conversation).
Seed run command: `pnpm seed` (root) → node --experimental-strip-types --env-file=apps/web/.env.local scripts/seed.ts

MessageBody markdown subset to exercise in seed bodies (apps/web/components/chat/message-body/message-body.tsx):
  bold **x**, italic *x* / _x_, inline `code`, fenced ```lang code blocks, headings # ## ###,
  blockquote >, bullet + numbered lists (with nesting), links [text](url).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete dead kit pages + components, and trim barrel / test / story-data / bubble</name>
  <files>
apps/web/app/kit/chat/ (whole dir), apps/web/app/kit/chat-live/ (whole dir),
apps/web/components/chat/attachments/, chat-container/, chat-header/, chat-input/,
conversation-list/, link-preview/, message-actions/, message-list/, message/,
notification-badge/, presence-indicator/, skeleton/, unread-divider/, voice-player/,
apps/web/components/kit/reactions-demo.tsx,
apps/web/components/chat/bubble/bubble.stories.tsx,
apps/web/components/chat/bubble/bubble.tsx,
apps/web/components/chat/index.ts,
apps/web/components/chat/chat.test.tsx,
apps/web/components/chat/story-data.ts
  </files>
  <action>
Execute the pre-derived dead-code removal. Do NOT re-derive what is dead — the map below is authoritative.

DELETE these entirely (each directory including its .tsx, .stories.tsx, .test.tsx, index.ts):
apps/web/app/kit/chat/, apps/web/app/kit/chat-live/, and under apps/web/components/chat/:
attachments/, chat-container/, chat-header/, chat-input/, conversation-list/, link-preview/,
message-actions/, message-list/, message/ (the kit's Message component — NOT message-body/,
message-meta/, or message-status/), notification-badge/, presence-indicator/, skeleton/,
unread-divider/, voice-player/. Also delete apps/web/components/kit/reactions-demo.tsx and
apps/web/components/chat/bubble/bubble.stories.tsx. After deleting kit/chat and kit/chat-live,
confirm those two now-empty parent directories are gone (rm -r removes them).

DO NOT delete or touch: avatar/, composer/, emoji-picker/, empty-state/, message-body/,
message-meta/, message-status/, quoted-message/, reactions/, search-filters/, typing-indicator/,
types.ts, apps/web/app/kit/page.tsx, apps/web/components/kit/theme-toggle.tsx (+ its test/story).
composer/ and search-filters/ carry uncommitted WIP — do not disturb them.

EDIT apps/web/components/chat/bubble/bubble.tsx: remove the `Bubble` forwardRef component and the
`BubbleProps` interface entirely. Keep `getBubbleRadiusClasses` and the `BubbleRadiusOptions`
interface it uses. Remove the now-unused `forwardRef` and `HTMLAttributes` imports from react
(keep only what getBubbleRadiusClasses needs — the `cn` import stays).

EDIT apps/web/components/chat/index.ts: remove the `export *` lines for every deleted directory
(attachments, chat-container, chat-header, chat-input, conversation-list, link-preview,
message-actions, message-list, message, notification-badge, presence-indicator, skeleton,
unread-divider, voice-player). The barrel must end up exporting only: avatar, bubble, composer/composer,
emoji-picker, empty-state, message-body, message-meta, message-status (named), quoted-message,
reactions, search-filters, typing-indicator, and the surviving `./types` re-exports. Since bubble.tsx
no longer exports a `Bubble` component, `export * from "./bubble"` is safe (it re-exports only the
helper + type). For the `./types` re-export block: run
`grep -rn "from \"./types\"\|from \"../types\"\|components/chat/types" apps/web/components/chat apps/web/app apps/web/lib`
to see which of {Attachment, ChatMessageView, ChatParticipantView, MessageStatus, Reaction} are still
imported anywhere after the deletions, and trim the barrel's `export type { ... } from "./types"` list
to only those still referenced (keep MessageStatus as MessageStatusValue if MessageStatus is used).
Do NOT delete types.ts itself.

EDIT apps/web/components/chat/chat.test.tsx: remove the import lines and the `describe` blocks for the
deleted components — Bubble (component), Message, ChatInput, MessageList, MessageActions,
PresenceIndicator, NotificationBadge, ConversationList — and remove the final "chat barrel export"
describe that asserts ChatKit.ChatContainer / ConversationList / Bubble. Keep the describe blocks for
Avatar, MessageStatus, TypingIndicator, Reactions, MessageMeta, EmptyState. Remove now-unused imports
(Bubble, ChatInput, ConversationList + ConversationSummary type, Message, MessageActions, MessageList,
NotificationBadge, PresenceIndicator, `* as ChatKit`) and any now-unused fixtures (baseMessage,
conversations) that only the removed describes used. Keep imports the surviving describes need.

EDIT apps/web/components/chat/story-data.ts: trim to only the `reactions` export. Remove the coach,
client, attachments, linkPreview, messages, and conversations exports and their now-unused type imports
(keep only `import type { Reaction } from "./types";`). Note: `reactions` currently references `byMe`
inline literals, so it needs no other export.
  </action>
  <verify>
    <automated>cd /Users/franz/Work/Personal/fish && ! ls apps/web/app/kit/chat 2>/dev/null && ! ls apps/web/app/kit/chat-live 2>/dev/null && ! ls apps/web/components/chat/message 2>/dev/null && grep -q "getBubbleRadiusClasses" apps/web/components/chat/bubble/bubble.tsx && ! grep -q "export const Bubble" apps/web/components/chat/bubble/bubble.tsx && echo OK</automated>
  </verify>
  <done>All listed directories/files deleted; bubble.tsx keeps only getBubbleRadiusClasses + BubbleRadiusOptions; index.ts, chat.test.tsx, and story-data.ts trimmed to surviving surface. apps/web/app/kit/page.tsx and theme-toggle.tsx untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Add real long-form community seed messages to scripts/seed.ts</name>
  <files>scripts/seed.ts</files>
  <action>
ADD one new function `seedCommunityMessages(coachId, coach2Id, clientIds)` and call it from `main()`
immediately AFTER `await seedChatConversations(...)`. Do NOT modify upsertUser, promoteToCoach,
assignClient, backfillClientProfile, or the existing body of seedChatConversations — only ADD.

The new function inserts real, long-form seed messages directly into `public.messages` via the existing
service-role `supabase` client (bypass the `send_chat_message` RPC — it requires a real auth.uid() session
the service-role client does not have). Insert for `demoCommunityConversationId` (the general channel).

For each message build a row object: { conversation_id: demoCommunityConversationId, sender_id, sender_role,
body, client_request_id }. Do NOT set id or created_at (defaults). Author messages across the seeded
identities — coachId (sender_role 'coach'), coach2Id (sender_role 'coach'), and each of clientIds
(sender_role 'client'). CRITICAL: sender_role MUST match the identity's real role — coach ids use 'coach',
client ids use 'client'.

Use FIXED deterministic client_request_id values so re-running is idempotent: "seed-msg-01", "seed-msg-02", …
Insert with a single upsert:
`await supabase.from("messages").upsert(rows, { onConflict: "conversation_id,client_request_id" })`
(the unique constraint messages_conversation_client_request_unique is on (conversation_id, client_request_id)).
Throw on error, and console.log a short summary line (e.g. count inserted) consistent with the file's style.

Content requirements — the bodies are real verbatim English-learning community discussion posts (calm, on
the product's neurodivergent-professional theme), and MUST respect DB constraints:
  - body non-blank; every body char_length(body) <= 4000.
  - Include SEVERAL really long messages close to (but under) the 4000-char ceiling — long-form multi-paragraph
    posts. Keep each safely under 4000 (aim ~3400-3800 chars). Verify each literal length by eye/count.
  - Include a range of medium-length messages and a couple of short one-liners.
  - Exercise the MessageBody markdown subset across the set: bold **x**, italic *x*/_x_, inline `code`,
    a fenced ```lang code block, headings # ## ###, a blockquote >, bullet and numbered lists (with one
    nested list), and links [text](url). Distribute these across messages; the long ones should combine
    several (headings + lists + bold + a code block + a link) so the real chat now visually renders rich text.
Aim for roughly 8-12 messages total so the general channel reads like a lived-in thread.

Store bodies as ordinary string literals (template literals are fine for multi-line). This is a TS script
compiled by tsc/strip-types — it must typecheck without a live Supabase instance.
  </action>
  <verify>
    <automated>cd /Users/franz/Work/Personal/fish && grep -q "seedCommunityMessages" scripts/seed.ts && grep -q "onConflict: \"conversation_id,client_request_id\"" scripts/seed.ts && node --experimental-strip-types --check scripts/seed.ts && echo OK</automated>
  </verify>
  <done>scripts/seed.ts defines seedCommunityMessages, called from main() after seedChatConversations, inserting 8-12 real long-form/rich-text messages (some near 4000 chars) into demoCommunityConversationId with matching sender_role and deterministic client_request_ids via idempotent upsert. No other function changed. Script strip-type-checks clean.</done>
</task>

<task type="auto">
  <name>Task 3: Full-repo verification sweep</name>
  <files>(no source edits — verification only)</files>
  <action>
Run the full CLI verification gauntlet from the repo root /Users/franz/Work/Personal/fish. No browser
preview (explicit user constraint) — CLI only. Fix any fallout that traces to the removals (e.g. a missed
import of a deleted component); do NOT expand scope to unrelated pre-existing WIP.

1. Dead-reference grep sweep. Confirm ZERO remaining references (excluding node_modules and .next) to every
   deleted path/component name. Run and expect no matches (grep -r returns non-zero / empty):
   `grep -rn --exclude-dir=node_modules --exclude-dir=.next -E "kit/chat-live|kit/chat/|reactions-demo|chat/attachments|chat/chat-container|chat/chat-header|chat/chat-input|chat/conversation-list|chat/link-preview|chat/message-actions|chat/message-list|chat/message/|chat/notification-badge|chat/presence-indicator|chat/skeleton|chat/unread-divider|chat/voice-player|ChatContainer|ConversationList|NotificationBadge|PresenceIndicator|MessageActions|MessageList|\\bChatInput\\b|bubble.stories" apps packages supabase scripts`
   Note: matches inside message-body/, message-meta/, message-status/, quoted-message/ that merely contain
   the substring "message" in a KEPT path are fine — inspect any hit and confirm it is a surviving module,
   not a reference to a deleted one. Also confirm no import of the removed `Bubble` component remains:
   `grep -rn --exclude-dir=node_modules --exclude-dir=.next -E "\\bBubble\\b" apps/web` should only show
   getBubbleRadiusClasses / BubbleRadiusOptions usages, never a `<Bubble` JSX tag or `Bubble` import.

2. `pnpm --filter @fish/web typecheck`
3. `pnpm --filter @fish/web lint`
4. `pnpm --filter @fish/web test --run`
5. `pnpm build`

All five must pass clean. If any fails due to a leftover reference to deleted code, fix the reference and
re-run that step.
  </action>
  <verify>
    <automated>cd /Users/franz/Work/Personal/fish && pnpm --filter @fish/web typecheck && pnpm --filter @fish/web lint && pnpm --filter @fish/web test --run && pnpm build</automated>
  </verify>
  <done>Grep sweep shows no live references to any deleted path/component; typecheck, lint, web tests, and full build all pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| seed script → Supabase (service role) | scripts/seed.ts uses SUPABASE_SERVICE_ROLE_KEY, bypasses RLS; local dev only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-qag-01 | Elevation | seed.ts direct message insert (RLS-bypassing service role) | accept | Local-only dev seed (documented in file header, D-10); never run against production per docs/deploy-checklist.md. No new key exposure — reuses the existing service-role client already in the file. |
| T-qag-02 | Tampering | seeded message bodies | mitigate | Bodies are static string literals authored in-repo; respect DB CHECK constraints (non-blank, <=4000, sender_role in ('client','coach')); idempotent upsert on deterministic client_request_id prevents duplicate rows on re-run. |
</threat_model>

<verification>
Automated (blocking, run in Task 3): dead-reference grep sweep, `pnpm --filter @fish/web typecheck`,
`pnpm --filter @fish/web lint`, `pnpm --filter @fish/web test --run`, `pnpm build`.

Manual follow-up (NOT a blocking automated check — out of scope for this plan): running `pnpm seed`
against a live local Supabase instance (`supabase start`) to confirm the new messages insert and render
in the general channel. The seed data must be read through once by eye to confirm every long body stays
under the 4000-char ceiling, is non-blank, uses a valid sender_role matching its identity, and carries a
unique client_request_id — this is done during Task 2, not gated on a running DB.
</verification>

<success_criteria>
- All dead kit pages and kit-only chat component directories are deleted.
- bubble.tsx exports getBubbleRadiusClasses (+ BubbleRadiusOptions) and no longer exports Bubble/BubbleProps.
- index.ts barrel, chat.test.tsx, and story-data.ts are trimmed to the surviving surface; types.ts retained.
- scripts/seed.ts gains an idempotent seedCommunityMessages step with real long/rich-text messages; no other seed function changed.
- Grep sweep finds no live references to deleted code; typecheck + lint + web tests + full build all pass.
- apps/web/app/kit/page.tsx, theme-toggle.tsx, and all pre-existing WIP files are untouched.
</success_criteria>

<output>
Create `.planning/quick/260709-qag-remove-the-dev-only-chat-kit-entirely-an/260709-qag-SUMMARY.md` when done
</output>
