---
phase: quick
plan: 260710-jht
subsystem: dev-tooling
tags: [seed-data, supabase, local-dev]
requires: []
provides:
  - "Seed script identities: client1 'Franz Eva', coach 'Patty Cake'"
  - "Local Supabase profiles + auth.users metadata renamed for the two accounts"
affects: [scripts/seed.ts, scripts/verify-rls.ts, local Supabase database]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - scripts/seed.ts
    - scripts/verify-rls.ts
decisions:
  - "verify-rls.ts DB-04 safe-field check now writes 'Franz Eva' so verify:rls runs no longer revert the DB rename"
  - "Existing local DB rows renamed via targeted SQL (docker exec into supabase_db_fish) because upsertUser is get-or-create and re-seeding would not rename"
metrics:
  duration: 4min
  tasks: 2
  completed: 2026-07-10
---

# Quick Task 260710-jht: Update Seed Data Names Summary

Renamed seeded dev identities — client1@fish.dev "Alex Rivera" → "Franz Eva" and coach@fish.dev "Coach Dana" → "Patty Cake" — in scripts/seed.ts, in the verify-rls.ts DB-04 write value, and in the already-seeded local Supabase records (public.profiles + auth.users metadata).

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Update names in seed.ts and the verify-rls write value | a4a554a4 |
| 2 | Rename existing local Supabase records | (database only — no repo files) |

## What Changed

- `scripts/seed.ts`: coach displayName → "Patty Cake"; client1 displayName → "Franz Eva"; `seedCommunityStressMessages` participant label "Coach Dana" → "Patty Cake" (cosmetic label, not inserted into DB).
- `scripts/verify-rls.ts`: DB-04 safe-field update now writes `display_name: "Franz Eva"` — previously it rewrote "Alex Rivera" into the live DB on every `verify:rls` run, which would have undone the rename.
- Local Supabase (running stack, container `supabase_db_fish`): updated `public.profiles.display_name` and `auth.users.raw_user_meta_data->>'display_name'` for both accounts (4 rows, 1 each). Verified post-update:
  - `client1@fish.dev=Franz Eva` (profiles and auth.users)
  - `coach@fish.dev=Patty Cake` (profiles and auth.users)
- Out of scope, untouched per plan: test fixtures (`*.test.ts(x)` inline names), message bodies mentioning "Alex", `clientIds.alex` key, `seed-dm-*` ids, coach2 and all other accounts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `psql` not installed on host — used docker exec instead**
- **Found during:** Task 2
- **Issue:** Plan's `psql "<db-url>"` command failed (`command not found: psql`)
- **Fix:** Ran the identical SQL via `docker exec -i supabase_db_fish psql -U postgres -d postgres`
- **Files modified:** none (database only)
- **Commit:** n/a

## Verification

- `grep -rn "Alex Rivera\|Coach Dana" scripts/` → no matches
- Only scripts/seed.ts and scripts/verify-rls.ts committed; no test files modified
- Both profiles rows and both auth.users metadata values confirmed via SQL select

## Self-Check: PASSED

- scripts/seed.ts exists and contains "Franz Eva" / "Patty Cake": FOUND
- scripts/verify-rls.ts contains "Franz Eva": FOUND
- Commit a4a554a4: FOUND in git log
- DB rows verified: FOUND (all four values match)
