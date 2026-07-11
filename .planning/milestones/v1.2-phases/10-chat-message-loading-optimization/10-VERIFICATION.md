---
phase: 10-chat-message-loading-optimization
verified: 2026-07-11T00:26:13Z
status: passed
score: "38/38 plan truths verified; 6/6 requirements passed"
has_blocking_gaps: false
re_verification: true
head_verified: 87a96f630daf296b345915b472e959046808eb2e
requirements:
  CLOAD-01: passed
  CLOAD-02: passed
  CLOAD-03: passed
  CLOAD-04: passed
  CLOAD-05: passed
  CLOAD-06: passed
requirements_verified:
  - CLOAD-01
  - CLOAD-02
  - CLOAD-03
  - CLOAD-04
  - CLOAD-05
  - CLOAD-06
requirements_failed: []
schema_drift: false
gaps:
  - id: CR-01
    requirement: CLOAD-06
    truth: "Each conversation skips every channel's first post-mount SUBSCRIBED callback and only callbacks owned by the active conversation may acquire its reconnect recovery lock."
    status: resolved
    resolved_by: c404b0cddc659af0650f06da465a8165608f0519
    reason: "Commit c404b0cd adds a per-effect `active` revocation flag to all three subscription effects in use-chat-realtime.ts. Every payload and status callback returns before touching setRealtimeStatus, seenFirstSubscribeRef, or backfillInFlightRef once the owning effect has cleaned up, so a removed conversation A's queued callback can no longer consume B's first-subscribe slots, misclassify B's first SUBSCRIBED, or acquire the shared recovery lock with A's captured backfill."
human_verification:
  - id: HV-01
    status: resolved
    test: "In a real seeded conversation with more than 40 messages, load at least three older pages using both the near-top sentinel and the Load earlier messages button."
    expected: "The message under the reader's eye does not move; the two-row message-shaped skeleton transitions to final rows without a visible jump; no duplicate appears; focus remains stable."
    why_human: "Real scroll geometry, browser paint timing, and perceptual skeleton-to-content stability are not measurable in jsdom."
    resolution: "10-UAT.md test 1 (result: pass) with real-browser evidence: three older 40-message pages loaded through both the near-top sentinel and the manual button (40 → 80 → 120 → 160 rows); each prepend restored scrollTop by exactly the added scrollHeight delta (4124px, 4059px, 3969px); the pagination slot stayed fixed at 104px; all 160 rendered rows were unique; focus stayed within the transcript surface; no console warnings or errors. UAT summary: 5 passed, 0 issues."
---

# Phase 10: Chat Message Loading Optimization Verification

**Phase goal:** Opening a conversation renders a bounded newest window near-instantly; older history arrives through cursor pagination with reading position preserved; realtime and reconnect recovery remain bounded, ordered, gap-free, and duplicate-free.

**Verdict:** `passed`. Re-verification at HEAD `87a96f63` confirms the single blocking gap from the 2026-07-10 verification (CR-01, CLOAD-06) is closed by commit `c404b0cd`, all automated gates pass, and the sole human-verification item (HV-01) is satisfied by the completed real-browser UAT in `10-UAT.md`.

## Re-verification Result

Previous verification (against `42787a2f`): `gaps_found`, 36/38 truths, 5/6 requirements, one blocking gap (CR-01) and one pending human item (HV-01).

### CR-01 closure — stale realtime callback revocation

**Source trace (`apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts`):**

- Each of the three subscription effects (messages, reads, reactions) declares `let active = true` and its cleanup sets `active = false` before `unsubscribe()` (lines 176-177/228-232, 245-246/268-271, 274-275/294-297).
- Every callback the effect hands to the channel checks `if (!active) return;` **before any mutation**: the messages payload callback (line 182), the messages SUBSCRIBED status callback (line 206, ahead of `setRealtimeStatus` and `handleReconnected("messages")`), the messages error/disconnect callback (line 213, ahead of `setRealtimeStatus(..., "disconnected")`), the reads payload and status callbacks (lines 250, 260), and the reactions payload and status callbacks (lines 280, 286).
- Because the effects re-run on `chat.conversationId`, an A-to-B switch runs A's cleanups synchronously during the rerender commit; any A callback still queued by the asynchronous channel removal is revoked at entry and can no longer mutate realtime status, insert into the freshly reset `seenFirstSubscribeRef`, or acquire `backfillInFlightRef`.
- The Plan 10-07 promise-identity release guard is preserved unchanged (lines 165-171): a settling backfill clears the lock only when `backfillInFlightRef.current === ownedBackfillPromise`.

Callback **acquisition** is now guarded (this fix) in addition to promise **release** ownership (Plan 10-07) — both halves of the CR-01 boundary are closed.

**Regression evidence (`apps/web/app/(authenticated)/chat/chat-client.test.tsx`, added/extended in `c404b0cd`):**

The updated VR-01 test ("keeps conversation B's reconnect lock when conversation A settles late", lines 2347-2483) and the new revocation test ("revokes every conversation A realtime callback before conversation B owns reconnect state", lines 2485-2610) together invoke retained stale A callbacks **after** rerendering to B and prove every behavior the previous verification demanded:

| Required proof | Evidence |
|---|---|
| Stale A callbacks cannot consume any of B's three first-subscribe slots | Revocation test: stale A messages/reads/reactions `SUBSCRIBED` fire after the switch, then B's first `SUBSCRIBED` on all three channels triggers **zero** backfills and B's status becomes `connected` — B's first connects are still classified as first connects. |
| Stale A callbacks cannot launch A or B recovery after the switch | Both tests: after firing stale A status callbacks post-switch, `backfillMessagesAction` call count is unchanged (0 in the revocation test; stays at 2 in VR-01). Stale A payload handlers are also inert: the stale message is not merged into A's store slice, coach read state stays `lastReadMessageId: null`, `refreshMessagesAction` is never called, and A's realtime status stays `idle`. |
| B's first callback remains skipped | VR-01 line 2433: after B's first `SUBSCRIBED` batch across all three channels, the count is still 1 (only A's earlier genuine reconnect). |
| B's second callback starts exactly one bounded B recovery | VR-01 lines 2435-2445: B's second batch produces exactly call #2 with `conversationId: nextConversationId` and B's authoritative cursor. |
| Stale A callbacks while B is pending cannot clear, replace, or contend for B's lock | VR-01 lines 2447-2465: A's late promise settles, then stale A `SUBSCRIBED` on all three channels plus a B `SUBSCRIBED` fire while B's recovery is pending — the count stays 2 with exactly one B call. Lines 2467-2482: after B's own settlement, a further B `SUBSCRIBED` starts a new recovery (call #3, second B call), proving B's lock was held by B and released by B. |

This directly covers the scenario that failed the previous verifier probe (stale A `SUBSCRIBED` invoked after the rerender to B, before B's first `SUBSCRIBED`).

### HV-01 closure — real scroll and skeleton geometry

Satisfied by human/agent UAT (`10-UAT.md`, status `complete`, 5 passed / 0 issues). Test 1 result: **pass**, with real-browser evidence on seeded data: three older pages loaded via both the near-top sentinel and the manual button (40 → 80 → 120 → 160 rows); scrollTop restored by exactly the added scrollHeight delta each time (4124px, 4059px, 3969px); pagination slot fixed at 104px; 160 unique rows; stable focus; zero console errors. The earlier cosmetic skeleton gap recorded in `10-UAT.md` is `resolved` (Plan 10-05 fixed-slot, layout-matched two-row skeleton, retested 2026-07-11).

UAT tests 3-5 additionally corroborate reconnect coalescing, the gap-exceeds-bound reset path, and channel-error status wiring.

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| CLOAD-01 | PASSED | Initial messages limited to the retained 40-row window; reaction enrichment scoped to retained ids in bounded batches (unchanged since previous pass; regression-covered in full suite). |
| CLOAD-02 | PASSED | Realtime inserts merge through the canonical reducer path without full-history reloads (unchanged; regression-covered). |
| CLOAD-03 | PASSED | Strict composite-keyset older pagination, guarded loading, quiet manual load, near-top auto-load (unchanged; regression-covered). |
| CLOAD-04 | PASSED | Manual height-delta restoration, disabled browser anchoring, newest-identity stick-to-bottom, fixed shared skeleton geometry at source/test level; HV-01 real-browser geometry now confirmed by 10-UAT.md test 1. |
| CLOAD-05 | PASSED | Dedup by id/clientRequestId and `(createdAt,id)` ordering across optimistic, realtime, hydration, and paginated paths (unchanged; regression-covered). |
| CLOAD-06 | **PASSED** | Bounded authoritative recovery, promise-owned lock release (Plan 10-07), and — new at `c404b0cd` — revoked stale callback acquisition. One coalesced, conversation-owned recovery per genuine reconnect is now guaranteed at both the acquisition and release boundaries, with public-behavior regressions for the A-to-B stale-callback matrix. |

## Automated Evidence (gates run by this verifier at HEAD 87a96f63)

- Focused file: `pnpm exec vitest run "app/(authenticated)/chat/chat-client.test.tsx"` — **63/63 passed** (includes both CR-01 regressions; the file grew from 62 to 63 tests at `c404b0cd`).
- Full web suite: `pnpm exec vitest run` in `apps/web` — **61 files / 503 tests passed** (previous verification: 502; +1 is the new revocation test).
- Production build: `pnpm build` — **passed** ("Done", all routes compiled).
- Debt markers: no `TODO`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER`/`TBD` in the two files changed by `c404b0cd`.
- Schema drift: `false` (no schema-bearing files changed since the previous verification; only the hook, its test, and planning/docs artifacts landed in `84b428f3..87a96f63`).

Note (non-blocking, out of phase scope): the working tree carries an uncommitted one-line barrel-export widening in `apps/web/components/chat/index.ts` (`export { MessageStatus }` → `export *`). Gates above were run with it present and pass; it is unrelated to Phase 10 realtime work.

## Gaps

None blocking. CR-01 is `resolved` (see frontmatter) by `c404b0cd` and verified against source, regressions, and gates at HEAD.

## Human Verification

HV-01 `resolved` via completed `10-UAT.md` (5/5 passed, 0 issues) — see frontmatter for the real-browser evidence citation.

## Verification Complete

**Status:** `passed`

**Score:** 38/38 plan truths verified; 6/6 requirements passed

Phase 10 goal achieved: bounded newest-window open, cursor-paginated history with preserved reading position, and bounded, ordered, gap-free, duplicate-free realtime/reconnect recovery — including conversation-owned reconnect state across A-to-B switches.

---

*Verified: 2026-07-11T00:26:13Z*
*Verifier: gsd-verifier (subagent)*
