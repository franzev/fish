import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAutofocus } from "./use-desktop-autofocus";

const originalMatchMedia = window.matchMedia;

function mockDesktop(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query === "(min-width: 48rem)" && matches,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function Harness() {
  const ref = useDesktopAutofocus<HTMLInputElement>();
  return <input ref={ref} aria-label="Email" />;
}

describe("useDesktopAutofocus", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("focuses the first field on desktop", () => {
    mockDesktop(true);
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveFocus();
  });

  it("leaves focus unchanged on mobile", () => {
    mockDesktop(false);
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveFocus();
  });
});
