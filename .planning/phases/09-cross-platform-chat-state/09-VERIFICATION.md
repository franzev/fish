---
phase: 09-cross-platform-chat-state
verified: 2026-07-10T15:08:53+08:00
status: gaps_found
score: "2/6 requirements fully verified; 3 partial; 1 failed"
re_verification: true
head_verified: e74c5980c49a244f4c6ed8e6885131f8ceefe951
requirements_verified:
  - CSTATE-01
  - CSTATE-05
requirements_partial:
  - CSTATE-02
  - CSTATE-03
  - CSTATE-04
requirements_failed:
  - CSTATE-06
security_enforcement: enabled
security_block_on: high
security_audit: absent_no_09_SECURITY_md
schema_drift: false
codebase_drift: non_blocking_warning
human_verification:
  - id: HV-01
    status: required_after_gap_closure
    test: "Force an older-page failure in /channels/general, then retry successfully in a real browser."
    expected: "Exactly one automatic attempt, a stable notice-tone retry region with no transcript movement, and successful manual recovery."
  - id: HV-02
    status: required_after_gap_closure
    test: "Start an older-page request in conversation A, switch the mounted client to B before A settles, then settle A as both failure and success."
    expected: "A cannot gate B, write B's error state, suppress B's first sentinel load, or restore A's scroll coordinates into B."
  - id: HV-03
    status: required_after_gap_closure
    test: "Expire or revoke account A outside the explicit logout button, then sign in as B in the same browser tab. Also force signOut() to return ok:false."
    expected: "B never sees A's draft/local rows; failed sign-out preserves A's state and shows calm retry guidance instead of navigating."
  - id: HV-04
    status: required_after_gap_closure
    test: "Run the corrected community send Playwright smoke against seeded Supabase."
    expected: "The send has one coherent success proof and exactly one matching row; no duplicate can be hidden by selecting .last()."
---

# Phase 09: Cross-platform Chat State Verification

## Goal Verdict

**Not achieved.** The portable core, fixture runner, focused hooks, Zustand
adapter, canonical `/channels/:id` route, and native architecture notes all
exist and are wired. However, the current implementation does not safely own
state across account or conversation transitions, can delete unresolved local
sends before failure recovery, permits a late transport failure to downgrade a
message already confirmed by realtime, and does not hold the no-layout-shift
contract introduced by Plan 09-12.

This is `gaps_found`, not `human_needed`: the blocking defects are established
by current source and reducer execution. A browser judgment cannot turn those
automated/source failures into passes.

The superseded canonical surface was applied throughout this verification:
`/channels/general` (implemented by `/channels/[id]`), not the removed `/chat`
route.

## Requirement Traceability

| Requirement | Owning plans | Result | Current-source evidence |
|---|---|---|---|
| CSTATE-01 | 09-01 | **VERIFIED** | `packages/core/src/chat-state/{types,reducer,selectors,index}.ts` owns the portable implementation; `apps/web/tests/chat-state-boundary.test.ts:10-50` rejects React, Next, Zustand, Supabase, browser, web-alias, Swift, and Kotlin dependencies; the boundary test passes. |
| CSTATE-02 | 09-02, 09-08, 09-12 | **PARTIAL** | `ChatClient` delegates to five focused hooks (`chat-client.tsx:41-47,117-207`) and `/chat` is absent. Preservation fails under an in-flight A-to-B older-load switch and unresolved-send hydration (`use-chat-messages.ts:119,227-269`; `use-load-older-messages.ts:37-55`; `reducer.ts:138-151`). |
| CSTATE-03 | 09-03, 09-07, 09-10 | **PARTIAL** | Zustand is web-only, reducer-backed, conversation-keyed, and authority-boundary clean (`chat-store.ts:1-17,118-257`). The module singleton is not owned by verified auth identity changes, and explicit logout ignores `ServiceResult.ok` before clearing/navigating (`use-logout.ts:18-23`). |
| CSTATE-04 | 09-01, 09-04, 09-06, 09-09 | **PARTIAL** | Eighteen JSON vectors replay and the canonical protocol exists. The stated 96-character snippet contract is not executable parity: `slice(0, 95) + "..."` returns 98 UTF-16 code units and can split a surrogate pair (`selectors.ts:191-202`; protocol `:105-108`). No long ASCII/emoji vector covers it. |
| CSTATE-05 | 09-04, 09-06, 09-09 | **VERIFIED** | `09-NATIVE-CHAT-STATE-NOTES.md:23-41,60-72,74-172` maps all 15 events and 18 fixtures to Android `ViewModel`/`StateFlow` and iOS observable state while excluding web libraries and production native implementation. |
| CSTATE-06 | 09-01..03, 09-05, 09-07..12 | **FAILED** | No-lost-draft, correct optimistic reconciliation, layout stability, account isolation, and the usable browser send smoke do not all hold. Passing aggregate tests do not exercise the failing promise/auth interleavings. |

No CSTATE requirement is orphaned; all six IDs occur in plan frontmatter and
are accounted for above.

## Plan Must-Haves, Artifacts, and Key Links

All declared artifacts exist and are substantive, except the intentionally
deleted `apps/web/app/(authenticated)/chat/page.tsx`, whose absence is the Plan
09-08 artifact. The table distinguishes artifact existence from behavioral
truth.

| Plan | Truth verdict | Artifact/key-link verdict | Evidence and disposition |
|---|---|---|---|
| 09-01 | **PASS on declared extraction scope** | **PASS** | Portable exports, package export map, JSON vectors, boundary runner, fixture runner, and web shim exist; `@fish/core/chat-state` links are live. The long-snippet parity defect is recorded under CSTATE-04/WR-10. |
| 09-02 | **PARTIAL** | **PASS** | Five hooks exist and `ChatClient` consumes them. Behavior-preservation truth fails because hydration can erase unresolved optimistic rows and conversation-scoped transient state is not fully reset (WR-02/WR-06). |
| 09-03 | **PARTIAL** | **PASS** | Zustand is installed only in `apps/web`; store-to-reducer and selector links are live. Safe cache coordination is incomplete across verified auth transitions and authoritative hydration. |
| 09-04 | **PARTIAL** | **PASS** | Protocol and native-note artifacts/linkage exist and native source was not implemented. The protocol's long-snippet rule disagrees with executable code and lacks a parity vector (WR-10). |
| 09-05 | **INCONCLUSIVE by its own evidence contract** | **PASS** | Two authenticated deliveries rendered exactly once, but message/read/reaction callback statuses, raw WebSocket frames, and sender HTTP status were not exposed (`loading-new-messages.md:195-225`). Functional delivery was not reproduced as broken; transport evidence remains inconclusive. |
| 09-06 | **PASS** | **PASS** | Protocol, Phase 09 native notes, supplementary Phase 10 note, and UAT point to one canonical 15-event/18-fixture documentation chain. |
| 09-07 | **PARTIAL** | **PARTIAL** | The narrow explicit successful-logout test passes and `clearChatStore()` performs a full reset. The declared direct `LogoutButton -> chat-store` link has moved through `useLogout`, and the broader verified-identity transition remains unsafe (CR-01). |
| 09-08 | **PARTIAL** | **PASS structurally** | `/chat` is absent, the build route is `/channels/[id]`, and dated supersede notes exist. A non-runtime `/chat` comment remains in `app-shell.tsx:117`, and the repointed Playwright artifact cannot satisfy its own status assertion (WR-08). |
| 09-09 | **PARTIAL** | **PASS** | Direct failure restores an empty draft and preserves a newer draft; fixtures/tests pass. Rehydration can first remove the optimistic row/body, and a late failure can downgrade an already-sent row (WR-02/WR-03). |
| 09-10 | **PARTIAL** | **PASS** | Reconnect tracker reset, idle cleanup, and single read-state dispatch are present. Participant typing/recording, `localTypingRef`, and `ChatClient.hasConnected` still cross conversation boundaries (WR-06). |
| 09-11 | **PASS** | **PASS** | Group cutoff, truthful offline copy, 56px message actions, coarse-pointer reveal, and tests are present. |
| 09-12 | **FAIL overall; first three settled-path truths pass** | **PASS** | A settled failure is bounded, notice-tone retry appears, manual retry succeeds, and reducer retryability remains intact. The in-flight A-to-B race and state-varying normal-flow pagination region violate the conversation-reset and no-layout-shift requirements (WR-01/WR-07). |

### Key data-flow links

- `channels/[id]/page.tsx:37-50` threads the real send/read/refresh/pagination
  actions into `ChatClient`.
- `chat-store.ts:118-249` routes store actions through `reduceChatState`; it
  contains no Supabase/auth/role/assignment authority.
- `use-chat-realtime.ts:98-157` routes message/read/reaction channel callbacks
  to store/hook transitions.
- `use-load-older-messages.ts:57-80` gates the observer after a settled error,
  and `chat-client.tsx:303-318` routes manual retry through the same
  `loadOlderAndPreserveScroll` callback.
- Plan 09-07's runtime logout link is now indirect:
  `LogoutButton -> useLogout -> clearChatStore`, not the plan's declared direct
  import.

## Plan 09-12 / UAT Blocker Verification

The original "loading earlier messages breaks the app" diagnosis was correct,
and the narrow retry-storm fix works. The broader Plan 09-12 contract does not.

| Check | Result | Evidence |
|---|---|---|
| One failed automatic load cannot loop while the same sentinel stays visible | **PASS** | Error state gates the observer (`use-load-older-messages.ts:57-80`); `chat-client.test.tsx:1281-1312` fires the sentinel twice and proves one action call. |
| Calm failure notice and one manual retry control | **PASS** | Notice-tone `Alert`, ghost `Try again`, no duplicate load control (`chat-client.tsx:303-330`); component assertions at `chat-client.test.tsx:1314-1351`. Base `Button` supplies `min-h-control`. |
| Manual retry can succeed and render earlier history | **PASS** | `chat-client.test.tsx:1353-1397` proves a fail-then-success sequence, cleared notice, and recovered message. |
| Portable reducer remains retryable | **PASS** | `olderPageLoadFailed` only clears `isLoadingOlder`, preserving cursor/`hasMoreOlder` (`reducer.ts:184-196`); store regression at `chat-store.test.ts:384-403` passes. |
| In-flight A request settling after switch to B cannot affect B | **FAIL** | One hook-wide `isLoadingOlderRef` survives the switch (`use-chat-messages.ts:119,227-260`). The old wrapper captures the viewport, then later writes scroll/error state (`use-load-older-messages.ts:37-55`). The current switch test waits for A to settle before rerendering B (`chat-client.test.tsx:1456-1503`). WR-01 is therefore a real must-have gap. |
| Loading -> failure does not move the transcript | **FAIL structurally** | Loading inserts two `h-2xl` skeleton rows plus gap/padding (`chat-client.tsx:293-302`); failure replaces them with a differently sized normal-flow alert/button row (`:303-319`). No invariant-height region or geometry test exists. |

`09-UAT.md` still records Test 2 as an issue, and `09-12-SUMMARY.md` explicitly
leaves the real-browser rerun pending. That pending human check is not the
reason for `gaps_found`; the two source-proven failures above are.

## Executable Race/Contract Probes

The current reducer/selectors were transpiled and evaluated in memory without
editing the repository. The probes produced:

| Probe | Actual result | Required result |
|---|---|---|
| optimistic send -> `hydrateWindow([])` -> late failure | `messages: 0`, `draft: ""` | unresolved local row/body retained so failure can restore it |
| optimistic send -> realtime confirmation -> late action failure | message becomes `failed`; draft restored to sent body | authoritative `sent` row remains sent; failure is ignored |
| reacted message -> bare remote edit without reaction snapshot | reactions become `[]` | preserve the known snapshot when incoming payload has no snapshot |
| 97-character ASCII snippet | length `98` | final snippet length at most 96 by documented rule |
| 94 ASCII + emoji crossing index 95 | output contains lone surrogate `U+D83D` before `...` | valid Unicode/grapheme-safe truncation |

The first two probes are blocking CSTATE-06/portable-lifecycle failures. The
reaction probe is confirmed supported-feature debt outside the formal Phase 09
minimum. The snippet probes block protocol parity.

## Automated Checks

| Check | Result |
|---|---|
| Focused Phase 09 suite (boundary, fixtures, shim, store, ChatClient, grouping, logout, shell) | **PASS — 8 files, 105 tests** |
| Full web suite at this HEAD | **PASS — 60 files, 468 tests** (independently rerun and also recorded by `09-REVIEW.md`) |
| `pnpm typecheck` | **PASS** — core, Supabase, web |
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** — independently green; `/channels/[id]` present, `/chat` absent |
| `playwright test --list e2e/chat-send.spec.ts` | **PASS — one test discovered**; execution not used as proof because the assertion is statically incompatible with community rendering |
| Zustand dependency placement | **PASS** — `zustand@5.0.14` only under `@fish/web` |
| Canonical route scan | **PASS for runtime route** — no `/chat` page or runtime URL; one historical source comment remains |
| Schema drift | **FALSE** (provided regression gate) |
| Codebase drift | **Non-blocking warning** (provided regression gate) |

Green aggregate checks establish baseline stability, not the missing interleaving
coverage. The current suites settle the old conversation before switching,
exercise only `signOut: ok:true`, and do not reorder realtime confirmation ahead
of transport failure.

## Review-Finding Disposition

Every finding in `09-REVIEW.md` was checked against the current source.

| Finding | Disposition | Phase effect |
|---|---|---|
| CR-01 account-transition cache isolation | **CONFIRMED — BLOCKING (Critical/High)** | Module-global store is cleared only by explicit logout; there is no auth identity listener/namespace. `useLogout` ignores `ok:false`, then clears and navigates. Blocks CSTATE-03/CSTATE-06 and the enabled high-severity security gate. |
| WR-01 older-load conversation race | **CONFIRMED — BLOCKING** | Old A completion can gate B, set B's error, suppress B's first automatic load, or restore A coordinates into B. Direct Plan 09-12 must-have failure. |
| WR-02 hydration deletes unresolved sends | **CONFIRMED — BLOCKING** | `hydrateConversation`/`hydrateWindow` replace the message array. A later failure has no row/body to recover. Direct no-lost-draft violation. |
| WR-03 late failure downgrades realtime-confirmed send | **CONFIRMED — BLOCKING** | `markMessageFailed` has no transition guard and overwrites `sent`. Portable lifecycle/native parity would encode a false failure. |
| WR-04 bare update erases reactions | **CONFIRMED — NON-BLOCKING PHASE DEBT** | Real supported-feature defect, but reactions predate the extraction and are outside the formal CSTATE fixture minimum. Record for follow-up. |
| WR-05 hidden message is marked read | **CONFIRMED — NON-BLOCKING PHASE DEBT** | Real product/read-receipt defect, but the policy predates Phase 09 and the phase preserved it. Record for follow-up. |
| WR-06 stale conversation transients | **CONFIRMED — BLOCKING** | Typing/recording/local refs and `hasConnected` are not keyed/reset by conversation, contradicting Plan 09-10's conversation-isolation truth. |
| WR-07 pagination feedback layout shift | **CONFIRMED — BLOCKING** | Plan 09-12 introduced different-height normal-flow states despite CSTATE-06/no-layout-shift. |
| WR-08 lifecycle contract/E2E contradiction | **CONFIRMED — BLOCKING RELEASE GAP** | Community success status is hidden (`chat-client.tsx:365-368,568-575`), while Playwright requires a visible `Sent|Delivered|Read` image and uses `.last()`, which cannot prove deduplication. |
| WR-09 shell logo below 56px | **CONFIRMED — BLOCKING PRODUCT GATE** | Anchor has only `shrink-0`; its images are 32/40px (`app-shell.tsx:134-153`). This violates the global non-negotiable 56px interaction floor on the canonical chat shell. |
| WR-10 malformed/overlong snippet | **CONFIRMED — BLOCKING PARITY GAP** | Executable output disagrees with protocol and can emit malformed Unicode; missing long-string/emoji vectors. |
| IN-01 stale read state moves markers backward | **CONFIRMED — DEFERRED INFO DEBT** | `mergeReadState` wholesale-replaces by user. The current protocol promises an upsert, not monotonic conflict resolution; prior plan notes explicitly deferred it. |

## Security Enforcement

- `.planning/config.json` enables security enforcement and blocks on `high`.
- No `.planning/phases/09-cross-platform-chat-state/09-SECURITY.md` exists.
- Supabase/RLS remains the durable authority; the blocking issue is browser-local
  information disclosure across account identity transitions, not an RLS bypass.
- CR-01 is still live despite the prior narrow explicit-logout regression test,
  so the missing formal security artifact cannot be treated as merely
  procedural in this verification.

## Blocking Gaps

1. **Bind the chat cache to verified auth identity.** Clear/namespace on every
   verified user change and signed-out transition, including cross-tab/session
   expiry; handle `signOut().ok === false` by preserving state and showing calm
   retry guidance. Add success, failure, and non-button account-transition tests.
2. **Give pagination requests conversation/generation ownership.** Scope the
   in-flight lock by conversation, ignore stale completions, cancel stale rAF,
   and test deferred A success/failure after rerender to B.
3. **Reconcile authoritative hydration with unresolved local sends.** Preserve
   pending/sending/failed rows and their recovery bodies through prop hydration
   and reconnect reset; test both later confirm and later failure.
4. **Make send status transitions monotonic.** Ignore failure after an
   authoritative sent/realtime confirmation; add a portable vector and web
   regression.
5. **Reset every conversation-scoped realtime transient.** Clear participant
   typing/recording, local typing state, timers, and `hasConnected` on id change;
   add same-mounted-instance prop-switch tests.
6. **Reserve invariant pagination-feedback geometry.** Keep transcript position
   stable across idle/loading/failure/retry success and verify geometry in a
   real browser.
7. **Choose one community lifecycle proof and repair the E2E.** Either render
   the intended status or prove persistence by reload; assert exactly one row,
   never `.last()`.
8. **Meet the 56px shell target and repair snippet parity.** Enlarge the logo
   link; define the snippet counting unit/final limit, truncate safely, and add
   ASCII + emoji fixtures mirrored in the protocol/native notes.

## Human Checks After Automated Gap Closure

The structured frontmatter lists the four required reruns. Additionally, Plan
09-05's raw WebSocket/callback/HTTP capture remains inconclusive even though two
functional deliveries succeeded exactly once. It should be repeated only if
transport-level evidence remains a release requirement after the automated gaps
above are closed.

## Next Action

Run:

```text
$gsd-plan-phase 09 --gaps
```

Do not mark Phase 09 complete and do not route directly to human-only UAT until
the source-proven gaps are planned and fixed.

---

_Verified against HEAD `e74c5980c49a244f4c6ed8e6885131f8ceefe951`._
_Verifier: Codex (gsd-verifier role)._
