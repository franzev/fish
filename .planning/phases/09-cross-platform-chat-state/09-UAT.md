---
status: testing
phase: 09-cross-platform-chat-state
source: [09-VERIFICATION.md]
started: 2026-07-10T10:26:00Z
updated: 2026-07-10T10:26:00Z
---

## Current Test

number: 1
name: HV-04 — Community send e2e spec passes against a live server (required before release)
expected: |
  Run `apps/web/e2e/chat-send.spec.ts` against a live dev server with seeded
  Supabase (`pnpm --filter @fish/web exec playwright test e2e/chat-send.spec.ts`).
  The rewritten spec (reload-persistence + exact-count, no `.last()`, no
  incompatible status-image assertion) passes end to end.
awaiting: user response

## Tests

### 1. HV-04 — Community send e2e spec passes against a live server (required before release)
expected: |
  Run `apps/web/e2e/chat-send.spec.ts` against a live dev server with seeded
  Supabase (`pnpm --filter @fish/web exec playwright test e2e/chat-send.spec.ts`).
  The rewritten spec (reload-persistence + exact-count, no `.last()`, no
  incompatible status-image assertion) passes end to end. `playwright test
  --list` discoverability was already confirmed by verification; live
  execution is the one genuinely unverified round-4 claim.
result: [pending]

### 2. HV-01 — Older-page failure shows a calm, stable-height retry region (recommended)
expected: |
  Force an older-page failure in `/channels/general` (throttle/disable
  network), confirm the calm notice-tone retry region appears with no
  transcript jump, then retry successfully. One automatic attempt only, a
  stable-height retry region (no layout shift), and successful manual
  recovery. Backed by chat-client.test.tsx's WR-07 same-DOM-node geometry
  test; jsdom cannot measure real pixel height.
result: [pending]

### 3. HV-02 — In-flight older load in conversation A cannot corrupt conversation B (recommended)
expected: |
  Start an older-page load in conversation A, switch to conversation B
  before A settles, then let A settle as both a failure and a success.
  A cannot gate B, write B's error state, suppress B's first sentinel load,
  or inject A's page into B. Backed by two deferred-switch regression tests
  (09-15); only the literal scrollTop write into the live viewport is
  unautomatable in jsdom.
result: [pending]

### 4. HV-03 — Cross-account isolation in a real browser; failed sign-out preserves state (recommended)
expected: |
  Sign in as account A in one tab, then (without using the Log out button)
  sign in as account B in a second tab / same tab after expiry. B never
  sees A's draft/pending/failed rows. Separately, force `signOut()` to fail
  (e.g. offline) and confirm the account is NOT navigated/cleared — A's
  state is preserved and calm retry guidance appears. Backed by
  chat-store/chat-identity-guard/logout-button tests; the genuine two-tab
  browser session is unautomatable in jsdom.
result: [pending]

### 5. HV-05 — App-shell logo is a comfortable 56px tap target (optional, low risk)
expected: |
  Visually confirm the app-shell logo link is a comfortably large, centered
  56px tap target on the rendered community shell. Low risk:
  app-shell.test.tsx asserts the exact `min-h-control`/`min-w-control`/
  `items-center`/`justify-center` classes reusing the already-shipped
  `--size-control` token.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
