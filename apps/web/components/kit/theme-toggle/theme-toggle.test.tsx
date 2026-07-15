import { fireEvent, render } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { KitThemeToggle } from "./theme-toggle";

/* Regression: Lightning CSS (Next/Turbopack pipeline) downlevels light-dark()
   into a prefers-color-scheme media-query polyfill, so mutating the inline
   style.colorScheme never re-resolves tokens. The toggle must instead flip a
   data attribute whose color-scheme rules live in globals.css — Lightning CSS
   compiles those rules into the matching polyfill-variable flips. */
describe("KitThemeToggle", () => {
  afterEach(() => {
    delete document.documentElement.dataset.kitTheme;
  });

  it("clicking light sets data-kit-theme=light on the html element", () => {
    const { getByRole } = render(<KitThemeToggle />);
    fireEvent.click(getByRole("button", { name: "light" }));
    expect(document.documentElement.dataset.kitTheme).toBe("light");
  });

  it("clicking dark sets data-kit-theme=dark on the html element", () => {
    const { getByRole } = render(<KitThemeToggle />);
    fireEvent.click(getByRole("button", { name: "dark" }));
    expect(document.documentElement.dataset.kitTheme).toBe("dark");
  });

  it("clicking system removes the override so the OS scheme applies again", () => {
    const { getByRole } = render(<KitThemeToggle />);
    fireEvent.click(getByRole("button", { name: "dark" }));
    fireEvent.click(getByRole("button", { name: "system" }));
    expect(document.documentElement.dataset.kitTheme).toBeUndefined();
  });

  it("marks the active option with aria-pressed", () => {
    const { getByRole } = render(<KitThemeToggle />);
    fireEvent.click(getByRole("button", { name: "light" }));
    expect(getByRole("button", { name: "light" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(getByRole("button", { name: "system" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("switching the active option never changes font weight — no width jump", () => {
    // Layout stability: a weight flip resizes the buttons on every click.
    // The active state is signalled by bg/border/text color only.
    const { getByRole } = render(<KitThemeToggle />);
    fireEvent.click(getByRole("button", { name: "light" }));
    for (const name of ["system", "light", "dark"]) {
      expect(getByRole("button", { name }).className).not.toMatch(
        /font-(medium|semibold|bold)/
      );
    }
  });
});

describe("globals.css theme-override hooks", () => {
  const css = readFileSync(
    resolve(__dirname, "../../../app/globals.css"),
    "utf-8"
  );

  it("declares stylesheet color-scheme rules for the data-kit-theme override", () => {
    // Stylesheet rules (not inline styles) so Lightning CSS's light-dark()
    // downleveling compiles them into the polyfill-variable flips.
    expect(css).toMatch(
      /html\[data-kit-theme="light"\]\s*\{\s*color-scheme:\s*light;/
    );
    expect(css).toMatch(
      /html\[data-kit-theme="dark"\]\s*\{\s*color-scheme:\s*dark;/
    );
  });

  it("does not override the authored illustration color or opacity", () => {
    expect(css).not.toContain("--illustration-opacity");
    expect(css).not.toContain("--illustration-filter");
    expect(css).not.toContain("@utility theme-illustration");
  });
});
