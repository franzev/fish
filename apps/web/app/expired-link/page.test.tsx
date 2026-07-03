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
});
