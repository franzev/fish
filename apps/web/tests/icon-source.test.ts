// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const BANNED_ICON_IMPORTS = ["react-icons", "@heroicons/react", "lucide-react"];
const SCAN_EXTENSIONS = [".ts", ".tsx"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build"]);

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

describe("icon source guard (TOKN-06)", () => {
  it("imports no icon set other than @tabler/icons-react across apps/web", () => {
    const webRoot = join(__dirname, "..");
    const sourceFiles = collectSourceFiles(webRoot);
    const offenders: { file: string; specifier: string }[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf-8");
      for (const specifier of BANNED_ICON_IMPORTS) {
        const importPattern = new RegExp(`from\\s+["']${specifier}["']`);
        if (importPattern.test(content)) {
          offenders.push({ file, specifier });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
