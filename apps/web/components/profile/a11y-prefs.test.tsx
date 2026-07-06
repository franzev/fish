import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    delete document.documentElement.dataset.timeFormat;
  });

  it("renders the four profile preference controls", () => {
    render(
      <A11yPrefs
        themePref={null}
        textSizePref={null}
        reducedMotionPref={null}
        timeFormatPref={null}
      />
    );

    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(4);
    expect(screen.getByRole("group", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Text size" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Reduced motion" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Time format" })).toBeInTheDocument();
  });

  it("keeps segmented preference buttons at the 56px FISH control target", () => {
    const source = readFileSync(resolve(__dirname, "./a11y-prefs.tsx"), "utf-8");

    expect(source).toContain("min-h-control");
    expect(source).not.toMatch(/min-h-\[[^\]]+\]/);
  });

  it("defaults theme and reduced-motion to the system option when the prop is null", () => {
    render(
      <A11yPrefs
        themePref={null}
        textSizePref={null}
        reducedMotionPref={null}
        timeFormatPref={null}
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
        timeFormatPref={null}
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
        timeFormatPref={null}
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
      timeFormatPref: null,
    });
  });

  it("applies and persists a selected time format immediately", async () => {
    render(
      <A11yPrefs
        themePref={null}
        textSizePref={null}
        reducedMotionPref={null}
        timeFormatPref={null}
      />
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "Time format" })).getByRole(
        "button",
        { name: "24 hr" }
      )
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.timeFormat).toBe("24h");
    });
    expect(updatePrefsActionMock).toHaveBeenLastCalledWith({
      themePref: null,
      textSizePref: "default",
      reducedMotionPref: null,
      timeFormatPref: "24h",
    });
  });

  it("can clear stored preferences back to system/null (PROF-03)", async () => {
    render(
      <A11yPrefs
        themePref="dark"
        textSizePref="large"
        reducedMotionPref={true}
        timeFormatPref="12h"
      />
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.dataset.textSize).toBe("large");
      expect(document.documentElement.dataset.reducedMotion).toBe("true");
      expect(document.documentElement.dataset.timeFormat).toBe("12h");
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
      timeFormatPref: "12h",
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
      timeFormatPref: "12h",
    });

    fireEvent.click(
      within(screen.getByRole("group", { name: "Time format" })).getByRole(
        "button",
        { name: "System" }
      )
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.timeFormat).toBeUndefined();
    });
    expect(updatePrefsActionMock).toHaveBeenLastCalledWith({
      themePref: null,
      textSizePref: "large",
      reducedMotionPref: null,
      timeFormatPref: null,
    });
  });
});
