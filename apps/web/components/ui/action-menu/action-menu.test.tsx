import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ActionMenuItem,
  ActionMenuPopup,
  ActionMenuRoot,
  ActionMenuTrigger,
} from "./action-menu";

describe("ActionMenu", () => {
  it("owns popup and item styling while preserving selection behavior", () => {
    const onClick = vi.fn();
    render(
      <ActionMenuRoot>
        <ActionMenuTrigger>Actions</ActionMenuTrigger>
        <ActionMenuPopup>
          <ActionMenuItem onClick={onClick}>Archive</ActionMenuItem>
        </ActionMenuPopup>
      </ActionMenuRoot>
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const item = screen.getByRole("menuitem", { name: "Archive" });
    expect(item).toHaveClass("min-h-control", "rounded-control");
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
