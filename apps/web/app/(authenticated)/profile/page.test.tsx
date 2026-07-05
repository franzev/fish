import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ProfilePage source contracts", () => {
  it("keeps the read-only profile view free of primary buttons", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");

    expect(source).not.toMatch(/variant="primary"/);
  });

  it("keeps the edit navigation target at the 56px FISH control size", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");

    expect(source).toContain("min-h-[var(--size-control)]");
    expect(source).not.toContain("min-h-[36px]");
  });
});
