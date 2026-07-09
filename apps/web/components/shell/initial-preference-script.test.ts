import { describe, expect, it } from "vitest";
import { createInitialPreferenceScript } from "./initial-preference-script";

describe("createInitialPreferenceScript", () => {
  it("sets persisted preferences before the shell hydrates", () => {
    const script = createInitialPreferenceScript({
      themePref: "dark",
      textSizePref: "larger",
      reducedMotionPref: true,
      timeFormatPref: "24h",
    });

    Function(script)();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.textSize).toBe("larger");
    expect(document.documentElement.dataset.reducedMotion).toBe("true");
    expect(document.documentElement.dataset.timeFormat).toBe("24h");
  });

  it("clears system/default preferences so the browser can choose immediately", () => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.textSize = "large";
    document.documentElement.dataset.reducedMotion = "true";
    document.documentElement.dataset.timeFormat = "12h";

    const script = createInitialPreferenceScript({
      themePref: null,
      textSizePref: "default",
      reducedMotionPref: null,
      timeFormatPref: null,
    });

    Function(script)();

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.textSize).toBeUndefined();
    expect(document.documentElement.dataset.reducedMotion).toBeUndefined();
    expect(document.documentElement.dataset.timeFormat).toBeUndefined();
  });
});

