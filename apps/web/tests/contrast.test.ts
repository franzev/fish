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
 *   - every STRUCTURAL token must be pure monochrome (oklch chroma = 0 — TOKN-01)
 *   - semantic feedback and presence tones are deliberate exceptions: calm,
 *     desaturated hues instead of monochrome. Feedback remains contrast-gated
 *     below, and every hue is bounded to prevent saturated status colors.
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
  "warning",
  "success",
  "presence-online",
  "presence-idle",
  "presence-away",
  "presence-busy",
  "presence-offline",
] as const;

/** Semantic state tones are the deliberate exception to pure monochrome.
 *  Offline remains neutral, while active states use calm, desaturated hues. */
const hueTones = [
  "error",
  "warning",
  "success",
  "presence-online",
  "presence-idle",
  "presence-away",
  "presence-busy",
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

  it("keeps every structural token pure monochrome — oklch chroma is 0 in both themes (TOKN-01)", () => {
    for (const [name, pair] of Object.entries(tokens)) {
      if ((hueTones as readonly string[]).includes(name)) continue;
      for (const theme of themes) {
        const chroma = new Color(pair[theme]).coords[1];
        expect(chroma, `--color-${name} (${theme}) chroma`).toBe(0);
      }
    }
  });

  it("keeps semantic status tones calm and desaturated, never neon or pure-hue (D-08)", () => {
    for (const name of hueTones) {
      for (const theme of themes) {
        const chroma = new Color(tokens[name][theme]).coords[1];
        expect(chroma, `--color-${name} (${theme}) chroma`).toBeGreaterThan(0);
        expect(chroma, `--color-${name} (${theme}) chroma too saturated`).toBeLessThanOrEqual(0.15);
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
  ["warning", "surface"],
  ["success", "surface"],
  // WR-04: rendered-but-previously-unasserted pairings (closes the gap noted
  // in 01-VERIFICATION.md — these already pass on disk, this guards them).
  ["muted", "surface"], // placeholder/hint text on the input surface
  ["body", "surface-2"], // elevated-card / alt-row body text
  ["foreground", "surface-2"], // elevated-card / alt-row heading text
  ["notice", "bg"], // feedback text rendered directly on the page canvas
  ["error", "bg"], // feedback text rendered directly on the page canvas
  ["warning", "bg"], // feedback text rendered directly on the page canvas
  ["success", "bg"], // feedback text rendered directly on the page canvas
];

/** UI-component pairs: WCAG 2.1 AA non-text contrast — ratio >= 3.0. */
const uiPairs: Array<[fg: string, bg: string]> = [
  ["border", "surface"],
  ["border-strong", "surface"],
  ["error", "surface"], // Alert/Input error border
  ["warning", "surface"], // Alert warning border
  ["success", "surface"], // Alert success border
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
