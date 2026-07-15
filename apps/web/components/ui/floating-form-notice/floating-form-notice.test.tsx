import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloatingFormNotice } from "./floating-form-notice";

describe("FloatingFormNotice", () => {
  it("keeps an always-mounted polite live region", () => {
    const { rerender } = render(<FloatingFormNotice />);
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<FloatingFormNotice tone="warning">Try again.</FloatingFormNotice>);
    expect(screen.getByText("Try again.")).toBeVisible();
  });
});
