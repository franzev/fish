import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
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

function relativePaths(paths: string[], root = webRoot): string[] {
  return paths.map((path) => relative(root, path)).sort();
}

describe("module boundaries", () => {
  it("keeps the reusable chat feature out of the App Router tree", () => {
    const appChatPath = join(webRoot, "app", "(authenticated)", "chat");
    const appSources = collectSourceFiles(join(webRoot, "app"));

    expect(appSources.filter((file) => file.startsWith(`${appChatPath}${sep}`))).toEqual([]);
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

  it("keeps the core chat state free of framework and provider dependencies", () => {
    const coreChatState = join(repositoryRoot, "packages", "core", "src", "chat-state");
    const forbidden = /from\s+["'](?:react|next(?:\/|["'])|zustand|@supabase\/|@fish\/supabase)/;
    const offenders = collectSourceFiles(coreChatState).filter((file) =>
      forbidden.test(readFileSync(file, "utf8"))
    );

    expect(relativePaths(offenders, repositoryRoot)).toEqual([]);
  });
});
