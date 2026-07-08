---
sketch: 008
name: discord-community-reference
question: "What does the Discord community-chat idiom look like, reproduced faithfully, as a reference for FISH's community direction?"
winner: "A"
tags: [chat, community, reference, discord, recreation]
---

# Sketch 008: Discord community reference (pixel recreation)

## Design Question

A faithful, pixel-level recreation of a provided Discord dark-theme message-list
screenshot, kept as a concrete reference for the community-chat pivot. Unlike
sketches 001–007 this is **not** a FISH design proposal — it deliberately breaks
the monochrome theme to document the source idiom exactly.

## How to View

open .planning/sketches/008-discord-community-reference/index.html
(or via the sketches server: http://localhost:8765/.planning/sketches/008-discord-community-reference/index.html)

## Variants

- **A: Faithful recreation ★** — single variant by request; a pixel-faithful clone,
  not an exploration.

## Recreated elements (inventory from the screenshot)

- **Ground:** `#313338` page, `gg sans` stack at 16px/1.375, text `#dbdee1`,
  meta `#949ba4`.
- **Cozy message grid:** 72px content indent, 40px round avatar absolutely
  placed at `left:16px`, rows padded `2px 48px 2px 72px`, 17px between author
  groups, ~4px between consecutive messages from the same author (no repeated
  header).
- **Group header:** role-colored username (blue `#3498db`, orange `#e8a033`,
  pink `#e9527e`, weight 500, hover underline) → badge(s) → `7/2/26, 12:26 PM`
  timestamp at 12px muted.
- **Role tag pill:** "ZTM" — dark `#3d3f45` rounded-4px pill with a small sword
  glyph, 12px semibold, after the username and inside reply previews.
- **Profile badges:** gold star badge (syntax, kazu), orange shield (Labalaba),
  18px inline SVG.
- **Reply context row:** connector spline rising from the avatar
  (`border-left` + `border-top` + `border-top-left-radius:6px`, `#4e5058`),
  16px mini avatar, role-colored `@mention`, optional pill, single-line
  ellipsis-truncated preview at 14px `#b5bac1` that brightens on hover.
- **Hover band:** full-width `#2e3035` row highlight; the top row is frozen in
  that state to match the screenshot.
- **Avatar decoration:** pink hearts + sparkle overlaying kazu's avatar.
- **Date divider:** 1px `#3f4147` rules flanking a centered 12px semibold
  "July 6, 2026".
- **Multi-paragraph handling:** blank-line gap inside one message (Labalaba
  1:38 PM) vs. separate consecutive messages (kazu 1:44 PM run).

## Necessary substitutions

- Avatars: the real profile images aren't available — CSS gradient/emoji
  stand-ins approximate each avatar's palette and silhouette.
- Two messages are cut off at the screenshot's right edge; their visible text
  is transcribed verbatim and completed with the minimum words needed to
  close the sentence.
- Fonts: `gg sans` is Discord-proprietary; the stack falls back to
  Noto Sans/Helvetica.

## What to Look For

How the flat left-aligned author-row idiom (already adopted in the FISH
community feed) handles density: reply threading via splines, role signaling
via color + pills + badges, hover affordances, and date dividers — candidates
to translate into FISH's monochrome token system, deliberately NOT its colors.
