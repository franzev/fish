---
id: 260708-exm
type: quick
description: Replace inline message action rows with hover-revealed action bar following the community design reference
created: 2026-07-08
status: complete
---

# Quick Task 260708-exm: Hover-revealed message action bar

## Context

The message actions (reply / 👍 emoji / edit / delete) currently render as an
always-visible row of 56px icon buttons under every message — visual noise on
every row, and the raw emoji glyph breaks the Tabler-only icon rule. The
Discord reference (sketch 008) shows clean rows with actions in a compact bar
that appears only on row hover.

## Tasks

### Task 1 — Floating action bar in ChatClient (tokens only)

Files: `apps/web/app/(authenticated)/chat/chat-client.tsx`

- Make each message row a `group relative`; move the action buttons into an
  absolutely-positioned bar at the row's top-right
  (`bg-surface border border-border rounded-control p-3xs`).
- Reveal on `group-hover` and `focus-within` via opacity + pointer-events so
  keyboard users can still tab to the buttons.
- Replace the 👍 emoji glyph with Tabler `IconThumbUp` (the reaction sent is
  still "👍"); keep reply/edit/delete icons and aria-labels unchanged.
- Buttons `size-10` (40px, matching the Avatar md scale) — compact like the
  reference while staying comfortably tappable.

### Task 2 — Verification

- Full vitest suite, lint, build; browser check of hover/focus reveal.

Done when: message rows are clean at rest, actions appear on hover/focus in a
monochrome bar, all suites and build green.
