# Deferred Items — Phase 09 (cross-platform-chat-state)

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary rule (fix only what the current task's changes directly caused).

## 2026-07-10 — during 09-10 execution

**STATE.md progress-percentage tooling appears to undercount outstanding plans**

- `gsd-sdk query state.update-progress` reported `19 total / 19 completed = 100%` immediately after 09-10-SUMMARY.md was committed, even though `09-11-PLAN.md` exists in this phase directory with no matching `09-11-SUMMARY.md` (confirmed via `ls`: 11 PLAN files, 10 SUMMARY files in `.planning/phases/09-cross-platform-chat-state/`).
- The `## Current Position` body field ("Plan: X of 11") had also drifted independently: it read "4 of 11" before this execution, despite 9 plans (09-01 through 09-09) already having summaries at that point. This was corrected directly to "10 of 11" via `gsd-sdk query state.update Plan "10 of 11"` as part of 09-10's close-out, since it's an unambiguous, directly-observable fact about this plan's own completion.
- The aggregate percentage/count (`state.update-progress`, backed by `getMilestonePhaseFilter` + `extractCurrentMilestone` in the SDK) was left as reported by the standard tool rather than hand-patched, since diagnosing its milestone-section-parsing logic against this project's `ROADMAP.md` structure is outside the scope of a single plan's execution and risks introducing a second, uncoordinated correction.
- **Suggested follow-up:** before the next `/gsd-execute-phase 09` or a milestone-completion check, verify `state.update-progress`'s milestone-phase filter actually includes phase 9 (its ROADMAP.md heading `### Phase 9: Cross-platform Chat State` matches the expected pattern, so the discrepancy likely lives in `extractCurrentMilestone`'s milestone-section slicing, not the phase-heading regex itself), and reconcile the reported percentage against the real 10/11-plans-complete state once 09-11 executes.
