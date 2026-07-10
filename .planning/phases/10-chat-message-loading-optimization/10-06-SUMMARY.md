---
phase: 10-chat-message-loading-optimization
plan: 06
subsystem: chat
tags: [react, zustand, supabase, reconnect, pagination, reactions, rls]

requires:
  - phase: 10-chat-message-loading-optimization
    provides: bounded message windows, cursor pagination, reconnect backfill, and Zustand hydration
provides:
  - Authoritative server-confirmed reconnect cursor selection
  - Bounded newest-window recovery for empty or client-only transcripts
  - Retained-message-id-scoped SSR reaction enrichment in 25-id batches
affects: [phase-10-reverification, chat-reconnect, chat-ssr-performance]

tech-stack:
  added: []
  patterns:
    - Reconnect cursors derive only from server-confirmed sent messages
    - Initial reaction enrichment batches only retained message ids

key-files:
  created: []
  modified:
    - apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts
    - apps/web/app/(authenticated)/chat/chat-client.test.tsx
    - apps/web/lib/services/supabase/core.ts
    - apps/web/lib/services/supabase/core.test.ts

key-decisions:
  - "Reuse one bounded newest-window hydration helper for both no-confirmed-row recovery and oversized-gap resets."
  - "Keep reaction authorization conversation-scoped under caller-session RLS while narrowing each read to at most 25 retained message ids."

patterns-established:
  - "Authoritative reconnect marker: scan newest-to-oldest and accept only localStatus === sent."
  - "Bounded enrichment: derive side-query ids after trimming the N+1 message window."

requirements-completed: [CLOAD-01, CLOAD-06]

duration: 5 min
completed: 2026-07-10
---

# Phase 10 Plan 06: Reconnect and Reaction Boundary Summary

**Reconnect recovery now uses only server-confirmed cursors, while initial SSR reaction reads are bounded to the retained newest 40-message window.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-10T23:05:39Z
- **Completed:** 2026-07-10T23:10:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Reconnect backfill scans backward past pending, sending, and failed rows to the newest `sent` message.
- Empty or entirely client-only transcripts recover through the bounded newest-window action and preserve its read/pagination metadata.
- SSR reaction enrichment queries only the retained 40 message ids in 25-id batches, with 1000-row pagination preserved per batch.
- Exact-input regressions cover first-connect suppression, empty recovery, optimistic tails, excluded N+1 reactions, and empty-window query skipping.

## TDD Execution

- **RED (Task 1):** Added reconnect regressions that failed because an empty transcript did not hydrate and a failed optimistic tail was sent as the backfill cursor.
- **GREEN (Task 1):** Added server-confirmed backward cursor selection and shared bounded newest-window hydration; 61 focused chat-client tests pass.
- **RED (Task 2):** Extended the 41-message boundary regression to record query inputs; it failed because reaction reads had no retained-id batching.
- **GREEN (Task 2):** Added 25-id-scoped reaction reads and empty-window short-circuiting; 11 focused service tests pass.
- **REFACTOR:** No separate refactor was needed; the green implementations use small shared control-flow helpers and existing contracts.

## Task Commits

Each TDD task was committed as a failing regression followed by its passing implementation:

1. **Task 1 RED: reconnect cursor regressions** - `5992b05f` (test)
2. **Task 1 GREEN: authoritative reconnect recovery** - `8a5c7edf` (fix)
3. **Task 2 RED: retained-reaction query boundary** - `d425340c` (test)
4. **Task 2 GREEN: bounded initial reaction enrichment** - `d6f3bed1` (perf)

## Files Created/Modified

- `apps/web/app/(authenticated)/chat/hooks/use-chat-messages.ts` - Selects the newest confirmed cursor and hydrates a bounded newest window when none exists.
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` - Proves exact reconnect action inputs and bounded empty-transcript hydration.
- `apps/web/lib/services/supabase/core.ts` - Batches retained message ids into conversation-scoped reaction queries.
- `apps/web/lib/services/supabase/core.test.ts` - Records exact reaction filters and locks the excluded 41st-message boundary.

## Decisions Made

- Reused the existing `hydrateWindow` argument shape through a local helper so no-confirmed recovery and `needsReset` cannot diverge.
- Kept `conversation_id` filtering alongside `message_id` batches; message ids narrow work but do not replace RLS authorization.
- Derived reaction ids from `messages` only after the N+1 window is trimmed and reversed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- Focused chat-client tests: **61/61 passed**.
- Focused Supabase service tests: **11/11 passed**.
- Full chat test directory: **121/121 passed across 7 files**.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- Security/source review: no high-severity STRIDE/ASVS L1 finding; reads remain direct caller-session Supabase selects scoped by conversation and retained message ids, with no schema or privileged-service change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-01/CLOAD-06 and WR-02/CLOAD-01 are closed at source and regression-test level.
- Phase 10 is ready for re-verification and the existing HV-01 perceptual scroll/skeleton check.

## Self-Check: PASSED

- All four planned files exist and all four 10-06 task commits are present.
- All task acceptance criteria and plan-level automated verification gates pass.
- No schema, dependency, Edge Function, environment, or visible UI contract changed.

---
*Phase: 10-chat-message-loading-optimization*
*Completed: 2026-07-10*
