---
id: 260708-eoo
type: quick
description: Port Discord community-chat idioms into ChatClient using existing FISH design tokens only
created: 2026-07-08
status: complete
---

# Quick Task 260708-eoo: Discord idioms → FISH tokens

## Context

Sketch 008 recreated the Discord message-list reference verbatim (Discord hex,
gg sans). User direction: do not invent colors, typography, or spacing — the
production port must use only the existing tokens in `apps/web/app/globals.css`.
The community feed already has the flat author-row structure; this task ports
the remaining idioms from the reference in monochrome.

## Tasks

### Task 1 — Community feed idioms in ChatClient (tokens only)

Files: `apps/web/app/(authenticated)/chat/chat-client.tsx`, `apps/web/components/chat/message-meta/message-meta.tsx`

- Full-width hover band on community rows: `hover:bg-surface` with `-mx-md px-md`
  bleed (container already pads `px-md`).
- Reply context row (Discord spline idiom) for community replies: connector
  built from `border-l border-t border-border rounded-tl-chat-inner` sized with
  spacing tokens (`ml-md w-lg h-xs`), mini `Avatar`, author name, single-line
  ellipsis preview (`text-ui-xs text-muted`); direct chat keeps `QuotedMessage`.
- Date divider between calendar days: `border-t border-border` rules flanking a
  centered `text-ui-2xs text-muted` label ("July 6, 2026" format).
- Role tag: monochrome "Coach" pill (`bg-surface-2 rounded-pill text-ui-2xs`)
  after the author name in community rows — ports Discord's role pill without
  role colors (hierarchy before color).

### Task 2 — Tests + verification

Files: `apps/web/app/(authenticated)/chat/chat-client.test.tsx`

- Assert date divider renders between different-day messages, coach pill on
  coach-authored community rows, and reply preview row for community replies.
- Full vitest suite, lint, build; visual check in the browser preview.

Done when: community feed shows hover bands, spline reply previews, day
dividers, and coach pills — all from existing tokens; suites and build green.
