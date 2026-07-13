import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { signInWithGoogleMock, signInWithPasswordMock } = vi.hoisted(() => ({
  signInWithGoogleMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
}));
vi.mock("@/features/auth", () => ({
  getAuthFailureReason: (error: { details?: { reason?: string } }) =>
    error.details?.reason,
  signInWithGoogle: signInWithGoogleMock,
  signInWithPassword: signInWithPasswordMock,
}));

import { SignInForm } from "./sign-in-form";

describe("SignInForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one primary Button in the source file (grep gate)", () => {
    const source = readFileSync(resolve(__dirname, "./sign-in-form.tsx"), "utf-8");
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(source).toContain("fullWidth={true}");
  });

  it("renders exactly one primary button via an RTL role query", () => {
    render(<SignInForm />);
    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Sign in");
  });

  it("hides Google sign-in unless it is explicitly configured", () => {
    render(<SignInForm />);
    expect(
      screen.queryByRole("button", { name: "Continue with Google" })
    ).not.toBeInTheDocument();
  });

  it("uses a page-level heading for the sign-in screen", () => {
    render(<SignInForm />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in" })
    ).toBeInTheDocument();
  });

  it("renders two Inputs (email, password)", () => {
    render(<SignInForm />);
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("adds autofill and enter-key hints that reduce typing effort", () => {
    render(<SignInForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "email"
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "enterkeyhint",
      "next"
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password"
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "enterkeyhint",
      "go"
    );
  });

  it("lets the user reveal and hide the password without leaving the field", () => {
    render(<SignInForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("renders the Google action as a quiet alternative, keeping one primary button", () => {
    render(<SignInForm showGoogleAuth />);
    const googleButton = screen.getByRole("button", {
      name: "Continue with Google",
    });
    expect(googleButton.className).toContain("bg-transparent");
    expect(googleButton.className).toContain("text-muted");
    expect(googleButton.className).not.toContain("w-full");
    expect(googleButton.className).not.toContain("bg-primary");
    expect(googleButton.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("renders two sibling links and two total buttons", () => {
    render(<SignInForm showGoogleAuth />);
    expect(
      screen.getByRole("link", { name: "Create account" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Forgot your password?" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" })
    ).toBeInTheDocument();
  });

  it("starts Google sign-in from the secondary action", async () => {
    signInWithGoogleMock.mockResolvedValueOnce({ ok: true, data: undefined });
    render(<SignInForm showGoogleAuth />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(signInWithGoogleMock).toHaveBeenCalledTimes(1));
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("a failed Google sign-in start shows calm form-level copy", async () => {
    signInWithGoogleMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "auth", message: "provider unavailable", details: {} },
    });
    render(<SignInForm showGoogleAuth />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Couldn't start Google sign-in. Check your connection and try again."
        )
      ).toBeInTheDocument()
    );
  });

  it("a successful sign-in redirects to /home", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ ok: true, data: undefined });
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
      })
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
  });

  it("keeps the submit action loading while the authenticated page loads", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ ok: true, data: undefined });
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("disables the submit action while password sign-in is in flight", async () => {
    let resolveSignIn: (value: { ok: true; data: undefined }) => void = () => {};
    signInWithPasswordMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      })
    );
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled()
    );

    resolveSignIn({ ok: true, data: undefined });
  });

  it("an 'Email not confirmed' error redirects to /check-inbox with the email param", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "auth", message: "Email not confirmed", details: {} },
    });
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/check-inbox?email=ada%40example.com"
      )
    );
    expect(
      screen.queryByText("That email and password don't match. Try again?")
    ).toBeNull();
  });

  it("a bad-credentials error shows the field-level copy, never revealing which field", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "auth", message: "Invalid login credentials", details: {} },
    });
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(
        screen.getByText("That email and password don't match. Try again?")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText("Invalid login credentials")).toBeNull();
    expect(pushMock).not.toHaveBeenCalledWith("/home");
  });

  it("a bad-credentials error renders in the tier-1 notice treatment, not the tier-2 error treatment", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "auth", message: "Invalid login credentials", details: {} },
    });
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const message = await screen.findByText(
      "That email and password don't match. Try again?"
    );
    expect(message.className).not.toContain("font-semibold");
  });

  it("the stable email_not_confirmed error code routes to /check-inbox even if the message wording drifts", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "auth",
        message: "some future wording",
        details: { reason: "emailNotConfirmed" },
      },
    });
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/check-inbox?email=ada%40example.com"
      )
    );
  });

  it("a thrown network failure shows connection copy, never the bad-credentials copy", async () => {
    signInWithPasswordMock.mockRejectedValueOnce(new Error("fetch failed"));
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Couldn't reach the server. Check your connection and try again."
        )
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByText("That email and password don't match. Try again?")
    ).toBeNull();
  });

  it("a service-level transport failure shows connection copy, never bad-credentials copy", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "network", message: "fetch failed", details: {} },
    });
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Couldn't reach the server. Check your connection and try again."
        )
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByText("That email and password don't match. Try again?")
    ).toBeNull();
  });
});
