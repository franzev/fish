import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("primary variant applies the inverted-block tokens", () => {
    const { getByRole } = render(<Button>Get started</Button>);
    const button = getByRole("button", { name: "Get started" });
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-on-primary");
  });

  it("meets the 56px tap-target floor via the size-control token (KIT-04)", () => {
    const { getByRole } = render(<Button>Get started</Button>);
    expect(getByRole("button").className).toContain(
      "min-h-[var(--size-control)]"
    );
  });

  it("secondary variant renders its surface/border tokens", () => {
    const { getByRole } = render(
      <Button variant="secondary">I already have an account</Button>
    );
    const button = getByRole("button");
    expect(button.className).toContain("bg-surface");
    expect(button.className).toContain("border-border");
    expect(button.className).toContain("text-foreground");
  });

  it("ghost variant renders its low-emphasis tokens", () => {
    const { getByRole } = render(
      <Button variant="ghost" fullWidth={false}>
        Need help?
      </Button>
    );
    const button = getByRole("button");
    expect(button.className).toContain("bg-transparent");
    expect(button.className).toContain("text-muted");
  });

  it("disabled state disables the button and carries the dim/no-pointer classes", () => {
    const { getByRole } = render(<Button disabled>Get started</Button>);
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:opacity-50");
    expect(button.className).toContain("disabled:pointer-events-none");
  });

  it("loading state sets aria-busy, blocks pointer events, and shows a busy indicator", () => {
    const { getByRole } = render(<Button loading>Saving</Button>);
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.className).toContain("pointer-events-none");
    expect(button.querySelector(".animate-spin")).not.toBeNull();
  });

  it("does not mark a non-loading button as busy", () => {
    const { getByRole } = render(<Button>Get started</Button>);
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button.querySelector(".animate-spin")).toBeNull();
  });
});
