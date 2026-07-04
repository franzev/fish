---
quick_id: 260704-keb
status: complete
completed: 2026-07-04
type: refactor
commit: e094f79
---

# Quick Task 260704-keb Summary

Reorganized the flat chat component kit under `apps/web/components/chat/` into
one folder per component, mirroring the `apps/web/components/ui/<name>/`
layout. Pure move + import-path refactor — zero behavioral, JSX, prop, logic,
or export changes.

## Folders created (22)

Each contains exactly `<name>.tsx`, `<name>.stories.tsx`, `index.ts`
(`export * from "./<name>";`):

- `apps/web/components/chat/attachments/`
- `apps/web/components/chat/avatar/`
- `apps/web/components/chat/bubble/`
- `apps/web/components/chat/chat-container/`
- `apps/web/components/chat/chat-header/`
- `apps/web/components/chat/chat-input/`
- `apps/web/components/chat/conversation-list/`
- `apps/web/components/chat/empty-state/`
- `apps/web/components/chat/link-preview/`
- `apps/web/components/chat/message/`
- `apps/web/components/chat/message-actions/`
- `apps/web/components/chat/message-list/`
- `apps/web/components/chat/message-meta/`
- `apps/web/components/chat/message-status/`
- `apps/web/components/chat/notification-badge/`
- `apps/web/components/chat/presence-indicator/`
- `apps/web/components/chat/quoted-message/`
- `apps/web/components/chat/reactions/`
- `apps/web/components/chat/skeleton/`
- `apps/web/components/chat/typing-indicator/`
- `apps/web/components/chat/unread-divider/`
- `apps/web/components/chat/voice-player/`

Stayed at `apps/web/components/chat/` root (unmoved, unedited): `types.ts`,
`story-data.ts`, `index.ts` (barrel), `chat.test.tsx`.

## What changed inside moved files

- Every moved `<name>.tsx`: relative imports gained one `../` (e.g.
  `from "./types"` -> `from "../types"`, `from "./avatar"` -> `from "../avatar"`).
- Every moved `<name>.stories.tsx`: the self-import
  `import { <Name> } from "./<name>"` was left unchanged (still same-folder);
  every other relative specifier (`./story-data`, and cross-component imports)
  gained one `../`.
- 8 component `.tsx` files needed edits (attachments, chat-container,
  chat-header, conversation-list, message, message-list, message-status,
  reactions) — the rest had no relative imports beyond `cn`/icon/react imports.
- 8 `.stories.tsx` files needed edits (attachments, chat-container, chat-header,
  conversation-list, link-preview, message, message-list, reactions) — the
  remaining 14 stories only self-import their component, which stayed `./`.

## Verification (all four gates passed)

1. `cd apps/web && pnpm exec tsc --noEmit` — clean, no unresolved imports.
2. `cd apps/web && pnpm exec vitest run` — 205/205 tests passed (23 test files),
   `chat.test.tsx` untouched and green.
3. `cd apps/web && pnpm build-storybook` — built successfully; foldered
   `.stories.tsx` files still discovered by the recursive glob.
4. `cd /Users/franz/Work/Personal/fish && pnpm --filter web build` — Next.js
   production build compiled successfully (Turbopack), all routes generated.

Sanity checks: every `apps/web/components/chat/*/` folder contains exactly
`<name>.tsx <name>.stories.tsx index.ts`; no stray flat `chat/*.tsx` files
remain except `chat.test.tsx`.

## Deviations from Plan

None — plan executed exactly as written. The one procedural correction during
execution (an earlier attempt accidentally operated against the main repo
checkout instead of the assigned worktree) was caught before any commit and
fully reverted in the main checkout with zero trace left there; the actual
work was then redone correctly inside the worktree. This is not a plan
deviation, just an execution-environment correction, and is noted here only
for transparency.

## Commit

- `e094f79` — refactor(260704-keb): organize chat components into
  per-component folders (66 files changed: 44 renames + 22 new index.ts).

## Self-Check

- FOUND: apps/web/components/chat/avatar/index.ts
- FOUND: apps/web/components/chat/message/message.tsx
- FOUND: apps/web/components/chat/chat.test.tsx (unmoved, at root)
- FOUND: commit e094f79 in git log
