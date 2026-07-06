---
quick_id: 260706-rsd
slug: remove-stale-color-language-and-re
status: complete
created: 2026-07-06
---

# Quick Task 260706-rsd: Remove stale color language and remove onboarding/tracker features

## Goal

Remove stale design-token references to old color UI language and remove the unfinished onboarding and tracker features from the active product implementation.

## Tasks

1. Remove onboarding/tracker runtime surfaces.
   - Delete client routes, actions, feature components, feature validation, feature E2E coverage, the tracker Edge Function, and feature seed logic.
   - Remove onboarding/tracker sections from coach/client screens.

2. Remove onboarding/tracker service and schema contracts.
   - Drop repository interfaces/implementations, feature DTOs, DB type aliases, generated schema entries, feature migrations, and RLS verifier checks.
   - Keep profile, chat, coach-client, and shared UI contracts intact.

3. Scrub stale old color wording from active docs/source.
   - Update AGENTS/docs/source comments/tests so the active design language is monochrome primary inversion and semantic notice/result tones, not old color tokens.
   - Leave historical `.planning` phase archives intact unless they affect active code or current state.

## Verification

- `rg` for active old color-token leftovers.
- `rg` for active onboarding/tracker runtime leftovers outside historical planning archives.
- `pnpm --filter @fish/web test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm verify:rls`
- `pnpm build`
