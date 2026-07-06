---
quick_id: 260706-rsd
slug: remove-stale-color-language-and-re
status: complete
completed: 2026-07-06
commit: f099a9e
---

# Quick Task 260706-rsd Summary

## Outcome

Removed the unfinished onboarding and tracker implementations from the active product surface and scrubbed stale old-color wording from code, active guidance, and historical planning text.

## What Changed

- Removed onboarding routes, actions, components, field renderer contracts, feature E2E coverage, core field contracts, migrations, seed data, generated Supabase schema entries, and RLS verification checks.
- Removed tracker service/schema/runtime contracts, the assignment Edge Function, seed data, generated Supabase schema entries, and RLS verification checks.
- Removed client-home and coach-client-detail entry points for the removed flows.
- Re-scoped current planning docs to the active foundation: client profiles plus real 1-on-1 chat.
- Updated AGENTS and UI guidance so future work does not reintroduce the removed color language or the removed build-order items.

## Tombstoned Files

macOS refused to delete several already-tracked tracker/validation files because of `com.apple.provenance` (`Operation not permitted`). Those files were reduced to inert tombstones:

- non-test modules export nothing;
- test modules are skipped tombstone suites so Vitest can run;
- `/tracker/page.tsx` calls `notFound()`.

## Verification

- `rg` old color terms across repo content: clean
- `rg` removed feature runtime terms across active app/package/script/supabase content: clean
- `pnpm --filter @fish/web test`: 289 passed, 5 skipped tombstone suites
- `pnpm lint`: pass
- `pnpm typecheck`: pass
- `pnpm verify:rls`: pass
- `pnpm build`: pass
