---
status: complete
phase: quick-260704-inu
plan: 01
subsystem: web-chat-kit
tags: [chat, design-system, ui-kit, presentational]
dependency-graph:
  requires: []
  provides:
    - "apps/web/components/chat (chat design-system kit, barrel-exported)"
    - "apps/web/app/kit/chat (dev-only showcase route)"
  affects:
    - "apps/web/app/globals.css (three new animate-* utilities)"
tech-stack:
  added: []
  patterns:
    - "Presentational-only component kit built against a shared types.ts contract (ChatMessageView/ChatParticipantView/MessageStatus/Reaction/Attachment) with no Supabase/data wiring"
    - "forwardRef + displayName on every focusable control (Bubble, ChatInput); other leaves are plain function components per existing Card/Progress/Alert convention"
    - "Client-component leaves only where interactivity/state is required (Avatar image-fallback, VoicePlayer play toggle, ConversationList search, ChatHeader/MessageActions/Reactions/MessageList click handlers, ChatInput text state) — everything else is a plain (implicitly server-compatible) component"
key-files:
  created:
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
  modified:
    - apps/web/app/globals.css
decisions:
  - "MessageStatus is both a component name (message-status.tsx) and a type name (types.ts) — the barrel (index.ts) resolves the export-star ambiguity by explicitly re-exporting the component as MessageStatus and the type as MessageStatusValue, rather than renaming either the plan-mandated types.ts export or the component."
  - "Any chat leaf that renders a native DOM event handler unconditionally (ChatHeader, MessageActions, Reactions, MessageList) or holds local state (Avatar, VoicePlayer) is marked \"use client\" — Next.js RSC forbids passing function props from a Server Component boundary, discovered only at the pnpm build gate (Turbopack prerender), not at vitest/jsdom time."
  - "ConversationList's onSelect and Reactions' onToggle prop names collide with native HTMLAttributes handler names (onSelect, onToggle) on the extended interface; both interfaces now Omit those keys before adding the custom-typed prop."
metrics:
  duration: 38min
  tasks_completed: 3
  files_changed: 27
  completed: 2026-07-04
---

# Quick Task 260704-inu: Build modern chat interface component library Summary

A ~24-component, token-only, dual-theme chat design-system kit under `apps/web/components/chat/`, plus a dev-only `/kit/chat` showcase route rendering every component and state with static mock data — no Supabase wiring, presentational only.

## What was built

**Task 1 — Message primitives, atoms, and animation tokens.** Added the shared `types.ts` contract (`MessageStatus`, `Reaction`, `Attachment` discriminated union, `ChatParticipantView`, `ChatMessageView`) that every later component builds against. Built the atom layer: `Avatar` (image → initials → neutral placeholder, crash-proof fallback chain with an `onError` handler), `PresenceIndicator`, `MessageMeta`, `MessageStatus` (four-state icon + aria-label), `TypingIndicator` (three staggered dots via a shared keyframe), `Reactions` (emoji-count pills, byMe marking, renders nothing when empty), `QuotedMessage`, `MessageActions` (copy/edit/delete/reply/forward icon buttons, delete using the calm `text-notice` tone — never red chrome), `Attachments` (image/video/file/audio cards), `VoicePlayer` (play/pause + static scrubber, no real audio decode), and `LinkPreview` (YouTube-style card). Added three new `globals.css` utilities: `animate-message-in`, `animate-typing`, `animate-reaction-pop`, all riding the existing global `prefers-reduced-motion` clamp with no per-animation guard duplication.

**Task 2 — Message composition + chat shell.** `Bubble` (forwardRef, `mine` boolean drives sent/received token styling — inverted-primary block vs. bordered surface — both `rounded-card` with an asymmetric tail corner). `Message` composes Avatar + MessageMeta + Bubble + Reactions/QuotedMessage/Attachments/MessageStatus into one row, with consecutive-same-author grouping (avatar/meta collapse but bubble column stays aligned). `MessageList` (`role="log"`, unread divider insertion, top sentinel + `onLoadOlder`/`loadingOlder` props for a future infinite-scroll wire-up). `ChatInput` (text + emoji + attach + the single primary Send button; Enter submits, Shift+Enter newlines; send disables on empty). `ChatHeader` (participant + presence + ghost call/info/menu actions). `ChatContainer` (responsive column shell: header fixed top, list flex-1 scrolling, input fixed bottom; `md:` bounded pane via Tailwind prefixes only). `EmptyState` and `Skeleton` round out the loading/empty states.

**Task 3 — Conversation list, badges, barrel, and showcase.** `NotificationBadge` (count pill capped at "99+", renders nothing at 0/undefined, real count always in the aria-label). `ConversationList` (client leaf holding search state, filters by participant name case-insensitively using the existing `Input` component, active-row marking via `bg-surface-2`/`border-border-strong`, calm "No matches" empty state). `index.ts` barrel re-exporting the whole kit. `mock-data.ts` with static participants/messages covering every state (all four statuses, reactions, a reply/quote, one of each attachment kind, a link preview) and a conversation list. `/kit/chat/page.tsx` mirrors the existing `/kit` page pattern — one long calm scroll, `KitThemeToggle` at top, a section per component group, unlinked from client-facing navigation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `"use client"` missing on components using `useState` or unconditional DOM event handlers**
- **Found during:** Task 3's `pnpm --filter web build` gate (Turbopack static prerender of `/kit/chat`)
- **Issue:** `Avatar` and `VoicePlayer` call `useState` without the `"use client"` directive; `ChatHeader`, `MessageActions`, `Reactions`, and `MessageList` render native `<button>`/`<div>` elements with `onClick={...}` handlers directly in what was an implicit Server Component. Vitest/jsdom happily renders these (no RSC boundary in that environment), so this only surfaced at the production build's prerender step, not in unit tests.
- **Fix:** Added `"use client"` to all six files.
- **Files modified:** `apps/web/components/chat/avatar.tsx`, `voice-player.tsx`, `chat-header.tsx`, `message-actions.tsx`, `reactions.tsx`, `message-list.tsx`
- **Commit:** 59cc6fb

**2. [Rule 1 - Bug] Prop names colliding with native `HTMLAttributes` handlers**
- **Found during:** Same build gate, TypeScript phase
- **Issue:** `ConversationListProps extends HTMLAttributes<HTMLDivElement>` declared its own `onSelect?: (id: string) => void`, which collides with the native `onSelect` DOM event handler already on `HTMLAttributes` (same for `Reactions`' `onToggle` vs. the native `onToggle` handler). TypeScript rejected both as incompatible overrides.
- **Fix:** Both interfaces now `Omit<HTMLAttributes<HTMLDivElement>, "onSelect" | "onToggle">` before re-declaring the custom-typed prop.
- **Files modified:** `apps/web/components/chat/conversation-list.tsx`, `apps/web/components/chat/reactions.tsx`
- **Commit:** 59cc6fb

**3. [Rule 1 - Bug] Barrel export-star ambiguity: `MessageStatus` is both a component and a type name**
- **Found during:** Same build gate
- **Issue:** `index.ts` used `export * from "./message-status"` (the component) and `export * from "./types"` (which exports the `MessageStatus` type), producing a duplicate-export TypeScript error.
- **Fix:** Replaced both blanket re-exports for these two modules with explicit named re-exports: the component keeps its name `MessageStatus`; the type is re-exported as `MessageStatusValue`. `types.ts` itself is untouched — it still exports `MessageStatus` as required by the plan's must-haves (`contains: "export type MessageStatus"`).
- **Files modified:** `apps/web/components/chat/index.ts`
- **Commit:** 59cc6fb

**4. [Rule 3 - Blocking] Unused import lint warning**
- **Found during:** `pnpm lint` (run proactively alongside the build gate)
- **Issue:** `/kit/chat/page.tsx` imported `client` from `mock-data.ts` but never referenced it directly (only `coach` is used at the page level; `client` is consumed internally by `mock-data.ts`'s own message list).
- **Fix:** Removed the unused import.
- **Files modified:** `apps/web/app/kit/chat/page.tsx`
- **Commit:** 59cc6fb

None of these were architectural — all were build-only correctness fixes surfaced by `pnpm --filter web build`, which the plan explicitly gates the final task on.

## Verification

- `cd apps/web && pnpm exec vitest run` — 205/205 tests pass across 22 files (33 in `chat.test.tsx` alone, covering the full behavior list from all three tasks: avatar fallback chain, status labels, typing accessible label, reactions empty/byMe, message actions aria-labels + calm delete tone, bubble token distinction, message alignment, chat input enable/disable + single-primary assertion, Enter/Shift+Enter, message list role=log + unread divider, empty state copy, notification badge cap/hide, conversation search + no-matches, barrel re-exports).
- `pnpm --filter web build` — passes (production build + typecheck + lint clean, all 15 routes including `/kit/chat` prerender successfully).
- `grep -rnE "#[0-9a-fA-F]{3,6}" apps/web/components/chat` — no matches (token-only).
- `grep -rn "dark:" apps/web/components/chat` — no matches (dual theme via `light-dark()` tokens only).
- `test ! -f apps/web/tailwind.config.js` — confirmed absent.
- `/kit/chat` route exists, imports `KitThemeToggle`, and is not referenced from any client-facing nav (`grep -rn "kit/chat"` outside its own directory returns nothing).

## Self-Check: PASSED

All files listed under `key-files.created`/`modified` exist on disk; all three task commits (1e04283, 70e58e0, 59cc6fb) are present in `git log`.

## Post-merge adversarial review (orchestrator pass)

After the worktree merged to `main`, the orchestrator ran a 3-dimension adversarial review (correctness / design-rules+a11y / Next.js+Tailwind integration) over the 28 changed files, each finding cross-examined by independent refuters. 19 raw findings surfaced; 2 passed full multi-vote verification before the review's verification agents hit a model rate limit, leaving the rest unverified rather than genuinely refuted. Each surviving/borderline finding was then re-checked by hand and fixed where real.

**Fixed (commits 74dcd24, c244d37):**

| Finding | Severity | Fix |
|---|---|---|
| `message-actions` — five 32px buttons violate the 56px `--size-control` tap-target floor (AGENTS.md rule 3, non-negotiable) | high (confirmed 3/3) | Raised all five to `min-h/min-w-[var(--size-control)]`, matching the `ChatHeader`/`ChatInput` pattern |
| `globals.css` — reduced-motion clamp set only `animation-duration`, so infinite `animate-typing`/`animate-pulse` flicker instead of holding still | medium (confirmed 2/2) | Added `animation-iteration-count: 1 !important` to the media query |
| `voice-player` play button 40px; `reactions` pills ~30px | (same tap-target class) | Raised both to the 56px floor |
| `message-meta` — locale/timezone `toLocaleTimeString` risks a hydration mismatch on the prerendered `/kit/chat` | correctness | `suppressHydrationWarning` on the `<time>` leaf (machine-readable `dateTime` stays stable) |
| `avatar` — image `onError` set a sticky boolean, so a later valid `src` on a reused instance never rendered | correctness | Track the *failed src* instead of a boolean |
| `chat-input` — Enter that confirms an IME (CJK) candidate sent the half-composed message | correctness (i18n) | Guard on `event.nativeEvent.isComposing` |
| `notification-badge` — `aria-label` on a generic `<span>` isn't reliably exposed; SR reads the capped "99+" | a11y | `role="img"` so the label is a proper accessible name stating the true count |
| `message-list` — scrollable `role="log"` not keyboard-scrollable | a11y | `tabIndex={0}` |
| `conversation-list` — a button's `aria-label` replaced its child text, silencing snippet/timestamp/unread for SRs | a11y | Compose unread count + snippet + time into the row label |

**Deferred (documented, not fixed this pass):**

- `message-list` load-older sentinel is a click-only, invisible, non-focusable 1px div. Intentional scaffolding — the plan defers the IntersectionObserver + accessible "load older" affordance to the data-integration phase that actually wires infinite scroll. Should become a real focusable control (or pure observer target) when that phase lands.
- `avatar` `initialsFrom` slices by code unit, so an astral-plane/emoji first character splits its surrogate pair. Cosmetic; revisit if names with such leading glyphs become real input.
- `chat.test.tsx` unread-divider test asserts the divider exists but not its *position* relative to the first unread message. Tighten to assert ordering.

All fixes re-verified: 205/205 vitest, `pnpm --filter web build` clean, `/kit/chat` still prerenders static, hex/`dark:`/config guards green.
