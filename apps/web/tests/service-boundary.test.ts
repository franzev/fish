import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productionRoots = ["app", "features", "components", "lib"];
const allowedInfrastructure = [
  "lib/services/supabase/",
  "lib/services/runtime/browser.ts",
  "lib/services/runtime/server.ts",
];

const compositionRoots = [
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

function resolveLocalImport(root: string, importer: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(root, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(importer), specifier)
      : null;
  if (!base) return null;

  const candidates = extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

function collectLocalImportGraph(root: string, entry: string): string[] {
  const visited = new Set<string>();
  const pending = [entry];
  const importPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, "utf-8");
    for (const match of source.matchAll(importPattern)) {
      const dependency = resolveLocalImport(root, file, match[1]!);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }

  return Array.from(visited);
}

describe("service abstraction boundary", () => {
  it("keeps the browser service graph free of server-only modules", () => {
    const root = process.cwd();
    const graph = collectLocalImportGraph(
      root,
      join(root, "lib/services/runtime/browser.ts")
    );
    const offenders = graph
      .filter((file) => /["']server-only["']|from\s+["']next\/headers["']/.test(readFileSync(file, "utf-8")))
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

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

  it("keeps adapter implementations private to composition", () => {
    const root = process.cwd();
    const reexport = /export\s+(?:\*|\{[^}]*\})\s+from\s+["'][^"']*supabase/;

    const offenders = compositionRoots.filter((file) =>
      reexport.test(readFileSync(join(root, file), "utf-8"))
    );

    expect(offenders).toEqual([]);
  });

  it("keeps infrastructure from importing feature implementations", () => {
    const root = process.cwd();
    const infrastructureRoot = join(root, "lib/services/supabase");
    const offenders = collectProductionFiles(infrastructureRoot)
      .filter((file) =>
        /from\s+["'](?:@\/features\/|(?:\.\.\/)+features\/)/.test(
          readFileSync(file, "utf-8")
        )
      )
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it("keeps application contracts free of transport and persistence shapes", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/services/contracts.ts"),
      "utf-8"
    );

    expect(source).not.toMatch(
      /\bResponse\b|send-message|chat-command|accessToken|bearer|@supabase|@fish\/supabase/
    );
    expect(source).not.toMatch(/\b[a-z]+_[a-z][a-z_]*\b/);
  });

  it("keeps injected use cases independent from runtime composition", () => {
    const root = process.cwd();
    const featureRoot = join(root, "features");
    const useCases = collectProductionFiles(featureRoot).filter((file) =>
      /(?:action-handlers|use-cases)\.ts$/.test(file)
    );
    const offenders = useCases
      .filter((file) =>
        /from\s+["']@\/lib\/services\/(?:runtime|supabase)/.test(
          readFileSync(file, "utf-8")
        )
      )
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it("does not disguise partial service maps as complete interfaces", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/services/testing.ts"),
      "utf-8"
    );
    expect(source).not.toMatch(/Partial<AppServices>|as AppServices/);
    expect(source).not.toMatch(/SupabaseServices/);
  });
});
