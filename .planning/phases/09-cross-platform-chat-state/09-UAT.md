---
status: complete
phase: 09-cross-platform-chat-state
source: [09-VERIFICATION.md]
started: 2026-07-10T10:26:00Z
updated: 2026-07-10T11:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. HV-04 — Community send e2e spec passes against a live server (required before release)
expected: |
  Run `apps/web/e2e/chat-send.spec.ts` against a live dev server with seeded
  Supabase (`pnpm --filter @fish/web exec playwright test e2e/chat-send.spec.ts`).
  The rewritten spec (reload-persistence + exact-count, no `.last()`, no
  incompatible status-image assertion) passes end to end. `playwright test
  --list` discoverability was already confirmed by verification; live
  execution is the one genuinely unverified round-4 claim.
result: pass
note: Run by Claude 2026-07-10 against local Supabase + dev server on :3001 — 1 passed (11.5s)

### 2. HV-01 — Older-page failure shows a calm, stable-height retry region (recommended)
expected: |
  Force an older-page failure in `/channels/general` (throttle/disable
  network), confirm the calm notice-tone retry region appears with no
  transcript jump, then retry successfully. One automatic attempt only, a
  stable-height retry region (no layout shift), and successful manual
  recovery. Backed by chat-client.test.tsx's WR-07 same-DOM-node geometry
  test; jsdom cannot measure real pixel height.
result: issue
reported: "Live Playwright run (Claude, 2026-07-10): calm notice-tone retry region appears, slot height identical between idle and error states (min-h-pagination-slot), no transcript jump, and manual Try again recovers successfully. BUT the 'one automatic attempt only' claim fails intermittently: in 5 of 7 instrumented runs the client fired TWO identical automatic older-page requests (same keyset cursor, ~0.4-1.0s apart) before settling into the stable error state. Never more than two; no retry storm."
severity: minor

### 3. HV-02 — In-flight older load in conversation A cannot corrupt conversation B (recommended)
expected: |
  Start an older-page load in conversation A, switch to conversation B
  before A settles, then let A settle as both a failure and a success.
  A cannot gate B, write B's error state, suppress B's first sentinel load,
  or inject A's page into B. Backed by two deferred-switch regression tests
  (09-15); only the literal scrollTop write into the live viewport is
  unautomatable in jsdom.
result: pass
note: Both WR-01 deferred-switch regression tests pass (vitest, 2026-07-10). No user-reachable path exists in the shipped UI to switch ChatClient conversations without a full page load (single seeded channel; coach client pages render no chat), so the SPA deferred-switch surface is exactly what the regression tests cover; a full-load switch trivially isolates state.

### 4. HV-03 — Cross-account isolation in a real browser; failed sign-out preserves state (recommended)
expected: |
  Sign in as account A in one tab, then (without using the Log out button)
  sign in as account B in a second tab / same tab after expiry. B never
  sees A's draft/pending/failed rows. Separately, force `signOut()` to fail
  (e.g. offline) and confirm the account is NOT navigated/cleared — A's
  state is preserved and calm retry guidance appears. Backed by
  chat-store/chat-identity-guard/logout-button tests; the genuine two-tab
  browser session is unautomatable in jsdom.
result: pass
note: Live Playwright (Claude, 2026-07-10). (a) A's composer draft survives same-account soft nav (proving the in-memory store persists), then after cookie expiry + B signing in via a second tab, tab 1's next soft nav rendered B's shell and the identity guard purged A's draft — B saw an empty composer and zero rows containing A's text. (b) With auth/v1/logout aborted, Log out did NOT navigate, the draft was preserved, and the calm notice appeared; after unblocking, retry signed out to /login.

### 5. HV-05 — App-shell logo is a comfortable 56px tap target (optional, low risk)
expected: |
  Visually confirm the app-shell logo link is a comfortably large, centered
  56px tap target on the rendered community shell. Low risk:
  app-shell.test.tsx asserts the exact `min-h-control`/`min-w-control`/
  `items-center`/`justify-center` classes reusing the already-shipped
  `--size-control` token.
result: pass
note: Live Playwright (Claude, 2026-07-10): logo link bounding box measured ≥56×56 with items-center/justify-center classes present.

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "A failed older-page load makes exactly one automatic attempt, then waits calmly for manual retry"
  status: failed
  reason: "User reported: (verified by Claude via instrumented Playwright) two identical automatic older-page requests fired (same keyset cursor, ~0.4-1.0s apart) in 5 of 7 runs before the error state settled; expected exactly one automatic attempt"
  severity: minor
  test: 2
  root_cause: "The one-automatic-attempt gate is split across two state systems that commit in separate renders: on failure, the store's isLoadingOlder=false (markOlderPageFailed, flushed via useSyncExternalStore) commits before the awaiting caller's local setHasOlderLoadError(true), so for one commit the observer guard (hasMoreOlder && !isLoadingOlder && !hasOlderLoadError) passes, re-attaching the IntersectionObserver over the still-intersecting sentinel, whose initial observation fires the second identical-cursor request. Bounded at two because the error flag is set before attempt 2 settles."
  artifacts:
    - path: "apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts"
      issue: "error flag set one commit after the store's failure update (lines 64/91); observer guard re-attaches in the gap commit (line 96)"
    - path: "apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts"
      issue: "markOlderPageFailed commits isLoadingOlder=false in a separate render from the caller's error flag (line 271)"
    - path: "apps/web/tests/intersection-observer.ts"
      issue: "mock never auto-fires on observe(), so existing bounded-retry tests cannot see the re-attachment window (coverage hole)"
  missing:
    - "Move the failure flag into store pagination state (hasLoadError set in the same reducer update that clears isLoadingOlder); read it via selector in useLoadOlderMessages"
    - "Key the lines 29-35 error reset to conversationId instead of callback identity (defense-in-depth)"
    - "Extend the IO test mock to auto-deliver an initial observation for an intersecting sentinel and assert exactly one automatic attempt after failure"
  debug_session: ".planning/debug/older-load-double-retry.md"
