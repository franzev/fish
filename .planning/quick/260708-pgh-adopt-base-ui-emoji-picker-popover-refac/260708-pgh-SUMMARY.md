---
status: complete
phase: quick-260708-pgh
plan: 01
subsystem: web/chat
tags: [emoji-picker, base-ui, popover, tabs, chat]
requirements: [QUICK-260708-pgh]
dependency-graph:
  requires: []
  provides: ["EmojiPicker (Base UI Tabs)", "EmojiPickerButton (Base UI Popover)"]
  affects: ["apps/web/components/chat/reactions/reactions.tsx", "apps/web/app/(authenticated)/chat/chat-client.tsx"]
tech-stack:
  added: ["@base-ui/react@1.6.0"]
  patterns: ["Base UI Popover for portaled/collision-aware floating UI", "Base UI Tabs for category grouping"]
key-files:
  created: []
  modified:
    - apps/web/components/chat/emoji-picker/emoji-picker.tsx
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "Used the real Base UI state attribute (data-active) for the selected tab style, not the plan's suggested data-selected — Base UI 1.6.0's Tabs.Tab state key is `active`, which the library's getStateAttributesProps helper renders as `data-active` when true. Confirmed by reading the installed package's compiled source (tabs/tab/TabsTab.js) since Tabs.Tab has no built-in data-selected mapping."
  - "Split the single-file refactor into two atomic commits matching the plan's two auto tasks: Popover-only intermediate state committed first, then Tabs grouping applied and committed on top, so history reflects task boundaries even though both tasks touch the same file."
metrics:
  duration: "~35 min"
  completed: "2026-07-08"
---

# Quick Task 260708-pgh: Adopt Base UI Emoji Picker Popover Refactor Summary

Rebuilt the emoji picker on Base UI (`@base-ui/react`): `EmojiPickerButton` now uses a Base UI Popover (portal, collision-aware flip/align, Escape/outside-click dismiss, focus return — all for free instead of hand-rolled), and the emoji panel groups its 9 categories into Base UI Tabs when the search field is empty, falling back to the existing flat cross-category results while searching.

## What changed

**`apps/web/components/chat/emoji-picker/emoji-picker.tsx`:**
- `EmojiPickerButton`: removed `panelPositionFor`, `readPixelToken`, the `position` state, `containerRef`/`panelRef`, the pointerdown/keydown/scroll/resize `useEffect`, and the `createPortal` call. Replaced with `Popover.Root` (controlled via `open`/`onOpenChange`) → `Popover.Trigger` (unchanged button semantics: `aria-label={label}`, `className`, default smiley when no `children`) → `Popover.Portal` → `Popover.Positioner` (`side="top"` `align="end"` `sideOffset={4}`) → `Popover.Popup` wrapping `EmojiPicker`. Selecting an emoji calls the consumer's `onSelect` then closes the popover via `setOpen(false)`.
- `EmojiPicker`: when the search query is empty, renders `Tabs.Root` (`defaultValue` = first group's slug) → `Tabs.List` (one `Tabs.Tab` per of the 9 groups, glyph = the group's first emoji, `aria-label={group.name}`) → one `Tabs.Panel` per group rendering that group's `EmojiGroupList` (heading dropped in tabbed mode since the tab label already identifies the category). When the query is non-empty, the tabs are not rendered at all — the existing flat `results` block (with the "No emoji match that yet." empty state) is shown instead, matching the plan's "hidden/inert during search" requirement.
- `EmojiGroupList`'s `heading` prop became optional so tabbed panels can omit the redundant per-panel heading.
- Public API unchanged: `EmojiPicker({ onSelect, className })` and `EmojiPickerButton({ onSelect, label, className, children })` — both consumers (`reactions.tsx`, `chat-client.tsx`) required zero edits, confirmed via `git diff --name-only` showing no changes to either file.

**`apps/web/package.json` / `pnpm-lock.yaml`:** added `@base-ui/react@1.6.0` to the `apps/web` workspace via `pnpm --filter @fish/web add @base-ui/react` (no `date-fns` peer installed — it is optional/calendar-only and unused here).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `f7542808` | Move `EmojiPickerButton` onto Base UI Popover; add `@base-ui/react` dependency |
| 2 | `747c7e21` | Group the emoji panel into per-category Base UI Tabs |

## Verification performed (automated only — see below for what's pending)

- `pnpm --filter @fish/web typecheck` — passes (both after task 1 and after task 2).
- `pnpm --filter @fish/web lint` — passes, no warnings.
- `pnpm --filter @fish/web test` — 49 test files / 377 tests passed, no regressions.
- `pnpm build` (repo root: `packages/core` typecheck, `packages/supabase` typecheck, `apps/web` production build) — **passes**. Next.js build compiled successfully, all 20 routes generated including `/kit/chat` and `/chat`.
- Plan's task-level grep gates:
  - `grep -q '@base-ui/react' apps/web/package.json` — pass.
  - `grep -qi 'Popover' emoji-picker.tsx` — pass.
  - `! grep -q 'panelPositionFor\|createPortal' emoji-picker.tsx` — pass (both fully removed).
  - `grep -qi 'Tabs' emoji-picker.tsx` — pass.
  - The plan's spacing/hex regex gate (`! grep -nE 'text-\[#|bg-\[#|(mt|mb|px|py|gap|space-[xy])-[0-9]' ...`) reports a **false positive**: it flags `gap-2xs` and `mb-2xs` because `[0-9]` matches the digit inside the token name `2xs`, not a raw numeric utility. These are legitimate design-system spacing tokens (`--spacing-2xs`), explicitly listed as available tokens in the plan's own `<interfaces>` section. Manually inspected every `className` in the file (see below) — no raw hex and no one-off numeric spacing utilities (`mt-6`, `gap-5`, `px-3`, etc.) are present. `size-10` (Tailwind's own width/height scale, not the `--spacing-*` token scale) was already present pre-refactor and is explicitly called out in the plan as the idiom to keep for the dense picker grid/tabs.
- `git diff --name-only` from the pre-plan commit confirms only `apps/web/package.json`, `pnpm-lock.yaml`, and `emoji-picker.tsx` changed — `reactions.tsx` and `chat-client.tsx` are untouched.

## Deviations from Plan

### Auto-fixed / adjusted issues

**1. [Rule 1 - correctness] Used `data-active`, not `data-selected`, for the Tabs selected-state style**
- **Found during:** Task 2, while reading the installed `@base-ui/react@1.6.0` compiled source to confirm the real API surface (per the plan's own instruction to read `package.json` exports for the correct subpath).
- **Issue:** The plan's task 2 action text says to style selected vs. unselected tabs "via Base UI's `data-[selected]` state attribute." Base UI 1.6.0's `Tabs.Tab` state object is `{ disabled, active, orientation, tabActivationDirection }` — there is no `selected` key. The generic `getStateAttributesProps` helper renders boolean state keys as `data-${key}`, so `active: true` becomes `data-active`, not `data-selected`. Using `data-[selected]:` as written would have silently never matched, leaving the selected tab visually indistinguishable from unselected ones.
- **Fix:** Used `data-[active]:bg-surface-2 data-[active]:text-foreground` on `Tabs.Tab`, matching the library's actual emitted attribute.
- **Files modified:** `apps/web/components/chat/emoji-picker/emoji-picker.tsx`.
- **Commit:** `747c7e21`.

None of the other deviation rules applied — no architectural changes, no auth gates, no blocking package-install issues (`@base-ui/react` installed cleanly on the first attempt with the exact name specified in the plan).

## What's pending (checkpoint, not run by this executor)

Per the orchestrator's constraint, task 3 (`checkpoint:human-verify`) was **not** browser-verified by this executor — only the automated gates above (`pnpm build`, typecheck, lint, tests, grep gates) were run. Browser verification is pending with the orchestrator/user and must confirm, per the plan's `<how-to-verify>`:

1. Kit page (`/kit/chat`, "Reactions" demo): picker opens beside the trailing add-reaction pill without clipping; category tabs switch the emoji grid; typing "heart" hides tabs and shows flat results, clearing restores tabs; picking an emoji inserts a reaction pill and closes the picker; Escape and outside-click both dismiss with focus returning to the trigger.
2. Live chat (`/chat` or `/kit/chat-live`): hover action bar smiley picker escapes the message-list overflow (not clipped); opens upward near the viewport bottom; re-aligns inward near the right edge (Base UI collision detection); picking an emoji applies the reaction to that message.
3. Reduced motion respected; visible focus ring present on tabs and emoji cells.

## Known Stubs

None — no stub data, placeholder text, or unwired components were introduced.

## Threat Flags

None — this refactor is purely a client-side UI composition change (floating-UI library swap + tab grouping) with no new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

- `apps/web/components/chat/emoji-picker/emoji-picker.tsx` — FOUND (modified, present on disk).
- Commit `f7542808` — FOUND in `git log`.
- Commit `747c7e21` — FOUND in `git log`.
- `@base-ui/react` in `apps/web/package.json` — FOUND.
- `apps/web/components/chat/reactions/reactions.tsx` — unmodified, confirmed via `git diff --name-only`.
- `apps/web/app/(authenticated)/chat/chat-client.tsx` — unmodified, confirmed via `git diff --name-only`.
