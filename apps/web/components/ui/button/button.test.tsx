import { fireEvent, render } from "@testing-library/react";
import { createRef, type MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("exposes reusable CVA variants for the maintained button styles", () => {
    expect(buttonVariants()).toContain("bg-primary");
    expect(buttonVariants()).not.toContain("w-full");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-surface-2");
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

  it("centers its content wrapper without a baseline offset", () => {
    const { getByText } = render(<Button>Call</Button>);

    expect(getByText("Call")).toHaveClass(
      "inline-flex",
      "items-center",
      "justify-center"
    );
  });

  it("renders a Next.js link when href is present and merges its variants with custom classes", () => {
    const { getByRole } = render(
      <Button href="/profile" variant="ghost" fullWidth className="mt-lg">
        View profile
      </Button>
    );
    const link = getByRole("link", { name: "View profile" });

    expect(link).toHaveAttribute("href", "/profile");
    expect(link).toHaveClass("bg-transparent", "text-muted", "w-full", "mt-lg");
  });

  it("forwards the element-specific ref for both buttons and links", () => {
    const buttonRef = createRef<HTMLButtonElement>();
    const linkRef = createRef<HTMLAnchorElement>();
    const { getByRole } = render(
      <>
        <Button ref={buttonRef}>Save</Button>
        <Button ref={linkRef} href="/home">
          Back to home
        </Button>
      </>
    );

    expect(buttonRef.current).toBe(getByRole("button", { name: "Save" }));
    expect(linkRef.current).toBe(getByRole("link", { name: "Back to home" }));
  });

  it("forwards link click handlers with an anchor currentTarget", () => {
    const onClick = vi.fn((event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      expect(event.currentTarget.tagName).toBe("A");
    });
    const { getByRole } = render(
      <Button href="/profile" prefetch={false} replace onClick={onClick}>
        View profile
      </Button>
    );

    fireEvent.click(getByRole("link", { name: "View profile" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps busy and disabled states exclusive to native buttons at the type boundary", () => {
    const typeCheck = () => {
      const action = <Button loading>Saving</Button>;
      const link = <Button href="/home">Back to home</Button>;
      // @ts-expect-error Link buttons preserve anchor semantics and cannot be disabled.
      const disabledLink = <Button href="/home" disabled>Back to home</Button>;
      // @ts-expect-error Link buttons do not expose the action-only busy state.
      const loadingLink = <Button href="/home" loading>Back to home</Button>;

      return { action, disabledLink, link, loadingLink };
    };

    expect(typeCheck).toBeTypeOf("function");
  });

  it("primary variant applies the inverted-block tokens", () => {
    const { getByRole } = render(<Button>Get started</Button>);
    const button = getByRole("button", { name: "Get started" });
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-on-primary");
  });

  it("uses the 56px primary-action token for focused prominence (KIT-04)", () => {
    const { getByRole } = render(<Button>Get started</Button>);
    expect(getByRole("button").className).toContain(
      "min-h-control-primary"
    );
  });

  it("supports square icon actions without the primary minimum height", () => {
    const { getByRole } = render(
      <Button controlSize="square" aria-label="Send message">
        Send
      </Button>
    );
    const button = getByRole("button", { name: "Send message" });

    expect(button).toHaveClass(
      "icon-button-glyph",
      "size-control",
      "min-h-control",
      "px-0"
    );
    expect(button).not.toHaveClass("px-md");
    expect(button).not.toHaveClass("min-h-control-primary");
  });

  it("secondary variant renders its quiet surface-step well tokens", () => {
    const { getByRole } = render(
      <Button variant="secondary">I already have an account</Button>
    );
    const button = getByRole("button");
    expect(button.className).toContain("bg-surface-2");
    expect(button.className).toContain("text-foreground");
    expect(button.className).toContain("min-h-control");
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

  it("loading state disables native activation, including submit buttons with no onClick", () => {
    const { getByRole } = render(
      <Button type="submit" loading>
        Sign in
      </Button>
    );
    expect(getByRole("button", { name: "Sign in" })).toBeDisabled();
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
    expect(spinner!.className).not.toContain("mr-xs");
  });

  it("every variant carries a constant border width so no variant changes the box model", () => {
    const { getByRole, rerender } = render(<Button>Go</Button>);
    const classes = () => getByRole("button").className.split(/\s+/);
    expect(classes()).toContain("border");
    expect(classes()).toContain("border-transparent");
    rerender(<Button variant="secondary">Go</Button>);
    expect(classes()).toContain("border");
    expect(classes()).toContain("border-transparent");
    rerender(<Button variant="ghost">Go</Button>);
    expect(classes()).toContain("border");
    expect(classes()).toContain("border-transparent");
  });
});
