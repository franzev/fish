import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("landing hero illustration", () => {
  it("uses the same blue accent hue as the auth illustrations", () => {
    const svg = readFileSync(
      resolve(process.cwd(), "public/illustrations/landing-hero-mind-map.svg"),
      "utf-8"
    );

    expect(svg).toContain("#90CAF9");
    expect(svg).not.toContain("#BA68C8");
  });

  it("uses the pale fair skin palette", () => {
    const svg = readFileSync(
      resolve(process.cwd(), "public/illustrations/landing-hero-mind-map.svg"),
      "utf-8"
    );

    expect(svg).toContain("#FFE2D3");
    expect(svg).toContain("#F1BFAE");
    expect(svg).toContain("#C4877C");
    expect(svg).not.toMatch(/#(?:FFA8A7|F28F8F|B16668)/i);
  });
});
