# Channels + Simplified Chat Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a single-channel (`general`) channels concept and rebuild the chat shell around a two-column layout at `/channels/[id]`, with a simplified header, a borderless Discord-style composer, and UI-only search-filter surfaces.

**Architecture:** A thin `channels` table maps the seed channel `general` onto the existing demo-community conversation (no membership, no data migration). Routing moves to `/channels/[id]`; `/chat` redirects there. The existing `ChatClient`, composer hook, realtime, and store are reused; only the data entry point and presentational shell change. New composer affordances and the search-filter UI are present but stubbed (a calm `notice`), except emoji and audio recording, which are wired for real.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4 (CSS-first tokens), Supabase (Postgres + RLS), `@base-ui/react` ^1.6.0 (Popover/Menu/Dialog), Vitest + Testing Library, Tabler icons.

**Conventions carried from the codebase:**
- Tests are Vitest. One-shot run: `pnpm --filter @fish/web test run <path>`. Typecheck: `pnpm --filter @fish/web typecheck`. Lint: `pnpm --filter @fish/web lint`. Build (must pass before commit): `pnpm build` from repo root.
- Design tokens only — no raw hex, no one-off numeric spacing (`gap-md`, `px-sm`, etc.). Use `cn()` from `@/lib/utils`.
- Base UI import subpaths are per component: `@base-ui/react/popover`, `@base-ui/react/menu`, `@base-ui/react/dialog`. Files using them need `"use client"`.
- Commit after each task.

---

## File structure

**New**
- `supabase/migrations/0016_channels.sql` — `channels` table, seed `general`, map to demo community conversation.
- `apps/web/app/(authenticated)/channels/[id]/page.tsx` — channel route (server component).
- `apps/web/components/chat/composer/composer.tsx` — the composer bar (borderless input, `+` menu, right icons, conditional Send).
- `apps/web/components/chat/composer/composer.test.tsx`.
- `apps/web/components/chat/composer/add-menu.tsx` — Base UI Menu for `+` (Upload File / Audio Recording / Create Poll).
- `apps/web/components/chat/search-filters/search-filter-popover.tsx` — quick-filter Popover.
- `apps/web/components/chat/search-filters/filters-dialog.tsx` — full Filters dialog/sheet (Base UI Dialog).
- `apps/web/components/chat/search-filters/search-filters.test.tsx`.

**Modified**
- `apps/web/lib/services/supabase/types.ts` — add channel fields to `ClientChatData`.
- `apps/web/lib/services/supabase/core.ts` — populate channel fields for the demo community.
- `apps/web/lib/auth/server.ts` — `getChatPageData` returns channel identity (unchanged data path; add channel fields via core).
- `apps/web/components/shell/app-shell.tsx` — rail trim + channel column + nav target `/channels`.
- `apps/web/app/(authenticated)/chat/page.tsx` — redirect to the general channel.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` — simplified header (drop subtitle line + `NotificationBadge`, collapse search to an icon that opens the popover); swap footer for `<Composer>`.
- `apps/web/components/chat/index.ts` — export new components.
- `apps/web/app/kit/chat-live/page.tsx` — render the new shell with channel fields.

---

## Phase 0 — Channels data model

### Task 1: Channels table + seed migration

**Files:**
- Create: `supabase/migrations/0016_channels.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Channels: a thin naming layer over conversations. This milestone seeds ONE
-- channel ("general") bound to the existing demo-community conversation, so no
-- membership/assignment tables and no message migration are introduced. Growing
-- to N channels later means adding rows + a membership table, not reworking this.

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  conversation_id uuid not null references public.conversations (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.channels enable row level security;
grant select on public.channels to authenticated;
grant select, insert, update, delete on public.channels to service_role;

-- Any authenticated user may read channels (the same audience that can read the
-- demo community room). Membership scoping arrives with real assignment later.
create policy "authenticated read channels"
  on public.channels
  for select
  to authenticated
  using ((select auth.uid()) is not null);

-- Seed the single "general" channel bound to the fixed demo-community conversation.
-- The conversation row is created by 0014's demo bridge helper id; ensure it exists.
insert into public.conversations (id, client_id, coach_id)
  select
    private.demo_community_conversation_id(),
    (select id from public.profiles order by created_at limit 1),
    (select id from public.profiles order by created_at limit 1)
  where not exists (
    select 1 from public.conversations
    where id = private.demo_community_conversation_id()
  );

insert into public.channels (id, slug, name, conversation_id)
values (
  '22222222-2222-4222-8222-222222222222',
  'general',
  'general',
  private.demo_community_conversation_id()
)
on conflict (slug) do nothing;
```

- [ ] **Step 2: Verify the SQL applies cleanly**

Run: `pnpm --dir supabase exec supabase db reset` if a local Supabase is running, otherwise `supabase db reset` in the project. If no local stack is available, validate syntax by reading the migration against `0010_chat.sql` / `0014_*.sql` patterns (same `create table` / `enable row level security` / `grant` / `create policy` idioms).
Expected: reset completes; `channels` has one row `general`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0016_channels.sql
git commit -m "feat(channels): add channels table seeded with general"
```

> Note: the seed's `client_id`/`coach_id` self-reference is only to satisfy the NOT NULL FKs for the demo bridge conversation; the demo RLS in `0014` already grants read to all authenticated users, so these columns are unused for `general`. If `0014` already creates this conversation row, the `where not exists` guard makes the insert a no-op.

---

### Task 2: Channel identity on `ClientChatData`

**Files:**
- Modify: `apps/web/lib/services/supabase/types.ts:150-161`
- Test: `apps/web/lib/services/supabase/types.test.ts` (create if absent — otherwise assert via a compile-time usage; see step 1)

- [ ] **Step 1: Add fields to the interface**

In `apps/web/lib/services/supabase/types.ts`, extend `ClientChatData`:

```ts
export interface ClientChatData {
  conversationId: string;
  kind?: "direct" | "community";
  /** Channel identity — present for community/channel rooms. */
  channelId?: string;
  channelSlug?: string;
  channelName?: string;
  title?: string;
  subtitle?: string;
  currentUserId: string;
  currentUserRole: "client" | "coach";
  participant: ClientChatParticipant;
  messages: ClientChatMessage[];
  readStates?: ClientChatReadState[];
  participantPresence?: ClientChatPresence;
}
```

- [ ] **Step 2: Typecheck to confirm nothing broke**

Run: `pnpm --filter @fish/web typecheck`
Expected: PASS (fields are optional, so no existing call site breaks).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/services/supabase/types.ts
git commit -m "feat(channels): add channel identity fields to ClientChatData"
```

---

### Task 3: Populate channel fields for the demo community

**Files:**
- Modify: `apps/web/lib/services/supabase/core.ts:41-42` (constants) and `:785-805` (return object)
- Test: `apps/web/lib/services/supabase/core.test.ts` (add a case if the file exists; otherwise assert in a new focused test)

- [ ] **Step 1: Write the failing test**

Add to the nearest core repository test (search for an existing `getAssignedConversation` test with `rg "getAssignedConversation" apps/web/lib/services/supabase`). If one exists, add:

```ts
it("labels the demo community conversation as the general channel", async () => {
  // ...arrange the repository with the demo community conversation id...
  const result = await repository.getAssignedConversation();
  expect(result.ok).toBe(true);
  if (result.ok && result.data) {
    expect(result.data.kind).toBe("community");
    expect(result.data.channelSlug).toBe("general");
    expect(result.data.channelName).toBe("general");
  }
});
```

If no such test harness exists, skip the unit test here and rely on the `chat-client` render tests (Task 8) plus typecheck; note that in the commit message.

- [ ] **Step 2: Add the constant and return fields**

Near line 41-42 add:

```ts
const demoCommunityChannelSlug = "general";
const demoCommunityChannelName = "general";
const demoCommunityChannelId = "22222222-2222-4222-8222-222222222222";
```

In the returned object (line ~785), add channel fields when `isDemoCommunity`:

```ts
return serviceSuccess({
  conversationId: conversation.id,
  kind: isDemoCommunity ? "community" : "direct",
  channelId: isDemoCommunity ? demoCommunityChannelId : undefined,
  channelSlug: isDemoCommunity ? demoCommunityChannelSlug : undefined,
  channelName: isDemoCommunity ? demoCommunityChannelName : undefined,
  title: isDemoCommunity ? demoCommunityChannelName : undefined,
  subtitle: isDemoCommunity ? undefined : undefined,
  // ...rest unchanged...
});
```

Note: `title` becomes the channel name (`general`) and `subtitle` is dropped (the simplified header no longer renders it).

- [ ] **Step 3: Run tests + typecheck**

Run: `pnpm --filter @fish/web test run apps/web/lib/services/supabase` then `pnpm --filter @fish/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/services/supabase/core.ts apps/web/lib/services/supabase/core.test.ts
git commit -m "feat(channels): expose general channel identity from chat repository"
```

---

## Phase 1 — Routing

### Task 4: `/channels/[id]` route

**Files:**
- Create: `apps/web/app/(authenticated)/channels/[id]/page.tsx`

- [ ] **Step 1: Write the route (mirrors `chat/page.tsx`)**

```tsx
import { EmptyState } from "@/components/chat";
import { authRedirects } from "@/lib/auth/redirects";
import { getChatPageData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import {
  deleteMessageAction,
  editMessageAction,
  markReadStateAction,
  refreshConversationAction,
  refreshMessagesAction,
  sendMessageAction,
  toggleReactionAction,
} from "../../chat/actions";
import { ChatClient } from "../../chat/chat-client";

// Single-channel milestone: [id] is accepted for URL stability, but the only
// channel is `general`, resolved through the existing demo-community data path.
export default async function ChannelPage() {
  const data = await getChatPageData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (!data.chat) {
    return (
      <EmptyState
        title="The community is on its way"
        description="Your community space will appear here once it's ready."
      />
    );
  }

  return (
    <ChatClient
      chat={data.chat}
      sendMessageAction={sendMessageAction}
      editMessageAction={editMessageAction}
      deleteMessageAction={deleteMessageAction}
      toggleReactionAction={toggleReactionAction}
      markReadStateAction={markReadStateAction}
      refreshMessagesAction={refreshMessagesAction}
      refreshConversationAction={refreshConversationAction}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @fish/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(authenticated)/channels/[id]/page.tsx"
git commit -m "feat(channels): add /channels/[id] route reusing ChatClient"
```

---

### Task 5: Redirect `/chat` and point nav at the channel

**Files:**
- Modify: `apps/web/app/(authenticated)/chat/page.tsx` (replace body with redirect)
- Modify: `apps/web/components/shell/app-shell.tsx:40-49` (nav hrefs), `:116` (immersive path)

- [ ] **Step 1: Redirect `/chat` to the general channel**

Replace `apps/web/app/(authenticated)/chat/page.tsx` contents:

```tsx
import { redirect } from "next/navigation";

// Chat consolidated under /channels. The seed channel is `general`.
export default function ChatPage() {
  redirect("/channels/22222222-2222-4222-8222-222222222222");
}
```

- [ ] **Step 2: Update nav items + immersive check in `app-shell.tsx`**

```ts
const generalChannelHref = "/channels/22222222-2222-4222-8222-222222222222";

const clientNavItems: NavItem[] = [
  { href: "/home", label: "Home", Icon: IconHome },
  { href: generalChannelHref, label: "Community", Icon: IconUsersGroup },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

const coachNavItems: NavItem[] = [
  { href: "/coach", label: "Clients", Icon: IconUsers },
  { href: generalChannelHref, label: "Community", Icon: IconUsersGroup },
];
```

And update the immersive check (line ~116) to cover both paths:

```ts
const immersive =
  isActivePath(pathname, "/channels") || isActivePath(pathname, "/chat");
```

- [ ] **Step 3: Run shell tests + typecheck**

Run: `pnpm --filter @fish/web test run apps/web/app/\(authenticated\)/layout.test.tsx` (and any `app-shell` test found via `rg "app-shell" apps/web -l`), then `pnpm --filter @fish/web typecheck`
Expected: PASS (update any test asserting the old `/chat` href to the channel href).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(authenticated)/chat/page.tsx" apps/web/components/shell/app-shell.tsx
git commit -m "feat(channels): redirect /chat and route Community nav to general channel"
```

---

## Phase 2 — Shell simplification

### Task 6: Channel column in the app shell

**Files:**
- Modify: `apps/web/components/shell/app-shell.tsx`
- Test: extend the existing shell/layout test (or create `apps/web/components/shell/app-shell.test.tsx`)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/channels/22222222-2222-4222-8222-222222222222",
}));

describe("AppShell channel column", () => {
  it("shows the Community heading and the general channel when in a channel", () => {
    render(
      <AppShell displayName="Sam" role="client">
        <div>thread</div>
      </AppShell>
    );
    expect(screen.getByRole("heading", { name: /community/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /# general/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fish/web test run apps/web/components/shell/app-shell.test.tsx`
Expected: FAIL (no channel column rendered yet).

- [ ] **Step 3: Add a channel column, shown only on immersive (channel) routes**

In `AppShell`, after the `<aside>` rail and before `<div className="flex min-w-0 flex-1 flex-col">`, insert a channel column that renders only when `immersive` and on `md+`:

```tsx
{immersive && (
  <aside className="hidden w-channel-col shrink-0 flex-col border-r border-border bg-surface px-sm py-page md:flex">
    <h2 className="px-xs pb-sm text-ui-2xs font-medium uppercase tracking-wide text-muted">
      Community
    </h2>
    <nav aria-label="Channels" className="flex flex-col gap-3xs">
      <Link
        href="/channels/22222222-2222-4222-8222-222222222222"
        aria-current={isActivePath(pathname, "/channels") ? "page" : undefined}
        className={cn(
          "flex min-h-control items-center gap-2xs rounded-control px-sm text-ui-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
          isActivePath(pathname, "/channels") && "bg-surface-2 font-semibold text-foreground"
        )}
      >
        <span aria-hidden="true" className="text-muted">#</span>
        general
      </Link>
    </nav>
  </aside>
)}
```

Add a `--width-channel-col` token to `apps/web/app/globals.css` `@theme` (e.g. `--width-channel-col: 15rem;`) so `w-channel-col` resolves — do NOT use a raw `w-60`. If a suitable width token exists, reuse it instead.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fish/web test run apps/web/components/shell/app-shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/shell/app-shell.tsx apps/web/components/shell/app-shell.test.tsx apps/web/app/globals.css
git commit -m "feat(shell): add channel column beside the rail on channel routes"
```

> Mobile: the channel column is `hidden` on mobile by design. With one channel, the bottom-nav "Community" item opens the thread directly (list→thread collapses to a pass-through). A dedicated mobile channel-list screen is deferred until there is more than one channel.

---

### Task 7: Simplify the thread header

**Files:**
- Modify: `apps/web/app/(authenticated)/chat/chat-client.tsx:218-264` (header block)
- Test: `apps/web/app/(authenticated)/chat/chat-client.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("renders a simplified channel header with a search trigger and no subtitle line", () => {
  const communityChat: ClientChatData = {
    ...chat, kind: "community", channelName: "general", title: "general",
    participant: { id: chat.conversationId, displayName: "FISH Community", role: "coach" },
  };
  render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);
  expect(screen.getByRole("heading", { name: /# general/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /search messages/i })).toBeInTheDocument();
  // The always-open search input is gone; it only appears after opening search.
  expect(screen.queryByPlaceholderText("Search messages")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fish/web test run "apps/web/app/(authenticated)/chat/chat-client.test.tsx" -t "simplified channel header"`
Expected: FAIL.

- [ ] **Step 3: Replace the header block**

Replace lines ~218-264 with a compact header: channel name (`# {channelName}` for community, else participant name), member/presence line, and a search icon button that toggles a search field. Drop the `chatSubtitle` paragraph and the `<NotificationBadge>`.

```tsx
<header className="border-b border-border bg-surface px-md py-sm">
  <div className="flex items-center justify-between gap-sm">
    <div className="flex min-w-0 items-center gap-2xs">
      <h1 className="truncate font-display text-heading text-foreground">
        {isCommunity ? `# ${chat.channelName ?? chatTitle}` : chatTitle}
      </h1>
      <span className="shrink-0 text-ui-sm text-muted">
        {isCommunity
          ? `· ${memberCount} ${memberCount === 1 ? "member" : "members"}`
          : presenceStatus.label}
      </span>
    </div>
    <SearchFilterPopover
      value={search}
      onValueChange={setSearch}
    />
  </div>
</header>
```

Remove the now-unused `chatSubtitle` variable and the `IconSearch`/`IconX` inline search markup (the search field lives inside `SearchFilterPopover`, Task 11). Keep `search`/`setSearch` state and `filteredMessages`. Remove the `NotificationBadge` import if no longer used, and `unreadCount` if it becomes unused (it is still used by `useChatReadState` return — keep the hook call, just drop the badge render).

- [ ] **Step 4: Run test to verify it passes**

Run: same as Step 2.
Expected: PASS. (Until Task 11 lands, temporarily render a plain search icon button labeled "Search messages" so the test passes; Task 11 swaps in the real popover.)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(authenticated)/chat/chat-client.tsx" "apps/web/app/(authenticated)/chat/chat-client.test.tsx"
git commit -m "feat(chat): simplify channel header — drop subtitle and badge, collapse search"
```

---

## Phase 3 — Composer redesign

### Task 8: Composer bar shell (borderless input + conditional Send)

**Files:**
- Create: `apps/web/components/chat/composer/composer.tsx`
- Create: `apps/web/components/chat/composer/composer.test.tsx`
- Modify: `apps/web/components/chat/index.ts` (add `export * from "./composer/composer";`)

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./composer";

const baseProps = {
  channelName: "general",
  draft: "",
  canSend: false,
  localRecording: false,
  onDraftChange: vi.fn(),
  onSend: vi.fn(),
  onKeyDown: vi.fn(),
  onBlur: vi.fn(),
  onToggleRecording: vi.fn(),
  onSelectEmoji: vi.fn(),
  onStub: vi.fn(),
};

describe("Composer", () => {
  it("uses the channel-aware placeholder", () => {
    render(<Composer {...baseProps} />);
    expect(screen.getByPlaceholderText("Message #general")).toBeInTheDocument();
  });

  it("hides Send until there is text", () => {
    const { rerender } = render(<Composer {...baseProps} canSend={false} />);
    expect(screen.queryByRole("button", { name: /send message/i })).toBeNull();
    rerender(<Composer {...baseProps} canSend />);
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fish/web test run apps/web/components/chat/composer/composer.test.tsx`
Expected: FAIL ("Cannot find module './composer'").

- [ ] **Step 3: Implement the composer bar**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  IconGif,
  IconMoodSmile,
  IconSend,
  IconSticker,
} from "@tabler/icons-react";
import type { KeyboardEvent } from "react";
import { EmojiPickerButton } from "../emoji-picker/emoji-picker";
import { AddMenu } from "./add-menu";

export interface ComposerProps {
  channelName: string;
  draft: string;
  canSend: boolean;
  localRecording: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onToggleRecording: () => void;
  onSelectEmoji: (emoji: string) => void;
  /** Fired by stubbed affordances (upload/poll/gif/sticker) with a label. */
  onStub: (label: string) => void;
}

const iconButton =
  "inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body";

export function Composer({
  channelName,
  draft,
  canSend,
  localRecording,
  onDraftChange,
  onSend,
  onKeyDown,
  onBlur,
  onToggleRecording,
  onSelectEmoji,
  onStub,
}: ComposerProps) {
  return (
    <div className="p-sm">
      {/* Borderless bar: no border/ring on the input; a subtle focus-within
          ring on the container preserves the visible-focus a11y floor. */}
      <div className="flex items-end gap-xs rounded-control bg-surface-2 p-xs focus-within:outline focus-within:outline-2 focus-within:outline-primary">
        <AddMenu
          onUploadFile={() => onStub("Upload File")}
          onAudioRecording={onToggleRecording}
          onCreatePoll={() => onStub("Create Poll")}
          recording={localRecording}
        />
        <textarea
          aria-label="Message"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          rows={1}
          enterKeyHint="send"
          className="min-h-control flex-1 resize-none border-none bg-transparent px-xs py-field-y text-copy text-foreground outline-none placeholder:text-muted"
          placeholder={`Message #${channelName}`}
        />
        <button type="button" aria-label="Add a GIF" onClick={() => onStub("GIFs")} className={iconButton}>
          <IconGif size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Add a sticker" onClick={() => onStub("Stickers")} className={iconButton}>
          <IconSticker size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <EmojiPickerButton label="Add an emoji" onSelect={onSelectEmoji} className={iconButton}>
          <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />
        </EmojiPickerButton>
        {canSend && (
          <Button
            type="button"
            fullWidth={false}
            onClick={onSend}
            className="shrink-0 px-md"
            aria-label="Send message"
          >
            <IconSend size={20} stroke={1.75} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

> `AddMenu` is created in Task 9. To make this task's tests pass in isolation, stub `add-menu.tsx` with a minimal `+` button first (Task 9 fills it in), OR sequence Task 9 immediately after and run both test files together.

- [ ] **Step 4: Add barrel export**

In `apps/web/components/chat/index.ts` add: `export * from "./composer/composer";`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @fish/web test run apps/web/components/chat/composer/composer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/chat/composer/composer.tsx apps/web/components/chat/composer/composer.test.tsx apps/web/components/chat/index.ts
git commit -m "feat(chat): borderless composer bar with conditional Send"
```

---

### Task 9: The `+` menu (Upload File / Audio Recording / Create Poll)

**Files:**
- Create: `apps/web/components/chat/composer/add-menu.tsx`
- Test: `apps/web/components/chat/composer/add-menu.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddMenu } from "./add-menu";

describe("AddMenu", () => {
  it("opens and shows the three actions", () => {
    render(
      <AddMenu
        onUploadFile={vi.fn()}
        onAudioRecording={vi.fn()}
        onCreatePoll={vi.fn()}
        recording={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /add to message/i }));
    expect(screen.getByRole("menuitem", { name: /upload file/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /audio recording/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /create poll/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fish/web test run apps/web/components/chat/composer/add-menu.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement with Base UI Menu** (follows the Popover pattern from `emoji-picker.tsx`)

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Menu } from "@base-ui/react/menu";
import { IconMicrophone, IconPlus, IconChartBar, IconUpload } from "@tabler/icons-react";

interface AddMenuProps {
  onUploadFile: () => void;
  onAudioRecording: () => void;
  onCreatePoll: () => void;
  recording: boolean;
}

const item =
  "flex min-h-control items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2";

export function AddMenu({
  onUploadFile,
  onAudioRecording,
  onCreatePoll,
  recording,
}: AddMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Add to message"
        className={cn(
          "inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body",
          recording && "bg-surface-2 text-foreground"
        )}
      >
        <IconPlus size={20} stroke={1.75} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={4} className="z-20">
          <Menu.Popup className="min-w-menu rounded-card border border-border bg-surface p-3xs shadow-popover">
            <Menu.Item className={item} onClick={onUploadFile}>
              <IconUpload size={20} stroke={1.75} aria-hidden="true" />
              Upload File
            </Menu.Item>
            <Menu.Item className={item} onClick={onAudioRecording}>
              <IconMicrophone size={20} stroke={1.75} aria-hidden="true" />
              Audio Recording
            </Menu.Item>
            <Menu.Item className={item} onClick={onCreatePoll}>
              <IconChartBar size={20} stroke={1.75} aria-hidden="true" />
              Create Poll
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
```

Add a `--width-menu` token (or reuse an existing min-width token) in `globals.css` so `min-w-menu` resolves; otherwise use an existing token utility. Verify the exact Base UI Menu sub-component names against installed `@base-ui/react@^1.6.0` (`rg "Menu\\." node_modules/@base-ui/react/menu` or the package README) — adjust `Positioner`/`Popup`/`Item` names if the version differs.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fish/web test run apps/web/components/chat/composer/add-menu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/chat/composer/add-menu.tsx apps/web/components/chat/composer/add-menu.test.tsx apps/web/app/globals.css
git commit -m "feat(chat): + menu with Upload File, Audio Recording, Create Poll"
```

---

### Task 10: Wire the composer into `ChatClient` (real emoji/audio, stub notice)

**Files:**
- Modify: `apps/web/app/(authenticated)/chat/chat-client.tsx:626-665` (footer) + add a stub-notice state

- [ ] **Step 1: Write the failing test**

```tsx
it("shows a calm coming-soon notice when a stubbed affordance is used", async () => {
  const communityChat: ClientChatData = { ...chat, kind: "community", channelName: "general" };
  render(<ChatClient chat={communityChat} sendMessageAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /add a gif/i }));
  expect(await screen.findByText(/coming soon/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fish/web test run "apps/web/app/(authenticated)/chat/chat-client.test.tsx" -t "coming-soon"`
Expected: FAIL.

- [ ] **Step 3: Replace the footer with `<Composer>` and add stub notice**

Add near the other `useState`s:

```tsx
const [stubNotice, setStubNotice] = useState<string | null>(null);
```

Replace the entire footer `<div className="flex items-end gap-xs border-t ...">…</div>` (lines ~626-665) with:

```tsx
<Composer
  channelName={chat.channelName ?? chatTitle}
  draft={draft}
  canSend={canSend}
  localRecording={localRecording}
  onDraftChange={handleDraftChange}
  onSend={() => {
    scrollToBottom();
    void handleSend();
  }}
  onKeyDown={handleComposerKeyDown}
  onBlur={stopLocalTyping}
  onToggleRecording={() => setLocalVoiceRecording(!localRecording)}
  onSelectEmoji={(emoji) => handleDraftChange(draft + emoji)}
  onStub={(label) => setStubNotice(`${label} are coming soon.`)}
/>
```

Render the stub notice above the composer (reuse the existing `notice` Alert region pattern):

```tsx
{stubNotice && (
  <Alert tone="notice" className="mx-md mb-xs">
    {stubNotice}
  </Alert>
)}
```

Import `Composer` from `@/components/chat`. Remove the now-unused `IconMicrophone`, `IconSend`, `IconMoodSmile` imports and the old inline mic/textarea/Send markup and `Button` import if unused elsewhere in the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fish/web test run "apps/web/app/(authenticated)/chat/chat-client.test.tsx"`
Expected: PASS (fix any assertions in the existing suite that referenced the old inline composer markup — e.g. the mic button; update them to the new labels).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(authenticated)/chat/chat-client.tsx" "apps/web/app/(authenticated)/chat/chat-client.test.tsx"
git commit -m "feat(chat): use Composer in ChatClient — real emoji/audio, stubbed rest"
```

---

## Phase 4 — Search filters (UI-only stubs)

### Task 11: Search-filter Popover

**Files:**
- Create: `apps/web/components/chat/search-filters/search-filter-popover.tsx`
- Create: `apps/web/components/chat/search-filters/search-filters.test.tsx`
- Modify: `apps/web/components/chat/index.ts`; wire into `chat-client.tsx` header (replace the placeholder search button from Task 7)

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchFilterPopover } from "./search-filter-popover";

describe("SearchFilterPopover", () => {
  it("opens quick filters and can reach More filters", () => {
    render(<SearchFilterPopover value="" onValueChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /search messages/i }));
    expect(screen.getByText(/from a specific user/i)).toBeInTheDocument();
    expect(screen.getByText(/sent in a specific channel/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /more filters/i }));
    expect(screen.getByRole("dialog", { name: /filters/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fish/web test run apps/web/components/chat/search-filters/search-filters.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the Popover** (Base UI Popover, mirrors `emoji-picker.tsx`; opens `FiltersDialog` from Task 12)

```tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { IconAt, IconHash, IconPaperclip, IconSearch, IconUser } from "@tabler/icons-react";
import { useState } from "react";
import { FiltersDialog } from "./filters-dialog";

interface SearchFilterPopoverProps {
  value: string;
  onValueChange: (value: string) => void;
}

const quickFilters = [
  { Icon: IconUser, title: "From a specific user", token: "from:", hint: "user" },
  { Icon: IconHash, title: "Sent in a specific channel", token: "in:", hint: "channel" },
  { Icon: IconPaperclip, title: "Includes a specific type of data", token: "has:", hint: "link, embed or file" },
  { Icon: IconAt, title: "Mentions a specific user", token: "mentions:", hint: "user" },
];

export function SearchFilterPopover({ value, onValueChange }: SearchFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          aria-label="Search messages"
          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
        >
          <IconSearch size={20} stroke={1.75} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={4} className="z-20">
            <Popover.Popup className="w-search-pop rounded-card border border-border bg-surface p-3xs shadow-popover">
              <label className="flex min-h-control items-center gap-xs rounded-control bg-surface-2 px-sm text-ui-sm">
                <IconSearch size={18} stroke={1.75} aria-hidden="true" />
                <input
                  aria-label="Search messages"
                  value={value}
                  onChange={(event) => onValueChange(event.target.value)}
                  placeholder="Search messages"
                  className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted"
                />
              </label>
              <p className="px-sm pb-2xs pt-sm text-ui-2xs font-medium uppercase tracking-wide text-muted">Filters</p>
              <ul className="flex flex-col">
                {quickFilters.map(({ Icon, title, token, hint }) => (
                  <li key={token}>
                    <button
                      type="button"
                      onClick={() => onValueChange(`${value}${token} `.trimStart())}
                      className="flex w-full min-h-control items-start gap-sm rounded-control px-sm py-2xs text-left hover:bg-surface-2"
                    >
                      <Icon size={20} stroke={1.75} aria-hidden="true" className="mt-3xs text-muted" />
                      <span>
                        <span className="block text-ui-sm text-foreground">{title}</span>
                        <span className="block text-ui-xs text-muted">
                          <span className="text-body">{token}</span> {hint}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setFiltersOpen(true); }}
                    className="flex w-full min-h-control items-center gap-sm rounded-control px-sm py-2xs text-left text-ui-sm text-foreground hover:bg-surface-2"
                  >
                    More filters
                  </button>
                </li>
              </ul>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <FiltersDialog open={filtersOpen} onOpenChange={setFiltersOpen} />
    </>
  );
}
```

Add a `--width-search-pop` token so `w-search-pop` resolves.

- [ ] **Step 4: Run test to verify it passes** (needs Task 12's `FiltersDialog`; sequence them together)

Run: `pnpm --filter @fish/web test run apps/web/components/chat/search-filters/search-filters.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into the header + barrel, remove Task 7 placeholder**

In `apps/web/components/chat/index.ts` add `export * from "./search-filters/search-filter-popover";`. Confirm the header in `chat-client.tsx` now renders `<SearchFilterPopover value={search} onValueChange={setSearch} />` (replacing the Task 7 placeholder button).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/chat/search-filters/search-filter-popover.tsx apps/web/components/chat/search-filters/search-filters.test.tsx apps/web/components/chat/index.ts "apps/web/app/(authenticated)/chat/chat-client.tsx" apps/web/app/globals.css
git commit -m "feat(chat): search quick-filter popover (UI only)"
```

---

### Task 12: Filters dialog / bottom sheet (responsive, UI-only)

**Files:**
- Create: `apps/web/components/chat/search-filters/filters-dialog.tsx`
- Test: extend `search-filters.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { FiltersDialog } from "./filters-dialog";

it("renders the filter fields and inert footer actions", () => {
  render(<FiltersDialog open onOpenChange={vi.fn()} />);
  const dialog = screen.getByRole("dialog", { name: /filters/i });
  ["From", "In", "Has", "Mentions", "Date"].forEach((label) =>
    expect(within(dialog).getByText(label)).toBeInTheDocument()
  );
  expect(within(dialog).getByRole("button", { name: /apply/i })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
});
```

Add `within` to the testing-library import.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fish/web test run apps/web/components/chat/search-filters/search-filters.test.tsx -t "filter fields"`
Expected: FAIL.

- [ ] **Step 3: Implement with Base UI Dialog** (bottom sheet on mobile via responsive positioner classes)

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";

interface FiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fields = [
  { label: "From", desc: "Sent by any of the selected people", placeholder: "Anyone" },
  { label: "In", desc: "Sent in any of the selected channels", placeholder: "ex. general" },
  { label: "Has", desc: "Includes any of the selected types of data", placeholder: "Any content" },
  { label: "Mentions", desc: "Mentions any of the selected people", placeholder: "Anyone" },
];

export function FiltersDialog({ open, onOpenChange }: FiltersDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/40" />
        <Dialog.Popup
          className="fixed z-40 flex flex-col border border-border bg-surface shadow-popover
                     inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card
                     md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[80dvh] md:w-filters-dialog md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
        >
          <div className="flex items-center justify-between border-b border-border px-md py-sm">
            <Dialog.Title className="font-display text-heading text-foreground">Filters</Dialog.Title>
            <Dialog.Close
              aria-label="Close filters"
              className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
            >
              <IconX size={20} stroke={1.75} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-md overflow-y-auto px-md py-md">
            {fields.map((field) => (
              <div key={field.label}>
                <p className="text-ui-sm font-semibold text-foreground">{field.label}</p>
                <p className="mb-2xs text-ui-xs text-muted">{field.desc}</p>
                <div className="flex min-h-control items-center justify-between rounded-control border border-border px-sm text-ui-sm text-muted">
                  {field.placeholder}
                  <span aria-hidden="true">▾</span>
                </div>
              </div>
            ))}
            <div>
              <p className="text-ui-sm font-semibold text-foreground">Date</p>
              <p className="mb-2xs text-ui-xs text-muted">When the message was sent</p>
              <button type="button" className="flex min-h-control w-full items-center justify-center gap-2xs rounded-control bg-surface-2 text-ui-sm text-foreground">
                + Add date
              </button>
            </div>
          </div>
          <div className="flex items-center gap-sm border-t border-border px-md py-sm">
            <button type="button" className="text-ui-sm text-muted hover:text-body" onClick={() => onOpenChange(false)}>
              Clear filters
            </button>
            <span className="flex-1" />
            <Button variant="ghost" fullWidth={false} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button fullWidth={false} onClick={() => onOpenChange(false)}>Apply</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Add tokens `--width-filters-dialog` (e.g. `24rem`) so `w-filters-dialog` resolves. The `max-h-[85dvh]` arbitrary values are viewport constraints, not spacing — acceptable, but if the project prefers a token, add `--height-sheet-max`. Verify Base UI `Dialog` sub-component names against `@base-ui/react@^1.6.0`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fish/web test run apps/web/components/chat/search-filters/search-filters.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/chat/search-filters/filters-dialog.tsx apps/web/components/chat/search-filters/search-filters.test.tsx apps/web/app/globals.css
git commit -m "feat(chat): responsive Filters dialog/sheet (UI only)"
```

---

## Phase 5 — Harness + verification

### Task 13: Update the dev kit harness

**Files:**
- Modify: `apps/web/app/kit/chat-live/page.tsx`

- [ ] **Step 1: Add channel fields to the mock chat**

In the `chat` object (line ~82), add `channelId`, `channelSlug: "general"`, `channelName: "general"`, and set `title: "general"`; drop `subtitle`. The harness renders the real `ChatClient`, so the new header/composer/search are exercised automatically.

```tsx
const chat: ClientChatData = {
  conversationId,
  kind: "community",
  channelId: "22222222-2222-4222-8222-222222222222",
  channelSlug: "general",
  channelName: "general",
  title: "general",
  currentUserId: you,
  currentUserRole: "coach",
  participant: { id: "user-jordan", displayName: "Coach Jordan", role: "coach" },
  messages,
  readStates: [],
};
```

- [ ] **Step 2: Manually verify in the browser (preview tools)**

Start the dev server and load `/kit/chat-live`. Confirm: `# general` header, search icon opens the popover, "More filters" opens the dialog, `+` menu shows three items, GIF/sticker tap shows a "coming soon" notice, emoji inserts, Send appears only with text.
Expected: all behaviors present; no console errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/kit/chat-live/page.tsx
git commit -m "chore(kit): exercise channel shell + new composer in chat-live harness"
```

---

### Task 14: Full verification gate

- [ ] **Step 1: Typecheck the web app**

Run: `pnpm --filter @fish/web typecheck`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `pnpm --filter @fish/web lint`
Expected: PASS (no raw hex, no one-off numeric spacing utilities introduced).

- [ ] **Step 3: Run the full web test suite once**

Run: `pnpm --filter @fish/web test run`
Expected: PASS.

- [ ] **Step 4: Production build (required before merge)**

Run: `pnpm build`
Expected: build + shared package typechecks pass.

- [ ] **Step 5: Final commit if any fixups were needed**

```bash
git add -A
git commit -m "chore(channels): verification fixups"
```

---

## Self-review notes (author checklist — already applied)

- **Spec coverage:** channels model (Task 1-3), routing `/channels/[id]` + redirect (Task 4-5), rail/channel column (Task 6), simplified header (Task 7), composer bar + `+` menu + wiring with real emoji/audio + stubs (Task 8-10), search popover + responsive filters dialog (Task 11-12), harness + verification (Task 13-14). Mobile channel-list screen is explicitly deferred (single channel), matching the spec's derived-and-flagged note.
- **Base UI risk:** `Menu` and `Dialog` are not yet used in the repo (only `Popover`/`Tabs`/`ScrollArea`). Each relevant task includes a step to verify sub-component names against `@base-ui/react@^1.6.0` before finalizing.
- **Token risk:** several new width tokens (`--width-channel-col`, `--width-menu`, `--width-search-pop`, `--width-filters-dialog`) must be added to `globals.css @theme` rather than using raw `w-*` numeric utilities, to respect the design-token rule.
- **Sequencing:** Tasks 8↔9 and 11↔12 are mutually dependent (component imports its sibling); implement each pair together and run their test files jointly.
