// @vitest-environment node
/**
 * Regression guard for the borderless global keyboard-focus treatment.
 *
 * Focus remains visible through non-edge state changes. Outlines, borders,
 * rings, glows, and focus shadows are forbidden across production UI.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const globals = readFileSync(join(webRoot, "app/globals.css"), "utf8");
const cssNoComments = globals.replace(/\/\*[\s\S]*?\*\//g, "");
const focusVisibleBlock = cssNoComments.match(
  /:focus-visible\s*\{([\s\S]*?)\}/
)?.[1];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (entry === "node_modules" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (entry.includes(".test.") || entry.includes(".stories.")) return [];
    return [".ts", ".tsx", ".css"].includes(extname(path)) ? [path] : [];
  });
}

describe("borderless focus-visible state", () => {
  it("uses non-edge cues without an outline, ring, border, or shadow", () => {
    expect(focusVisibleBlock).toBeDefined();
    expect(focusVisibleBlock).toMatch(/outline\s*:\s*none/);
    expect(focusVisibleBlock).toMatch(/box-shadow\s*:\s*none/);
    expect(focusVisibleBlock).toMatch(/opacity\s*:\s*var\(--opacity-focus\)/);
    expect(focusVisibleBlock).not.toMatch(/\bborder\s*:/);
    expect(cssNoComments).not.toContain("--shadow-focus");
  });

  it("does not add production focus borders, outlines, rings, or shadows", () => {
    const productionSource = ["app", "components", "features"]
      .flatMap((directory) => sourceFiles(join(webRoot, directory)))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(productionSource).not.toMatch(
      /(?:focus|focus-visible|group-focus-visible|focus-within):(?:border|ring|shadow)(?:-|(?=\s|["'`]))|(?:focus|focus-visible|group-focus-visible|focus-within):outline(?:-(?!none\b)|(?=\s|["'`]))/
    );
  });
});
