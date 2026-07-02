---
phase: 01-monochrome-design-system-you-can-see
reviewed: 2026-07-02T12:28:45Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - apps/web/app/globals.css
  - apps/web/app/kit/page.tsx
  - apps/web/components/kit/theme-toggle.test.tsx
  - apps/web/components/kit/theme-toggle.tsx
  - apps/web/components/ui/alert.test.tsx
  - apps/web/components/ui/alert.tsx
  - apps/web/components/ui/button.test.tsx
  - apps/web/components/ui/button.tsx
  - apps/web/components/ui/card.test.tsx
  - apps/web/components/ui/card.tsx
  - apps/web/components/ui/input.test.tsx
  - apps/web/components/ui/input.tsx
  - apps/web/package.json
  - apps/web/tests/contrast.test.ts
  - apps/web/tests/focus-ring.test.ts
  - apps/web/tests/icon-source.test.ts
  - apps/web/vitest.config.ts
  - apps/web/vitest.setup.ts
findings:
  critical: 0
  warning: 8
  info: 9
  convention: 3
  total: 20
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-02T12:28:45Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Re-review of the monochrome design-system phase after gap-closure plan 01-04 landed. This report supersedes the 2026-07-02T09:40:53Z review of the earlier snapshot. Scope: the token ladder and focus ring in `globals.css`, the kit components (Button, Input, Card/Progress, Alert), the dev theme toggle, the `/kit` contract page, and the test infrastructure — including the new `tests/focus-ring.test.ts`.

Claims were verified empirically: the full suite was run (71/71 pass) and every contrast ratio quoted below was recomputed independently with colorjs.io.

**The prior CRITICAL is confirmed fixed.** The two-tone `:focus-visible` ring bands in `globals.css:106-111` are now correctly assigned: the outline (outer band, painted over the shadow at offset 2–4px) is `light-dark(oklch(0.15), oklch(1))` and contrasts the page canvas at 18.57:1 light / 19.67:1 dark; the box-shadow (inner band, visible in the 0–2px offset gap) is `light-dark(oklch(1), oklch(0.15))` and contrasts the inverted primary fill at 19.67:1 light / 18.57:1 dark. The geometry claim (outline paints over the 4px shadow spread, so shadow = inner band, outline = outer band) checks out against CSS painting order. The new `focus-ring.test.ts` guards exactly the designated band-to-target pairings, and its either-band-suffices `max()` logic correctly still catches the original full-swap defect (both designated pairings would fail at ~1.06:1) while tolerating half-swaps that remain genuinely visible. The five WR-04 text pairings were added to `contrast.test.ts` as prescribed.

What remains: **six warnings from the prior review were not addressed by 01-04 and are still present** (Button loading keyboard activation, spec-invalid `--shadow-card`, the icon-guard subpath hole, Input ARIA association, Alert live-region semantics, the unpinned Tailwind pair), the contrast gate still omits shipped **non-text** pairings — one of which (`border` on `bg`) passes light theme by only 0.18 — and this pass surfaced new items in the `/kit` page heading structure and the new test file itself.

Positive verification (checked, not assumed): no `tailwind.config.js`, no raw hex in components, all class merging via `cn()`, `forwardRef` + `displayName` on both focusable controls, named exports throughout, calm error copy, 56px control floor on every control, `/kit` unlinked from the home page, and no debug artifacts or secrets in scope.

Note: the shared `gsd-tools.cjs verify conventions` module is not available in this environment (no `gsd-plugin` cache directory, no `CLAUDE_PLUGIN_ROOT`), consistent with 01-PATTERNS.md's own derivation note — the rule packs were applied manually against the PATTERNS.md `## Conventions` table. All four named contracts (file-name casing, identifier casing, named exports, import style) are honored across the changed files; no verb-vs-body mismatches; no `process.env` or catch-block style deviations. Three manual CONVENTION findings are listed below. The `__dirname` vs `fileURLToPath` split across test files is 2-vs-2 (contested axis) and is deliberately not flagged.

## Warnings

### WR-01: Button `loading` state does not prevent keyboard activation

**File:** `apps/web/components/ui/button.tsx:40-56`
**Issue:** Carried over from the prior review — unaddressed. `loading` applies `pointer-events-none`, which blocks mouse clicks only. The button remains enabled and focusable; a keyboard user (or assistive tech) can press Enter/Space on a focused loading button and fire `onClick` — a double-submit path on exactly the "Saving…" primary-action pattern the state exists for. `aria-busy` is advisory and does not block activation.
**Fix:** Suppress the handler while loading (preserves focus, unlike `disabled` which drops it):
```tsx
const { onClick, ...rest } = props;
// ...
<button
  ref={ref}
  aria-busy={loading || undefined}
  aria-disabled={loading || undefined}
  onClick={loading ? undefined : onClick}
  {...rest}
>
```
For `type="submit"` buttons, an implicit form submit via Enter in a field bypasses the button's onClick — the consuming form must also gate on the busy state; document that on the `loading` prop.

### WR-02: `--shadow-card` wraps a whole shadow list in `light-dark()` — invalid native CSS that only works while the Lightning CSS polyfill fires

**File:** `apps/web/app/globals.css:63` (consumer: `apps/web/components/ui/card.tsx:13`)
**Issue:** Carried over — unaddressed. `light-dark()` accepts only `<color>` arguments per CSS Color 5. `light-dark(0 4px 16px oklch(0.15 0 0 / 0.08), none)` is not valid native CSS: in a browser resolving `light-dark()` natively, `box-shadow: var(--shadow-card)` becomes invalid at computed-value time and the shadow silently never renders. It works today only because the build pipeline downlevels `light-dark()` into a space-toggle variable polyfill that happens to tolerate arbitrary token streams. When browser targets advance far enough that the polyfill stops being emitted (a browserslist bump or Next.js default change), light-theme card elevation silently disappears — the same polyfill-coupled regression class the theme-toggle comments in this very file warn about, and no test covers it.
**Fix:** Keep the shadow list native and put the theme switch inside the color component only:
```css
/* dark resolves to a fully transparent shadow — visually identical to none */
--shadow-card: 0 4px 16px light-dark(oklch(0.15 0 0 / 0.08), oklch(0 0 0 / 0));
```
This is valid native CSS and downlevels identically under the polyfill.

### WR-03: Icon-source guard misses subpath imports — the most common forms of the banned imports pass the gate

**File:** `apps/web/tests/icon-source.test.ts:33`
**Issue:** Carried over — unaddressed. The regex `from\s+["']${specifier}["']` only matches an import of the exact bare specifier. Real-world usage of two of the three banned sets is almost always via subpaths: `from "@heroicons/react/24/outline"` and `from "react-icons/fa"`. Neither matches, so the TOKN-06 guard provides false confidence for exactly the imports it exists to block. Dynamic `import("react-icons/fa")` is also uncovered.
**Fix:**
```ts
const importPattern = new RegExp(
  `from\\s+["']${specifier}(?:/[^"']*)?["']|import\\(\\s*["']${specifier}(?:/[^"']*)?["']`
);
```

### WR-04: Contrast gate still omits shipped non-text pairings — `border` on `bg` passes light theme by only 0.18

**File:** `apps/web/tests/contrast.test.ts:120-123`
**Issue:** Plan 01-04 closed the five missing *text* pairings, but `uiPairs` still asserts only `border`/`surface` and `border-strong`/`surface`. Shipped non-text pairings that remain unasserted (ratios recomputed with colorjs.io):
- `border` on `bg` — **3.18 light / 4.05 dark**. The outer edge of every Input field, secondary Button, and theme-toggle button borders the page canvas, and the `/kit` swatch tiles draw `border-border` directly on `bg`. Light theme clears the 3.0 non-text floor by just 0.18 — a small lightening of `--color-border` (e.g., 0.64 → 0.67) would regress below AA with **no test failing**, while the asserted `border`/`surface` pair (3.36) still passes.
- `border-strong` on `bg` — 4.58 / 6.08 (notice-tier field borders against the canvas).
- `primary` on `surface-2` — 16.50 / 14.67 (the Progress fill against its track; huge margin, but it is the component's only visual signal).

The `globals.css` header claim (lines 21–23, "Contrast on every pairing is asserted by tests/contrast.test.ts") therefore remains overstated.
**Fix:** Add `["border", "bg"]`, `["border-strong", "bg"]`, and `["primary", "surface-2"]` to `uiPairs`. The `border`/`bg` pair is the load-bearing one.

### WR-05: Input hint/notice/error messages are not programmatically associated with the field

**File:** `apps/web/components/ui/input.tsx:28-58`
**Issue:** Carried over — unaddressed. The `<p>` messages have no `id` and the `<input>` has no `aria-describedby`, so screen readers announce nothing when focusing a field that carries a hint, notice, or error. There is also no `aria-invalid` on the error tier. The label is correctly wired via `htmlFor`, but the feedback tiers — the component's core feature this phase — are visual-only, which contradicts the accessibility floor this design system claims.
**Fix:**
```tsx
const messageId = `${inputId}-message`;
const message = error ?? notice ?? hint;
// ...
<input
  aria-describedby={message ? messageId : undefined}
  aria-invalid={error ? true : undefined}
  ...
/>
{/* give the rendered message <p> id={messageId} */}
```

### WR-06: Alert has no live-region semantics — dynamically rendered feedback is silent for screen-reader users

**File:** `apps/web/components/ui/alert.tsx:40-62`
**Issue:** Carried over — unaddressed. `Alert` is the design system's feedback surface, but it renders a bare `<div>`. On `/kit` it is static, so nothing breaks today — but the first consumer that renders an `Alert` in response to a submit will produce feedback that assistive tech never announces.
**Fix:** Add `role="status"` (polite — matches the calm, never-alarming voice; avoid assertive `role="alert"`) to the container, or expose it as a prop defaulting to `"status"`.

### WR-07: Caret ranges on the `tailwindcss` / `@tailwindcss/postcss` pair permit the exact version mismatch AGENTS.md warns breaks the build

**File:** `apps/web/package.json:23,33`
**Issue:** Carried over — unaddressed. AGENTS.md: "Keep `tailwindcss` and `@tailwindcss/postcss` on the **same** version or the build breaks." Both are declared as `^4.3.1` — two independent ranges. The lockfile keeps them synced today, but a partial `pnpm update @tailwindcss/postcss` (or a `pnpm add` of either) can legally resolve them to different 4.x versions, producing exactly the breakage the constraint exists to prevent.
**Fix:** Pin both exactly (`"4.3.1"`), matching the exact-pin style of the pre-existing dependencies (`clsx`, `tailwind-merge`, `next`, `react`).

### WR-08: `/kit` page has two `<h1>` elements and an inverted heading hierarchy

**File:** `apps/web/app/kit/page.tsx:45,77` (also `:81`)
**Issue:** The page heading is `<h1>UI kit</h1>` (line 45), but the Typography specimen section renders a second `<h1>` (line 77, "The whole job is to remove choices") and an `<h2>` (line 81) *nested under* the section's own `<h2>Typography</h2>`. The screen-reader document outline becomes: h1 "UI kit" → h2 "Tokens" → h2 "Typography" → **h1 specimen** → h2 specimen → h2 "Icons" …, which breaks heading navigation on a page that ships to production (unlinked, but reachable). Specimens demonstrate visual styles, not document structure — they should not be real heading elements. For a project whose floor is inclusive accessibility, this is a defect, not a nit.
**Fix:** Render the specimens as paragraphs carrying the heading styles:
```tsx
<p className="font-serif text-[32px] font-semibold leading-[1.15] tracking-[-0.01em] text-foreground">
  The whole job is to remove choices
</p>
```
(Same treatment for the 20px specimen.)

## Info

### IN-01: Progress renders `width: NaN%` and `aria-valuenow={NaN}` when passed NaN

**File:** `apps/web/components/ui/card.tsx:29`
**Issue:** Carried over — unaddressed. `Math.max(0, Math.min(100, NaN))` is `NaN` — a NaN `value` (e.g., from a failed calculation upstream) yields an invalid inline width and an invalid ARIA value.
**Fix:** `const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;`

### IN-02: Progress bar has no accessible name — the visible label is not linked to the progressbar

**File:** `apps/web/components/ui/card.tsx:31-46`
**Issue:** Carried over — unaddressed. The `label` renders as a sibling `<p>` with no `aria-labelledby`/`aria-label` on the `role="progressbar"` element, so screen readers announce an unnamed progressbar.
**Fix:** Generate an id with `useId()`, put it on the label `<p>`, and add `aria-labelledby` to the progressbar (only when `label` is provided).

### IN-03: Global `:focus-visible` sets `border-radius: 6px` on the focused element itself

**File:** `apps/web/app/globals.css:110`
**Issue:** Carried over — unaddressed. This rounds the element's own background/border corners on focus for any element without a Tailwind radius utility (kit components are unaffected only because the utilities layer out-cascades `@layer base`). A plain focused link or native control visually changes shape on focus. Modern browsers make both `outline` and `box-shadow` follow the element's own `border-radius` automatically, so the declaration mostly adds a side effect. Relatedly, any future *focusable* element carrying a `shadow-*` utility will out-cascade the ring's `box-shadow` and silently lose its inner band.
**Fix:** Remove the `border-radius` declaration from the global rule, or accept and document the corner change for radius-less elements.

### IN-04: `colorjs.io` is a production dependency but is only used by tests

**File:** `apps/web/package.json:16`
**Issue:** Carried over — unaddressed (and now imported by two test files). `colorjs.io` is imported solely by `tests/contrast.test.ts` and `tests/focus-ring.test.ts` yet sits in `dependencies`, polluting the production dependency tree (audit surface, install weight).
**Fix:** Move to `devDependencies`.

### IN-05: `theme-toggle.test.tsx` CSS-source regexes are whitespace-brittle

**File:** `apps/web/components/kit/theme-toggle.test.tsx:71-76`
**Issue:** Carried over — unaddressed. The regression guard requires the exact formatting `html[data-kit-theme="light"] {\n color-scheme: light;` — a semantically identical reformat (single quotes, an extra declaration first, `color-scheme:light` without a space) fails the test spuriously. Acceptable for a deliberate tripwire, but it fires on formatting-only changes, which trains people to ignore it.
**Fix:** Loosen to formatting-tolerant patterns, e.g. `/html\[data-kit-theme=['"]light['"]\][^}]*color-scheme:\s*light/`.

### IN-06: ~35 lines of CSS token-parsing machinery duplicated between the two token test files

**File:** `apps/web/tests/focus-ring.test.ts:28-46` (duplicates `apps/web/tests/contrast.test.ts:25-43`)
**Issue:** New with 01-04. `TokenPair`, the comment-stripping regex, and `parseTokens` (including the identical `light-dark(oklch(...), oklch(...))` regex) are copy-pasted between `contrast.test.ts` and `focus-ring.test.ts`. If the token declaration syntax ever changes (e.g., a token gains an alpha channel wrapped differently), one parser can be updated and the other silently keep matching stale or zero tokens — and `parseTokens` returning an empty record in `focus-ring.test.ts` would surface as a confusing `tokens.bg[theme]` TypeError rather than a clear failure.
**Fix:** Extract a shared `tests/helpers/css-tokens.ts` exporting `stripComments`, `parseTokens`, and `TokenPair`; have both test files import it.

### IN-07: Focus-ring test hard-codes the band geometry it depends on without asserting it

**File:** `apps/web/tests/focus-ring.test.ts:85-105` (geometry defined in `apps/web/app/globals.css:106-111`)
**Issue:** The "outline = outer band, box-shadow = inner band" designation is only true because `outline-offset: 2px` + 2px outline width exactly tile the 4px box-shadow spread (outline paints over the shadow in the 2–4px zone, leaving the shadow visible at 0–2px). The test parses only the *colors*; if someone changes `outline-offset` to `0` or shrinks the shadow spread, the bands' physical positions swap or collapse while the color assertions keep passing — the guard would then be asserting the wrong jobs.
**Fix:** Also parse and assert the geometry invariant (`outline-offset` + outline width ≈ shadow spread, offset > 0), or at minimum assert `outline-offset` is `2px` and the spread `4px` alongside the colors, with a comment tying them to the band designation.

### IN-08: KitThemeToggle never cleans up its `<html>` attribute on unmount — the override can leak app-wide

**File:** `apps/web/components/kit/theme-toggle.tsx:13-24`
**Issue:** The effect writes `data-kit-theme` onto `document.documentElement` but returns no cleanup. `<html>` never remounts under App Router client navigation, so if any future page links away from `/kit` after a toggle, the forced theme persists across the entire app for the session. No client-side path off `/kit` exists today, so this is latent — but the component's stated contract is a preview scoped to `/kit`.
**Fix:** Return a cleanup that removes the attribute:
```tsx
useEffect(() => {
  if (mode === "system") {
    delete document.documentElement.dataset.kitTheme;
  } else {
    document.documentElement.dataset.kitTheme = mode;
  }
  return () => {
    delete document.documentElement.dataset.kitTheme;
  };
}, [mode]);
```

### IN-09: Stale "lime fill" comment on Progress — the design is pure monochrome

**File:** `apps/web/components/ui/card.tsx:27`
**Issue:** The doc comment reads "Visual progress: a lime fill on a dark track", but this phase's token ladder is pure monochrome (chroma 0, asserted by TOKN-01) and the fill is `bg-primary` (black/white inversion). The comment describes a superseded design and will mislead the next maintainer. (Same drift exists in AGENTS.md's token list — "bg-primary lime", "accent-pink/yellow" — which no longer matches `globals.css`; out of this review's file scope but worth a follow-up doc fix.)
**Fix:** Update the comment: "Visual progress: an inverted monochrome fill on a subtle track. No numbers shouted at the user."

## Conventions

### CV-01: Alert message color deviates from Input's tier-message color convention

**File:** `apps/web/components/ui/alert.tsx:57` (vs `apps/web/components/ui/input.tsx:48,54`)
**Deviation:** Input renders tier messages in the tier's own token (`text-notice` / `text-error`); Alert renders every tone's message in `text-body`, differentiating by weight/border/icon only.
**Derived convention:** Tier feedback text uses the matching tier token (`input.tsx` precedent; the `--color-notice`/`--color-error` tokens exist for this and are contrast-asserted against both `surface` and `bg`).
**Suggested fix:** Add `text-notice` / `text-error` to `messageClassName` in `toneConfig` (both are monochrome, so no design-rule tension), or document why Alert intentionally differs.

### CV-02: New dependencies use caret ranges against the file's dominant exact-pin style

**File:** `apps/web/package.json:14,16,23-35`
**Deviation:** Every dependency predating this phase is pinned exactly (`clsx 2.1.1`, `tailwind-merge 2.6.0`, `next`, `react`, `typescript`, `@types/*`); every dependency added this phase uses `^` (`@tabler/icons-react`, `colorjs.io`, `@testing-library/*`, `vitest`, `jsdom`, `@vitejs/plugin-react`, `eslint`, the tailwind pair).
**Derived convention:** Exact version pins (unanimous across the pre-existing declarations).
**Suggested fix:** Pin new dependencies exactly; the tailwind pair specifically is escalated separately as WR-07.

### CV-03: `Progress` lives inside `card.tsx` instead of its own component file

**File:** `apps/web/components/ui/card.tsx:28-49`
**Deviation:** Every other kit component follows one-component-per-file with the file named after the component (`button.tsx`, `input.tsx`, `alert.tsx`); `card.tsx` exports both `Card` and `Progress`, and consumers import `Progress` from `"@/components/ui/card"`, which reads wrong at the call site (`app/kit/page.tsx:4`).
**Derived convention:** File-name-matches-component, one exported component per `components/ui/` file (3 of 4 files; the named "file-name casing" contract in 01-PATTERNS.md).
**Suggested fix:** Extract `Progress` to `apps/web/components/ui/progress.tsx` and update the two import sites.

---

_Reviewed: 2026-07-02T12:28:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
