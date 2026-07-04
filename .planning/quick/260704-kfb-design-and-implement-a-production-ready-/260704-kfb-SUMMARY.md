---
quick_id: 260704-kfb
status: complete
completed: 2026-07-04
commit: 3c1ec95
---

# Quick Task 260704-kfb Summary

Implemented a production-ready service abstraction architecture for the web app.

## Completed

- Added typed environment validation for public Supabase configuration with centralized configuration errors.
- Added shared `ServiceError`, `ServiceResult`, and Supabase error normalization contracts.
- Added an immutable service container for dependency injection and future third-party services.
- Added cohesive Supabase service interfaces and factories for auth, database repositories, storage, realtime, browser clients, server clients, and proxy session refresh.
- Kept existing `apps/web/lib/supabase/{client,server,proxy}.ts` exports stable as compatibility adapters over the new service layer.
- Added test doubles and focused tests for env validation, error handling, service factories, repositories, and compatibility helpers.
- Updated ESLint config to ignore generated `storybook-static/**` output so the project lint command checks source files.

## Verification

- `pnpm --filter @fish/web exec vitest run lib/services/env.test.ts lib/services/errors.test.ts lib/services/supabase/core.test.ts lib/supabase/client.test.ts lib/supabase/server.test.ts`
- `pnpm --filter @fish/web exec vitest run`
- `pnpm --filter @fish/web typecheck`
- `pnpm --filter @fish/web lint`
- `pnpm --filter @fish/web build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

## Notes

- The worktree already contained unrelated Android, UI kit, and quick-task state changes. This task did not revert or stage those changes.
- The new factories validate Supabase environment lazily at client/service construction time, not at module import time, so tests, Storybook, and builds do not fail unless a service is actually constructed without required config.
