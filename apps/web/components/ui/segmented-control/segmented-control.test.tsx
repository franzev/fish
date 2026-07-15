import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

describe("SegmentedControl", () => {
  it("exposes one labeled group and its selected value", () => {
    render(
      <SegmentedControl
        label="Appearance"
        value="system"
        options={[
          { label: "System", value: "system" },
          { label: "Light", value: "light" },
        ]}
        onValueChange={() => undefined}
      />
    );

    expect(screen.getByRole("group", { name: "Appearance" })).toBeVisible();
    expect(screen.getByRole("button", { name: "System" })).toHaveClass(
      "min-h-control",
      "min-w-control"
    );
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("reports the chosen typed value", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        label="Reduced motion"
        value={null}
        options={[
          { label: "System", value: null },
          { label: "On", value: true },
        ]}
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "On" }));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});
