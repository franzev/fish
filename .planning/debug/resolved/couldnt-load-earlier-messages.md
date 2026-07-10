---
status: resolved
trigger: "User reported verbatim: \"Couldn't load earlier messages. Try again.... all that effort and wasted tokens, and it's not working properly\" — live app, after Phase 09 gap-closure round 4"
created: 2026-07-10T10:40:00Z
updated: 2026-07-10T12:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "loadOlderMessagesAction rejects the cursor because chatCursorInputSchema.createdAt uses z.iso.datetime() (Zod 4), which only accepts a 'Z' suffix. The cursor's createdAt originates from PostgREST/supabase-js, which serialises timestamptz with a '+00:00' offset — Zod rejects it, safeParse fails, the action returns { status: notice }, and the UI shows 'Couldn't load earlier messages.'"
  confirming_evidence:
    - "DB to_json(created_at) returns \"2026-07-10T02:18:36.332408+00:00\" (offset, not Z)."
    - "Zod 4.4.3 z.iso.datetime() FAILS \"...+00:00\" but PASSES \"...Z\" (reproduced in isolated script)."
    - "z.iso.datetime({ offset: true }) PASSES the offset format."
    - "toClientChatMessage passes row.created_at raw (actions.ts:149) — no normalisation, so every cursor carries offset format."
    - "loadNewest produces oldestCursor from windowRows[0].created_at (raw offset) — the exact value later re-validated by the failing schema."
  falsification_test: "If loadOlderMessagesAction is called live with the offset-format cursor and the schema were to parse successfully, the hypothesis is wrong. It does not (Zod rejects offset)."
  fix_rationale: "Allow the offset format in the two cursor/timestamp schemas that receive DB timestamps (createdAt line 53, afterCreatedAt line 65) via z.iso.datetime({ offset: true }). Addresses root cause: schema/serialization format mismatch, not a symptom."
  blind_spots: "Whether a second latent path (backfill) is also hit live; whether any consumer depends on Z-only cursors downstream (query uses string equality/lt against DB, so offset is correct)."
next_action: apply { offset: true } to both z.iso.datetime cursor schemas, then run full verification gate

## Symptoms

expected: |
  In the community room at /channels/general, scrolling to the top (or pressing
  the "Load earlier messages" control) loads the previous keyset page (40
  messages, Phase 10 contract) and prepends it with reading position preserved.
actual: |
  The calm failure affordance "Couldn't load earlier messages. Try again."
  appears instead; older messages do not load. Retry does not appear to
  recover. User reads this as the feature not working at all.
errors: |
  UI notice only, captured verbatim: "Couldn't load earlier messages. Try again."
  Server-side/console/network errors NOT yet captured — first evidence to gather.
timeline: |
  Reported 2026-07-10, immediately after Phase 09 gap-closure round 4
  (plans 09-13..09-18, HEAD ~557c7031). NOTE: this failure notice UI only
  EXISTS because rounds 09-12/09-16 added it — the earlier UAT complaint
  ("loading earlier messages breaks the app") was an unbounded silent retry
  storm, closed in .planning/debug/loading-earlier-messages-retry-storm.md
  (status: diagnosed) by 09-12. Unknown whether the underlying load ever
  succeeded live; the storm may have been masking a genuine request failure
  the whole time (the storm root-cause analysis explicitly noted
  loadOlderMessagesAction failures were swallowed).
reproduction: |
  Open the seeded community room /channels/general (long-form history seeded
  via scripts/seed.ts → pnpm seed), scroll up or press the load-earlier
  control. Live-only: all 493 jsdom tests pass (they mock
  loadOlderMessagesAction); pnpm build/lint/typecheck clean.

## Investigation Context (data, verified paths)

- Request path: apps/web/app/(authenticated)/chat/hooks/use-load-older-messages.ts
  (sentinel/button → single wrapped callback) → use-chat-messages.ts
  loadOlderMessages (per-conversation Set lock + requestConversationId capture,
  changed in 09-15) → loadOlderMessagesAction (server action, direct Supabase
  select added in Phase 10 plan 10-02; keyset window 40+1, RLS-protected read)
  → portable reducer olderPageLoaded/olderPageLoadFailed (packages/core).
- Candidate live-only causes to test (unranked): keyset cursor query failing on
  seeded data (e.g. tie-breaking on identical created_at from bulk seed);
  RLS policy on community conversation membership blocking the direct select
  for the signed-in role; server-action parameter/shape mismatch introduced by
  09-15's refactor that mocks hide; error path in loadOlderMessagesAction
  returning failure on a non-error (e.g. empty page mis-classified).
- Environment facts: dev origin MUST be localhost:3001 (host-scoped cookies;
  next dev -p 3001 + Supabase site_url). Local Supabase via `pnpm supabase:start`,
  seed via `pnpm seed`. Seeded users: Franz Eva (client), Patty Cake (coach);
  general channel conversation id 22222222-2222-4222-8222-222222222222 is used
  by e2e/chat-send.spec.ts.
- Live reproduction IS in scope for this session (the bug only manifests live).
  Prefer CLI-observable evidence: direct node/Supabase queries against the
  local DB, invoking the server action's underlying query logic in a script,
  Playwright headless with console/network capture — over interactive
  browser sessions.

## Evidence

- timestamp: 2026-07-10T11:50:00Z
  checked: chatCursorInputSchema (actions.ts:52-55) + loadOlderMessagesSchema (57-61)
  found: cursor.createdAt validated by z.iso.datetime(); safeParse failure returns { status: notice } → the exact UI notice reported.
  implication: any malformed/format-mismatched createdAt in the cursor produces the reported failure with no server error logged.
- timestamp: 2026-07-10T11:52:00Z
  checked: Zod 4.4.3 z.iso.datetime() against Postgres-style timestamps (isolated node script)
  found: FAILS "2026-07-10T10:40:00+00:00" and "...332408+00:00"; PASSES only "Z" suffix. z.iso.datetime({ offset: true }) PASSES offset format.
  implication: offset-format timestamps are silently rejected by the cursor schema.
- timestamp: 2026-07-10T11:55:00Z
  checked: local DB message row via to_json(created_at)
  found: PostgREST/supabase-js serialises created_at as "2026-07-10T02:18:36.332408+00:00" (offset, microseconds).
  implication: every cursor createdAt in the live app carries the offset format Zod rejects — reproduces live, not in jsdom (action mocked).
- timestamp: 2026-07-10T11:57:00Z
  checked: toClientChatMessage (actions.ts:149) + loadNewest oldestCursor (771) + backfill afterCreatedAt (65)
  found: createdAt is never normalised to Z; oldestCursor and afterCreatedAt both carry raw offset strings; afterCreatedAt uses the same z.iso.datetime() → same latent bug.
  implication: fix both schemas (lines 53 and 65).

## Eliminated

## Resolution

root_cause: |
  Format mismatch between Postgres/PostgREST timestamp serialization and Zod 4
  validation. supabase-js returns messages.created_at as an offset-form ISO
  string ("2026-07-10T02:18:36.332408+00:00"). The keyset cursor built from
  that value is re-validated on the way into loadOlderMessagesAction by
  chatCursorInputSchema.createdAt = z.iso.datetime(), which in Zod 4 accepts
  only a "Z" suffix and rejects any numeric offset. safeParse fails, the action
  returns { status: "notice", notice: sendNotice }, and the UI shows
  "Couldn't load earlier messages. Try again." The bug is live-only because
  jsdom tests mock loadOlderMessagesAction, and the first-page load produces
  (never validates) the cursor. backfillMessagesSchema.afterCreatedAt shares
  the identical defect.
fix: |
  Accept the offset format in both DB-timestamp schemas:
  chatCursorInputSchema.createdAt and backfillMessagesSchema.afterCreatedAt
  now use z.iso.datetime({ offset: true }).
verification: |
  - New regression test feeds the exact PostgREST offset format
    ("2026-07-05T00:05:00.000000+00:00") into loadOlderMessagesAction and
    backfillMessagesAction; both now reach the query (fromMock called) and
    return status "sent". Before the fix these would have returned "notice".
  - Full gate green: pnpm --filter @fish/web test (495 passed, was 493 +2 new),
    pnpm typecheck, pnpm lint, pnpm build all clean.
  - Root-cause format proven live: local DB to_json(created_at) =
    "...+00:00"; Zod 4 z.iso.datetime() rejects it, { offset: true } accepts it.
  - CONFIRMED by user live at /channels/general (2026-07-10): scrolling to
    top prepends older messages; no failure notice.
files_changed:
  - apps/web/app/(authenticated)/chat/actions.ts
  - apps/web/app/(authenticated)/chat/actions.test.ts
