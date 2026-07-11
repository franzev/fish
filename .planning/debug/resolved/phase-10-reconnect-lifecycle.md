---
status: resolved
trigger: "Phase 10 repeatedly passes a narrow reconnect fix, then re-verification finds a sibling stale async ownership race; debug the whole reconnect lifecycle instead of another symptom-specific gap cycle."
created: 2026-07-11T07:55:00+08:00
updated: 2026-07-11T08:10:00+08:00
---

## Current Focus

hypothesis: Confirmed and fixed — effect-generation callbacks require synchronous revocation before asynchronous unsubscribe, while recovery promises require identity-owned settlement.
test: Public messages/reads/reactions callback matrix plus deferred A/B recovery overlap, surrounding chat tests, full web suite, lint, typecheck, and production build.
expecting: All stale A callbacks are inert; B independently skips each channel's first subscribe, coalesces sibling reconnects behind one bounded recovery, ignores A settlement, and releases only B's active lock.
next_action: Archived; no further action required.

## Symptoms

expected: "Each conversation owns its realtime subscription callbacks, per-channel first-subscribe tracker, and reconnect recovery lock. After switching A to B, no callback or promise from A may mutate B; B's first callback per channel is skipped and one later genuine reconnect starts one bounded recovery."
actual: "Plan 10-07 prevents A's late promise settlement from clearing B's lock, but a queued A SUBSCRIBED callback can still consume B's reset first-subscribe slot or acquire the shared lock using A's captured recovery. Re-verification therefore still fails CLOAD-06."
errors: "No runtime exception. Behavioral failure: verifier probe expected B's first SUBSCRIBED callback to launch zero recoveries, but it launched one after a stale A callback consumed B's tracker slot."
reproduction: "Mount conversation A, capture A's realtime status callback, rerender the same ChatClient with conversation B, invoke the stale A SUBSCRIBED callback, then invoke B's first SUBSCRIBED callback. The first B callback is incorrectly treated as reconnect and starts bounded backfill. Repeat across messages, reads, and reactions and with overlapping recovery promises."
started: "The shared per-channel first-subscribe tracker and in-flight lock were introduced during Phase 10 reconnect consolidation. Plan 10-07 fixed stale promise release ownership on 2026-07-11, after which code review and independent re-verification exposed stale callback acquisition ownership."

## Eliminated

- Full-history refresh as the cause — reconnect recovery remains bounded and uses the existing backfill/newest-window paths.
- Reducer dedup/order as the cause — visible message merge behavior and portable fixtures pass; the defect occurs before recovery ownership reaches the reducer.
- Promise release identity alone as a complete fix — Plan 10-07 proves it prevents stale settlement from clearing B's lock, but it cannot stop a stale callback from acquiring or mutating B's shared state.

## Evidence

- timestamp: 2026-07-11T07:55:00+08:00
  checked: `.planning/phases/10-chat-message-loading-optimization/10-REVIEW.md CR-01`
  found: |
    The three subscription status callbacks close over conversation A's handleReconnected but share refs reset for conversation B. Cleanup is asynchronous and cannot revoke an already queued callback.
  implication: Callback acquisition needs active-generation ownership in addition to promise release ownership.

- timestamp: 2026-07-11T07:55:00+08:00
  checked: `.planning/phases/10-chat-message-loading-optimization/10-VERIFICATION.md CR-01`
  found: |
    An independent temporary public-callback probe reproduced stale A consuming B's messages first-subscribe slot; B's first callback then incorrectly launched one bounded recovery.
  implication: The issue is source-confirmed and behaviorally reproduced, not speculative review feedback.

- timestamp: 2026-07-11T07:55:00+08:00
  checked: `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts`
  found: |
    Promise settlement compares identity before clearing the lock, but status callbacks at messages, reads, and reactions call handleReconnected without checking whether their subscription generation remains active.
  implication: The lifecycle safety invariant is incomplete at the callback boundary for all three channels.

- timestamp: 2026-07-11T09:18:00+08:00
  checked: Full `use-chat-realtime.ts`, `realtime.ts`, Plan 10-07 regression, review, and verifier artifacts
  found: |
    `subscribeAfterAuth.unsubscribe` only prevents a not-yet-built channel or asynchronously removes an existing channel. The hook's messages, reads, and reactions callbacks have no local active flag. The shared Set and lock reset for B, while every A callback still closes over A's recovery/status functions. Promise settlement alone compares identity.
  implication: A complete fix must synchronously revoke callback ownership in all three effect cleanups before unsubscribe, guard both data/status callbacks, and retain promise-owned lock release.

- timestamp: 2026-07-11T09:18:00+08:00
  checked: Common async/timing and state-management bug patterns
  found: |
    The symptom matches stale closure plus invalid shared-state transition: callbacks remain callable after their owning effect cleanup and mutate refs whose meaning has changed to conversation B.
  implication: The falsifiable boundary is cleanup-time callback revocation, not Supabase channel removal timing or reducer behavior.

- timestamp: 2026-07-11T08:03:00+08:00
  checked: New public-behavior regression `revokes every conversation A realtime callback before conversation B owns reconnect state`
  found: |
    RED reproduced deterministically: after rerendering B, retained A messages callback `SUBSCRIBED` then `CHANNEL_ERROR` changed A's cleanup-owned store status from `idle` to `disconnected` (expected `idle`). Vitest: 1 failed, 62 skipped.
  implication: Cleanup/removal does not revoke queued callback authority. The stale callback boundary is directly reproduced independently of promise settlement.

- timestamp: 2026-07-11T08:06:00+08:00
  checked: GREEN focused lifecycle matrix after adding per-effect active-owner guards
  found: |
    Both lifecycle regressions pass: 2 passed, 61 skipped. Retained A data/status callbacks are inert after cleanup; B keeps all three first-subscribe entries, sibling reconnect callbacks coalesce behind B's lock, A settlement cannot release B, and B settlement permits a later reactions-channel recovery.
  implication: Synchronous callback revocation plus promise-identity settlement ownership closes both acquisition and release races through public behavior.

- timestamp: 2026-07-11T08:09:00+08:00
  checked: Public-behavior RED/GREEN regression matrix
  found: |
    | Lifecycle case | RED | GREEN |
    |---|---|---|
    | Stale A messages status after cleanup | Overwrote `idle` with `disconnected` | Inert; A remains `idle` |
    | Stale A messages/reads/reactions first-subscribe callbacks | Consumed B's shared per-channel tracker entries | Inert; B skips all three initial callbacks |
    | Stale A data callbacks | Merged stale message/read state or triggered reaction refresh | Inert across all three callback entry points |
    | B genuine sibling reconnects | Could race with stale acquisition | Messages starts one bounded recovery; reads/reactions coalesce |
    | A/B overlapping promises | A previously could affect shared lifecycle | A settlement cannot release B's identity-owned lock |
    | Active B settlement | Required release without leak | B releases its own lock; later reactions reconnect starts recovery |
    | Reconnect status | Stale A callback could overwrite cleanup state | Only active messages generation updates connecting/connected/disconnected/idle |
  implication: The regression suite covers acquisition, mutation, settlement, teardown, sibling coalescing, and active-owner release rather than one callback line.

- timestamp: 2026-07-11T08:10:00+08:00
  checked: Required automated verification
  found: |
    Focused lifecycle matrix 2/2 passed; complete chat-client 63/63 passed; surrounding chat 123/123 passed across 7 files; full web 503/503 passed across 61 files; `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed; `git diff --check` passed.
  implication: Original reproduction and adjacent chat behavior are verified with production compilation.

## Root Cause

The three React subscription effects delegated cleanup to asynchronous Supabase channel removal but did not synchronously revoke their captured callbacks. After conversation A cleaned up and shared refs reset for B, queued A messages/reads/reactions callbacks could still mutate data/status, consume B's first-subscribe Set entries, or acquire the shared reconnect lock with A's captured recovery. The promise-identity guard fixed only late release, not callback acquisition or mutation.

## Resolution

root_cause: Subscription effect generations had no synchronous callback-ownership revocation; asynchronous unsubscribe left stale A callbacks authoritative over refs and state already reassigned to B.
fix: Added an effect-local active owner flag for messages, reads, and reactions; every data/status callback returns when inactive, and cleanup revokes ownership before unsubscribe. Retained promise-identity lock release. Expanded public regressions across all three channels, stale data/status callbacks, first-subscribe tracking, sibling coalescing, overlapping A/B promises, stale settlement, active release, and status updates.
verification: RED failed deterministically with stale A changing idle to disconnected. GREEN passed focused 2/2, chat-client 63/63, surrounding chat 123/123, full web 503/503, lint, typecheck, build, and diff check.
files_changed:
  - apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
  - apps/web/app/(authenticated)/chat/chat-client.test.tsx
