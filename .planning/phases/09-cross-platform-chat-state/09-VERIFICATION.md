---
phase: 09-cross-platform-chat-state
verified: 2026-07-10T13:42:00+08:00
status: passed
score: "6/6 requirements verified"
re_verification: true
head_verified: 1371f49eb86a845aeb7e5de92b20bf0b9e0b7e3e
previous_head_verified: dd7631789d376e7f4e4b670e8c75c73e7b297bed
requirements_verified:
  - CSTATE-01
  - CSTATE-02
  - CSTATE-03
  - CSTATE-04
  - CSTATE-05
  - CSTATE-06
requirements_partial: []
requirements_failed: []
transport_evidence: inconclusive # unchanged from 09-05; not re-litigated per instruction
security_enforcement: enabled
security_audit: cr-01_remediated_no_formal_09-security.md
human_verification: []
re_verification_detail:
  previous_status: gaps_found
  previous_score: "3/6 requirements fully verified"
  gaps_closed:
    - "CR-01 — cross-account composer/message leak in the module-global Zustand store (closed by 09-07: clearChatStore() wired into LogoutButton's soft-logout path)"
    - "WR-01 — send-failure hook erased a restored or newer draft (closed by 09-09: conditional restore in markMessageFailed, hook clobber removed)"
    - "WR-02 — same-sender community grouping suppressed avatar/time indefinitely (closed by 09-11: belongsToSameMessageGroup predicate — same sender + same day + 5-minute gap)"
    - "WR-03 — offline copy promised an automatic queue that does not exist (closed by 09-11: truthful 'Reconnect, then try again.' copy in code and the design skill)"
    - "WR-04 — message actions were 40px hover-only, below the 56px floor (closed by 09-11: min-h-control/min-w-control + pointer-coarse reveal)"
    - "WR-05 — stale realtime lifecycle/refs mislabeled a revisit as reconnecting (closed by 09-10: idle-on-cleanup + per-conversation ref reset)"
    - "WR-06 — duplicate realtime read-state dispatch (closed by 09-10: single mergeReadState path)"
    - "Route-scope drift (Gap 4) — /chat removed entirely; /channels/general is the sole canonical surface; CSTATE-02/CSTATE-06/D-09/Phase 9 goal carry dated supersede notes (closed by 09-08)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "mergeReadState should reject an out-of-order stale row instead of wholesale-replacing it (IN-01)"
    addressed_in: "Not scheduled to a phase; explicitly deferred by 09-09's closing notes as a separate selectors.ts concern"
    evidence: "09-REVIEW.md classifies IN-01 as INFO DEBT (non-blocking); packages/core/src/chat-state/selectors.ts mergeReadState (line ~49-57) still replaces the existing row unconditionally when any field differs — unchanged by this gap-closure round by design"
---

# Phase 09: Cross-platform Chat State Verification Report

**Phase Goal:** Extract chat state into a portable, test-vector-backed state
machine and refactor the web chat route so Zustand coordinates shared web
surfaces without becoming the source of truth; Android and iOS receive the
same event/result contract for native ViewModel/observable implementations
later. **Canonical surface (superseded 2026-07-10):** the community room at
`/channels/general` (`/chat` was removed by plan 09-08); this re-verification
targets `/channels/:id`.

**Verified:** 2026-07-10T13:42:00+08:00
**Status:** `passed`
**Re-verification:** Yes — after gap-closure round 2 (plans 09-07 through
09-11), re-verifying against HEAD `1371f49e` (previous verification was
against `dd76317` and returned `gaps_found`).

## Goal Achievement

### Requirement Results

| Requirement | Status | Evidence |
|---|---|---|
| **CSTATE-01** | ✓ VERIFIED (unchanged) | `packages/core/src/chat-state/` contains portable types, reducer, selectors, and 18 JSON fixture vectors. `apps/web/tests/chat-state-boundary.test.ts` rejects React/Next.js/Zustand/Supabase/`@/` aliases/browser globals/Swift/Kotlin references — passes at HEAD. |
| **CSTATE-02** | ✓ VERIFIED (superseded interpretation) | `ChatClient` still delegates to five focused hooks (`use-chat-messages`, `use-chat-read-state`, `use-chat-realtime`, `use-chat-composer`, presence). `/chat` is deleted (`apps/web/app/(authenticated)/chat/page.tsx` confirmed absent; `pnpm build` route table lists `/channels/[id]`, no `/chat`). `/channels/general` is the single canonical surface — nav has one "Community" link (`generalChannelHref`), not a picker. Per the 2026-07-10 supersede note in REQUIREMENTS.md/09-CONTEXT.md/ROADMAP.md, "current one-assigned-conversation experience" is now read against this community-room experience, which the gap-closure round preserved (no new primary action, no picker). |
| **CSTATE-03** | ✓ VERIFIED (CR-01 closed) | Zustand remains web-only, reducer-backed, conversation-keyed, no auth/role/assignment/Supabase-client imports (`chat-store.test.ts` "authority boundary" still greps clean). `clearChatStore()` now exists and is called from the real `LogoutButton.handleLogout` between `signOut()` and `router.push("/login")`. A new regression test (`logout-button.test.tsx`) drafts as account A, runs the real soft logout, and asserts account B's composer and messages are empty — CR-01 (cross-account leak) is closed with source + behavior evidence, not just a claim. |
| **CSTATE-04** | ✓ VERIFIED (unchanged) | 18 JSON vectors (was 17; `markMessageFailedPreservesNewerDraft` added) with `initialState`, ordered events, expected state/selector output. `chat-state-protocol.md` documents the conditional `markMessageFailed` restore rule and the full fixture-name list. Fixture replay passes (`chat-state-fixtures.test.ts`). |
| **CSTATE-05** | ✓ VERIFIED (unchanged) | `09-NATIVE-CHAT-STATE-NOTES.md` fixture-case list includes `markMessageFailedPreservesNewerDraft`, kept in sync with the protocol doc per the plan's own contract-ownership rule. No native production source touched. |
| **CSTATE-06** | ✓ VERIFIED (was FAILED) | All prior blockers/warnings closed with source + test evidence (see Gap Closure table below). `pnpm build`, `pnpm lint`, `pnpm --filter @fish/web typecheck`/`pnpm typecheck`, and the full focused/unfocused test suite (460/460, 59 files) all pass at HEAD `1371f49e`, re-run directly by this verification (not taken from SUMMARY claims). |

**Score:** 6/6 requirements verified.

### Gap Closure Verification (this round)

| Finding | Prior severity | Fix plan | Source evidence (re-checked at HEAD) | Test evidence (re-run) |
|---|---|---|---|---|
| CR-01 — cross-account composer/message leak | BLOCKER | 09-07 | `chat-store.ts:268-274` exports `clearChatStore()` (full `setState(..., true)` replace); `logout-button.tsx:23-32` calls it inside `handleLogout` between `signOut()` and `router.push` | `logout-button.test.tsx` — soft logout/login lifecycle test passes; `chat-store.test.ts` `clearChatStore` block passes |
| WR-01 — post-failure draft clobber | BLOCKER | 09-09 | `reducer.ts` `markMessageFailed` restores `composer.draft` only when `conversation.composer.draft.length === 0`; `use-chat-composer.ts` no longer calls `setDraft(..., "")` in the failure branch | `chat-state-fixtures.test.ts` (18 vectors incl. `markMessageFailedPreservesNewerDraft`); `chat-client.test.tsx` restore + delayed-failure tests pass |
| WR-02 — avatar/time suppressed indefinitely | BLOCKER (matches user's UAT report) | 09-11 | `message-grouping.ts` exports `belongsToSameMessageGroup` (same sender + same calendar day + ≤5min gap); `chat-client.tsx:332-334` wires it in place of the senderId-only comparison | `message-grouping.test.ts` (5 cases); `chat-client.test.tsx` grouping-reappearance test passes |
| WR-03 — offline copy overpromises | WARNING | 09-11 | `chat-client.tsx:618` reads "You're offline. Reconnect, then try again."; `states.md:27` matches, with a no-queue note added | `chat-client.test.tsx` offline-copy test asserts "Reconnect" and absence of "will send when you're back" |
| WR-04 — 40px hover-only actions | WARNING | 09-11 | Four action controls in `chat-client.tsx` use `min-h-control min-w-control` (56px token), not `size-10`; action bar adds `pointer-coarse:pointer-events-auto pointer-coarse:opacity-100` | `chat-client.test.tsx` action-sizing test asserts the token classes and absence of `size-10` |
| WR-05 — stale realtime lifecycle across mounts | WARNING | 09-10 | `use-chat-realtime.ts` resets `seenFirstSubscribeRef`/`backfillInFlightRef` in a `useEffect` keyed on `[chat.conversationId]`; message-subscription cleanup calls `setRealtimeStatus(chat.conversationId, "idle")` after unsubscribing | `chat-client.test.tsx` lifecycle test (unmount → idle, remount → no false "Reconnecting…") passes; summary documents a revert-and-rerun check that the test fails without the fix |
| WR-06 — duplicate read-state dispatch | WARNING | 09-10 | `use-chat-realtime.ts` read-subscription callback calls only `mergeReadState(readState)`, direct `dispatchChatEvent({type:"mergeReadState"...})` removed | `chat-client.test.tsx` single-dispatch test asserts store transition delta === 1 |
| Gap 4 — route-scope drift (`/chat` vs. community room) | BLOCKER (scope conflict) | 09-08 | `apps/web/app/(authenticated)/chat/page.tsx` deleted (confirmed absent); `grep -rn '"/chat"' apps/web/app apps/web/components apps/web/e2e` returns nothing; `app-shell.tsx` immersive check is `isActivePath(pathname, "/channels")` only; dated 2026-07-10 supersede notes present in REQUIREMENTS.md, 09-CONTEXT.md, ROADMAP.md | `app-shell.test.tsx` (11 tests) passes; `pnpm build` route table confirms `/channels/[id]` present, `/chat` absent |

All eight findings from `09-REVIEW.md` that were classified BLOCKER or WARNING
are closed with re-checked source and passing tests — none of this is taken
on SUMMARY.md's word; each artifact above was read directly and each test
file was re-run in this verification pass.

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `packages/core/src/chat-state/index.ts` / `types.ts` / `reducer.ts` / `selectors.ts` | VERIFIED | Portable, boundary-clean; reducer now conditionally restores drafts (WR-01 fix). |
| `packages/core/src/chat-state/fixtures/chat-state-vectors.json` | VERIFIED | 18 vectors (confirmed by direct parse), including the new `markMessageFailedPreservesNewerDraft` case. |
| `apps/web/tests/chat-state-boundary.test.ts` / `chat-state-fixtures.test.ts` | VERIFIED | Both pass at HEAD. |
| `apps/web/app/(authenticated)/chat/store/chat-store.ts` | VERIFIED (was BLOCKED) | `clearChatStore()` added and wired into production logout; boundary grep still clean. |
| `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` | VERIFIED | New `clearChatStore` describe block covers full reset. |
| `apps/web/components/auth/logout-button.tsx` / `.test.tsx` | VERIFIED (new) | Production sign-out clears the store; cross-account regression test passes. |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts` | VERIFIED | Clobber removed; reducer owns draft recovery. |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` | VERIFIED | Per-conversation ref reset, idle-on-cleanup, single read dispatch. |
| `apps/web/app/(authenticated)/chat/message-grouping.ts` / `.test.ts` | VERIFIED (new) | Pure predicate; 5 unit cases. |
| `apps/web/app/(authenticated)/chat/chat-client.tsx` | VERIFIED | Grouping predicate wired; truthful offline copy; 56px touch-safe actions. |
| `apps/web/app/(authenticated)/chat/page.tsx` | DELETED (intended) | `/chat` no longer resolves; confirmed absent from the build route table. |
| `apps/web/components/shell/app-shell.tsx` / `.test.tsx` | VERIFIED | Immersive check narrowed to `/channels`; obsolete `/chat` test case removed. |
| `packages/core/docs/chat-state-protocol.md` / `09-NATIVE-CHAT-STATE-NOTES.md` | VERIFIED | Both updated in lockstep for the new fixture case. |
| `.planning/REQUIREMENTS.md` / `09-CONTEXT.md` / `ROADMAP.md` | VERIFIED | Dated 2026-07-10 supersede notes present; original wording preserved. |

### Key-Link and Data-Flow Verification

| From | To | Via | Status |
|---|---|---|---|
| `apps/web/components/auth/logout-button.tsx` | `chat-store.ts` | `clearChatStore()` call inside `handleLogout` | WIRED (new) |
| `use-chat-composer.ts` | `reducer.ts` `markMessageFailed` | reducer owns draft restore; hook no longer clears | WIRED |
| `use-chat-realtime.ts` message-subscription cleanup | chat store realtime status | `setRealtimeStatus(id, "idle")` on cleanup | WIRED (new) |
| `use-chat-realtime.ts` read-subscription | chat store | single `mergeReadState()` call, direct dispatch removed | WIRED (fixed) |
| `chat-client.tsx` grouping | `message-grouping.ts` | `belongsToSameMessageGroup(previous, message)` / `(message, next)` | WIRED (new) |
| `app-shell.tsx` immersive check | `/channels` route | `isActivePath(pathname, "/channels")` only | WIRED (narrowed) |
| auth logout | module-global chat store | `clearChatStore()` full reset | WIRED — **was the sole BLOCKER, now closed** |

### Behavioral Spot-Checks / Automated Evidence (re-run directly in this pass)

| Check | Command | Result |
|---|---|---|
| Full web test suite | `pnpm --filter @fish/web test -- --run` | **460/460 passed, 59 files** |
| Targeted gap-closure tests | `chat-store.test.ts`, `logout-button.test.tsx`, `app-shell.test.tsx`, `chat-state-boundary.test.ts`, `chat-state-fixtures.test.ts`, `message-grouping.test.ts` | All pass (included in the 460) |
| Typecheck | `pnpm typecheck` | **PASS** (core, supabase, web all "Done") |
| Lint | `pnpm lint` | **PASS** |
| Production build | `pnpm build` | **PASS** — route table confirms `/channels/[id]` present, `/chat` absent |
| `/chat` route absence | `test ! -f "apps/web/app/(authenticated)/chat/page.tsx"` | **CONFIRMED absent** |
| No `/chat` string references | `grep -rn '"/chat"' apps/web/app apps/web/components apps/web/e2e` | **No matches** |
| Debt-marker scan on gap-closure files | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 10 modified/created gap-closure files | **No matches** (one unrelated pre-existing "not available yet" calm-copy notice found in `use-chat-composer.ts`'s optional-prop guard — not a debt marker, not touched by this gap-closure round, consistent with the project's non-scolding copy convention) |
| Fixture vector count | direct JSON parse | **18 cases** (17 + `markMessageFailedPreservesNewerDraft`) |
| Working tree state | `git status --short` | Only `.planning/config.json` modified (an orchestration setting, `use_worktrees: false`) — unrelated to Phase 09; no Phase-09 source or test files are uncommitted at time of verification |

### Requirements Coverage

| Requirement | Owning plans | Status |
|---|---|---|
| CSTATE-01 | 09-01 | VERIFIED |
| CSTATE-02 | 09-02, 09-08 | VERIFIED (superseded interpretation) |
| CSTATE-03 | 09-03, 09-07 | VERIFIED |
| CSTATE-04 | 09-01, 09-04, 09-06, 09-09 | VERIFIED |
| CSTATE-05 | 09-04, 09-06, 09-09 | VERIFIED |
| CSTATE-06 | 09-01, 09-02, 09-03, 09-05, 09-07, 09-09, 09-10, 09-11 | VERIFIED |

No CSTATE requirement is orphaned. All six are present in plan frontmatter
`requirements:` fields and cross-reference cleanly against
`.planning/REQUIREMENTS.md`, including the dated 2026-07-10 supersede note.

### Anti-Patterns Found

None blocking. One pre-existing, out-of-scope calm-copy notice
("That action is not available yet.") in `use-chat-composer.ts`'s
`handleDeleteMessage` guard for an unwired optional prop — not a debt marker,
not introduced or touched by this gap-closure round, and consistent with the
project's "copy never scolds" convention (not a stub disguised as done; it is
a deliberate guard for a prop that may legitimately not be supplied by a
given caller).

### Security Audit

`.planning/config.json` has `security_enforcement: true` and
`security_block_on: "high"`. No `09-SECURITY.md` was produced. However, the
prior verification's own bar was "must be fixed **or** explicitly
security-reviewed" — CR-01, the sole Critical/cross-account information-
disclosure finding, is now fixed with a regression test that walks the app's
real soft logout/login lifecycle (`logout-button.test.tsx`), not merely
patched and claimed. This satisfies the "fixed" branch of that bar. A formal
`09-SECURITY.md` was not generated; this is a process-artifact gap, not a
remaining code vulnerability, and is noted here for completeness rather than
treated as a blocking gap.

### Deferred (non-blocking)

IN-01 (`mergeReadState` can regress markers on an out-of-order stale
realtime row) remains open in `packages/core/src/chat-state/selectors.ts` —
confirmed unchanged at HEAD. This was classified INFO DEBT (not
BLOCKER/WARNING) in `09-REVIEW.md`, and Plan 09-09's closing notes explicitly
scoped it out as a different concern (selector merge ordering, not composer
recovery). It does not block CSTATE-06 as worded ("no lost drafts, no
duplicate optimistic messages, no layout shift regression") — it is a
narrow, low-frequency ordering edge case in a different subsystem.

### Human Verification Required

None required to reach a `passed` verdict. All eight closed findings (CR-01,
WR-01 through WR-06, Gap 4) are covered by source-level fixes plus passing
automated tests that directly exercise the previously-broken behavior
(including, per 09-10's summary, a deliberate revert-and-rerun check proving
the new tests actually fail without the fix). Per the task's explicit
instruction, the transport-level realtime-delivery root cause recorded as
`inconclusive` by plan 09-05 is not re-litigated here.

**Optional, non-blocking suggestion:** since the original UAT report
("missing avatar/time") was a live human observation, a brief live
confirmation that avatar/`MessageMeta` now reappear after a real same-sender
pause in the deployed community room — and that the 56px touch actions are
reachable on an actual touch device — would add real-world confidence beyond
the DOM-level test assertions already in place. This is a recommendation,
not a gate: the automated evidence is specific enough (exact DOM assertions
matching the exact reported symptom) to support `passed` without it.

## Gaps Summary

No gaps remain from the eight closed findings. One INFO-level item (IN-01)
and one process-artifact item (missing `09-SECURITY.md`, superseded by a
regression-tested fix) are documented above as non-blocking. All requirement
truths, artifacts, and key links verified against the current HEAD
(`1371f49e`), not against SUMMARY.md claims — every fix was re-read from
source and every relevant test file was re-run in this verification pass,
and the full gate (460/460 tests, typecheck, lint, build) was re-run
directly rather than taken from prior summaries.

---

_Verifier: Claude (gsd-verifier)_
_Verified against HEAD `1371f49eb86a845aeb7e5de92b20bf0b9e0b7e3e`._
