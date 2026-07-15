import { fireEvent, render, screen } from "@testing-library/react";
import { IconArchive } from "@tabler/icons-react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("uses its required label as the accessible name", () => {
    render(<IconButton label="Archive conversation" icon={<IconArchive />} />);

    expect(
      screen.getByRole("button", { name: "Archive conversation" })
    ).toBeInTheDocument();
  });

  it("keeps the standard control target and shared glyph contract", () => {
    render(<IconButton label="Archive" icon={<IconArchive />} />);

    expect(screen.getByRole("button", { name: "Archive" })).toHaveClass(
      "size-control",
      "min-h-control",
      "icon-button-glyph"
    );
  });

  it("supports compact pointer-first controls with a named size token", () => {
    render(
      <IconButton size="compact" label="Archive" icon={<IconArchive />} />
    );

    expect(screen.getByRole("button", { name: "Archive" })).toHaveClass(
      "size-search-control",
      "min-h-search-control"
    );
  });

  it("owns notice, critical, overlay, disabled, and loading states", () => {
    const { rerender } = render(
      <IconButton
        appearance="overlay"
        tone="notice"
        label="Archive"
        icon={<IconArchive />}
      />
    );
    expect(screen.getByRole("button", { name: "Archive" })).toHaveClass(
      "bg-scrim",
      "text-notice"
    );

    rerender(
      <IconButton
        tone="critical"
        loading
        label="End call"
        icon={<IconArchive />}
      />
    );
    const button = screen.getByRole("button", { name: "End call" });
    expect(button).toHaveClass("bg-error", "text-on-primary");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("forwards its ref and activation handler", () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <IconButton
        ref={ref}
        label="Archive"
        icon={<IconArchive />}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(ref.current).toBe(screen.getByRole("button", { name: "Archive" }));
  });

  it("preserves link semantics for icon navigation", () => {
    render(
      <IconButton
        href="/home"
        label="Back to home"
        icon={<IconArchive />}
      />
    );

    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/home"
    );
  });
});
