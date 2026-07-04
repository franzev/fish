---
phase: quick-260704-inu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/globals.css
  - apps/web/components/chat/types.ts
  - apps/web/components/chat/avatar.tsx
  - apps/web/components/chat/presence-indicator.tsx
  - apps/web/components/chat/message-meta.tsx
  - apps/web/components/chat/message-status.tsx
  - apps/web/components/chat/typing-indicator.tsx
  - apps/web/components/chat/reactions.tsx
  - apps/web/components/chat/quoted-message.tsx
  - apps/web/components/chat/message-actions.tsx
  - apps/web/components/chat/attachments.tsx
  - apps/web/components/chat/voice-player.tsx
  - apps/web/components/chat/link-preview.tsx
  - apps/web/components/chat/bubble.tsx
  - apps/web/components/chat/message.tsx
  - apps/web/components/chat/message-list.tsx
  - apps/web/components/chat/unread-divider.tsx
  - apps/web/components/chat/skeleton.tsx
  - apps/web/components/chat/empty-state.tsx
  - apps/web/components/chat/chat-header.tsx
  - apps/web/components/chat/chat-input.tsx
  - apps/web/components/chat/chat-container.tsx
  - apps/web/components/chat/conversation-list.tsx
  - apps/web/components/chat/notification-badge.tsx
  - apps/web/components/chat/index.ts
  - apps/web/components/chat/chat.test.tsx
  - apps/web/app/kit/chat/page.tsx
  - apps/web/app/kit/chat/mock-data.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Every chat component renders using @theme design tokens only — no raw hex, no dark: branches — so both light and dark resolve via light-dark()"
    - "Sent and received bubbles are visually distinct and both legible in light and dark theme"
    - "Avatar falls back image -> initials -> neutral placeholder without crashing on missing src"
    - "Interactive controls (input, send, emoji, attach, message actions, conversation rows) are keyboard-focusable, carry ARIA labels, and meet the 56px control floor where they are primary tap targets"
    - "Animations (new message entrance, typing dots, reaction pop) are defined as @utility/@keyframes in globals.css and are silenced under prefers-reduced-motion by the existing global rule"
    - "A dev-only /kit/chat route renders every component and state with mock data, unlinked from client-facing navigation"
    - "pnpm build passes and vitest passes"
  artifacts:
    - path: "apps/web/components/chat/types.ts"
      provides: "Shared presentational types (ChatMessageView, ChatParticipantView, MessageStatus, Reaction, Attachment) the components render against"
      contains: "export type MessageStatus"
    - path: "apps/web/components/chat/bubble.tsx"
      provides: "Sent/received chat bubble with tail, variants, states"
      contains: "forwardRef"
    - path: "apps/web/components/chat/chat-container.tsx"
      provides: "Responsive shell composing header + scrollable message list + input"
      min_lines: 25
    - path: "apps/web/components/chat/conversation-list.tsx"
      provides: "Sidebar conversation list with search + unread badges"
      contains: "search"
    - path: "apps/web/components/chat/index.ts"
      provides: "Barrel export for the whole chat kit"
      contains: "export"
    - path: "apps/web/app/kit/chat/page.tsx"
      provides: "Dev-only showcase route rendering all components with mock data"
      contains: "KitThemeToggle"
  key_links:
    - from: "apps/web/components/chat/*.tsx"
      to: "apps/web/app/globals.css @theme tokens"
      via: "Tailwind utility classes (bg-surface, text-body, rounded-card, min-h-[var(--size-control)])"
      pattern: "(bg-surface|text-body|text-muted|rounded-card|rounded-control|min-h-\\[var\\(--size-control\\)\\])"
    - from: "apps/web/components/chat/*.tsx"
      to: "@tabler/icons-react"
      via: "icon imports (single icon set — enforced by icon-source.test.ts)"
      pattern: "from \"@tabler/icons-react\""
    - from: "apps/web/app/kit/chat/page.tsx"
      to: "apps/web/components/chat/index.ts"
      via: "barrel import of the chat kit"
      pattern: "from \"@/components/chat\""
---

<objective>
Build a modern, monochrome chat interface component library for the FISH web app (`apps/web`), organized as a reusable design-system kit under `apps/web/components/chat/`, plus a dev-only `/kit/chat` showcase route that renders every component and state with mock data.

This is UI only: no Supabase wiring, no realtime, no data fetching. Every component is presentational — it takes props and renders. Chat is on the approved build order (1-on-1 chat + shared UI kit); this delivers the visual/interaction layer that later phases will wire to Supabase.

Purpose: give the app a complete, token-driven, accessible chat surface that obeys FISH design rules (calm, monochrome, one primary action per view, big tap targets, no scolding copy) and works in both light and dark theme with zero JS theme branching.

Output: ~24 component files under `apps/web/components/chat/`, new animation tokens in `globals.css`, a barrel `index.ts`, a component test file, and the `/kit/chat` showcase route with mock data.
</objective>

<execution_context>
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/workflows/execute-plan.md
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.claude/CLAUDE.md
@apps/web/app/globals.css
@apps/web/lib/utils.ts
@apps/web/components/ui/button.tsx
@apps/web/components/ui/input.tsx
@apps/web/components/ui/card.tsx
@apps/web/components/ui/alert.tsx
@apps/web/app/kit/page.tsx
@apps/web/components/kit/theme-toggle.tsx
@apps/web/tests/icon-source.test.ts
@apps/web/components/ui/button.test.tsx

<interfaces>
<!-- Established conventions extracted from the codebase. Follow these exactly — no exploration needed. -->

Design tokens (Tailwind utilities from @theme in globals.css — NEVER raw hex):
- Backgrounds: `bg-bg` (canvas), `bg-surface` (cards/inputs), `bg-surface-2` (alt rows / wells / progress track)
- Borders: `border-border`, `border-border-strong`
- The ONE action per screen: `bg-primary` `text-on-primary` `hover:bg-primary-press` (full-contrast inversion, not a hue)
- Text: `text-foreground` (headings) · `text-body` · `text-muted` (captions/placeholders/hints)
- Feedback: `text-notice` (monochrome), `text-error` / `text-warning` / `text-success` (calm desaturated hues — never for chrome, only real feedback)
- Radius: `rounded-card` (16px) · `rounded-control` (12px) · `rounded-pill`
- Tap target floor: `min-h-[var(--size-control)]` (56px) — for primary tap targets (input, send, conversation rows)
- Elevation: `shadow-[var(--shadow-card)]` (soft in light, none in dark — a token, not a dark: branch)

Utilities & primitives:
```typescript
// apps/web/lib/utils.ts — merge conditional classes, resolve Tailwind conflicts
export function cn(...inputs: ClassValue[]): string;

// apps/web/components/ui/button.tsx
export const Button: forwardRef; // variant: "primary" | "secondary" | "ghost"; fullWidth (default true); loading
// apps/web/components/ui/input.tsx
export const Input: forwardRef; // label (required), hint, notice, error
// apps/web/components/ui/card.tsx
export function Card(props: HTMLAttributes<HTMLDivElement>);
export function Progress({ value, label }); // value 0-100, visual only, never a grade
// apps/web/components/ui/alert.tsx
export function Alert({ tone: "notice"|"warning"|"error"|"success", children });
```

Icons (single set — enforced by tests/icon-source.test.ts, which fails the suite on react-icons / heroicons / lucide):
```typescript
import { IconSend, IconMoodSmile, IconPaperclip, IconDots, IconCheck, IconChecks, IconSearch } from "@tabler/icons-react";
// convention: size={20} stroke={1.75} (or stroke={2} for emphasis) aria-hidden="true"
```

Dual-theme rule: colors come from tokens that are ALREADY `light-dark(light, dark)` pairs. Components use plain utilities (`bg-surface`) — NEVER `dark:` variants, NEVER a theme prop, NEVER raw hex. Zero JS theme branching.

Accessibility floor (already global in globals.css): `:focus-visible` two-tone ring, `prefers-reduced-motion` silences all animation/transition. Do not re-implement these; just don't fight them (e.g. don't set `outline-none` without restoring focus).

Animation pattern (globals.css): keyframes via `@keyframes name {}`, exposed as a Tailwind class via `@utility animate-name { animation: name 200ms ease-out; }`. Existing example: `@utility animate-fade-in`.

Showcase route pattern (apps/web/app/kit/page.tsx): a server component, one long calm scroll, `<KitThemeToggle />` at top (the only client island), sections per component with every variant/state, unlinked from production nav (ships but not navigable).

Vitest: jsdom env, globals on, @testing-library/react + jest-dom, `@/*` alias to apps/web root. Test files co-located as `*.test.tsx`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Message primitives — types, atoms, and animation tokens</name>
  <files>apps/web/app/globals.css, apps/web/components/chat/types.ts, apps/web/components/chat/avatar.tsx, apps/web/components/chat/presence-indicator.tsx, apps/web/components/chat/message-meta.tsx, apps/web/components/chat/message-status.tsx, apps/web/components/chat/typing-indicator.tsx, apps/web/components/chat/reactions.tsx, apps/web/components/chat/quoted-message.tsx, apps/web/components/chat/message-actions.tsx, apps/web/components/chat/attachments.tsx, apps/web/components/chat/voice-player.tsx, apps/web/components/chat/link-preview.tsx, apps/web/components/chat/chat.test.tsx</files>
  <behavior>
    - Avatar: given a valid `src`, renders an `<img>` with `alt`; given no `src` but a `name`, renders derived initials (max 2 chars, uppercase); given neither, renders a neutral placeholder glyph — never throws. `size` prop (sm/md/lg) maps to token-based dimensions.
    - MessageStatus: renders a distinct visual per status ("sending" | "sent" | "delivered" | "read") using Tabler check/checks icons; carries an `aria-label` describing the status (e.g. "Read").
    - TypingIndicator: renders three dots animated via the `animate-typing` utility; has an accessible label ("typing"); is silent under prefers-reduced-motion (dots hold, no error).
    - Reactions: renders a list of {emoji, count} pills; the current user's reaction pill is visually marked; each pill is a button with an aria-label; empty list renders nothing.
    - QuotedMessage: renders author + snippet of a replied-to message with a leading accent rail; long snippets truncate to a single line.
    - MessageActions: renders copy/edit/delete/reply/forward as icon buttons with aria-labels; destructive "delete" uses calm feedback tone, never alarming red chrome.
  </behavior>
  <action>
    First, add three keyframes + `@utility` classes to `apps/web/app/globals.css` (after the existing `animate-fade-in` block, same style): `animate-message-in` (opacity + small translate-y entrance, ~200ms ease-out), `animate-typing` (staggered three-dot bounce loop — implement as one keyframe applied with per-dot `animation-delay` inline or utility), and `animate-reaction-pop` (brief scale pop, ~180ms). Do NOT add per-animation reduced-motion guards — the existing global `@media (prefers-reduced-motion: reduce)` rule in the base layer already clamps every animation/transition duration; adding more would duplicate it. No `tailwind.config.js` — these live in the CSS.

    Create `types.ts` FIRST as the shared contract every later file imports: presentational-only types `MessageStatus` (union of the four states), `Reaction` ({emoji, count, byMe}), `Attachment` (discriminated union on `kind`: "image" | "video" | "file" | "audio" with the fields each needs — url, name, size, mime, poster/duration as applicable), `ChatParticipantView` ({id, name, avatarUrl?, online?}), and `ChatMessageView` ({id, author: ChatParticipantView, body?, sentAt (Date|string), mine: boolean, status?: MessageStatus, reactions?, attachments?, replyTo?}). These are view models — no Supabase types, no `@fish/core` dependency required (mirror shape only if convenient). Keep the file types-only so downstream tasks build against a fixed contract.

    Then build the atoms. Every component: named export, `cn()` for classes, tokens only (no raw hex, no `dark:`), Tabler icons at `size={20} stroke={1.75}` with `aria-hidden`. Focusable controls (reaction pills, action buttons) use `forwardRef` + `displayName` per the Button/Input convention and get real `aria-label`s. Follow the calm-copy rule: delete confirmation/label copy explains, never scolds; use `text-notice`/feedback tokens, never a red chrome slab. Avatar fallback chain must be crash-proof (guard missing src with state or conditional render, derive initials safely from name). VoicePlayer and Attachments (image/video/file/audio) are presentational: a play/pause control (button, aria-label), a visual scrubber/waveform placeholder (no real audio decode needed), and file/size metadata using `text-muted`. LinkPreview renders a YouTube-style card: thumbnail area, title, source label, all token-styled, wrapped in a single focusable link.

    Finally, create `chat.test.tsx` (the co-located suite for the whole kit, extended in later tasks). Cover the behaviors above with @testing-library/react: avatar fallback chain (image / initials / placeholder), MessageStatus aria-label per state, TypingIndicator has an accessible label, Reactions marks the byMe pill and renders nothing when empty, MessageActions exposes aria-labels for all five actions. Assert token classes where load-bearing (e.g. bubbles/pills carry `bg-surface`/`rounded-pill`), mirroring the style of `button.test.tsx`.
  </action>
  <verify>
    <automated>cd apps/web && pnpm exec vitest run components/chat/chat.test.tsx tests/icon-source.test.ts</automated>
  </verify>
  <done>types.ts exports MessageStatus/Reaction/Attachment/ChatParticipantView/ChatMessageView; all atom components render with token-only classes; avatar fallback chain never throws; new animate-* utilities exist in globals.css; chat.test.tsx passes; icon-source guard still green (no non-Tabler icon import).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Message composition + chat shell (bubble, list, header, input, container)</name>
  <files>apps/web/components/chat/bubble.tsx, apps/web/components/chat/message.tsx, apps/web/components/chat/message-list.tsx, apps/web/components/chat/unread-divider.tsx, apps/web/components/chat/skeleton.tsx, apps/web/components/chat/empty-state.tsx, apps/web/components/chat/chat-header.tsx, apps/web/components/chat/chat-input.tsx, apps/web/components/chat/chat-container.tsx, apps/web/components/chat/chat.test.tsx</files>
  <behavior>
    - Bubble: `mine` (sent) vs received render visually distinct (sent uses the inverted primary block; received uses surface) and both stay legible; carries an entrance via `animate-message-in`; `forwardRef` to the bubble element.
    - Message: composes Avatar + MessageMeta (username + timestamp) + Bubble + optional Reactions/QuotedMessage/Attachments/MessageStatus into one row; sent rows align end, received align start; avatar hidden on consecutive same-author messages (grouping).
    - MessageList: scrollable region (`overflow-y-auto`) with `role="log"` and an aria-label; renders messages, inserts UnreadDivider before the first unread, and exposes an `onLoadOlder` affordance at the top (infinite-scroll trigger — a sentinel div + optional "Loading older messages" skeleton state). No real IntersectionObserver wiring required, but expose the callback prop and a top loading slot.
    - ChatInput: a text field + emoji button + attachment button + ONE primary send button (the single primary action in the view). Send is disabled when empty; Enter submits, Shift+Enter newlines. Emoji/attach are secondary/ghost affordances, never competing primaries. All buttons have aria-labels and meet the tap-target floor.
    - EmptyState / Skeleton: EmptyState is a calm centered message ("No messages yet" voice-appropriate copy, no scolding); Skeleton renders shimmer placeholders for loading messages using surface tokens.
  </behavior>
  <action>
    Build against the `types.ts` contract from Task 1 — import `ChatMessageView`, `ChatParticipantView`, etc.; do not redefine them. Reuse the Task 1 atoms (Avatar, MessageMeta, MessageStatus, Reactions, QuotedMessage, Attachments) inside Message — compose, don't re-implement.

    Bubble: implement sent vs received as a `mine` boolean (not a color prop). Sent = `bg-primary text-on-primary` (this is the message's own emphasis block, consistent with "inverted block" — it is NOT a second competing primary *button*; the single-primary-action rule is about action buttons, and here the ONE action button is Send in ChatInput). Received = `bg-surface text-body border border-border`. Both `rounded-card` with an asymmetric corner for the tail. Apply `animate-message-in` on mount. `forwardRef` + `displayName`.

    ChatInput: the send button is the sole `Button variant="primary"` in the composed chat view — emoji and attachment are `variant="ghost"`/icon buttons so exactly one primary exists per screen (FISH rule 1). Wire Enter-to-send / Shift+Enter-newline on the textarea; disable send when trimmed value is empty. Every control `min-h-[var(--size-control)]` where it is a real tap target and has an `aria-label`. Copy on any inline hint uses `text-notice`, never red.

    MessageList: `role="log"`, `aria-label`, `overflow-y-auto`, vertical rhythm via spacing tokens. Insert `<UnreadDivider>` before the first message whose id matches a `firstUnreadId` prop. Add a top sentinel `<div>` and call `onLoadOlder?.()` prop wiring (expose the prop; a comment noting the IntersectionObserver hookup is a later data-phase concern). Render a `loadingOlder` skeleton slot at the top when that prop is true.

    ChatContainer: the responsive shell — a column flex that stacks `ChatHeader` (fixed top) + `MessageList` (flex-1, scrolls) + `ChatInput` (fixed bottom). Mobile-first full-width; on `md:` it sits within a bounded pane. Uses only responsive Tailwind prefixes, no JS breakpoints.

    ChatHeader: participant avatar + name + presence text + action buttons (call/info/menu as ghost icon buttons with aria-labels). One row, token-styled, `border-b border-border`.

    Extend `apps/web/components/chat/chat.test.tsx` (append, do not rewrite Task 1 cases): bubble mine-vs-received token classes differ; Message aligns sent end / received start; ChatInput disables send when empty and enables when text is present, and has exactly one primary button; MessageList exposes role="log" and renders UnreadDivider at firstUnreadId; EmptyState renders its calm copy.
  </action>
  <verify>
    <automated>cd apps/web && pnpm exec vitest run components/chat/chat.test.tsx</automated>
  </verify>
  <done>Bubble/Message/MessageList/ChatInput/ChatHeader/ChatContainer/UnreadDivider/Skeleton/EmptyState exist, compose Task 1 atoms, token-only, exactly one primary action (Send) in the composed view; MessageList is a scrollable role="log" with unread divider + onLoadOlder prop; new tests pass alongside Task 1 tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Conversation list, badges, barrel export, and /kit/chat showcase</name>
  <files>apps/web/components/chat/conversation-list.tsx, apps/web/components/chat/notification-badge.tsx, apps/web/components/chat/index.ts, apps/web/components/chat/chat.test.tsx, apps/web/app/kit/chat/page.tsx, apps/web/app/kit/chat/mock-data.ts</files>
  <behavior>
    - NotificationBadge: given count > 0 renders a pill with the count (caps at "99+"); given 0 or undefined renders nothing; has an aria-label like "3 unread messages".
    - ConversationList: renders a search field (using the existing Input) filtering rows by participant name (case-insensitive); each row shows avatar + name + last-message snippet + timestamp + optional NotificationBadge; the active conversation row is visually marked; rows are buttons/links with aria-labels and meet the tap-target floor; empty search result shows a calm "No matches" state.
    - /kit/chat route: a server showcase page rendering every chat component and its states with mock data, `KitThemeToggle` at the top, unlinked from client-facing navigation.
  </behavior>
  <action>
    Build ConversationList and NotificationBadge against `types.ts`. NotificationBadge is a small `bg-primary text-on-primary` (or surface-2 for muted) pill — count-only, never a red dot, caps at "99+". ConversationList uses the existing `Input` component for its search (import from `@/components/ui/input`) with a `label` (visually the search affordance — pass an accessible label). Filter rows client-side by name; this makes ConversationList a client component (`"use client"`) because it holds search state — that's fine, it's a leaf. Active row marked with `bg-surface-2` + `border-border-strong` (color/weight, not a font-size flip — layout stability). Rows are focusable, `min-h-[var(--size-control)]`, aria-labelled. Empty-filter state uses calm copy via `text-muted`, never scolding.

    Create `index.ts` barrel: `export *` (or explicit named re-exports) for every component in `apps/web/components/chat/` plus the types — this is the design-system entry point (`import { ChatContainer, Bubble, ConversationList } from "@/components/chat"`). Match the named-export + barrel convention already used in `packages/*/src/index.ts`.

    Create `mock-data.ts`: exported mock `ChatParticipantView[]`, `ChatMessageView[]` (covering every state — sent/received, all four statuses, with reactions, a reply/quote, one of each attachment kind, a YouTube link preview, a typing peer), and a `conversations` list for the sidebar. Static data only; no fetching.

    Create `apps/web/app/kit/chat/page.tsx` mirroring the existing `/kit` page pattern EXACTLY: a server component (mock-data is static so no client boundary needed at the page level — ConversationList and other stateful leaves are their own client islands), one long calm scroll inside `<main className="mx-auto ...">`, `<KitThemeToggle />` at the top (import from `@/components/kit/theme-toggle`), a `<section>` per component group (primitives, bubbles & messages, media, input & header, full container, sidebar list, states: empty/skeleton/typing/unread) each rendering real components with mock data in BOTH the natural flow and edge states. Do NOT add this route to any client-facing nav — like `/kit`, it ships unlinked (a dev/design contract page). Keep raw hex out; the page itself uses only tokens and existing kit spacing conventions.

    Extend `chat.test.tsx` (append): NotificationBadge renders nothing at 0 and caps at "99+"; ConversationList filters rows by typed search text and shows the "no matches" state when nothing matches; the barrel `index.ts` re-exports at least ChatContainer + ConversationList + Bubble (import from `@/components/chat` and assert they are defined).
  </action>
  <verify>
    <automated>cd apps/web && pnpm exec vitest run components/chat/chat.test.tsx tests/icon-source.test.ts && pnpm --filter web build</automated>
  </verify>
  <done>ConversationList (with working search + empty state), NotificationBadge (count cap, hides at 0), and the barrel index.ts exist; /kit/chat renders every component and state with mock data, uses KitThemeToggle, and is unlinked from client nav; full chat.test.tsx suite passes; icon-source guard green; `pnpm build` succeeds.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none in scope) | This plan is presentational UI only — no user input reaches a server, no data is fetched or persisted, no auth/RLS surface is touched. Mock data is static and developer-authored. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Tampering | npm/pnpm installs | mitigate | No new dependencies are added. `@tabler/icons-react` is already installed and pinned; icon-source.test.ts blocks any non-Tabler icon set from creeping in. If any task proposes an install, stop and add a legitimacy checkpoint first. |
| T-quick-02 | Information Disclosure | Attachment/LinkPreview rendering | accept | Components render developer-supplied mock URLs only in this plan; no untrusted external content is fetched. When later wired to real data, image/link sources must be sanitized/allow-listed — noted as a follow-up for the data-integration phase, out of scope here. |
| T-quick-SC | Tampering | pnpm installs | mitigate | Zero installs expected; `T-quick-01` covers the guard. No `[ASSUMED]`/`[SUS]` packages introduced. |
</threat_model>

<verification>
- `pnpm --filter web build` passes (production build + typechecks) — the gating check before commit.
- `cd apps/web && pnpm exec vitest run` passes the full suite, including `chat.test.tsx`, the existing `icon-source.test.ts` (single icon set), `contrast.test.ts`, and `focus-ring.test.ts`.
- Grep confirms no raw hex in chat components: `grep -rnE "#[0-9a-fA-F]{3,6}" apps/web/components/chat` returns nothing (tokens only).
- Grep confirms no banned theme branching: `grep -rn "dark:" apps/web/components/chat` returns nothing (dual theme comes from light-dark() tokens).
- Grep confirms no config file was created: `test ! -f apps/web/tailwind.config.js`.
- `/kit/chat` route file exists and imports `KitThemeToggle`; visual review (human, optional) shows all components in both themes via the toggle.
</verification>

<success_criteria>
- A complete chat kit exists under `apps/web/components/chat/` (~24 components) plus a barrel `index.ts`, covering: container, bubbles (sent/received), avatar (image/initials/fallback), username+timestamp, message status (4 states), typing indicator, input area (text/emoji/attach/send), reply/quote, reactions, message actions (copy/edit/delete/reply/forward), image/video/file/audio attachments, voice player, YouTube link preview, unread divider, skeleton, empty state, presence indicator, chat header, conversation list with search, notification badges, infinite-scroll affordance, responsive mobile/desktop layout, light/dark theme, keyboard/ARIA accessibility, and message/typing/reaction animations.
- Every component is token-only (no raw hex, no `dark:` branches, no `tailwind.config.js`), uses `@tabler/icons-react`, `cn()`, and `forwardRef`+`displayName` on focusable controls.
- Exactly one primary action (Send) exists in the composed chat view; copy never scolds; feedback uses notice/calm tokens, never a red chrome slab.
- `/kit/chat` renders every component and state with mock data, uses the theme toggle, and is unlinked from client-facing navigation.
- `pnpm build` and the full vitest suite pass.
</success_criteria>

<output>
Create `.planning/quick/260704-inu-build-modern-chat-interface-component-li/260704-inu-SUMMARY.md` when done.
</output>
