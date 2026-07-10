---
status: complete
quick_task: 260710-jff
one_liner: Username in the header now opens a Base UI popup menu (Profile + Log out) instead of a name link plus a standalone Log out button
key_files:
  created:
    - apps/web/lib/auth/use-logout.ts
    - apps/web/components/shell/user-menu.tsx
    - apps/web/components/shell/user-menu.test.tsx
  modified:
    - apps/web/components/auth/logout-button.tsx
    - apps/web/components/shell/app-shell.tsx
    - apps/web/components/shell/app-shell.test.tsx
commits:
  - a83bb45f
  - 9ccd40d4
---

# Quick Task 260710-jff: Username popup menu

## What was built

Clicking the username in the header now opens a Base UI `Menu` (the same
pattern already used by `AddMenu` in the composer) offering:

- **Profile** — client role only, a real link (`Menu.Item render={<Link .../>}`)
  to `/profile`.
- **Log out** — always present, signs out via the shared `useLogout` hook.

The header no longer has a separate `LogoutButton`; that component now backs
only the Profile settings "Sign out" row and internally consumes the same
`useLogout` hook, so the two entry points share one implementation.

## Task 1: `useLogout` + `UserMenu`

- `apps/web/lib/auth/use-logout.ts` — lifted the exact handler previously
  inlined in `LogoutButton` (`signOut()` → `clearChatStore()` (CR-01) →
  `router.push("/login")`), returning `{ logout, loading }`.
- `apps/web/components/shell/user-menu.tsx` — `"use client"` island using the
  established `Menu.Root > Menu.Trigger > Menu.Portal > Menu.Positioner >
  Menu.Popup > Menu.Item[]` structure from `add-menu.tsx`, reusing its Popup/
  Item class strings verbatim. Trigger keeps the header's existing muted/
  truncate classes plus `min-h-control` for the 56px tap-target floor, with
  `aria-label="Account menu for {displayName}"`.
- `user-menu.test.tsx` — 3 tests: opens with Profile + Log out for `client`,
  opens with only Log out for `coach`, and Log out calls `signOut` +
  `clearChatStore` + `router.push("/login")`.

## Task 2: Wire into the header

- `logout-button.tsx` refactored to call `useLogout()` instead of its own
  inline handler; the ghost `Button` markup and behavior (and its existing
  CR-01 test) are unchanged.
- `app-shell.tsx`: removed the `LogoutButton` import/usage and the
  client-link / coach-span display-name block, replaced by a single
  `<UserMenu displayName={displayName} role={role} />`.
- `app-shell.test.tsx`: updated the display-name/logout test, the two
  client/coach name-link tests, and the D-09/SHEL-01 zero-primary grep test
  (now also scans `user-menu.tsx`) to reflect the menu-based interaction.
  All other shell tests (channel column, centered content, nav, preference
  hydration) were left untouched.

## Verification

- `pnpm --filter @fish/web test run components/shell components/auth/logout-button.test.tsx` — 17/17 passed.
- `pnpm --filter @fish/web build` — succeeded.
- `pnpm --filter @fish/web lint` — clean.
- Grep gate: `variant="primary"` count in `app-shell.tsx` = 0.
- Grep gate: `LogoutButton` reference count in `app-shell.tsx` = 0.

## Deviations from Plan

None — plan executed exactly as written. One incidental fix: the WHY comment
originally drafted in `user-menu.tsx` contained the literal string
`variant="primary"` inside prose, which tripped the D-09/SHEL-01 grep-based
test in `app-shell.test.tsx` (the test greps source text, not AST). Reworded
the comment to describe the same constraint without the literal attribute
string — no behavior change.

## Self-Check

- FOUND: apps/web/lib/auth/use-logout.ts
- FOUND: apps/web/components/shell/user-menu.tsx
- FOUND: apps/web/components/shell/user-menu.test.tsx
- FOUND: apps/web/components/auth/logout-button.tsx (modified)
- FOUND: apps/web/components/shell/app-shell.tsx (modified)
- FOUND: apps/web/components/shell/app-shell.test.tsx (modified)
- FOUND commit a83bb45f (Task 1)
- FOUND commit 9ccd40d4 (Task 2)

## Self-Check: PASSED
