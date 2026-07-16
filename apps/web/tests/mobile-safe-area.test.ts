// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(webRoot, path), "utf8");

describe("mobile safe areas", () => {
  it("keeps every persistent mobile surface attached to a safe-area helper", () => {
    const globals = read("app/globals.css");
    const shell = read("components/shell/app-shell/app-shell.tsx");
    const calls = read(
      "features/calls/components/call-popover-view/call-popover-view.tsx"
    );
    const booking = read(
      "features/booking/components/booking-screen/booking-screen.tsx"
    );
    const mediaPicker = read(
      "features/chat/components/media-picker-button/media-picker-button.tsx"
    );

    expect(globals).toMatch(
      /\.mobile-nav-safe\s*\{[\s\S]*?env\(safe-area-inset-bottom\)/
    );
    expect(globals).toMatch(
      /\.mobile-controls-safe\s*\{[\s\S]*?env\(safe-area-inset-bottom\)/
    );
    expect(globals).toMatch(
      /\.mobile-call-popover-safe\s*\{[\s\S]*?env\(safe-area-inset-bottom\)/
    );
    expect(globals).toMatch(
      /\.media-picker-positioner \[role="dialog"\][\s\S]*?env\(safe-area-inset-bottom\)/
    );
    expect(shell).toContain("mobile-nav-safe");
    expect(shell).toContain("mobile-nav-content-safe");
    expect(calls).toContain("mobile-call-popover-safe");
    expect(calls).toContain("mobile-controls-safe");
    expect(booking).toContain("mobile-booking-content-safe");
    expect(mediaPicker).toContain("media-picker-positioner");
  });

  it("limits safe-area layout overrides to the mobile breakpoint", () => {
    const globals = read("app/globals.css");
    const mobileBlock = globals.slice(
      globals.lastIndexOf("@media (max-width: 47.999rem)")
    );

    expect(mobileBlock).toContain(".mobile-nav-safe");
    expect(mobileBlock).toContain(".media-picker-positioner");
  });
});
