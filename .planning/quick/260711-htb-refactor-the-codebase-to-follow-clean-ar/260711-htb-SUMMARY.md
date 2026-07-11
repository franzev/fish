---
quick_id: 260711-htb
status: complete
completed: 2026-07-11
source_commits:
  - 022e5eaa28e6340f3e19c3f0d60df881159e6884
  - 773e00b7331aad408d39d3ca246ff7b1b0cac588
  - 436e7da11002669eaa722e30b520081eae3e99b2
---

# Quick Task 260711-htb Summary

Refactored the web application around FISH-owned ports, provider-neutral DTOs,
explicit runtime composition, and Supabase adapters while preserving routes,
UI, product behavior, database behavior, and public action/component contracts.

## Completed work

- Added application-owned auth, repository, command-transport, and chat
  realtime contracts in `apps/web/lib/services/contracts.ts`.
- Added browser and server composition roots that select concrete adapters and
  accept focused structural overrides for tests.
- Migrated OAuth callback, email token confirmation, auth guards, session
  observation, page loaders, profile actions, and role resolution away from
  raw clients and generated/provider types.
- Moved chat database queries, RPC payloads, Edge Function URL/header/timeout
  mechanics, access credentials, realtime channel setup, payload conversion,
  auth-before-subscribe behavior, broadcasts, presence writes, and cleanup into
  `apps/web/lib/services/supabase/`.
- Exposed provider-neutral feature APIs for chat commands and realtime while
  preserving bounded pagination, fallback, reconnect, optimistic merge,
  reaction, read-state, typing, recording, and presence behavior.
- Removed public `services.client`, storage/channel pass-throughs, provider
  types from application contracts, and the legacy `apps/web/lib/supabase`
  raw-client compatibility directory.
- Expanded the service boundary test to production `.ts` and `.tsx`, with an
  explicit adapter/composition allow-list, and documented dependency direction
  and testing strategy in `docs/ARCHITECTURE.md`.
- Preserved all pre-existing and concurrent dirty work outside this task; no
  unrelated paths were staged or committed.

## Validation

- `pnpm --filter @fish/web test -- --run` — 61 files, 514 tests passed.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed across all workspaces.
- `pnpm build` — passed; Next.js production build and route surface completed.
- `pnpm --filter @fish/web e2e` — 2 Playwright tests passed against local Supabase.
- `pnpm verify:rls` — all assertions passed.
- `pnpm verify:chat-realtime` — passed all checks. Two initial runs exposed
  different local realtime 10-second timing flakes; an unchanged third run
  passed presence, sends, ordering, commands, and reconnect backfill fully.
- `git diff --check` — passed.
- Production-source enforcement and repository searches found provider SDKs,
  generated rows, raw queries/RPCs/channels, and low-level client factories
  only inside `apps/web/lib/services/supabase/` and composition roots.

## Source commits

- `022e5eaa` — `refactor(260711-htb): invert application service boundaries`
- `773e00b7` — `refactor(260711-htb): inject chat realtime and command ports`
- `436e7da1` — `refactor(260711-htb): enforce infrastructure boundary`
