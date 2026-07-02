import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "./alert";

describe("Alert", () => {
  it("notice tone: border-border-strong, regular-weight message, info icon", () => {
    const { getByText, container } = render(
      <Alert tone="notice">That doesn&apos;t look like an email yet. Check the spelling?</Alert>
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-border-strong");
    const message = getByText(
      "That doesn't look like an email yet. Check the spelling?"
    );
    expect(message.className).not.toContain("font-semibold");
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("error tone: border-error + border-2, semibold message, alert icon", () => {
    const { getByText, container } = render(
      <Alert tone="error">Something needs your attention before you can continue.</Alert>
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-error");
    expect(card.className).toContain("border-2");
    const message = getByText(
      "Something needs your attention before you can continue."
    );
    expect(message.className).toContain("font-semibold");
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("success tone: regular-weight message, circle-check icon", () => {
    const { getByText, container } = render(
      <Alert tone="success">You&apos;re all set.</Alert>
    );
    const message = getByText("You're all set.");
    expect(message.className).not.toContain("font-semibold");
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders children copy for all three tones", () => {
    const { getByText, rerender } = render(<Alert tone="notice">Notice copy</Alert>);
    expect(getByText("Notice copy")).not.toBeNull();
    rerender(<Alert tone="error">Error copy</Alert>);
    expect(getByText("Error copy")).not.toBeNull();
    rerender(<Alert tone="success">Success copy</Alert>);
    expect(getByText("Success copy")).not.toBeNull();
  });
});
