---
quick_id: 260704-kfb
status: planned
created: 2026-07-04
---

# Quick Task 260704-kfb Plan

Design and implement a production-ready service abstraction architecture for the web app while preserving the current Supabase helper API used by existing pages.

## Tasks

1. Map the current Supabase/auth helper boundaries and tests so the new layer can be introduced without broad page churn.
2. Add failing tests for environment validation, centralized service errors, repository helpers, service factories, and the public Supabase compatibility helpers.
3. Implement typed environment validation, shared service error/result contracts, Supabase repository/service interfaces, browser/server/proxy factories, and test doubles.
4. Refactor `apps/web/lib/supabase/{client,server,proxy}.ts` into adapters over the new service layer while keeping exported `createClient()` and `updateSession()` stable.
5. Run focused tests first, then web typecheck/lint/build and root build.
6. Create `260704-kfb-SUMMARY.md`, update `.planning/STATE.md`, and commit only this quick-task's files.
