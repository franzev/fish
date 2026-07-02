// @vitest-environment node
/**
 * WCAG AA contrast assertions for the monochrome token ladder (D-07, D-19).
 *
 * Single source of truth: this test parses `app/globals.css` at test time and
 * asserts against the SAME `light-dark()` values the browser resolves
 * (Pitfall 3 — no second, divergent copy of the token values may exist).
 *
 * Any `--color-*` change in globals.css is re-verified here automatically:
 *   - text pairs must meet WCAG 2.1 AA 4.5:1
 *   - UI-component pairs (borders) must meet 3:1
 *   - every token must be pure monochrome (oklch chroma = 0 — TOKN-01)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Color from "colorjs.io";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8"
);

/** Strip CSS comments so commented-out tokens can't satisfy assertions. */
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

const expectedTokenNames = [
  "bg",
  "surface",
  "surface-2",
  "border",
  "border-strong",
  "foreground",
  "body",
  "muted",
  "primary",
  "on-primary",
  "primary-press",
  "notice",
  "error",
  "success",
] as const;

type Theme = keyof TokenPair;
const themes: Theme[] = ["light", "dark"];

function contrast(fgName: string, bgName: string, theme: Theme): number {
  const fg = new Color(tokens[fgName][theme]);
  const bg = new Color(tokens[bgName][theme]);
  return Math.abs(fg.contrast(bg, "WCAG21"));
}

describe("monochrome token ladder (globals.css @theme)", () => {
  it("defines every semantic token as a light-dark() pair", () => {
    for (const name of expectedTokenNames) {
      expect(tokens[name], `--color-${name} must exist as light-dark()`).toBeDefined();
    }
  });

  it("defines NO color token outside the light-dark() form", () => {
    // Every --color-* declaration must have matched the light-dark() parser —
    // a plain single-value color token would silently skip the dual-theme gate.
    const allDeclared = [
      ...cssNoComments.matchAll(/--color-([a-z0-9-]+)\s*:/g),
    ].map((m) => m[1]);
    const unparsed = allDeclared.filter((name) => !tokens[name]);
    expect(unparsed, "color tokens missing light-dark()").toEqual([]);
  });

  it("keeps every token pure monochrome — oklch chroma is 0 in both themes (TOKN-01)", () => {
    for (const [name, pair] of Object.entries(tokens)) {
      for (const theme of themes) {
        const chroma = new Color(pair[theme]).coords[1];
        expect(chroma, `--color-${name} (${theme}) chroma`).toBe(0);
      }
    }
  });
});

/** Text pairs: WCAG 2.1 AA for normal text — ratio >= 4.5. */
const textPairs: Array<[fg: string, bg: string]> = [
  ["body", "bg"],
  ["body", "surface"],
  ["foreground", "bg"],
  ["foreground", "surface"],
  ["on-primary", "primary"],
  ["on-primary", "primary-press"],
  ["muted", "bg"],
  ["notice", "surface"],
  ["error", "surface"],
  ["success", "surface"],
];

/** UI-component pairs: WCAG 2.1 AA non-text contrast — ratio >= 3.0. */
const uiPairs: Array<[fg: string, bg: string]> = [
  ["border", "surface"],
  ["border-strong", "surface"],
];

describe.each(themes)("WCAG AA contrast — %s theme", (theme) => {
  it.each(textPairs)("%s on %s >= 4.5 (text)", (fg, bg) => {
    expect(
      contrast(fg, bg, theme),
      `${fg} on ${bg} (${theme})`
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(uiPairs)("%s on %s >= 3.0 (UI component)", (fg, bg) => {
    expect(
      contrast(fg, bg, theme),
      `${fg} on ${bg} (${theme})`
    ).toBeGreaterThanOrEqual(3.0);
  });
});
