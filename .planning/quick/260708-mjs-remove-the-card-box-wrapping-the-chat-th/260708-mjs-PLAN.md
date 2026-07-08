---
quick_id: 260708-mjs
description: Remove the card/box wrapping the chat thread and restyle message reaction counters to match the Discord reference
date: 2026-07-08
status: planned
---

# Quick Task 260708-mjs: Unbox the chat + compact reaction pills

## Context

User provided a Discord screenshot as the reference. Two complaints:

1. The chat thread is wrapped in a card (rounded border box, centered at
   `max-w-chat`). The reference sits the conversation directly on the page
   background with no wrapping box.
2. Reaction counters "look awful" — they currently render as 56px-tall
   (`min-h-control`) bordered pills, which reads as giant buttons. The
   reference shows a compact emoji+count pill (~24-28px) on a subtle
   surface background, with a border only on the viewer's own reaction.

## Tasks

### Task 1 — Remove the box wrapping the chat

**Files:**
- `apps/web/app/(authenticated)/chat/chat-client.tsx` (real screen, line ~205)
- `apps/web/components/chat/chat-container/chat-container.tsx` (kit shell, same pattern)

**Action:** Drop `rounded-card border border-border overflow-hidden` (and the
`max-w-chat mx-auto` centering) from the chat `<section>` so the thread sits
directly on the page background and fills the shell pane. Keep the internal
column flex, header, and composer intact. Mirror in the kit `ChatContainer`
(`md:mx-auto md:max-w-content md:rounded-card md:border md:border-border`).

**Verify:** `pnpm build` passes; chat page renders with no border/rounding
around the thread.

### Task 2 — Compact Discord-style reaction pills

**Files:**
- `apps/web/components/chat/reactions/reactions.tsx`

**Action:** Replace `min-h-control ... px-md` with a compact pill:
`rounded-pill px-xs py-2xs text-ui-xs gap-2xs`, subtle `bg-surface-2`
background with a transparent border at rest (border shows on hover),
`border-border-strong` + `text-foreground` when `byMe`. Monochrome only —
no color hues. Keep aria-label/aria-pressed semantics and the pop animation.

**Note:** This deliberately deviates from the 56px control floor at the
user's explicit request (replicate the reference geometry); reactions are a
secondary affordance, and the primary toggle path (hover action bar) keeps
larger targets.

**Verify:** `pnpm build` passes; pills render compact with emoji + count.
