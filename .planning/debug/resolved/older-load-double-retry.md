---
status: resolved
trigger: "Older-page load failure in /channels/[id] fires TWO identical automatic requests (same keyset cursor, ~0.4-1.0s apart) before the error region settles; expected exactly ONE automatic attempt then manual retry. 5 of 7 instrumented Playwright runs."
created: 2026-07-10T19:20:00Z
updated: 2026-07-10T21:33:50Z
---

## Current Focus

hypothesis: CONFIRMED — split-commit gap between store failure state and local error flag re-arms the IntersectionObserver
test: deterministic vitest repro with a browser-faithful (auto-firing) IntersectionObserver mock
expecting: n/a — root cause confirmed
next_action: hand off to fixer (diagnose-only session; no fix applied)

## Symptoms

expected: After one failed "load earlier" request, the client makes NO further automatic attempts; a calm error region (`load-older-error`, "Couldn't load earlier messages. Try again.") awaits a manual retry.
actual: Two identical automatic requests (same `{createdAt, id}` cursor) fire ~0.4-1.0s apart (= the request latency of attempt 1); the second failure then settles into the stable error region. Never a third attempt.
errors: none client-side; the older-page action fails (aborted/non-"sent" result) by test instrumentation
reproduction: Scroll sentinel into view in community chat with older-page action failing; observed 5/7 Playwright runs against dev server. Deterministic unit repro below.
started: latent since the failure-gate was implemented as local state in use-load-older-messages.ts (masked in unit tests by a non-auto-firing IO mock)

## Eliminated

- hypothesis: "onLoadOlder identity churns after a same-conversation failure, so the reset block (use-load-older-messages.ts:32-35) clears hasOlderLoadError and re-arms the observer" (the briefed hypothesis)
  evidence: Every dependency of `loadOlderMessages` (use-chat-messages.ts:277-284) is referentially/value-stable across a failure: `applyOlderPage`/`markOlderPageFailed`/`requestOlderMessages` are created once at store creation (chat-store.ts:118-251, plain zustand vanilla store; `dispatchChatEvent`'s `set` only ever replaces `conversations`, never the action fields); `chat.conversationId` is a stable string (server-component prop, channels/[id]/page.tsx:38-51 passes module-imported server actions, so `loadOlderMessagesAction` is stable too); `hasMoreOlder` is a boolean the reducer explicitly leaves untouched on failure (packages/core/src/chat-state/reducer.ts:190-200, comment at 196-197). The deterministic repro's render log shows `hasOlderLoadError` goes false -> false -> true and is NEVER reset back to false — the lines 32-35 reset block never executes in this flow.
  timestamp: 2026-07-10T19:28:00Z

- hypothesis: "In-flight guard failure lets two concurrent requests through"
  evidence: `loadingOlderConversationsRef` (use-chat-messages.ts:123-125, 239-247) correctly returns "skipped" for overlapping calls; the two observed requests are strictly sequential (second starts only after the first's failure settles), matching the 0.4-1.0s gap = attempt-1 latency.
  timestamp: 2026-07-10T19:28:00Z

## Evidence

- timestamp: 2026-07-10T19:24:00Z
  checked: chat-store.ts action identities (lines 118-251, 259-261)
  found: Store actions are fields of the initial state object, created once; zustand `useStore` selector returns the same references on every render. Only `clearChatStore()` (sign-out) replaces them.
  implication: Store-action deps cannot recreate `loadOlderMessages` on failure.

- timestamp: 2026-07-10T19:24:30Z
  checked: packages/core/src/chat-state/reducer.ts:159-200
  found: `olderMessagesRequested` only flips `isLoadingOlder: true`; `olderPageLoadFailed` only flips it back to false and deliberately leaves `hasMoreOlder`/`oldestLoadedCursor` untouched "so a retry ... is still possible".
  implication: On a same-conversation failure, no dep VALUE of `loadOlderMessages` changes -> `onLoadOlder` identity is stable -> reset block is inert. Also explains why both requests carry the identical cursor.

- timestamp: 2026-07-10T19:26:00Z
  checked: Two-commit interleaving in use-load-older-messages.ts + use-chat-messages.ts
  found: On failure, TWO state systems update in DIFFERENT microtasks: (a) `markOlderPageFailed` (use-chat-messages.ts:271) mutates the zustand store inside `loadOlderMessages`' async body — useSyncExternalStore subscribers force a SyncLane render that commits `isLoadingOlder=false` immediately; (b) `setHasOlderLoadError(true)` (use-load-older-messages.ts:91) runs in the AWAITING caller's continuation (`await onLoadOlder()` at line 64), a later microtask/lane. React commits (a) before (b).
  implication: There is an intermediate commit where `hasMoreOlder && !isLoadingOlder && !hasOlderLoadError` is all true. The observer effect (use-load-older-messages.ts:94-117, guard at line 96) re-attaches in that commit; the sentinel is still intersecting, so the real browser delivers an initial observation -> second automatic load. Whether the IO delivery beats the error-flag commit's disconnect is a frame-timing race -> the 5/7 flakiness.

- timestamp: 2026-07-10T19:26:30Z
  checked: Deterministic repro — temporary vitest harness rendering `useChatMessages` + `useLoadOlderMessages` with an IntersectionObserver mock that auto-fires on `observe()` for a still-visible sentinel (what real browsers do), failing the action outside a single batched flush. (Diagnostic file deleted after run.)
  found: Action called exactly 2 times, never 3. Render/event log: `render loading=false error=false` (intermediate commit) -> `IO observe` -> attempt 2 fires -> `render loading=true error=false` -> `IO disconnect` -> `render loading=true error=true` (attempt 1's error flag lands one commit late) -> attempt 2 fails -> `render loading=false error=true` (terminal).
  implication: Root cause reproduced without any Playwright timing. Also proves the exactly-two bound: attempt 2 launches while `error` is still false, but by the time attempt 2 FAILS, `hasOlderLoadError` is already true (set by attempt 1's continuation and re-set by attempt 2's), so the gap window `(loading=false && error=false)` never recurs -> no third attempt.

- timestamp: 2026-07-10T19:27:00Z
  checked: Why existing unit tests pass (chat-client.test.tsx:1420-1451 "bounds automatic load earlier retries after a failure while the sentinel stays visible")
  found: The shared mock in apps/web/tests/intersection-observer.ts only fires via manual `triggerIntersection()`; `observe()` records the callback but never delivers an initial observation for an intersecting target. The test's second manual trigger happens only AFTER `waitFor` settles the error state.
  implication: The test cannot detect the observer being re-attached during the gap commit — the exact behavior real browsers exercise. This is the coverage hole to close alongside the fix.

## Resolution

root_cause: The one-automatic-attempt failure gate is split across two state systems that commit in separate renders: on a failed older-page load, `markOlderPageFailed` (zustand store, `isLoadingOlder` -> false, SyncLane via useSyncExternalStore) commits BEFORE the awaiting caller's local `setHasOlderLoadError(true)` (use-load-older-messages.ts:64/91). In that intermediate commit the observer effect's guard `hasMoreOlder && !isLoadingOlder && !hasOlderLoadError` (use-load-older-messages.ts:96) passes, the effect re-attaches the IntersectionObserver over a still-intersecting sentinel, and the browser's initial observation fires a second automatic load with the same cursor (the reducer intentionally preserves `oldestLoadedCursor`/`hasMoreOlder` on failure). It stops at exactly two because attempt 2 starts before the error flag commits, but once it fails the flag is already true, so the gap window never reopens. NOT caused by the onLoadOlder identity-reset block (lines 29-35), which never fires on a same-conversation failure — all `loadOlderMessages` deps are stable (refuted; see Eliminated).
fix: (direction only — diagnose-only session) Make failure and loading land in ONE commit by moving the failure flag into the store's pagination state: `olderPageLoadFailed` sets `pagination.hasLoadError: true` in the same reducer update that clears `isLoadingOlder`, and `olderMessagesRequested` clears it; `useLoadOlderMessages` reads it via a selector instead of local `useState`. (Alternative minimal patch: report failure synchronously from inside `loadOlderMessages` — e.g., an `onOutcome` callback invoked next to `markOlderPageFailed` — so the flag is set in the same microtask as the store update.) Separately harden the reset block by keying it to `conversationId` rather than callback identity — but that is defense-in-depth, not the root cause. Test to add: browser-faithful IO mock that auto-delivers an initial observation on `observe()` for an intersecting sentinel (extend apps/web/tests/intersection-observer.ts), asserting exactly one action call after a failure; adjacent coverage lives at chat-client.test.tsx:1420 (retry bound), 1453 (calm error affordance), 1492 (manual retry clears notice), 1595 (reset gate on conversation change), 1645/1730 (WR-01 cross-conversation in-flight/stale-page behavior — must keep passing if the flag moves into the store, since WR-01 relies on per-conversation scoping, which store pagination state gives for free).
verification: Deterministic unit repro (2 calls, never 3, error region terminal) matches all four production observations: double fire, identical cursor, 0.4-1.0s spacing (= attempt-1 latency), never a third, 5/7 flakiness explained by IO-delivery-vs-commit frame race.
files_changed: []
