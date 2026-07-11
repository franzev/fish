import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("reveals and hides the password with an accessible pressed state", () => {
    render(<PasswordInput label="Password" defaultValue="practice" />);
    const input = screen.getByLabelText("Password");

    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("forwards its ref to the password field", () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} label="Password" />);

    expect(ref.current).toBe(screen.getByLabelText("Password"));
  });
});
