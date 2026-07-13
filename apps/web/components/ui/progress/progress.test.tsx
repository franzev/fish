import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

describe("Progress", () => {
  it("renders the ARIA progressbar triad and a value-driven fill width", () => {
    const { getByRole } = render(<Progress value={40} label="Step 2 of 5" />);
    const bar = getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAccessibleName("Step 2 of 5");
    const fill = bar.firstChild as HTMLElement;
    expect(fill.style.width).toBe("40%");
  });

  it("never renders a bare numeric percentage as a judgement", () => {
    const { queryByText } = render(<Progress value={40} label="Step 2 of 5" />);
    expect(queryByText("40%")).toBeNull();
  });

  it("supports a compact rail with a visually hidden label", () => {
    const { getByRole, getByText } = render(
      <Progress value={20} label="Uploading file" labelVisuallyHidden density="compact" />
    );

    expect(getByRole("progressbar")).toHaveClass("h-3xs");
    expect(getByRole("progressbar")).toHaveAttribute("data-density", "compact");
    expect(getByText("Uploading file")).toHaveClass("sr-only");
  });

  it.each([
    { value: -10, expected: "0" },
    { value: 110, expected: "100" },
  ])("clamps $value to the supported range", ({ value, expected }) => {
    const { getByRole } = render(<Progress value={value} />);

    expect(getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      expected
    );
  });
});
