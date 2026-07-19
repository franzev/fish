import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("keeps the trigger accessible", () => {
    render(
      <Tooltip label="Helpful hint">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("data-base-ui-tooltip-trigger");
  });
});
