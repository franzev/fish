---
phase: 09-cross-platform-chat-state
plan: 14
subsystem: auth
tags: [zustand, supabase-auth, react, cache-isolation, security, cr-01]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state (09-13)
    provides: Hardened chat-state reducer/selectors and Zustand store contract (hydrate-preserve, monotonic message status, code-point-safe snippets) that this plan layers identity-partitioning on top of.
provides:
  - "ensureChatStoreOwner(userId) module-level cache-partition fingerprint on the Zustand chat store, purging on any verified-identity change"
  - "ChatIdentityGuard client component mounted in the authenticated layout: re-partitions on every render's server-verified userId, and purges on SIGNED_OUT / cross-identity Supabase auth events"
  - "useLogout branches on signOut().ok: failure preserves state and surfaces a calm retry notice; success keeps the existing clearChatStore -> router.push order"
affects: [09-UAT, 09-cross-platform-chat-state milestone audit, any future auth/session-transition work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache-partition fingerprint: a module-level (non-store-state) identity marker used only to decide when to purge local cache, never consulted for authorization"
    - "Client auth-state guard: a null-rendering client component that subscribes to Supabase onAuthStateChange purely to trigger cache-lifecycle side effects, mounted once at the authenticated-layout boundary"

key-files:
  created:
    - apps/web/components/auth/chat-identity-guard.tsx
    - apps/web/components/auth/chat-identity-guard.test.tsx
  modified:
    - apps/web/app/(authenticated)/chat/store/chat-store.ts
    - apps/web/app/(authenticated)/chat/store/chat-store.test.ts
    - apps/web/app/(authenticated)/layout.tsx
    - apps/web/app/(authenticated)/layout.test.tsx
    - apps/web/lib/auth/use-logout.ts
    - apps/web/components/auth/logout-button.tsx
    - apps/web/components/auth/logout-button.test.tsx
    - apps/web/components/shell/user-menu.tsx

key-decisions:
  - "cacheOwnerUserId is a module-level `let`, not a ChatStoreState field, so it can never surface in getState() or trip the authority-boundary test's forbidden-key list"
  - "ensureChatStoreOwner treats a null (never-adopted) owner as 'no prior owner' and never purges on first adoption, so a fresh server-hydrated conversation is never wiped just because the guard mounts"
  - "ChatIdentityGuard reads no role/permission data and makes no authorization decision -- it is a purge trigger only; RLS/Edge Functions remain the sole authority (D-05, D-08)"
  - "A failed signOut preserves state and shows guidance instead of half-completing the clear+navigate sequence, closing the repudiation gap where a failed sign-out was previously treated as success"

patterns-established:
  - "Auth-identity cache guards belong at the authenticated-layout boundary (fed the server-verified profile.userId), not inside AppShell -- keeps AppShell prop-stable for adjacent shell work"

requirements-completed: [CSTATE-03, CSTATE-06]

coverage:
  - id: D1
    description: "ensureChatStoreOwner cache-partition fingerprint purges the chat store on any verified-identity change while staying out of ChatStoreState"
    requirement: CSTATE-03
    verification:
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/store/chat-store.test.ts#ensureChatStoreOwner (CR-01 cache-partition fingerprint)"
        status: pass
      - kind: unit
        ref: "apps/web/app/(authenticated)/chat/store/chat-store.test.ts#chat store authority boundary"
        status: pass
    human_judgment: false
  - id: D2
    description: "ChatIdentityGuard mounted in the authenticated layout purges the cache on non-button account switches, SIGNED_OUT, and cross-identity auth events, while preserving same-user events (e.g. TOKEN_REFRESHED)"
    requirement: CSTATE-06
    verification:
      - kind: unit
        ref: "apps/web/components/auth/chat-identity-guard.test.tsx#ChatIdentityGuard"
        status: pass
    human_judgment: true
    rationale: "Cross-tab sign-out and session-expiry-then-login are multi-tab/multi-session flows that the unit suite simulates via captured callbacks; the plan's HV-03 manual gate (B never sees A's rows in a real two-tab browser session) still needs a human pass, tracked in 09-UAT.md."
  - id: D3
    description: "useLogout branches on signOut().ok: failure preserves current-account state and shows a calm notice-tone retry message without navigating; success is unchanged (clearChatStore then router.push)"
    requirement: CSTATE-06
    verification:
      - kind: unit
        ref: "apps/web/components/auth/logout-button.test.tsx#LogoutButton"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-07-10
status: complete
---

# Phase 9 Plan 14: Bind the chat cache to verified auth identity (CR-01 closure) Summary

**Module-singleton Zustand chat cache now purges on any verified-identity change (non-button switch, sign-out, or cross-tab session expiry) via a new `ensureChatStoreOwner` fingerprint and a mounted `ChatIdentityGuard`; `useLogout` no longer treats a failed `signOut()` as success.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-10T08:25:00Z
- **Completed:** 2026-07-10T08:44:31Z
- **Tasks:** 3
- **Files modified:** 10 (2 created, 8 modified; 1 beyond the plan's listed 9 -- see Deviations)

## Accomplishments
- Added `ensureChatStoreOwner(userId)` to `chat-store.ts`: a module-level cache-partition fingerprint that purges the store the moment the verified user changes, and is forgotten by `clearChatStore()`/`resetChatStoreForTests()` so a later call re-adopts cleanly.
- Built and mounted `ChatIdentityGuard`, a null-rendering client component in the authenticated layout that (1) re-partitions to the server-verified `userId` on every render (covers a same-tab account switch with no button click) and (2) subscribes to Supabase's `onAuthStateChange` to purge on `SIGNED_OUT` or any event whose session belongs to a different user (covers cross-tab sign-out and session expiry).
- Hardened `useLogout` to branch on `signOut().ok`: a failure now preserves the current account's chat state and loading flag, and surfaces a calm, non-scolding retry notice (rendered via `Alert tone="notice"` in `LogoutButton`, and a `text-notice` row in `UserMenu`) instead of half-completing a clear-and-navigate sequence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cache-partition fingerprint that purges the store on verified-identity change** - `a478b7e8` (feat)
2. **Task 2: ChatIdentityGuard client component + auth-state listener, mounted in the authenticated layout** - `c8bbc1d5` (feat)
3. **Task 3: Honor signOut().ok — preserve state and show calm retry on failure** - `f2ef067c` (fix)

**Plan metadata:** pending (docs: complete plan, committed after this SUMMARY)

## Files Created/Modified
- `apps/web/app/(authenticated)/chat/store/chat-store.ts` - Adds module-level `cacheOwnerUserId` fingerprint, `ensureChatStoreOwner(userId)`, and owner reset inside `clearChatStore()`.
- `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` - New "ensureChatStoreOwner" describe block (adopt, same-identity preserve, identity-change purge + re-adopt, owner reset on clear, no forbidden authority key).
- `apps/web/components/auth/chat-identity-guard.tsx` - New `ChatIdentityGuard` client component: prop-change effect + one-time auth-state-listener effect, renders null.
- `apps/web/components/auth/chat-identity-guard.test.tsx` - New tests: prop-change purge, `SIGNED_OUT` purge, cross-identity purge vs. same-user preserve, unmount unsubscribes.
- `apps/web/app/(authenticated)/layout.tsx` - Mounts `<ChatIdentityGuard userId={profile.userId} />` alongside `<AppShell>`; no new `AppShell` props.
- `apps/web/app/(authenticated)/layout.test.tsx` - Mocks `@/lib/services/supabase/browser` so the guard's real Supabase client is never constructed in this unit test (Rule 3 fix, see Deviations).
- `apps/web/lib/auth/use-logout.ts` - Captures `signOut()`'s result, branches on `.ok`; adds `notice` to the returned `{ logout, loading, notice }`.
- `apps/web/components/auth/logout-button.tsx` - Renders the notice below the button via `Alert tone="notice"`.
- `apps/web/components/shell/user-menu.tsx` - Renders the notice as a non-interactive `text-notice` row inside the menu popup.
- `apps/web/components/auth/logout-button.test.tsx` - Types the `signOut` mock as `ServiceResult<void>` and adds a failure-path test (no navigate, state preserved, notice rendered).

## Decisions Made
- `cacheOwnerUserId` lives as a plain module-level `let`, deliberately outside `ChatStoreState`, so it can never leak into `getState()` and the pre-existing "chat store authority boundary" test keeps enforcing that guarantee unchanged.
- `ensureChatStoreOwner` never purges on a null-to-X first adoption (only X-to-Y where X differs from Y) so server-hydrated state surviving a guard mount/re-render is never mistaken for stale cross-account leftovers.
- The auth-state listener effect intentionally runs once (`[]` deps) — its callback re-reads the verified session id on every fired event, so no re-subscription is needed when `userId` changes; the separate prop-change effect handles that case instead.
- The failure notice is a fixed calm string, not `result.error.message` — avoids ever surfacing a technical/inconsistent-tone message to this audience.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocked the Supabase browser client factory in `layout.test.tsx`**
- **Found during:** Task 2 (mounting `ChatIdentityGuard` in the authenticated layout)
- **Issue:** `layout.test.tsx`'s existing "resolves role + renders AppShell..." test calls `render(Layout)` on the resolved server-component tree. Once `ChatIdentityGuard` was mounted there, its auth-state-listener effect started calling the REAL `createBrowserSupabaseClient()`, which reads `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` via `getPublicEnv()` and throws `ServiceConfigurationError` when those aren't set — which they aren't in the unit test process. This would have broken a previously-green, plan-unlisted test.
- **Fix:** Added a `vi.mock("@/lib/services/supabase/browser", ...)` returning a minimal `{ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } } }) } }` stub, mirroring the mock style already used in `chat-client.test.tsx`.
- **Files modified:** apps/web/app/(authenticated)/layout.test.tsx
- **Verification:** `pnpm --filter @fish/web test layout app-shell user-menu` — 17/17 pass.
- **Committed in:** c8bbc1d5 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed cross-test mock-count leakage in the new `chat-identity-guard.test.tsx` unmount assertion**
- **Found during:** Task 2, writing the "renders nothing and unsubscribes on unmount" test
- **Issue:** The describe-scoped `afterEach` cleared mock call counts (`vi.clearAllMocks()`) BEFORE React Testing Library's own auto-registered `afterEach(cleanup)` ran, so a still-mounted tree from the PRIOR test unmounted (and called the shared `unsubscribe` mock) after the count had already been reset — inflating the next test's "called once" assertion to two calls.
- **Fix:** Import `cleanup` from `@testing-library/react` and call it explicitly as the first line of the shared `afterEach`, before `vi.clearAllMocks()`, so any prior test's tree is torn down (and its effect cleanups fire) before counts are cleared.
- **Files modified:** apps/web/components/auth/chat-identity-guard.test.tsx
- **Verification:** `pnpm --filter @fish/web test chat-identity-guard` — 4/4 pass (was 3/4 before the fix).
- **Committed in:** c8bbc1d5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking test-infrastructure fix, 1 bug in newly-authored test isolation).
**Impact on plan:** Both fixes were required to keep the test suite genuinely green after Task 2's change; neither touches production behavior or plan scope. No scope creep.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CR-01 is closed: verified-identity change, sign-out, and cross-tab expiry all purge the local chat cache; a failed sign-out preserves state and shows calm retry guidance instead of navigating.
- The store stays auth-free — the pre-existing "chat store authority boundary" test (rejecting session/auth/currentUserId/role/assignment/Supabase/service-role keys) passes unchanged, and `cacheOwnerUserId` never appears in `getState()`.
- Full gate green: `pnpm --filter @fish/web test` (483/483 across 61 files), `pnpm typecheck`, `pnpm lint`, and `pnpm build` (all workspaces) all pass.
- HV-03 (the manual "B never sees A's rows" / "failed sign-out preserves state" browser verification) is now satisfiable and should be exercised as part of `09-UAT.md` / the milestone audit — it is human-judgment work this plan could not execute itself (see coverage D2 rationale).

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`chat-identity-guard.tsx`, `chat-identity-guard.test.tsx`, and all 8 modified files). All 3 task commits (`a478b7e8`, `c8bbc1d5`, `f2ef067c`) confirmed in `git log`. Full verification re-run: `pnpm --filter @fish/web test` 483/483 pass (61 files), `pnpm typecheck` clean (3 workspaces), `pnpm lint` clean, `pnpm build` succeeds (3 workspaces, all 17 routes).
