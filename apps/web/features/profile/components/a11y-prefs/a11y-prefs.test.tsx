import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { updatePrefsActionMock } = vi.hoisted(() => ({
  updatePrefsActionMock: vi.fn(async () => undefined),
}));
vi.mock("@/features/profile/server/actions", () => ({
  updatePrefsAction: updatePrefsActionMock,
}));

import { A11yPrefs } from "./a11y-prefs";

describe("A11yPrefs", () => {
  afterEach(() => {
    updatePrefsActionMock.mockClear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.reducedMotion;
    delete document.documentElement.dataset.timeFormat;
  });

  it("renders the four profile preference controls", () => {
    render(
      <A11yPrefs
        themePref={null}
        reducedMotionPref={null}
        timeFormatPref={null}
      />
    );

    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(3);
    expect(screen.getByRole("group", { name: "Appearance" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Reduced motion" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Time format" })).toBeInTheDocument();
  });

  it("keeps segmented preference buttons at the default interaction target", () => {
    render(
      <A11yPrefs
        themePref={null}
        reducedMotionPref={null}
        timeFormatPref={null}
      />
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("min-h-control");
      expect(button.className).not.toMatch(/min-h-\[[^\]]+\]/);
    }
  });

  it("defaults theme and reduced-motion to the system option when the prop is null", () => {
    render(
      <A11yPrefs
        themePref={null}
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

  it("applies and persists a selected preference immediately (PROF-03)", async () => {
    render(
      <A11yPrefs
        themePref={null}
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
      reducedMotionPref: null,
      timeFormatPref: null,
    });
  });

  it("applies and persists a selected time format immediately", async () => {
    render(
      <A11yPrefs
        themePref={null}
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
      reducedMotionPref: null,
      timeFormatPref: "24h",
    });
  });

  it("can clear stored preferences back to system/null (PROF-03)", async () => {
    render(
      <A11yPrefs
        themePref="dark"
        reducedMotionPref={true}
        timeFormatPref="12h"
      />
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
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
      reducedMotionPref: null,
      timeFormatPref: null,
    });
  });

  it("surfaces calm retry guidance when persistence fails", async () => {
    updatePrefsActionMock.mockRejectedValueOnce(new Error("offline"));
    render(
      <A11yPrefs
        themePref={null}
        reducedMotionPref={null}
        timeFormatPref={null}
      />
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "Appearance" })).getByRole(
        "button",
        { name: "Dark" }
      )
    );

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent("That preference couldn’t be saved");
  });
});
