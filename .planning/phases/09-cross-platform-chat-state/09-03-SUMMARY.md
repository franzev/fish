---
phase: 09-cross-platform-chat-state
plan: 03
subsystem: web-chat
tags: [chat-state, zustand, react-hooks, selectors, vitest]

requires:
  - phase: 09-cross-platform-chat-state
    provides: Portable `@fish/core/chat-state` reducer and fixtures from Plan 09-01
  - phase: 09-cross-platform-chat-state
    provides: Focused web chat hooks from Plan 09-02
  - phase: 09-cross-platform-chat-state
    provides: Platform-neutral protocol docs from Plan 09-04
provides:
  - Web-only Zustand chat adapter keyed by `conversationId`
  - Narrow chat store selectors for messages, composer, read states, and realtime status
  - Store-backed chat hooks and `ChatClient` wiring that preserves the assigned conversation UI
affects: [09-cross-platform-chat-state, web-chat, native-chat-contract]

tech-stack:
  added: [zustand@5.0.14]
  patterns:
    - "Zustand vanilla store actions dispatch portable `@fish/core/chat-state` events"
    - "React components subscribe through narrow `conversationId` selectors"
    - "Server actions and Supabase realtime remain authority inputs outside the store"

key-files:
  created:
    - apps/web/app/(authenticated)/chat/store/chat-store.ts
    - apps/web/app/(authenticated)/chat/store/chat-selectors.ts
    - apps/web/app/(authenticated)/chat/store/chat-store.test.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts
    - apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts
    - apps/web/app/(authenticated)/chat/chat-client.tsx
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx

key-decisions:
  - "Zustand is installed only in `apps/web` and acts as a browser coordination/cache adapter, not a portable chat brain."
  - "The store exposes reducer-backed actions and keeps auth/session truth, role permission decisions, assignment logic, Supabase clients, service-role data, and durable persistence outside local state."
  - "The visible chat route remains one assigned conversation with the same send/retry/realtime behavior and no new client choice surface."

patterns-established:
  - "Use `createChatStore` for isolated tests and `chatStore`/`useChatStore` for the singleton web adapter."
  - "Selector helpers accept `conversationId` and return narrow slices; components avoid whole-store subscription."
  - "Component tests reset `resetChatStoreForTests()` to avoid singleton leakage."

requirements-completed: [CSTATE-03, CSTATE-06]

duration: 12min
completed: 2026-07-07
---

# Phase 09 Plan 03: Web Zustand Chat Adapter Summary

**Web chat now uses a conversation-keyed Zustand adapter over the portable reducer while preserving the assigned one-conversation UI.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-07T00:17:08Z
- **Completed:** 2026-07-07T00:28:41Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added `zustand@5.0.14` only to `apps/web` through pnpm and updated the lockfile.
- Created `chat-store.ts` with vanilla Zustand actions that dispatch `ChatEvent` values into `reduceChatState`.
- Created `chat-selectors.ts` with narrow selectors for conversation state, messages, composer, read states, and realtime status.
- Added store tests covering allowed state, authority-boundary exclusions, hydrate/send/confirm/fail/read-state behavior, draft/reply/edit/realtime fields, clear behavior, and selector narrowing.
- Wired message, read-state, realtime, and composer hooks to the store while keeping server actions and Supabase realtime callbacks as authority inputs.
- Updated `ChatClient` to subscribe through narrow selectors and reset the singleton store in component tests.

## Task Commits

Each task was committed atomically. TDD tasks include RED and GREEN commits:

1. **Task 1: Add the web-only Zustand dependency** - `c7a13ebc` (chore)
2. **Task 2 RED: Store adapter boundary and behavior tests** - `a3c61db0` (test)
3. **Task 2 GREEN: Reducer-backed store and selectors** - `fa4004ef` (feat)
4. **Task 3 RED: ChatClient and hook store-wiring tests** - `d11da845` (test)
5. **Task 3 GREEN: Hook and ChatClient store wiring** - `7509f891` (feat)

## Files Created/Modified

- `apps/web/package.json` - Adds `zustand` to web dependencies only.
- `pnpm-lock.yaml` - Locks `zustand@5.0.14` under the web importer.
- `apps/web/app/(authenticated)/chat/store/chat-store.ts` - Vanilla Zustand store and reducer-backed chat actions.
- `apps/web/app/(authenticated)/chat/store/chat-selectors.ts` - Conversation-scoped selectors for narrow subscriptions.
- `apps/web/app/(authenticated)/chat/store/chat-store.test.ts` - Store behavior, selector, and authority-boundary tests.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` - Hydrates and merges messages through store events.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-read-state.ts` - Reads and merges read state through the store.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-realtime.ts` - Dispatches realtime message/read-state events and connection status.
- `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts` - Stores draft, reply/edit targets, optimistic send, confirm, and failure state through store actions.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` - Uses narrow selectors while preserving existing UI behavior.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Adds store reset and source-boundary assertions.

## Decisions Made

- Kept the store browser-only and web-only; native parity remains the JSON event/result protocol, not Zustand.
- Kept server actions, Edge Functions, RLS, and Supabase realtime as authority boundaries. The store only coordinates local cache/UI state.
- Preserved the existing client-facing chat contract: no conversation picker, no assignment controls, no extra primary action, no new menu surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used package-relative Vitest paths under `pnpm --filter @fish/web test`**
- **Found during:** Task 2 and Task 3 verification
- **Issue:** The plan's literal root-relative paths (`apps/web/...`) are not valid when Vitest runs from `apps/web`.
- **Fix:** Ran the equivalent package-relative paths (`app/...`, `tests/...`) for focused verification.
- **Files modified:** None.
- **Verification:** Focused chat/store commands passed.
- **Committed in:** N/A

**2. [Rule 1 - Bug] Fixed lint violations found after store wiring**
- **Found during:** Task 3 plan-level verification
- **Issue:** Lint caught a render-time ref write, a conditional hook wrapper, and unused variables.
- **Fix:** Removed the render-time ref by dispatching refreshed read states directly, made `useChatStore` a non-conditional selector hook, removed unused imports, and used delete-based conversation clearing.
- **Files modified:** `chat-client.tsx`, `use-chat-messages.ts`, `use-chat-realtime.ts`, `chat-store.ts`
- **Verification:** `pnpm lint`, focused tests, full web tests, `pnpm typecheck`, and `pnpm build` passed.
- **Committed in:** `7509f891` (amended into Task 3 GREEN)

---

**Total deviations:** 2 auto-fixed (1 blocking verification issue, 1 lint/bug fix).
**Impact on plan:** Both fixes preserved the planned behavior and authority boundaries. No product scope was expanded.

## Issues Encountered

- The first full release chain failed at `pnpm lint`; the violations were fixed and the full chain was rerun successfully.
- One standalone `pnpm --filter @fish/web typecheck` attempt raced with a parallel `next build` regenerating `.next/types`; rerunning typecheck after build completed passed.

## Authentication Gates

None.

## Known Stubs

- `apps/web/app/(authenticated)/chat/hooks/use-chat-composer.ts` contains the existing optional-action fallback copy `"That action is not available yet."` for unavailable delete support. It does not block this plan because the store wiring preserves the existing route behavior and does not introduce a new user choice surface.

## Verification

- `pnpm --filter @fish/web list zustand` - passed; reported `zustand@5.0.14` under `@fish/web`.
- `pnpm --filter @fish/web typecheck` - passed after Task 1 and after final build regeneration.
- `pnpm build` - passed before task commits and at final release verification.
- `pnpm --filter @fish/web test app/\(authenticated\)/chat/store/chat-store.test.ts tests/chat-state-boundary.test.ts` - RED failed before implementation, then passed after Task 2 GREEN.
- `pnpm --filter @fish/web test app/\(authenticated\)/chat/chat-client.test.tsx` - RED failed on store-wiring assertions before implementation, then passed after Task 3 GREEN.
- `pnpm --filter @fish/web test app/\(authenticated\)/chat/store/chat-store.test.ts app/\(authenticated\)/chat/chat-client.test.tsx app/\(authenticated\)/chat/chat-state.test.ts tests/chat-state-boundary.test.ts tests/chat-state-fixtures.test.ts` - passed, 45 tests.
- `pnpm --filter @fish/web test` - passed, 49 files / 369 tests.
- `pnpm typecheck` - passed.
- `pnpm lint` - passed after lint fixes.
- `pnpm build` - passed.
- Optional `pnpm --filter @fish/web e2e apps/web/e2e/chat-send.spec.ts` - not run because `supabase status` reported stopped local services including Edge runtime; local Supabase was not fully available.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. This plan added a browser-local store and tests only; no new network endpoints, auth paths, file access patterns, schema changes, service-role access, or trust-boundary writes were introduced.

## Next Phase Readiness

Phase 09 now has all planned requirements satisfied: portable core, hook extraction, web Zustand adapter, protocol docs, native notes, and release gates. The remaining work is phase verification/UAT and milestone closeout.

## Self-Check: PASSED

- Created store files found on disk: `chat-store.ts`, `chat-selectors.ts`, `chat-store.test.ts`.
- Task commits found: `c7a13ebc`, `a3c61db0`, `fa4004ef`, `d11da845`, `7509f891`.
- No accidental tracked-file deletions were detected in task commits.
- Stub scan found one existing optional-action fallback, documented above as non-blocking.
- Threat scan found no new trust-boundary surface.
- Working tree after task commits contains only the pre-existing untracked `.planning/research/.cache/` directory.

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-07*
