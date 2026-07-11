---
phase: 09
slug: cross-platform-chat-state
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 for unit/component tests; Playwright 1.61.1 for chat send smoke |
| **Config file** | `apps/web/vitest.config.ts`; `apps/web/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/chat-state.test.ts apps/web/app/\\(authenticated\\)/chat/chat-client.test.tsx` |
| **Full suite command** | `pnpm --filter @fish/web test && pnpm typecheck && pnpm lint && pnpm build` |
| **Estimated runtime** | ~180 seconds for full suite, excluding Supabase-backed Playwright setup |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/chat-state.test.ts apps/web/app/\\(authenticated\\)/chat/chat-client.test.tsx`
- **After every plan wave:** Run `pnpm --filter @fish/web test && pnpm typecheck && pnpm lint`
- **Before `$gsd-verify-work`:** Run `pnpm build`, `pnpm lint`, `pnpm typecheck`, focused chat tests, and the browser chat-send smoke if Supabase is available
- **Max feedback latency:** 180 seconds for automated local feedback before widening to browser/Supabase checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-W0-01 | TBD | 0 | CSTATE-01 | T-09-01 | Portable core does not import React, Next.js, Zustand, Supabase clients, app aliases, browser globals, Swift, or Kotlin | static/unit | `pnpm --filter @fish/web test apps/web/tests/chat-state-boundary.test.ts` | No - Wave 0 creates it | pending |
| 09-W0-02 | TBD | 0 | CSTATE-04 | T-09-02 | JSON fixtures contain initial state, events, expected state/result, and replay through the portable reducer | unit/fixture | `pnpm --filter @fish/web test apps/web/tests/chat-state-fixtures.test.ts` | No - Wave 0 creates it | pending |
| 09-W0-03 | TBD | 0 | CSTATE-03 | T-09-03 | Web store excludes auth/session truth, role permission decisions, assignment logic, Supabase clients, and service-role data | unit/static | `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/store/chat-store.test.ts` | No - Wave 0 creates it | pending |
| 09-W1-01 | TBD | 1 | CSTATE-01, CSTATE-04 | T-09-02 | Merge, unread, outgoing status, deleted snippet, and reply preview behavior match existing tests and fixtures | unit | `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/chat-state.test.ts apps/web/tests/chat-state-fixtures.test.ts` | Partial | pending |
| 09-W1-02 | TBD | 1 | CSTATE-02, CSTATE-06 | T-09-04 | Hook extraction preserves assigned one-conversation UI, optimistic send, failed retry, typing, presence, edit/delete/reaction, and calm notice behavior | component | `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/chat-client.test.tsx` | Yes | pending |
| 09-W2-01 | TBD | 2 | CSTATE-03, CSTATE-06 | T-09-01, T-09-04 | Zustand coordinates web state by `conversationId` without becoming authorization or persistence authority | unit/component | `pnpm --filter @fish/web test apps/web/app/\\(authenticated\\)/chat/store/chat-store.test.ts apps/web/app/\\(authenticated\\)/chat/chat-client.test.tsx` | No - Wave 0 creates store test | pending |
| 09-W2-02 | TBD | 2 | CSTATE-05 | T-09-05 | Native notes map events to Android `ViewModel` + `StateFlow` and iOS observable model without modifying native production chat flows | static/docs | `rg -n "ViewModel|StateFlow|Observable|ChatEvent" .planning/phases/09-cross-platform-chat-state packages/core` | No - Wave 0 creates docs | pending |
| 09-GATE | TBD | final | CSTATE-01..06 | T-09-01..05 | Existing chat behavior and repo release gates remain green | full suite | `pnpm build && pnpm lint && pnpm typecheck` | Yes | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/chat-state/index.ts` — portable public exports for reducer, selectors, types, and fixture helpers
- [ ] `packages/core/src/chat-state/types.ts` — portable chat state/event/result types
- [ ] `packages/core/src/chat-state/reducer.ts` — deterministic event transitions for hydration, optimistic send, confirmation, failure, remote merge, and read-state merge
- [ ] `packages/core/src/chat-state/selectors.ts` — unread count, outgoing status, snippet, reply preview, and stable ordering helpers
- [ ] `packages/core/src/chat-state/fixtures/*.json` — cross-platform event/result vectors for CSTATE-04
- [ ] `apps/web/tests/chat-state-boundary.test.ts` — static dependency-boundary guard for portable core imports
- [ ] `apps/web/tests/chat-state-fixtures.test.ts` — fixture replay test
- [ ] `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` — Zustand adapter constraints and selector behavior test
- [ ] Phase protocol/native notes document — Android `ViewModel` + `StateFlow`, iOS observable model mapping for CSTATE-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual calm remains unchanged after refactor | CSTATE-06 | This phase should not create a new UI surface, but human review can catch unexpected visual choice clutter or layout movement | Open `/chat` after implementation and confirm the screen still has one assigned conversation, one primary send action, calm notice copy, and no conversation picker/menu added |
| Native docs are understandable to future Kotlin/Swift implementers | CSTATE-05 | The phase intentionally stops at architecture notes; readability is not fully captured by static grep | Read the protocol/native notes and confirm they name the event contract, Android `ViewModel` + `StateFlow`, iOS observable model, and explicitly say native production chat implementation is out of scope |

---

## Threat Model References

| Ref | Threat | Mitigation Required |
|-----|--------|---------------------|
| T-09-01 | Zustand or portable state is treated as authorization, assignment, session, or persistence authority | Store tests/static checks prove forbidden fields and Supabase clients are absent; planner tasks keep server actions/RLS authoritative |
| T-09-02 | Cross-platform fixtures drift from web behavior | Fixture replay tests and existing `chat-state.test.ts` must both pass |
| T-09-03 | Portable core accidentally imports web-only dependencies | Boundary test rejects forbidden import patterns in `packages/core/src/chat-state` |
| T-09-04 | Refactor regresses optimistic-send, retry, no-lost-draft, or no-duplicate behavior | Existing `chat-client.test.tsx`, focused chat-state tests, and browser send smoke remain green |
| T-09-05 | Native scope expands into production implementation | Plan acceptance criteria and static docs check keep Android/iOS work to architecture notes only |

---

## Validation Sign-Off

- [x] All planned requirement areas have automated or manual verification routes
- [x] Sampling continuity: no 3 consecutive tasks should proceed without automated verify
- [x] Wave 0 covers missing test and fixture references
- [x] No watch-mode flags
- [x] Feedback latency target is below 180 seconds for focused local checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-07 for planning
