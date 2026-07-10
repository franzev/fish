---
status: testing
phase: 09-cross-platform-chat-state
source: [09-VERIFICATION.md]
started: 2026-07-10T21:33:50Z
updated: 2026-07-10T21:33:50Z
---

## Current Test

number: 1
name: HV-01R — Older-page failure makes exactly one automatic attempt (live re-confirmation)
expected: |
  In a real browser, force an older-page load failure in /channels/general
  (throttle/disable network on scroll-to-top) and count automatic "load
  earlier" network requests before the calm notice-tone retry region
  settles. Exactly ONE automatic request fires, then the calm
  load-older-error region appears with no transcript jump; manual
  "Try again" still recovers. (Previously 5 of 7 instrumented Playwright
  runs showed two automatic requests — round-5 Test 2.)
awaiting: user response

## Tests

### 1. HV-01R — Older-page failure makes exactly one automatic attempt (live re-confirmation, recommended before release)
expected: |
  In a real browser, force an older-page load failure in `/channels/general`
  (throttle/disable network on scroll-to-top) and count automatic "load
  earlier" network requests before the calm notice-tone retry region
  settles. Exactly ONE automatic request fires, then the calm
  load-older-error region appears with no transcript jump; manual
  "Try again" still recovers.

  Why human: the original bug was a React-commit-timing/frame race invisible
  to jsdom until the IntersectionObserver mock was made browser-faithful.
  The fix is proven by a deterministic unit reproduction of the exact race
  plus a passing regression test (chat-client.test.tsx), but has not been
  re-confirmed under a real browser's actual paint/commit scheduling since
  the fix landed.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Notes

Round 5 (2026-07-10, superseded by this round): HV-04 (community send e2e
spec against live server), HV-02 (cross-conversation isolation), HV-03
(cross-account isolation / failed sign-out preservation), and HV-05 (56px
logo tap target) all passed live and are untouched by 09-19's change set —
not re-listed here (see git history of this file and 09-VERIFICATION.md).
Round-5 Test 2's failure is the gap below, closed by plan 09-19 and
re-verified at source/test level in 09-VERIFICATION.md.

## Gaps

- truth: "A failed older-page load makes exactly one automatic attempt, then waits calmly for manual retry"
  status: resolved
  resolution: "Closed by gap-closure plan 09-19 (commits d6e60276..61227008): hasLoadError moved into portable ChatPaginationState and committed atomically with isLoadingOlder=false in one reducer update on olderPageLoadFailed; per-conversation selectHasLoadErrorForConversation replaces the hook's local useState flag and callback-identity reset; browser-faithful auto-firing IntersectionObserver mock plus regression test prove exactly one automatic attempt (chat-client.test.tsx). Re-verified 2026-07-10 in 09-VERIFICATION.md (4/4 gap-closure must-haves VERIFIED); live re-confirmation queued as Test 1 (HV-01R) of this round."
  reason: "User reported: (verified by Claude via instrumented Playwright) two identical automatic older-page requests fired (same keyset cursor, ~0.4-1.0s apart) in 5 of 7 runs before the error state settled; expected exactly one automatic attempt"
  severity: minor
  test: 2 (round 5)
  root_cause: "The one-automatic-attempt gate is split across two state systems that commit in separate renders: on failure, the store's isLoadingOlder=false (markOlderPageFailed, flushed via useSyncExternalStore) commits before the awaiting caller's local setHasOlderLoadError(true), so for one commit the observer guard (hasMoreOlder && !isLoadingOlder && !hasOlderLoadError) passes, re-attaching the IntersectionObserver over the still-intersecting sentinel, whose initial observation fires the second identical-cursor request. Bounded at two because the error flag is set before attempt 2 settles."
  artifacts:
    - path: "apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts"
      issue: "(historical) error flag set one commit after the store's failure update; observer guard re-attached in the gap commit — fixed by 09-19"
    - path: "apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts"
      issue: "(historical) markOlderPageFailed committed isLoadingOlder=false in a separate render from the caller's error flag — fixed by 09-19"
    - path: "apps/web/tests/intersection-observer.ts"
      issue: "(historical) mock never auto-fired on observe(), hiding the re-attachment window — fixed by 09-19 (browser-faithful auto-delivery)"
  debug_session: ".planning/debug/resolved/older-load-double-retry.md"
