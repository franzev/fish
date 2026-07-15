import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

const reportOperationalErrorMock = vi.fn();

vi.mock("@/lib/observability/reporter", () => ({
  reportOperationalError: (...args: unknown[]) =>
    reportOperationalErrorMock(...args),
}));

describe("GlobalError", () => {
  beforeEach(() => reportOperationalErrorMock.mockClear());

  it("reports once and offers one calm recovery action", () => {
    const reset = vi.fn();
    const error = new Error("render failed");
    render(<GlobalError error={error} reset={reset} />);

    expect(reportOperationalErrorMock).toHaveBeenCalledOnce();
    expect(reportOperationalErrorMock).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        operation: "app.globalError",
        handled: false,
      })
    );
    expect(screen.getByRole("heading")).toHaveTextContent(
      "This page was interrupted"
    );
    const action = screen.getByRole("button", { name: "Try again" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(action);
    expect(reset).toHaveBeenCalledOnce();
  });
});
