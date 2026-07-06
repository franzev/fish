# Phase 1: Monochrome design system you can see - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 12 (3 modified existing, 9 new)
**Analogs found:** 12 / 12 (all resolve to in-repo analogs; codebase is greenfield with only 7 source files, so several new files share one analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `apps/web/app/globals.css` | config (design tokens) | transform (CSS custom-property resolution) | itself (existing file, modified in place) | exact — hardening, not replacement of structure |
| `apps/web/components/ui/button.tsx` | component | request-response (event handlers: click/hover/focus/disabled) | itself (existing file, modified in place) | exact |
| `apps/web/components/ui/input.tsx` | component | request-response (controlled form field) | itself (existing file, modified in place) | exact |
| `apps/web/components/ui/card.tsx` | component | transform (props → static/data-driven markup) | itself (existing file, modified in place) | exact |
| `apps/web/components/ui/alert.tsx` | component | transform (tone prop → icon/copy/border) | `apps/web/components/ui/input.tsx` (notice/error prop pattern) | role-match — new component, same tone/prop shape as `Input`'s `hint`/`notice` split |
| `apps/web/components/kit/theme-toggle.tsx` | component (dev-only, client) | event-driven (button clicks mutate `document.documentElement.style.colorScheme`) | `apps/web/components/ui/button.tsx` (button element + variant pattern) | partial — first client-interactive (`"use client"`) component in the repo; no direct analog for client-side state, closest structural analog is Button's props/className shape |
| `apps/web/app/kit/page.tsx` | route (Next.js App Router page) | request-response (SSR page render) | `apps/web/app/page.tsx` (existing showcase page) | exact — this file is explicitly superseded/extended by `/kit` |
| `apps/web/app/layout.tsx` | config (root layout) | request-response (SSR shell) | itself (existing file, verify-only — no functional change expected) | exact |
| `apps/web/vitest.config.ts` | config (test runner) | n/a (build/test tooling) | none in-repo — first test config | no analog — see "No Analog Found" |
| `apps/web/vitest.setup.ts` | config (test runner) | n/a (build/test tooling) | none in-repo — first test setup | no analog — see "No Analog Found" |
| `apps/web/components/ui/*.test.tsx` (button/input/card/alert) | test | request-response (render + assert) | none in-repo — first component tests | no analog — see "No Analog Found" |
| `apps/web/[tests-or-scripts]/contrast.test.ts` | test / utility | transform (token pair → WCAG ratio assertion) | none in-repo — first token/contrast test | no analog — see "No Analog Found" |

## Pattern Assignments

### `apps/web/app/globals.css` (config, transform)

**Analog:** itself — existing `@theme` block structure is preserved; only token *values* and the theme-resolution mechanism change.

**Current token block being replaced wholesale** (lines 17–52):
```css
@theme {
  /* ---- Brand palette — shallow-water light mode, aquatic blue action ---- */
  --color-bg: oklch(0.976 0.011 220);
  --color-surface: oklch(0.992 0.005 220);
  --color-surface-2: oklch(0.948 0.019 218);
  --color-border: oklch(0.900 0.022 220);

  --color-primary: oklch(0.550 0.105 233);
  --color-primary-press: oklch(0.475 0.094 235);
  --color-on-primary: oklch(0.985 0.008 225);

  --color-old-hue-token-a: oklch(0.770 0.085 25);
  --color-old-hue-token-b: oklch(0.760 0.105 75);

  --color-foreground: oklch(0.320 0.050 235);
  --color-body: oklch(0.445 0.038 233);
  --color-muted: oklch(0.625 0.028 230);

  --color-success: oklch(0.610 0.095 178);
  --color-notice: oklch(0.620 0.090 70);

  --font-sans: var(--font-lexend), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-fraunces), ui-serif, Georgia, serif;

  --radius-card: 16px;
  --radius-control: 12px;
  --radius-pill: 999px;

  --size-control: 56px;
}
```

**Base layer to preserve verbatim (accessibility floor)** (lines 54–87), only the focus-ring rule body changes to two-tone per D-05:
```css
@layer base {
  html {
    -webkit-text-size-adjust: 100%;
  }
  body {
    background-color: var(--color-bg);
    color: var(--color-body);
    font-family: var(--font-sans);
    font-size: 17px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 {
    color: var(--color-foreground);
    font-family: var(--font-serif);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }
  :focus-visible {
    outline: 3px solid var(--color-primary);   /* -> becomes two-tone per D-05 */
    outline-offset: 2px;
    border-radius: 6px;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      transition-duration: 0.001ms !important;
    }
  }
}
```

**Replacement pattern (from RESEARCH.md Pattern 1, cross-checked against UI-SPEC.md's full token ladder):**
```css
@theme {
  --color-bg: light-dark(oklch(0.98 0 0), oklch(0.15 0 0));
  --color-surface: light-dark(oklch(1 0 0), oklch(0.20 0 0));
  --color-surface-2: light-dark(oklch(0.94 0 0), oklch(0.26 0 0));
  --color-border: light-dark(oklch(0.85 0 0), oklch(0.34 0 0));
  --color-border-strong: light-dark(oklch(0.75 0 0), oklch(0.44 0 0));
  --color-foreground: light-dark(oklch(0.15 0 0), oklch(0.97 0 0));
  --color-body: light-dark(oklch(0.32 0 0), oklch(0.88 0 0));
  --color-muted: light-dark(oklch(0.50 0 0), oklch(0.68 0 0));
  --color-primary: light-dark(oklch(0.15 0 0), oklch(0.98 0 0));
  --color-on-primary: light-dark(oklch(0.98 0 0), oklch(0.15 0 0));
  --color-notice: light-dark(oklch(0.40 0 0), oklch(0.80 0 0));
  --color-error: light-dark(oklch(0.20 0 0), oklch(0.95 0 0));
  --color-success: light-dark(oklch(0.40 0 0), oklch(0.80 0 0));
  /* focus-ring tokens, --shadow-card, etc. — see UI-SPEC.md Color table for the full ladder */
}
@layer base {
  html {
    color-scheme: light dark; /* MUST be set — Pitfall 2: silent no-op otherwise */
  }
}
```

**Naming convention to preserve:** every token stays `--color-<role>` (or `--radius-*`, `--size-*`, `--font-*`), semantic-role-named only — no numbered ramp (D-04), no hue names (`old-hue-token-a`/`old-hue-token-b`/`success`-as-green are removed, not renamed).

---

### `apps/web/components/ui/button.tsx` (component, request-response)

**Analog:** itself — hardened in place, not rewritten.

**Full current file** (this is the exact structural pattern every other kit component and the new `Alert` must follow):
```typescript
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Full-width is the default — most ND screens have one big action. */
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  // The ONE action on a screen. Use at most one primary per view.
  primary:
    "bg-primary text-on-primary hover:bg-primary-press active:bg-primary-press font-semibold",
  // A quieter alternative action when genuinely needed.
  secondary:
    "bg-surface text-foreground border border-border hover:bg-surface-2",
  // Low-emphasis text actions ("Back", "Need help?").
  ghost:
    "bg-transparent text-muted hover:text-body",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", fullWidth = true, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-control px-6",
          "min-h-[var(--size-control)] text-[17px] transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none",
          fullWidth && "w-full",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

**Extension points for this phase (KIT-01 loading state, hardened disabled, two-tone focus):**
- `variants` map keys stay a `Record<Variant, string>` discriminated union — do not switch to a switch-statement or object-spread pattern.
- Loading state (new, per UI-SPEC.md Component Inventory) should follow the same `cn(...)` conditional-class-append pattern already used for `fullWidth && "w-full"` — e.g. `loading && "opacity-70 pointer-events-none"` plus a spinner element gated by `prefers-reduced-motion` (respect the existing global suppression in `globals.css`, don't re-implement it per-component).
- `--color-primary-press` token is renamed/restructured in the token replacement (see globals.css section above) — `hover:bg-primary-press` class reference must track whatever token name the plan settles on.

---

### `apps/web/components/ui/input.tsx` (component, request-response)

**Analog:** itself — hardened in place; also the direct analog for `Alert`'s tone-prop shape.

**Full current file:**
```typescript
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Plain-language label, always shown above the field. */
  label: string;
  /** Optional guidance. Calm and helpful, never scolding. */
  hint?: string;
  /** Shown in soft yellow (a notice), not alarming red. */
  notice?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, notice, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="mb-2 block text-[15px] font-medium text-foreground"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-control bg-surface px-4",
            "min-h-[var(--size-control)] text-[17px] text-foreground",
            "border border-border placeholder:text-muted",
            "transition-colors focus:border-primary",
            notice && "border-notice",
            className
          )}
          {...props}
        />
        {hint && !notice && (
          <p className="mt-2 text-[14px] text-muted">{hint}</p>
        )}
        {notice && (
          <p className="mt-2 text-[14px] text-notice">{notice}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
```

**Pattern to extend for the new notice/error two-tier split (D-08/D-09) and disabled state (KIT-01):**
- Keep `useId()` + `id ?? autoId` pattern for any new focusable sub-elements.
- The `notice && "border-notice"` conditional-class-on-prop-presence idiom is the exact template for adding an `error` prop: `error && "border-error border-2 font-semibold"` (heavier border + weight per D-09), mutually exclusive with `notice` the same way `hint && !notice` already guards against showing both.
- Icon insertion (new, per D-08 "icon beside the message") should sit inside the `{notice && (...)}` / new `{error && (...)}` blocks, matching the existing `<p className="mt-2 text-[14px] ...">` wrapper — put the Tabler icon and text in a flex row inside that same `<p>`/wrapping element rather than restructuring the layout.

---

### `apps/web/components/ui/card.tsx` (component, transform)

**Analog:** itself — hardened in place (also contains `Progress`, same file, per existing convention of co-locating related exports).

**Full current file:**
```typescript
import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

/** A calm container. The basic surface everything sits on. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface p-6 border border-border",
        className
      )}
      {...props}
    />
  );
}

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. Progress is visual, never a grade. */
  value: number;
  label?: string;
}

/** Visual progress: a primary-token fill on a dark track. No numbers shouted at the user. */
export function Progress({ value, label, className, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)} {...props}>
      {label && (
        <p className="mb-2 text-[14px] text-muted">{label}</p>
      )}
      <div
        className="h-3 w-full overflow-hidden rounded-pill bg-surface-2"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-pill bg-primary transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
```

**Notes for hardening:**
- `Card` uses a plain `function` export (not `forwardRef`) because it is not natively focusable — this is intentional per the codebase convention ("forwardRef for any focusable control" per AGENTS.md); do not add `forwardRef` to `Card`/`Progress` unless a focusable interactive element is added inside them.
- Elevation (D-06) — light-theme shadow / dark-theme surface-step — is a token-level change (`--shadow-card` in `globals.css`) applied via a new conditional class here, e.g. `"shadow-card dark:shadow-none"` is WRONG (no `dark:` variant per D-16/Pitfall 1) — instead reference a `shadow-[var(--shadow-card)]` utility or a semantic `shadow-card` token that itself resolves to `none` in dark via `light-dark()`, keeping the component free of theme branching.
- `role="progressbar"` + `aria-valuenow/min/max` triad is the existing ARIA pattern; preserve exactly for any new stateful/numeric component.
- The doc-comment style (`/** One-line, explains WHY/product-rule context */` directly above the export) is the convention to match on `Alert`.

---

### `apps/web/components/ui/alert.tsx` (component, transform) — NEW

**Analog:** `apps/web/components/ui/input.tsx` (notice/tone-prop shape) + `apps/web/components/ui/card.tsx` (non-focusable container export style) + RESEARCH.md Pattern 3 (tone config object).

**Imports pattern to follow** (matches `input.tsx`/`button.tsx` import block conventions, plus the new Tabler dependency):
```typescript
import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import { IconInfoCircle, IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
```

**Core tone-config pattern** (RESEARCH.md Pattern 3, cross-checked against UI-SPEC.md icon sizing):
```typescript
type AlertTone = "notice" | "error" | "success";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone: AlertTone;
  /** Calm, plain-verb copy. Never "Error:", never exclamation points. */
  children: React.ReactNode;
}

const toneConfig: Record<AlertTone, { Icon: typeof IconInfoCircle; className: string; messageClassName: string }> = {
  notice: {
    Icon: IconInfoCircle,
    className: "border-border-strong",
    messageClassName: "font-normal",
  },
  error: {
    Icon: IconAlertCircle,
    className: "border-error border-2",
    messageClassName: "font-semibold",
  },
  success: {
    Icon: IconCircleCheck,
    className: "border-border-strong",
    messageClassName: "font-normal",
  },
};

export function Alert({ tone, children, className, ...props }: AlertProps) {
  const { Icon, className: toneClassName, messageClassName } = toneConfig[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-control border bg-surface p-4",
        toneClassName,
        className
      )}
      {...props}
    >
      <Icon size={20} stroke={tone === "error" ? 2 : 1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p className={cn("text-[15px] text-body", messageClassName)}>{children}</p>
    </div>
  );
}
```

**Rules this must satisfy (from CONTEXT.md/UI-SPEC.md, not discretionary):**
- Named export `Alert`, matching every other kit component (`Card`, `Progress`, `Button`, `Input`) — never a default export.
- No `forwardRef` needed unless a dismiss control (focusable) is added — matches `Card`'s non-focusable-container precedent above.
- Icon `size={20}`, `stroke={1.75}` (notice/success) or `stroke={2}` (error), `aria-hidden="true"` — exact values from UI-SPEC.md Component Inventory, do not invent different sizing.
- Distinguishing signal must be structural (border weight + font weight + icon shape), never hue — `toneConfig`'s `className`/`messageClassName` fields are the enforcement point; do not add a `text-red-500`-style hue override.

---

### `apps/web/components/kit/theme-toggle.tsx` (component, event-driven) — NEW

**Analog:** `apps/web/components/ui/button.tsx` (closest structural analog for a clickable control with variant-like state) — no existing client-interactive component exists in the repo, so this is the first `"use client"` file.

**Pattern from RESEARCH.md (verified against repo's total absence of client components — first of its kind):**
```typescript
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

**Conventions to reconcile with the rest of the kit:**
- File location `apps/web/components/kit/theme-toggle.tsx` — a new subdirectory (`components/kit/`), separate from `components/ui/`, signaling "dev tool, not product kit" per UI-SPEC.md's explicit note that this is "not part of the product-facing kit."
- Filename stays lowercase-with-hyphens (`theme-toggle.tsx`), matching existing `button.tsx`/`input.tsx` naming.
- Export is named (`KitThemeToggle`), PascalCase, matching the codebase's component-naming convention despite the `Kit` prefix disambiguating it from product components.
- The raw `<button>` elements here are dev-tool chrome, not product UI — reasonable to NOT route through the `Button` component (avoids pulling `fullWidth`/variant semantics into a 3-way segmented control), but should still respect the 56px tap-target token where practical, and must get a visible focus ring for free from the global `:focus-visible` rule (no opt-out needed).

---

### `apps/web/app/kit/page.tsx` (route, request-response) — NEW

**Analog:** `apps/web/app/page.tsx` (existing showcase page — this file's structure is the direct template; `/kit` supersedes it as the design-system contract).

**Full current analog file (import block + section structure to replicate):**
```typescript
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Progress } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const swatches = [
  { name: "bg", className: "bg-bg" },
  { name: "surface", className: "bg-surface" },
  { name: "primary", className: "bg-primary" },
  { name: "old-hue-token-a", className: "bg-old-hue-token-a" },   // -> REMOVE, hue token gone
  { name: "old-hue-token-b", className: "bg-old-hue-token-b" }, // -> REMOVE, hue token gone
  { name: "body", className: "bg-body" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-[440px] px-5 py-12">
      <header className="mb-10"> ... </header>
      <section className="mb-10">
        <h2 className="mb-4 text-xl">Color</h2>
        <div className="grid grid-cols-3 gap-3">
          {swatches.map((s) => ( ... ))}
        </div>
      </section>
      <section className="mb-10">
        <h2 className="mb-4 text-xl">Buttons</h2>
        <div className="space-y-3">
          <Button>Get started</Button>
          <Button variant="secondary">I already have an account</Button>
          <Button variant="ghost" fullWidth={false}>Need help?</Button>
        </div>
      </section>
      {/* Inputs, Card & progress sections follow the same section-wrapper pattern */}
    </main>
  );
}
```

**Structural pattern to carry into `/kit`:**
- `<main className="mx-auto max-w-[...] px-5 py-12">` outer wrapper, `<section className="mb-10">` + `<h2 className="mb-4 text-xl">{Section name}</h2>` per section — this is the exact repeatable unit for each of the sections UI-SPEC.md requires: tokens, typography, icons, Button, Input, Card+Progress, Alert.
- Data-driven arrays (`swatches.map(...)`) for repetitive swatch/variant rendering — reuse this idiom for the expanded token table (now includes `border-strong`, `error`, focus-ring tokens) and for icon samples (map over the 3 Tabler icons).
- `KitThemeToggle` (new) mounts once near the top of this page, not per-section — it is a page-level control, matching D-13's "no navigation choices" single-scroll contract.
- This file becomes a Server Component page (like `page.tsx` today) with `KitThemeToggle` as the one `"use client"` island — do not mark the whole page `"use client"`.
- Since `apps/web/app` has no existing subdirectories, `apps/web/app/kit/page.tsx` is the first nested route — Next.js App Router convention (`app/<segment>/page.tsx`) applies directly, no additional layout/loading files needed unless the plan calls for them.

---

### `apps/web/app/layout.tsx` (config, request-response)

**Analog:** itself — verify-only, likely unchanged.

**Full current file** (font loading already satisfies TOKN-05 — no change expected unless `color-scheme` needs a JSX-level touchpoint, which Pattern 1/Open Question 3 says should NOT be needed):
```typescript
import type { Metadata } from "next";
import { Lexend, Fraunces } from "next/font/google";
import "./globals.css";

const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: "FISH",
  description: "English coaching that fits how your brain works.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lexend.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```
No pattern change needed here — `color-scheme: light dark` is set entirely in `globals.css`'s `@layer base { html { ... } }` (see globals.css section above), not via a class/attribute on this `<html>` tag. Touch only if implementation reveals an interaction (RESEARCH.md Open Question 3).

---

## Shared Patterns

### `cn()` class merging
**Source:** `apps/web/lib/utils.ts`
**Apply to:** every component file (`Button`, `Input`, `Card`, `Progress`, new `Alert`, new `KitThemeToggle` if it grows conditional classes).
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
Every component wraps its class list in `cn(...)`, with static base classes first, conditional/prop-driven classes next, and `className` (caller override) last — this ordering is consistent across `button.tsx`, `input.tsx`, `card.tsx` and must be preserved in `alert.tsx`.

### `forwardRef` + `displayName` on focusable controls
**Source:** `apps/web/components/ui/button.tsx` (lines 24–42), `apps/web/components/ui/input.tsx` (lines 13–48)
**Apply to:** `Button`, `Input` (already do this — preserve through hardening). Does NOT apply to `Card`/`Progress`/`Alert` (non-focusable containers) unless a focusable child is added.
```typescript
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", fullWidth = true, ...props }, ref) => { /* ... */ }
);
Button.displayName = "Button";
```

### Semantic token consumption only — no raw hex, no numbered ramp
**Source:** every existing component file; enforced structurally by `globals.css` `@theme`
**Apply to:** all component and page files this phase touches.
Components reference only `bg-*`, `text-*`, `border-*` Tailwind utilities mapped from `@theme` role names (`bg-surface`, `text-foreground`, `border-notice`) — never `oklch(...)` inline, never `--color-grey-500`-style ramp tokens (D-04). This is a hard constraint from CONTEXT.md, not a style preference.

### Two-tone global focus ring (D-05) — one rule, not per-component
**Source:** `apps/web/app/globals.css` `@layer base { :focus-visible { ... } }` (lines 74–79, to be restructured)
**Apply to:** implicitly all interactive elements; no component file should add its own `focus:` ring override that competes with this global rule (Pitfall 4 — must remain visible against the inverted `primary` button fill in both themes).
```css
@layer base {
  :focus-visible {
    outline: 2px solid light-dark(oklch(1 0 0), oklch(0.15 0 0));
    outline-offset: 2px;
    box-shadow: 0 0 0 4px light-dark(oklch(0.15 0 0), oklch(1 0 0));
    border-radius: 6px;
  }
}
```

### `prefers-reduced-motion` suppression — already global, do not duplicate
**Source:** `apps/web/app/globals.css` lines 80–86
**Apply to:** any new transition/animation (Button loading spinner, Alert entrance if any) — rely on the existing blanket rule; do not add component-level `@media (prefers-reduced-motion)` guards.

### Doc-comment convention on exports
**Source:** `apps/web/components/ui/button.tsx` line 8, `card.tsx` lines 4/23, `input.tsx` lines 5,7,9
**Apply to:** `Alert`, `KitThemeToggle`, any new exported prop needing product-rule context.
```typescript
/** A calm container. The basic surface everything sits on. */
// The ONE action on a screen. Use at most one primary per view.
/** Shown in soft yellow (a notice), not alarming red. */
```
Single-line `/** ... */` above exports for "what/why," inline `//` above individual variant/prop entries explaining product-rule reasoning — match this exactly rather than adding JSDoc `@param`/`@returns` tags (none exist in this codebase).

## No Analog Found

Files with no close in-repo match — this is expected since the project has zero test infrastructure and this phase installs Vitest for the first time (RESEARCH.md Wave 0 Gaps, D-19). Planner should use RESEARCH.md's "Code Examples" and "Validation Architecture" sections directly, not search further for in-repo analogs.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/vitest.config.ts` | config | n/a | No test runner config exists anywhere in the repo yet; use RESEARCH.md Standard Stack (`vitest`, `@vitejs/plugin-react`, `jsdom`) directly |
| `apps/web/vitest.setup.ts` | config | n/a | Same — first test setup file; RESEARCH.md specifies `@testing-library/jest-dom` matcher import as the sole content |
| `apps/web/components/ui/button.test.tsx` / `input.test.tsx` / `card.test.tsx` / `alert.test.tsx` | test | request-response | No existing test files anywhere; RESEARCH.md Validation Architecture table maps each to RTL render+assert patterns (state props, min-height, tone/icon rendering) — first-of-kind, no in-repo precedent to copy structure from |
| `apps/web/[tests-or-scripts]/contrast.test.ts` (exact path is Claude's discretion per D-19) | test / utility | transform | No prior script/test of any kind exists; RESEARCH.md "Code Examples" section provides the full `colorjs.io`-based pattern to use verbatim (`assertAA(fgOklch, bgOklch, minRatio)`) |

## Conventions

**Derivation status:** the shared `gsd-tools.cjs verify conventions --derive` module was not available in this environment (no `gsd-plugin` cache directory found under `~/.claude/plugins/cache/`, and no `CLAUDE_PLUGIN_ROOT` set) — convention derivation skipped (tool unavailable). Conventions below are derived manually by direct inspection of all 7 existing source files (`globals.css`, `layout.tsx`, `page.tsx`, `button.tsx`, `input.tsx`, `card.tsx`, `utils.ts`), which is exhaustive for this greenfield repo (100% of files read, not sampled).

| Axis | Dominant | Share | Entropy | Status |
|------|----------|-------|---------|--------|
| File-name casing | lowercase-with-hyphens (`button.tsx`, `page.tsx`, `globals.css`) | 7/7 (100%) | none — zero variants | named contract |
| Identifier casing | camelCase (vars/functions) + PascalCase (components/types) | 7/7 (100%), no mixed-case or snake_case anywhere | none | named contract |
| Export style | named exports only (`export const Button`, `export function Card`) | 7/7 (100%) — zero `export default` on components (only `export default function Home()` on the page route, which is a Next.js framework requirement, not a component-export choice) | none | named contract |
| Import style | ESM `import { x } from "y"`, path-alias `@/*` for local, bare package name for deps | 7/7 (100%), no `require`, no relative `../../` traversal seen | none | named contract |

**Contested hotspots (author's choice):** none identified in this codebase — every axis above is a unanimous, zero-entropy convention across all 7 existing files, so there is no author's-choice ambiguity for the planner to navigate in `apps/web`. (For reference, this project's prototype "intentional-contested split" pattern — where a CJS↔SDK dual resolver splits conventions per-directory, e.g. `bin/lib/**` staying CJS `module.exports`/`require` while `sdk/src/**` stays ESM `export`/`import` — does not apply here: `apps/web` has no CJS surface at all; every file in scope for this phase is ESM TypeScript/TSX or CSS. If a future phase introduces Node-only tooling (e.g., a CJS script), match that directory's local convention rather than forcing ESM uniformity.)

## Metadata

**Analog search scope:** `apps/web/` (entire directory — 7 pre-existing source files, exhaustively read; `packages/core`, `packages/supabase`, `supabase/functions/send-message` inspected for cross-cutting convention confirmation but not used as direct analogs since they are non-UI domains)
**Files scanned:** 7 existing source files (100% of `apps/web` TS/TSX/CSS) + `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/eslint.config.mjs`, root `package.json` for tooling conventions
**Pattern extraction date:** 2026-07-02
