---
phase: 10-chat-message-loading-optimization
verified: 2026-07-10T00:11:21Z
status: human_needed
score: 6/6 must-haves verified (structural + automated); 5 sub-truths route to human verification
has_blocking_gaps: false
overrides_applied: 0
human_verification:
  - test: "Open a real seeded conversation (pnpm seed) with >40 messages and scroll up through 3+ older pages using both the sentinel (scroll near top) and the 'Load earlier messages' button."
    expected: "The message under the eye never visibly moves (instant restore, no jump/jank); skeleton rows never shift surrounding layout; no duplicate messages appear across pages."
    why_human: "jsdom performs no real layout — scrollTop/scrollHeight pixel-level restoration cannot be asserted by an automated test. Structural code (capture -> await -> requestAnimationFrame restore, overflow-anchor:none) is verified; this is the plan's own designated human-check (10-04 Task 3)."
  - test: "Toggle the network offline then online while a conversation is open; observe the loading skeleton, the offline banner, and the 'Reconnecting…' pill."
    expected: "All loading/offline/reconnect states read calm: notice/muted tone only, never red or alarming, non-scolding sentence-case copy, no spinner storms, reduced-motion respected."
    why_human: "Visual/perceptual calm is a design judgment, not a structural property — grep confirms tone=\"notice\" and no error/red classes, but 'does this feel calm' requires a human looking at it. Plan 10-04's own designated human-check."
  - test: "Force a real Supabase Realtime reconnect (e.g. suspend/resume the tab or toggle network) while three channels (messages/reads/reactions) are subscribed, and confirm exactly one bounded backfill fires — not three full refetches — and that each channel's very first post-mount SUBSCRIBED does not trigger a backfill."
    expected: "One coalesced, bounded gap-backfill call (via applyGapBackfill) runs per genuine reconnect; initial mount produces zero backfills; history stays gap-free with no duplicates."
    why_human: "No automated test drives the mocked Supabase channel's `.subscribe()` status callback through SUBSCRIBED/CHANNEL_ERROR/re-SUBSCRIBED transitions (chat-client.test.tsx's `realtimeMock.channel.subscribe.mockReturnValue(...)` never invokes the status callback). The per-channel first-subscribe Set and shared in-flight lock are verified structurally (code read, matches plan spec exactly) and by typecheck, but the coalescing behavior itself is unexercised by any test."
  - test: "Simulate (or wait for) a reconnect gap exceeding 40 newer messages while disconnected, and confirm the client resets to the bounded newest window (via loadNewestMessagesAction + hydrateWindow) rather than hanging or unbounded-refetching."
    expected: "needsReset triggers loadNewestMessagesAction, and the returned window re-hydrates via hydrateWindow with correct hasMoreOlder/oldestCursor/readStates; the transcript lands on the current newest window with no gap and no duplicate."
    why_human: "applyGapBackfill's needsReset branch is not exercised by any current automated test (no test injects backfillMessagesAction/loadNewestMessagesAction into ChatClient with a needsReset:true response). Verified structurally: the code path exactly matches the plan's specified needsReset -> loadNewestMessagesAction -> hydrateWindow sequence, and typecheck/build hold across the whole chain."
  - test: "Force the messages realtime channel to emit CHANNEL_ERROR/TIMED_OUT/CLOSED (e.g. kill the websocket) and confirm the store's realtime status flips to 'disconnected', then recovers to 'connected' on re-subscribe."
    expected: "The offline banner and 'Reconnecting…' pill appear/disappear correctly, driven by the real channel's status transitions, not just a manually-set store value."
    why_human: "chat-client.test.tsx proves the UI renders correctly GIVEN a manually-set 'disconnected' store status, but no test drives the actual mocked channel's subscribe callback with CHANNEL_ERROR/TIMED_OUT/CLOSED to prove realtime.ts's onDisconnected wiring fires in response to a real channel state change. Verified structurally (grep confirms the CHANNEL_ERROR/TIMED_OUT/CLOSED branch calls onDisconnected, and the messages effect wires it to setRealtimeStatus(..., 'disconnected'))."
---

# Phase 10: Chat Message Loading Optimization Verification Report

**Phase Goal:** Opening a conversation renders the newest messages near-instantly from a bounded initial window; older history arrives through cursor-based "load earlier" and infinite scroll with reading position preserved; realtime messages merge into the loaded list in place — no full reloads, no duplicate messages, no layout shift — and history stays gap-free and correctly ordered across offline/reconnect edge cases.
**Verified:** 2026-07-10T00:11:21Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening a conversation fetches a bounded newest-window (not full history) | VERIFIED | `core.ts:52,717-719` — `chatInitialWindowSize = 40`, keyset `.order(created_at DESC).order(id DESC).limit(41)`, `hasMoreOlder`/`oldestCursor` computed and returned on `ClientChatData`. Proven by `core.test.ts` (2 new cases, both pass: large conversation → 40-window + hasMoreOlder true; small conversation → hasMoreOlder false). |
| 2 | Older history loads via cursor-based (keyset) pagination — a "load earlier" affordance plus auto-load on scroll-up | VERIFIED | `actions.ts` exports `loadOlderMessagesAction` (composite `.or()` keyset filter, N+1 probe). `use-chat-messages.ts` exposes guarded, Promise-returning `loadOlderMessages`. `use-load-older-messages.ts` implements an `IntersectionObserver` sentinel (`rootMargin: "200px..."`) plus a "Load earlier messages" ghost button, both routed through the single `loadOlderAndPreserveScroll` callback. `chat-client.test.tsx` proves both trigger paths call the injected action and render results without duplicates. |
| 3 | Loading older messages preserves reading position — no scroll jump, no layout shift; newest-anchoring on send/receive unchanged | PARTIAL / STRUCTURAL | `use-load-older-messages.ts` captures `scrollHeight`/`scrollTop`, awaits the load, restores via `requestAnimationFrame` with no animated scroll; `.chat-log-viewport { overflow-anchor: none }` added to `globals.css`. `use-stick-to-bottom.ts` now keys new-message detection off the newest message's *identity* (not `messages.length`), proven inert-to-prepend by 3 new unit tests. The exact pixel-level restore across a real prepend cannot be asserted in jsdom — routed to human verification (item 1). |
| 4 | Realtime messages merge into the loaded list in place — never a full reload | VERIFIED | `use-chat-realtime.ts`'s messages channel still dispatches `mergeRemoteMessage` on every INSERT (unchanged); `grep -c "refreshConversation()" use-chat-realtime.ts` = 0 — the three full-refetch-on-reconnect call sites are gone, replaced by coalesced `handleReconnected`. |
| 5 | The merged list never shows duplicates across optimistic/realtime/paginated sources — deduped by id/clientRequestId | VERIFIED | `olderPageLoaded` reducer case loops the existing `mergeChatMessage` primitive (no second dedup path) — proven by fixtures `olderPageDuplicateReconciliation` and `gapBackfillOutOfOrder` (both replay green, exactly one copy per id). Store-level `applyOlderPage` dedup also proven in `chat-store.test.ts`. |
| 6 | History stays gap-free and correctly ordered across offline/reconnect; read-state stays consistent with pagination | PARTIAL / STRUCTURAL | `backfillMessagesAction` + `applyGapBackfill`'s `needsReset` → `loadNewestMessagesAction` → `hydrateWindow` reset path matches the plan's spec exactly (code read confirms). Per-channel reconnect coalescing (`seenFirstSubscribeRef`, `backfillInFlightRef`) matches spec. Read-state-outside-window fixtures (`deliveredMarkerOutsideWindow`, `readMarkerOutsideWindow`) pass. **Not exercised by any automated test**: the real reconnect sequence (SUBSCRIBED → re-SUBSCRIBED → coalesced backfill) and the `needsReset` reset-to-window branch — routed to human verification (items 3, 4, 5). |

**Score:** 4/6 truths fully automated-VERIFIED; 2/6 structurally verified with real-reconnect/scroll-pixel behavior requiring human confirmation (not implementation gaps — see Human Verification section).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/chat-state/types.ts` | 4 new events + `ChatPaginationState`/`ChatMessageCursor` | VERIFIED | All symbols present; `pagination: ChatPaginationState` on `ChatConversationState`. |
| `packages/core/src/chat-state/reducer.ts` | Cases for all 4 events, reusing `mergeChatMessage` | VERIFIED | `case "hydrateWindow"/"olderMessagesRequested"/"olderPageLoaded"/"olderPageLoadFailed"` all present; `olderPageLoaded` calls `mergeChatMessage`; `defaultPagination` on `getConversation`. |
| `packages/core/src/chat-state/selectors.ts` | Out-of-window marker handling | VERIFIED | `isAtOrAfterMessage` has a distinct `markerIndex === -1` branch, independent read/delivered evaluation. |
| `packages/core/src/chat-state/fixtures/chat-state-vectors.json` | 17 fixture cases | VERIFIED | `grep -c '"name"'` = 17; all replay green (`vitest run chat-state-fixtures` → 19/19 tests pass). |
| `apps/web/lib/services/supabase/core.ts` | Bounded keyset SSR window | VERIFIED | `chatInitialWindowSize`, `.limit(41)`, `.reverse()`, `hasMoreOlder`/`oldestCursor` computed and returned. |
| `apps/web/lib/services/supabase/types.ts` | `hasMoreOlder`/`oldestCursor` on `ClientChatData` | VERIFIED | Both optional fields present. |
| `apps/web/app/(authenticated)/chat/actions.ts` | 3 new exported actions, no chat-command write case | VERIFIED | `loadOlderMessagesAction`, `backfillMessagesAction`, `loadNewestMessagesAction` all exported; `chat-command/index.ts` untouched since the pre-phase checkpoint (`git diff 50ff7a40 -- supabase/functions/chat-command/` empty). |
| `apps/web/app/(authenticated)/chat/store/chat-store.ts` | Pagination dispatch wrappers | VERIFIED | `hydrateWindow`, `requestOlderMessages`, `applyOlderPage`, `markOlderPageFailed` all present (interface + impl). |
| `apps/web/app/(authenticated)/chat/store/chat-selectors.ts` | Pagination selectors | VERIFIED | `selectHasMoreOlderForConversation`, `selectIsLoadingOlderForConversation`, `selectOldestCursorForConversation` all present. |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` | `loadOlderMessages`/`applyGapBackfill`, `hydrateWindow`-based hydration | VERIFIED | All present; behavior matches plan spec exactly (code read). |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` | Coalesced per-channel reconnect + disconnected emission | VERIFIED (wiring) / UNTESTED (runtime) | `seenFirstSubscribeRef`, `backfillInFlightRef`, `handleReconnected` all present and match plan spec; `refreshConversation()` direct-call count is 0. Not exercised by a live-reconnect test — see human verification. |
| `apps/web/app/(authenticated)/chat/realtime.ts` | `onDisconnected` on CHANNEL_ERROR/TIMED_OUT/CLOSED | VERIFIED | Present, wired to the messages channel only (per plan). |
| `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts` | Sentinel + wrapped scroll-restore callback | VERIFIED | `IntersectionObserver`, single `loadOlderAndPreserveScroll`, `requestAnimationFrame` restore, no animated scroll. |
| `apps/web/app/(authenticated)/chat/hooks/use-stick-to-bottom.ts` | Identity-based new-message detection | VERIFIED | `previousCountRef` gone (count = 0), replaced by `previousLastIdRef`; 3 new unit tests all pass. |
| `apps/web/app/(authenticated)/chat/chat-client.tsx` | Sentinel/button/skeleton/offline UI wired | VERIFIED | All elements present (`sentinelRef`, "Load earlier messages" ghost button, skeleton rows, offline `Alert tone="notice"`, `Reconnecting…` pill); `variant="primary"` count is 0 (no new primary). |
| `apps/web/app/(authenticated)/channels/[id]/page.tsx` | Threads 3 new actions to `<ChatClient>` | VERIFIED | All 3 actions imported and passed as props. |
| `apps/web/app/globals.css` | skeleton-pulse + overflow-anchor utilities | VERIFIED | `@keyframes skeleton-pulse` (opacity-only), `@utility animate-skeleton-pulse`, `.chat-log-viewport { overflow-anchor: none }` all present. |
| `apps/web/tests/intersection-observer.ts` | Shared IO mock + trigger helper | VERIFIED | `IntersectionObserverMock`, `installIntersectionObserverMock`, `triggerIntersection` share one registry; used by `chat-client.test.tsx`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `reducer.ts` `olderPageLoaded` | `selectors.ts` `mergeChatMessage` | function call | WIRED | Confirmed by grep + fixture replay (`olderPageDuplicateReconciliation`). |
| `use-chat-messages.ts` `loadOlderMessages` | `actions.ts` `loadOlderMessagesAction` (Plan 02) | injected prop, dispatched as `applyOlderPage` | WIRED | Confirmed by code read + `chat-client.test.tsx` sentinel/button tests calling the injected action and rendering results. |
| `use-chat-realtime.ts` `handleReconnected` | `use-chat-messages.ts` `applyGapBackfill` | `applyGapBackfill ?? refreshConversation` | WIRED (structural) | Confirmed by code read; not exercised by a live-reconnect test (human verification item 3). |
| `chat-client.tsx` sentinel + button | `use-load-older-messages.ts` `loadOlderAndPreserveScroll` | shared callback, not raw `loadOlderMessages` | WIRED | Confirmed by code read and by the "drives the same wrapped scroll-preserving callback from the button as the sentinel" test passing. |
| `channels/[id]/page.tsx` | `chat-client.tsx` (3 new actions) | prop threading | WIRED | Confirmed: `grep -c` for all 3 action names on the route file returns non-zero for each; `pnpm build` succeeds against the real prop types. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `chat-client.tsx` skeleton/sentinel/button | `hasMoreOlder`, `isLoadingOlder` (from `useChatMessages`) | `selectHasMoreOlderForConversation`/`selectIsLoadingOlderForConversation` reading real store `pagination` state, itself hydrated from the real bounded SSR query (`ClientChatData.hasMoreOlder`) | Yes | FLOWING |
| `chat-client.tsx` offline banner / reconnect pill | `realtimeStatus` (from `selectRealtimeStatusForConversation`) | Real store value set by `use-chat-realtime.ts`'s `setRealtimeStatus` calls, which are wired to real Supabase channel subscribe callbacks (`onDisconnected`/`onReconnected`) | Yes, but the store-to-UI leg is proven; the real-channel-to-store leg (CHANNEL_ERROR → `setRealtimeStatus("disconnected")`) is unexercised by a test that drives the mocked channel through that transition | Partial — see human verification item 5 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Bounded SSR window returns exactly 40 + hasMoreOlder | `vitest run lib/services/supabase/core.test.ts` | 2/2 new cases pass (part of 31/31 in the file) | PASS |
| Keyset older page + backfill + reset actions | `vitest run "app/(authenticated)/chat/actions.test.ts"` | 31/31 pass (file total) | PASS |
| Pagination reducer/selector fixture replay | `vitest run chat-state-fixtures` | 19/19 pass | PASS |
| Store pagination dispatch/selectors/dedup/retry | `vitest run "app/(authenticated)/chat/store/chat-store.test.ts"` | pass (part of 52/52 combined run) | PASS |
| Stick-to-bottom prepend-inert fix | `vitest run "app/(authenticated)/chat/hooks/use-stick-to-bottom.test.ts"` | 3/3 pass | PASS |
| Sentinel/button/skeleton/offline UI | `vitest run "app/(authenticated)/chat/chat-client.test.tsx"` | pass (52 combined with store+stick-to-bottom run above) | PASS |
| Full workspace suite | `pnpm --filter @fish/web exec vitest run` | 446/446 pass | PASS |
| Typecheck | `pnpm typecheck` | 0 errors (3 packages) | PASS |
| Lint | `pnpm lint` | 0 errors | PASS |
| Production build | `pnpm build` | Compiled + typechecked + all 18 routes generated | PASS |
| Debt-marker scan (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) on all 17 phase-modified files | grep | 0 matches | PASS |
| `chat-command` Edge Function untouched (API boundary held) | `git diff 50ff7a40 -- supabase/functions/chat-command/` | empty | PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files exist in this repository and neither PLAN nor SUMMARY documents reference a probe script for this phase. This phase's verification convention is unit/fixture tests + build gates (per CLAUDE.md/AGENTS.md and CONTEXT.md's explicit "no Claude Preview MCP" instruction), which was followed above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| CLOAD-01 | 10-02 | Opening the chat renders newest messages from a bounded window — minimal time-to-first-message | SATISFIED | `core.ts` keyset window (40+1), `core.test.ts` proves bound + hasMoreOlder. |
| CLOAD-02 | 10-03 | New incoming messages merge in place via realtime — never a full reload | SATISFIED | `mergeRemoteMessage` dispatch unchanged; `refreshConversation()` full-refetch-on-reconnect calls removed (count 0). |
| CLOAD-03 | 10-01, 10-02, 10-03, 10-04 | Older history loads via cursor-based (keyset) pagination — "load earlier" + infinite scroll | SATISFIED | `loadOlderMessagesAction` (keyset `.or()` filter), sentinel + button both wired to one scroll-preserving callback, all unit/integration tested. |
| CLOAD-04 | 10-04 | Loading older messages preserves reading position — no scroll jump/layout shift; newest-anchoring unchanged | SATISFIED (structural) + NEEDS HUMAN (perceptual/pixel) | Manual scrollHeight-diff restore + `overflow-anchor:none` + stick-to-bottom identity fix all code-verified and unit-tested where jsdom permits; exact pixel restore across a real prepend needs a human pass (Plan 04's own designated human-check). |
| CLOAD-05 | 10-01, 10-03 | Merged list never shows duplicates across optimistic/realtime/paginated sources — deduped by id/clientRequestId | SATISFIED | `mergeChatMessage` reused everywhere (no second dedup path); fixtures + store test prove it. |
| CLOAD-06 | 10-01, 10-02, 10-03 | History stays gap-free/ordered across offline/reconnect; read-state stays consistent with pagination | SATISFIED (structural) + NEEDS HUMAN (live reconnect) | Backfill/reset/coalescing code matches spec exactly and fixtures cover ordering/dedup/out-of-window markers; the live Supabase-Realtime reconnect sequence itself is not exercised by any test. |

No orphaned requirements — all 6 CLOAD-01..06 IDs appear in at least one plan's `requirements:` frontmatter and are traced above.

### Anti-Patterns Found

None. Scanned all 17 files modified across the phase's 4 plans (chat-state core, service/action layer, store/hooks, realtime, UI component, route, CSS) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` — zero matches. No empty-return stubs, no hardcoded-empty props flowing to render, no console.log-only implementations found in the modified surface.

### Human Verification Required

See YAML frontmatter `human_verification` for the full structured list (5 items). Summary:

1. **Reading-position preservation** (pixel-level, real scroll through ≥3 older pages) — jsdom cannot assert this; Plan 04's own designated human-check.
2. **Perceptual calm of loading/offline/reconnect states** — visual/design judgment, not a structural property.
3. **Real reconnect coalescing** (one bounded backfill, not three; per-channel first-subscribe skip) — no test drives the mocked Supabase channel's subscribe callback through a reconnect sequence.
4. **Gap-exceeds-bound reset path** (`needsReset` → `loadNewestMessagesAction` → `hydrateWindow`) — not exercised by any automated test.
5. **CHANNEL_ERROR/TIMED_OUT/CLOSED → "disconnected" emission from a real channel** — the UI's response to a manually-set store status is tested; the real channel-to-store wiring is not.

Items 3–5 are technically automatable in vitest without a browser (e.g., a `renderHook` harness for `useChatRealtime`/`useChatMessages` driving a richer channel mock) — they are not intrinsically "browser-only" behaviors the way items 1–2 are. They are listed as human-verification here (rather than as blocking gaps) because: (a) the underlying code was read in full and matches the plan's specified behavior exactly, symbol-for-symbol; (b) the phase's four SUMMARYs already flagged these exact truths as `human_judgment: true` with the same rationale; (c) the orchestrator's explicit brief for this verification pass directed treating these as human-verification items rather than failures when the code structure checks out, which it does. A future hardening pass could close items 3–5 with dedicated reconnect-simulation tests without needing a browser.

### Gaps Summary

No blocking gaps. All 4 plans' declared artifacts, key links, and requirements exist, are substantive (not stubs), and are wired correctly per direct code inspection — cross-checked against 446/446 passing tests, clean `pnpm typecheck`/`pnpm lint`/`pnpm build`, and a zero-hit debt-marker scan across every file the phase touched. The five items above are the phase's own honestly-disclosed edges (perceptual calm/pixel-scroll behavior, and reconnect/backfill sequences that are hard to drive through the current test mocks) — they represent real, structurally-correct implementation whose final proof needs either a human pass or a follow-up test-infrastructure investment, not missing work.

---

*Verified: 2026-07-10T00:11:21Z*
*Verifier: Claude (gsd-verifier)*
