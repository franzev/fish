---
phase: quick
plan: 260710-jht
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/seed.ts
  - scripts/verify-rls.ts
autonomous: true
requirements: [QUICK-SEED-RENAME]
must_haves:
  truths:
    - "scripts/seed.ts seeds client1@fish.dev with display name 'Franz Eva' and coach@fish.dev with display name 'Patty Cake'"
    - "Local Supabase profiles rows for client1@fish.dev and coach@fish.dev show the new names"
    - "Running scripts/verify-rls.ts no longer reverts client1's display name to 'Alex Rivera'"
  artifacts:
    - path: "scripts/seed.ts"
      provides: "Updated seed display names"
      contains: "Franz Eva"
  key_links:
    - from: "scripts/verify-rls.ts"
      to: "public.profiles.display_name"
      via: "safe-field update check (writes the display name into the DB)"
      pattern: "update\\(\\{ display_name"
---

<objective>
Rename two seeded identities: client "Alex Rivera" → "Franz Eva" and coach "Coach Dana" → "Patty Cake", in the seed script AND in the already-seeded local Supabase records.

Purpose: dev environment shows the user's preferred display names.
Output: updated scripts/seed.ts, updated scripts/verify-rls.ts write value, updated rows in local `public.profiles` and `auth.users` metadata.
</objective>

<execution_context>
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/workflows/execute-plan.md
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/templates/summary.md
</execution_context>

<context>
@scripts/seed.ts
@scripts/verify-rls.ts

Scope decisions (already investigated during planning — do not re-derive):

1. **Test files are OUT OF SCOPE.** Every `*.test.tsx` / `*.test.ts` match for "Alex Rivera" / "Coach Dana" passes the name as a direct prop or mock fixture (e.g. `<AppShell displayName="Alex Rivera">`). They never read seed data at runtime. Do NOT edit any test file.

2. **verify-rls.ts IS in scope for exactly one value.** Line ~132 performs `.update({ display_name: "Alex Rivera" })` against the live local DB as its DB-04 safe-field-update check. If left unchanged, the next `verify:rls` run would rewrite client1's DB record back to "Alex Rivera", undoing this task's database change. Change only that written value to "Franz Eva". No other occurrence in that file writes to the DB.

3. **Re-running the seed will NOT rename existing records.** `upsertUser()` in seed.ts returns the existing user id without updating `user_metadata` when the email already exists. Therefore the local DB must be updated with targeted SQL, not by re-running `pnpm seed`.

4. **Message bodies stay unchanged.** Seeded chat content mentions "Alex" conversationally ("Hi everyone, I'm Alex", "That's wonderful news, Alex!"). The user asked to change display names only — leave message bodies, the `clientIds.alex` object key, and `seed-dm-*` request ids alone.

Where display names live in the DB:
- `public.profiles.display_name` (what the app reads; has an `email` column for matching)
- `auth.users.raw_user_meta_data->>'display_name'` (source copied by the `handle_new_user` trigger at signup; update for consistency)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update names in seed.ts and the verify-rls write value</name>
  <files>scripts/seed.ts, scripts/verify-rls.ts</files>
  <action>
In scripts/seed.ts:
- `coach.displayName`: "Coach Dana" → "Patty Cake" (line ~28)
- clients array, client1@fish.dev entry: displayName "Alex Rivera" → "Franz Eva" (line ~41)
- `seedCommunityStressMessages` participants array: label `name: "Coach Dana"` → `name: "Patty Cake"` (line ~653; cosmetic label kept consistent — the field is not inserted into the DB)

In scripts/verify-rls.ts:
- The DB-04 safe-field update check (line ~132): `.update({ display_name: "Alex Rivera" })` → `.update({ display_name: "Franz Eva" })`. This value is WRITTEN into the live DB on every verify:rls run; leaving it would revert Task 2's database change. Do not touch anything else in the file.

Do NOT edit any `*.test.ts` / `*.test.tsx` files — those names are independent inline fixtures.
  </action>
  <verify>
    <automated>grep -c "Franz Eva" scripts/seed.ts && grep -c "Patty Cake" scripts/seed.ts && grep -c "Franz Eva" scripts/verify-rls.ts && ! grep -q "Alex Rivera\|Coach Dana" scripts/seed.ts && ! grep -q "Alex Rivera" scripts/verify-rls.ts</automated>
  </verify>
  <done>seed.ts contains "Franz Eva" and "Patty Cake" with zero remaining "Alex Rivera"/"Coach Dana" occurrences; verify-rls.ts writes "Franz Eva"; no test files modified (git status shows only the two script files changed).</done>
</task>

<task type="auto">
  <name>Task 2: Rename the existing local Supabase records</name>
  <files>(no repo files — local database only)</files>
  <action>
Re-running the seed will not rename existing users (upsertUser is get-or-create), so apply targeted SQL against the local Supabase Postgres.

1. Confirm the local stack is running and get the DB URL: `supabase status` (default local URL is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`). If the stack is not running, start it with `supabase start` first.

2. Run this SQL (via `psql "<db-url>"`):

   update public.profiles set display_name = 'Franz Eva'  where email = 'client1@fish.dev';
   update public.profiles set display_name = 'Patty Cake' where email = 'coach@fish.dev';
   update auth.users set raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{display_name}', '"Franz Eva"')  where email = 'client1@fish.dev';
   update auth.users set raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{display_name}', '"Patty Cake"') where email = 'coach@fish.dev';

   Both `public.profiles` (what the app reads) and `auth.users` metadata (the signup-time source) are updated so they stay consistent. Only these two accounts change — coach2, other clients, community extras, and reaction stress users are untouched.
  </action>
  <verify>
    <automated>psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -tAc "select email || '=' || display_name from public.profiles where email in ('client1@fish.dev','coach@fish.dev') order by email" | grep -q "client1@fish.dev=Franz Eva" && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -tAc "select display_name from public.profiles where email='coach@fish.dev'" | grep -q "Patty Cake"</automated>
  </verify>
  <done>Local `public.profiles` shows display_name 'Franz Eva' for client1@fish.dev and 'Patty Cake' for coach@fish.dev; `auth.users.raw_user_meta_data->>'display_name'` matches for both accounts.</done>
</task>

</tasks>

<verification>
- `grep -rn "Alex Rivera\|Coach Dana" scripts/` returns nothing.
- `git status` shows only scripts/seed.ts and scripts/verify-rls.ts modified (no test files).
- profiles + auth.users rows for the two accounts carry the new names in the local Supabase instance.
</verification>

<success_criteria>
- Seed script seeds "Franz Eva" (client1) and "Patty Cake" (coach) on fresh resets.
- Existing local DB records already reflect the new names without a db reset.
- verify:rls no longer reverts the client display name.
- No test fixtures touched; test suite unaffected.
</success_criteria>

<output>
Create `.planning/quick/260710-jht-update-seed-data-names-change-alex-river/260710-jht-SUMMARY.md` when done.
</output>
