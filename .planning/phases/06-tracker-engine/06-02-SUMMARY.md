---
phase: 06-tracker-engine
plan: 02
status: complete
completed: 2026-07-06
requirements: [TRAK-01, TRAK-03, TRAK-05, XC-03]
---

# Phase 6.02 Summary - Client Tracker Surface

## Delivered

- Added the `/tracker` authenticated route with wrong-door handling: signed-out users redirect to sign-in, coaches redirect to coach home, and clients without an assignment see a calm empty state.
- Added `TrackerRepository` and Supabase implementation for loading active assignments, fields, saved answers, draft answers, progress rows, validation fields, draft saves, entry saves, and coach review data.
- Added `saveTrackerDraftAction` and `saveTrackerEntryAction`; both re-check the current user, validate input with zod, validate the answer against the pinned field config, and call the repository.
- Added `TrackerClientFlow`, which merges saved answers with private drafts, quietly persists draft changes, preserves values on failed draft/save attempts, and uses the single `Save entry` action to commit saved entries.
- Added `TrackerEntryFlow` and `MilestoneProgress` using the shared `FieldRenderer`, `AutosaveStatus`, `Button`, `Card`, `Alert`, and `Progress` primitives. The surface has one primary action and no picker/gallery/template choice.
- Updated the client home page so assigned clients get a single calm `Open tracker` path.
- Added the real coach display name to milestone reassurance copy when present.

## Verification

- Focused Vitest run passed with tracker entry flow coverage.
- `pnpm --filter @fish/web typecheck` passed after the final UI/data-prop fix.
- `pnpm build`, `pnpm lint`, root `pnpm typecheck`, and `pnpm verify:rls` passed during release verification.

## Threat Flags

- No open threat flags. The client cannot choose or switch trackers, cannot supply assignment/client identity to tracker saves, and cannot expose draft content to coaches.
