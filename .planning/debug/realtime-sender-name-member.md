---
status: resolved
trigger: "User reported (with screenshot): \"for new realtime message, the user's name is not being displayed properly, I thought this was fixed\" — incoming realtime message renders sender as 'Member' with 'M' avatar instead of the real name"
created: 2026-07-10T12:20:00Z
updated: 2026-07-10T12:20:00Z
---

## Current Focus

hypothesis: The realtime postgres_changes INSERT/UPDATE mapper never populates
  senderDisplayName; every other message path enriches from profiles, so a
  live-received community message renders the "Member" fallback.
test: Trace mapper + all merge paths; enrich realtime message before dispatch,
  fall back to targeted refetch when sender name is unknown.
expecting: Enriched realtime message renders the real name; unit test on the
  resolver + handler passes.
next_action: implement enrichment in use-chat-realtime message handler + test

reasoning_checkpoint:
  hypothesis: "toClientChatMessage (realtime.ts) builds a ClientChatMessage with senderDisplayName undefined; unlike the SSR/refresh/backfill paths it has no profiles enrichment, so chat-client's `senderDisplayName ?? 'Member'` community fallback renders 'Member' permanently."
  confirming_evidence:
    - "realtime.ts toClientChatMessage (lines 107-125) omits senderDisplayName entirely — the postgres_changes payload.new is the bare messages row with no join."
    - "actions.ts addSenderDisplayNames (366-401) + toClientChatMessagesWithSenders enrich every SSR/refresh/backfill row via a profiles lookup; the realtime path calls none of it."
    - "chat-client.tsx:136 getMessageAuthorName = message.senderDisplayName ?? (isCommunity ? 'Member' : chat.participant.displayName) — undefined name in community => 'Member'."
    - "selectors.mergeChatMessage only preserves an EXISTING name; a brand-new realtime insert (existingIndex === -1) is pushed as-is with no name, and nothing refetches it, so 'Member' sticks."
  falsification_test: "If a synthetic INSERT payload dispatched through the real mapper+handler still rendered 'Member' after enrichment, or if enrichment overwrote an already-correct name, the hypothesis/fix would be wrong."
  fix_rationale: "Enrich senderDisplayName at the realtime handler using already-known sources (current user, direct participant, prior loaded messages of the same sender), and fall back to the existing refreshMessages() profiles-enrichment path when the sender is unknown — addresses the missing-enrichment root cause, not the 'Member' symptom."
  blind_spots: "A first-ever message from a sender with no prior loaded messages relies on the async refetch (brief render before it lands); own messages already arrive enriched via the composer so are unaffected."

## Symptoms

expected: |
  A message received live over realtime in /channels/general renders the
  sender's actual display name (e.g. "Franz Eva" or "Patty Cake") and their
  avatar initial, same as messages present at page load.
actual: |
  Screenshot evidence: the incoming realtime message renders author name
  "Member" with an "M" avatar. Timestamp (6:35 PM) and body render fine.
  Messages loaded via SSR/first page show correct names, so this is specific
  to the realtime-received path.
errors: |
  None visible in UI besides the wrong name. Console/network not yet captured.
timeline: |
  Reported 2026-07-10 ~18:35 local, while user was live-testing after Phase 09
  round 4 + the pagination cursor fix (uncommitted, actions.ts). User says
  "I thought this was fixed": a related-but-different quick fix landed
  2026-07-08 (commit 768d08b2, "Fix reaction ack wiping sender name to
  'Member'") — that covered the reaction-ack path, not realtime inserts.
  Unknown whether the realtime-insert path EVER enriched names, or whether a
  Phase 09 refactor (hooks extraction 09-02, store 09-03, realtime cleanup
  09-10/09-16) regressed it.
reproduction: |
  Two authenticated sessions on /channels/general (localhost:3001, seeded
  users Franz Eva / Patty Cake). Send from session A; observe in session B
  without refresh — the new message shows "Member"/"M". After a full page
  refresh the same message presumably shows the correct name (SSR join path).

## Investigation Context (data, verified paths)

- Supabase postgres_changes INSERT payloads carry only the raw messages row
  (sender_id, body, created_at, ...) — no joined profile/display name. Any
  correct rendering requires an enrichment step: participant/profile lookup
  keyed by sender_id (from store/participants slice) or a follow-up fetch.
- Suspect surfaces: apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
  (message-subscription payload → dispatch), the payload→ChatMessage mapping
  (senderName fallback "Member" likely lives there or in a shared mapper),
  packages/core/src/chat-state/selectors.ts mergeChatMessage (how an enriched
  SSR row later reconciles with the realtime-inserted stub), and the
  participants data available in the store at insert time.
- Prior related artifacts: quick fix 768d08b2 (reaction ack wiping sender name
  to "Member" — the ack/merge path preserved names by not overwriting with
  fallback); .planning/debug/loading-new-messages.md (realtime delivery itself
  confirmed working; noted missing avatar/meta was a grouping presentation
  issue, separate from name enrichment).
- Environment: pnpm monorepo; dev origin localhost:3001; local Supabase +
  pnpm seed; community conversation 22222222-2222-4222-8222-222222222222.
- Live reproduction authorized; prefer CLI-observable evidence (unit-level
  dispatch of a synthetic realtime payload through the real mapping code,
  store inspection, Playwright headless two-session capture) over interactive
  browser use.
- NOTE: an uncommitted, user-pending fix exists on the tree in
  apps/web/app/(authenticated)/chat/actions.ts + actions.test.ts (Zod
  offset-timestamp cursor fix from debug session
  couldnt-load-earlier-messages). Do NOT revert or commit those files; keep
  this session's changes in separate files/commits unless the root cause
  genuinely overlaps.

## Evidence

- timestamp: 2026-07-10T12:40:00Z
  checked: apps/web/app/(authenticated)/chat/realtime.ts toClientChatMessage (107-125)
  found: The realtime INSERT/UPDATE mapper builds ClientChatMessage with NO
    senderDisplayName field. The postgres_changes payload.new is the raw
    messages row (no profile join available in Supabase realtime).
  implication: Every live-received message enters the store with
    senderDisplayName === undefined.

- timestamp: 2026-07-10T12:42:00Z
  checked: apps/web/app/(authenticated)/chat/actions.ts addSenderDisplayNames
    (366-401) + toClientChatMessagesWithSenders
  found: SSR fallback, refreshMessages, and backfill all enrich names via a
    `profiles` table lookup keyed by sender_id. The realtime subscription path
    invokes none of these.
  implication: Only the realtime path lacks enrichment — explains why refresh
    (SSR) shows the correct name but the live insert shows "Member".

- timestamp: 2026-07-10T12:44:00Z
  checked: apps/web/app/(authenticated)/chat/chat-client.tsx:136 and
    packages/core/src/chat-state/selectors.ts mergeChatMessage (16-48)
  found: getMessageAuthorName falls back to "Member" for community when
    senderDisplayName is nullish. mergeChatMessage only preserves an existing
    name on re-merge; a first insert (existingIndex === -1) is pushed with the
    undefined name and never subsequently refetched.
  implication: Confirms the "Member" label is permanent for realtime community
    inserts. Direct chats never showed this because their fallback is
    chat.participant.displayName. Not covered by fix 768d08b2 (reaction-ack
    merge only). Realtime insert path was never enriched in community.

## Eliminated

## Resolution

root_cause: |
  The realtime postgres_changes mapper toClientChatMessage (realtime.ts) builds
  a ClientChatMessage with senderDisplayName left undefined — Supabase realtime
  INSERT/UPDATE payloads carry only the bare messages row, no joined profile.
  Every other message path (SSR getAssignedConversation, refreshMessages,
  applyGapBackfill) enriches names from the profiles table; the realtime path
  did not. So a live-received community message reached chat-client's
  getMessageAuthorName (`senderDisplayName ?? "Member"`) with an undefined name
  and rendered "Member" permanently (nothing refetched it). Direct chats were
  unaffected because their fallback is chat.participant.displayName. Not covered
  by prior fix 768d08b2, which only preserved names on the reaction-ack merge.
fix: |
  Enrich the sender display name in the realtime message handler
  (use-chat-realtime.ts) before dispatch via a new resolveRealtimeSenderName
  helper that resolves from already-held names (current user, direct
  participant, or an earlier loaded message from the same sender). When the
  sender is genuinely unknown (no prior loaded message — e.g. a member's first
  message), dispatch the bare message and trigger refreshMessages([id]) to pull
  the enriched row through the same profiles-backed path reactions/SSR use, so
  any transient "Member" self-corrects. Reducer mergeChatMessage already
  preserves existing names, so the follow-up refresh never regresses.
verification: |
  - Added two integration tests in chat-client.test.tsx firing synthetic
    realtime INSERT payloads through the real mock channel: (1) known sender
    resolves the name synchronously with no "Member" row; (2) unknown sender
    triggers refreshMessagesAction([id]) and renders the enriched name.
  - pnpm --filter @fish/web test: 497 passed (61 files).
  - pnpm typecheck: clean. pnpm lint: clean. pnpm build: success.
  - CONFIRMED by user live at /channels/general (2026-07-10): realtime
    message arrives with the real sender name, not "Member".
files_changed:
  - apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
  - apps/web/app/(authenticated)/chat/chat-client.test.tsx
