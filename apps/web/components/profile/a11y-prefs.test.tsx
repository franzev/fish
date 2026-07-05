import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { updatePrefsActionMock } = vi.hoisted(() => ({
  updatePrefsActionMock: vi.fn(async () => undefined),
}));
vi.mock("@/app/(authenticated)/profile/edit/actions", () => ({
  updatePrefsAction: updatePrefsActionMock,
}));

import { A11yPrefs } from "./a11y-prefs";

describe("A11yPrefs", () => {
  afterEach(() => {
    updatePrefsActionMock.mockClear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.textSize;
    delete document.documentElement.dataset.reducedMotion;
  });

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

  it("applies and persists a selected preference immediately (PROF-03)", async () => {
    render(
      <A11yPrefs
        themePref={null}
        textSizePref={null}
        reducedMotionPref={null}
      />
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "Appearance" })).getByRole(
        "button",
        { name: "Light" }
      )
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });
    expect(updatePrefsActionMock).toHaveBeenLastCalledWith({
      themePref: "light",
      textSizePref: "default",
      reducedMotionPref: null,
    });
  });

  it("can clear stored preferences back to system/null (PROF-03)", async () => {
    render(
      <A11yPrefs
        themePref="dark"
        textSizePref="large"
        reducedMotionPref={true}
      />
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.dataset.textSize).toBe("large");
      expect(document.documentElement.dataset.reducedMotion).toBe("true");
    });

    fireEvent.click(
      within(screen.getByRole("group", { name: "Appearance" })).getByRole(
        "button",
        { name: "System" }
      )
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBeUndefined();
    });
    expect(updatePrefsActionMock).toHaveBeenLastCalledWith({
      themePref: null,
      textSizePref: "large",
      reducedMotionPref: true,
    });

    fireEvent.click(
      within(screen.getByRole("group", { name: "Reduced motion" })).getByRole(
        "button",
        { name: "System" }
      )
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.reducedMotion).toBeUndefined();
    });
    expect(updatePrefsActionMock).toHaveBeenLastCalledWith({
      themePref: null,
      textSizePref: "large",
      reducedMotionPref: null,
    });
  });
});
