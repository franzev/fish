import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipIconButton } from "./tooltip-icon-button";

describe("TooltipIconButton", () => {
  it("shares its accessible name with a square control and forwards its ref", () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(
      <TooltipIconButton
        ref={ref}
        label="Mute"
        icon={<span aria-hidden="true">M</span>}
        onClick={onClick}
      />
    );

    const button = screen.getByRole("button", { name: "Mute" });
    expect(ref.current).toBe(button);
    expect(button).toHaveClass("size-control", "min-h-control");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
