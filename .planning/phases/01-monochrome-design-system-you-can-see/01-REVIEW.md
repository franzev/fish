---
phase: 01-monochrome-design-system-you-can-see
reviewed: 2026-07-02T09:40:53Z
depth: standard
files_reviewed: 17
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
  - apps/web/tests/icon-source.test.ts
  - apps/web/vitest.config.ts
  - apps/web/vitest.setup.ts
findings:
  critical: 1
  warning: 7
  info: 5
  convention: 2
  total: 15
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-02T09:40:53Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the monochrome design-system phase: token ladder in `globals.css`, the four kit components (Button, Input, Card/Progress, Alert), the dev theme toggle, the `/kit` contract page, and the new test infrastructure (Vitest, contrast gate, icon-source guard).

Claims were verified empirically, not taken on faith: the full test suite was run (57/57 pass), untested contrast pairings were computed with colorjs.io, and a production `next build` was executed to inspect the emitted CSS (the Lightning CSS `light-dark()` polyfill IS active in the shipped chunk — zero native `light-dark()` occurrences, space-toggle variables and `data-kit-theme` flips present, so the theme-toggle mechanism is sound as documented).

The headline defect is serious: the two-tone focus ring in `globals.css` has its inner/outer colors **inverted**, making the keyboard focus indicator effectively invisible on the primary Button — in both themes — which is exactly the case the rule's own comment (D-05 / Pitfall 4) claims to handle. Beyond that: the Button `loading` state doesn't block keyboard activation, `--shadow-card` is spec-invalid native CSS that only works while the polyfill fires, the icon-source guard misses the most common banned-import forms, and the contrast gate does not cover several pairings the UI actually ships.

Positive verification (checked, not assumed): no raw hex in components, no hue utilities, all class merging goes through `cn()`, no `tailwind.config.js`, `forwardRef` + `displayName` on both focusable controls, named exports throughout, error copy is calm, all controls meet the 56px floor, and no debug artifacts or secrets anywhere in scope. The `/kit` page renders three `variant="primary"` buttons, which is acceptable here only because it is the design-contract page displaying states, not a product screen.

Note: the shared `gsd-tools.cjs verify conventions` module is not available in this environment (no plugin cache, no `CLAUDE_PLUGIN_ROOT`), consistent with 01-PATTERNS.md's own derivation note — rule-pack conventions were checked manually against the PATTERNS.md `## Conventions` table instead. All four named contracts (file-name casing, identifier casing, named exports, import style) are honored with zero deviations; two manual CONVENTION findings are listed below.

## Critical Issues

### CR-01: Two-tone focus ring colors are inverted — focus indicator is invisible on the primary Button in both themes

**File:** `apps/web/app/globals.css:106-111`
**Issue:** The rule paints two concentric bands outside the control: the `box-shadow` (4px spread) shows in the **inner** 0–2px zone, and the `outline` (2px, offset 2px, painted over the shadow per CSS painting order) forms the **outer** 2–4px zone. As written — verified in the production chunk as `outline: ... var(--lightningcss-light,#fff)...` / `box-shadow: ... var(--lightningcss-light,#0b0b0b)...` — the light theme produces an inner **black** band and an outer **white** band. A focused primary Button in light theme has a black fill (`--color-primary` = `oklch(0.15 0 0)` = `#0b0b0b`) on a near-white page (`#f8f8f8`): the inner black band merges seamlessly with the button fill and the outer white band is invisible against the page (1.06:1). The mirror failure occurs in dark theme (inner white band on the white primary fill, outer near-black band on the near-black page). The ring works on secondary/ghost/inputs but fails on exactly the control the comment says it protects ("the ring stays visible against the inverted primary fill in BOTH themes — Pitfall 4"). This violates the project's stated accessibility floor (visible keyboard focus) on the single most important control per screen, and no test covers it.
**Fix:** Swap the two `light-dark()` pairs so the inner band contrasts the primary fill and the outer band contrasts the page:
```css
:focus-visible {
  /* outer band — contrasts the page canvas */
  outline: 2px solid light-dark(oklch(0.15 0 0), oklch(1 0 0));
  outline-offset: 2px;
  /* inner band — contrasts the inverted primary fill */
  box-shadow: 0 0 0 4px light-dark(oklch(1 0 0), oklch(0.15 0 0));
  border-radius: 6px;
}
```
With the swap, every case has at least one visible band: light/primary (inner white + outer black both visible), light/surface (outer black), dark/primary (inner black + outer white), dark/surface (outer white). Add a regression test parsing this rule the way `theme-toggle.test.tsx` parses the `data-kit-theme` rules.

## Warnings

### WR-01: Button `loading` state does not prevent keyboard activation

**File:** `apps/web/components/ui/button.tsx:43-56`
**Issue:** `loading` applies `pointer-events-none`, which blocks mouse clicks only. The button remains enabled and focusable; a keyboard user (or assistive tech) can press Enter/Space on a focused loading button and fire `onClick` — a double-submit path on exactly the "Saving…" primary-action pattern the state exists for. `aria-busy` is advisory and does not block activation.
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
Note that for `type="submit"` buttons an implicit form submit via Enter in a field bypasses the button's onClick — the consuming form must also gate on the busy state; document that on the `loading` prop.

### WR-02: `--shadow-card` wraps a whole shadow list in `light-dark()` — invalid native CSS that only works while the Lightning CSS polyfill fires

**File:** `apps/web/app/globals.css:63` (consumer: `apps/web/components/ui/card.tsx:13`)
**Issue:** `light-dark()` accepts only `<color>` arguments per CSS Color 5. `light-dark(0 4px 16px oklch(0.15 0 0 / 0.08), none)` is not valid native CSS: in a browser resolving `light-dark()` natively, `box-shadow: var(--shadow-card)` becomes invalid at computed-value time and the shadow silently never renders. It works today only because the production pipeline downlevels it — verified in the built chunk, where Lightning CSS's space-toggle rewrite (`var(--lightningcss-light, 0 4px 16px …) var(--lightningcss-dark, none)`) happens to tolerate arbitrary token streams. The moment browser targets advance to include native `light-dark()` support (a browserslist bump or a Next.js default change), the polyfill stops being emitted and light-theme card elevation silently disappears — precisely the polyfill-coupled regression class this design system must guard against, and no test covers it.
**Fix:** Keep the shadow list native and put the theme switch inside the color component only:
```css
/* dark resolves to a fully transparent shadow — visually identical to none */
--shadow-card: 0 4px 16px light-dark(oklch(0.15 0 0 / 0.08), oklch(0 0 0 / 0));
```
This is valid native CSS and downlevels identically under the polyfill.

### WR-03: Icon-source guard misses subpath imports — the most common forms of the banned imports pass the gate

**File:** `apps/web/tests/icon-source.test.ts:33`
**Issue:** The regex `from\s+["']${specifier}["']` only matches an import of the exact bare specifier. Real-world usage of two of the three banned sets is almost always via subpaths: `from "@heroicons/react/24/outline"` and `from "react-icons/fa"`. Neither matches, so the guard (TOKN-06) provides false confidence for exactly the imports it exists to block. Dynamic `import("react-icons/fa")` is also uncovered.
**Fix:**
```ts
const importPattern = new RegExp(
  `from\\s+["']${specifier}(?:/[^"']*)?["']|import\\(\\s*["']${specifier}(?:/[^"']*)?["']`
);
```

### WR-04: Contrast gate does not cover several pairings the UI actually ships — the "every pairing is asserted" guarantee is false

**File:** `apps/web/tests/contrast.test.ts:99-116`
**Issue:** The globals.css header (lines 21–23) claims "Contrast on every pairing is asserted by tests/contrast.test.ts," but shipped pairings are missing from `textPairs`/`uiPairs`:
- `muted` on `surface` — input placeholder text (`placeholder:text-muted` on `bg-surface`, input.tsx:33-35)
- `body` on `surface-2` — the elevated Card variant (`/kit` renders `<Card className="bg-surface-2"><p className="text-body">`)
- `foreground` on `surface-2` — theme-toggle active state (theme-toggle.tsx:39)
- `notice`/`error` on `bg` — Input tier messages render on the page canvas, not on `surface`

All currently pass (computed: muted/surface 6.00 light / 6.28 dark; body/surface-2 10.64/10.82; foreground/surface-2 16.50/14.25; notice/bg 8.69/10.53; error/bg 17.09/17.00), so nothing is broken today — but a future token tweak could regress, e.g., placeholder contrast without any test failing, defeating the gate's purpose.
**Fix:** Add the five pairs above to `textPairs`. Alternatively derive the pair list from a single usage map shared with the components.

### WR-05: Input hint/notice/error messages are not programmatically associated with the field

**File:** `apps/web/components/ui/input.tsx:28-58`
**Issue:** The `<p>` messages have no `id` and the `<input>` has no `aria-describedby`, so screen readers announce nothing when focusing a field that carries a hint, notice, or error. There is also no `aria-invalid` on the error tier. The label is correctly wired via `htmlFor`, but the feedback tiers — the component's core feature this phase — are visual-only, which contradicts the accessibility floor this design system claims.
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
**Issue:** `Alert` is the design system's feedback surface, but it renders a bare `<div>`. On `/kit` it is static, so nothing breaks today — but the component contract is "form/feedback messaging," and the first consumer that renders an `Alert` in response to a submit will produce feedback that assistive tech never announces.
**Fix:** Add `role="status"` (polite — matches the calm, never-alarming voice; avoid assertive `role="alert"`) to the container, or expose it as a prop defaulting to `"status"`.

### WR-07: Caret ranges on the `tailwindcss` / `@tailwindcss/postcss` pair permit the exact version-mismatch AGENTS.md warns breaks the build

**File:** `apps/web/package.json:23,33`
**Issue:** AGENTS.md: "Keep `tailwindcss` and `@tailwindcss/postcss` on the **same** version or the build breaks." Both are declared as `^4.3.1` — two independent ranges. The lockfile keeps them synced today, but a partial `pnpm update @tailwindcss/postcss` (or `pnpm add` of either) can legally resolve them to different 4.x versions, producing exactly the breakage the constraint exists to prevent.
**Fix:** Pin both exactly (`"4.3.1"`), matching the exact-pin style of the pre-existing dependencies (`clsx`, `tailwind-merge`, `next`, `react`).

## Info

### IN-01: Progress renders `width: NaN%` and `aria-valuenow={NaN}` when passed NaN

**File:** `apps/web/components/ui/card.tsx:29`
**Issue:** `Math.max(0, Math.min(100, NaN))` is `NaN` — a NaN `value` (e.g., from a failed calculation upstream) yields an invalid inline width and an invalid ARIA value.
**Fix:** `const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;`

### IN-02: Progress bar has no accessible name — the visible label is not linked to the progressbar

**File:** `apps/web/components/ui/card.tsx:31-46`
**Issue:** The `label` renders as a sibling `<p>` with no `aria-labelledby`/`aria-label` on the `role="progressbar"` element, so screen readers announce an unnamed progressbar.
**Fix:** Generate an id with `useId()`, put it on the label `<p>`, and add `aria-labelledby` to the progressbar (only when `label` is provided).

### IN-03: Global `:focus-visible` sets `border-radius: 6px` on the focused element itself

**File:** `apps/web/app/globals.css:110`
**Issue:** This rounds the element's own background/border corners on focus for any element without a Tailwind radius utility (kit components are unaffected only because the utilities layer out-cascades `@layer base`). A plain focused link or native control visually changes shape on focus. Modern browsers make both `outline` and `box-shadow` follow the element's own `border-radius` automatically, so the declaration mostly adds a side effect.
**Fix:** Remove the `border-radius` declaration from the global rule, or accept and document the corner change for radius-less elements.

### IN-04: `colorjs.io` is a production dependency but is only used by tests

**File:** `apps/web/package.json:16`
**Issue:** `colorjs.io` is imported solely by `tests/contrast.test.ts` yet sits in `dependencies`, polluting the production dependency tree (audit surface, install weight).
**Fix:** Move to `devDependencies`.

### IN-05: `theme-toggle.test.tsx` CSS-source regexes are whitespace-brittle

**File:** `apps/web/components/kit/theme-toggle.test.tsx:71-76`
**Issue:** The regression guard requires the exact formatting `html[data-kit-theme="light"] {\n color-scheme: light;` — a semantically identical reformat (single quotes, extra declaration first, `color-scheme:light` without space after the colon) fails the test spuriously. Acceptable for a deliberate tripwire, but it will fire on formatting-only changes, which trains people to ignore it.
**Fix:** Loosen to formatting-tolerant patterns, e.g. `/html\[data-kit-theme=['"]light['"]\][^}]*color-scheme:\s*light/`.

## Conventions

### CV-01: Alert message color deviates from Input's tier-message color convention

**File:** `apps/web/components/ui/alert.tsx:57` (vs `apps/web/components/ui/input.tsx:48,54`)
**Deviation:** Input renders tier messages in the tier's own token (`text-notice` / `text-error`); Alert renders every tone's message in `text-body`, differentiating by weight/border/icon only.
**Derived convention:** Tier feedback text uses the matching tier token (`input.tsx` precedent; the `--color-notice`/`--color-error` tokens exist for this and are contrast-asserted against `surface`).
**Suggested fix:** Add `text-notice` / `text-error` to `messageClassName` in `toneConfig` (both are monochrome, so no design-rule tension), or document why Alert intentionally differs.

### CV-02: New dependencies use caret ranges against the file's dominant exact-pin style

**File:** `apps/web/package.json:14,16,23-35`
**Deviation:** Every dependency predating this phase is pinned exactly (`clsx 2.1.1`, `tailwind-merge 2.6.0`, `next`, `react`, `typescript`, `@types/*`); every dependency added this phase uses `^` (`@tabler/icons-react`, `colorjs.io`, `@testing-library/*`, `vitest`, `jsdom`, `@vitejs/plugin-react`, `eslint`, the tailwind pair).
**Derived convention:** Exact version pins (unanimous across the pre-existing declarations).
**Suggested fix:** Pin new dependencies exactly; the tailwind pair specifically is escalated separately as WR-07.

---

_Reviewed: 2026-07-02T09:40:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
