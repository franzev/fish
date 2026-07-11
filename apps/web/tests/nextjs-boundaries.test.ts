import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = process.cwd();
const sourceExtensions = [".ts", ".tsx"];

function collectSources(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    if ([".next", "node_modules", "storybook-static"].includes(entry)) return [];
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return collectSources(path);
    return sourceExtensions.includes(extname(path)) &&
      !/\.(?:test|stories)\.(?:ts|tsx)$/.test(path)
      ? [path]
      : [];
  });
}

function resolveSource(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(webRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;

  const candidates = [
    base,
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers = [...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)]
    .map((match) => match[1]);
  return specifiers.map((specifier) => resolveSource(file, specifier)).filter((path): path is string => path !== null);
}

function marker(file: string): "server" | "client" | null {
  const source = readFileSync(file, "utf8");
  if (/import\s+["']server-only["']/.test(source)) return "server";
  if (/import\s+["']client-only["']/.test(source)) return "client";
  return null;
}

function reachesOppositeMarker(
  start: string,
  expected: "server" | "client",
  imports: (file: string) => string[],
  classify: (file: string) => "server" | "client" | null,
): boolean {
  const seen = new Set<string>();
  const pending = [...imports(start)];
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const kind = classify(file);
    if (kind && kind !== expected) return true;
    pending.push(...imports(file));
  }
  return false;
}

function display(paths: string[]): string[] {
  return paths.map((path) => relative(webRoot, path).split(sep).join("/")).sort();
}

describe("Next.js module poisoning", () => {
  const sources = collectSources(webRoot);

  it("rejects transitive server/client boundary crossings for alias and relative imports", () => {
    const offenders = sources.filter((file) => {
      const kind = marker(file);
      return kind !== null && reachesOppositeMarker(file, kind, importsOf, marker);
    });
    expect(display(offenders)).toEqual([]);
  });

  it("proves the graph assertion catches both relative and aliased poisoned paths", () => {
    const graph = new Map([
      ["client", ["relative", "aliased"]],
      ["relative", ["server"]],
      ["aliased", ["server"]],
      ["server", []],
    ]);
    const classify = (file: string) => file === "client" ? "client" as const : file === "server" ? "server" as const : null;
    expect(reachesOppositeMarker("client", "client", (file) => graph.get(file) ?? [], classify)).toBe(true);
  });

  it("requires feature server entry points to be directly poisoned", () => {
    const entries = sources.filter((file) =>
      /\/features\/[^/]+\/server\/(?:index|actions|page-data)\.ts$/.test(file)
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(display(entries.filter((file) => marker(file) !== "server"))).toEqual([]);
  });

  it("keeps client-safe feature barrels independent from server entries", () => {
    const barrels = sources.filter((file) => /\/features\/[^/]+\/index\.ts$/.test(file));
    const offenders = barrels.filter((file) => reachesOppositeMarker(file, "client", importsOf, marker));
    expect(display(offenders)).toEqual([]);
  });
});
