---
status: diagnosed
trigger: "User reported verbatim: \"loading earlier messages breaks the app\" during 09-UAT.md Test 2"
created: 2026-07-10T06:02:01Z
updated: 2026-07-10T06:02:01Z
---

## Current Focus

hypothesis: A failed older-page load leaves `hasMoreOlder`/`oldestLoadedCursor` retryable by design (reducer.ts), but the `IntersectionObserver` effect that triggers the load re-fires immediately once `isLoadingOlder` flips back to `false`, because the sentinel is still visible. With no delay, backoff, or retry cap, this becomes a tight, silent, unbounded retry loop that hammers the server action and leaves the UI flickering its loading skeleton — read by the tester as "breaks the app."
test: Static trace of the full pagination trigger path: `use-load-older-messages.ts` observer effect -> `use-chat-messages.ts` `loadOlderMessages` -> `loadOlderMessagesAction` -> `reducer.ts` `olderPageLoadFailed`.
expecting: A single transient failure of `loadOlderMessagesAction` while scrolled to the top produces repeated, uncapped re-invocations with no user action in between, and no visible error affordance distinct from the loading skeleton.
next_action: Fix plan should add a bounded retry/backoff (or a distinct failed-state affordance that stops the auto-trigger until the user acts) in the older-page-load path, plus a component-level test that exercises the failure branch (existing tests only mock the success path).

## Symptoms

expected: "Open the community room at `/channels/general`. Confirm the screen shows one conversation (no picker/menu), one send action, calm notice-tone copy, and no obvious layout jump."
actual: User reported verbatim: "loading earlier messages breaks the app".
errors: No runtime error/stack trace supplied by the tester; investigation was static (no live browser reproduction available).
reproduction: 09-UAT.md Test 2, discovered while re-verifying the community room after phase 09 gap-closure round 2.
started: Discovered during the 2026-07-10 UAT restart, after plans 09-07..09-11 landed.

## Eliminated

- Pure reducer/fixture-level pagination logic (`olderPageLoaded`, `olderPageDuplicateReconciliation`, `gapBackfillOutOfOrder`, `olderPageLifecycle`) — all pass in isolation via `chat-state-fixtures.test.ts`; the bug is in UI wiring built on top of a correctly-behaving state machine, not the state machine itself.
- `olderPageLoadFailed`'s "leave pagination retryable" behavior (reducer.ts:184-196) — this is intentional by design (confirmed by its own comment and `chat-store.test.ts:384`), not itself the bug. The bug is that nothing above it caps how often the retry condition re-fires.

## Evidence

- timestamp: 2026-07-10T06:02:01Z
  checked: `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts:47-64`
  found: |
    The `IntersectionObserver` effect depends on `[hasMoreOlder, isLoadingOlder, loadOlderAndPreserveScroll, sentinelRef]` and re-creates + re-`observe()`s the sentinel node on every change to those values. `IntersectionObserver.observe()` fires its callback asynchronously with the *current* intersection state — if the sentinel is already visible when `.observe()` runs, the callback fires immediately.
  implication: Every time `isLoadingOlder` flips `true -> false` (success or failure), a fresh observer is attached and immediately fires again if the sentinel (top-of-list) is still on screen — which it always is after a failed load, since nothing scrolled.

- timestamp: 2026-07-10T06:02:01Z
  checked: `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts:225-265` (`loadOlderMessages`)
  found: |
    `await loadOlderMessagesAction({...}).catch(() => null)` swallows rejections; both a caught rejection and a `status !== "sent"` response fall through to `markOlderPageFailed(chat.conversationId)` with no delay, no backoff, and no retry counter.
  implication: There is nothing between "load failed" and "sentinel visible again" that would prevent the observer from firing the next load attempt on the very next paint.

- timestamp: 2026-07-10T06:02:01Z
  checked: `packages/core/src/chat-state/reducer.ts:184-196` (`olderPageLoadFailed`)
  found: Sets `isLoadingOlder: false` but deliberately leaves `hasMoreOlder`/`oldestLoadedCursor` untouched "so a retry is still possible" (comment + `chat-store.test.ts:384`).
  implication: This design is correct at the state-machine layer; it assumes something above it gates *when* a retry happens. Nothing does.

- timestamp: 2026-07-10T06:02:01Z
  checked: `apps/web/app/(authenticated)/chat/actions.ts:609-665` (`loadOlderMessagesViaLocalRpc`)
  found: Calls `getLocalFallbackContext()`, which returns `null` (triggering a `"notice"`/failure status) on any transient session-read hiccup. Phase 09-08 moved the canonical route to `/channels/[id]`, so a user scrolling immediately after landing on the route is exercising this exact path right after a fresh RSC/server-action boundary.
  implication: A plausible, concrete trigger for the *first* failure exists in normal usage, not just as a theoretical edge case — it doesn't require a flaky network, just page-load timing.

- timestamp: 2026-07-10T06:02:01Z
  checked: `apps/web/app/(authenticated)/chat/chat-client.tsx:285-314` and the rest of the file's `Alert`/notice rendering
  found: No visible error affordance exists for a failed older-page load — only `isOffline` (realtime disconnected) and composer `notice` render an `Alert`. A failed older-page load is invisible except for the loading skeleton (`data-testid="load-older-skeleton"`) flickering on/off each retry cycle.
  implication: The user-visible symptom is a stuck, flickering, unresponsive top-of-list — consistent with "breaks the app" — with no clue what's wrong or how to stop it.

- timestamp: 2026-07-10T06:02:01Z
  checked: `apps/web/app/(authenticated)/chat/chat-client.test.tsx:1237-1352` ("load earlier" test block) and `chat-store.test.ts:384`
  found: All "load earlier" component tests mock `loadOlderMessagesAction` as always resolving `{status: "sent", ...}` — none reject or return `status: "notice"`. `chat-store.test.ts:384` only asserts reducer *state* after one failed dispatch, never simulates the sentinel remaining intersecting or asserts how many times the load action is invoked afterward. No dedicated test file exists for `use-load-older-messages.ts`. `apps/web/e2e/` has no Playwright coverage of real-browser scroll/`IntersectionObserver` timing for pagination (jsdom's mocked observer, driven manually via a test helper, does not reproduce "already-intersecting-on-observe" auto-fire behavior).
  implication: This is a genuine, previously-uncovered gap — the fix needs both the retry-storm guard and a new failure-path test that would have caught it.

## Secondary candidate (lower confidence, not primary)

`apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts:77-91` — a `ResizeObserver` forces `scrollTop = scrollHeight` whenever near-bottom, uncoordinated with the scroll-preserving `requestAnimationFrame` restore in `use-load-older-messages.ts:41-44`. Only a risk in a very short conversation where "near top" and "near bottom" overlap within the 100px threshold. Worth a look during the fix but not believed to be the primary cause.

## Root Cause

Unbounded retry loop: a failed older-page load is left retryable by design at the state layer (correct), but the `IntersectionObserver` effect in `use-load-older-messages.ts` re-fires immediately once `isLoadingOlder` resets to `false`, because the sentinel never stopped being visible. No delay, backoff, or retry cap exists between a load failure and the next auto-triggered attempt, and no visible error affordance distinguishes a stuck retry loop from normal loading — read by the tester as the app "breaking."

## Fix Direction (for planning, not applied here)

1. `use-load-older-messages.ts`: after a failed load, don't let the observer immediately re-trigger — either disconnect/pause until a user-initiated retry, or add a bounded backoff with a max-attempt cap.
2. `chat-client.tsx`: add a visible, calm-tone failure affordance for a stuck older-page load (distinct from the loading skeleton), consistent with the project's "copy never scolds" rule.
3. Add a component-level test in `chat-client.test.tsx` (or a new `use-load-older-messages.test.ts`) that mocks `loadOlderMessagesAction` to reject/return `status: "notice"` with the sentinel still intersecting, and asserts the action is not called an unbounded number of times.
