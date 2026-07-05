// @vitest-environment node
/**
 * Regression tripwire for the two-tone :focus-visible ring (D-05, KIT-05).
 *
 * WHY this exists: no test covered the :focus-visible rule, so its inner and
 * outer `light-dark()` band colors shipped SWAPPED through three human phase-gate
 * approvals — the outline resolved white-on-near-white and the box-shadow
 * resolved black-on-black, making the ring invisible (~1.06:1) on the primary
 * button, the single highest-priority control per screen. This guard parses the
 * rule directly and asserts the band-to-background pairing so that regression
 * can never again go unnoticed.
 *
 * Single source of truth: this test parses `app/globals.css` at test time,
 * mirroring the pattern in tests/contrast.test.ts — no second, divergent copy
 * of the ring or token colors may exist.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Color from "colorjs.io";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8"
);

/** Strip CSS comments so a commented-out rule cannot satisfy the guard. */
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

interface TokenPair {
  light: string;
  dark: string;
}

/** Every `--color-<role>: light-dark(oklch(...), oklch(...))` declaration. */
function parseTokens(source: string): Record<string, TokenPair> {
  const tokens: Record<string, TokenPair> = {};
  const re =
    /--color-([a-z0-9-]+)\s*:\s*light-dark\(\s*(oklch\([^)]*\))\s*,\s*(oklch\([^)]*\))\s*\)/g;
  for (const match of source.matchAll(re)) {
    tokens[match[1]] = { light: match[2], dark: match[3] };
  }
  return tokens;
}

const tokens = parseTokens(cssNoComments);

/** Extract the :focus-visible block so the ring parse can't match an unrelated rule. */
const focusVisibleMatch = cssNoComments.match(
  /:focus-visible\s*\{([\s\S]*?)\}/
);
if (!focusVisibleMatch) {
  throw new Error(":focus-visible rule not found in globals.css");
}
const focusVisibleBlock = focusVisibleMatch[1];

/** The outer band: `outline: <width> solid var(--color-...)`. */
function parseOutline(block: string): TokenPair {
  const match = block.match(
    /outline\s*:\s*[^;]*?var\(--color-([a-z0-9-]+)\)/
  );
  if (!match) throw new Error("outline color token not found");
  const token = tokens[match[1]];
  if (!token) throw new Error(`--color-${match[1]} token not found`);
  return token;
}

/** The inner band: `box-shadow: ... var(--color-...)`. */
function parseBoxShadow(block: string): TokenPair {
  const match = block.match(
    /box-shadow\s*:\s*[^;]*?var\(--color-([a-z0-9-]+)\)/
  );
  if (!match) throw new Error("box-shadow color token not found");
  const token = tokens[match[1]];
  if (!token) throw new Error(`--color-${match[1]} token not found`);
  return token;
}

const outline = parseOutline(focusVisibleBlock);
const boxShadow = parseBoxShadow(focusVisibleBlock);

type Theme = keyof TokenPair;
const themes: Theme[] = ["light", "dark"];

function contrastOf(a: string, b: string): number {
  return Math.abs(new Color(a).contrast(new Color(b), "WCAG21"));
}

/**
 * On the PRIMARY button, the ring's two bands have distinct jobs: the OUTER
 * band (outline) must separate from the PAGE the button sits on, and the
 * INNER band (box-shadow) must separate from the INVERTED PRIMARY FILL it
 * hugs. Visibility requires EITHER job to succeed — a sighted keyboard user
 * only needs to see one edge — so this is the max of the two *designated*
 * band-to-target pairings, NOT the max of all four band/target combinations.
 * That distinction is exactly what catches the swap: in the defective CSS,
 * the outline (assigned to contrast the page) actually resolves near-white
 * on near-white, and the box-shadow (assigned to contrast the fill) resolves
 * near-black on near-black — each band fails ITS OWN job even though the
 * other band's color would have passed the other job by coincidence.
 */
function primaryButtonMaxBandContrast(theme: Theme): number {
  const bg = tokens.bg[theme];
  const primary = tokens.primary[theme];
  return Math.max(
    contrastOf(outline[theme], bg),
    contrastOf(boxShadow[theme], primary)
  );
}

/**
 * On non-primary controls (surface backdrop — secondary/ghost/input), only
 * the outer band's job (contrast the page under the surface) matters since
 * there is no inverted fill to hug; either band separating from the surface
 * is sufficient for visibility.
 */
function surfaceMaxBandContrast(theme: Theme): number {
  const surface = tokens.surface[theme];
  return Math.max(
    contrastOf(outline[theme], surface),
    contrastOf(boxShadow[theme], surface)
  );
}

describe("focus-visible ring — band-to-background contrast (D-05, KIT-05)", () => {
  describe.each(themes)("%s theme", (theme) => {
    it("is visible on the primary button — outline vs --color-bg or box-shadow vs --color-primary >= 3.0", () => {
      expect(
        primaryButtonMaxBandContrast(theme),
        `focus ring on primary button (${theme})`
      ).toBeGreaterThanOrEqual(3.0);
    });

    it("stays visible against the secondary/ghost/input surface (--color-surface) >= 3.0", () => {
      expect(
        surfaceMaxBandContrast(theme),
        `focus ring vs --color-surface (${theme})`
      ).toBeGreaterThanOrEqual(3.0);
    });
  });
});
