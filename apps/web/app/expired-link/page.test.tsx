import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

let searchParamsValue = new URLSearchParams({ email: "ada@example.com" });
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
}));

const resendMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resend: resendMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  }),
}));

import ExpiredLinkPage from "./page";

describe("ExpiredLinkPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchParamsValue = new URLSearchParams({ email: "ada@example.com" });
  });

  it("contains useSearchParams and a Suspense wrapper (source gate)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("Suspense");
  });

  it("renders the 'That link has expired' heading", () => {
    render(<ExpiredLinkPage />);
    expect(screen.getByText("That link has expired")).toBeInTheDocument();
  });

  it("renders exactly one primary Button (source grep + RTL role query)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);

    render(<ExpiredLinkPage />);
    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Resend the email");
  });

  it("pre-fills the email from the search param", () => {
    render(<ExpiredLinkPage />);
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  });

  it("default (no type param) calls the signup resend method", async () => {
    resendMock.mockResolvedValueOnce({ error: null });
    render(<ExpiredLinkPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() => expect(resendMock).toHaveBeenCalledTimes(1));
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "ada@example.com",
    });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("type=recovery selects the recovery resend method", async () => {
    searchParamsValue = new URLSearchParams({
      email: "ada@example.com",
      type: "recovery",
    });
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null });
    render(<ExpiredLinkPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() =>
      expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1)
    );
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("ada@example.com");
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("a failed resend (e.g. rate limit) shows a calm warning-tone notice instead of false success", async () => {
    resendMock.mockResolvedValueOnce({
      error: { code: "over_email_send_rate_limit", message: "rate limit" },
    });
    const { container } = render(<ExpiredLinkPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() =>
      expect(
        screen.getByText("That didn't send — give it a minute and try again.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText("Sent again. Check your inbox.")).toBeNull();
    const alertBox = container.querySelector('[aria-live="polite"] > div');
    expect(alertBox).not.toBeNull();
    expect(alertBox?.className).toContain("border-warning");
  });

  it("a successful resend shows a success-tone notice", async () => {
    resendMock.mockResolvedValueOnce({ error: null });
    const { container } = render(<ExpiredLinkPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() =>
      expect(
        screen.getByText("Sent again. Check your inbox.")
      ).toBeInTheDocument()
    );
    const alertBox = container.querySelector('[aria-live="polite"] > div');
    expect(alertBox).not.toBeNull();
    expect(alertBox?.className).toContain("border-success");
  });

  it("an empty email never fires the request and asks for the email instead", () => {
    searchParamsValue = new URLSearchParams();
    const { container } = render(<ExpiredLinkPage />);

    // The Input's `required` now gates a real click via native constraint
    // validation (requestSubmit() calls reportValidity() and aborts before
    // onSubmit runs) — that's the browser doing its job. The app-level
    // guard inside handleSubmit is defense-in-depth for a submit that
    // bypasses native validation (programmatic dispatch), so we exercise
    // it the same way: fireEvent.submit() dispatches the submit event
    // directly, without going through requestSubmit()'s validation step.
    const form = container.querySelector("form");
    fireEvent.submit(form!);

    expect(resendMock).not.toHaveBeenCalled();
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Add your email above, then resend.")
    ).toBeInTheDocument();
    const alertBox = container.querySelector('[aria-live="polite"] > div');
    expect(alertBox?.className).toContain("border-border-strong");
    expect(alertBox?.className).not.toContain("border-warning");
    expect(alertBox?.className).not.toContain("border-success");
  });

  it("pressing Enter in the email field submits the resend (keyboard submit, not just click)", async () => {
    resendMock.mockResolvedValueOnce({ error: null });
    const { container } = render(<ExpiredLinkPage />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    // Implicit form submission via Enter fires the form's submit event —
    // jsdom does not natively derive that from a keydown, so we submit the
    // form directly, matching what pressing Enter in a text field triggers.
    fireEvent.submit(form!);

    await waitFor(() => expect(resendMock).toHaveBeenCalledTimes(1));
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "ada@example.com",
    });
  });

  it("pressing Enter with type=recovery submits via the recovery resend method", async () => {
    searchParamsValue = new URLSearchParams({
      email: "ada@example.com",
      type: "recovery",
    });
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null });
    const { container } = render(<ExpiredLinkPage />);

    const form = container.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() =>
      expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1)
    );
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("ada@example.com");
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("the live region is mounted before any submit, with no alert inside until there is something to say (overlay contract)", () => {
    const { container } = render(<ExpiredLinkPage />);

    // The aria-live region exists from first render (so announcements are
    // never missed), but the Alert itself is NOT mounted until a notice
    // exists — the overlay is out of document flow, so the card never
    // resizes whether or not an alert is showing.
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.querySelector("div")).toBeNull();
  });

  it("the card wrapper stays relative and the notice overlay is positioned out of flow above it, and fades in", async () => {
    resendMock.mockResolvedValueOnce({ error: null });
    const { container } = render(<ExpiredLinkPage />);

    const card = container.querySelector(".relative");
    expect(card).not.toBeNull();

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.className).toContain("absolute");
    expect(liveRegion?.className).toContain("bottom-full");

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() =>
      expect(
        screen.getByText("Sent again. Check your inbox.")
      ).toBeInTheDocument()
    );

    const alertBox = container.querySelector('[aria-live="polite"] > div');
    expect(alertBox?.className).toContain("animate-fade-in");
  });

  it("a previous notice stays visible through the next in-flight request (no mid-flight blink-out)", async () => {
    // First attempt fails and shows the calm retry notice.
    resendMock.mockResolvedValueOnce({
      error: { code: "over_email_send_rate_limit", message: "rate limit" },
    });
    render(<ExpiredLinkPage />);
    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));
    await waitFor(() =>
      expect(
        screen.getByText("That didn't send — give it a minute and try again.")
      ).toBeInTheDocument()
    );

    // Second attempt: while it is in flight the PREVIOUS notice must still
    // be on screen (no setNotice("") blank-out), only replaced once this
    // attempt resolves.
    let resolveSecond!: (value: { error: null }) => void;
    resendMock.mockImplementationOnce(
      () => new Promise((resolve) => (resolveSecond = resolve))
    );
    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    expect(
      screen.getByText("That didn't send — give it a minute and try again.")
    ).toBeInTheDocument();

    resolveSecond({ error: null });
    await waitFor(() =>
      expect(
        screen.getByText("Sent again. Check your inbox.")
      ).toBeInTheDocument()
    );
  });
});
