import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const productionRoots = ["app", "features", "components", "lib"];
const allowedInfrastructure = [
  "lib/services/supabase/",
  "lib/services/runtime/browser.ts",
  "lib/services/runtime/server.ts",
];

function collectProductionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return collectProductionFiles(path);
    return /\.(?:ts|tsx)$/.test(path) && !/\.(?:test|stories)\.(?:ts|tsx)$/.test(path)
      ? [path]
      : [];
  });
}

describe("service abstraction boundary", () => {
  it("keeps provider APIs inside infrastructure and composition roots", () => {
    const root = process.cwd();
    const files = productionRoots.flatMap((dir) => collectProductionFiles(join(root, dir)));
    const forbidden = [
      /from\s+["'](?:@supabase\/|@fish\/supabase|@\/lib\/supabase)/,
      /from\s+["']@\/lib\/services\/supabase/,
      /\bservices\.client\b/,
      /\b(?:createBrowserSupabaseClient|createServerSupabaseClient)\b/,
      /\b(?:SupabaseClient|RealtimeChannel|AuthChangeEvent|EmailOtpType)\b/,
    ];

    const offenders = files.flatMap((file) => {
      const path = relative(root, file);
      if (allowedInfrastructure.some((allowed) => path === allowed || path.startsWith(allowed))) return [];
      const source = readFileSync(file, "utf-8");
      return forbidden.some((pattern) => pattern.test(source)) ? [path] : [];
    });

    expect(offenders).toEqual([]);
  });

  it("does not expose provider-named contracts from the public service barrel", () => {
    const source = readFileSync(join(process.cwd(), "lib/services/index.ts"), "utf-8");
    expect(source).not.toMatch(/supabase/i);
  });
});
