import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = process.cwd();
const repositoryRoot = join(webRoot, "../..");

function collectSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    if ([".next", "node_modules", "storybook-static"].includes(entry)) {
      return [];
    }

    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      return collectSourceFiles(path);
    }

    return /\.(?:ts|tsx)$/.test(path) ? [path] : [];
  });
}

function collectDirectories(root: string): string[] {
  return [
    root,
    ...readdirSync(root).flatMap((entry) => {
      const path = join(root, entry);
      return statSync(path).isDirectory() ? collectDirectories(path) : [];
    }),
  ];
}

function relativePaths(paths: string[], root = webRoot): string[] {
  return paths.map((path) => relative(root, path)).sort();
}

describe("module boundaries", () => {
  it("keeps feature-only directories out of the App Router tree", () => {
    const appRoot = join(webRoot, "app");
    const routeFiles = new Set([
      "default.tsx",
      "error.tsx",
      "layout.tsx",
      "loading.tsx",
      "not-found.tsx",
      "page.tsx",
      "route.ts",
      "template.tsx",
    ]);
    const offenders = collectDirectories(appRoot).filter((dir) => {
      const isPrivateImplementation = relative(appRoot, dir)
        .split(sep)
        .some((segment) => segment.startsWith("_"));
      if (isPrivateImplementation) {
        return false;
      }

      const directSources = readdirSync(dir).filter((entry) =>
        /\.(?:ts|tsx)$/.test(entry) &&
        !/\.(?:test|stories)\.(?:ts|tsx)$/.test(entry)
      );

      return (
        directSources.length > 0 &&
        !directSources.some((entry) => routeFiles.has(entry))
      );
    });

    expect(relativePaths(offenders)).toEqual([]);
  });

  it("keeps client modules from importing the chat server entry point", () => {
    const offenders = collectSourceFiles(webRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        /^\s*["']use client["'];/m.test(source) &&
        /from\s+["']@\/features\/chat\/server(?:\/|["'])/.test(source)
      );
    });

    expect(relativePaths(offenders)).toEqual([]);
  });

  it("keeps reusable components and libraries independent from app routes", () => {
    const reusableRoots = [join(webRoot, "components"), join(webRoot, "features"), join(webRoot, "lib")];
    const offenders = reusableRoots
      .flatMap(collectSourceFiles)
      .filter((file) => /from\s+["']@\/app\//.test(readFileSync(file, "utf8")));

    expect(relativePaths(offenders)).toEqual([]);
  });

  it("keeps chat compatibility callers on public entry points", () => {
    const offenders = collectSourceFiles(webRoot).filter((file) =>
      /from\s+["']@\/components\/chat\//.test(readFileSync(file, "utf8"))
    );

    expect(relativePaths(offenders)).toEqual([]);
  });

  it("keeps stories on the intentional reusable-component surface", () => {
    const stories = collectSourceFiles(webRoot)
      .map((file) => relative(webRoot, file).split(sep).join("/"))
      .filter((file) => /\.stories\.(?:ts|tsx)$/.test(file));
    const offenders = stories.filter(
      (file) =>
        !file.startsWith("components/") &&
        !/^features\/[^/]+\/components\//.test(file)
    );

    expect(offenders).toEqual([]);
    expect(stories.some((file) => /^features\/[^/]+\/components\//.test(file))).toBe(true);
  });

  it("colocates every story with its corresponding component", () => {
    const sourceFiles = collectSourceFiles(webRoot);
    const sourceFileSet = new Set(sourceFiles);
    const stories = sourceFiles.filter((file) =>
      /\.stories\.(?:ts|tsx)$/.test(file)
    );
    const offenders = stories.filter((story) => {
      const componentBase = story.replace(/\.stories\.(?:ts|tsx)$/, "");
      return ![`${componentBase}.ts`, `${componentBase}.tsx`].some((file) =>
        sourceFileSet.has(file)
      );
    });

    expect(relativePaths(offenders)).toEqual([]);
  });

  it("keeps every component implementation in a same-named folder", () => {
    const offenders = collectSourceFiles(webRoot).filter((file) => {
      const segments = relative(webRoot, file).split(sep);
      return (
        segments.some(
          (segment) => segment === "components" || segment === "_components"
        ) &&
        file.endsWith(".tsx") &&
        !/\.(?:test|stories)\.tsx$/.test(file) &&
        basename(file, ".tsx") !== basename(dirname(file))
      );
    });

    expect(relativePaths(offenders)).toEqual([]);
  });

  it("gives every component folder an index entry point", () => {
    const offenders = collectSourceFiles(webRoot).filter((file) => {
      const segments = relative(webRoot, file).split(sep);
      return (
        segments.some(
          (segment) => segment === "components" || segment === "_components"
        ) &&
        file.endsWith(".tsx") &&
        !/\.(?:test|stories)\.tsx$/.test(file) &&
        !existsSync(join(dirname(file), "index.ts"))
      );
    });

    expect(relativePaths(offenders)).toEqual([]);
  });

  it("keeps the core chat state free of framework and provider dependencies", () => {
    const coreChatState = join(repositoryRoot, "packages", "core", "src", "chat-state");
    const forbidden = /from\s+["'](?:react|next(?:\/|["'])|zustand|@supabase\/|@fish\/supabase)/;
    const offenders = collectSourceFiles(coreChatState).filter((file) =>
      forbidden.test(readFileSync(file, "utf8"))
    );

    expect(relativePaths(offenders, repositoryRoot)).toEqual([]);
  });
});
