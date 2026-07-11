---
last_mapped_commit: 8db370815b16e6563aae8c1d7e1992697f5fd9d0
---

# Testing Patterns

**Analysis Date:** 2026-07-11

## Test Framework

**Unit and component runner:**
- Vitest 4.1.9 with configuration in `apps/web/vitest.config.ts`.
- Tests run in jsdom with global APIs enabled and `apps/web/vitest.setup.ts` loaded for every file.
- React tests use Testing Library 16.3.2 and `@testing-library/jest-dom` matchers.
- Vitest's built-in `expect` is used for value, mock, DOM, and promise assertions.

**Browser runner:**
- Playwright 1.61.1 runs Chrome flows from `apps/web/e2e/` using `apps/web/playwright.config.ts`.
- E2E execution is intentionally serial (`fullyParallel: false`), uses a 45-second test timeout, retains traces on failure, and starts the app on port 3001.
- Storybook 10.4.6 provides colocated visual/component scenarios; stories are examples and manual review surfaces, not an automated browser-test suite in the current scripts.

**Run commands:**
```bash
pnpm --filter @fish/web test                         # Run Vitest (watch mode when interactive)
pnpm --filter @fish/web test -- --run                # Run Vitest once
pnpm --filter @fish/web test -- --run lib/utils.test.ts
pnpm --filter @fish/web e2e                          # Seed local Supabase, then run Playwright
pnpm storybook                                       # Run component stories
pnpm build                                           # Required production build/typecheck gate
```

## Test File Organization

- Unit/component tests are colocated with source files as `*.test.ts` and `*.test.tsx`, for example `apps/web/lib/validation/profile.test.ts` and `apps/web/components/ui/button/button.test.tsx`.
- Cross-cutting architectural and design-system checks live under `apps/web/tests/`, including `service-boundary.test.ts`, `chat-state-boundary.test.ts`, and `tailwind-design-token.test.ts`.
- Playwright tests use `*.spec.ts` under `apps/web/e2e/`; Vitest explicitly excludes that directory.
- Stories sit beside reusable components as `*.stories.tsx`, such as `apps/web/components/chat/avatar/avatar.stories.tsx`.
- Shared jsdom helpers live under `apps/web/tests/`, notably `intersection-observer.ts`; there is no global fixtures/factories directory.

```text
apps/web/
  components/ui/button/
    button.tsx
    button.test.tsx
    button.stories.tsx
  lib/services/
    errors.ts
    errors.test.ts
  tests/
    service-boundary.test.ts
  e2e/
    chat-send.spec.ts
```

## Test Structure

- Import `describe`, `it`, `expect`, lifecycle hooks, and `vi` explicitly from `vitest` even though globals are enabled.
- Name suites after the component, function, or protected boundary; name cases as observable behavior in present tense (`"returns a calm notice when signed out"`).
- Use nested `describe` blocks for distinct state-machine areas or invariants; simple modules normally use one suite.
- Arrange data first, execute the behavior, then assert. Comments are added when the assertion encodes a non-obvious product or regression constraint.
- Multiple expectations per case are common when they prove one behavior. Tests favor exact statuses, accessible state, calls, and state transitions over implementation snapshots.
- Use `afterEach` to reset mocks and restore timers when state could leak; Testing Library handles rendered DOM cleanup.

```typescript
describe("sendMessageAction", () => {
  afterEach(() => {
    vi.useRealTimers();
    fetchMock.mockReset();
  });

  it("returns a calm notice when signed out", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ ok: true, data: null });
    const result = await sendMessageAction(validInput);
    expect(result.status).toBe("notice");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

## Mocking

- Use Vitest's `vi.fn`, `vi.mock`, `vi.spyOn`, `vi.stubGlobal`, and fake timers.
- Declare module mocks before importing the subject when import-time wiring matters, as in `apps/web/app/(authenticated)/chat/actions.test.ts`.
- Mock Supabase service interfaces and query-builder chains rather than starting a database for unit tests. `apps/web/lib/services/testing.ts` supplies reusable successful services and service-container doubles.
- Stub browser APIs missing from jsdom globally in `apps/web/vitest.setup.ts` (`ResizeObserver`, `IntersectionObserver`, `matchMedia`, animations, and scrolling).
- Use fake timers for timeout/debounce/presence behavior, then restore real timers in teardown.
- Do not mock pure reducer/selector logic. `packages/core` chat-state code is exercised directly through web boundary and store tests.
- Prefer role-based DOM queries (`getByRole`, `getByLabelText`) over class selectors; inspect classes only when testing token/design-system contracts.

## Fixtures and Factories

- Small fixtures and factory functions live inside the relevant test file. Common patterns accept `Partial<T>` overrides (`messageRow(overrides)`) and use fixed UUIDs/timestamps.
- Canonical cross-runtime chat-state vectors are JSON in `packages/core/src/chat-state/fixtures/chat-state-vectors.json`; `apps/web/tests/chat-state-fixtures.test.ts` verifies them.
- Storybook state uses `apps/web/components/chat/story-data.ts` and per-story `args` for visual scenarios.
- Database-backed scripts and E2E tests use deterministic local data from `scripts/seed.ts`; Playwright assumes the documented local credentials and conversation IDs.
- Keep test data obviously synthetic and deterministic. Use `Date.now()` only when an E2E flow needs a unique persisted value, as in `apps/web/e2e/chat-send.spec.ts`.

## Test Types

**Pure unit tests:**
- Cover validation, formatting, reducers, selectors, error normalization, and utilities without external systems.
- Examples: `apps/web/lib/prefs/time-format.test.ts`, `apps/web/lib/services/errors.test.ts`, and `apps/web/app/(authenticated)/chat/message-grouping.test.ts`.

**Component tests:**
- Render components in jsdom, drive them through accessible controls, and assert visible copy, ARIA state, focus behavior, and product token classes.
- Page tests mock server/auth services to cover redirects, role-specific output, and calm failure states.
- Examples: `apps/web/components/ui/button/button.test.tsx` and `apps/web/app/(authenticated)/home/page.test.tsx`.

**Contract and architecture tests:**
- Source-scanning tests enforce boundaries and design rules, not just runtime behavior.
- `apps/web/tests/service-boundary.test.ts` forbids direct Supabase imports in TSX; `apps/web/tests/icon-source.test.ts` and `tailwind-design-token.test.ts` enforce UI-system constraints.
- `apps/web/tests/chat-state-boundary.test.ts` and chat store tests keep authority and provider concerns outside shared state.

**Integration and verification:**
- `scripts/verify-rls.ts` performs database authorization verification against local Supabase.
- `scripts/verify-chat-realtime.ts` checks seeded realtime chat behavior and is run through `pnpm verify:chat-realtime`.
- These are executable verification scripts rather than Vitest files and require local environment configuration.

**End-to-end tests:**
- `apps/web/e2e/chat-send.spec.ts` proves authenticated message persistence and duplicate prevention across reload.
- `apps/web/e2e/login-spacing.spec.ts` verifies login layout spacing in the browser.
- `pnpm --filter @fish/web e2e` seeds before Playwright; local Supabase and `apps/web/.env.local` must be ready.

## Coverage

- No coverage provider, coverage script, threshold, or CI coverage gate is configured in `apps/web/vitest.config.ts` or package scripts.
- The repository currently relies on breadth of behavior tests, architecture tests, required build/lint/typecheck gates, and targeted Supabase verification scripts.
- Do not claim a numeric coverage level. If coverage is introduced, add an explicit provider, exclusions, thresholds, and a stable root command before treating it as a gate.

## Common Patterns

**Async behavior:**
- Await actions and Testing Library transitions directly; use `waitFor` when UI updates are scheduled asynchronously.
- For timeout fallback behavior, use `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync()` rather than real waits.

**Expected failures:**
- Assert thrown invariants with `toThrow`; assert expected service/user failures as discriminated result/status values.
- Also assert prohibited side effects (`expect(fetchMock).not.toHaveBeenCalled()`) so validation and authorization guards remain early.

**State transitions:**
- Hydrate a fresh store/reducer, apply domain actions, and assert selectors or public state rather than private implementation variables.
- Optimistic chat tests cover sending, confirmation, failure, retries, realtime merge, pagination, and read state in sequence.

**Snapshots:**
- Snapshot tests are not an established pattern; no `__snapshots__` tree is present. Prefer semantic assertions and Storybook scenarios.

**When adding a change:**
- Add or update the nearest colocated test for behavior changes.
- Add an `apps/web/tests/` contract test when protecting an architectural or design-system boundary.
- Add a Storybook state for a reusable component's meaningful visual variation.
- Reserve Playwright for critical persisted user flows that unit/component tests cannot prove.

---

*Testing analysis: 2026-07-11*
*Update when test patterns change*
