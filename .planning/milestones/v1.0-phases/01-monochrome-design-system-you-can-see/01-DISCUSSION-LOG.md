# Phase 1: Monochrome design system you can see - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 1-Monochrome design system you can see
**Areas discussed:** Grey palette & primary action, Notices & errors in monochrome, Demo page shape, Token pipeline & theme mechanism

---

## Grey palette & primary action

| Option | Description | Selected |
|--------|-------------|----------|
| Pure neutral (Recommended) | Zero chroma — true greys, no undertone; most literal reading of TOKN-01 | ✓ |
| Slightly cool-tinted | Barely-there blue undertone; softer but technically a hue | |
| Slightly warm-tinted | Paper-like warmth; technically a hue, can read as sepia | |

**User's choice:** Pure neutral

| Option | Description | Selected |
|--------|-------------|----------|
| Near extremes (Recommended) | Near-black dark bg (~oklch 0.15), near-white light bg (~oklch 0.98); softer contrast, less halation | ✓ |
| True black & white | #000/#fff; maximal contrast, OLED benefit, risk of shimmer | |
| Mixed | True white light bg, near-black dark bg | |

**User's choice:** Near extremes

| Option | Description | Selected |
|--------|-------------|----------|
| Full-contrast inversion (Recommended) | Primary is the highest-contrast solid on screen; near-black/white in light, white/black in dark | ✓ |
| Softer solid | Mid-dark grey primary; gentler but competes less clearly | |
| You decide | Claude picks during planning | |

**User's choice:** Full-contrast inversion

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic roles only (Recommended) | bg, surface, surface-2, border, foreground, body, muted + state needs; no numbered ramp | ✓ |
| Numbered ramp + roles | grey-50..950 raw ramp with roles mapped on top | |
| You decide | Claude structures the scale | |

**User's choice:** Semantic roles only

| Option | Description | Selected |
|--------|-------------|----------|
| Two-tone ring (Recommended) | Inner light + outer dark ring; visible on any surface incl. inverted primary | ✓ |
| Foreground-colored ring | Single ring in foreground tone with offset gap | |
| You decide | Claude picks during planning | |

**User's choice:** Two-tone ring

| Option | Description | Selected |
|--------|-------------|----------|
| Borders + surface shift (Recommended) | Hairline border + surface tone; flat, editorial | |
| Soft shadows | Subtle drop shadows for depth; barely read in dark theme | ✓ |
| Both | Borders everywhere + light-theme shadow whisper | |

**User's choice:** Soft shadows (user preference over the border-forward recommendation)

| Option | Description | Selected |
|--------|-------------|----------|
| Lighter surface tone (Recommended) | Dark-theme elevation = slightly lighter grey than page | ✓ |
| Hairline border in dark | Page-tone cards with subtle border in dark only | |
| Shadows anyway | Same shadow in dark; weakest separation | |

**User's choice:** Lighter surface tone (follow-up after choosing shadows)

| Option | Description | Selected |
|--------|-------------|----------|
| Claude proposes (Recommended) | Planning proposes full light+dark values within decided constraints; demo page is the review surface | ✓ |
| I'll give references | User supplies reference values/palette to match | |

**User's choice:** Claude proposes

**Notes:** User asked for more questions after the first four in this area — focus ring, elevation, dark-theme cards, and value definition were the extension round.

---

## Notices & errors in monochrome

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + heavier border (Recommended) | Tabler icon beside message + thicker/darker field border | ✓ |
| Background well | Message in filled surface well under the field | |
| Border only | Heavier border + text; quietest, easiest to miss | |

**User's choice:** Icon + heavier border

| Option | Description | Selected |
|--------|-------------|----------|
| Two tiers (Recommended) | Notice: info-circle, regular weight. Error: alert-circle, heavier border, medium weight | ✓ |
| One unified language | Single treatment; copy alone differentiates | |

**User's choice:** Two tiers

| Option | Description | Selected |
|--------|-------------|----------|
| Build it in Phase 1 (Recommended) | Block-level Alert/Notice in the kit + demo page now; auth consumes it in Phase 2 | ✓ |
| Defer to Phase 2 | Field-level only this phase | |

**User's choice:** Build it in Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Check icon, regular weight (Recommended) | Tabler circle-check + normal text; calm, unceremonious | ✓ |
| Slightly celebratory | Check + medium weight + brief warm copy | |
| No success states this phase | Skip until a screen needs it | |

**User's choice:** Check icon, regular weight

---

## Demo page shape

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated route, e.g. /kit (Recommended) | Permanent address that survives Phase 3 claiming `/` | ✓ |
| Replace the home page | Demo stays at `/` until Phase 3 evicts it | |
| You decide | Claude places it during planning | |

**User's choice:** Dedicated route /kit

| Option | Description | Selected |
|--------|-------------|----------|
| One long page, sectioned (Recommended) | Whole contract in a single scroll | ✓ |
| Page per component | /kit/button, /kit/input…; can't see system at once | |
| Tabbed sections | One route, tab per component | |

**User's choice:** One long page, sectioned

| Option | Description | Selected |
|--------|-------------|----------|
| Demo-only theme control (Recommended) | light/dark/system switch existing only on /kit; dev tool, not product toggle | ✓ |
| Side-by-side rendering | Light and dark columns rendered simultaneously | |
| Follow system only | Flip the OS setting to check the other theme | |

**User's choice:** Demo-only theme control

| Option | Description | Selected |
|--------|-------------|----------|
| Ships in prod, unlinked (Recommended) | Always reachable, never linked from client screens; no env gating | ✓ |
| Dev-only | Excluded/404 in production | |

**User's choice:** Ships in prod, unlinked

---

## Token pipeline & theme mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| CSS light-dark() (Recommended) | Tokens declared once via light-dark(), driven by color-scheme; zero-JS system-follow, no FOUC | ✓ |
| Class/attribute swap | :root defaults + [data-theme="dark"] re-declare; needs pre-paint script | |
| You decide | Research/planning picks under TOKN-04 + /kit override constraints | |

**User's choice:** CSS light-dark()

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-written CSS (Recommended) | Tokens stay in globals.css @theme; structured for mechanical JSON extraction later | ✓ |
| JSON source now | packages/tokens generating CSS; native-ready earlier, adds codegen | |

**User's choice:** Hand-written CSS

| Option | Description | Selected |
|--------|-------------|----------|
| @tabler/icons-react (Recommended) | Official React package; tree-shakable, consistent stroke props | ✓ |
| Copy SVGs manually | Vendored local components; zero dependency, manual per icon | |
| You decide | Planner picks; Tabler-only constraint | |

**User's choice:** @tabler/icons-react

| Option | Description | Selected |
|--------|-------------|----------|
| Small automated check (Recommended) | Script/test asserting AA per fg/bg token pairing in both themes; first test in the repo | ✓ |
| Manual review only | Eyeball + contrast tool during demo review | |
| You decide | Planner decides verification; AA itself non-negotiable | |

**User's choice:** Small automated check

---

## Claude's Discretion

- Exact oklch lightness values for every role in both themes (within pure-neutral / near-extreme / AA constraints)
- Specific Tabler icon choices beyond info-circle, alert-circle, circle-check
- Hover/pressed state treatment (lightness shifts, calm, reduced-motion safe)
- How the demo page statically displays interactive states for review
- Where the contrast check runs (build step vs test script) and its exact form

## Deferred Ideas

None — discussion stayed within phase scope. Pre-existing v2 items reaffirmed: THEM-01 (client theme toggle), THEM-02 (packages/tokens JSON pipeline).
