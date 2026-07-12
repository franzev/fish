import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { startCallMock, useCallMock } = vi.hoisted(() => ({
  startCallMock: vi.fn(async () => undefined),
  useCallMock: vi.fn(),
}));

vi.mock("../call-provider", () => ({ useCall: useCallMock }));

import { CallEntryAction } from "./call-entry-action";

describe("CallEntryAction", () => {
  beforeEach(() => {
    startCallMock.mockClear();
    useCallMock.mockReturnValue({
      startCall: startCallMock,
      busy: false,
      notice: null,
    });
  });

  it("keeps voice primary and offers video as the secondary action", async () => {
    render(
      <CallEntryAction
        recipientId="coach-1"
        recipientName="Coach Mina"
        label="Call Coach Mina"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Call Coach Mina" }));
    await waitFor(() => {
      expect(startCallMock).toHaveBeenCalledWith(
        "coach-1",
        "Coach Mina",
        "audio"
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Video call Coach Mina" })
    );
    await waitFor(() => {
      expect(startCallMock).toHaveBeenCalledWith(
        "coach-1",
        "Coach Mina",
        "video"
      );
    });
  });
});
