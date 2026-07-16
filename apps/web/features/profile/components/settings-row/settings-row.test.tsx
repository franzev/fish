import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsRow } from "./settings-row";

describe("SettingsRow", () => {
  it("stacks an opted-in control on mobile and preserves the desktop row", () => {
    render(
      <SettingsRow
        label="Appearance"
        mobileStack
        control={<button type="button">System</button>}
      />
    );

    expect(screen.getByText("Appearance").parentElement).toHaveClass(
      "max-md:flex-col",
      "max-md:items-stretch",
      "max-md:justify-start",
      "items-center",
      "justify-between"
    );
  });
});
