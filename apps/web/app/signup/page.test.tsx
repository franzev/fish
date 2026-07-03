import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const signUpMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signUp: signUpMock } }),
}));

import SignupPage from "./page";

describe("SignupPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one primary Button in the source file (grep gate)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("renders exactly one primary button via an RTL role query", () => {
    render(<SignupPage />);
    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Create account");
  });

  it("renders three Inputs (name, email, password)", () => {
    render(<SignupPage />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows the password hint 'At least 8 characters.'", () => {
    render(<SignupPage />);
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
  });

  it("submitting calls the browser client's auth.signUp", async () => {
    // Real confirmations-on shape for a NEW user: user present with a
    // populated identities array.
    signUpMock.mockResolvedValueOnce({
      data: { user: { identities: [{ id: "identity-1" }] } },
      error: null,
    });
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(signUpMock).toHaveBeenCalledTimes(1));
    expect(signUpMock).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "password123",
      options: { data: { display_name: "Ada" } },
    });
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/check-inbox?email=ada%40example.com"
      )
    );
  });

  it("an existing confirmed email (confirmations-on: fake user, empty identities, no error) shows the existing-email copy and never routes to /check-inbox", async () => {
    // With enable_confirmations = true, Supabase anti-enumeration returns
    // error: null plus an obfuscated user whose identities array is empty —
    // and sends no email. This is the branch production actually takes.
    signUpMock.mockResolvedValueOnce({
      data: { user: { identities: [] } },
      error: null,
    });
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "That email's already in use. Try logging in instead?"
        )
      ).toBeInTheDocument()
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("the stable user_already_exists error code shows the existing-email copy even if the message wording drifts", async () => {
    signUpMock.mockResolvedValueOnce({
      error: { code: "user_already_exists", message: "some future wording" },
    });
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "That email's already in use. Try logging in instead?"
        )
      ).toBeInTheDocument()
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("an 'already registered' error (confirmations-off environments) shows the existing-email Input error copy, not a raw message", async () => {
    signUpMock.mockResolvedValueOnce({
      error: { message: "User already registered" },
    });
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "That email's already in use. Try logging in instead?"
        )
      ).toBeInTheDocument()
    );
    expect(screen.queryByText("User already registered")).toBeNull();
  });
});
