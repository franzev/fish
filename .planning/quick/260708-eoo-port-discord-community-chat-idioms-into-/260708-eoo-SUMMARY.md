---
id: 260708-eoo
type: quick
description: Port Discord community-chat idioms into ChatClient using existing FISH design tokens only
completed: 2026-07-08
status: complete
commit: cb088b0a
---

# Summary — Discord idioms → FISH tokens

## What changed

- **Reply previews** ([chat-client.tsx](<../../../apps/web/app/(authenticated)/chat/chat-client.tsx>)):
  community replies render the Discord idiom — a gutter spline
  (`border-l border-t border-border rounded-tl-chat-inner`, sized `ml-lg`/`w-lg`/`h-xs`),
  an `xs` Avatar, the original author, and a single-line truncated snippet —
  above the author header. Replies always restate their author group. Direct
  chat keeps `QuotedMessage` untouched.
- **Day dividers**: hairline `bg-border` rules flanking a `text-ui-2xs text-muted`
  date label between calendar days.
- **Coach pill** ([message-meta.tsx](../../../apps/web/components/chat/message-meta/message-meta.tsx)):
  optional `tag` prop rendering a `bg-surface-2 rounded-pill text-ui-2xs` chip —
  role signaled by shape, not hue (monochrome rule).
- **Hover band**: community rows get full-width `hover:bg-surface` via
  `-mx-md px-md` bleed.
- **Avatar** ([avatar.tsx](../../../apps/web/components/chat/avatar/avatar.tsx)):
  new `xs` size riding the existing `--spacing-badge` token (`size-badge`).

## Constraint honored

Zero new colors, type sizes, spacing values, or radii — every value maps to an
existing `@theme` token in `globals.css`.

## Verification

- 375 tests green (new: day divider, coach pill, inline reply preview).
- `pnpm lint` + `pnpm build` pass.
- Browser-verified against local Supabase: divider between July 5/July 8
  messages, Coach pill on Coach Dana, reply spline row on a coach reply.
