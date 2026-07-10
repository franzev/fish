---
phase: 09-cross-platform-chat-state
verified: 2026-07-10T10:47:09+08:00
status: gaps_found
score: "3/6 requirements fully verified"
re_verification: true
head_verified: dd7631789d376e7f4e4b670e8c75c73e7b297bed
requirements_verified:
  - CSTATE-01
  - CSTATE-04
  - CSTATE-05
requirements_partial:
  - CSTATE-02
  - CSTATE-03
requirements_failed:
  - CSTATE-06
transport_evidence: inconclusive
security_enforcement: enabled
security_audit: missing
human_verification: []
---

# Phase 09: Cross-platform Chat State Verification

**Phase goal:** Extract chat state into a portable, test-vector-backed state
machine; use Zustand only as a thin web coordination adapter; and provide the
same event/result contract for later native implementations.

**Result:** The portable state machine, fixture contract, focused hooks,
Zustand adapter, and native documentation all exist and are wired. The phase
cannot be accepted as complete at the current committed `HEAD`, however,
because the store is not isolated across authenticated users and current UI
behavior violates the phase's no-lost-draft and presentation-preservation
requirements. The current `/chat` entry point has also drifted from the
phase-scoped assigned conversation into a fixed community channel.

## Goal Achievement

### Requirement Results

| Requirement | Status | Evidence and assessment |
|---|---|---|
| **CSTATE-01** | **VERIFIED** | `packages/core/src/chat-state/` contains portable types, reducer, and selectors. The only non-local import is the core `UserRole` type. `apps/web/tests/chat-state-boundary.test.ts` rejects React, Next.js, Zustand, Supabase, app aliases, browser globals, Swift, and Kotlin references. The committed boundary and core tests pass. |
| **CSTATE-02** | **PARTIAL** | `ChatClient` delegates messages, read state, realtime, presence, and composer behavior to five focused hooks, and the committed component test still covers direct assigned-conversation mode. At current `HEAD`, however, `apps/web/app/(authenticated)/chat/page.tsx` redirects `/chat` to the fixed `general` community channel, while `channels/[id]/page.tsx` renders the community data path. That later route drift no longer satisfies the literal “preserving the current one-assigned-conversation experience” requirement or Phase 09 D-09. |
| **CSTATE-03** | **PARTIAL / BLOCKED** | Zustand is installed only in `apps/web`; `chat-store.ts` is reducer-backed, keyed by `conversationId`, and contains no auth, role, assignment, Supabase-client, or persistence authority. But the module-global singleton has no production logout/session cleanup and the hydration reducer preserves `composer`. With the fixed community conversation id, a soft logout/login can expose account A's draft/local state to account B. This is CR-01 from `09-REVIEW.md` and prevents accepting the adapter as a safe user-scoped cache. |
| **CSTATE-04** | **VERIFIED** | The executable contract contains 17 JSON vectors with `initialState`, ordered events, and expected state/selector output. `chat-state-protocol.md` documents all 15 current events, state/result semantics, selector rules, fixture replay, authority boundaries, and canonical ownership. Fixture replay passes. |
| **CSTATE-05** | **VERIFIED** | The canonical Phase 09 notes map the full contract to Android `ViewModel` + `StateFlow` and an iOS observable model, including Phase 10 pagination additions. The notes explicitly prohibit web-library inheritance and production native implementation. The Phase 10 note is clearly supplementary history. No current native production source is changed by the phase. |
| **CSTATE-06** | **FAILED** | Build/lint/typecheck evidence and focused tests are green, and two authenticated live sends rendered exactly once without refresh or unexpected layout movement. The behavioral requirement is still false: send failure restores the body in the portable reducer and then `use-chat-composer.ts` clears it; a delayed failure can also erase a newer draft (WR-01). Community grouping suppresses avatar and `MessageMeta` for unlimited same-sender runs (WR-02), matching the user's missing avatar/time report. The current community route also exceeds Phase 09's “no new chat UI/community feed” scope. |

**Score:** 3/6 requirements fully verified. CSTATE-02 and CSTATE-03 have their
main structural artifacts but fail current behavior/lifecycle conditions;
CSTATE-06 is not achieved.

### Plan Must-Have Audit

| Plan | Must-have result | Assessment |
|---|---|---|
| 09-01 | Portable deterministic core, clean boundary, compatibility shim | **PASS** — exports, vectors, boundary guard, replay tests, and shim are substantive and wired. |
| 09-02 | Focused hooks with unchanged assigned-conversation behavior | **PARTIAL** — hook extraction is complete; the current route is no longer the assigned direct-conversation experience. |
| 09-03 | Web-only thin Zustand adapter with unchanged behavior | **FAIL** — web-only/reducer-backed constraints pass, but cross-account singleton lifetime violates safe cache isolation and draft behavior. |
| 09-04 | Protocol and native architecture mapping, no native implementation | **PASS** — later documentation drift was repaired by 09-06. |
| 09-05 | Two-session live evidence with evidence-based classification | **PARTIAL** — both functional attempts succeeded, but raw WS frames, callback statuses, and HTTP response status were unavailable. The required overall transport classification correctly remains `inconclusive`; no root cause is established. |
| 09-06 | Canonical pagination-aware protocol/native documentation chain | **PASS** — current protocol and Phase 09 native notes enumerate the same state, events, fixtures, and selector rules. |

## Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `packages/core/src/chat-state/index.ts` | **VERIFIED** | Public export surface for types, selectors, and reducer. |
| `packages/core/src/chat-state/types.ts` | **VERIFIED** | Portable state/event/result types, including pagination. |
| `packages/core/src/chat-state/reducer.ts` | **VERIFIED WITH GAP** | Deterministic event transitions are implemented; hydration intentionally preserves composer, which requires an auth-lifetime reset outside the reducer. |
| `packages/core/src/chat-state/selectors.ts` | **VERIFIED WITH INFO DEBT** | Required selectors exist. IN-01 remains: out-of-order stale read rows may regress marker state. |
| `packages/core/src/chat-state/fixtures/chat-state-vectors.json` | **VERIFIED** | 17 structurally replayable vectors; original 10 plus 7 pagination/marker cases. |
| `apps/web/tests/chat-state-boundary.test.ts` | **VERIFIED** | Static portable-core dependency guard. |
| `apps/web/tests/chat-state-fixtures.test.ts` | **VERIFIED** | Imports `@fish/core/chat-state`, validates case names/schema, and checks expected reducer/selector results. |
| `apps/web/app/(authenticated)/chat/chat-state.ts` | **VERIFIED** | Compatibility shim re-exports portable selectors. |
| `apps/web/app/(authenticated)/chat/hooks/use-chat-*.ts` | **VERIFIED WITH GAPS** | Focused hook boundaries exist. Composer failure handling, realtime lifecycle refs, and duplicate read-state dispatch need remediation. |
| `apps/web/app/(authenticated)/chat/store/chat-store.ts` | **BLOCKED** | Reducer-backed and conversation-keyed, but lacks production user/session lifecycle isolation. |
| `apps/web/app/(authenticated)/chat/store/chat-selectors.ts` | **VERIFIED** | Narrow conversation-scoped selectors with stable fallbacks. |
| `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` | **VERIFIED WITH COVERAGE GAP** | Covers allowed state/actions and selector behavior; does not cover soft logout/login between accounts. |
| `packages/core/docs/chat-state-protocol.md` | **VERIFIED** | Canonical human-readable protocol aligned with executable types/vectors. |
| `.planning/phases/09-cross-platform-chat-state/09-NATIVE-CHAT-STATE-NOTES.md` | **VERIFIED** | Canonical Android/iOS architecture companion aligned to all current events and vectors. |

## Key-Link and Data-Flow Verification

| From | To | Via | Status |
|---|---|---|---|
| `packages/core/package.json` | core chat-state index | `./chat-state` export | **WIRED** |
| web `chat-state.ts` | `@fish/core/chat-state` | compatibility re-export | **WIRED** |
| fixture test | JSON vectors + core reducer | replay and selector comparison | **WIRED** |
| web store | portable reducer | `reduceChatState` for every transition | **WIRED** |
| hooks | store | narrow selectors and reducer-backed actions | **WIRED** |
| `ChatClient` | hooks/selectors | server hydration, realtime merge, composer coordination | **WIRED** |
| protocol | vectors/native notes | canonical ownership and event mapping | **WIRED** |
| auth logout | module-global chat store | clear/namespace user-local state | **NOT WIRED — BLOCKER** |
| reducer failure restoration | composer UI | preserve restored or newer draft | **BROKEN — hook clears after failure** |
| community row grouping | avatar + `MessageMeta` | sender/time/day grouping predicate | **BROKEN — sender id only** |

The normal message flow is substantive: server data hydrates `hydrateWindow`,
Zustand stores the conversation slice, realtime callbacks dispatch
`mergeRemoteMessage`, and `ChatClient` renders selector output. The two-session
evidence confirms that this path delivered both synthetic messages exactly
once without receiver refresh. The unavailable transport capture does not
justify an auth, route, realtime, store, or rendering root-cause claim.

## Automated and Live Evidence

| Check | Result |
|---|---|
| Committed focused suite at `HEAD` in an isolated temporary worktree | **PASS — 5 files, 74 tests**: store, `ChatClient`, compatibility helpers, boundary, and fixture replay. The temporary worktree was removed afterward. |
| Required integration gates | **PASS** — supplied closeout evidence reports `pnpm build`, `pnpm lint`, and `pnpm typecheck` green. |
| Full web suite | **447/448 passed**. The sole failure is the explicitly excluded uncommitted pagination test at `chat-client.test.tsx:1290`; it is not attributed to Phase 09. |
| Live authenticated behavior | **Functional delivery failure not reproduced** — two coach-to-client sends rendered once without refresh, including after fresh receiver restoration; duplicates `0`, no unexpected scroll/layout shift. |
| Transport evidence | **INCONCLUSIVE** — raw WebSocket frames, callback status transitions, and sender HTTP status were not exposed. `root_cause` remains not established. |
| Schema drift | **CLEAR** — supplied schema-drift check reports no drift. |
| Working-tree isolation | **PRESERVED** — committed `HEAD` versions were used for dirty `chat-client.test.tsx` and `use-chat-messages.ts`; `.planning/config.json` was ignored. |

## Code Review Finding Disposition

| Finding | Requirement impact | Verification disposition |
|---|---|---|
| **CR-01 cross-account store leakage** | CSTATE-03, CSTATE-06 | **BLOCKER.** The module-global store survives the app's soft `router.push("/login")` logout path, has no production clear caller, and is keyed only by conversation id. |
| **WR-01 failure hook clears restored/newer draft** | CSTATE-06 | **BLOCKER.** Contradicts the portable protocol and the no-lost-draft requirement. |
| **WR-02 avatar/time suppressed indefinitely** | CSTATE-06 / D-09 presentation preservation | **BLOCKER FOR CURRENT UAT.** Directly matches the user's observed missing avatar/time. It is separate from realtime delivery. |
| WR-03 offline copy promises automatic queueing | CSTATE-06 UX accuracy | **WARNING.** No queue exists; copy must not promise automatic send. |
| WR-04 40px hover-only message actions | Project UI rules / CSTATE-06 | **WARNING.** Violates the non-negotiable 56px interaction floor and hurts touch discoverability. |
| WR-05 stale realtime lifecycle/ref state | CSTATE-06 resilience | **WARNING.** Can mislabel a fresh mount as reconnecting and carry reconnect refs across conversations. |
| WR-06 duplicate read-state dispatch | Adapter correctness/clarity | **WARNING, not independently goal-blocking.** Redundant store work obscures the canonical transition path. |
| IN-01 stale read-state replacement | Portable selector contract | **INFO DEBT.** A late older row may temporarily regress delivered/read status; add monotonic fixture rules. |

## Requirement Traceability

Every Phase 09 requirement in `.planning/REQUIREMENTS.md` is present in plan
frontmatter and accounted for:

| Requirement | Owning plans | Final status |
|---|---|---|
| CSTATE-01 | 09-01 | VERIFIED |
| CSTATE-02 | 09-02 | PARTIAL |
| CSTATE-03 | 09-03 | PARTIAL / BLOCKED |
| CSTATE-04 | 09-01, 09-04, 09-06 | VERIFIED |
| CSTATE-05 | 09-04, 09-06 | VERIFIED |
| CSTATE-06 | 09-01, 09-02, 09-03, 09-05 | FAILED |

No CSTATE requirement is orphaned from plan frontmatter. The checked status in
`REQUIREMENTS.md` and completed status in `ROADMAP.md` are ahead of the current
verification result and should not be treated as evidence of achievement.

## Security Audit Debt

`.planning/config.json` has `security_enforcement: true` and
`security_block_on: "high"`, but Phase 09 has no `09-SECURITY.md`. This report
does not fabricate a security sign-off. CR-01 is a concrete cross-account
information-disclosure risk and must be fixed or explicitly security-reviewed
before Phase 09 can pass.

## Gaps to Close

1. **Isolate volatile store state by authenticated user.** Clear the chat store
   on sign-out/session transition or namespace local composer/pending state by
   user plus conversation. Add a regression test using the same soft
   logout/login lifecycle as production.
2. **Make failure recovery atomic and draft-safe.** Preserve a newer draft if
   the user typed while a send was pending; otherwise restore the failed body.
   Remove the unconditional post-failure clear and align component tests with
   the portable protocol.
3. **Fix community grouping metadata.** Use one predicate requiring same
   sender, same calendar day, and a documented short time gap. Test within the
   cutoff, outside it, and across a day divider so avatar/time reappear.
4. **Resolve Phase 09 route-scope drift.** Either restore the one assigned
   conversation at `/chat`, or explicitly supersede CSTATE-02/CSTATE-06 and
   Phase 09 D-09 in planning/requirements before claiming them complete.
5. **Correct related UX warnings.** Replace offline auto-send copy, restore
   56px/touch-discoverable message actions, reset realtime lifecycle state per
   mount/conversation, and dispatch each realtime read payload once.
6. **Keep transport diagnosis conservative.** No delivery fix is indicated by
   the available evidence. Capture raw WS/status/HTTP boundaries only if a
   transport-level conclusion is still required.
7. **Perform the missing Phase 09 security review** after CR-01 is remediated.

## Final Decision

**Status: `gaps_found`.** The architectural foundation is real and well tested,
but the phase goal is not safely achieved at current `HEAD`. Re-run Phase 09
verification after CR-01, WR-01, and WR-02 are fixed and the `/chat` scope is
reconciled with the active requirements.

---

_Verifier: gsd-verifier_
_Verified against committed HEAD `dd7631789d376e7f4e4b670e8c75c73e7b297bed`._
