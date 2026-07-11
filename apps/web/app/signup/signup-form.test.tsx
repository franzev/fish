import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { signInWithGoogleMock, signUpWithPasswordMock } = vi.hoisted(() => ({
  signInWithGoogleMock: vi.fn(),
  signUpWithPasswordMock: vi.fn(),
}));
vi.mock("@/features/auth", () => ({
  getAuthErrorCode: (error: { details?: { supabaseCode?: string } }) =>
    error.details?.supabaseCode,
  signInWithGoogle: signInWithGoogleMock,
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

  it("renders four Inputs (name, email, password, confirm password)", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Confirm password"), {
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

  it("blocks account creation when confirm password does not match", async () => {
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
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "password456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("Passwords don't match yet.")
    ).toBeInTheDocument();
    expect(signUpWithPasswordMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("starts Google sign-up from the secondary action", async () => {
    signInWithGoogleMock.mockResolvedValueOnce({ ok: true, data: undefined });
    render(<SignupForm />);

    fireEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));

    await waitFor(() => expect(signInWithGoogleMock).toHaveBeenCalledTimes(1));
    expect(signUpWithPasswordMock).not.toHaveBeenCalled();
  });

  it("renders the Google action as secondary, keeping one primary button", () => {
    render(<SignupForm />);

    const googleButton = screen.getByRole("button", { name: "Sign up with Google" });
    expect(googleButton.className).toContain("bg-surface");
    expect(googleButton.className).not.toContain("bg-primary");
    expect(googleButton.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
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
    fireEvent.change(screen.getByLabelText("Confirm password"), {
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
    fireEvent.change(screen.getByLabelText("Confirm password"), {
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
    fireEvent.change(screen.getByLabelText("Confirm password"), {
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
