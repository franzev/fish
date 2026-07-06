import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins conditional class names while omitting falsey values", () => {
    expect(
      cn("text-body", false && "text-muted", ["rounded-control"], {
        "bg-surface": true,
        "bg-bg": false,
      })
    ).toBe("text-body rounded-control bg-surface");
  });

  it("lets later Tailwind utilities win when classes conflict", () => {
    expect(cn("px-lg text-body", "px-md")).toBe("text-body px-md");
  });
});
