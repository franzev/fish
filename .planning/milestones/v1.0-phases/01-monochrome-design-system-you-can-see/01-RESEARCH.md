# Phase 1: Monochrome design system you can see - Research

**Researched:** 2026-07-02
**Domain:** Tailwind CSS v4 CSS-first dual-theme tokens, React component hardening, Tabler icon integration, zero-JS theme switching, WCAG contrast verification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Grey palette & primary action**
- **D-01:** Greys are pure neutral — zero chroma, no warm/cool undertone. The most literal reading of TOKN-01; color can be layered in later without fighting undertones.
- **D-02:** Scale ends are near-extremes, not absolutes: near-black dark background (~oklch 0.15), near-white light background (~oklch 0.98). Softer contrast reduces halation/glare for visually sensitive readers. No true #000/#fff page backgrounds.
- **D-03:** The primary action uses full-contrast inversion — near-black fill/white text in light theme, white fill/black text in dark theme. It is the highest-contrast solid on any screen; nothing else gets this treatment. Existing primary/secondary/ghost variant ladder keeps its structure.
- **D-04:** Token scale is semantic roles only (bg, surface, surface-2, border, foreground, body, muted, plus what states need). No numbered grey-50..950 ramp — component code only ever touches semantic names (TOKN-02).
- **D-05:** Keyboard focus ring becomes a two-tone ring (inner light + outer dark, outline + shadow) — guaranteed visible on any surface in both themes, including the inverted primary button.
- **D-06:** Elevation: soft shadows in light theme (user preference over border-forward). In dark theme — where shadows barely read — elevated surfaces are a slightly lighter grey than the page. Shadows are a light-theme-only detail.
- **D-07:** Exact oklch values: Claude proposes the full light + dark set during planning within these constraints (pure neutral, near-extremes, WCAG AA for every role pairing). The demo page is where values are judged and adjusted.

**Notices & errors in monochrome (KIT-02)**
- **D-08:** Field-level attention signal = Tabler icon beside the message + thicker/darker field border. Structure and weight carry meaning, never hue.
- **D-09:** Two visual tiers, both calm: notice (info-circle icon, regular weight) vs error (alert-circle icon, heavier border, medium-weight message). A scanning user can tell "FYI" from "needs fixing" at a glance.
- **D-10:** A block-level Alert/Notice component (notice + error tiers, Tabler icon, calm copy slot) is built in this phase and shown on the demo page — Phase 2 auth screens consume it for form-level messages.
- **D-11:** Success feedback = Tabler circle-check + regular weight. Calm and unceremonious; same structural language as notices with a different icon. The sea-green success hue is removed with the rest of the palette.

**Demo page (KIT-06)**
- **D-12:** The demo lives at a dedicated route `/kit` — it survives Phase 3 when `/` becomes the real app entry. Home can point to it in the interim.
- **D-13:** One long sectioned page: tokens, typography, icons, then component sections — the whole contract visible in a single scroll, no navigation choices.
- **D-14:** A demo-only light/dark/system control exists on `/kit` (dev tool, not a product toggle — THEM-01 client toggle stays v2). The theme mechanism must therefore support explicit override, not just media queries.
- **D-15:** The demo page ships in production builds, unlinked from any client-facing screen. No env gating.

**Token pipeline & theme mechanism**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Pre-existing v2 items reaffirmed in passing: THEM-01 client-facing theme toggle, THEM-02 packages/tokens JSON pipeline.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|--------------------|
| TOKN-01 | All UI renders in pure monochrome — black, white, and greys only; no hue-based color values remain in the token set | Pattern 1 (`light-dark()` tokens); D-01/D-02 constraints applied to every token; verified via contrast-test chroma assertion in Validation Architecture |
| TOKN-02 | Tokens use role-based semantic names — no hue names — so color can be layered in later without renaming | Pattern 1 example token set uses only role names (bg, surface, surface-2, border, foreground, body, muted, primary, on-primary, notice, error, success); Anti-Patterns section explicitly bars numbered grey ramps |
| TOKN-03 | Light and dark themes are both fully specified — every token (including error/disabled/focus states) resolves correctly in both | Pattern 1 (`light-dark()` per-token) + Pitfall 2 (silent no-op if `color-scheme` unset) + Validation Architecture contrast test mapped to this requirement |
| TOKN-04 | Theme follows system preference automatically with no flash of wrong theme on first paint | Summary + Pattern 1: `color-scheme: light dark` resolves natively before first paint, zero JS; State of the Art table explains why this supersedes the inline-script pattern in PITFALLS.md |
| TOKN-05 | Lexend renders as body/UI font and Fraunces as heading/display font on every screen | Existing `next/font` setup in `layout.tsx` already satisfies this — no change needed; Validation Architecture includes a font-family assertion test |
| TOKN-06 | Tabler Icons is the single icon source; no other icon sets are imported | Standard Stack (`@tabler/icons-react` 3.44.0, verified); Anti-Patterns bars wildcard imports; Validation Architecture includes a grep-based check for competing icon packages |
| KIT-01 | Button, Input, Card, and Progress render correct default/hover/focus/disabled/loading/error states in both themes | Pattern 3 (structural state hardening) + Pitfall 4 (focus ring visibility on inverted primary button) + existing component code reviewed directly (`button.tsx`, `input.tsx`, `card.tsx`) |
| KIT-02 | Errors and notices distinguishable via weight/structure/iconography, never red; copy never scolds | Pattern 3 + D-08/D-09/D-11 mapped directly to Alert/Input tone config example; Code Examples section shows exact Tabler icon usage |
| KIT-03 | New base components required by this milestone are built needs-driven, no speculative components | Recommended Project Structure scopes exactly one new component (Alert) plus one dev-only helper (KitThemeToggle) — no other new components introduced |
| KIT-04 | Every interactive control is at least 56px tall | Don't Hand-Roll table (existing `--size-control` token pattern); Validation Architecture maps this to a unit test on Button/Input computed min-height |
| KIT-05 | Every interactive element shows visible keyboard focus; non-essential motion suppressed under prefers-reduced-motion | Pattern 3 two-tone focus ring example; existing `globals.css` reduced-motion rule confirmed already present and to be preserved |
| KIT-06 | A UI kit demo page shows every component in every state in both themes | Recommended Project Structure (`/kit` route) + Pattern 2 (dev theme toggle) + Pitfall 5 (Alert must not be under-scoped on the demo page) |
</phase_requirements>

## Summary

This phase has no backend/network surface — it is pure frontend token + component work inside `apps/web`, which keeps risk low and research highly verifiable. The single architectural decision that dominates everything else is D-16: use the native CSS `light-dark()` function (not Tailwind's `dark:` variant) to drive theme resolution. `light-dark()` requires `color-scheme: light dark` on `:root` for system-follow, and is overridden per-subtree by setting an explicit `color-scheme: light` or `color-scheme: dark` — this is a completely different mechanism from Tailwind's `@custom-variant dark`, and the two should not be mixed. This gives true zero-JS system-follow (TOKN-04) by construction: the browser resolves the correct token value at first paint, before any JS runs, so there is no FOUC and no inline `<script>` needed for the default case. The `/kit` demo override (D-14) only needs to set `color-scheme` explicitly on `html` via a tiny client component — it does not need `localStorage` FOUC-prevention machinery because it is dev-only and unauthenticated.

`light-dark()` has Baseline-2024 support (Chrome/Edge 123+, Firefox 120+, Safari 17.5+, ~85% global) — safe to rely on with no fallback for a 2026-built greenfield product. Tokens are defined as plain CSS custom properties using `light-dark(lightValue, darkValue)` and then mapped into Tailwind's `@theme` block so `bg-surface`, `text-foreground`, etc. keep working exactly as today — no changes to component code or Tailwind class usage are required, only to how `globals.css` defines the underlying values.

`@tabler/icons-react` is confirmed on the npm registry at 3.44.0, is auto-optimized by Next.js's built-in `optimizePackageImports` list (no `next.config.mjs` change needed), ships `sideEffects: false` so named imports (`IconInfoCircle`, `IconAlertCircle`, `IconCircleCheck`) tree-shake cleanly, and has no postinstall script. WCAG AA verification (D-19) is best served by `colorjs.io` (maintained by the CSS Color spec editor), which parses OKLCH color strings directly and exposes `.contrast(other, "WCAG21")` — a small Node script or the project's first Vitest test can assert every foreground/background pairing meets 4.5:1 (text) / 3:1 (UI components) in both themes.

**Primary recommendation:** Define all color tokens with `light-dark()` inside `@theme` (or via passthrough custom properties resolved into `@theme`), set `color-scheme: light dark` on `html` as the zero-JS default, let the `/kit` page's dev-only toggle set an explicit `color-scheme` override, add `@tabler/icons-react` as the only icon dependency, harden existing components in place, and add a minimal Vitest setup whose first tests are component behavior specs plus one WCAG contrast assertion script.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Color token resolution (light/dark) | Browser / Client (CSS engine) | — | `light-dark()` + `color-scheme` resolves natively in the CSS engine at paint time; no JS or server involvement, which is what makes TOKN-04's "no flash" guarantee structural rather than best-effort |
| Theme override control (`/kit` dev toggle) | Browser / Client (React Client Component) | — | A dev-only client-side control setting `color-scheme` on `html`; explicitly out of the SSR/cookie path since it's not a product feature (D-14) |
| Font loading (Lexend/Fraunces) | Frontend Server (SSR) | Browser / Client | `next/font/google` resolves and self-hosts fonts at build time and injects `<link>`/CSS vars server-side; already wired in `layout.tsx` |
| UI kit components (Button/Input/Card/Progress/Alert) | Browser / Client | — | Interactive, stateful, client-rendered React components; no server logic involved this phase |
| Demo page (`/kit`) | Frontend Server (SSR) | Browser / Client | Next.js App Router page, server-rendered shell with client-interactive sections (theme toggle, hover/focus state display) |
| Icon rendering | Browser / Client | — | `@tabler/icons-react` renders inline SVG React components, no server dependency |
| WCAG contrast verification | Build / Test tooling | — | Runs at test-time (Vitest) or build-time, not part of the runtime request path |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.3.2 [VERIFIED: npm registry] | CSS-first utility framework, `@theme` token system | Already locked by AGENTS.md; verified current on registry, matches `@tailwindcss/postcss` |
| @tailwindcss/postcss | 4.3.2 [VERIFIED: npm registry] | PostCSS plugin for Tailwind v4 | Must stay exact-version-matched to `tailwindcss` per AGENTS.md/PITFALLS.md Pitfall 7 |
| @tabler/icons-react | 3.44.0 [VERIFIED: npm registry, confirmed via official docs at docs.tabler.io] | Icon components (TOKN-06) | Named-import tree-shakable SVG icon set; matches D-18 exactly; peer dep `react >= 16` (satisfied by React 19.2.7) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| colorjs.io | 0.6.1 [VERIFIED: npm registry, maintained by CSS Color spec editor Lea Verou] | Parses OKLCH strings, computes WCAG21 contrast ratio | D-19's automated contrast check — pass token pair strings directly, get a numeric ratio to assert against 4.5/3.0 |
| vitest | 4.1.9 [VERIFIED: npm registry] | Test runner (project's first test infrastructure per D-19) | Needed regardless of contrast-check location, since D-19 calls this "the project's first test" |
| @testing-library/react | 16.3.2 [VERIFIED: npm registry] | Component rendering/assertions for Button/Input/Card/Progress/Alert states | Standard RTL pairing with Vitest for React 19 |
| jsdom | 29.1.1 [VERIFIED: npm registry] | DOM environment for Vitest component tests | Standard Vitest environment for React component tests (no browser needed) |
| @vitejs/plugin-react | 8.1.3 [VERIFIED: npm registry] | Vite/Vitest JSX transform | Required for Vitest to process `.tsx` test/component files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `light-dark()` + `color-scheme` | Tailwind `@custom-variant dark` + duplicated `dark:` utility per component | The user already locked D-16 (`light-dark()`); the variant approach would require every component to carry `dark:` classes per property, multiplying maintenance surface exactly where the token layer is supposed to absorb it |
| colorjs.io for contrast math | Hand-rolled relative-luminance function (zero deps) | colorjs.io parses OKLCH strings directly (matches D-07's token format) and is spec-accurate; hand-rolling risks subtly wrong luminance math for OKLCH-to-sRGB conversion — not worth the dependency-avoidance for a one-time correctness-critical script |
| Vitest | Jest | Vitest is the natural fit for a Next.js/Vite-adjacent, ESM-first, TypeScript-strict project in 2026; faster, zero extra Babel config; TESTING.md already frames "Vitest or Jest" as open, this phase should lock the choice |
| @tabler/icons-react | react-icons (includes Tabler set among others) | D-18 explicitly locks the standalone package as "one dependency"; react-icons pulls in a much larger multi-set package even with per-icon imports, and mixes icon sets in one dependency tree which risks TOKN-06 violations by accident |

**Installation:**
```bash
pnpm add @tabler/icons-react colorjs.io --filter @fish/web
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react --filter @fish/web
```

**Version verification:** Verified 2026-07-02 via `npm view <pkg> version` against the public npm registry (see Package Legitimacy Audit below for provenance detail). All versions above are current as of this research date; re-check before install if planning is delayed more than a few days.

## Package Legitimacy Audit

> slopcheck could not be installed in this environment (`pip install slopcheck` failed silently — no network egress for PyPI in this sandbox, or package unavailable). Per the graceful-degradation protocol, every package below is tagged `[ASSUMED]` for legitimacy disposition even though registry existence and metadata were independently verified via `npm view`. The planner must gate each new-dependency install behind a `checkpoint:human-verify` task.

| Package | Registry | Age (approx) | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|--------------|
| `@tabler/icons-react` | npm | Multi-year, actively maintained (v3.x line) | Very high (millions/wk class, standard icon library) | github.com/tabler/tabler-icons | not run — [ASSUMED] | Approved, verify before install |
| `colorjs.io` | npm | Multi-year (v0.6.x), maintained by CSS WG spec editor | Moderate, steady | github.com/color-js/color.js | not run — [ASSUMED] | Approved, verify before install |
| `vitest` | npm | Multi-year, extremely widely adopted (Vite ecosystem's default test runner) | Very high | github.com/vitest-dev/vitest | not run — [ASSUMED] | Approved, verify before install |
| `@testing-library/react` | npm | Multi-year, industry standard | Very high | github.com/testing-library/react-testing-library | not run — [ASSUMED] | Approved, verify before install |
| `@testing-library/jest-dom` | npm | Multi-year, industry standard | Very high | github.com/testing-library/jest-dom | not run — [ASSUMED] | Approved, verify before install |
| `jsdom` | npm | Long-standing, foundational DOM-in-Node package | Very high | github.com/jsdom/jsdom | not run — [ASSUMED] | Approved, verify before install |
| `@vitejs/plugin-react` | npm | Multi-year, official Vite team package | Very high | github.com/vitejs/vite-plugin-react | not run — [ASSUMED] | Approved, verify before install |

No postinstall scripts were found on `@tabler/icons-react` (`npm view @tabler/icons-react scripts.postinstall` returned empty). All seven packages are well-established, high-download, actively-maintained libraries with public source repos and long track records — the profile of each is inconsistent with a hallucinated/slopsquatted package, but this is a heuristic read, not a slopcheck-verified one.

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck did not run)
**Packages flagged as suspicious [SUS]:** none identified by manual review, but formal slopcheck was not run — planner must add `checkpoint:human-verify` before each install regardless.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │  Browser first paint (no JS executed)    │
                     │                                           │
  OS theme signal ──▶│  html { color-scheme: light dark; }      │
  (prefers-color-    │  CSS engine resolves every                │
   scheme)            │  light-dark(lightVal, darkVal) token     │
                     │  → correct colors on FIRST paint          │
                     └───────────────┬───────────────────────────┘
                                     │
                                     ▼
                     ┌─────────────────────────────────────────┐
                     │  @theme (globals.css)                    │
                     │  --color-bg: light-dark(#fdfdfd, #1c1c1c) │
                     │  --color-surface: light-dark(...)         │
                     │  --color-primary: light-dark(...)         │
                     │  --color-notice / --color-error / ...     │
                     └───────────────┬───────────────────────────┘
                                     │  maps to Tailwind utilities
                                     ▼
       ┌─────────────────────────────────────────────────────────────┐
       │  UI Kit components (apps/web/components/ui/)                 │
       │  Button · Input · Card · Progress · Alert (new)               │
       │  consume bg-surface / text-foreground / border-notice / etc. │
       │  no component-level dark: variants, no per-component theme   │
       │  branching — theme-blind by design                            │
       └───────────────┬─────────────────────────┬─────────────────────┘
                        │                         │
                        ▼                         ▼
       ┌───────────────────────────┐   ┌───────────────────────────────┐
       │  /kit demo page (SSR)      │   │  Future screens (Phase 2/3)    │
       │  renders every component   │   │  consume the same kit + tokens │
       │  in every state, both      │   │  (out of scope this phase)     │
       │  themes, dev-only override │   └───────────────────────────────┘
       │  sets color-scheme on html │
       │  via Client Component      │
       └───────────────┬─────────────┘
                        │
                        ▼
       ┌───────────────────────────────────────┐
       │  contrast check (Vitest / script)       │
       │  colorjs.io parses each token pair,     │
       │  asserts WCAG21 AA ratio in both themes │
       │  (build-time / test-time, not runtime)  │
       └───────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/web/
├── app/
│   ├── globals.css          # @theme tokens using light-dark(); base layer; focus/motion rules
│   ├── layout.tsx            # unchanged font loading; add color-scheme to <html> if not done via CSS
│   └── kit/
│       └── page.tsx          # NEW — /kit demo route (D-12), server component shell
├── components/
│   ├── ui/
│   │   ├── button.tsx        # harden states, no rewrite
│   │   ├── input.tsx         # harden states, no rewrite
│   │   ├── card.tsx          # harden (Card + Progress), no rewrite
│   │   └── alert.tsx         # NEW — block-level Notice/Alert (D-10)
│   └── kit/
│       └── theme-toggle.tsx  # NEW — dev-only client component, sets color-scheme override (D-14)
├── lib/
│   └── utils.ts              # cn() — unchanged
├── vitest.config.ts          # NEW — Vitest + jsdom + React plugin config
├── vitest.setup.ts           # NEW — @testing-library/jest-dom matchers
└── scripts/ (or tests/)
    └── contrast.test.ts      # NEW — colorjs.io WCAG AA assertions for every token pair, both themes
```

### Pattern 1: `light-dark()` tokens inside Tailwind v4 `@theme`
**What:** Define every color token's value using the native CSS `light-dark(lightValue, darkValue)` function directly inside the `@theme` block, with `color-scheme: light dark` set once (globally, on `html` or `:root`).
**When to use:** For every semantic color token in this phase (bg, surface, surface-2, border, foreground, body, muted, primary, on-primary, notice, error, success, and any state-specific tokens like focus-ring colors).
**Example:**
```css
/* Source: MDN light-dark() + Tailwind v4 @theme docs (tailwindcss.com/docs/theme, developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) */
@import "tailwindcss";

@theme {
  --color-bg: light-dark(oklch(0.98 0 0), oklch(0.15 0 0));
  --color-surface: light-dark(oklch(1 0 0), oklch(0.19 0 0));
  --color-surface-2: light-dark(oklch(0.94 0 0), oklch(0.24 0 0));
  --color-border: light-dark(oklch(0.85 0 0), oklch(0.32 0 0));
  --color-foreground: light-dark(oklch(0.15 0 0), oklch(0.97 0 0));
  --color-body: light-dark(oklch(0.35 0 0), oklch(0.85 0 0));
  --color-muted: light-dark(oklch(0.55 0 0), oklch(0.65 0 0));
  --color-primary: light-dark(oklch(0.15 0 0), oklch(0.98 0 0));
  --color-on-primary: light-dark(oklch(0.98 0 0), oklch(0.15 0 0));
  /* notice/error/success tokens follow the same pattern — values are Claude's
     discretion per D-07, verified by the D-19 contrast script before lock-in */
}

@layer base {
  html {
    color-scheme: light dark; /* system-follow, zero-JS, resolved before first paint */
  }
}
```
This is a **direct replacement** for the entire existing `--color-*` block in `apps/web/app/globals.css` (lines 18–39) — no `dark:` utility classes are introduced anywhere; `bg-surface` etc. keep working unchanged in every component because the token itself now resolves per-scheme.

### Pattern 2: Explicit theme override (dev toggle) without breaking `light-dark()`
**What:** Force a specific theme on a subtree by setting `color-scheme` explicitly (not by adding a Tailwind `dark:`-style class) — the browser's `light-dark()` resolution respects the nearest ancestor's `color-scheme` value.
**When to use:** The `/kit` demo page's dev-only light/dark/system control (D-14). System mode = don't set an inline override (let the global `color-scheme: light dark` resolve via OS). Light/dark mode = set `color-scheme: light` / `color-scheme: dark` directly on `html` via a tiny client-side effect or a `style` attribute toggle.
**Example:**
```tsx
// Source: derived from MDN light-dark()/color-scheme override pattern (developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
"use client";
import { useState } from "react";

type ThemeOverride = "system" | "light" | "dark";

export function KitThemeToggle() {
  const [mode, setMode] = useState<ThemeOverride>("system");

  function apply(next: ThemeOverride) {
    setMode(next);
    document.documentElement.style.colorScheme =
      next === "system" ? "light dark" : next;
  }

  return (
    <div role="group" aria-label="Preview theme">
      {(["system", "light", "dark"] as const).map((opt) => (
        <button key={opt} onClick={() => apply(opt)} aria-pressed={mode === opt}>
          {opt}
        </button>
      ))}
    </div>
  );
}
```
No `localStorage`, no inline `<head>` script, no hydration-mismatch risk — this is purely a client-side style mutation on an already-mounted element, safe because it is a dev tool, not a first-paint concern (D-14 explicitly scopes this out of the FOUC-prevention requirement, which only applies to the zero-JS system-follow default).

### Pattern 3: Component hardening — status/state via structure, not hue
**What:** Every state (hover/focus/disabled/loading/error) and every notice/error/success signal is expressed through opacity, border-weight, icon presence, and the two-tone focus ring — never through a hue token.
**When to use:** Button (disabled/loading additions), Input (notice vs. error split per D-08/D-09), new Alert component.
**Example:**
```tsx
// Source: pattern derived from D-08/D-09/D-11 decisions + existing input.tsx structure
import { IconInfoCircle, IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";

type AlertTone = "notice" | "error" | "success";

const toneConfig: Record<AlertTone, { Icon: typeof IconInfoCircle; weight: number; className: string }> = {
  notice: { Icon: IconInfoCircle, weight: 1.5, className: "border-border" },
  error: { Icon: IconAlertCircle, weight: 2.5, className: "border-error font-medium" },
  success: { Icon: IconCircleCheck, weight: 1.5, className: "border-border" },
};
```
The two-tone focus ring (D-05) is a single global rule in `@layer base`, not per-component — inner light ring + outer dark ring/shadow guarantees visibility on both the inverted primary button and any surface:
```css
/* Source: derived from D-05; combines outline + box-shadow for a two-layer ring
   visible on any background including the full-contrast-inverted primary button */
@layer base {
  :focus-visible {
    outline: 2px solid light-dark(oklch(1 0 0), oklch(0.15 0 0));
    outline-offset: 2px;
    box-shadow: 0 0 0 4px light-dark(oklch(0.15 0 0), oklch(1 0 0));
    border-radius: 6px;
  }
}
```

### Anti-Patterns to Avoid
- **Mixing `light-dark()` tokens with Tailwind `dark:` utility classes:** Pick one mechanism. D-16 locks `light-dark()`; adding `dark:bg-surface-2` anywhere reintroduces the exact per-component duplication the token layer exists to eliminate, and can produce contradictory results since the two mechanisms read different signals (`color-scheme` vs. `prefers-color-scheme` media query / class presence).
- **Numbered grey ramp tokens (`--color-grey-500`):** D-04 explicitly forbids this. Components must only ever reference semantic role names.
- **Icon-only status differentiation without structural change:** D-08/D-09 require icon + border-weight + copy-weight together — an icon alone is not sufficient distinguishing signal for KIT-02.
- **`localStorage`-based FOUC-prevention script for the default theme:** Unnecessary complexity given `light-dark()` resolves natively; only the dev-only `/kit` override needs any JS at all, and it runs after mount by design (not a FOUC risk since it's a manual, already-rendered-page toggle, not the initial load path).
- **Wildcard icon imports (`import * as Icons from "@tabler/icons-react"`):** Defeats tree-shaking; use only named per-icon imports, per D-18 and the verified tree-shaking behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG contrast ratio math on OKLCH colors | A custom OKLCH→sRGB→relative-luminance→contrast-ratio pipeline | `colorjs.io` `.contrast(other, "WCAG21")` | OKLCH-to-sRGB gamut mapping and the WCAG relative luminance formula both have easy-to-get-subtly-wrong edge cases (gamma correction, out-of-gamut clipping); a spec-editor-maintained library removes this risk for a correctness-critical, first-ever test |
| Zero-flash theme switching | Inline `<head>` script + `localStorage` + `suppressHydrationWarning` (the "old" pattern documented in PITFALLS.md Pitfall 8, written before this phase's `light-dark()` decision) | `color-scheme: light dark` + `light-dark()` tokens | The old pattern exists specifically to work around the lack of a native mechanism; `light-dark()` **is** that native mechanism now and needs zero JS for the default path — the PITFALLS.md doc predates the D-16 decision and describes the workaround this phase is explicitly avoiding |
| Icon set | Hand-drawn SVGs or a mixed icon toolkit | `@tabler/icons-react` named imports only | TOKN-06 requires a single icon source; Tabler already covers info-circle/alert-circle/circle-check with consistent stroke width across ~5,800+ icons |
| Tap-target enforcement | Per-component inline min-height styles | `--size-control: 56px` token + `min-h-[var(--size-control)]` (already the pattern in `button.tsx`/`input.tsx`) | Single source of truth for KIT-04; already established, just needs to be applied to the new Alert component's interactive elements if any |

**Key insight:** This phase's dominant "don't hand-roll" risk is re-implementing FOUC prevention using pre-`light-dark()` patterns out of habit — the existing PITFALLS.md research (written before D-16 was locked) documents the *old* inline-script/localStorage workaround as the standard fix; that workaround is now unnecessary for the system-follow default and should not be built.

## Common Pitfalls

### Pitfall 1: Conflating `light-dark()`'s `color-scheme` mechanism with Tailwind's `dark:` variant
**What goes wrong:** A developer (or AI) reaches for `@custom-variant dark` out of habit (it's the first thing Tailwind's own docs show) and starts adding `dark:` utility classes alongside `light-dark()` tokens, producing either dead code or actively conflicting styles.
**Why it happens:** Every Tailwind v4 dark-mode tutorial leads with `@custom-variant`; `light-dark()` is a newer, less-documented-in-Tailwind-context pattern that requires connecting two different specs (CSS Color 5 + Tailwind's `@theme`) that aren't officially paired in Tailwind's own docs.
**How to avoid:** Do not add `@custom-variant dark` to `globals.css` at all this phase. Every dual-theme value lives inside the token's `light-dark()` call; components never carry `dark:` prefixed classes.
**Warning signs:** Any `dark:` class appearing in a component file; a `@custom-variant` directive appearing in `globals.css`.

### Pitfall 2: `light-dark()` silently no-ops without `color-scheme` set
**What goes wrong:** If `color-scheme` is never set on `html`/`:root` (or is overridden to `light` only, e.g., by a UA stylesheet reset or an accidental `color-scheme: normal`), every `light-dark()` call resolves to its first (light) argument regardless of OS preference — dark mode silently never activates, with no error or warning anywhere.
**Why it happens:** `color-scheme` is easy to omit because CSS resets (including some Tailwind preflight-adjacent patterns) sometimes strip or don't set this property, and its absence fails silently rather than throwing.
**How to avoid:** Set `color-scheme: light dark` explicitly in the base layer as the very first thing in the token-definition work, and verify it in the demo page (D-19's contrast check should run in both explicit override modes to catch this — if light and dark evaluate to identical token values, the override isn't being respected).
**Warning signs:** Toggling OS dark mode does nothing; the `/kit` page's light/dark buttons appear to have no visual effect.

### Pitfall 3: Contrast check written against nominal token values instead of actual rendered CSS
**What goes wrong:** The D-19 script hardcodes the light/dark OKLCH pairs as JS constants that live alongside (but separately from) `globals.css`. When someone tweaks a value in `globals.css` during demo-page review (explicitly expected per D-07 — "the demo page is where values are judged and adjusted"), the test file is not updated, and the check silently verifies stale values while the real UI has drifted — a false sense of safety.
**Why it happens:** It's easier to write `new Color("oklch(0.98 0 0)")` directly in the test file than to parse `@theme` out of CSS at test time.
**How to avoid:** Either (a) keep the test's token constants and `globals.css` values in the same file/single source via a shared TS/JSON module that both the CSS build and the test import from (heavier, and edges toward THEM-02's scope, which is explicitly v2 — likely too much for this phase), or (b) accept the duplication but add a comment/lint-adjacent convention making the pairing obvious, and treat "update the contrast test" as a required step whenever `globals.css` color values change — call this out explicitly in the plan's task for token value changes.
**Warning signs:** A `globals.css` diff touching `--color-*` values with no corresponding diff in the contrast test file in the same commit.

### Pitfall 4: Two-tone focus ring (D-05) invisible on the primary button in one theme
**What goes wrong:** The primary button is described as "full-contrast inversion" (D-03) — near-black fill in light theme, white fill in dark theme. A naive single-color focus ring (e.g., always dark) disappears against a dark-fill primary button in dark theme, or against a near-black fill in light theme, exactly on the one control most likely to receive keyboard focus first (the primary CTA).
**Why it happens:** Focus rings are usually designed against a "typical" surface and not explicitly checked against the highest-contrast/inverted element on the page.
**How to avoid:** The two-tone ring (inner light + outer dark, per D-05) must be tested against all four fill combinations: light-theme primary (near-black fill), dark-theme primary (white fill), light-theme default surface, dark-theme default surface. The demo page's "how the demo page statically displays interactive states" (Claude's discretion item) should include a keyboard-focus screenshot/state specifically on the primary button in both themes.
**Warning signs:** Tabbing to the primary button and the focus ring "disappears" or blends into the button fill in one theme but not the other.

### Pitfall 5: New Alert component skipped from KIT-06's "every component in every state" contract
**What goes wrong:** Because Alert is new (not an existing component being hardened), it's easy to build it correctly but forget to add its notice/error/success variants to the `/kit` demo page systematically, leaving KIT-06's "every state" success criterion only partially met.
**Why it happens:** The existing three components (Button, Input, Card/Progress) already have a demo section in `page.tsx` to extend; Alert requires a net-new section, which is more likely to be under-scoped ("I'll add one example") rather than exhaustively enumerated (all three tones).
**How to avoid:** Treat Alert exactly like the other KIT-01 components in the plan — explicitly list all three tones (notice/error/success) as required demo-page states, not just "an example."
**Warning signs:** `/kit` page shows only one Alert variant instead of all three tones.

## Code Examples

### Verifying WCAG AA contrast for a token pair (D-19)
```typescript
// Source: colorjs.io API docs (colorjs.io/docs/contrast) — pattern for OKLCH string input
import Color from "colorjs.io";

function assertAA(fgOklch: string, bgOklch: string, minRatio = 4.5) {
  const fg = new Color(fgOklch);
  const bg = new Color(bgOklch);
  const ratio = Math.abs(fg.contrast(bg, "WCAG21"));
  if (ratio < minRatio) {
    throw new Error(
      `Contrast ${ratio.toFixed(2)} below AA minimum ${minRatio} for ${fgOklch} on ${bgOklch}`
    );
  }
}

// Example pairing to check in both light and dark resolved values:
// assertAA(foregroundLight, bgLight, 4.5);
// assertAA(foregroundDark, bgDark, 4.5);
```

### Tabler icon usage matching D-08/D-09/D-11
```tsx
// Source: docs.tabler.io/icons/libraries/react — named import + size/stroke props
import { IconInfoCircle, IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";

<IconInfoCircle size={20} stroke={1.75} aria-hidden="true" />
<IconAlertCircle size={20} stroke={2} aria-hidden="true" />
<IconCircleCheck size={20} stroke={1.75} aria-hidden="true" />
```
Note: icons used purely as visual reinforcement alongside text (per D-08's "icon beside the message") should carry `aria-hidden="true"` since the adjacent copy already conveys the meaning — avoids redundant screen-reader announcements.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Inline `<head>` script + `localStorage` + `suppressHydrationWarning` for zero-flash theming (documented as the standard fix in this project's own PITFALLS.md, written before D-16) | Native `light-dark()` CSS function + `color-scheme` property | `light-dark()` reached Baseline 2024 (Chrome/Edge 123+ Mar 2024, Firefox 120+ Nov 2023, Safari 17.5+ May 2024) | Zero-flash theming no longer requires any JavaScript for the system-follow default; PITFALLS.md Pitfall 8's mitigation section describes the now-superseded approach — still correct as a fallback pattern for browsers below Baseline 2024, but not needed for this phase given the target browser support the project is implicitly building for in 2026 |
| Tailwind `darkMode` config option (`tailwind.config.js`) | `@custom-variant dark (...)` directive in CSS, or (this phase's choice) bypassing the variant system entirely via `light-dark()` in `@theme` | Tailwind v4 (2025) removed `tailwind.config.js`-based config entirely | AGENTS.md already locks CSS-first config; this phase goes one step further by not using the `dark:` variant mechanism at all |

**Deprecated/outdated:**
- `tailwind.config.js`-based `darkMode: 'class'` config: does not exist in Tailwind v4; already barred by AGENTS.md.
- Manual inline FOUC-prevention scripts (still valid technique, but unnecessary here given `light-dark()` covers the system-follow default; only the dev override needs any script at all, and it isn't a first-paint concern).

## Runtime State Inventory

Not applicable — this phase is a modification of existing greenfield code (`globals.css`, three existing components) with no prior deployed users, no external service configuration, no OS-registered state, and no secrets/env vars involved. Explicitly confirmed by reading `apps/web/app/globals.css`, `apps/web/package.json`, and the project's git history (5 commits, all `docs:` — no prior implementation to migrate away from).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `@tabler/icons-react`, `colorjs.io`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react` are legitimate (not slopsquatted) packages | Package Legitimacy Audit | slopcheck could not run in this environment; all seven are long-established, high-download packages with verifiable public GitHub repos, but formal automated verification did not occur — planner should gate installs behind human verification |
| A2 | `light-dark()` + `color-scheme` is sufficient with no fallback for browsers below Baseline 2024 | Summary, Pattern 1 | If the product needs to support older browsers (e.g. Safari <17.5, ~2024-era), ~15% of users could see unstyled/single-scheme colors; no evidence in CONTEXT.md or REQUIREMENTS.md of an older-browser support requirement, so this is treated as acceptable for a 2026 greenfield build, but wasn't explicitly confirmed by the user |
| A3 | Exact oklch lightness/chroma values in Pattern 1's code example are illustrative only, not final | Pattern 1 | D-07 explicitly assigns final value selection to planning/demo-page review — these numbers are starting points, not locked; if treated as final without visual + contrast verification, WCAG AA could fail for some pairing |
| A4 | Next.js auto-optimizes `@tabler/icons-react` imports via its built-in `optimizePackageImports` default list, requiring no `next.config.mjs` change | Standard Stack, Anti-Patterns | If Next.js's default list changes or doesn't apply to this exact package/version combination, tree-shaking could be less effective than assumed — low risk (bundle size, not correctness), verifiable by inspecting the production build output |

## Open Questions

1. **Exact oklch values for every token in both themes**
   - What we know: D-01/D-02/D-07 constrain the shape (pure neutral, near-extremes ~0.15/~0.98 lightness, WCAG AA required) and delegate exact values to planning + demo-page visual review.
   - What's unclear: The precise lightness steps for `surface`, `surface-2`, `border`, `muted`, `body` in both themes that satisfy AA for every foreground/background pairing simultaneously (a chain of ~8-10 tokens per theme all needing to pass pairwise checks).
   - Recommendation: The planner should generate an initial oklch value set as a first-draft task, then rely on the D-19 contrast script + visual demo-page review as the acceptance gate — do not treat any single value as final until the script passes for all pairings in both themes.

2. **Where exactly the contrast check "runs" (Claude's discretion per D-19)**
   - What we know: D-19 wants "a small automated check" — a script or test.
   — What's unclear: Whether it should be a Vitest test (`pnpm test`, part of the general suite) or a standalone Node script (`pnpm check:contrast`) run manually/in CI.
   - Recommendation: Make it a Vitest test since Vitest is already being installed as the project's first test runner (needed anyway for component behavior specs) — one test file, one runner, one command (`pnpm test`), simplest footprint per D-19's "keep its footprint small."

3. **Whether `layout.tsx`'s `<html>` needs any change beyond CSS**
   - What we know: `color-scheme: light dark` can be set entirely in `globals.css`'s `@layer base { html { ... } }` block with no JSX/TSX change required.
   - What's unclear: Whether Next.js's font-variable className injection on `<html>` (`className={`${lexend.variable} ${fraunces.variable}`}`) has any interaction with a CSS-only `color-scheme` rule — expected to be none, but not explicitly tested in this research pass.
   - Recommendation: Default to the CSS-only approach (Pattern 1); if any interaction surfaces during implementation, it would show up immediately as "dark mode doesn't activate," which the D-19 contrast check plus manual OS-toggle testing (per PITFALLS.md's existing "hard refresh in both OS-light and OS-dark" verification step) will catch.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / pnpm | All build/dev/test commands | ✓ (pnpm 11.7.0 pinned in package.json) | pnpm 11.7.0 | — |
| npm registry access | Installing new packages (`@tabler/icons-react`, `colorjs.io`, `vitest`, etc.) | ✓ (verified via `npm view` during this research session) | — | — |
| PyPI / pip | slopcheck installation | ✗ (install attempt failed silently in this sandbox) | — | Manual/human package verification via `checkpoint:human-verify` tasks (already the fallback per the Package Legitimacy Audit) |
| Browser with `light-dark()` support | Runtime theme resolution (dev/QA verification) | Assumed ✓ on any 2024+ browser (Chrome/Edge 123+, Firefox 120+, Safari 17.5+) | — | None needed — Baseline 2024 feature, no graceful-degradation requirement surfaced in CONTEXT.md |

**Missing dependencies with no fallback:**
- None blocking. slopcheck's absence is mitigated by the existing `checkpoint:human-verify` gating mechanism already built into this protocol.

**Missing dependencies with fallback:**
- slopcheck (PyPI) — falls back to human verification of each new package before install, which the planner should already schedule given the `[ASSUMED]` tagging above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (to be installed — none exists yet) |
| Config file | `apps/web/vitest.config.ts` (to be created) |
| Quick run command | `pnpm --filter @fish/web test -- --run <file>` (single file, no watch) |
| Full suite command | `pnpm --filter @fish/web test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| TOKN-01 | No hue-based color values in resolved tokens | unit (contrast/token script asserting chroma ≈ 0 for every color token) | `pnpm --filter @fish/web test -- --run contrast.test.ts` | ❌ Wave 0 |
| TOKN-02 | Tokens are role-named, not hue-named | manual/code-review (grep-based check, not runtime-testable) | n/a — verify via `grep -E "emphasis-(pink|yellow)|grey-[0-9]" apps/web/app/globals.css` returns nothing | ❌ Wave 0 (grep script optional) |
| TOKN-03 | Every token resolves correctly in both themes | unit (contrast test asserting both light and dark values differ and both pass AA) | `pnpm --filter @fish/web test -- --run contrast.test.ts` | ❌ Wave 0 |
| TOKN-04 | No flash of wrong theme on first paint | manual (structural guarantee from `light-dark()`, not unit-testable in jsdom) | Manual: hard-refresh in OS-dark and OS-light, confirm no flash + no console hydration warning | ❌ Wave 0 (manual verification step in plan) |
| TOKN-05 | Lexend body / Fraunces headings on every screen | unit (render `/kit` page or a component, assert computed `font-family` var) | `pnpm --filter @fish/web test -- --run fonts.test.ts` | ❌ Wave 0 |
| TOKN-06 | Only Tabler icons imported | manual/code-review (grep-based check) | `grep -rE "from \"(react-icons|@heroicons|lucide-react)\"" apps/web` returns nothing | ❌ Wave 0 (grep script optional) |
| KIT-01 | Button/Input/Card/Progress render correct states in both themes | unit + manual (RTL for state props; visual for both themes) | `pnpm --filter @fish/web test -- --run button.test.tsx input.test.tsx card.test.tsx` | ❌ Wave 0 |
| KIT-02 | Notices/errors distinguishable via weight/structure/icon, never hue | unit (assert Alert/Input renders correct icon + border class per tone) | `pnpm --filter @fish/web test -- --run alert.test.tsx input.test.tsx` | ❌ Wave 0 |
| KIT-03 | New components are needs-driven (Alert only, this phase) | manual/code-review | n/a — plan-review check, not a runtime test | — |
| KIT-04 | Every interactive control ≥ 56px tall | unit (assert computed/class-based min-height on Button/Input/interactive Alert elements) | `pnpm --filter @fish/web test -- --run button.test.tsx input.test.tsx` | ❌ Wave 0 |
| KIT-05 | Visible keyboard focus + reduced-motion respected | unit (assert `:focus-visible` rule presence is structural/CSS, not component-testable) + manual | Manual: tab through `/kit`, confirm visible ring in both themes; automated: assert `prefers-reduced-motion` media query exists in built CSS | ❌ Wave 0 (manual step) |
| KIT-06 | `/kit` demo page shows every component/state/theme | manual (visual review is the actual acceptance mechanism per D-13) | Manual: full-page visual review checklist against component/state/theme matrix | — |

### Sampling Rate
- **Per task commit:** `pnpm --filter @fish/web test -- --run <changed-file>.test.ts(x)` — fast, scoped to the component/token file just touched
- **Per wave merge:** `pnpm --filter @fish/web test -- --run` (full Vitest suite) + `pnpm build` (per AGENTS.md's pre-commit requirement) + `pnpm typecheck`
- **Phase gate:** Full suite green + manual verification checklist (OS light/dark hard-refresh, keyboard tab-through in both themes, `/kit` full visual scroll) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/vitest.config.ts` — Vitest config with jsdom environment + React plugin (no framework exists yet)
- [ ] `apps/web/vitest.setup.ts` — imports `@testing-library/jest-dom` matchers
- [ ] `apps/web/package.json` — add `"test": "vitest"` script
- [ ] `apps/web/components/ui/button.test.tsx`, `input.test.tsx`, `card.test.tsx`, `alert.test.tsx` — component state/prop specs
- [ ] `apps/web/[tests-or-scripts]/contrast.test.ts` (exact location is Claude's discretion per D-19) — colorjs.io-based WCAG AA assertions for every token pair, both themes
- [ ] Framework install: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react --filter @fish/web`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|--------------------|
| V2 Authentication | No | Phase has no auth surface (Phase 2 scope) |
| V3 Session Management | No | No sessions this phase |
| V4 Access Control | No | No protected routes; `/kit` is intentionally public/unlinked (D-15) |
| V5 Input Validation | Marginal | Component props are TypeScript-typed (compile-time validation); no user-submitted data is processed or persisted this phase — Input component renders but does not submit anywhere |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Supply-chain risk from new npm dependencies (Tabler, colorjs.io, Vitest toolchain) | Tampering | Package Legitimacy Audit above; `checkpoint:human-verify` before each install since slopcheck was unavailable this session |
| XSS via icon/SVG injection | Tampering/Elevation of Privilege | Not a risk here — `@tabler/icons-react` renders icons as compiled React components with fixed, library-controlled SVG paths, not user-supplied SVG strings; no `dangerouslySetInnerHTML` usage anticipated |
| Information disclosure via `/kit` demo page in production | Information Disclosure | D-15 explicitly accepts this (ships unlinked, no env gating) as a deliberate product decision — no component states, tokens, or copy on `/kit` reveal sensitive information (pure design-system contract, no real user data) |

This phase's security surface is minimal by design — no network calls, no auth, no data persistence, no user input processing beyond typed component props. The only realistic residual risk is supply-chain (new dependencies), addressed above.

## Sources

### Primary (HIGH confidence)
- [Dark mode — Core concepts — Tailwind CSS](https://tailwindcss.com/docs/dark-mode) — official docs, verified via WebFetch: `@custom-variant`, default `prefers-color-scheme` behavior, class/data-attribute override patterns
- [light-dark() CSS function — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) — official MDN reference, verified via WebFetch: syntax, `color-scheme` requirement, Baseline 2024 status
- [color-scheme CSS property — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme) — official MDN reference (cross-referenced via WebSearch), override mechanics
- [caniuse.com — light-dark() browser support](https://caniuse.com/mdn-css_types_color_light-dark) — verified via WebFetch: 84.64% global support, exact version thresholds (Chrome 123+, Safari 17.5+, Firefox 120+, Edge 123+)
- [Tabler Icons React documentation](https://docs.tabler.io/icons/libraries/react) — official docs, verified via WebFetch: install command, PascalCase naming convention, props table (`size`, `color`, `stroke`), tree-shaking confirmation
- npm registry `npm view` — direct verification of exact current versions: `tailwindcss@4.3.2`, `@tailwindcss/postcss@4.3.2`, `@tabler/icons-react@3.44.0`, `next@16.2.10`, `colorjs.io@0.6.1`, `vitest@4.1.9`, `jsdom@29.1.1`, `@testing-library/react@16.3.2`, `@vitejs/plugin-react@8.1.3`
- Direct repository inspection: `apps/web/app/globals.css`, `apps/web/components/ui/{button,input,card}.tsx`, `apps/web/app/{layout,page}.tsx`, `apps/web/lib/utils.ts`, `apps/web/package.json`, `package.json` — primary source for existing code state
- `.planning/phases/01-monochrome-design-system-you-can-see/01-CONTEXT.md` — locked decisions D-01 through D-19
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `AGENTS.md`, `.claude/CLAUDE.md` — project constraints and prior research carried forward

### Secondary (MEDIUM confidence)
- [Color.js Contrast docs](https://colorjs.io/docs/contrast) — WebSearch-sourced summary of `.contrast(other, "WCAG21")` API, cross-verified against npm registry package metadata and repo ownership (Lea Verou / color-js org)
- [GitHub Discussion #15083 — tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss/discussions/15083) — community discussion on `light-dark()` + `@theme` pattern, WebFetch-summarized; confirms the general approach but does not show a fully worked override example (the override pattern in this document was derived independently from MDN's `color-scheme` docs)
- [Next.js optimizePackageImports docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports) — WebSearch-sourced confirmation that `@tabler/icons-react` is in Next.js's default auto-optimized package list

### Tertiary (LOW confidence)
- None — all findings in this document were cross-verified against at least one official/authoritative source before inclusion.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version independently verified via `npm view` against the live npm registry; core mechanism (`light-dark()`) verified via MDN + caniuse with exact browser version thresholds
- Architecture: HIGH — the `light-dark()` + `color-scheme` pattern is a direct, verifiable reading of CSS spec behavior (not framework-specific guesswork); cross-referenced against both MDN and a live Tailwind community discussion
- Pitfalls: HIGH for the CSS mechanism pitfalls (directly derived from spec behavior); MEDIUM for the exact-oklch-values open question, which is explicitly deferred to planning/demo-review by the user's own D-07 decision, not a research gap

**Research date:** 2026-07-02
**Valid until:** 2026-08-01 (30 days — stable web platform APIs and pinned dependency versions; re-verify npm versions if planning is delayed)
