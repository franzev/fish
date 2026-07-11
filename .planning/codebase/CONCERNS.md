---
title: Codebase Concerns
mapped_at: 2026-07-11
last_mapped_commit: e25c937627b8f19251c791ed6878e6522f802959
scope: current working tree
---

# Codebase concerns

This document records current technical and operational concerns. “Verified” means the
condition is directly present in source or configuration; “Risk” means no failure has been
demonstrated, but the current design leaves a credible failure mode.

## Priority 1 — address before production scale

### Unbounded full-conversation recovery path

- **Status:** Verified performance issue.
- `supabase/functions/chat-command/index.ts` implements `refresh-conversation` with an
  ascending `messages` query that has no `limit`, cursor, or upper bound.
- `apps/web/lib/services/supabase/local-chat-commands.ts` implements the local fallback with
  the same unbounded query. `apps/web/features/chat/hooks/use-chat-messages.ts` explicitly
  describes this action as the deep fallback when bounded backfill is unavailable.
- The Edge Function then calls `enrichMessage` once per returned message; each call performs
  at least one additional reaction request. Recovery cost therefore grows with complete
  conversation history and can produce a large fan-out of PostgREST requests.
- The normal reconnect path uses bounded backfill/newest-window operations, which mitigates
  frequency but does not make this fallback safe. Retire the full refresh or give it the same
  bounded reset contract as `loadNewestMessages`.

### Hosted deployment remains a manual, unverified procedure

- **Status:** Verified operational gap.
- `docs/deploy-checklist.md` still contains an entirely unchecked first-deploy sequence for
  linking Supabase, pushing migrations, deploying both Edge Functions, configuring redirects,
  copying email templates, matching auth settings, and running hosted verification.
- The repository contains no `.github/workflows/` files and therefore provides no committed CI
  gate or automated deployment record. Local scripts are useful evidence only when a developer
  runs them.
- Until a staging/production run is recorded elsewhere, the repository cannot establish that
  hosted RLS, Realtime publication, JWT verification, OAuth, or email expiry matches
  `supabase/config.toml`.

## Priority 2 — reliability, security, and maintainability risks

### Database contract drift is not automatically detected

- **Status:** Verified tooling gap; drift is a risk.
- Generated schema types are committed in `packages/supabase/src/database.generated.ts`, while
  schema evolution lives in `supabase/migrations/`.
- Root `package.json` has no schema-generation or schema-diff command, and the build/typecheck
  scripts do not regenerate the file. A migration can therefore merge without proving the
  generated TypeScript contract was refreshed.
- Add a deterministic generation command and a clean-diff CI check after applying migrations.

### Edge command handlers have no direct automated test suite

- **Status:** Verified coverage gap.
- `supabase/functions/send-message/index.ts` and
  `supabase/functions/chat-command/index.ts` contain request validation, authentication calls,
  RPC dispatch, error mapping, and response enrichment, but there are no colocated Edge
  Function test files.
- Web tests exercise injected services and local Supabase-shaped stubs, while
  `scripts/verify-chat-realtime.ts` exercises a running stack. Neither provides small,
  deterministic branch coverage for malformed requests, unavailable auth, unexpected
  PostgREST payloads, and every command variant in the deployed Deno handlers.

### Command behavior is duplicated across hosted and local transports

- **Status:** Verified duplication; behavioral drift is a risk.
- Hosted behavior is implemented in `supabase/functions/send-message/index.ts` and
  `supabase/functions/chat-command/index.ts`; local fallback behavior is separately implemented
  in `apps/web/lib/services/supabase/local-chat-commands.ts` and selected by
  `apps/web/lib/services/supabase/chat-command-service.ts`.
- Validation, error-to-notice mapping, reaction enrichment, row mapping, pagination, and query
  choices exist in more than one form. For example, the Edge refresh enriches reactions per
  message, while the local path batches reaction lookups.
- This split is intentional for local Edge Function availability, but changes must be tested
  against both paths until shared command contracts or parity tests remove the drift risk.

### No application-level abuse controls on chat commands

- **Status:** Verified absence; abuse/exhaustion is a risk.
- Both Edge Functions require JWTs via `supabase/config.toml` and re-check the caller before
  invoking RLS-protected RPCs, which is the correct authorization baseline.
- Neither `supabase/functions/send-message/index.ts` nor
  `supabase/functions/chat-command/index.ts` implements per-user rate limiting, request budgets,
  or replay throttling. `clientRequestId` gives sends idempotency, but edit/reaction/read and
  refresh commands have no equivalent request budget.
- Before broad access, define expected message/reaction rates and enforce limits at a layer that
  cannot be bypassed by calling PostgREST/RPC endpoints directly.

### Realtime lifecycle code is a fragile integration hotspot

- **Status:** Risk supported by complexity, not a currently reproduced defect.
- `apps/web/lib/services/supabase/chat-realtime.ts` owns deferred auth, multiple channel types,
  connection callbacks, browser activity listeners, presence writes, a 25-second heartbeat,
  and teardown in one large adapter.
- `apps/web/features/chat/hooks/use-chat-realtime.ts` separately owns reconnect coalescing,
  conversation ownership, typing/recording timeouts, and cleanup. The large regression suite in
  `apps/web/features/chat/components/chat-client/chat-client.test.tsx` documents prior race-prone
  cases, but no direct adapter test drives actual channel status transitions and deferred
  unsubscribe timing.
- Keep lifecycle changes narrow and verify rapid mount/unmount, auth restoration, conversation
  switching, offline recovery, and timer/listener cleanup against a running local Supabase stack.

## Priority 3 — test and developer-experience debt

### End-to-end browser coverage is narrow and environment-coupled

- **Status:** Verified coverage limitation.
- `apps/web/e2e/` contains only `chat-send.spec.ts` and `login-spacing.spec.ts`.
- `apps/web/package.json` seeds Supabase before Playwright, and
  `apps/web/playwright.config.ts` targets installed Chrome with a local dev server. This is useful
  for the seeded happy path but does not cover signup confirmation, recovery, profile editing,
  coach/client authorization, reactions, read state, pagination, or reconnect behavior.
- Add a small staging-safe smoke suite before relying on browser automation as a release gate;
  keep destructive seed/reset commands explicitly isolated from hosted production.

### Large chat files concentrate change risk

- **Status:** Verified maintainability concern.
- `apps/web/lib/services/supabase/local-chat-commands.ts`,
  `apps/web/lib/services/supabase/chat-realtime.ts`,
  `apps/web/lib/services/supabase/chat-repository.ts`, and
  `apps/web/features/chat/components/chat-message-list/chat-message-list.tsx` each combine several
  responsibilities and are among the largest production modules.
- `apps/web/features/chat/components/chat-client/chat-client.test.tsx` is substantially larger
  than the implementation and covers many interaction regimes in a single suite. The coverage is
  valuable, but fixture setup and failures are expensive to navigate.
- Split by behavior only when making related changes; preserve public ports and avoid a purely
  cosmetic file shuffle.

## Security posture already present

- RLS and database RPC authorization are exercised by `scripts/verify-rls.ts`; Realtime behavior
  has a dedicated `scripts/verify-chat-realtime.ts` harness.
- Service-role credentials are confined to local administrative scripts and are not required by
  the production web runtime. `docs/deploy-checklist.md` explicitly warns against exposing or
  using the dev seed in production.
- Auth confirmation redirects in `apps/web/app/auth/confirm/route.ts` accept only same-origin
  relative paths and reject protocol-relative and backslash variants.
- Chat message links in
  `apps/web/features/chat/components/message-body/message-body.tsx` allow only HTTP, HTTPS, and
  mailto schemes and render content as React nodes rather than raw HTML.
- Provider SDK use and component/module layout are guarded by static suites under
  `apps/web/tests/`; these guardrails reduce architectural regression but do not replace runtime
  integration verification.

## Operational watch list

- Tailwind v4 package parity remains sensitive: keep `tailwindcss` and
  `@tailwindcss/postcss` aligned in `apps/web/package.json`.
- `scripts/seed.ts`, `scripts/verify-rls.ts`, and `scripts/verify-chat-realtime.ts` accept a
  service-role key and can mutate data. Use disposable local or staging projects only.
- The 24-hour auth OTP value in `supabase/config.toml`, both email templates, and hosted Auth
  configuration must change together; `docs/deploy-checklist.md` notes the hosted security-advisor
  trade-off.
- The committed quality commands are separate (`build`, `lint`, `typecheck`, Vitest, RLS, and
  Realtime verification). A release is not proven by `pnpm build` alone.
