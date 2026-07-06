---
phase: 06-tracker-engine
plan: 01
status: complete
completed: 2026-07-06
requirements: [TRAK-01, TRAK-03, TRAK-04, TRAK-05, XC-01, XC-02]
---

# Phase 6.01 Summary - Tracker Data Foundation

## Delivered

- Added `supabase/migrations/0009_tracker.sql` with tracker configs, published config versions, tracker fields, assignments, saved entries, private entry drafts, and assignment-owned milestones.
- Added RPC-only write paths for `save_tracker_draft` and `save_tracker_entry`; the server derives the client, active assignment, current period, version pin, and field snapshot.
- Added RLS for tracker assignments, entries, drafts, and milestones. Draft rows are client-only; assigned coaches can read saved entries and assignment progress, but never drafts.
- Added progress RPCs: `get_tracker_progress()` for clients and `get_coach_tracker_progress(p_client_id)` for assigned coaches. They return server-derived step rows with `done`, `now`, and `up_next` states plus current-step fill, not a score or visible fraction.
- Added app validation in `apps/web/lib/validation/tracker.ts`, generated Supabase types, and exported tracker row aliases including `TrackerEntryDraftRow`.
- Updated `scripts/seed.ts` so the seed creates one active tracker config, neutral fields, and a seeded assignment. Milestones are created by assignment/progress triggers rather than version-scoped template rows.
- Extended `scripts/verify-rls.ts` for tracker entry save, draft privacy, draft commit cleanup, malformed config/answer rejection, assignment-scoped progress, coach progress, and denial paths.

## Deviations

- The original plan text referenced version-scoped milestone step configuration. The approved discussion context made milestones assignment-owned so a coach can extend a client's journey over time without republishing tracker versions. The migration and repository follow the assignment-owned model.
- Draft persistence uses a separate `tracker_entry_drafts` table instead of a `status` column on saved entries. This keeps coach-visible saved entries and client-private drafts cleanly separated.

## Verification

- `pnpm db:reset` passed after applying migrations through `0010_chat.sql`.
- `pnpm seed` passed with tracker config, active assignment, fields, and assignment milestones.
- `pnpm verify:rls` passed, including draft privacy and commit cleanup assertions.
- `pnpm --filter @fish/supabase typecheck` passed.
- `pnpm --filter @fish/web typecheck` passed.

## Threat Flags

- No open threat flags. Tracker writes are RPC-gated, malformed configs/answers are rejected by app and DB validation, drafts are hidden from coaches by RLS, and progress has no score/streak/adherence data model.
