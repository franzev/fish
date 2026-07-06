---
status: complete
phase: 06-tracker-engine
source:
  - 06-01-SUMMARY.md
  - 06-02-SUMMARY.md
  - 06-03-SUMMARY.md
started: 2026-07-06T00:15:59Z
updated: 2026-07-06T00:15:59Z
---

# Phase 6 - UAT

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Local Supabase migrations apply from scratch, seed creates tracker fixtures, RLS verification passes, and the web app builds.
result: pass
evidence: `pnpm db:reset`, `pnpm seed`, `pnpm verify:rls`, and `pnpm build` passed.

### 2. Assigned Client Opens Tracker
expected: A client with an active assignment sees one assigned tracker, not a tracker picker or gallery, and the view has one `Save entry` primary action.
result: pass
evidence: `/tracker` route, `TrackerClientFlow`, `TrackerEntryFlow`, home CTA, focused Vitest coverage, and build/typecheck passed.

### 3. Draft Is Private and Preserved Until Save
expected: Field changes are draft-saved quietly, restored into the entry flow, hidden from coaches and other clients, and deleted when the matching saved entry is committed.
result: pass
evidence: `saveTrackerDraftAction`, `tracker_entry_drafts` RLS, and `pnpm verify:rls` draft privacy / commit cleanup assertions passed.

### 4. Milestone Journey Is Reward-Only
expected: Progress renders done/now/up-next steps with coach-authored labels and current-step fill, without score, grade, visible percent, adherence, or streak language.
result: pass
evidence: `get_tracker_progress`, `get_coach_tracker_progress`, `MilestoneProgress`, focused tests, and forbidden-term scans passed.

### 5. Coach Reads Saved Entries Only
expected: An assigned coach sees a read-only reverse-chronological timeline of saved entries, while unassigned coaches and other clients do not see another client's tracker data.
result: pass
evidence: `CoachTrackerReview`, coach client page integration, shared answer formatter, and `pnpm verify:rls` assigned/unassigned/cross-client assertions passed.

### 6. Assignment Command Is Server-Derived
expected: `assign-tracker` accepts only `clientId`, verifies the caller, checks coach-client membership with `coach_id = caller.id`, derives the active version server-side, and writes through the service-role client only after authorization.
result: pass
evidence: `supabase/functions/assign-tracker/index.ts` source review and `supabase/config.toml` registration.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[]
