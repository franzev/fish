---
id: 260708-knl
type: quick
description: Align community reply preview with the reference — avatar on the author header row, spline curving from avatar into the preview
created: 2026-07-08
status: complete
---

# Quick Task 260708-knl: Reply preview alignment fix

## Context

In the community feed, a message with a reply currently renders its avatar
level with the reply-preview line, and the connector collapses into a short
dash between the two avatars. The reference places the avatar beside the
author header (below the preview) with a spline that rises from the avatar's
center and curves into the preview line.

## Tasks

### Task 1 — Fix alignment in ChatClient (tokens only)

Files: `apps/web/app/(authenticated)/chat/chat-client.tsx`

- Push the group avatar down by the preview row's height (`mt-lg`, 24px) when
  a community message has a reply, so it aligns with the `MessageMeta` header.
- Rebuild the spline as an absolutely-positioned corner inside the (now
  `relative`) preview row: `-left-lg top-1/2 w-badge h-sm`, `border-l border-t
  border-border rounded-tl-chat-inner` — rising from the avatar center into
  the preview line.

### Task 2 — Verification

- Vitest suite, lint, build; browser check of the reply row geometry.

Done when: the preview row sits above the header, the avatar aligns with the
author name, and the spline reads as a curve from avatar to preview.
