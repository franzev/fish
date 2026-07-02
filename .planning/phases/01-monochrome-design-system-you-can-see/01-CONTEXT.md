# Phase 1: Monochrome design system you can see - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Dual-theme (light + dark) pure-monochrome design tokens and a hardened UI kit (Button, Input, Card, Progress — every applicable state: default, hover, focus, disabled, loading, error), Lexend body / Fraunces headings, Tabler as the only icon set — all provable on a demo page that follows system preference with no flash of the wrong theme. Covers TOKN-01..06 and KIT-01..06. Auth screens (Phase 2) and app shell/routing (Phase 3) are out of scope; this phase produces the tokens and components those phases consume.

</domain>

<decisions>
## Implementation Decisions

### Grey palette & primary action
- **D-01:** Greys are pure neutral — zero chroma, no warm/cool undertone. The most literal reading of TOKN-01; color can be layered in later without fighting undertones.
- **D-02:** Scale ends are near-extremes, not absolutes: near-black dark background (~oklch 0.15), near-white light background (~oklch 0.98). Softer contrast reduces halation/glare for visually sensitive readers. No true #000/#fff page backgrounds.
- **D-03:** The primary action uses full-contrast inversion — near-black fill/white text in light theme, white fill/black text in dark theme. It is the highest-contrast solid on any screen; nothing else gets this treatment. Existing primary/secondary/ghost variant ladder keeps its structure.
- **D-04:** Token scale is semantic roles only (bg, surface, surface-2, border, foreground, body, muted, plus what states need). No numbered grey-50..950 ramp — component code only ever touches semantic names (TOKN-02).
- **D-05:** Keyboard focus ring becomes a two-tone ring (inner light + outer dark, outline + shadow) — guaranteed visible on any surface in both themes, including the inverted primary button.
- **D-06:** Elevation: soft shadows in light theme (user preference over border-forward). In dark theme — where shadows barely read — elevated surfaces are a slightly lighter grey than the page. Shadows are a light-theme-only detail.
- **D-07:** Exact oklch values: Claude proposes the full light + dark set during planning within these constraints (pure neutral, near-extremes, WCAG AA for every role pairing). The demo page is where values are judged and adjusted.

### Notices & errors in monochrome (KIT-02)
- **D-08:** Field-level attention signal = Tabler icon beside the message + thicker/darker field border. Structure and weight carry meaning, never hue.
- **D-09:** Two visual tiers, both calm: notice (info-circle icon, regular weight) vs error (alert-circle icon, heavier border, medium-weight message). A scanning user can tell "FYI" from "needs fixing" at a glance.
- **D-10:** A block-level Alert/Notice component (notice + error tiers, Tabler icon, calm copy slot) is built in this phase and shown on the demo page — Phase 2 auth screens consume it for form-level messages.
- **D-11:** Success feedback = Tabler circle-check + regular weight. Calm and unceremonious; same structural language as notices with a different icon. The sea-green success hue is removed with the rest of the palette.

### Demo page (KIT-06)
- **D-12:** The demo lives at a dedicated route `/kit` — it survives Phase 3 when `/` becomes the real app entry. Home can point to it in the interim.
- **D-13:** One long sectioned page: tokens, typography, icons, then component sections — the whole contract visible in a single scroll, no navigation choices.
- **D-14:** A demo-only light/dark/system control exists on `/kit` (dev tool, not a product toggle — THEM-01 client toggle stays v2). The theme mechanism must therefore support explicit override, not just media queries.
- **D-15:** The demo page ships in production builds, unlinked from any client-facing screen. No env gating.

### Token pipeline & theme mechanism
- **D-16:** Light/dark resolution uses CSS `light-dark()` driven by `color-scheme`. System-follow is zero-JS — no flash of wrong theme by construction (TOKN-04). The `/kit` override and a future v2 toggle just set `color-scheme`.
- **D-17:** Tokens stay hand-written CSS in `apps/web/app/globals.css` `@theme`, structured cleanly so later extraction to JSON is mechanical. No packages/tokens codegen this milestone (THEM-02 is v2; its trigger — native builds begin — has not fired).
- **D-18:** Tabler icons come in via `@tabler/icons-react` — tree-shakable named imports, consistent stroke props, one dependency (TOKN-06).
- **D-19:** WCAG AA contrast is verified by a small automated check — a script/test asserting AA for each foreground/background token pairing in both themes. The project's first test; guards regressions when values are tweaked after demo review.

### Claude's Discretion
- Exact oklch lightness values for every role in both themes (within D-01/D-02/D-07 constraints).
- Specific Tabler icon choices beyond the named ones (info-circle, alert-circle, circle-check).
- How hover/pressed states shift in monochrome (lightness shifts; keep calm, respect reduced motion).
- How the demo page statically displays interactive states (hover/focus) for review.
- Where the contrast check runs (build step vs test script) and its exact form.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & design rules
- `AGENTS.md` — Non-negotiable design rules (one primary action, 56px targets, never-scolding copy, no tailwind.config.js), stack lock, build order.
- `.planning/REQUIREMENTS.md` — TOKN-01..06 and KIT-01..06 requirement texts this phase must satisfy; v2 deferrals (THEM-01 toggle, THEM-02 token pipeline).
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria (the four "must be TRUE" statements).

### Current code being replaced/hardened
- `apps/web/app/globals.css` — Current light-only aquatic-blue oklch token set; every hue token is replaced; base layer already holds focus-visible and reduced-motion rules to preserve.
- `apps/web/app/page.tsx` — Current design-system showcase; superseded by the `/kit` demo route.
- `apps/web/components/ui/button.tsx`, `apps/web/components/ui/input.tsx`, `apps/web/components/ui/card.tsx` — Existing kit components (Button variants, Input notice prop, Card + Progress) to harden, not rewrite.
- `apps/web/lib/utils.ts` — `cn()` helper; all conditional classes go through it.

### Prior analysis
- `.planning/codebase/CONVENTIONS.md` — Naming, forwardRef/displayName, JSDoc, Tailwind/token conventions to follow.
- `.planning/codebase/STRUCTURE.md` — Where new code goes (ui components, routes, tokens).
- `.planning/research/SUMMARY.md` — Milestone research (pinned versions, Tailwind v4 pitfalls).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` (primary/secondary/ghost variants, fullWidth default), `Input` (label/hint/notice props), `Card`, `Progress` in `apps/web/components/ui/` — this phase hardens their states rather than rebuilding them.
- `cn()` in `apps/web/lib/utils.ts` (clsx + tailwind-merge) — the established class-merging pattern.
- Lexend + Fraunces already loaded via `next/font` in `apps/web/app/layout.tsx`; `--font-lexend`/`--font-fraunces` vars referenced in globals.css.
- `:focus-visible` outline and `prefers-reduced-motion` suppression already global in `globals.css` — the focus rule changes form (two-tone) but the accessibility floor stays.

### Established Patterns
- Tailwind v4 CSS-first: all tokens in `@theme` in globals.css; **never** create `tailwind.config.js`; keep `tailwindcss` and `@tailwindcss/postcss` on identical versions (currently 4.3.1).
- Components: named exports, `forwardRef` + `displayName` on focusable controls, props extend native HTML attributes, variants as discriminated unions, no raw hex in component code.
- `--size-control: 56px` token enforces tap-target minimum (KIT-04).

### Integration Points
- `apps/web/app/globals.css` `@theme` block — the single place tokens change.
- New route `apps/web/app/kit/page.tsx` for the demo page.
- New `apps/web/components/ui/alert.tsx` (block-level Notice/Alert) joins the kit.
- `@tabler/icons-react` added to `apps/web/package.json` (pnpm only).
- No test infrastructure exists yet — the contrast check (D-19) is the first; keep its footprint small.

</code_context>

<specifics>
## Specific Ideas

- The primary button should read as "the loudest thing on the screen" purely through contrast — in light theme a near-black block, in dark theme a white block.
- The demo page is explicitly the visual contract: future screens are judged against it, and token value changes are reviewed by looking at it, not at CSS diffs.
- Success moments stay quiet — a check icon, no celebration, consistent with reward-only/never-punish tone.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Pre-existing v2 items reaffirmed in passing: THEM-01 client-facing theme toggle, THEM-02 packages/tokens JSON pipeline.)

</deferred>

---

*Phase: 1-Monochrome design system you can see*
*Context gathered: 2026-07-02*
