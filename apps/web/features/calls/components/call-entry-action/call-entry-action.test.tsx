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

  it("groups equally quiet audio and video controls in the paired presentation", () => {
    render(
      <CallEntryAction
        recipientId="friend-1"
        recipientName="Sam Okafor"
        label="Audio call"
        variant="secondary"
        presentation="paired"
      />
    );

    const group = screen.getByRole("group", { name: "Call Sam Okafor" });
    expect(group).toHaveClass("grid-cols-2");
    expect(screen.getByRole("button", { name: "Audio call" })).toHaveClass(
      "bg-surface-2"
    );
    expect(
      screen.getByRole("button", { name: "Video call Sam Okafor" })
    ).toHaveClass("bg-surface-2");
  });
});
