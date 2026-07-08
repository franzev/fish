---
id: 260708-knl
type: quick
description: Align community reply preview with the reference — avatar on the author header row, spline curving from avatar into the preview
completed: 2026-07-08
status: complete
commit: 0146deba
---

# Summary — Reply preview alignment fix

## What changed

In [chat-client.tsx](<../../../apps/web/app/(authenticated)/chat/chat-client.tsx>):

- The group avatar now drops by the preview row's height (`mt-lg`) when a
  community message carries a reply, so it aligns with the author header
  (`MessageMeta`) instead of sitting level with the preview line.
- The connector spline is an absolutely-positioned corner inside the preview
  row (`-left-lg top-compact w-badge h-sm`, `border-l border-t border-border
  rounded-tl-chat-inner`) rising from the avatar centre into the preview —
  replacing the inline "dash" that collapsed between the two avatars.
- `top-1/2` was rejected by the repo's design-token guard test; replaced with
  `top-compact` (10px — the 20px preview row's midline). Every value is an
  existing token.

## Verification

- 375 tests, lint, `pnpm build` green (the token-guard test caught and forced
  the `top-compact` substitution).
- Browser-verified: spline rises from Coach Dana's avatar into the
  "Sam Okafor — Hi Alex!…" preview; avatar aligned with the author name.
