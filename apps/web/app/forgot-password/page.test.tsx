import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const resetPasswordForEmailMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail: resetPasswordForEmailMock },
  }),
}));

import ForgotPasswordPage from "./page";

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one primary Button in the source file (grep gate)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("does not smuggle next=/reset-password through a redirectTo query string", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    expect(source).not.toContain("next=/reset-password");
  });

  it("renders exactly one primary button via an RTL role query", () => {
    render(<ForgotPasswordPage />);
    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Send reset link");
  });

  it("renders one email Input", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("calls resetPasswordForEmail with the email and no redirectTo option", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
        "ada@example.com"
      )
    );
  });

  it("shows the identical success copy after submit for any email (D-07, no enumeration)", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "unknown@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "If that address has an account, a reset link is on its way."
        )
      ).toBeInTheDocument()
    );
    // Success replaces the form in place — no separate "no account" state.
    expect(screen.queryByLabelText("Email")).toBeNull();
  });
});
