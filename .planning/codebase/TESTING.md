---
last_mapped_commit: ffc0af5c4a67160e838b07ffa6e26652f9ca337d
---

# Testing Patterns

**Analysis Date:** 2026-07-11

## Test Framework

**Runner:**
- Not yet configured — no test runner (Jest, Vitest, etc.) is installed
- No test files present in codebase (`.test.ts`, `.spec.ts` not found)
- Validation via TypeScript: `pnpm typecheck` (runs `tsc --noEmit` across all packages)

**Assertion Library:**
- Not installed

**Run Commands:**
```bash
pnpm typecheck              # Validate all types (TypeScript only)
pnpm lint                   # Check code quality
pnpm build                  # Full build validation
```

## Test Vectors (Executable Contract)

**Location:** `packages/core/src/chat-state/fixtures/chat-state-vectors.json`

**Format:** Platform-neutral JSON test cases for the chat state reducer. Each vector contains:
- `name`: Test case identifier (e.g., "hydrateConversation")
- `initialState`: Starting `ChatState` before events are applied
- `events`: Array of `ChatEvent` objects to apply
- `expectedState`: Expected `ChatState` after all events
- `expectedSelectors`: (optional) Computed selector outputs to verify

**Purpose:** 
- Serve as the executable parity contract for the chat state protocol
- Ensure reducer logic is consistent across platforms (web, native Android/iOS)
- Validate selector behavior (message ordering, read state merging, etc.)
- Test complex state transitions: optimistic sends, server reconciliation, pagination

**Usage Pattern:**
```typescript
// Platform adapters consume these vectors idiomatically
// Web: Zustand reducer, Native: platform-native state container
import vectors from './fixtures/chat-state-vectors.json';

for (const testCase of vectors) {
  let state = testCase.initialState;
  for (const event of testCase.events) {
    state = reduceChatState(state, event);
  }
  expect(state).toEqual(testCase.expectedState);
}
```

**Example Test Cases in Vectors:**
- Hydrating conversation messages while preserving local optimistic sends
- Merging remote messages that reconcile with `clientRequestId`
- Pagination: loading older messages, handling load failures
- Read state: merging delivery/read markers from other participants
- Composer state: draft edits, reply targets, edit targets

## Current State

**Test Infrastructure Status:**
- TypeScript checking is the primary validation mechanism
- Command: `pnpm typecheck` (runs `tsc --noEmit`)
- Command: `pnpm lint` (runs ESLint via eslint.config.mjs)

Both are run across all packages (root `package.json` uses `pnpm -r` to run in all workspaces).

**Validation Strategy:**
- Type system catches errors at compile time (strict mode enabled)
- Discriminated unions (`ChatEvent` type union) enforce exhaustive pattern matching
- Type guards (`isUserRole`) ensure type safety for runtime values

## Test File Organization

**Planned Pattern (when testing is implemented):**

**Location:**
- Co-located with source files (same directory as component/function being tested)
- Or in a `__tests__` directory at the package level
- Chat state: fixtures in `packages/core/src/chat-state/fixtures/`

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

packages/core/src/
├── chat.ts
├── chat.test.ts
├── roles.ts
├── roles.test.ts
├── chat-state/
│   ├── types.ts
│   ├── reducer.ts
│   ├── reducer.test.ts
│   ├── selectors.ts
│   ├── selectors.test.ts
│   └── fixtures/
│       └── chat-state-vectors.json
```

## Reducer & Selector Testing

**Chat State Reducer (`packages/core/src/chat-state/reducer.ts`):**

When tests are added, they will validate:
- Event application: each `ChatEvent` type updates state correctly
- Message reconciliation: optimistic sends merge with server confirmations by id or `clientRequestId`
- Pagination: loading older messages, handling failures atomically
- Composer state: draft, reply target, edit target management
- Realtime status: connection state transitions

**Key Test Scenarios:**
1. Hydrate conversation with existing local sends in progress
2. Confirm sent message that matches local optimistic send
3. Mark message failed and restore body to composer draft (only if draft empty)
4. Merge read state from remote participant
5. Load older page of messages and update pagination cursor
6. Handle older-page load failure atomically (reset loading flag + set error flag in one update)

**Selectors (`packages/core/src/chat-state/selectors.ts`):**

When tests are added, they will validate:
- `compareChatMessages`: order by `createdAt` timestamp, then by `id`
- `mergeChatMessage`: reconcile by `id`, `clientRequestId`, or explicit `localRequestId`
- `mergeReadState`: upsert by `userId`, detect no-op updates
- `getOutgoingMessageStatus`: return `read`/`delivered`/`sent` based on read state markers
- `countUnreadMessages`: count messages after current user's read marker, excluding own messages

**Edge Case Coverage:**
- Read marker set but not yet loaded (treat as older than all loaded messages)
- Repeated `clientRequestId` values reconcile to one message (no duplicates)
- Display name from hydrate must not be overwritten by server response without it
- Message list must remain sorted after every merge operation

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

- `Progress` (`progress.tsx`)
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
  - Error message consistency

- `supabase/functions/chat-command/index.ts`
  - Command discrimination (action field)
  - Message edit/delete validation
  - Reaction emoji validation
  - Pagination: message refresh, conversation refresh
  - Error handling and message enrichment

## Mocking (Planned)

**Framework:** None installed yet; when added, likely Vitest or Jest with built-in mocking

**What to Mock:**
- React components that depend on context providers (when authentication context is added)
- Supabase client calls (in integration tests)
- Next.js Image component (can use next/image/mock or test utils)
- Fetch calls to Supabase endpoints (in Edge Function tests)

**What NOT to Mock:**
- DOM rendering (test real output via React Testing Library)
- Tailwind utilities (test actual class application)
- Type guards and pure functions (test real behavior)
- Design system tokens from globals.css (test integration)
- Chat state reducer (test with real vectors, not mocked)

## Fixtures and Factories

**Test Data (primary fixture source):**

The JSON test vectors in `packages/core/src/chat-state/fixtures/chat-state-vectors.json` serve as the main fixture source. Platform-neutral JSON format allows reuse across web and native.

**When plain TypeScript fixtures are needed:**

```typescript
// Example fixture for chat data
const mockChatMessage = {
  id: "msg-123",
  conversationId: "conv-456",
  senderId: "user-789",
  senderRole: "client",
  body: "I practiced the introduction.",
  createdAt: "2026-07-06T04:01:00Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  reactions: [],
  clientRequestId: "req-123",
  localStatus: "sent",
} as const satisfies ChatMessageState;

// Factory for variations
function createChatMessage(overrides: Partial<ChatMessageState> = {}): ChatMessageState {
  return { ...mockChatMessage, ...overrides };
}

// Bulk fixture for conversation state
const conversationFixture = {
  conversationId: "conv-456",
  messages: [mockChatMessage],
  readStates: [],
  composer: { draft: "", replyTargetId: null, editTargetId: null },
  realtime: { status: "connected" },
  pagination: { oldestLoadedCursor: null, hasMoreOlder: false, isLoadingOlder: false, hasLoadError: false },
} as const satisfies ChatConversationState;
```

**Location:** Planned in `__tests__/fixtures/` or co-located with test files

## Coverage

**Requirements:** Not enforced yet

**When testing is implemented:**
- Aim for: 80%+ coverage on utilities and type guards
- Components: 60%+ (integration testing harder than unit)
- Reducer/selectors: 90%+ (core business logic; test vectors provide baseline)
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
- Reducer functions: individual event handlers
- Scope: Single function or component in isolation

**Integration Tests (Planned):**
- React components with multiple props, state, and layout
- Tailwind class merging via `cn()`
- Component interactions (e.g., Input with hint + notice)
- Chat state: reducer + selectors together
- Scope: Component + dependencies (utilities, design tokens)

**Contract/Vector Tests:**
- Chat state reducer: consume `chat-state-vectors.json`
- Selector behavior: validate sort order, merging logic, status computation
- Platform parity: same JSON vectors for web and native
- Scope: Full reducer behavior across event sequence

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

**Reducer Testing (Chat State):**
```typescript
describe("Chat state reducer", () => {
  it("hydrates conversation and preserves local optimistic sends", () => {
    const initialState = createEmptyChatState();
    const optimisticMessage: ChatMessageState = {
      id: "local-1",
      clientRequestId: "req-1",
      localStatus: "sending",
      // ... other fields
    };
    
    let state = reduceChatState(initialState, {
      type: "sendOptimisticMessage",
      message: optimisticMessage,
    });
    
    const incomingMessages = [ /* server messages */ ];
    state = reduceChatState(state, {
      type: "hydrateConversation",
      conversationId: "conv-1",
      messages: incomingMessages,
      readStates: [],
    });
    
    // Optimistic message should still be present (not overwritten)
    const conversation = state.conversations["conv-1"];
    const found = conversation.messages.find(m => m.clientRequestId === "req-1");
    expect(found).toEqual(optimisticMessage);
  });

  it("reconciles by clientRequestId on confirmSentMessage", () => {
    // Test that server-confirmed message replaces optimistic send
  });

  it("handles failed send and restores draft only if empty", () => {
    // Test failure handling without overwriting new draft edits
  });
});
```

**Selector Testing:**
```typescript
describe("Chat selectors", () => {
  it("compareChatMessages sorts by createdAt then id", () => {
    const messages = [
      { id: "b", createdAt: "2026-07-01T10:00:00Z" },
      { id: "a", createdAt: "2026-07-01T10:00:00Z" },
      { id: "c", createdAt: "2026-07-01T09:00:00Z" },
    ];
    const sorted = [...messages].sort(compareChatMessages);
    expect(sorted[0].id).toBe("c");
    expect(sorted[1].id).toBe("a");
    expect(sorted[2].id).toBe("b");
  });

  it("getOutgoingMessageStatus returns read when read marker at or after", () => {
    const message = { id: "msg-1", createdAt: "2026-07-01T10:00:00Z" };
    const readState = { lastReadMessageId: "msg-1" };
    const status = getOutgoingMessageStatus(message, [message], readState);
    expect(status).toBe("read");
  });
});
```

**Edge Function Input Validation:**
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
    expect(await response.json()).toEqual({
      error: "This message is a little long. Try sending it in two parts.",
    });
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
- Discriminated unions enforce exhaustive case handling

**Rationale for ND audience:**
- Strong types reduce runtime surprises and debugging friction
- Catch errors early, before they reach testers or users
- Type narrowing prevents logic errors in state management

## Testing Roadmap (Not Yet Scheduled)

1. **Phase 1 (Foundation):** Test vector infrastructure + reducer tests
   - Chat state protocol compliance
   - All event types and selectors
   - Edge case coverage (optimistic sends, pagination, read state)

2. **Phase 2:** Unit tests for shared packages (`@fish/core`, `@fish/supabase`)
   - Type guards and constants
   - Auth contract validation

3. **Phase 3:** Component tests for UI kit (`Button`, `Input`, `Card`, `Progress`)
   - Props and variants
   - Accessibility attributes
   - Tailwind integration

4. **Phase 4:** Integration tests for auth flow and chat UI

5. **Phase 5:** E2E tests for critical user journeys (once feature set stabilizes)

---

*Testing analysis: 2026-07-11*
