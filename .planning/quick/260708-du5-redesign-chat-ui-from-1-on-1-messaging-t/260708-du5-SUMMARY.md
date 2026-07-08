---
id: 260708-du5
type: quick
description: Redesign chat UI from 1-on-1 messaging to community-room (Discord-like) experience
completed: 2026-07-08
status: complete
commit: 4e9d52c4
---

# Summary — Community-room chat UI redesign

## What changed

- **Navigation shell** ([app-shell.tsx](../../../apps/web/components/shell/app-shell.tsx)):
  "Messages" → "Community" for client and coach navs, `IconUsersGroup` icon
  (coach's `IconUsers` Clients item stays distinct).
- **ChatClient** ([chat-client.tsx](<../../../apps/web/app/(authenticated)/chat/chat-client.tsx>)):
  - Community kind renders a Discord-idiom feed: every message (own included)
    is a left-aligned row with an avatar column and a `MessageMeta`
    (author + timestamp) header at each group start; flat monochrome text
    instead of mine-right primary bubbles.
  - Room header shows a member count (read states ∪ senders ∪ self) instead
    of the 1-on-1 presence line; per-participant "seen" ticks are dropped in
    rooms (sending/failed + Retry kept).
  - Community empty copy: "No messages yet. Say hello to the community."
  - Direct (`kind: "direct"`) rendering unchanged — kind-conditional.
- **Chat page** ([page.tsx](<../../../apps/web/app/(authenticated)/chat/page.tsx>)):
  no-room empty state reframed to community copy.
- **Committed alongside** (pre-existing in-flight data layer the UI depends
  on): demo community migration 0014, sender display names in core.ts /
  actions.ts / types.ts, community seed data.

## Verification

- Full web vitest suite: 49 files / 374 tests green (includes new community
  feed tests: member count, "You" authoring, no `bg-primary` bubble, no
  right alignment).
- `pnpm lint` and `pnpm build` pass.
- Manual browser verification against local Supabase (migrations 0011–0014
  applied, seeded): room header ("FISH Community", "5 members"), multi-author
  feed (Sam Okafor / You / Coach Dana rows with avatars + timestamps),
  send round-trip persisted to Postgres.

## Deviations / notes

- GSD subagents are not installed in this environment (`agents_installed:
  false`), so planning/execution ran inline in the orchestrator with the same
  artifacts and commit discipline.
- Local dev DB migration history was repaired (0008/0009 marked reverted —
  files removed from repo; 0013 marked applied — objects pre-existed) so
  0014 could apply.
- `.claude/launch.json` gained a `web-preview` (`next start`, autoPort)
  config because Next 16 allows one dev server per app dir and another
  session held the lock.
- Design-rule check: one primary action per screen holds (Send); community
  rows removed the second `bg-primary` surface; 56px targets and calm copy
  preserved.
