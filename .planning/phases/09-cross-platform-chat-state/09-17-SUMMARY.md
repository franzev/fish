---
phase: 09-cross-platform-chat-state
plan: 17
subsystem: testing
tags: [playwright, e2e, chat, community-feed, dedup, gap-closure]

# Dependency graph
requires:
  - phase: 09-cross-platform-chat-state
    provides: "Send path + chat-store semantics from 09-13 (portable contract hardening), 09-14 (identity-bound chat store), and 09-15 (pagination race guards) — the current source of truth this smoke exercises."
provides:
  - "A community send-lifecycle E2E that can actually pass on the shipped community surface: exact-count send + reload-persistence proof, no .last(), no incompatible per-message status-image assertion."
affects: [09-UAT, HV-04, 09-VERIFICATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "E2E lifecycle proofs for feed-style surfaces use reload + toHaveCount(1) exact-match assertions, never .last() (which can mask a duplicate) and never a per-item status assertion the surface does not render."

key-files:
  created: []
  modified:
    - apps/web/e2e/chat-send.spec.ts

key-decisions:
  - "Reaffirmed the plan's design-aligned decision: prove the community send lifecycle by reload-persistence + exact-count rather than adding per-message Sent/Delivered/Read status UI to the community feed (would introduce competing visual noise against the calm, one-thing feed idiom)."

patterns-established:
  - "Community/feed E2E specs assert exact row counts (toHaveCount(1)) before and after page.reload() to prove both send success and persistence/dedup, instead of a single post-send visibility check."

requirements-completed: [CSTATE-06]

coverage:
  - id: D1
    description: "Community send smoke rewritten to prove send + persistence + dedup with exactly one row (WR-08 closed structurally); status-image assertion incompatible with the community feed removed; .last() removed so a duplicate can never be masked."
    requirement: "CSTATE-06"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/chat-send.spec.ts#client sends a message and it persists as exactly one row after reload (playwright test --list discovery)"
        status: pass
      - kind: other
        ref: "grep gates: toHaveCount(1) x2, page.reload() present between them, .last( absent, Sent|Delivered|Read absent, failure-copy count-0 assertions retained"
        status: pass
    human_judgment: true
    rationale: "This plan proves the spec is structurally correct (compiles, discovers, uses the right assertions, drops the incompatible ones) via static/list-mode checks only. The actual green run against seeded Supabase is HV-04, a separate human/live-environment verification step already tracked in the Phase 09 UAT flow (STATE.md: 'Outstanding: manual UAT for Phase 9') — this environment has no running dev server/seeded Supabase to execute the spec end-to-end, per the plan's own execution_context and this plan's project_notes."

# Metrics
duration: 5min
completed: 2026-07-10
status: complete
---

# Phase 09 Plan 17: Community Send Smoke Reload-Persistence Rewrite Summary

**Rewrote the community chat-send Playwright smoke to prove send + reload-persistence + dedup via exact-count assertions, removing the `.last()` selector and the per-message Sent/Delivered/Read status-image assertion the community feed does not render (WR-08).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-10T09:13:00Z
- **Completed:** 2026-07-10T09:17:54Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `apps/web/e2e/chat-send.spec.ts` now asserts the sent message exists as exactly one `li` row (`toHaveCount(1)`) immediately after send, never via `.last()`.
- Added a `page.reload()` step followed by a second `toHaveCount(1)` assertion, proving the message durably persisted through Supabase (not just optimistically rendered) and that no duplicate exists after realtime/reload reconciliation.
- Removed the `getByRole("img", { name: /Sent|Delivered|Read/ })` assertion, which was statically incompatible with the community feed (it intentionally does not render per-message read ticks — calm, one-thing, feed idiom).
- Kept the existing failure-copy count-0 assertions ("Not sent yet", "That did not send yet. Keep this open and try again.") unchanged.
- Retitled the test to describe the actual proof: "client sends a message and it persists as exactly one row after reload".

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the community send smoke as reload-persistence + exact-count** - `4a013f7b` (fix)

**Plan metadata:** (this commit) `docs(09-17): complete community send smoke plan`

## Files Created/Modified
- `apps/web/e2e/chat-send.spec.ts` - Community send E2E: login → navigate → send → exact-count (no `.last()`) → no-failure-copy checks → `page.reload()` → exact-count again for persistence/dedup proof. No status-image assertion.

## Decisions Made
None beyond the plan's own design-aligned decision (reload-persistence + exact-count over adding per-message status UI to the feed), which this plan implemented as written — no new decisions required during execution.

## Deviations from Plan

None - plan executed exactly as written. (During the task's own acceptance-criteria verification loop, an early draft of the explanatory comment used the literal substring `.last()` to describe what was *not* used, which would have failed the plan's `grep -q "last("` gate; this was caught and reworded — "a newest-row-only match" — before the task was committed. Not logged as a deviation since it never left the pre-commit verification loop and required no reinterpretation of the plan.)

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-08 is closed structurally: the spec is now semantically valid against the shipped community surface (`.last()` gone, incompatible status-image assertion gone, exact-count + reload-persistence proof in place). `playwright test e2e/chat-send.spec.ts --list` discovers the single test cleanly; `pnpm build`/`typecheck`/`lint` all pass.
- HV-04 (running this spec against seeded Supabase for a real green pass) remains outstanding and is tracked as part of the broader Phase 09 UAT flow (`09-UAT.md`) — this environment had no running dev server/seeded Supabase to execute it live, consistent with this plan's own execution_context.
- Two more gap-closure plans in this wave are not yet executed: `09-16-PLAN.md` (WR-06 conversation-scoped realtime transient reset + WR-07 invariant pagination geometry + WR-02/WR-03 web regressions, no SUMMARY yet) and `09-18-PLAN.md` (WR-09: 56px shell logo target + stale `/chat` comment cleanup, no SUMMARY yet). Neither blocks this plan (`depends_on: []`) nor is blocked by it.

## Self-Check: PASSED

- FOUND: apps/web/e2e/chat-send.spec.ts
- FOUND: 4a013f7b (task 1 commit)
- FOUND: .planning/phases/09-cross-platform-chat-state/09-17-SUMMARY.md

---
*Phase: 09-cross-platform-chat-state*
*Completed: 2026-07-10*
