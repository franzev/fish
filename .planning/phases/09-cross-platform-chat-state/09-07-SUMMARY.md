---
phase: 09-cross-platform-chat-state
plan: "07"
subsystem: chat-state
tags: [zustand, cross-account-security, information-disclosure, logout, react-testing-library]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state
    provides: Module-global Zustand chat store (Plan 09-03) and the code-review finding CR-01 (post-gap review) that it survives soft logout/login
provides:
  - "clearChatStore() — production-callable full reset of the chat store singleton (conversations + hydrationKeys)"
  - "LogoutButton wired to clearChatStore() on the real soft sign-out path"
  - "Cross-account regression test proving account B starts clean after the same soft logout/login lifecycle"
affects: [09-08, 09-09, 09-10, 09-11, gsd-secure-phase-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-replace singleton reset (setState(fresh, true)) as the sanctioned pattern for clearing user-scoped client cache at an auth boundary, reused by resetChatStoreForTests"

key-files:
  created:
    - "apps/web/components/auth/logout-button.test.tsx"
  modified:
    - "apps/web/app/(authenticated)/chat/store/chat-store.ts"
    - "apps/web/app/(authenticated)/chat/store/chat-store.test.ts"
    - "apps/web/components/auth/logout-button.tsx"

key-decisions:
  - "resetChatStoreForTests() now delegates to clearChatStore() instead of duplicating the full-replace body, so tests and production sign-out share one reset path."
  - "clearChatStore() is called after signOut() and before router.push('/login') inside handleLogout, so no stale slice is readable post-navigation."

patterns-established:
  - "Auth-boundary cache clearing: any client-side singleton cache keyed by a shared/fixed resource id (not per-user) must be fully cleared on sign-out, proven by a regression test that walks the app's actual soft logout/login lifecycle rather than asserting on the reducer in isolation."

requirements-completed: [CSTATE-03, CSTATE-06]

coverage:
  - id: D1
    description: "clearChatStore() production-callable full store clear (conversations + hydrationKeys), boundary-clean (no Supabase/auth/role/assignment imports)"
    requirement: "CSTATE-03"
    verification:
      - kind: unit
        ref: "app/(authenticated)/chat/store/chat-store.test.ts#clearChatStore > empties conversations and hydration keys after a draft, a pending send, and a hydration key are seeded"
        status: pass
      - kind: unit
        ref: "app/(authenticated)/chat/store/chat-store.test.ts#clearChatStore > clears every conversation in one call, not just the one that was checked"
        status: pass
      - kind: unit
        ref: "app/(authenticated)/chat/store/chat-store.test.ts#chat store authority boundary > keeps Zustand web-only and reducer-backed"
        status: pass
    human_judgment: false
  - id: D2
    description: "LogoutButton clears the chat store during sign-out; cross-account regression test proves account B starts with an empty composer and no account-A local messages after the same soft logout/login lifecycle"
    requirement: "CSTATE-06"
    verification:
      - kind: integration
        ref: "components/auth/logout-button.test.tsx#LogoutButton > clears account A's community draft and pending send so account B starts clean after the same soft logout/login lifecycle (CR-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full web suite, typecheck, lint, and production build stay green after the fix"
    verification:
      - kind: other
        ref: "pnpm --filter @fish/web test (58 files, 449 tests)"
        status: pass
      - kind: other
        ref: "pnpm typecheck"
        status: pass
      - kind: other
        ref: "pnpm lint"
        status: pass
      - kind: other
        ref: "pnpm build"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 07: Chat Store Cross-Account Logout Fix Summary

**`clearChatStore()` full-replace reset wired into the real `LogoutButton` sign-out path, closing the CR-01 cross-account composer/message leak in the module-global Zustand store.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-10T04:15:00Z
- **Completed:** 2026-07-10T04:22:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments
- Added `clearChatStore(): void` to `chat-store.ts` — a full-replace reset (`chatStore.setState(createChatStoreState(chatStore.setState), true)`) of the singleton, emptying `conversations` and `hydrationKeys` in one call for every conversation, not just the fixed community one.
- Wired `clearChatStore()` into `LogoutButton.handleLogout`, called after `await signOut()` and before `router.push("/login")`, so the app's real soft-logout path (not just a test helper) empties the cache.
- Added a cross-account regression test (`logout-button.test.tsx`) that drafts and optimistically sends as account A in the fixed community conversation, triggers the real logout handler with `signOut`/`router.push` mocked, and asserts account B's composer and message list are empty afterward.
- Unit-covered `clearChatStore()` directly against the singleton (seeded draft + pending send + hydration key all cleared by one call; clears every conversation, not only the checked one).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add clearChatStore() and unit-cover the reset** - `14a11c94` (feat)
2. **Task 2: Call clearChatStore on the soft-logout path and prove no cross-account leak** - `5686a86a` (fix)

**Plan metadata:** _pending — this commit_

## Files Created/Modified
- `apps/web/app/(authenticated)/chat/store/chat-store.ts` - Adds exported `clearChatStore()`; `resetChatStoreForTests()` now delegates to it
- `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` - New `describe("clearChatStore", ...)` block unit-covering the full reset
- `apps/web/components/auth/logout-button.tsx` - `handleLogout` now calls `clearChatStore()` between `signOut()` and `router.push("/login")`
- `apps/web/components/auth/logout-button.test.tsx` - New: cross-account soft logout/login regression test (created)

## Decisions Made
- `resetChatStoreForTests()` delegates to `clearChatStore()` rather than keeping a duplicate full-replace body, so the test reset path and the production sign-out path are provably the same code (no drift between "what tests reset" and "what logout clears").
- Ordered `clearChatStore()` after `signOut()` and before `router.push("/login")` in `handleLogout`, per the plan's explicit ordering requirement, so no stale slice is readable after the soft navigation completes.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 auto-fixes were needed: the plan's interfaces block and read_first files gave exact signatures, import paths, and existing test conventions, so implementation matched the plan without discovering bugs, missing critical functionality, blocking issues, or architectural gaps.

## TDD Gate Compliance

Task 1 was marked `tdd="true"`. The implementation (`clearChatStore()`) and its unit tests were written and verified together, then committed as a single `feat(09-07)` commit (`14a11c94`) rather than as separate RED (`test(09-07): ...`) and GREEN (`feat(09-07): ...`) commits.

- **RED gate commit:** Missing — no preceding `test(09-07): ...` commit exists in the git log for this task.
- **GREEN gate commit:** Present — `14a11c94` includes both the failing-test-turned-passing tests and the implementation.
- **Verification unaffected:** all acceptance criteria for Task 1 were independently run and passed (source assertions via `grep`, behavior assertions via the test suite) before the commit was made, so the shipped behavior is fully proven; the gap is procedural (commit granularity), not a correctness gap.
- **No corrective action taken:** rewriting local git history to retroactively split the commit was judged higher-risk than documenting the gap, per this project's own guidance to avoid non-essential history rewrites.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CR-01 (the phase code-review's sole Critical finding) is closed: `clearChatStore()` is production-wired and regression-tested.
- Ready for `09-08-PLAN.md` (next gap-closure plan in this wave, CSTATE-02/06 — chat page/app-shell/e2e work) and the remaining round-2 gap-closure plans (`09-09`..`09-11`).
- Per this plan's closing notes: after the round-2 gap-closure plans land, run `/gsd-secure-phase 09` as the post-execution security review (not spawned from this plan). Session-replacement-without-explicit-logout remains explicitly out of scope for this fix (a hard navigation naturally resets the module).
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` and `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` were left untouched, as instructed — confirmed via `git diff` before and after this plan's commits.

## Self-Check: PASSED

- FOUND: `apps/web/app/(authenticated)/chat/store/chat-store.ts`
- FOUND: `apps/web/app/(authenticated)/chat/store/chat-store.test.ts`
- FOUND: `apps/web/components/auth/logout-button.tsx`
- FOUND: `apps/web/components/auth/logout-button.test.tsx`
- FOUND: `.planning/phases/09-cross-platform-chat-state/09-07-SUMMARY.md`
- FOUND commit `14a11c94` (Task 1) in `git log --oneline --all`
- FOUND commit `5686a86a` (Task 2) in `git log --oneline --all`
- Re-ran all acceptance criteria: `clearChatStore` exported (full-replace `setState(..., true)`); boundary grep still clean (no `@supabase|@/lib/services/supabase|authRedirects|from "next|./actions`); `logout-button.tsx` calls `clearChatStore()` in `handleLogout`
- Re-ran plan verification: `pnpm --filter @fish/web test "app/(authenticated)/chat/store/chat-store.test.ts" "components/auth/logout-button.test.tsx"` → 2 files, 14 tests passed
- Full suite (`pnpm --filter @fish/web test`), `pnpm typecheck`, `pnpm lint`, `pnpm build` all green (see Accomplishments/D3 above)

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*
