// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";

const SCAN_EXTENSIONS = [".ts", ".tsx"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build"]);

const VISUAL_UTILITY_PREFIXES = [
  "backdrop-blur",
  "basis",
  "bg",
  "blur",
  "border",
  "bottom",
  "caret",
  "decoration",
  "divide",
  "drop-shadow",
  "duration",
  "ease",
  "fill",
  "flex",
  "from",
  "gap",
  "grid-cols",
  "grid-rows",
  "h",
  "inset",
  "leading",
  "left",
  "m",
  "max-h",
  "max-w",
  "mb",
  "min-h",
  "min-w",
  "ml",
  "mr",
  "mt",
  "mx",
  "my",
  "opacity",
  "outline",
  "p",
  "pb",
  "placeholder",
  "pl",
  "pr",
  "pt",
  "px",
  "py",
  "right",
  "ring",
  "rounded",
  "shadow",
  "size",
  "space-x",
  "space-y",
  "stroke",
  "text",
  "to",
  "top",
  "tracking",
  "transition",
  "translate",
  "translate-x",
  "translate-y",
  "underline-offset",
  "via",
  "w",
  "z",
];

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      collectSourceFiles(fullPath, files);
    } else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Tailwind design-token guard", () => {
  it("does not use arbitrary visual utility values in web source", () => {
    const webRoot = join(__dirname, "..");
    const sourceFiles = collectSourceFiles(webRoot);
    const visualPrefixes = VISUAL_UTILITY_PREFIXES.map(escapeRegExp).join("|");
    const classStart = `(?:^|[\\s"'\\\`])`;
    const visualArbitraryClassPattern = new RegExp(
      `${classStart}((?:[a-z0-9-]+:)*(?:${visualPrefixes})(?:-[a-z0-9]+)*-\\[[^\\]]+\\])`,
      "g"
    );
    const scalarArbitraryClassPattern = new RegExp(
      `${classStart}((?:[a-z0-9-]+:)*[a-z0-9/-]+-\\[[^\\]]*(?:px|rem|em|%|var\\(|oklch|#|ms)[^\\]]*\\])`,
      "g"
    );
    const arbitraryPropertyClassPattern = new RegExp(
      `${classStart}((?:[a-z0-9-]+:)*\\[[a-z-]+:[^\\]\\s]+\\])`,
      "g"
    );
    const offenders: { className: string; file: string; line: number }[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        let match: RegExpExecArray | null;
        for (const pattern of [
          visualArbitraryClassPattern,
          scalarArbitraryClassPattern,
          arbitraryPropertyClassPattern,
        ]) {
          while ((match = pattern.exec(line))) {
            offenders.push({
              className: match[1],
              file: relative(webRoot, file),
              line: index + 1,
            });
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
