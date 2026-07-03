import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

let searchParamsValue = new URLSearchParams({ email: "ada@example.com" });
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
}));

const resendMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { resend: resendMock } }),
}));

import CheckInboxPage from "./page";

describe("CheckInboxPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchParamsValue = new URLSearchParams({ email: "ada@example.com" });
  });

  it("contains useSearchParams, a Suspense wrapper, and an Alert with tone=notice (source gate)", () => {
    const source = readFileSync(resolve(__dirname, "./page.tsx"), "utf-8");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("Suspense");
    expect(source).toContain('tone="notice"');
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

  it("after a successful resend shows an Alert tone=notice, never navigating away", async () => {
    resendMock.mockResolvedValueOnce({ error: null });
    render(<CheckInboxPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() => expect(resendMock).toHaveBeenCalledTimes(1));
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "ada@example.com",
    });
    await waitFor(() =>
      expect(
        screen.getByText("Sent again. Check your inbox.")
      ).toBeInTheDocument()
    );
    expect(screen.getByText("Check your inbox")).toBeInTheDocument();
  });

  it("a failed resend (e.g. rate limit) shows a calm notice instead of false success", async () => {
    resendMock.mockResolvedValueOnce({
      error: { code: "over_email_send_rate_limit", message: "rate limit" },
    });
    render(<CheckInboxPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() =>
      expect(
        screen.getByText("That didn't send — give it a minute and try again.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText("Sent again. Check your inbox.")).toBeNull();
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
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("submitting the form (not just clicking) calls the signup resend once", async () => {
    resendMock.mockResolvedValueOnce({ error: null });
    const { container } = render(<CheckInboxPage />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(resendMock).toHaveBeenCalledTimes(1));
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "ada@example.com",
    });
  });

  it("the notice row is mounted before any submit, hidden rather than absent (layout-stability contract)", () => {
    const { container } = render(<CheckInboxPage />);

    // The row exists in the DOM from first render — it must never mount/
    // unmount, only toggle visibility, so the centered card never resizes.
    const noticeRow = container.querySelector('[aria-live="polite"]');
    expect(noticeRow).not.toBeNull();
    expect(noticeRow).toHaveClass("invisible");
    expect(noticeRow).toHaveAttribute("aria-hidden", "true");
  });

  it("showing a notice reveals the same persistent row instead of inserting a new element", async () => {
    resendMock.mockResolvedValueOnce({ error: null });
    const { container } = render(<CheckInboxPage />);

    const noticeRowBefore = container.querySelector('[aria-live="polite"]');
    expect(noticeRowBefore).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));

    await waitFor(() =>
      expect(
        screen.getByText("Sent again. Check your inbox.")
      ).toBeInTheDocument()
    );

    const noticeRowAfter = container.querySelector('[aria-live="polite"]');
    expect(noticeRowAfter).toBe(noticeRowBefore);
    expect(noticeRowAfter).not.toHaveClass("invisible");
    expect(noticeRowAfter).not.toHaveAttribute("aria-hidden");
  });
});
