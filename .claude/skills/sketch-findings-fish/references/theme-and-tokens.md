# Theme & Tokens

The shared sketch theme, hardened by a 5-lens design critique. Source: `sources/themes/default.css`.
This mirrors the *spirit* of the shipped `apps/web/app/globals.css` — port decisions there, don't
fork a second token system.

## Aesthetic direction

**Pure monochrome, soft & spacious** (Headspace/Calm-like): airy whitespace, large rounded cards,
gentle diffuse shadows, unhurried. Dual **light/dark** from one ladder via CSS `light-dark()`.

## Tokens (monochrome ladder)

- Surfaces: `--bg --surface --surface-2 --surface-3`; lines: `--border --border-strong`.
- Text: `--ink` (headings/foreground) · `--body` · `--muted` (quiet) · `--faint`.
- Action: `--primary` (high-contrast ink) / `--on-primary`; `--ring` (focus).
- **Type:** `--font-body` = Lexend (chosen for reading fluency — the ADHD/non-native audience), `--font-display` = Fraunces. Scale `--text-xs`(12px) … `--text-3xl`. **Never go below 12px** (10–11px labels were bumped up).
- **Spacing** `--s1…--s20` (spacious). **Radii** soft/large (`--r-md` 14 … `--r-xl` 28, `--r-pill`). **`--tap: 56px`** minimum tap target.

## Color rule

Structural UI is **chroma-0**. The **only** sanctioned colors: the **teal brand logo** (`logo.svg`), and the low-chroma **alert tones** carried over from v1.0. Everything else — presence dots, rewards, status — is monochrome. (A green presence dot and a 🌿 emoji were removed for this reason.)

## Accessibility floor (baked into the theme)

- `--muted` tuned to **#5e5e57** (light) / **#98988f** (dark) to clear **4.5:1 AA** even on the `surface-3` active-row tint (measured 5.2–5.3:1) — it carries previews/labels/status the non-native audience relies on. Source of truth is `sources/themes/default.css`; don't put essential text on anything lighter.
- `:focus-visible` → 3px `--ring` outline + offset on every real control.
- `@media (prefers-reduced-motion: reduce)` disables the animations.
- Active/selected states must be distinguishable by **shape or weight**, not color alone.

## Anti-patterns

- ❌ Raw hex in components (use tokens). ❌ Any color in structural UI beyond logo + alert tones.
- ❌ Sub-56px tap targets. ❌ Fonts below 12px. ❌ Animations without a reduced-motion guard.
- ❌ `--muted` for essential reading text. ❌ Creating a `tailwind.config.js` (v4 is CSS-first — see AGENTS.md).
