import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchOption } from "./search-option";

describe("SearchOption", () => {
  it("owns listbox semantics, target size, and selected surface", () => {
    const onClick = vi.fn();
    render(
      <SearchOption selected onClick={onClick}>
        General
      </SearchOption>
    );
    const option = screen.getByRole("option", { name: "General" });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(option).toHaveClass("min-h-control", "bg-surface-3");
    fireEvent.click(option);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
