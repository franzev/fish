// @vitest-environment node
/**
 * Regression guard for FISH's shadowless visual language.
 *
 * Production UI may use surface steps and borders for separation, but never
 * box shadows, text shadows, Tailwind shadow utilities, or drop shadows.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (entry === "node_modules" || entry === ".next") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (entry.includes(".test.") || entry.includes(".stories.")) return [];
    return [".ts", ".tsx", ".css"].includes(extname(path)) ? [path] : [];
  });
}

describe("shadowless production UI", () => {
  const sources = ["app", "components", "features"]
    .flatMap((directory) => sourceFiles(join(webRoot, directory)))
    .map((path) => ({
      path: relative(webRoot, path),
      source: readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""),
    }));

  it("contains no shadow utilities or visible shadow declarations", () => {
    const offenders = sources.flatMap(({ path, source }) => {
      const hasShadowUtility = /(?:^|[\s"'`])(?:[a-z-]+:)*(?:shadow-[^\s"'`]+|shadow)(?=[\s"'`]|$)/m.test(source);
      const hasDropShadowUtility = /(?:^|[\s"'`])(?:[a-z-]+:)*drop-shadow(?:-[^\s"'`]*)?(?=[\s"'`]|$)/m.test(source);
      const hasVisibleDeclaration = Array.from(
        source.matchAll(/(?:box-shadow|text-shadow)\s*:\s*([^;}]+)/gi)
      ).some((match) => match[1].trim() !== "none");
      return hasShadowUtility || hasDropShadowUtility || hasVisibleDeclaration
        ? [path]
        : [];
    });

    expect(offenders).toEqual([]);
  });

  it("keeps the unlayered global no-shadow backstop", () => {
    const globals = readFileSync(join(webRoot, "app/globals.css"), "utf8");
    expect(globals).toMatch(/\*::after\s*\{\s*box-shadow:\s*none;\s*text-shadow:\s*none;/);
  });
});
