import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const coreChatStateRoot = join(
  process.cwd(),
  "../../packages/core/src/chat-state"
);

const forbiddenPatterns = [
  { label: "React", pattern: /\bfrom\s+["']react["']|\breact\b/i },
  { label: "Next.js", pattern: /\bfrom\s+["']next(?:\/[^"']*)?["']|["']next\//i },
  { label: "Zustand", pattern: /\bfrom\s+["']zustand(?:\/[^"']*)?["']|\bzustand\b/i },
  { label: "Supabase", pattern: /@supabase|supabase/i },
  { label: "web aliases", pattern: /\bfrom\s+["']@\// },
  { label: "browser globals", pattern: /\b(window|document)\b/ },
  { label: "Swift", pattern: /\b(Swift|SwiftUI|ObservableObject)\b/ },
  { label: "Kotlin", pattern: /\b(Kotlin|ViewModel|StateFlow)\b/ },
];

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectTypeScriptFiles(path);
      }
      return entry.isFile() && path.endsWith(".ts") ? [path] : [];
    })
  );

  return nested.flat();
}

describe("portable chat-state dependency boundary", () => {
  it("does not import platform or app-specific dependencies", async () => {
    const files = await collectTypeScriptFiles(coreChatStateRoot);
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const { label, pattern } of forbiddenPatterns) {
        if (pattern.test(source)) {
          violations.push(`${file}: ${label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
