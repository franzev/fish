---
quick_id: 260711-gxf
status: planned
created: 2026-07-11
type: refactor
must_haves:
  truths:
    - "Every existing route, URL, redirect, rendered state, copy string, class name, ARIA/live-region contract, auth/session transition, Supabase call, persistence result, and realtime behavior remains identical"
    - "Feature-owned profile, coach, and auth modules have explicit client-safe and server-only entry points while apps/web/app remains limited to route files and genuinely route-local UI"
    - "Server-only and browser-only modules are poisoned at their implementation boundaries, and automated tests reject both alias and relative imports that cross those boundaries"
    - "The public password and email-flow pages remain at the same URLs and render the same markup and behavior, but only their interactive forms/content are Client Components"
    - "All pre-existing exported contracts remain reachable through compatibility facades, and the already-completed chat organization is not repeated or behaviorally altered"
    - "Lint, typecheck, all web unit tests, Storybook build, production build, Playwright, RLS verification, chat realtime verification, and whitespace validation pass"
  artifacts:
    - path: "apps/web/features/auth/index.ts"
      provides: "Stable client-safe auth feature entry point with browser helpers and auth UI"
    - path: "apps/web/features/auth/server/index.ts"
      provides: "Explicit poisoned server entry point for auth redirects and shell/root loading"
    - path: "apps/web/features/profile/index.ts"
      provides: "Client-safe profile presentation entry point"
    - path: "apps/web/features/profile/server/index.ts"
      provides: "Poisoned profile commands, validation, and profile page-data entry point"
    - path: "apps/web/features/coach/index.ts"
      provides: "Client-safe coach presentation entry point"
    - path: "apps/web/features/coach/server/index.ts"
      provides: "Poisoned coach page-data entry point"
    - path: "apps/web/tests/nextjs-boundaries.test.ts"
      provides: "Independent regression coverage for server/client poisoning and relative/alias import direction"
  key_links:
    - from: "apps/web/app/(authenticated)/profile/page.tsx"
      to: "apps/web/features/profile/index.ts and apps/web/features/profile/server/index.ts"
      via: "feature presentation and server page-data imports"
    - from: "apps/web/app/(authenticated)/coach/page.tsx"
      to: "apps/web/features/coach/index.ts and apps/web/features/coach/server/index.ts"
      via: "feature presentation and role-scoped loader imports"
    - from: "apps/web/app/login/login-form.tsx"
      to: "apps/web/features/auth/index.ts"
      via: "browser-only auth command facade"
    - from: "apps/web/lib/auth/server.ts"
      to: "apps/web/features/auth/server/index.ts, apps/web/features/profile/server/index.ts, apps/web/features/coach/server/index.ts, and apps/web/features/chat/server/page-data.ts"
      via: "unchanged compatibility re-exports"
    - from: "apps/web/tests/nextjs-boundaries.test.ts"
      to: "apps/web/features/*/{index.ts,server/index.ts}"
      via: "resolved import-graph assertions for alias and relative imports"
---

# Quick Task 260711-gxf Plan

Refactor the remaining Next.js web structure into consistent feature ownership and make
server/client boundaries mechanically enforceable. This is a pure structural change: preserve
all runtime behavior and public contracts exactly, avoid route-group and `src/` churn, and do
not revisit the completed chat component/store/action refactor.

## Fixed constraints

- Do not change any route, URL, redirect destination, layout nesting, metadata, copy, CSS class,
  accessibility behavior, schema, auth rule, Supabase request, persistence/realtime path, public
  package export, or callable component/action contract. No new product behavior or dependency
  abstraction is in scope.
- Keep `apps/web/app`, `apps/web/components/ui`, and `apps/web/components/shell` in place. Keep
  route-specific forms colocated with their routes. Do not create `src/`, `tailwind.config.js`,
  a new API layer, or new route groups; moving routes is avoidable risk in this refactor.
- Preserve legacy `@/lib/auth/*`, `@/lib/validation/profile`, and moved component entry paths as
  small documented re-export facades until repository-wide searches and tests prove callers have
  migrated. Client-safe barrels must never re-export a poisoned server module.
- Add `server-only` / `client-only` as direct web dependencies with pnpm if TypeScript resolution
  requires it; these marker packages are the only permitted dependency change.
- Treat these dirty paths as user-owned: do not edit, delete, restore, format, stage, or include
  them in any task commit:
  `apps/web/features/chat/components/bubble/bubble.tsx`,
  `apps/web/features/chat/components/bubble/index.ts`,
  `apps/web/features/chat/components/chat-message-list.tsx`,
  `apps/web/features/chat/components/emoji-picker/emoji-picker.tsx`,
  `apps/web/features/chat/components/message-body/message-body.stories.tsx`,
  `apps/web/features/chat/components/message-presentation.ts`,
  `apps/web/features/chat/components/visual.ts`,
  `apps/web/tests/module-boundaries.test.ts`, and
  `apps/web/components/ui/scroll-area/scroll-area.stories.tsx`.
  Create `apps/web/tests/nextjs-boundaries.test.ts` rather than modifying the dirty boundary test.

## Tasks

### Task 1 — Add executable server/client boundary protection

**Files:** `apps/web/package.json`, `pnpm-lock.yaml`, server implementations under
`apps/web/features/*/server/`, `apps/web/lib/auth/server-data/`,
`apps/web/lib/services/supabase/{server,proxy}.ts`, `apps/web/lib/supabase/{server,proxy}.ts`,
browser implementations under `apps/web/lib/auth/`,
`apps/web/lib/services/supabase/browser.ts`, `apps/web/lib/supabase/client.ts`, and new
`apps/web/tests/nextjs-boundaries.test.ts`.

**Action:** Install/directly declare the official marker packages only if needed, then put
`import "server-only"` at server implementation boundaries and `import "client-only"` at modules
that inherently construct browser clients, read `window`, subscribe to browser auth/realtime, or
expose browser hooks. Do not poison shared DTOs, pure validators, public environment parsing, or
neutral service interfaces merely because a server module consumes them. Add a separate
filesystem/import-graph test that resolves both `@/...` and relative specifiers (including
re-exports), detects transitive client-to-server and server-to-client crossings, requires every
`features/*/server` implementation entry to be poisoned, and proves client-safe feature barrels
cannot expose server entries. Keep the test independent of the dirty
`apps/web/tests/module-boundaries.test.ts`.

**Verify:** Run `pnpm --filter @fish/web test -- --run apps/web/tests/nextjs-boundaries.test.ts`
(or the equivalent Vitest path accepted by the workspace script), `pnpm typecheck`, and targeted
tests for auth and Supabase factories. Confirm imports of a deliberately poisoned fixture/path
are caught by the new graph assertions rather than only by filename convention.

**Done:** Server/browser misuse fails mechanically during build/test, neutral contracts remain
usable on both sides, no runtime logic changed, and the user-owned dirty files are untouched.

### Task 2 — Normalize profile, coach, and auth ownership; narrow page client boundaries

**Files:** `apps/web/features/{auth,profile,coach}/**`, existing
`apps/web/components/{auth,profile,coach}/**`, `apps/web/lib/auth/**`,
`apps/web/lib/validation/profile.ts`, `apps/web/app/(authenticated)/**`, and the route-local files
under `apps/web/app/{login,signup,forgot-password,reset-password,check-inbox,expired-link}/**`.

**Action:** Move implementations and their colocated tests/stories into focused feature folders:

- `features/profile/components`, `features/profile/server`, and a pure profile validation/contracts
  module own the current profile rows/cards/preferences, actions, validation, and profile loaders.
- `features/coach/components` and `features/coach/server` own the client list and coach loaders.
- `features/auth/components`, `features/auth/client`, and `features/auth/server` own the identity
  guard/logout UI, browser auth/session helpers, redirects, and root/authenticated-shell loading.
- Move the chat page-data loader only into `features/chat/server/page-data.ts`; do not touch any
  dirty chat file or reorganize the existing chat components, store, commands, or public client
  barrel.

Expose separate client-safe and poisoned server entry points. Update route files and clean callers
to consume the owning feature, while retaining documented compatibility facades at the existing
`lib/auth`, `lib/validation/profile`, and component paths wherever existing tests/contracts still
depend on them. Preserve named exports and every existing function/result/prop type.

For `forgot-password`, `reset-password`, `check-inbox`, and `expired-link`, make `page.tsx` a Server
Component wrapper and extract the existing state/effects/router/search-param form content into a
route-local `*-form.tsx` or `*-content.tsx` Client Component. Preserve markup order, Suspense
placement/fallback, search-param semantics, focus/live-region behavior, and exact test-observable
output. Keep login/signup forms route-local and simply switch their browser auth imports to the
auth feature. Do not move any route directory into a group.

**Verify:** After each feature move run its existing colocated tests plus the affected route tests,
then run `pnpm --filter @fish/web test -- --run`, `pnpm typecheck`, and the new boundary test. Use
repository searches to prove there are no clean-source deep imports into moved implementations,
no client import of any `features/*/server` entry, all compatibility exports preserve their prior
names, and all route paths/page defaults remain present.

**Done:** Profile, coach, and auth have consistent ownership and safe entry points; the four page
modules are server wrappers around the smallest necessary client island; behavior and exported
contracts are unchanged; no dirty user-owned file was modified.

### Task 3 — Document the resulting boundaries and prove full-system equivalence

**Files:** `docs/ARCHITECTURE.md`, clean tests only when required to preserve path assertions, and
the quick-task summary/state artifacts handled by the GSD workflow. Do not edit the dirty
`apps/web/tests/module-boundaries.test.ts`.

**Action:** Update the architecture document to describe `app` as the route layer, the three new
feature boundaries, separate client/server entry points, compatibility facades, and poisoning
rules. Correct its stale chat store path while documenting rather than changing the shipped chat
architecture. Audit `git status`, `git diff`, and staged paths before every commit so all
pre-existing user changes remain excluded. Do not remove compatibility files unless import
resolution plus the full test suite proves they have no contract value.

**Verify:** From the repository root, run every gate against the completed refactor:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @fish/web test -- --run
pnpm build-storybook
pnpm build
pnpm --filter @fish/web e2e
pnpm verify:rls
pnpm verify:chat-realtime
git diff --check
```

Use the existing seeded local Supabase/Playwright harness and required `apps/web/.env.local` setup;
do not waive integration gates. Compare the Next production-build route table with the pre-refactor
route surface. Finish with source searches for mixed server/client barrels, stale implementation
imports, accidental `src/` or route-group additions, and unintended copy/class/redirect changes.

**Done:** Documentation matches the implementation; every unit, build, browser, RLS, realtime,
and whitespace gate passes; the route table and runtime behavior are unchanged; commits include
only quick-task-owned files and exclude every pre-existing dirty path.

