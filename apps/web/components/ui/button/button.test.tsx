import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("exposes reusable CVA variants for the maintained button styles", () => {
    expect(buttonVariants()).toContain("bg-primary");
    expect(buttonVariants()).not.toContain("w-full");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-surface");
    expect(buttonVariants({ variant: "ghost", fullWidth: false })).not.toContain(
      "w-full"
    );
  });

  it("defaults to content width unless fullWidth is requested", () => {
    const { getByRole, rerender } = render(<Button>Get started</Button>);
    expect(getByRole("button").className).not.toContain("w-full");

    rerender(<Button fullWidth={true}>Get started</Button>);
    expect(getByRole("button").className).toContain("w-full");
  });

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

  it("disabled state disables the button and carries the dim/blocked-cursor classes", () => {
    const { getByRole } = render(<Button disabled>Get started</Button>);
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:opacity-50");
    expect(button.className).toContain("disabled:cursor-not-allowed");
  });

  it("loading state sets aria-busy and shows a busy indicator, with the click guarded", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button loading onClick={onClick}>
        Saving
      </Button>
    );
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".animate-spin")).not.toBeNull();
    // Non-activation now comes from a click-guard (not pointer-events-none),
    // so a busy button must not fire its onClick when clicked.
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not mark a non-loading button as busy", () => {
    const { getByRole } = render(<Button>Get started</Button>);
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button.querySelector(".animate-spin")).toBeNull();
  });

  it("shows cursor-pointer on a default interactive button", () => {
    const { getByRole } = render(<Button>Get started</Button>);
    expect(getByRole("button").className).toContain("cursor-pointer");
  });

  it("shows cursor-progress while loading", () => {
    const { getByRole } = render(<Button loading>Saving</Button>);
    expect(getByRole("button").className).toContain("cursor-progress");
  });

  it("shows disabled:cursor-not-allowed when disabled, and stays disabled", () => {
    const { getByRole } = render(<Button disabled>Get started</Button>);
    const button = getByRole("button");
    expect(button.className).toContain("disabled:cursor-not-allowed");
    expect(button).toBeDisabled();
  });

  it("does not fire onClick when a loading button is clicked (loading click-guard)", () => {
    const spy = vi.fn();
    const { getByRole } = render(
      <Button loading onClick={spy}>
        Saving
      </Button>
    );
    fireEvent.click(getByRole("button"));
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not carry pointer-events-none in any state (cursor must be visible)", () => {
    const { getByRole, rerender } = render(<Button>Go</Button>);
    expect(getByRole("button").className).not.toContain("pointer-events-none");
    rerender(<Button loading>Go</Button>);
    expect(getByRole("button").className).not.toContain("pointer-events-none");
    rerender(<Button disabled>Go</Button>);
    expect(getByRole("button").className).not.toContain("pointer-events-none");
  });

  it("attaches no onClick handler when the consumer passes none, even while loading (RSC safety)", () => {
    // Button is used from Server Components with no onClick (e.g. the /
    // and /kit demo pages). Always attaching a wrapped handler — even to
    // guard a click that has no consumer callback to guard — would put a
    // function prop on the rendered element and break RSC serialization
    // ("Event handlers cannot be passed to Client Component props").
    const { getByRole, rerender } = render(<Button>Go</Button>);
    expect(getByRole("button").onclick).toBeNull();
    rerender(<Button loading>Go</Button>);
    expect(getByRole("button").onclick).toBeNull();
  });
});

/* Layout stability: no Button state change may alter its rendered size.
   Loading overlays a spinner over the (hidden, still-mounted) label instead
   of inserting inline content, and every variant carries a constant border
   width so the box model never differs. */
describe("Button layout stability", () => {
  it("keeps the label mounted while loading — hidden with opacity, never removed", () => {
    const { getByText } = render(<Button loading>Saving</Button>);
    const label = getByText("Saving");
    expect(label.className).toContain("opacity-0");
  });

  it("shows the label normally when not loading", () => {
    const { getByText } = render(<Button>Saving</Button>);
    expect(getByText("Saving").className).not.toContain("opacity-0");
  });

  it("overlays the spinner absolutely centered — no inline space inserted", () => {
    const { getByRole } = render(<Button loading>Saving</Button>);
    const button = getByRole("button");
    expect(button.className).toContain("relative");
    const spinner = button.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    expect(spinner!.className).toContain("absolute");
    expect(spinner!.className).not.toContain("mr-2");
  });

  it("every variant carries a constant border width so no variant changes the box model", () => {
    const { getByRole, rerender } = render(<Button>Go</Button>);
    const classes = () => getByRole("button").className.split(/\s+/);
    expect(classes()).toContain("border");
    expect(classes()).toContain("border-transparent");
    rerender(<Button variant="secondary">Go</Button>);
    expect(classes()).toContain("border");
    expect(classes()).toContain("border-border");
    rerender(<Button variant="ghost">Go</Button>);
    expect(classes()).toContain("border");
    expect(classes()).toContain("border-transparent");
  });
});
