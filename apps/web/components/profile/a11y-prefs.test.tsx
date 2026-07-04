import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(authenticated)/profile/edit/actions", () => ({
  updatePrefsAction: vi.fn(async () => undefined),
}));

import { A11yPrefs } from "./a11y-prefs";

describe("A11yPrefs", () => {
  it("renders exactly three preference controls (PROF-03 cap)", () => {
    render(
      <A11yPrefs
        themePref={null}
        textSizePref={null}
        reducedMotionPref={null}
      />
    );

    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(3);
    expect(screen.getByRole("group", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Text size" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Reduced motion" })
    ).toBeInTheDocument();
  });

  it("defaults theme and reduced-motion to the system option when the prop is null", () => {
    render(
      <A11yPrefs
        themePref={null}
        textSizePref={null}
        reducedMotionPref={null}
      />
    );

    const themeGroup = screen.getByRole("group", { name: "Appearance" });
    expect(
      within(themeGroup).getByRole("button", { name: "System" })
    ).toHaveAttribute("aria-pressed", "true");

    const motionGroup = screen.getByRole("group", { name: "Reduced motion" });
    expect(
      within(motionGroup).getByRole("button", { name: "System" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("defaults text size to Default when the prop is null", () => {
    render(
      <A11yPrefs
        themePref={null}
        textSizePref={null}
        reducedMotionPref={null}
      />
    );

    const textSizeGroup = screen.getByRole("group", { name: "Text size" });
    expect(
      within(textSizeGroup).getByRole("button", { name: "Default" })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
