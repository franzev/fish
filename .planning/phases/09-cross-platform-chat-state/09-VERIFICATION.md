---
phase: 09-cross-platform-chat-state
verified: 2026-07-10T10:20:39Z
status: human_needed
score: "6/6 requirements verified at source/test level; 0 partial; 0 failed"
re_verification: true
head_verified: 7988a12fd3ee094e07c468622da0cd30afa40394
overrides_applied: 0
requirements_verified:
  - CSTATE-01
  - CSTATE-02
  - CSTATE-03
  - CSTATE-04
  - CSTATE-05
  - CSTATE-06
requirements_partial: []
requirements_failed: []
security_enforcement: enabled
security_block_on: high
security_audit: absent_no_09_SECURITY_md
schema_drift: false
codebase_drift: non_blocking_warning
re_verification_meta:
  previous_status: gaps_found
  previous_score: "2/6 requirements fully verified; 3 partial; 1 failed"
  previous_head: e74c5980c49a244f4c6ed8e6885131f8ceefe951
  gaps_closed:
    - "WR-02: hydrateConversation/hydrateWindow deleted unresolved local sends (closed by 09-13)"
    - "WR-03: a late transport failure could downgrade an already-sent message (closed by 09-13)"
    - "WR-10: getMessageSnippet could exceed 96 units and emit a lone surrogate (closed by 09-13)"
    - "CR-01: module-singleton chat cache was not bound to verified auth identity; failed signOut treated as success (closed by 09-14)"
    - "WR-01: an in-flight older-load in conversation A could gate/error/scroll-corrupt conversation B after a switch (closed by 09-15)"
    - "WR-06: participant typing/recording/hasConnected bled across a live conversation switch (closed by 09-16)"
    - "WR-07: pagination loading/failure states swapped in differently-sized regions, shifting the transcript (closed by 09-16)"
    - "WR-08: the community send E2E asserted an incompatible status image and used .last(), which could hide a duplicate (closed by 09-17)"
    - "WR-09: the app-shell logo tap target was 32/40px, below the 56px floor; a stale /chat comment remained (closed by 09-18)"
  gaps_remaining: []
  regressions_found: []
human_verification:
  - id: HV-01
    status: recommended_before_release
    test: "Force an older-page failure in /channels/general (throttle/disable network), confirm the calm notice-tone retry region appears with no transcript jump, then retry successfully."
    expected: "One automatic attempt only, a stable-height retry region (no layout shift), and successful manual recovery. Now backed by chat-client.test.tsx's WR-07 same-DOM-node geometry test and the pre-existing 09-12 retry-storm tests; jsdom cannot measure real pixel height."
  - id: HV-02
    status: recommended_before_release
    test: "Start an older-page load in conversation A, switch to conversation B before A settles, then let A settle as both a failure and a success."
    expected: "A cannot gate B, write B's error state, suppress B's first sentinel load, or inject A's page into B. Now backed by two dedicated deferred-switch regression tests in chat-client.test.tsx (09-15); only the literal scrollTop write into the live viewport is unautomatable in jsdom (the write is gated by the same generation-token check proven by the automated tests)."
  - id: HV-03
    status: recommended_before_release
    test: "Sign in as account A in one tab, then (without using the Log out button) sign in as account B in a second tab / same tab after expiry. Separately, force signOut() to fail (e.g. offline) and confirm the account is not signed out."
    expected: "B never sees A's draft/pending/failed rows; a failed sign-out preserves A's state and shows calm retry guidance instead of navigating. Now backed by chat-store.test.ts's ownership block, chat-identity-guard.test.tsx (prop-change, SIGNED_OUT, cross-identity vs. same-user TOKEN_REFRESHED, unmount-unsubscribe), and logout-button.test.tsx's failure-path test — all exercising the real store/guard/hook, only the genuine two-tab browser session is unautomatable here."
  - id: HV-04
    status: required_before_release
    test: "Run `apps/web/e2e/chat-send.spec.ts` against a live dev server with seeded Supabase (`npx playwright test e2e/chat-send.spec.ts`)."
    expected: "The rewritten spec (reload-persistence + exact-count, no .last(), no incompatible status-image assertion) passes end to end. `playwright test --list` confirms the spec is discoverable and structurally valid (verified in this pass), but it has not been executed against a live server/database since being rewritten in 09-17 — this remains the one genuinely unverified round-4 claim."
  - id: HV-05
    status: optional_low_risk
    test: "Visually confirm the app-shell logo link is a comfortably large, centered 56px tap target on the rendered community shell."
    expected: "The logo sits in a 56px x 56px centered box. Low risk: app-shell.test.tsx asserts the exact `min-h-control`/`min-w-control`/`items-center`/`justify-center` classes, which reuse the same `--size-control` token already shipped and visually confirmed for message actions (Plan 09-11)."
---

# Phase 9: Cross-platform Chat State Verification (Re-verification, round 4)

**Phase Goal:** Extract chat state into a portable, test-vector-backed state machine and refactor the web chat route so Zustand coordinates shared web surfaces without becoming the source of truth; Android and iOS receive the same event/result contract for native ViewModel/observable implementations later.
**Canonical surface (superseded 2026-07-10):** the community room at `/channels/general` (implemented by `/channels/[id]`) — the `/chat` route is removed. This verification targets `/channels/:id` throughout, per the dated supersede notes in ROADMAP.md, REQUIREMENTS.md, and 09-CONTEXT.md.
**Verified:** 2026-07-10T10:20:39Z, against HEAD `7988a12f`
**Status:** `human_needed`
**Re-verification:** Yes — round 4 (plans 09-13..09-18) closed all 8 blocking gaps + WR-10 from the prior `gaps_found` report (HEAD `e74c5980`, score 2/6).

## Goal Verdict

**Source-provable defects: all closed.** Every blocking gap identified by the prior verification (CR-01, WR-01, WR-02, WR-03, WR-06, WR-07, WR-08, WR-09, WR-10) was independently re-verified in this pass by reading the actual current source (not the SUMMARYs' prose) and by re-running the automated gates myself rather than trusting the reported numbers:

- Full web suite: **493/493 passing, 61 files** (`pnpm --filter @fish/web test`, run directly in this verification).
- Targeted round-4 files: **119/119 passing, 7 files** (`chat-state-boundary`, `chat-store`, `chat-identity-guard`, `logout-button`, `app-shell`, `chat-client`, `chat-state-fixtures`).
- `pnpm typecheck`: clean across `packages/core`, `packages/supabase`, `apps/web`.
- `pnpm build`: clean; route table confirms `/channels/[id]` present, no `/chat` route.
- `pnpm lint`: clean, 0 errors/warnings.
- `playwright test --list e2e/chat-send.spec.ts`: 1 test discovered, structurally valid.
- The five-code-point-snippet fixtures (`snippetLongAscii`, `snippetEmojiBoundary`) were independently re-derived in Python outside the test framework and match the shipped `getMessageSnippet` rule exactly (97-code-point ASCII body -> 96-code-point result; a 100-code-point body with an emoji straddling the old UTF-16 cut point at index 94 truncates to a whole emoji + single-character ellipsis, no lone surrogate).

**Why this is `human_needed`, not `passed`:** all six CSTATE requirements now hold at the source/test level, but five checks remain that this sandbox cannot perform (no dev server, no live browser, no seeded Supabase, per this verification's own constraints) — most importantly, `chat-send.spec.ts` (HV-04) has never actually been executed end-to-end since its WR-08 rewrite; only static/list-mode validity was confirmed. Per the verification decision tree, any phase with outstanding human-verification items is `human_needed` even when every automated truth passes.

**Why this is not `gaps_found`:** no must-have resolves to FAILED. Every previously-FAILED or PARTIAL truth from the prior verification now has direct, current-source and passing-test evidence, detailed below.

## Requirement Traceability

| Requirement | Owning plans | Result | Current-source evidence |
|---|---|---|---|
| CSTATE-01 | 09-01, 09-13 | **VERIFIED** | `packages/core/src/chat-state/{types,reducer,selectors,index}.ts` remains the portable implementation; `apps/web/tests/chat-state-boundary.test.ts` (re-run, passing) rejects React/Next/Zustand/Supabase/browser-global/web-alias/Swift/Kotlin tokens across every file in the directory, including the 09-13 reducer/selector edits. |
| CSTATE-02 | 09-02, 09-08, 09-12, 09-15, 09-16 | **VERIFIED** | Five focused hooks still back `ChatClient`; `/chat` route absent (`ls apps/web/app/(authenticated)/chat/` has no `page.tsx`), canonical route is `/channels/[id]` (confirmed in the `pnpm build` route table). Preservation now holds under an in-flight A-to-B older-load switch (`use-chat-messages.ts:119-284`, `use-load-older-messages.ts:37-92`, two new regression tests) and unresolved-send hydration (`reducer.ts:237-251`, two new fixture vectors). |
| CSTATE-03 | 09-03, 09-07, 09-10, 09-14, 09-15 | **VERIFIED** | Zustand remains web-only, reducer-backed, conversation-keyed, authority-boundary clean (`chat-store.ts` "chat store authority boundary" test re-run, passing). The module singleton is now bound to verified auth identity via `ensureChatStoreOwner`/`cacheOwnerUserId` (`chat-store.ts:263-293`) and `ChatIdentityGuard` (`chat-identity-guard.tsx`), and `useLogout` branches on `signOut().ok` (`use-logout.ts:26-38`). |
| CSTATE-04 | 09-01, 09-04, 09-06, 09-09, 09-13 | **VERIFIED** | 23 JSON vectors (up from 18) replay; the canonical protocol document (`packages/core/docs/chat-state-protocol.md`) now states the exact 96-Unicode-code-point rule, the surrogate-safety guarantee, and the monotonic/hydrate-preserve clauses (`:63,74,105-110,152-156`) — independently re-derived and confirmed correct in this verification, not merely grep-matched. |
| CSTATE-05 | 09-04, 09-06, 09-09, 09-13 | **VERIFIED** | `09-NATIVE-CHAT-STATE-NOTES.md` maps all 15 events and all 23 fixtures (up from 18) to Android `ViewModel`/`StateFlow` and iOS observable state, mirrors the three hardened contract clauses (`:76-90`), and continues to exclude web libraries and production native implementation (`:23-41`). |
| CSTATE-06 | 09-01..03, 09-05, 09-07..18 | **VERIFIED** (source/test level) | No-lost-draft (WR-02), monotonic send status (WR-03), account isolation (CR-01), pagination-race isolation (WR-01), conversation-scoped transient reset (WR-06), invariant pagination geometry (WR-07), and `pnpm build`/`lint`/`typecheck`/focused-tests all hold, independently re-run in this pass. The one CSTATE-06 sub-clause not fully closed is the community send E2E's live execution (HV-04) — the spec is now logically correct and discoverable but has not been run against a live server. |

No CSTATE requirement is orphaned; all six IDs occur in plan frontmatter (18/18 plans, cross-referenced against REQUIREMENTS.md) and are accounted for above. REQUIREMENTS.md's CSTATE-01..06 checkboxes and the supersede note (community room, `/channels/general`) match the implementation.

## Round-4 Gap Closure Verification

Each of the 8 blocking gaps (+ WR-10) from the prior `gaps_found` report, re-verified against current source and passing tests — not against the SUMMARY narratives.

| Finding | Plan | Disposition | Current-source evidence |
|---|---|---|---|
| CR-01 account-transition cache isolation | 09-14 | **CLOSED** | `chat-store.ts:263-293` adds module-level `cacheOwnerUserId` + `ensureChatStoreOwner(userId)`, purging on any identity change, reset by `clearChatStore()`. `chat-identity-guard.tsx` mounts in `layout.tsx:32` with `profile.userId`, purges on `SIGNED_OUT` and cross-identity auth events, preserves same-user `TOKEN_REFRESHED`. `use-logout.ts:26-38` branches on `signOut().ok`, preserving state and showing `"We couldn't sign you out just now..."` (Alert `tone="notice"` in `logout-button.tsx`, `text-notice` row in `user-menu.tsx`) on failure — never clears/navigates on failure. 10 tests across `chat-store.test.ts` (ownership block), `chat-identity-guard.test.tsx` (4 tests), `logout-button.test.tsx` (failure path), all passing. |
| WR-01 older-load conversation race | 09-15 | **CLOSED** | `use-chat-messages.ts:123` replaces the hook-wide boolean with `loadingOlderConversationsRef: Set<ChatConversationId>`; `loadOlderMessages` captures `requestConversationId` once (`:237`) and locks/dispatches only that id. `use-load-older-messages.ts:44,70,83` adds `latestOnLoadOlderRef` generation-token guard, checked both after the await and inside the rescheduled `requestAnimationFrame`, with `cancelAnimationFrame` on switch/unmount (`:47-56`). Two new deferred A-to-B tests (`chat-client.test.tsx:1522,1607`) prove B's first load is not suppressed and A's late failure/success cannot corrupt B. |
| WR-02 hydration deletes unresolved sends | 09-13, 09-16 | **CLOSED** | `reducer.ts:237-251` (`mergeHydratedMessages`) preserves any `pending`/`sending`/`failed` row not reconciled by the incoming snapshot, folding it through `mergeChatMessage`, used by both `hydrateConversation` (`:53`) and `hydrateWindow` (`:149`). Two new fixture vectors (`hydratePreservesUnresolvedSend`, `hydrateWindowPreservesUnresolvedSend`) plus a web-layer regression (`chat-client.test.tsx:2056`, reconnect-reset `hydrateWindow` that omits the pending row) all pass. |
| WR-03 late failure downgrades sent | 09-13, 09-16 | **CLOSED** | `reducer.ts:264-272`: `markMessageFailed` early-returns the conversation unchanged when the matched row's `localStatus === "sent"`. Fixture `monotonicSentIgnoresLateFailure` and web regression `chat-client.test.tsx:2142` (realtime-confirms sent, then the original send action settles as a failure) both pass, leaving the row `"sent"` with no `"Not sent yet"`. |
| WR-04 bare update erases reactions | — | **Unchanged — confirmed still non-blocking phase debt** | `selectors.ts` `mergeChatMessage`/`areReactionsEqual` untouched by round 4. Carried forward from the prior verification's disposition (pre-dates the extraction, outside the formal CSTATE fixture minimum); not assigned to any round-4 plan, not required by any CSTATE-01..06 wording. |
| WR-05 hidden message marked read | — | **Unchanged — confirmed still non-blocking phase debt** | Same disposition as WR-04: a pre-existing read-receipt policy issue, preserved (not introduced) by Phase 9, outside round-4 scope. |
| WR-06 stale conversation transients | 09-16 | **CLOSED** | `use-chat-realtime.ts:78-115`: `previousConversationId` render-time reset of `participantTyping`/`participantRecording`/`localRecording`, plus an effect keyed on `chat.conversationId` clearing `localTypingRef` and the three pending timeout refs. `chat-client.tsx:171-192` adds the matching `hasConnected`/`previousRealtimeStatus` per-conversation reset. Two new tests (`chat-client.test.tsx:1925,1963`) prove A's typing indicator and A's `hasConnected` do not bleed into B. |
| WR-07 pagination feedback layout shift | 09-16 | **CLOSED (structurally; pixel-level confirmation is HV-01)** | `chat-client.tsx:305-331` consolidates loading/error/idle states into one `data-testid="load-older-slot"` wrapper with class `min-h-pagination-slot`, backed by new tokens `--size-pagination-slot`/`--spacing-pagination-slot` (104px, `globals.css:106,124`) — token-based, no raw numeric utility. Test at `chat-client.test.tsx:2001` proves the SAME DOM node persists (`loadingSlot === idleSlot === errorSlot`) across idle/loading/error, carrying the invariant class throughout. jsdom cannot measure real pixel height (see HV-01). |
| WR-08 lifecycle contract/E2E contradiction | 09-17 | **CLOSED (structurally; live execution is HV-04)** | `e2e/chat-send.spec.ts:23,36` asserts `toHaveCount(1)` before AND after `page.reload()` (line 32); the incompatible `Sent\|Delivered\|Read` status-image assertion and every `.last(` usage are gone (grep-confirmed, 0 matches). `playwright test --list` discovers exactly 1 test. Not yet run against a live server/seeded Supabase since the rewrite (HV-04). |
| WR-09 shell logo below 56px | 09-18 | **CLOSED** | `app-shell.tsx:132-153`: logo `Link` className now includes `min-h-control min-w-control` + `items-center justify-center` (reusing the `--size-control` 56px token already used for message actions) and `aria-label="FISH home"`. `grep -c "/chat" app-shell.tsx` returns 0. Two tests (`app-shell.test.tsx`) assert the exact classes and the no-`/chat` source invariant; both pass. |
| WR-10 malformed/overlong snippet | 09-13 | **CLOSED** | `selectors.ts:191-213`: `getMessageSnippet` now measures via `Array.from(body)` (Unicode code points), truncates to 95 code points + one `"…"` (U+2026), max 96 code points total, never splitting a surrogate pair. Independently re-derived in Python in this verification (see Goal Verdict) and confirmed exactly correct for both a 97-code-point ASCII body and a 100-code-point body with an emoji straddling the old cut point. Two new fixtures (`snippetLongAscii`, `snippetEmojiBoundary`) pass. |
| IN-01 stale read state moves markers backward | — | **Unchanged — confirmed still deferred, non-blocking** | `selectors.ts:50-66` `mergeReadState` still wholesale-replaces by user id (no monotonic ordering). Untouched by round 4; carried forward from the prior verification as explicitly deferred product debt, not a CSTATE-01..06 must-have. |

**No regressions found.** All fixtures present before round 4 (18 of the current 23 vectors, including `markMessageFailedPreservesNewerDraft` and `olderPageLifecycle`) are unchanged and still pass. All 17 previously-passing task commits from rounds 1-3 remain intact; all 17 round-4 task commits (`edbbbe87` through `c306c50d`) were independently confirmed present in `git log` in this pass.

## Observable Truths (goal-backward, CSTATE-01..06)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Chat state merge/status/read/snippet logic is portable (no React/Next/Zustand/Supabase/browser/Swift/Kotlin deps) | VERIFIED | `chat-state-boundary.test.ts` passing; `packages/core/src/chat-state/*` read directly. |
| 2 | The web chat route is split into focused hooks and preserves the community-room experience across conversation-mount changes | VERIFIED | `use-chat-messages.ts`, `use-load-older-messages.ts`, `use-chat-realtime.ts` read directly; WR-01/WR-06 regression tests passing. |
| 3 | Zustand is a thin, auth-free, identity-bound web cache/coordination layer | VERIFIED | `chat-store.ts` authority-boundary test + ownership block passing; `ensureChatStoreOwner`/`ChatIdentityGuard` read directly. |
| 4 | Cross-platform JSON fixtures + protocol doc define hydrate/send/confirm/fail/merge/read-state events with expected results | VERIFIED | 23/23 fixtures replay and pass; protocol doc content independently re-derived and confirmed correct. |
| 5 | Android/iOS architecture notes map the shared contract without native production implementation | VERIFIED | `09-NATIVE-CHAT-STATE-NOTES.md` read directly; scope-boundary section confirms no native chat screens touched. |
| 6 | Existing chat behavior is unchanged: no lost drafts, no duplicate optimistic messages, no layout shift, gates pass | VERIFIED (source/test) | WR-02/WR-03/WR-07 closures + `pnpm build`/`lint`/`typecheck`/tests all independently re-run passing in this verification. |

**Score:** 6/6 truths verified at the source/test level. See Human Verification for the live-environment items still outstanding.

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/core/src/chat-state/reducer.ts` | Hydrate-preserve + monotonic status guard | VERIFIED | Read directly; `mergeHydratedMessages` (237-251), monotonic guard (264-272). |
| `packages/core/src/chat-state/selectors.ts` | Code-point-safe `getMessageSnippet` | VERIFIED | Read directly; `MAX_SNIPPET_CODE_POINTS=96` (198), `Array.from` truncation (206-212). Math independently re-derived. |
| `packages/core/src/chat-state/fixtures/chat-state-vectors.json` | 23 vectors incl. 5 new WR-02/03/10 vectors | VERIFIED | Counted via `python3 -c "json.load(...)"`: 23 entries, names match plan spec exactly. |
| `packages/core/docs/chat-state-protocol.md` | Updated hydrate/markMessageFailed/snippet contract | VERIFIED | grep + full-context read confirms code-point/monotonic/hydrate-preserve wording; 5 new fixture names listed. |
| `.../09-NATIVE-CHAT-STATE-NOTES.md` | Native parity notes mirroring 3 hardened clauses | VERIFIED | Read directly; 15 events, 23 fixtures, 3 clauses all present. |
| `apps/web/app/(authenticated)/chat/store/chat-store.ts` | `ensureChatStoreOwner` cache-partition fingerprint | VERIFIED | Read directly (263-293); module-level, not in `ChatStoreState`. |
| `apps/web/components/auth/chat-identity-guard.tsx` | Purge-on-identity-change client guard | VERIFIED | Read directly (55 lines); mounted in `layout.tsx:32`. |
| `apps/web/lib/auth/use-logout.ts` | `signOut().ok` branch, calm notice on failure | VERIFIED | Read directly (18-41); notice rendered in both consumers. |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` | Per-conversation older-load lock | VERIFIED | Read directly; `loadingOlderConversationsRef: Set` (123), captured `requestConversationId` (237). |
| `apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts` | Generation-token stale-completion guard + rAF cancel | VERIFIED | Read directly (37-92); `latestOnLoadOlderRef`, `pendingRafRef` with `cancelAnimationFrame`. |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` | Conversation-scoped transient reset | VERIFIED | Read directly (71-115); render-time state reset + effect-based ref/timer reset. |
| `apps/web/app/(authenticated)/chat/chat-client.tsx` | `hasConnected` reset + invariant pagination slot | VERIFIED | Read directly (171-192, 305-331); `data-testid="load-older-slot"`, `min-h-pagination-slot`. |
| `apps/web/app/globals.css` | `--size-pagination-slot`/`--spacing-pagination-slot` tokens | VERIFIED | grep confirms lines 106, 124; no raw numeric utility used. |
| `apps/web/e2e/chat-send.spec.ts` | Reload-persistence + exact-count community send smoke | VERIFIED (structurally) | Read directly; `toHaveCount(1)` x2, `page.reload()`, no `.last(`, no status-image assertion. `playwright --list` confirms 1 discoverable test. Live-run pending (HV-04). |
| `apps/web/components/shell/app-shell.tsx` | 56px logo target, no stale `/chat` text | VERIFIED | Read directly (132-153); `grep -c "/chat"` = 0. |
| `apps/web/app/(authenticated)/chat/page.tsx` | Intentionally absent (route removed) | VERIFIED (absence) | `ls` confirms no `page.tsx` in `chat/`; `/channels/[id]` is the build's route. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `reducer.ts` hydrateConversation/hydrateWindow | `mergeChatMessage` (selectors.ts) | `mergeHydratedMessages` preserve-then-merge | WIRED | Read directly; both cases call the shared helper (53, 149). |
| `layout.tsx` | `ChatIdentityGuard` | server-verified `profile.userId` prop | WIRED | `layout.tsx:32`, confirmed by direct read; `chat-identity-guard.test.tsx` exercises the real component. |
| `ChatIdentityGuard` | `ensureChatStoreOwner` / `clearChatStore` | prop-change effect + `onAuthStateChange` listener | WIRED | `chat-identity-guard.tsx:29-51`, both effects confirmed present and tested. |
| `useLogout` | `clearChatStore` + `router.push` | only on `signOut().ok === true` | WIRED | `use-logout.ts:26-38`; failure path takes neither action (tested). |
| `use-load-older-messages` `loadOlderAndPreserveScroll` | `onLoadOlder` identity | `latestOnLoadOlderRef` generation-token comparison | WIRED | `use-load-older-messages.ts:59,70,83`; guard present at both the post-await check and inside the rAF callback. |
| `use-chat-messages` `loadOlderMessages` | per-conversation in-flight `Set` | `chat.conversationId` capture | WIRED | `use-chat-messages.ts:237-247`; keyed guard/add/delete confirmed. |
| `use-chat-realtime` render-time derivation | `participantTyping`/`participantRecording`/`localRecording`/`localTypingRef` | `previousConversationId` comparison | WIRED | `use-chat-realtime.ts:78-115`; state reset in render body, ref/timer reset in effect (react-hooks/refs compliant). |
| `chat-client.tsx` pagination feedback | reserved-height slot | single `data-testid="load-older-slot"` wrapper | WIRED | `chat-client.tsx:305-331`; same-DOM-node test passing. |
| `channels/[id]/page.tsx` | `ChatClient` | real send/read/refresh/pagination server actions | WIRED | `page.tsx` imports 10 actions from `../../chat/actions`; `actions.ts` issues real `supabase.from("messages").select(...)` queries (not static/hollow). |
| `app-shell.tsx` logo `Link` | `--size-control` (56px) token | `min-h-control`/`min-w-control` utilities | WIRED | `app-shell.tsx:135`; token reused from Plan 09-11's message-action pattern. |
| `e2e/chat-send.spec.ts` send | reload persistence assertion | `page.reload()` then exact-count | WIRED (structurally) | Read directly; not yet executed live (HV-04). |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `ChatClient` message log | `messages` (from `useChatMessages`) | `chatStore` populated by `hydrateWindow(chat.conversationId, initialMessages, ...)`, where `chat` is server-loaded via `getChatPageData()` → real `supabase.from("messages").select("*")` queries in `actions.ts` | Yes | FLOWING |
| `ChatIdentityGuard` purge trigger | `session.user.id` | Real `createBrowserSupabaseClient().auth.onAuthStateChange` subscription (mocked only at the Supabase-client boundary in tests, not the guard logic) | Yes | FLOWING |
| `chat-store.ts` `cacheOwnerUserId` | verified `userId` | Passed from `layout.tsx`'s server-verified `getAuthenticatedShellProfile()`, not client-supplied | Yes | FLOWING (server-authoritative input) |

No hollow props or hardcoded-empty data paths found in the round-4-touched artifacts.

## Behavioral Spot-Checks (independently re-run in this verification)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full web suite passes | `pnpm --filter @fish/web test` | 493/493 passing, 61 files | PASS |
| Round-4-touched files pass in isolation | `pnpm --filter @fish/web test chat-state-boundary chat-store chat-identity-guard logout-button app-shell chat-client chat-state-fixtures` | 119/119 passing, 7 files | PASS |
| Workspace typecheck | `pnpm typecheck` | Clean (core, supabase, web) | PASS |
| Production build | `pnpm build` | Clean; `/channels/[id]` present, `/chat` absent, 17 routes | PASS |
| Lint | `pnpm lint` | Clean, 0 errors/warnings | PASS |
| E2E spec discovery | `npx playwright test --list e2e/chat-send.spec.ts` | 1 test discovered: "client sends a message and it persists as exactly one row after reload" | PASS (discovery only — not executed) |
| Snippet truncation math (independent re-derivation) | `python3` code-point recomputation of `snippetLongAscii`/`snippetEmojiBoundary` | 97-cp body → 96-cp result; 100-cp body with emoji at code-point index 94 → whole emoji preserved, no lone surrogate | PASS |
| Task commit provenance | `git log -1 <hash>` for all 17 round-4 commits | All 17 found | PASS |

## Probe Execution

SKIPPED (no runnable entry points) — no `scripts/*/tests/probe-*.sh` convention or phase-declared probes exist in this repository; confirmed via `find` and a grep of round-4 PLAN/SUMMARY files.

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| CSTATE-01 | 09-01, 09-13 | Portable core module, zero platform deps | SATISFIED | Boundary test passing; source read directly. |
| CSTATE-02 | 09-02, 09-08, 09-12, 09-15, 09-16 | Focused hooks, community-room behavior preserved | SATISFIED | WR-01/WR-06 closures verified; `/chat` route confirmed absent. |
| CSTATE-03 | 09-03, 09-07, 09-10, 09-14, 09-15 | Web-only, auth-free, identity-bound Zustand adapter | SATISFIED | CR-01 closure verified; authority-boundary test passing. |
| CSTATE-04 | 09-01, 09-04, 09-06, 09-09, 09-13 | JSON fixtures + protocol doc | SATISFIED | 23/23 fixtures pass; protocol doc content independently confirmed correct. |
| CSTATE-05 | 09-04, 09-06, 09-09, 09-13 | Android/iOS architecture notes | SATISFIED | Native notes read directly; scope boundary intact. |
| CSTATE-06 | 09-01..03, 09-05, 09-07..18 | Unchanged behavior + all gates pass | SATISFIED (source/test); live E2E run (HV-04) outstanding | Gates independently re-run and passing; E2E spec structurally correct but unexecuted live. |

No orphaned requirements: all 6 CSTATE IDs are declared across the 18 phase-09 plans (cross-checked against REQUIREMENTS.md's "Cross-platform Chat State (CSTATE)" section, including its 2026-07-10 supersede note).

## Anti-Patterns Found

None in the round-4-touched files. Explicitly scanned for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" across all 11 round-4 source files (`reducer.ts`, `selectors.ts`, `chat-store.ts`, `chat-identity-guard.tsx`, `use-logout.ts`, `use-chat-messages.ts`, `use-load-older-messages.ts`, `use-chat-realtime.ts`, `chat-client.tsx`, `app-shell.tsx`, `e2e/chat-send.spec.ts`) — zero matches. No `.skip(`/`.todo(`/`xit(`/`xdescribe(` in any phase-09 test file.

**Informational (non-blocking):**
- No `.planning/phases/09-cross-platform-chat-state/09-SECURITY.md` exists, unlike Phases 04/07/08 (which each produced one). `.planning/config.json` has `security_enforcement: true`, `security_block_on: "high"`. CR-01 was a genuine high-severity information-disclosure finding; it is now closed and tested (see above), but the phase never produced the formal security artifact the project's own convention would suggest. Recommend backfilling a retroactive `09-SECURITY.md` documenting the CR-01 finding and its closure, but this is a documentation/process gap, not a code defect — it does not block the phase goal.
- ROADMAP.md's Phase 9 entry still reads "**Plans**: 13/18 plans executed" even though all 18 plans have `[x]` checkboxes and matching SUMMARY.md files (confirmed: 18 PLAN.md, 18 SUMMARY.md). This is the same STATE-tooling undercounting bug the executor already logged in `deferred-items.md` during 09-10 — a bookkeeping artifact, not a verification gap.
- `09-UAT.md` (dated before round 3/4) still shows Test 2 as an open "issue" for the older-message retry storm. That defect was closed by Plan 09-12 (confirmed by the prior verification and unchanged by this pass) and the file was never refreshed afterward — stale documentation, not a current defect.
- WR-04 (reaction snapshot loss on bare remote update) and WR-05 (hidden message counted read) and IN-01 (non-monotonic read-marker merge) remain present and unchanged, exactly as the prior verification found them. They pre-date the Phase 9 extraction and are outside the CSTATE-01..06 must-have scope; carrying forward the prior verification's non-blocking/deferred classification since round 4 was not scoped to touch reaction or read-marker logic.

## Human Verification Required

### 1. Older-page failure/retry — no transcript layout shift (HV-01)

**Test:** In a real browser, force an older-page load failure in `/channels/general` (e.g. throttle/disable network on scroll-to-top), confirm the calm notice-tone retry region appears with no jump in the message transcript, then retry successfully.
**Expected:** One automatic attempt, a stable-height retry region, successful manual recovery.
**Why human:** jsdom cannot compute real CSS layout/pixel height. The automated test proves the structural invariant (one persistent DOM node with a fixed-height class across idle/loading/error), which is strong evidence but not a substitute for an on-screen pixel check.

### 2. A-to-B pagination switch — scroll never corrupted (HV-02)

**Test:** In a real browser, start an older-page load in one conversation, switch to another before it settles, and let it resolve as both success and failure.
**Expected:** The switched-away request never writes scroll position or error state into the new conversation.
**Why human:** jsdom's `scrollTop`/`scrollHeight` are inert (always 0), so the scrollTop-write suppression itself cannot be independently observed automatically, even though the guarding logic is code-identical to the automatically-proven error-state suppression.

### 3. Cross-account chat cache isolation + failed sign-out (HV-03)

**Test:** Sign in as account A, then sign in as account B in a second tab/session without using the Log out button; separately, force `signOut()` to fail and confirm the account stays signed in with calm guidance.
**Expected:** B never sees A's local draft/pending/failed rows; a failed sign-out preserves state and shows retry guidance without navigating.
**Why human:** genuine multi-tab/cross-session auth-state propagation cannot be fully simulated in a component test, even though every individual code path (identity-change purge, `SIGNED_OUT`, cross-identity events, same-user preserve, failed-signOut branch) is unit-tested against the real store/guard/hook.

### 4. Community send E2E — live execution (HV-04)

**Test:** Run `npx playwright test e2e/chat-send.spec.ts` against a live dev server with seeded Supabase.
**Expected:** The rewritten spec passes: exactly one row after send, exactly one row after reload, no failure copy present.
**Why human:** this sandbox has no dev server or seeded Supabase available (per this verification's own constraints). This is the single round-4 claim with the least independent confirmation — `playwright --list` proves the spec compiles and is discoverable, but it has never actually been run since the WR-08 rewrite.

### 5. Logo tap-target visual check (HV-05, optional/low-risk)

**Test:** Visually confirm the app-shell logo is a comfortably-sized, centered 56px tap target on the rendered community shell.
**Expected:** No visually cramped or off-center logo target.
**Why human:** cosmetic/visual confirmation; low risk since the change reuses the exact `--size-control` token already shipped and confirmed for message actions.

## Gaps Summary

No blocking gaps remain. All 8 previously-blocking gaps (CR-01, WR-01, WR-02, WR-03, WR-06, WR-07, WR-08, WR-09) plus WR-10 (recorded as a parity sub-gap of the same blocking cluster) are closed at the source level, independently re-verified against current code and passing tests in this pass — not accepted on the SUMMARY narratives alone. The full automated gate set (493 tests, typecheck, build, lint) was re-run directly rather than trusted from prior reports, and all previously-passing fixtures/tests remain green (no regressions).

The phase is not `passed` only because five checks require a live browser/dev-server/seeded-Supabase environment this verification sandbox cannot access, per its own constraints — most materially, the rewritten community send E2E spec (HV-04) has not yet been executed end-to-end. Four of the five human-verification items (HV-01, HV-02, HV-03, HV-05) are now backed by strong, specific automated regression coverage that did not exist in the prior `gaps_found` pass; they are recommended confirmations, not blind trust requests. HV-04 is the one item this verification recommends treating as required before considering Phase 9 fully released, since it is the only round-4 claim with zero live-execution evidence.

Two pre-existing, out-of-scope product-debt items (WR-04 reaction-snapshot loss, WR-05 hidden-message-marked-read) and one deferred design decision (IN-01 non-monotonic read-marker merge) remain unchanged from the prior verification's own non-blocking/deferred classification; round 4 was not scoped to address them and neither is a CSTATE-01..06 must-have.

## Next Action

Run the five human-verification items above (HV-01..HV-05), prioritizing HV-04 (live Playwright execution). If they pass, Phase 9 can be marked complete; if HV-04 reveals a live-environment defect the static spec review could not catch (e.g. a selector mismatch against the real rendered DOM), route that specific finding through a narrow follow-up plan rather than reopening the whole phase.

```text
$gsd-verify-work 9   # after HV-01..HV-05 are exercised, to close out human_needed
```

---

_Verified against HEAD `7988a12fd3ee094e07c468622da0cd30afa40394`._
_Previous verification: `gaps_found`, score 2/6, HEAD `e74c5980c49a244f4c6ed8e6885131f8ceefe951`._
_Verifier: Claude (gsd-verifier role)._
