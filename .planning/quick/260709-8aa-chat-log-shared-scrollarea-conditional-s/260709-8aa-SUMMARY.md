---
phase: quick-260709-8aa
plan: 01
status: complete
subsystem: chat
tags: [chat, scroll-area, ux, base-ui]
requirements: [QUICK-260709-8aa]
dependency-graph:
  requires:
    - "@base-ui/react ScrollArea (shared ui/scroll-area component)"
    - "useChatMessages LocalMessage type"
  provides:
    - "ScrollArea viewportRef prop (backward-compatible)"
    - "useStickToBottom hook (conditional stick-to-bottom + new-messages signal)"
    - "Chat log with shared monochrome scrollbar and New messages pill"
  affects:
    - "apps/web/app/(authenticated)/chat/chat-client.tsx log region"
tech-stack:
  added: []
  patterns:
    - "Conditional stick-to-bottom: mount jump, own-send follow, near-bottom stick (100px), pill otherwise"
    - "ResizeObserver re-pin for content growth (typing indicator) while near bottom"
    - "prefers-reduced-motion forces instant programmatic scrolls"
key-files:
  created:
    - apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts
  modified:
    - apps/web/components/ui/scroll-area/scroll-area.tsx
    - apps/web/app/(authenticated)/chat/chat-client.tsx
decisions:
  - "Pill shadow uses the project token shadow-popover (floating-element shadow) instead of Tailwind default shadow-sm"
  - "Empty-state centering switched from min-h-full to flex-1 inside the new min-h-full flex-col log wrapper"
  - "Hook receives full messages array, not filteredMessages, so search never triggers scroll logic"
metrics:
  duration: 10min
  tasks: 2
  files: 3
  completed: 2026-07-09
---

# Quick Task 260709-8aa: Chat Log Shared ScrollArea + Conditional Stick-to-Bottom Summary

Chat log now renders in the shared thin monochrome ScrollArea with calm conditional stick-to-bottom: instant open at newest, own sends always follow, incoming messages while scrolled up raise a "New messages" pill instead of yanking the reader.

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | viewportRef on ScrollArea + useStickToBottom hook | 3e9d5fdf |
| 2 | Wire chat log to ScrollArea + New messages pill | b9d76d0e |

## What Was Built

- **ScrollArea** (`apps/web/components/ui/scroll-area/scroll-area.tsx`): optional `viewportRef?: Ref<HTMLDivElement>` forwarded to `BaseScrollArea.Viewport`. Existing callers (emoji picker) unaffected.
- **useStickToBottom** (`apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts`): named export returning `{ viewportRef, showNewMessages, scrollToBottom }`.
  - Layout effect jumps to bottom instantly on mount (no animation on first paint).
  - Passive scroll listener tracks near-bottom (`scrollHeight - scrollTop - clientHeight <= 100`); reaching bottom clears the pill.
  - Message-growth effect: own send or near-bottom → scroll; otherwise set `showNewMessages`, never scroll.
  - ResizeObserver on viewport content re-pins instantly while near bottom (typing indicator growth).
  - `scrollToBottom` defaults to smooth but forces `"auto"` under `prefers-reduced-motion: reduce`; also clears the pill.
- **chat-client.tsx**: log region replaced with relative wrapper + `ScrollArea className="flex-1" viewportRef viewportClassName="px-md py-md"`; `role="log"` + aria-label preserved on an inner `min-h-full flex flex-col` wrapper; community full-bleed `-mx-md px-md` hover rows still work since `px-md` lives on the viewport. New messages pill: real button, `min-h-control` (56px floor), token-only classes (`bottom-sm`, `gap-2xs`, `px-md`, `rounded-pill`, `shadow-popover`), Tabler `IconArrowDown`, calm copy. Send button also calls `scrollToBottom()` before `handleSend()`; Enter-key sends covered by the hook's own-send detection.

## Deviations from Plan

**1. [Rule 2 - adjustment] `shadow-sm` replaced with `shadow-popover`** — the plan flagged verifying the shadow; the project defines `--shadow-popover` as the floating-element shadow token, so it was used instead of Tailwind's default (token-only styling rule).

**2. [Minor] Empty-state uses `flex-1` instead of `min-h-full`** — inside the new `min-h-full flex-col` log wrapper, `flex-1` is the reliable way to keep "No messages yet" centered; explicitly permitted by the plan.

No other deviations — plan executed as written.

## Verification

- `pnpm build` passes (includes package typechecks).
- `grep -c viewportRef scroll-area.tsx` = 3 (≥ 2); `grep -c useStickToBottom chat-client.tsx` = 2 (≥ 1).
- No raw hex, no numeric one-off spacing utilities in the diff.
- `apps/web/app/kit/chat-live/page.tsx` untouched — still modified-but-uncommitted (user's pre-existing `min-h-0` edit preserved).

## Human Verification Remaining

At `/kit/chat-live`: open-at-bottom with thin scrollbar; send → smooth scroll; scrolled-up incoming → pill, position holds; pill click / manual bottom → pill hides; reduced motion → instant scrolls.

## Self-Check: PASSED

- FOUND: apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts
- FOUND: commit 3e9d5fdf
- FOUND: commit b9d76d0e
