import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const signInWithPasswordMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  }),
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one primary Button in the source file (grep gate)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("renders exactly one primary button via an RTL role query", () => {
    render(<LoginPage />);
    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Log in");
  });

  it("renders two Inputs (email, password)", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders two sibling links and zero competing buttons", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("link", { name: "Create account" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Forgot your password?" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("a successful sign-in redirects to /home", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ error: null });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
      })
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
  });

  it("an 'Email not confirmed' error redirects to /check-inbox with the email param", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      error: { message: "Email not confirmed" },
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

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
      error: { message: "Invalid login credentials" },
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

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
      error: { message: "Invalid login credentials" },
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    const message = await screen.findByText(
      "That email and password don't match. Try again?"
    );
    expect(message.className).not.toContain("font-semibold");
  });

  it("the stable email_not_confirmed error code routes to /check-inbox even if the message wording drifts", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      error: { code: "email_not_confirmed", message: "some future wording" },
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/check-inbox?email=ada%40example.com"
      )
    );
  });

  it("a thrown network failure shows connection copy, never the bad-credentials copy", async () => {
    signInWithPasswordMock.mockRejectedValueOnce(new Error("fetch failed"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

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
