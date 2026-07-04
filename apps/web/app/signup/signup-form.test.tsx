import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { signUpWithPasswordMock } = vi.hoisted(() => ({
  signUpWithPasswordMock: vi.fn(),
}));
vi.mock("@/lib/auth/browser", () => ({
  getAuthErrorCode: (error: { details?: { supabaseCode?: string } }) =>
    error.details?.supabaseCode,
  signUpWithPassword: signUpWithPasswordMock,
}));

import { SignupForm } from "./signup-form";

describe("SignupForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one primary Button in the source file (grep gate)", () => {
    const source = readFileSync(resolve(__dirname, "./signup-form.tsx"), "utf-8");
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(source).toContain("fullWidth={true}");
  });

  it("renders exactly one primary button via an RTL role query", () => {
    render(<SignupForm />);
    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Create account");
  });

  it("renders three Inputs (name, email, password)", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows the password hint 'At least 8 characters.'", () => {
    render(<SignupForm />);
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
  });

  it("submitting calls the browser client's auth.signUp", async () => {
    // Real confirmations-on shape for a NEW user: user present with a
    // populated identities array.
    signUpWithPasswordMock.mockResolvedValueOnce({
      ok: true,
      data: { userId: "user-1", identityCount: 1 },
    });
    render(<SignupForm />);

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

    await waitFor(() => expect(signUpWithPasswordMock).toHaveBeenCalledTimes(1));
    expect(signUpWithPasswordMock).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "password123",
      displayName: "Ada",
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
    signUpWithPasswordMock.mockResolvedValueOnce({
      ok: true,
      data: { userId: "user-1", identityCount: 0 },
    });
    render(<SignupForm />);

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
    signUpWithPasswordMock.mockResolvedValueOnce({
      ok: false,
      error: {
        message: "some future wording",
        details: { supabaseCode: "user_already_exists" },
      },
    });
    render(<SignupForm />);

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
    signUpWithPasswordMock.mockResolvedValueOnce({
      ok: false,
      error: { message: "User already registered", details: {} },
    });
    render(<SignupForm />);

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
