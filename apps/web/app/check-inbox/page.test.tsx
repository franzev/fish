import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

let searchParamsValue = new URLSearchParams({ email: "ada@example.com" });
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
}));

const { resendSignupEmailMock } = vi.hoisted(() => ({
  resendSignupEmailMock: vi.fn(),
}));
vi.mock("@/lib/auth/browser", () => ({
  resendSignupEmail: resendSignupEmailMock,
}));

import CheckInboxPage from "./page";

describe("CheckInboxPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchParamsValue = new URLSearchParams({ email: "ada@example.com" });
  });

  it("contains useSearchParams and a Suspense wrapper (source gate)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("Suspense");
  });

  it("renders the 'Check your inbox' heading", () => {
    render(<CheckInboxPage />);
    expect(screen.getByText("Check your inbox")).toBeInTheDocument();
  });

  it("interpolates the email from the search param into the body", () => {
    render(<CheckInboxPage />);
    expect(
      screen.getByText(
        "We sent a link to ada@example.com. Open it on this device to continue."
      )
    ).toBeInTheDocument();
  });

  it("renders exactly one primary Button in the source file (grep gate)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    const matches = source.match(/variant="primary"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(source).toContain("fullWidth={true}");
  });

  it("renders exactly one primary button via an RTL role query", () => {
    render(<CheckInboxPage />);
    const buttons = screen.getAllByRole("button");
    const primaryButtons = buttons.filter((b) =>
      b.className.includes("bg-primary")
    );
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]).toHaveTextContent("Resend the email");
  });

  it("after a successful resend shows a success-tone Alert, never navigating away", async () => {
    resendSignupEmailMock.mockResolvedValueOnce({ ok: true, data: undefined });
    const { container } = render(<CheckInboxPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() => expect(resendSignupEmailMock).toHaveBeenCalledTimes(1));
    expect(resendSignupEmailMock).toHaveBeenCalledWith("ada@example.com");
    await waitFor(() =>
      expect(
        screen.getByText("Sent again. Check your inbox.")
      ).toBeInTheDocument()
    );
    expect(screen.getByText("Check your inbox")).toBeInTheDocument();
    const alertBox = container.querySelector('[aria-live="polite"] > div');
    expect(alertBox?.className).toContain("border-success");
    expect(alertBox?.className).toContain("animate-fade-in");
  });

  it("a failed resend (e.g. rate limit) shows a calm warning-tone notice instead of false success", async () => {
    resendSignupEmailMock.mockResolvedValueOnce({
      ok: false,
      error: { message: "rate limit", details: {} },
    });
    const { container } = render(<CheckInboxPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() =>
      expect(
        screen.getByText("That didn't send — give it a minute and try again.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText("Sent again. Check your inbox.")).toBeNull();
    const alertBox = container.querySelector('[aria-live="polite"] > div');
    expect(alertBox?.className).toContain("border-warning");
  });

  it("with no ?email= param the resend button is disabled and the copy stays generic", () => {
    searchParamsValue = new URLSearchParams();
    render(<CheckInboxPage />);

    expect(
      screen.getByText("We sent you a link. Open it on this device to continue.")
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Resend the email" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(resendSignupEmailMock).not.toHaveBeenCalled();
  });

  it("submitting the form (not just clicking) calls the signup resend once", async () => {
    resendSignupEmailMock.mockResolvedValueOnce({ ok: true, data: undefined });
    const { container } = render(<CheckInboxPage />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(resendSignupEmailMock).toHaveBeenCalledTimes(1));
    expect(resendSignupEmailMock).toHaveBeenCalledWith("ada@example.com");
  });

  it("the live region is mounted before any submit, with no alert inside until there is something to say (overlay contract)", () => {
    const { container } = render(<CheckInboxPage />);

    // The aria-live region exists from first render (so announcements are
    // never missed), but the Alert itself is NOT mounted until a notice
    // exists — the overlay is out of document flow, so the card never
    // resizes whether or not an alert is showing.
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.querySelector("div")).toBeNull();
  });

  it("the card wrapper stays relative and the notice overlay is positioned out of flow above it, and fades in", async () => {
    resendSignupEmailMock.mockResolvedValueOnce({ ok: true, data: undefined });
    const { container } = render(<CheckInboxPage />);

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
});
