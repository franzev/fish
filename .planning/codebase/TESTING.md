# Testing Patterns

**Analysis Date:** 2026-07-02

## Test Framework

**Runner:**
- Not yet configured — no test runner (Jest, Vitest, etc.) is installed
- No test files present in codebase (`.test.ts`, `.spec.ts` not found)

**Assertion Library:**
- Not installed

**Run Commands:**
```bash
# No testing commands configured in package.json scripts
# When tests are added, expected command would be:
# pnpm test              # Run all tests
# pnpm test:watch       # Watch mode
# pnpm test:coverage    # Coverage report
```

## Current State

**Test Infrastructure Status:**
- TypeScript checking is the primary validation mechanism
- Command: `pnpm typecheck` (runs `tsc --noEmit`)
- Command: `pnpm lint` (runs ESLint via eslint.config.mjs)

Both are run across all packages (root `package.json` uses `pnpm -r` to run in all workspaces).

## Test File Organization

**Planned Pattern (when testing is implemented):**

**Location:**
- Co-located with source files (same directory as component/function being tested)
- Or in a `__tests__` directory at the package level

**Naming:**
- Component tests: `button.test.tsx`, `input.test.tsx`, `card.test.tsx`
- Utility tests: `utils.test.ts`
- Package tests: placed in corresponding package's test directory

**Structure:**
```
apps/web/
├── components/
│   └── ui/
│       ├── button.tsx
│       ├── button.test.tsx
│       ├── input.tsx
│       └── input.test.tsx
└── lib/
    ├── utils.ts
    └── utils.test.ts
```

## Architecture for Testing

**Current Components to Test (high priority when testing is added):**

**React Components (`apps/web/components/ui/`):**
- `Button` (`button.tsx`)
  - Props: variant selection, fullWidth behavior, disabled state
  - Rendering: correct className merging via `cn()`
  - Accessibility: forwardRef, displayName
  - Variants: primary, secondary, ghost

- `Input` (`input.tsx`)
  - Props: label (required), hint, notice
  - Rendering: label associated with input, error states
  - Accessibility: auto-generated ID fallback via `useId()`
  - States: with hint, with notice, with both (mutually exclusive)

- `Card` (`card.tsx`)
  - Props: className merging
  - Rendering: baseline styles (rounded-card, bg-surface, border)

- `Progress` (`card.tsx`)
  - Props: value (0–100), label
  - Rendering: clamping behavior, ARIA attributes
  - Accessibility: progressbar role, aria-valuenow

**Utilities (`apps/web/lib/`):**
- `cn()` (`utils.ts`)
  - Input: classValue arrays with conditionals
  - Output: merged Tailwind classes with conflict resolution
  - Test cases: clsx behavior, tailwind-merge conflict handling

**Shared Packages:**
- `@fish/core`: Type guards, constants
  - `isUserRole()` guard function
  - Role constants (`userRoles`)
  - Chat constants (`chatLimits`)

- `@fish/supabase`: Auth contracts
  - Auth type definitions

**Edge Functions:**
- `supabase/functions/send-message/index.ts`
  - Request validation (POST method, body parsing)
  - Input validation (conversationId, body presence, length)
  - Response formats (error responses, success response)

## Mocking (Planned)

**Framework:** None installed yet; when added, likely Vitest or Jest with built-in mocking

**What to Mock:**
- React components that depend on context providers (when authentication context is added)
- Supabase client calls (in future integration tests)
- Next.js Image component (can use next/image/mock or test utils)

**What NOT to Mock:**
- DOM rendering (test real output via React Testing Library)
- Tailwind utilities (test actual class application)
- Type guards and pure functions (test real behavior)
- Design system tokens from globals.css (test integration)

## Fixtures and Factories

**Test Data (not yet created):**

When fixtures are needed, expected patterns:

```typescript
// Example fixture for chat data
const mockChatMessage = {
  id: "msg-123",
  conversationId: "conv-456",
  senderId: "user-789",
  senderRole: "client",
  body: "Hello coach",
  createdAt: "2026-07-02T10:00:00Z",
} as const satisfies ChatMessage;

// Factory for variations
function createChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return { ...mockChatMessage, ...overrides };
}
```

**Location:** Planned in `__tests__/fixtures/` or co-located with test files

## Coverage

**Requirements:** Not enforced yet

**When testing is implemented:**
- Aim for: 80%+ coverage on utilities and type guards
- Components: 60%+ (integration testing harder than unit)
- Edge Functions: 100% for validation logic

**View Coverage (when configured):**
```bash
pnpm test:coverage
# Expected output: HTML report in coverage/ directory
```

## Test Types

**Unit Tests (Planned):**
- Utilities: `cn()`, type guards, constants
- Component props: variant selection, prop combination handling
- Scope: Single function or component in isolation

**Integration Tests (Planned):**
- React components with multiple props, state, and layout
- Tailwind class merging via `cn()`
- Component interactions (e.g., Input with hint + notice)
- Scope: Component + dependencies (utilities, design tokens)

**E2E Tests:**
- Framework: Not yet configured (could be Playwright, Cypress)
- Scope: Full user journeys (auth flow, chat interaction)
- Status: Deferred until product features stabilize

## Common Patterns to Test

**Component Props & Variants:**
```typescript
describe("Button", () => {
  it("renders primary variant by default", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-primary");
  });

  it("applies fullWidth class when fullWidth=true", () => {
    render(<Button fullWidth={true}>Click me</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });

  it("forwards ref for focus management", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Click me</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

**Type Guards:**
```typescript
describe("isUserRole", () => {
  it("returns true for valid roles", () => {
    expect(isUserRole("client")).toBe(true);
    expect(isUserRole("coach")).toBe(true);
  });

  it("returns false for invalid roles", () => {
    expect(isUserRole("admin")).toBe(false);
    expect(isUserRole("")).toBe(false);
  });

  it("narrows type correctly", () => {
    const value: string = "client";
    if (isUserRole(value)) {
      // value is now UserRole type
      const role: UserRole = value;
      expect(role).toBeDefined();
    }
  });
});
```

**Input Validation (Edge Functions):**
```typescript
describe("send-message handler", () => {
  it("rejects non-POST requests", async () => {
    const response = await handler(new Request("http://test", { method: "GET" }));
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "Send messages with a post request." });
  });

  it("rejects empty conversationId", async () => {
    const response = await handler(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ body: "Hello" }),
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Add a message before sending." });
  });

  it("rejects messages exceeding length limit", async () => {
    const longBody = "a".repeat(chatLimits.messageBodyMaxLength + 1);
    const response = await handler(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ conversationId: "conv-123", body: longBody }),
      })
    );
    expect(response.status).toBe(400);
  });
});
```

**Accessibility Testing:**
```typescript
describe("Input accessibility", () => {
  it("associates label with input via for/id", () => {
    render(<Input label="Email" />);
    const label = screen.getByText("Email");
    const input = screen.getByRole("textbox");
    expect(label.htmlFor).toBe(input.id);
  });

  it("shows hint text when notice is absent", () => {
    render(<Input label="Password" hint="At least 8 characters." />);
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
  });

  it("shows notice instead of hint when both present", () => {
    render(
      <Input
        label="Email"
        hint="Valid email required"
        notice="That doesn't look right"
      />
    );
    expect(screen.getByText("That doesn't look right")).toBeInTheDocument();
    expect(screen.queryByText("Valid email required")).not.toBeInTheDocument();
  });

  it("sets Progress progressbar role and ARIA attributes", () => {
    render(<Progress value={50} label="Progress" />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "50");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });
});
```

## TypeScript Checking as First-Line Validation

**Current approach:**
- All packages require `typecheck` to pass: `tsc --noEmit`
- Types are strict; many categories of errors caught at compile time
- No undefined behavior from missing null checks (strict mode enforces)

**Rationale for ND audience:**
- Strong types reduce runtime surprises and debugging friction
- Catch errors early, before they reach testers or users

## Testing Roadmap (Not Yet Scheduled)

1. **Phase 1 (Foundation):** Unit tests for shared packages (`@fish/core`, `@fish/supabase`)
   - Type guards and constants
   - Auth contract validation

2. **Phase 2:** Component tests for UI kit (`Button`, `Input`, `Card`, `Progress`)
   - Props and variants
   - Accessibility attributes
   - Tailwind integration

3. **Phase 3:** Integration tests for auth flow and chat UI

4. **Phase 4:** E2E tests for critical user journeys (once feature set stabilizes)

---

*Testing analysis: 2026-07-02*
