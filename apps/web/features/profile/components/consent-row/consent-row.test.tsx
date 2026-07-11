import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentRow } from "./consent-row";

const { acceptConsentActionMock } = vi.hoisted(() => ({
  acceptConsentActionMock: vi.fn(async () => undefined),
}));
vi.mock("@/features/profile/server/actions", () => ({
  acceptConsentAction: acceptConsentActionMock,
}));

describe("ConsentRow", () => {
  afterEach(() => {
    acceptConsentActionMock.mockClear();
  });

  it("starts quiet when the current consent version is already accepted", () => {
    render(<ConsentRow consented consentVersion="2026-07" />);

    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /review/i })
    ).not.toBeInTheDocument();
  });

  it("records consent and settles to the accepted state (PROF-04)", async () => {
    render(<ConsentRow consented={false} consentVersion={null} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Review & accept" })
    );

    expect(acceptConsentActionMock).toHaveBeenCalledWith("2026-07");
    await waitFor(() => {
      expect(screen.getByText("Accepted")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /review/i })
    ).not.toBeInTheDocument();
  });

  it("recovers from a failed request and leaves consent retryable", async () => {
    acceptConsentActionMock.mockRejectedValueOnce(new Error("offline"));
    render(<ConsentRow consented={false} consentVersion={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Review & accept" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "That didn’t save yet"
    );
    expect(
      screen.getByRole("button", { name: "Review & accept" })
    ).toBeEnabled();
    expect(screen.queryByText("Accepted")).not.toBeInTheDocument();
  });
});
