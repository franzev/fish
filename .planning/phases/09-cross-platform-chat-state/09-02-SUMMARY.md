---
phase: 09-cross-platform-chat-state
plan: 02
subsystem: web-chat
tags: [chat-state, react-hooks, realtime, presence, composer]

requires:
  - phase: 09-cross-platform-chat-state
    provides: Portable `@fish/core/chat-state` helpers, reducer fixtures, and web compatibility shim from Plan 09-01
provides:
  - Focused local-state web chat hooks for messages, read state, realtime, presence, and composer commands
  - Slimmer `ChatClient` rendering shell preserving the one assigned conversation UI
  - Source-boundary tests proving hook delegation before Zustand is introduced
affects: [09-cross-platform-chat-state, web-chat, zustand-adapter, native-chat-contract]

tech-stack:
  added: []
  patterns:
    - "Route-local React hooks own focused chat state categories before shared web store migration"
    - "Hooks receive server actions, realtime callbacks, and state updaters as dependencies instead of becoming authority boundaries"
    - "Package-relative Vitest paths are required when running through `pnpm --filter @fish/web test`"

key-files:
  created:
    - apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-presence.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts
  modified:
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/CONVENTIONS.md

key-decisions:
  - "Plan 09-02 keeps all extracted hooks backed by React local state; no Zustand import is introduced before Plan 09-03."
  - "Composer and read-state hooks call existing server-action dependencies and do not decide membership, role permission, or persistence."
  - "Realtime/presence hooks stay web-specific and keep Supabase adapter usage outside `packages/core`."

patterns-established:
  - "TDD RED boundary tests assert `ChatClient` delegates to focused hooks before each extraction."
  - "Chat route hooks live in `apps/web/app/(authenticated)/chat/hooks/` and use named `useChat*` exports."

requirements-completed: [CSTATE-02, CSTATE-06]

duration: 12min
completed: 2026-07-06
---

# Phase 09 Plan 02: Web Chat Hook Extraction Summary

**The web chat route now delegates messages, read state, realtime, presence, and composer behavior to focused React local-state hooks without changing the assigned conversation UI.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-06T23:47:36Z
- **Completed:** 2026-07-06T23:59:04Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Extracted message hydration, merge, refresh-by-id, and refresh-conversation coordination into `useChatMessages`.
- Extracted read-state merging, unread derivation, participant/current read state, and mark-read effect into `useChatReadState`.
- Extracted message/read/reaction subscriptions plus typing and voice-recording broadcasts into `useChatRealtime`.
- Extracted presence session lifecycle, participant session merging, and presence label derivation into `useChatPresence`.
- Extracted draft, reply/edit targets, optimistic send/retry, edit/delete/reaction commands, notices, and Enter-to-send handling into `useChatComposer`.
- Kept `ChatClient` as the rendering shell with the same one assigned conversation, one send action, calm notices, and existing UI affordances.

## Task Commits

Each task was committed atomically with TDD RED and GREEN gates:

1. **Task 1 RED: Message/read-state hook boundary test** - `be5896fa` (test)
2. **Task 1 GREEN: Extract message and read-state hooks** - `9d6aa0fe` (feat)
3. **Task 2 RED: Realtime/presence hook boundary test** - `daf106b9` (test)
4. **Task 2 GREEN: Extract realtime and presence hooks** - `e574df02` (feat)
5. **Task 3 RED: Composer hook boundary test** - `123ddded` (test)
6. **Task 3 GREEN: Extract composer hook** - `b4059f2c` (feat)

## Files Created/Modified

- `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` - Local message normalization, merge helper, refresh-by-id, and refresh-conversation message coordination.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts` - Local read-state storage, merge helpers, unread count inputs, and mark-read effect.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` - Web realtime subscriptions for messages, read states, reactions, typing, and voice recording.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-presence.ts` - Web presence session lifecycle and participant presence status derivation.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts` - Draft, notice, reply/edit target, send/retry, edit/delete/reaction, and Enter-to-send behavior.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - Rendering shell wired to focused hooks.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Boundary assertions for hook extraction plus existing interaction coverage.
- `.planning/codebase/STRUCTURE.md` - Records route-local chat hooks under the authenticated chat route.
- `.planning/codebase/CONVENTIONS.md` - Records named route-local hook convention and dependency-injection pattern.

## Decisions Made

- Kept extracted hooks local-state backed per D-06; Zustand remains explicitly out of scope for this plan.
- Preserved server actions and Supabase/RLS as authority boundaries by passing action functions into hooks.
- Preserved Supabase browser realtime usage in web-only modules and kept `packages/core/src/chat-state` dependency-clean.
- Added static hook-boundary assertions to `chat-client.test.tsx` so future refactors do not collapse the hook separation before Plan 09-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used package-relative Vitest paths for `pnpm --filter @fish/web test`**
- **Found during:** Task 1 and plan-level verification
- **Issue:** The plan's literal root-relative test paths (`apps/web/...`) fail with "No test files found" because `pnpm --filter @fish/web test` executes Vitest from `apps/web`.
- **Fix:** Ran the literal commands to confirm the path blocker, then ran the equivalent package-relative commands (`app/...`, `tests/...`) for actual verification.
- **Files modified:** None.
- **Verification:** Package-relative focused chat tests, portable chat-state tests, and typecheck passed.
- **Committed in:** N/A

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** Verification semantics were preserved. No product scope or UI behavior was expanded.

## Issues Encountered

- Literal plan-level Vitest commands failed before loading tests due to package-filter working directory behavior. Corrected package-relative commands passed.

## Authentication Gates

None.

## Known Stubs

None. Stub scan found only existing fallback copy for unavailable optional chat commands and intentional `null` ref resets in local hook cleanup.

## Threat Flags

None. The plan introduced no new network endpoints, auth paths, file access patterns, schema changes, or trust-boundary writes. Hooks call existing server actions/realtime adapters and do not become authorization or persistence authorities.

## Verification

- `pnpm --filter @fish/web test apps/web/app/\(authenticated\)/chat/chat-client.test.tsx` - failed with `No test files found` due to package-filter path prefix.
- `pnpm --filter @fish/web test apps/web/app/\(authenticated\)/chat/chat-state.test.ts apps/web/tests/chat-state-boundary.test.ts apps/web/tests/chat-state-fixtures.test.ts` - failed with `No test files found` due to package-filter path prefix.
- `pnpm --filter @fish/web test app/\(authenticated\)/chat/chat-client.test.tsx` - passed, 20 tests.
- `pnpm --filter @fish/web test app/\(authenticated\)/chat/chat-state.test.ts tests/chat-state-boundary.test.ts tests/chat-state-fixtures.test.ts` - passed, 17 tests.
- `pnpm --filter @fish/web test app/\(authenticated\)/chat/chat-client.test.tsx tests/chat-state-boundary.test.ts` - passed, 20 tests.
- `pnpm --filter @fish/web typecheck` - passed.
- `pnpm build` - passed before every task commit.
- Source assertions: all five hook files export their `useChat*` hook; no Plan 09-02 hook imports `zustand`; `ChatClient` contains one `Button` and no `variant="primary"` duplication.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 09-03 can introduce the web-only Zustand adapter against clear hook boundaries. The chat route still presents the existing assigned conversation and all focused chat tests remain green.

## Self-Check: PASSED

- Created hook files found on disk.
- Modified `ChatClient` and `chat-client.test.tsx` found on disk.
- Task commits found: `be5896fa`, `9d6aa0fe`, `daf106b9`, `e574df02`, `123ddded`, `b4059f2c`.
- No accidental tracked-file deletions were detected across Plan 09-02 commits.
- Stub scan found no blocking placeholder UI/data stubs.
- Threat scan found no new trust-boundary surface.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-06*
