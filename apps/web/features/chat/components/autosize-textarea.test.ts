import { describe, expect, it } from "vitest";
import { resizeAutosizeTextarea } from "./autosize-textarea";

describe("resizeAutosizeTextarea", () => {
  it("fits short content and enables scrolling for content over the viewport", () => {
    const textarea = document.createElement("textarea");
    Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: 120 });
    Object.defineProperty(textarea, "clientHeight", { configurable: true, value: 120 });
    resizeAutosizeTextarea(textarea);
    expect(textarea.style.height).toBe("120px");
    expect(textarea.style.overflowY).toBe("hidden");

    Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: 220 });
    Object.defineProperty(textarea, "clientHeight", { configurable: true, value: 160 });
    resizeAutosizeTextarea(textarea);
    expect(textarea.style.overflowY).toBe("auto");
  });
});
