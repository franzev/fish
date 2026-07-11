---
quick_id: 260711-htb
status: planned
created: 2026-07-11
type: refactor
must_haves:
  truths:
    - "Routes, features, hooks, components, and use-case code depend only on FISH-owned ports and DTOs; Supabase SDK clients, generated rows, auth/session types, channels, query builders, RPC names, storage buckets, and Function URLs remain inside the Supabase adapter boundary"
    - "Auth routes and guards call an injected provider-neutral auth/profile API for code exchange, OTP verification, current identity, role resolution, session observation, and access-token needs without importing or constructing Supabase"
    - "Chat actions and realtime orchestration retain all current validation, bounded-read, optimistic reconciliation, fallback, reconnect, typing, recording, presence, read-state, and calm-notice behavior while infrastructure owns database, RPC, Edge Function, and realtime protocol mechanics"
    - "The application service registry exposes no raw client or provider-specific public type, concrete adapters are assembled only at browser/server/proxy composition roots, and focused ports can be replaced with small test doubles"
    - "Compatibility raw-client helpers and shallow client/channel/storage escape hatches are deleted after all callers migrate; provider-neutral storage/realtime ports are retained only if an actual application capability uses them"
    - "Automated boundary tests scan production .ts and .tsx and reject Supabase imports or raw-client access outside the designated adapter/infrastructure locations"
    - "All existing tests, lint, typecheck, and production build pass with no behavior, UI, route, schema, RLS, migration, or public product change"
  artifacts:
    - path: "apps/web/lib/services/contracts.ts"
      provides: "Provider-neutral application service ports and DTOs owned by the consuming layer"
    - path: "apps/web/lib/services/runtime/server.ts"
      provides: "Server composition root that assembles concrete infrastructure behind an AppServices interface"
    - path: "apps/web/lib/services/runtime/browser.ts"
      provides: "Browser composition root that assembles auth and chat realtime adapters behind application ports"
    - path: "apps/web/lib/services/supabase"
      provides: "The single web location for Supabase SDK imports, generated database types, query/RPC details, channels, and Edge Function transport"
    - path: "apps/web/tests/service-boundary.test.ts"
      provides: "Production TS and TSX enforcement for the provider boundary and removal of raw-client escape hatches"
  key_links:
    - from: "apps/web/app/auth and apps/web/features/auth"
      to: "apps/web/lib/services/contracts.ts"
      via: "injected AuthService and profile/role ports resolved by generic runtime composition"
    - from: "apps/web/features/chat/server"
      to: "apps/web/lib/services/contracts.ts"
      via: "chat command/query and Function invocation ports rather than services.client"
    - from: "apps/web/features/chat/model/realtime.ts"
      to: "apps/web/lib/services/contracts.ts"
      via: "provider-neutral subscriptions/controllers and app-owned events"
    - from: "apps/web/lib/services/runtime"
      to: "apps/web/lib/services/supabase"
      via: "the only application composition roots permitted to select concrete adapters"
---

# Quick Task 260711-htb Plan

Refactor FISH's existing service layer into a genuine clean-architecture boundary: application
code owns small capability-oriented interfaces, runtime composition injects implementations, and
Supabase is a replaceable infrastructure detail. This is an internal refactor only. Preserve every
route, redirect, action signature, rendered state, message ordering/window, auth/session outcome,
error notice, realtime transition, persistence behavior, RLS assumption, and existing export used
by product code.

## Fixed implementation constraints

- Keep Supabase as the deployed backend and keep the existing direct-read/RLS, Edge Function,
  command RPC, proxy cookie-refresh, and bounded chat recovery strategies. Clean architecture here
  means dependency direction and isolation, not adding a Node API, swapping providers, or creating
  generic repositories for hypothetical future features.
- Put interfaces in the consuming/application layer, not beside their Supabase implementations.
  Use FISH-owned `AuthUser`/session-event/chat/realtime DTOs and existing `ServiceResult`; do not
  expose `User`, `Session`, `AuthChangeEvent`, `RealtimeChannel`, generated database row aliases,
  `SupabaseClient`, query-builder return types, or `CookieOptions` through the public registry.
  Cookie/client types required to construct the SDK may remain private inside the adapter folder.
- Prefer focused ports (`AuthService`, profile repositories, chat query/command transport, chat
  realtime) over one catch-all provider facade. Keep current domain rules and mapping at the
  application boundary when provider-neutral; keep table names, RPC payloads, response-row parsing,
  access tokens, Function URL/header construction, channel topics/options, SDK payload conversion,
  and cleanup inside infrastructure.
- Dependency injection should be explicit at use-case/helper boundaries and default to the runtime
  composition root for production calls, so existing Next.js action/route/component entry points
  remain callable. Do not introduce a framework container, service locator global, or new package.
- `packages/core` stays framework/provider neutral. `packages/supabase` may continue owning generated
  database types for infrastructure and Supabase operational code, but web application/features may
  no longer import it directly. Do not edit migrations, generated types, Edge Function behavior,
  schema, policies, seed data, or UI.
- Preserve the current dirty worktree. At planning time these paths are user-owned and must not be
  restored, reformatted, staged, or committed unless an unavoidable boundary-test overlap is first
  isolated carefully: deleted
  `apps/web/features/chat/components/bubble/{bubble.tsx,index.ts}`; modified
  `apps/web/features/chat/components/chat-message-list.tsx`,
  `emoji-picker/emoji-picker.tsx`, `message-body/message-body.stories.tsx`,
  `message-presentation.ts`, `visual.ts`, and `apps/web/tests/module-boundaries.test.ts`; untracked
  `apps/web/components/ui/scroll-area/scroll-area.stories.tsx`. Use the clean
  `apps/web/tests/service-boundary.test.ts` for this task's enforcement and inspect status before
  every selective stage/commit.

## Tasks

### Task 1 — Invert the service boundary and migrate authentication

**Files:** `apps/web/lib/services/{contracts,index,testing,container}.ts`, new generic runtime
composition modules under `apps/web/lib/services/runtime/`, the internal adapter contracts/factories
under `apps/web/lib/services/supabase/`, `apps/web/features/auth/**`,
`apps/web/app/auth/{callback,confirm}/route.ts`, affected auth/service tests, and proxy composition.

**Action:** Extract the current application-facing auth, profile, client-profile, coach-client,
chat-data, and common DTO interfaces from `lib/services/supabase/types.ts` into a provider-neutral
application contract. Rename the public aggregate to `AppServices` (or an equivalently neutral
name), remove all `client`, shallow storage, and raw channel properties, and make test helpers build
focused structural doubles rather than casting `Partial<SupabaseServices>`. Keep the existing
`ServiceResult` semantics and public feature/action signatures while mapping SDK users and database
rows to application DTOs inside the adapter.

Create narrow browser/server/proxy composition roots that construct the Supabase implementation but
return only `AppServices` or a smaller requested port. Accept factory/port overrides so route and
use-case tests inject behavior without mocking an SDK-shaped client. The composition roots are the
only non-adapter modules allowed to select the concrete implementation; they must not re-export it.
Keep proxy cookie refresh as an infrastructure entry operation with the same response/cookie rules.

Deepen the auth port to cover every application need now bypassing it: current app-owned user,
OAuth code exchange, supported email-token verification through a validated provider-neutral token
kind, current access credential for infrastructure command invocation, auth-state subscription with
app-owned event/session data, and role/destination resolution using the profile repository. Migrate
the callback route, confirmation route, `redirect-if-signed-in`, browser chat-session listener, and
existing auth page-data/forms to these ports. Preserve missing/invalid token redirects, safe `next`
handling, coach/client destinations, signed-out normalization, session timing, and exact calm error
behavior. Add adapter contract tests and route/feature tests against small fakes before removing any
old auth call path.

**Verify:** Run focused auth route, auth feature, service factory, proxy, and page-data tests plus
`pnpm typecheck`. Search production auth/app code to prove it contains no `@supabase/*`,
`@fish/supabase`, `create*SupabaseClient`, `.auth.getUser()`, generated row type, or raw query-chain
usage.

**Commit:** Selectively commit only Task 1 ports, composition, auth adapter/migrations, and tests as
one atomic refactor commit; exclude every pre-existing dirty path.

### Task 2 — Put chat commands, Function transport, and realtime behind ports

**Files:** provider-neutral chat contracts under `apps/web/lib/services/`, Supabase chat adapters
under `apps/web/lib/services/supabase/`, `apps/web/features/chat/server/{actions,local-commands,
edge-transport,response-mapping}.ts`, `apps/web/features/chat/model/realtime.ts`, auth/chat session
integration, hooks that consume subscriptions, and affected unit tests.

**Action:** Define capability-level chat ports around behavior the feature actually uses: bounded
newest/older/backfill/refresh reads, message commands, read-state commands, reaction/sender
enrichment, authenticated command transport, and subscriptions/controllers for messages, reads,
reactions, participant presence, typing, voice recording, and presence heartbeat. Inputs and events
must use current FISH chat DTOs and unsubscribe/controller shapes, never SDK payloads or database
rows.

Move every `.from(...)` query, RPC name/payload, pagination batch, response-row conversion,
`services.client` access, access-token/session lookup, Supabase Function URL/header/timeout rule,
channel construction/auth handshake/status mapping, presence upsert, broadcast send, and channel
removal into the Supabase adapter. Keep query bounds, fallback-on-local-unavailable rules, reaction
aggregation, sender enrichment, validation order, response mapping, callback timing, reconnect
backfills, terminal connection states, heartbeat intervals, and teardown behavior unchanged.
`actions.ts` remains the Next Server Action/use-case facade and `model/realtime.ts` remains the
feature-facing API expected by hooks, but both orchestrate injected ports or delegate to a
provider-neutral capability rather than knowing the provider protocol.

Add focused contract/adapter tests for successful and failed commands, local Function fallback,
bounded recovery, auth-before-subscribe, SDK-to-domain event mapping, reconnect/disconnect callbacks,
broadcasts, heartbeat, and idempotent cleanup. Rework existing tests to inject chat ports instead of
building partial Supabase clients, without weakening any behavior assertions.

**Verify:** Run all chat action, state, hook/component, repository, and service adapter tests plus
`pnpm typecheck`. Search production feature/app code to prove there are no `services.client`, raw
query/RPC/channel APIs, Supabase Function URL construction, `@supabase/*`, or `@fish/supabase`
imports outside `lib/services/supabase`.

**Commit:** Selectively commit only Task 2 chat ports, adapters, feature migrations, and tests as one
atomic refactor commit; do not include the user's concurrent chat presentation edits.

### Task 3 — Remove escape hatches, enforce the architecture, document, and run every gate

**Files:** `apps/web/lib/supabase/**`, obsolete exports/classes in
`apps/web/lib/services/supabase/**`, `apps/web/lib/services/index.ts`,
`apps/web/tests/service-boundary.test.ts`, clean affected tests, and `docs/ARCHITECTURE.md`.

**Action:** After repository-wide import and export analysis, delete the compatibility raw-client
factories under `apps/web/lib/supabase`, stop exporting raw client constructors from browser/server
modules, and remove `SupabaseServices`, public `AppSupabaseClient`, `services.client`, and unused
storage/realtime pass-through services. Retain low-level constructors and generated row types only as
private adapter implementation details. Remove stale tests for deleted compatibility helpers and
replace them with composition/adapter contract tests; do not delete assertions solely to make the
refactor pass.

Expand `service-boundary.test.ts` from `.tsx`-only scanning to all production `.ts` and `.tsx` under
`apps/web/app`, `features`, `components`, and provider-neutral `lib` modules. Mechanically reject
direct `@supabase/*`/`@fish/supabase` imports, `@/lib/supabase`, imports of private adapter internals,
raw-client factory names, `services.client`, and SDK/provider types outside the explicitly enumerated
`lib/services/supabase` infrastructure folder and generic composition roots. Also assert that public
service barrels cannot expose provider-named contracts. Keep operational `supabase/**`, scripts,
generated package types, migrations, adapter tests, and provider verification tools as intentional
infrastructure exceptions, not application leaks.

Update `docs/ARCHITECTURE.md` with the resulting inward dependency direction, ports/adapters,
browser/server/proxy composition roots, DI/testing strategy, and the one permitted Supabase web
boundary. Run `git diff --check` and inspect all staged paths against the initial dirty-file list.
Then run from the repository root:

```bash
pnpm --filter @fish/web test -- --run
pnpm lint
pnpm typecheck
pnpm build
```

Because this refactor touches auth, commands, and realtime, also run the existing full application
and backend integration checks when their documented local Supabase harness is available:

```bash
pnpm --filter @fish/web e2e
pnpm verify:rls
pnpm verify:chat-realtime
```

Do not waive any unit/lint/type/build failure. If an integration check cannot start because external
local services or environment are unavailable, record the exact command and environmental blocker
without changing code to bypass it. Finish with production-source searches proving Supabase SDK and
generated types appear only in the adapter/infrastructure allow-list, all raw compatibility paths
have zero callers and are gone, and every application caller uses a provider-neutral port.

**Commit:** Selectively commit boundary enforcement, safe deletion of escape hatches, documentation,
and test updates as the final atomic refactor commit; exclude quick-task bookkeeping and all unrelated
dirty work unless the GSD workflow intentionally commits its own artifacts separately.

## Out of scope

- New product features, screens, choices, learning flows, copy, styles, routes, APIs, dependencies,
  schemas, migrations, RLS changes, Edge Function behavior, performance redesign, or provider swap.
- Moving all contracts to `packages/core` merely for purity. Keep web-runtime application ports in
  the web application; move a contract to core only if it is already a genuinely shared pure domain
  contract.
- Abstracting stable language/runtime primitives such as `fetch`, `Response`, timers, or Next.js
  routing unless they are directly part of the injectable command transport under test.
