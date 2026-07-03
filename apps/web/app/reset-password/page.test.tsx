import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const updateUserMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser: updateUserMock } }),
}));

import ResetPasswordPage from "./page";

describe("ResetPasswordPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one primary Button in the source file (grep gate)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("renders exactly one primary button via an RTL role query", () => {
    render(<ResetPasswordPage />);
    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Set new password");
  });

  it("renders one password Input with the 8-char hint", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
  });

  it("calls updateUser on submit and redirects to /home", async () => {
    updateUserMock.mockResolvedValueOnce({ error: null });
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "new-password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Set new password" })
    );

    await waitFor(() =>
      expect(updateUserMock).toHaveBeenCalledWith({
        password: "new-password123",
      })
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
  });
});
