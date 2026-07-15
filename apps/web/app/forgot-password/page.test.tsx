import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { requestPasswordResetMock } = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
}));
vi.mock("@/features/auth", () => ({
  requestPasswordReset: requestPasswordResetMock,
}));

import ForgotPasswordPage from "./page";

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one primary Button in the source file (grep gate)", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "./_components/forgot-password-form/forgot-password-form.tsx"
      ),
      "utf-8"
    );
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(source).toContain("fullWidth={true}");
  });

  it("does not smuggle next=/reset-password through a redirectTo query string", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "./_components/forgot-password-form/forgot-password-form.tsx"
      ),
      "utf-8"
    );
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

  it("uses the forgot-password illustration in the shared auth panel", () => {
    const { container } = render(<ForgotPasswordPage />);
    const illustration = container.querySelector("img");

    expect(illustration).toHaveAttribute(
      "src",
      expect.stringContaining("forgot-password-reset.svg")
    );
    expect(illustration).toHaveAttribute("alt", "");
    expect(illustration).not.toHaveClass("opacity-20", "saturate-0");
  });

  it("uses the shared blue accent and fair skin palette", () => {
    const svg = readFileSync(
      resolve(process.cwd(), "public/illustrations/forgot-password-reset.svg"),
      "utf-8"
    );

    expect(svg).toContain("#90CAF9");
    expect(svg).not.toMatch(/#92E3A9/i);
    expect(svg).toContain("#FFE2D3");
    expect(svg).toContain("#F1BFAE");
    expect(svg).toMatch(
      /<path d="M136\.74,[^>]*style="fill:#FFE2D3"/
    );
    expect(svg).toMatch(
      /<path d="M236\.07,[^>]*style="fill:#F1BFAE"/
    );
    expect(svg).toMatch(
      /<path d="M132\.61,[^>]*style="fill:#FFE2D3"/
    );
    expect(svg).not.toMatch(
      /<path d="M236\.07,[^>]*style="fill:#90CAF9"/
    );
    expect(svg).not.toMatch(
      /<path d="M132\.61,[^>]*style="fill:#fff"/
    );
  });

  it("renders one email Input", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("provides a way back to sign in", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });

  it("calls resetPasswordForEmail with the email and no redirectTo option", async () => {
    requestPasswordResetMock.mockResolvedValueOnce({ ok: true, data: undefined });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(requestPasswordResetMock).toHaveBeenCalledWith("ada@example.com")
    );
  });

  it("shows the identical success copy after submit for any email (D-07, no enumeration)", async () => {
    requestPasswordResetMock.mockResolvedValueOnce({ ok: true, data: undefined });
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
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });
});
