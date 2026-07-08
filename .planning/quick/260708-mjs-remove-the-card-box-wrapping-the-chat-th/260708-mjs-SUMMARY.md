---
quick_id: 260708-mjs
description: Remove the card/box wrapping the chat thread and restyle message reaction counters to match the Discord reference
date: 2026-07-08
status: complete
---

# Summary — 260708-mjs

## What changed

1. **Chat box removed** — the `<section>` in
   `apps/web/app/(authenticated)/chat/chat-client.tsx` dropped
   `mx-auto max-w-chat overflow-hidden rounded-card border border-border`;
   the thread now sits directly on the page background and fills the shell
   pane, matching the Discord reference. The kit `ChatContainer`
   (`apps/web/components/chat/chat-container/chat-container.tsx`) dropped its
   equivalent `md:` box classes, and its doc comment was updated.

2. **Compact reaction pills** — `apps/web/components/chat/reactions/reactions.tsx`
   pills went from 56px-tall bordered controls to 24px chips:
   `rounded-pill px-xs py-2xs gap-2xs` on `bg-surface-2`. Border is
   transparent at rest (appears on hover); the viewer's own reaction keeps
   `border-border-strong text-foreground`. Monochrome only.

## Notable findings

- `cn()`/tailwind-merge has no font-size class group for the custom
  `text-ui-*` scale, so `text-ui-xs` on the pill button was silently dropped
  when combined with `text-body`/`text-foreground` (pre-existing bug).
  Worked around by putting sizes on the inner emoji/count spans. Global fix
  flagged as a follow-up task (register the scale in
  `apps/web/lib/utils.ts` extendTailwindMerge config).
- Deliberate deviation from the 56px control floor at the user's explicit
  request; reactions are a secondary affordance and the hover action bar
  keeps larger targets for toggling.
- `.claude/launch.json` "web" config switched to autoPort so preview servers
  can coexist with a user-run dev server on 3001.

## Verification

- `pnpm build` passes (root: core, supabase, web).
- `pnpm test` in apps/web: 49 files, 375 tests passed.
- Visual check on /kit/chat production preview: pills render 24px compact
  chips; ChatContainer renders borderless (the border visible in the kit is
  the showcase demo frame, not the component).
