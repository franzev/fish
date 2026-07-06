import { afterEach, describe, expect, it } from "vitest";
import {
  applyReducedMotion,
  applyTextSize,
  applyTheme,
  applyTimeFormat,
} from "./apply-prefs";

describe("apply-prefs helpers", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.textSize;
    delete document.documentElement.dataset.reducedMotion;
    delete document.documentElement.dataset.timeFormat;
  });

  it("sets and clears the theme data attribute", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    applyTheme(null);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("sets text-size overrides and clears default/system", () => {
    applyTextSize("larger");
    expect(document.documentElement.dataset.textSize).toBe("larger");

    applyTextSize("default");
    expect(document.documentElement.dataset.textSize).toBeUndefined();

    applyTextSize("large");
    expect(document.documentElement.dataset.textSize).toBe("large");

    applyTextSize(null);
    expect(document.documentElement.dataset.textSize).toBeUndefined();
  });

  it("sets reduced-motion overrides and clears system", () => {
    applyReducedMotion(true);
    expect(document.documentElement.dataset.reducedMotion).toBe("true");

    applyReducedMotion(false);
    expect(document.documentElement.dataset.reducedMotion).toBe("false");

    applyReducedMotion(null);
    expect(document.documentElement.dataset.reducedMotion).toBeUndefined();
  });

  it("sets time-format overrides and clears system", () => {
    applyTimeFormat("24h");
    expect(document.documentElement.dataset.timeFormat).toBe("24h");

    applyTimeFormat("12h");
    expect(document.documentElement.dataset.timeFormat).toBe("12h");

    applyTimeFormat(null);
    expect(document.documentElement.dataset.timeFormat).toBeUndefined();
  });
});
