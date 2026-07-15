import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.cookie = "fish-theme=; Path=/; Max-Age=0";
});

describe("ThemeToggle", () => {
  it("switches from light to dark and persists the visitor preference", () => {
    const { container } = render(<ThemeToggle initialTheme="light" />);

    expect(container.querySelector(".tabler-icon-sun")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("fish-theme=dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" })
    ).toBeInTheDocument();
    expect(container.querySelector(".tabler-icon-moon")).toBeInTheDocument();
  });

  it("switches from dark to light and updates the saved preference", () => {
    const { container } = render(<ThemeToggle initialTheme="dark" />);

    expect(container.querySelector(".tabler-icon-moon")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.cookie).toContain("fish-theme=light");
    expect(container.querySelector(".tabler-icon-sun")).toBeInTheDocument();
  });

  it("uses the page theme when no initial preference is provided", () => {
    document.documentElement.dataset.theme = "dark";

    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: "Switch to light mode" })
    ).toBeInTheDocument();
  });

  it("uses the system theme when the page has no explicit theme", () => {
    render(<ThemeToggle initialTheme={null} />);

    expect(
      screen.getByRole("button", { name: "Switch to dark mode" })
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
