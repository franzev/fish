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
});
