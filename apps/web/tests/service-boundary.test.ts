import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function collectTsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      if ([".next", "node_modules", "storybook-static"].includes(entry)) {
        return [];
      }
      return collectTsxFiles(path);
    }

    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("service abstraction boundary", () => {
  it("keeps TSX files from importing Supabase clients or package contracts directly", () => {
    const root = process.cwd();
    const forbiddenImport = /from\s+["'](?:@supabase\/|@fish\/supabase|@\/lib\/supabase)/;
    const offenders = collectTsxFiles(root)
      .filter((file) => forbiddenImport.test(readFileSync(file, "utf-8")))
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });
});
