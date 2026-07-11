---
last_mapped_commit: e25c937627b8f19251c791ed6878e6522f802959
---

# Testing Patterns

**Analysis date:** 2026-07-11

## Test Stack

- Vitest 4.1.9 is the unit/component runner, configured by `apps/web/vitest.config.ts`.
- Vitest runs in jsdom, exposes globals, and loads `apps/web/vitest.setup.ts` for every test file.
- React component tests use Testing Library 16.3.2 and `@testing-library/jest-dom` assertions.
- Playwright 1.61.1 runs browser tests from `apps/web/e2e/` using `apps/web/playwright.config.ts`.
- Storybook 10.4.6 provides colocated visual states; the current scripts do not treat stories as an automated interaction-test suite.
- The current tree contains 64 Vitest files, 2 Playwright specifications, and 19 Storybook stories. No snapshot directory is present.

## Commands and Gates

```bash
pnpm --filter @fish/web test run                    # all Vitest tests, one run
pnpm --filter @fish/web test run path/to/file.test.ts
pnpm --filter @fish/web e2e                         # seed, start/reuse web app, run Playwright
pnpm lint                                           # workspace ESLint
pnpm typecheck                                      # workspace TypeScript checks
pnpm build                                          # required pre-commit production build gate
pnpm seed                                           # deterministic local Supabase fixtures
pnpm verify:rls                                     # live RLS/security assertions
pnpm verify:chat-realtime                           # seed and verify realtime/command behavior
pnpm build-storybook                                # verify Storybook can build
```

- `pnpm build` recursively runs package build scripts; the web performs `next build`, while `packages/core` and `packages/supabase` run `tsc --noEmit`.
- `pnpm --filter @fish/web test` without `run` starts Vitest's interactive/watch behavior; use `test run` for a deterministic gate.
- Supabase verification commands require a running local Supabase instance and populated `apps/web/.env.local`.
- `pnpm verify:rls` does not seed by itself; run `pnpm seed` first when the local database is not already in the expected state.

## File Organization

- Unit and component tests are colocated with source as `*.test.ts` or `*.test.tsx`.
- Cross-cutting contract tests live in `apps/web/tests/`; this includes architecture, Next.js poisoning, design-token, accessibility, fixtures, and source-boundary checks.
- Playwright specifications live in `apps/web/e2e/` and are excluded from Vitest.
- Component stories are colocated as `*.stories.tsx` and are restricted to reusable component surfaces by `apps/web/tests/module-boundaries.test.ts`.
- Test-environment helpers live in `apps/web/tests/`, including `intersection-observer.ts` and inert `server-only`/`client-only` module markers.
- Canonical cross-runtime state vectors live in `packages/core/src/chat-state/fixtures/chat-state-vectors.json` and are consumed by web tests.

```text
apps/web/
  components/ui/button/
    button.tsx
    button.test.tsx
    button.stories.tsx
  features/chat/server/
    action-handlers.ts
    action-handlers.test.ts
  tests/
    module-boundaries.test.ts
    service-boundary.test.ts
  e2e/
    chat-send.spec.ts
```

## Unit and Component Style

- Suites are named after the component, use case, helper, store, or invariant under test.
- Case names describe externally visible behavior in present tense; assertions focus on results, accessible UI, calls across a seam, and state transitions.
- Arrange fixtures and mocks, execute the public behavior, then assert. Multiple expectations are normal when they jointly prove one behavior.
- Prefer `getByRole`, `getByLabelText`, visible copy, ARIA state, and focus assertions. Inspect class names only for deliberate design-token or layout contracts.
- Use `waitFor` for scheduled React updates and fake timers for timeouts/debounce; restore timers and mocks in teardown when state can leak.
- Pure reducers, selectors, validation, and formatting utilities are exercised directly without module mocks.
- Snapshot testing is not an established pattern; semantic assertions and Storybook scenarios are preferred.

## Dependency Injection and Mocking

- Use `vi.fn`, `vi.mock`, `vi.spyOn`, `vi.stubGlobal`, and Vitest fake timers for local isolation.
- Prefer injected interface fakes over mocking infrastructure modules. `apps/web/features/chat/server/action-handlers.test.ts` constructs handlers with a `ChatCommandService` fake, while `apps/web/features/profile/server/action-handlers.test.ts` supplies narrow auth/repository dependencies.
- Test factories use `Partial<T>` overrides but return a complete interface; unexpected methods throw so accidental calls fail loudly.
- `apps/web/lib/services/testing.ts` provides `resolvedService` for typed successful service results.
- Adapter tests may mock Supabase query-builder chains at the infrastructure boundary, as in `apps/web/lib/services/supabase/core.test.ts`.
- Module mocks remain appropriate for framework seams (`next/navigation`) and client entry modules, but should not replace explicit DI in application use cases.
- `apps/web/vitest.setup.ts` supplies no-op `ResizeObserver`, `IntersectionObserver`, `matchMedia`, animation, and scrolling behavior missing from jsdom.

## Test Categories

### Pure domain and utility tests

- Cover chat reducers/selectors/store transitions, message grouping, presence, preferences, validation, service results, and utility functions.
- Examples include `apps/web/features/chat/model/chat-state.test.ts`, `apps/web/features/chat/model/store/chat-store.test.ts`, and `apps/web/lib/services/errors.test.ts`.
- `apps/web/tests/chat-state-fixtures.test.ts` checks shared JSON vectors against the web-facing state implementation.

### Use-case and adapter tests

- Handler factory tests prove validation happens before a port call, inputs are normalized, and application outputs contain no transport details.
- Auth use-case tests target `apps/web/features/auth/server/auth-use-cases.ts` through injected `AuthService` and repository capabilities.
- `apps/web/lib/services/container.test.ts` verifies immutable DI-container composition.
- `apps/web/lib/services/supabase/core.test.ts` exercises provider adapters and their error/result mapping with query-chain doubles.

### Component and page tests

- Component tests render in jsdom and cover accessible states, calm copy, focus behavior, form submission, optimistic chat behavior, and design-token classes.
- Async UI tests use Testing Library `waitFor`; browser APIs are supplied by the shared setup or targeted helpers.
- Page and route tests mock external/framework edges to prove redirects, authentication outcomes, role-specific content, and safe failure behavior.
- Route-handler coverage includes `apps/web/app/auth/callback/route.test.ts`; authenticated server pages have colocated `page.test.tsx` files.

### Architecture and source-contract tests

- `apps/web/tests/service-boundary.test.ts` keeps Supabase APIs inside infrastructure, prevents adapter re-exports, rejects provider/transport-shaped application contracts, and verifies injected use cases do not import runtime composition.
- `apps/web/tests/module-boundaries.test.ts` enforces component folders/barrels, App Router placement, story colocation, public entry points, and framework-free core chat state.
- `apps/web/tests/nextjs-boundaries.test.ts` traverses imports to detect transitive `server-only`/`client-only` poisoning.
- `apps/web/tests/tailwind-design-token.test.ts` rejects arbitrary visual values and hardcoded spacing utilities.
- Other source-contract suites cover icon provenance, focus rings, contrast, server page loading, and seed behavior.

### Backend verification

- `scripts/verify-rls.ts` signs in seeded users with the publishable key so queries are genuinely subject to RLS; it checks allowed reads, denied privilege escalation, profile access, and chat/database policies.
- The RLS verifier uses the service role only for setup/inspection that requires administration and exits non-zero when any assertion fails.
- `scripts/verify-chat-realtime.ts` drives authenticated Supabase clients, Edge Function commands, database changes, channel subscriptions, read state, reactions, typing/recording, presence, and reconnect-sensitive behavior.
- Both scripts print explicit PASS/FAIL lines and aggregate failures into a non-zero process exit.
- These are live integration gates, not Vitest tests; they depend on local Supabase services, migrations, Edge Functions, seeded identities, and environment keys.

### End-to-end tests

- Playwright uses Desktop Chrome, a 45-second test timeout, a 10-second assertion timeout, serial execution, and traces retained on failure.
- `apps/web/e2e/chat-send.spec.ts` logs in as a seeded client, sends a unique message, proves exactly one persisted row, reloads, and verifies the row remains.
- `apps/web/e2e/login-spacing.spec.ts` inspects browser geometry to protect calm token-sized login rhythm.
- The E2E script seeds first and starts or reuses `pnpm dev` at `http://localhost:3001`; `PLAYWRIGHT_BASE_URL` can override the URL.

## Coverage Status

- No coverage provider, coverage command, numeric threshold, or coverage CI gate is configured in `apps/web/vitest.config.ts` or package scripts.
- Do not infer or report a coverage percentage from the number of tests.
- Current confidence comes from behavior tests, source-contract suites, lint/typecheck/build gates, Playwright critical flows, and live Supabase verification.
- If numeric coverage becomes a requirement, add an explicit Vitest coverage provider, intentional exclusions, thresholds, and a stable root command before treating it as enforced.

## Adding or Changing Tests

- Put the nearest behavior test beside the changed source.
- Add a source-contract test under `apps/web/tests/` when protecting a dependency, folder, framework, accessibility, or design-system invariant.
- Add a Storybook scenario for a meaningful reusable visual state.
- Reserve Playwright for critical behavior that requires a real browser, routing, persistence, or reload.
- Run live RLS/realtime scripts when a migration, repository, Edge Function, or subscription path changes.
- For structural component changes, run `apps/web/tests/module-boundaries.test.ts` and confirm zero loose component files and zero component folders without `index.ts`.

---

*Testing map refreshed 2026-07-11 at `e25c937627b8f19251c791ed6878e6522f802959`.*
