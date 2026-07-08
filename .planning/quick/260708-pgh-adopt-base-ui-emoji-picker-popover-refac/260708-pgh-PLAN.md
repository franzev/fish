---
phase: quick-260708-pgh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/package.json
  - apps/web/components/chat/emoji-picker/emoji-picker.tsx
autonomous: false
requirements: [QUICK-260708-pgh]
must_haves:
  truths:
    - "Emoji picker opens through a Base UI Popover portaled to <body>, no longer clipped by the chat scrollport or overflow ancestors"
    - "Picker flips side and aligns near viewport edges via Base UI collision detection (Floating UI), not hand-rolled midpoint math"
    - "Escape and outside-click dismiss the picker, and keyboard focus returns to the trigger button"
    - "Selecting an emoji still inserts it into reactions in both the live chat hover action bar and the kit reactions demo"
    - "When the search field is empty, the panel groups emojis into per-category Base UI Tabs the user can switch between"
    - "Typing a query shows flat filtered results across all categories; clearing the query restores the tabbed categories"
    - "pnpm build passes"
  artifacts:
    - path: "apps/web/components/chat/emoji-picker/emoji-picker.tsx"
      provides: "EmojiPicker (Tabs panel) + EmojiPickerButton (Base UI Popover), same exported API"
      contains: "Popover"
    - path: "apps/web/package.json"
      provides: "@base-ui/react dependency in apps/web workspace"
      contains: "@base-ui/react"
  key_links:
    - from: "apps/web/components/chat/reactions/reactions.tsx"
      to: "EmojiPickerButton"
      via: "unchanged props (label, onSelect, className, children)"
      pattern: "EmojiPickerButton"
    - from: "apps/web/app/(authenticated)/chat/chat-client.tsx"
      to: "EmojiPickerButton"
      via: "unchanged props (label, onSelect, className, children)"
      pattern: "EmojiPickerButton"
    - from: "EmojiPickerButton Popover.Portal"
      to: "document.body"
      via: "Base UI portal (default container)"
      pattern: "Popover.Portal"
---

<objective>
Adopt Base UI (`@base-ui/react`) in `apps/web` and rebuild the emoji picker on top of it, replacing hand-rolled floating/dismiss logic and adding per-category tabs — without changing the component's public API so both consumers keep working untouched.

Purpose: The current `EmojiPickerButton` hand-rolls flip math, document listeners, and a raw `createPortal`, with no focus trap and no focus return. Base UI's Popover gives collision-aware positioning, portal, dismiss, and focus management for free; Base UI Tabs organizes the 9 emoji categories so users are not scrolling one long list.
Output: A refactored `emoji-picker.tsx` (Popover + Tabs) and a new `@base-ui/react` dependency, verified in the browser.
</objective>

<execution_context>
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/workflows/execute-plan.md
@/Users/franz/Library/Application Support/Claude/local-agent-mode-sessions/614fd504-8566-46b2-8256-66ded77bb604/43ed32e3-053c-413f-843e-d49e1f00f5e1/rpm/plugin_019FPGEfUV8XSdonegN1mWDs/templates/summary.md
</execution_context>

<context>
@./AGENTS.md
@./CLAUDE.md
@./.claude/CLAUDE.md

Project skill: load `sketch-findings-fish` before touching this client-facing screen (monochrome, calm, tokens-only, no color in structural chrome).

Files this plan touches or depends on:
@apps/web/components/chat/emoji-picker/emoji-picker.tsx
@apps/web/components/chat/reactions/reactions.tsx
@apps/web/app/kit/chat/page.tsx

<interfaces>
<!-- Public API that MUST be preserved — reactions.tsx, chat-client.tsx, and emoji-picker.stories.tsx all import these. Do not rename or change prop shapes. -->

From apps/web/components/chat/emoji-picker/emoji-picker.tsx (exported, keep as-is):
```typescript
export function EmojiPicker(props: { onSelect: (emoji: string) => void; className?: string }): JSX.Element;
export function EmojiPickerButton(props: {
  onSelect: (emoji: string) => void;
  label: string;
  className?: string;
  children?: ReactNode;
}): JSX.Element;
```

Consumers (must need ZERO changes):
- apps/web/components/chat/reactions/reactions.tsx:56 — `<EmojiPickerButton label="Add a reaction" onSelect={...} className="...pill..." />` (no children → default smiley must still render).
- apps/web/app/(authenticated)/chat/chat-client.tsx:455 — `<EmojiPickerButton label="Add a reaction" onSelect={...} className="...size-10..."><IconMoodSmile .../></EmojiPickerButton>` (children override the default icon).
- apps/web/components/chat/emoji-picker/emoji-picker.stories.tsx — renders both `EmojiPicker` (Panel) and `EmojiPickerButton` (Trigger).

Emoji dataset (unicode-emoji-json/data-by-group.json), typed locally as EmojiGroup[]:
- Group fields: `name`, `slug`, `emojis`.
- Emoji fields used: `emoji`, `name`, `slug`.
- The 9 group slugs/names: smileys_emotion (Smileys & Emotion), people_body (People & Body), animals_nature (Animals & Nature), food_drink (Food & Drink), travel_places (Travel & Places), activities (Activities), objects (Objects), symbols (Symbols), flags (Flags).

Design tokens available (from apps/web/app/globals.css @theme — use these, never raw hex or one-off numeric spacing):
- Backgrounds: bg-bg, bg-surface, bg-surface-2. Borders: border-border, border-border-strong.
- Text: text-foreground, text-body, text-muted. Radius: rounded-card, rounded-control, rounded-pill.
- Spacing utilities: gap-2xs, gap-nudge, p-xs, p-2xs, mb-2xs, mb-sm, px-xs, py-2xs (backed by --spacing-* tokens).
- Panel size tokens: w-emoji-panel (288px), h-emoji-panel-h (320px). Keep both.
- Focus-visible ring and prefers-reduced-motion are already global in globals.css.
- The shared Input (`@/components/ui/input/input`) supports `label`, `placeholder`, `value`, `onChange`, `reserveMessageSpace`, `trailingControl`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add @base-ui/react and move EmojiPickerButton onto Base UI Popover</name>
  <files>apps/web/package.json, pnpm-lock.yaml, apps/web/components/chat/emoji-picker/emoji-picker.tsx</files>
  <action>
Install the dependency with pnpm scoped to the web workspace: `pnpm --filter @fish/web add @base-ui/react` (do NOT install date-fns — its Base UI peer deps are optional/calendar-only; do NOT add a tailwind.config.js; pnpm only, never npm). After install, confirm the exact import subpath by reading the installed package's `exports` map in `apps/web/node_modules/@base-ui/react/package.json` (Base UI ships per-part subpaths such as `@base-ui/react/popover`). Use the real subpath the package exposes.

Refactor `EmojiPickerButton` to Base UI Popover, preserving the exported signature exactly (onSelect, label, className, children). Delete the hand-rolled floating machinery: `panelPositionFor`, `readPixelToken`, the `position` state, `containerRef`/`panelRef`, the `useEffect` with document pointerdown/keydown/scroll + window resize listeners, and the `createPortal` call. Remove now-unused imports (`useEffect`, `useRef`, `useState` if unused elsewhere, `createPortal`).

Compose: Popover.Root (uncontrolled open is fine) → Popover.Trigger `render`/as the existing `<button>` (keep `type="button"`, `aria-label={label}`, the passed `className`, and the `children ?? <IconMoodSmile size={18} stroke={1.75} aria-hidden="true" />` default) → Popover.Portal → Popover.Positioner → Popover.Popup wrapping `<EmojiPicker onSelect={...} />`. Base UI supplies aria-haspopup/expanded, Escape, outside-click dismiss, portal, and focus return — do not re-add them by hand.

Positioner config to reproduce today's behavior via Base UI collision handling: prefer opening upward near the bottom of the viewport and aligning to the nearer edge. Set `side="top"` with `align="end"` (Base UI auto-flips to bottom / re-aligns when space is tight) and `sideOffset` bound to the existing 4px nudge (use the `--spacing-2xs` token value; a numeric `sideOffset={4}` prop is acceptable since Base UI takes a number, not a class). Keep the picker closing after a selection: wire the emoji `onSelect` so it calls the consumer `onSelect(emoji)` and closes the popover (control `open` via `useState` and Popover.Root's `open`/`onOpenChange`, OR use Popover's imperative close — whichever the installed API supports; closing on select is required).

Style Popover.Popup with tokens only (e.g. `rounded-card border border-border bg-surface`) — but note the panel's own frame already lives inside `EmojiPicker`; avoid double borders. Simplest: keep `EmojiPicker`'s existing framed container as the visual popup and give Popover.Popup no competing chrome (or move the frame to the Popup — pick one, no doubled border/background). Do not introduce raw hex or one-off numeric spacing utilities.
  </action>
  <verify>
    <automated>cd /Users/franz/Work/Personal/fish && grep -q '@base-ui/react' apps/web/package.json && grep -qi 'Popover' apps/web/components/chat/emoji-picker/emoji-picker.tsx && ! grep -q 'panelPositionFor\|createPortal' apps/web/components/chat/emoji-picker/emoji-picker.tsx && pnpm --filter @fish/web typecheck</automated>
  </verify>
  <done>@base-ui/react is a dependency; EmojiPickerButton renders a Base UI Popover (Trigger/Portal/Positioner/Popup) with the default smiley when no children are passed; all hand-rolled flip math, listeners, and createPortal are gone; typecheck passes; the exported API is unchanged so reactions.tsx and chat-client.tsx compile without edits.</done>
</task>

<task type="auto">
  <name>Task 2: Group the emoji panel into per-category Base UI Tabs</name>
  <files>apps/web/components/chat/emoji-picker/emoji-picker.tsx</files>
  <action>
Reorganize the `EmojiPicker` panel body with Base UI Tabs while keeping the sticky search header, the `role="dialog"`/`aria-label="Choose an emoji"` container, and the `w-emoji-panel h-emoji-panel-h` size tokens.

Behavior split on the search query (keep the existing `results` useMemo that flat-filters across all groups by name/slug):
- Query is non-empty: render the existing flat results block (the "No emoji match that yet." empty state and the `EmojiGroupList heading="Results"`). Do NOT render the Tabs in this mode — tabs are hidden/inert during search, per the constraint.
- Query is empty: render Base UI Tabs: Tabs.Root → Tabs.List (the 9 category tabs) → one Tabs.Panel per group rendering that group's `EmojiGroupList` (reuse the existing component; the per-panel heading becomes redundant with the tab label, so you may drop the `heading` inside tabbed mode or keep it small — keep the grid `grid-cols-6 gap-2xs size-10` cells unchanged).

Tabs.List styling (tokens only, monochrome, this is a dense picker so sub-56px tab cells are acceptable — match the existing `size-10 rounded-control` grid-cell idiom, do not force 56px): a single horizontal, `overflow-x-auto` row pinned under the search header (`border-b border-border bg-surface`, `p-xs`, `gap-2xs`). Each Tabs.Tab is a compact button labeled by a representative glyph (the group's first emoji) with `aria-label={group.name}` so screen-reader users hear the category. Selected vs unselected via Base UI's `data-[selected]` state attribute: selected → `bg-surface-2 text-foreground`; unselected → `text-muted hover:bg-surface-2`. No color, no raw hex. Rely on the global focus-visible ring (do not remove focus styling).

Set the default selected tab to the first group (smileys_emotion). Ensure only the scrollable emoji body scrolls (`flex-1 overflow-y-auto p-xs`), and the search header + tab list stay put. Keep `cn()` for conditional classes and named exports.
  </action>
  <verify>
    <automated>cd /Users/franz/Work/Personal/fish && grep -qi 'Tabs' apps/web/components/chat/emoji-picker/emoji-picker.tsx && ! grep -nE 'text-\[#|bg-\[#|(mt|mb|px|py|gap|space-[xy])-[0-9]' apps/web/components/chat/emoji-picker/emoji-picker.tsx && pnpm --filter @fish/web typecheck</automated>
  </verify>
  <done>With an empty search the panel shows a horizontal row of 9 category tabs (representative glyph + aria-label) and switching a tab swaps the visible emoji grid; typing a query hides the tabs and shows flat cross-category results (with the calm empty-state copy); panel size tokens and 6-col grid unchanged; no raw hex and no one-off numeric spacing utilities present.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
`@base-ui/react` adopted in apps/web. `EmojiPickerButton` now uses a Base UI Popover (portal + collision-aware flip + Escape/outside-click dismiss + focus return), and the emoji panel groups emojis into per-category Base UI Tabs with search falling back to flat filtered results. Component API is unchanged, so both consumers (live chat hover action bar, kit reactions demo) were not modified.
  </what-built>
  <how-to-verify>
1. Run `pnpm build` from the repo root — it MUST pass (production build + shared package typechecks). If it fails, stop and report.
2. Run `pnpm dev` (web dev server on port 3001).
3. Kit page — visit http://localhost:3001/kit/chat, scroll to the "Reactions" demo:
   - Click the trailing add-reaction pill: the picker opens beside it, not clipped.
   - Switch category tabs — the emoji grid changes per category.
   - Type in Search (e.g. "heart") — tabs disappear, flat results show across categories; clear it — tabs return.
   - Pick an emoji — it inserts as a reaction pill and the picker closes.
   - Press Escape and click outside — both dismiss the picker; after dismiss, keyboard focus returns to the trigger (Tab/Shift-Tab lands sensibly).
4. Live chat — visit http://localhost:3001/chat (or the /kit/chat-live harness), hover a message row so the action bar appears, open the smiley picker:
   - Confirm it escapes the message-list overflow (not clipped), and near the bottom of the viewport it opens upward; near the right edge it re-aligns inward (Base UI collision detection).
   - Pick an emoji — the reaction is applied to that message.
5. Confirm the picker respects reduced motion and shows the visible focus ring on tabs and emoji cells.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what broke (clipping, no flip, dismiss/focus issues, tabs not switching, search not filtering, or a build failure).</resume-signal>
</task>

</tasks>

<verification>
- `pnpm build` passes from repo root.
- `pnpm --filter @fish/web typecheck` passes.
- reactions.tsx and chat-client.tsx are unmodified (API preserved) — `git diff --name-only` shows only package.json, pnpm-lock.yaml, and emoji-picker.tsx.
- Popover behaviors (portal, flip, dismiss, focus return) and Tabs behaviors confirmed in browser per the checkpoint.
</verification>

<success_criteria>
- Emoji picker is powered by Base UI Popover + Tabs; all hand-rolled floating/dismiss/portal code removed.
- Picker is no longer clipped by overflow ancestors and flips/aligns correctly near viewport edges.
- Escape/outside-click dismiss work and focus returns to the trigger.
- Empty search shows tabbed categories; active search shows flat filtered results.
- Emoji insertion still works in live chat and the kit page; both consumers required zero edits.
- Tokens-only, monochrome, visible focus, reduced-motion respected; no tailwind.config.js; pnpm build passes.
</success_criteria>

<output>
Create `.planning/quick/260708-pgh-adopt-base-ui-emoji-picker-popover-refac/260708-pgh-SUMMARY.md` when done.
</output>
