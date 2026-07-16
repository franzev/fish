// @vitest-environment node
/** Regression guard for the breakpoint-specific keyboard-focus treatment. */
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

describe("focus-visible state", () => {
  it("keeps the established borderless desktop treatment", () => {
    expect(focusVisibleBlock).toBeDefined();
    expect(focusVisibleBlock).toMatch(/outline\s*:\s*none/);
    expect(focusVisibleBlock).toMatch(/box-shadow\s*:\s*none/);
    expect(focusVisibleBlock).toMatch(/opacity\s*:\s*var\(--opacity-focus\)/);
    expect(focusVisibleBlock).not.toMatch(/\bborder\s*:/);
    expect(cssNoComments).not.toContain("--shadow-focus");
  });

  it("adds a stable tokenized indicator on mobile and in forced colors", () => {
    expect(cssNoComments).toContain("--color-focus-indicator:");
    expect(cssNoComments).toMatch(/@media\s*\(max-width:\s*47\.999rem\)/);
    expect(cssNoComments).toContain(
      "outline: var(--spacing-3xs) solid var(--color-focus-indicator)"
    );
    expect(cssNoComments).toContain("outline-offset: var(--spacing-2xs)");
    expect(cssNoComments).toMatch(
      /@media\s*\(max-width:\s*47\.999rem\)\s*and\s*\(forced-colors:\s*active\)/
    );
    expect(cssNoComments).toContain("outline-color: CanvasText");
  });

  it("does not add one-off component focus borders, rings, or shadows", () => {
    const productionSource = ["app", "components", "features"]
      .flatMap((directory) => sourceFiles(join(webRoot, directory)))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(productionSource).not.toMatch(
      /(?:focus|focus-visible|group-focus-visible|focus-within):(?:border|ring|shadow)(?:-|(?=\s|["'`]))/
    );
  });
});
