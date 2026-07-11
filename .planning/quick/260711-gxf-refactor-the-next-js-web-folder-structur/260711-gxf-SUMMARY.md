---
quick_id: 260711-gxf
status: complete
completed: 2026-07-11
commits:
  - c0a1ced4
  - a3b22106
  - c88b44c8
---

# Quick Task 260711-gxf Summary

Refactored the Next.js web application into explicit auth, profile, and coach
feature modules while preserving every route and runtime contract.

## Completed

- Added official `server-only` and `client-only` markers, Vitest marker aliases,
  and an independent import-graph regression suite covering alias and relative
  imports.
- Introduced separate client-safe and poisoned server feature entry points for
  auth, profile, and coach; moved chat page-data into its existing server area.
- Retained documented compatibility facades for former component, auth,
  validation, and server-data paths.
- Converted forgot-password, reset-password, check-inbox, and expired-link pages
  to Server Component wrappers around route-local Client Component islands with
  unchanged markup, copy, classes, accessibility, and Suspense behavior.
- Updated architecture documentation and corrected the chat store path.

The coach Storybook story remains at its compatibility component path because
the existing immutable module-boundary test intentionally restricts story
locations to shared components and chat feature components.

## Verification

- `pnpm lint` — passed
- `pnpm typecheck` — passed
- `pnpm --filter @fish/web test -- --run` — 63 files, 515 tests passed
- `pnpm build-storybook` — passed
- `pnpm build` — passed; route table unchanged
- `pnpm --filter @fish/web e2e` — 2 tests passed
- `pnpm verify:rls` — all assertions passed
- `pnpm verify:chat-realtime` — passed
- `git diff --check` — passed

## Commits

- `c0a1ced4` — executable Next.js module boundaries
- `a3b22106` — auth/profile/coach ownership and client islands
- `c88b44c8` — architecture documentation
