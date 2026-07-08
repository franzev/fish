---
quick_id: 260708-nr2
description: Redesign chat emoji reactions to match the reference screenshot geometry and remove the 4-emoji whitelist end-to-end
date: 2026-07-08
status: complete
---

# Summary — 260708-nr2

**Monochrome, grouped + searchable emoji picker (unicode-emoji-json) replaces the 4-emoji whitelist end-to-end — reaction pills gain a trailing add-reaction smiley pill, and the DB/RPC layer now accepts any emoji up to 16 chars.**

## What changed

1. **DB layer (`supabase/migrations/0015_reactions_any_emoji.sql`)** — additive
   migration. Drops `message_reactions_emoji_supported` (the `in ('👍','❤️','🎉','🙏')`
   enum) and re-adds it as `char_length(btrim(emoji)) between 1 and 16` to allow
   multi-codepoint ZWJ/skin-tone sequences. `toggle_message_reaction` RPC is
   recreated with the same signature/body, swapping the whitelist guard for
   `p_emoji is null or btrim(p_emoji) = '' or char_length(p_emoji) > 16`,
   preserving the exact `'reaction is not supported'` exception text so the
   edge function's calm error copy ("That reaction is not available.") is
   unaffected.

2. **`unicode-emoji-json` dependency** — installed via
   `pnpm --filter @fish/web add unicode-emoji-json` after the blocking
   human-verify checkpoint was approved by the orchestrator with npm-registry
   evidence (publisher `muan`, MIT license, zero runtime dependencies, benign
   install scripts, 73,601 weekly downloads, actively maintained since 2019).
   Data is imported statically from `unicode-emoji-json/data-by-group.json` —
   no CDN calls.

3. **New `apps/web/components/chat/emoji-picker/` component** —
   - `EmojiPicker`: monochrome panel (`bg-surface border-border rounded-card`)
     with a sticky search row (reuses `Input` with an `IconSearch` trailing
     affordance, placeholder "Search emoji"). Empty query renders all 9
     unicode-emoji-json groups with a `text-ui-xs text-muted` heading each;
     a query filters across all groups by `name`/`slug` into a flat
     "Results" list, with a calm "No emoji match that yet." empty state.
     Each emoji is a native `<button aria-label={name}>` (`size-10
     rounded-control hover:bg-surface-2`) — keyboard/tab order works for
     free since it's all native buttons + `Input`.
   - `EmojiPickerButton`: popover trigger (default icon `IconMoodSmile`),
     `aria-haspopup="dialog"` / `aria-expanded`. Closes on select, `Escape`,
     or a `pointerdown` outside the trigger+panel container.

4. **`Reactions` component** — added a trailing circular add-reaction pill
   (`EmojiPickerButton` styled as a monochrome pill) after the existing
   emoji+count pills, shown whenever `onToggle` is provided and the list is
   non-empty. Existing pill geometry/aria behavior (`byMe` border-strong
   marking, `aria-pressed`) untouched. Still returns `null` for an
   empty/missing reaction list.

5. **`chat-client.tsx` hover bar** — the hardcoded "React with thumbs up"
   button (`IconThumbUp`, always toggled `👍`) is replaced by an
   `EmojiPickerButton` ("Add a reaction") rendering `IconMoodSmile`, wired to
   `handleToggleReaction` with whatever emoji the user picks.

6. **`apps/web/app/globals.css`** — one new base-layer rule,
   `button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }`,
   with a WHY comment. No `cursor-pointer` utility classes were sprinkled
   elsewhere for this task.

7. **Stories/mocks** — new `Chat/EmojiPicker` story (panel + trigger);
   `Chat/Reactions` stories pass `onToggle` on the meta so the add-pill
   renders; `story-data.ts` reactions mock gained a non-legacy `🔥` entry.

8. **`chat-client.test.tsx`** — pending-item assertion now expects
   `"Add a reaction"` (not "React with thumbs up"). The reaction-toggle test
   opens the picker via the first "Add a reaction" trigger, searches
   "thumbs up" (filters to exactly one dataset entry), clicks it by its
   `aria-label`, and asserts `toggleReactionAction` was called with
   `{ messageId: "message-1", emoji: "👍" }`.

## Task Commits

1. **Task 1: Additive migration — remove the emoji whitelist from constraint and RPC** — `9a8b5707` (feat)
2. **Task 2: checkpoint — `unicode-emoji-json` legitimacy** — pre-approved by the orchestrator (see Checkpoint below), no code commit
3. **Task 3: Monochrome emoji picker, redesigned reaction pills, cursor rule, and chat wiring** — `3a3f0dcf` (feat)

## Checkpoint: `unicode-emoji-json` legitimacy (Task 2)

Resolved by the orchestrator before this run started, per npm-registry evidence
gathered 2026-07-08:
- Publisher: `muan` (me@muanchiou.com), sole maintainer, well-known GitHub
  emoji-tooling author
- Repo: `github.com/muan/unicode-emoji-json` — MIT license
- Zero runtime dependencies; benign scripts (download/build/test only, no
  install hooks)
- 73,601 downloads last week; package created 2019-10-13, actively maintained
- `unicode-emoji-json/data-by-group.json` confirmed to export the expected
  shape: `Array<{ name, slug, emojis: Array<{ emoji, name, slug, ... }> }>`
  (verified directly by loading the installed package during this run)

Treated as **approved**; installed with
`pnpm --filter @fish/web add unicode-emoji-json` and execution continued
without pausing.

## Files Created/Modified

- `supabase/migrations/0015_reactions_any_emoji.sql` — additive migration removing the 4-emoji whitelist
- `apps/web/components/chat/emoji-picker/emoji-picker.tsx` — `EmojiPicker` panel + `EmojiPickerButton` popover trigger
- `apps/web/components/chat/emoji-picker/index.ts` — barrel re-export
- `apps/web/components/chat/emoji-picker/emoji-picker.stories.tsx` — Storybook stories
- `apps/web/components/chat/index.ts` — barrel export for the new emoji-picker module
- `apps/web/components/chat/reactions/reactions.tsx` — trailing add-reaction pill
- `apps/web/components/chat/reactions/reactions.stories.tsx` — `onToggle` on meta args
- `apps/web/components/chat/story-data.ts` — added `🔥` to the reactions mock
- `apps/web/app/globals.css` — single base-layer `cursor: pointer` rule
- `apps/web/app/(authenticated)/chat/chat-client.tsx` — hover-bar smiley trigger replaces hardcoded thumbs-up
- `apps/web/app/(authenticated)/chat/chat-client.test.tsx` — updated assertions for the picker flow
- `apps/web/package.json`, `pnpm-lock.yaml` — `unicode-emoji-json` dependency

## Decisions Made

- Used the `Input` component's `trailingControl` slot for the picker's
  `IconSearch` affordance (decorative, non-interactive) rather than
  hand-rolling a leading-icon search field, per AGENTS.md "reuse the base
  components" convention — the plan's interfaces section flagged `Input` as
  reusable for picker search.
- Picker panel opens `top-full right-0` (below-right of its trigger) in both
  the hover bar and the reactions row's add-pill, for a single consistent
  popover direction; the plan left direction unspecified.
- Kept `IconMoodSmile` explicitly imported and passed as `EmojiPickerButton`
  children in `chat-client.tsx` (rather than relying solely on the
  component's internal default) so the import stays used (no unused-import
  lint error) while still satisfying the plan's literal
  `grep -q "IconMoodSmile"` verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing broken workspace symlink for `packages/supabase`**
- **Found during:** Task 3 (`pnpm build` verification)
- **Issue:** `packages/supabase/node_modules` did not exist at all (pre-existing
  install-state issue, unrelated to any file this plan touches), so
  `@fish/core/roles` failed to resolve and `pnpm build` failed on
  `packages/supabase` before ever reaching `apps/web`.
- **Fix:** Ran `pnpm install` (no packages added — the lockfile already had
  the correct `unicode-emoji-json` entry from the earlier `pnpm --filter
  @fish/web add`; this just re-linked the existing workspace symlinks).
  Confirmed `packages/supabase/node_modules/@fish/core -> ../../../core`
  now exists.
- **Files modified:** none (node_modules is gitignored; no lockfile diff
  beyond the already-staged `unicode-emoji-json` entry from Task 3)
- **Verification:** `pnpm build` passes end-to-end (core, supabase, web);
  `pnpm typecheck` and `pnpm lint` in `apps/web` are clean.
- **Committed in:** `3a3f0dcf` (noted in the Task 3 commit body; no separate
  commit since node_modules isn't tracked)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy the hard `pnpm build` gate; no
scope creep — no source files outside the plan's file list were touched.

## Issues Encountered

None beyond the deviation above.

## Out-of-scope note (not modified)

`apps/web/components/ui/button/button.tsx` already hardcodes a
`cursor-pointer` utility class (asserted by an existing
`button.test.tsx` test). It is now redundant given the new global
base-layer rule, but it is pre-existing, outside this plan's file list, and
removing it risks an unrelated test/behavior change — left untouched per
the scope-boundary rule (not the "single base rule" the plan requires *this
task* to avoid duplicating).

## User Setup Required

None — no external service configuration required. The migration is
additive and will apply on the next `supabase db push`/migration run; no
manual dashboard steps.

## Next Phase Readiness

- Chat reactions now support any emoji end-to-end (DB, RPC, edge function,
  UI); the picker is reusable (`EmojiPicker`/`EmojiPickerButton` exported
  from `@/components/chat`) for any future reaction-style affordance.
- No blockers identified.

---

## Self-Check: PASSED

All files listed under "Files Created/Modified" and this SUMMARY.md verified
present on disk; both task commits (`9a8b5707`, `3a3f0dcf`) verified present
in `git log`.
