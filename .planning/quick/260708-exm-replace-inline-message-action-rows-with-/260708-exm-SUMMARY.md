---
id: 260708-exm
type: quick
description: Replace inline message action rows with hover-revealed action bar following the community design reference
completed: 2026-07-08
status: complete
commit: a8df0c45
---

# Summary — Hover-revealed message action bar

## What changed

- Message rows in [chat-client.tsx](<../../../apps/web/app/(authenticated)/chat/chat-client.tsx>)
  are `group relative`; the reply/react/edit/delete buttons moved from an
  always-visible strip under each message into an absolutely-positioned bar at
  the row's top-right (`bg-surface border-border rounded-control p-3xs`).
- Revealed on `group-hover` **and** `focus-within` via opacity +
  pointer-events (not `display`), so the buttons stay keyboard-reachable and
  the bar stays open while any of them has focus.
- The raw 👍 emoji glyph is now Tabler `IconThumbUp` — single icon set,
  monochrome; the reaction sent is still "👍" (backend emoji whitelist
  unchanged).
- Buttons are `size-10` (40px), matching the avatar scale. This trades the
  56px `--size-control` floor for the reference's compact hover bar — a
  deliberate deviation; hover bars are pointer-driven so the floor matters
  less, but flagged for design review.

## Verification

- 375 tests, lint, `pnpm build` all green (aria-labels unchanged, so existing
  interaction tests still pass).
- Browser-verified: rows clean at rest; bar appears on focus (programmatic
  focus → opacity 1, pointer-events auto) and hover.
