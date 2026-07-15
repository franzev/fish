import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { startCallMock, useCallMock } = vi.hoisted(() => ({
  startCallMock: vi.fn(async () => undefined),
  useCallMock: vi.fn(),
}));

vi.mock("../call-provider", () => ({ useCall: useCallMock }));

import { CallButton } from "./call-button";

describe("CallButton", () => {
  beforeEach(() => {
    startCallMock.mockClear();
    useCallMock.mockReturnValue({
      startCall: startCallMock,
      busy: false,
    });
  });

  it.each([
    ["audio", "Voice call Coach Mina"],
    ["video", "Video call Coach Mina"],
  ] as const)("starts a %s call with the visible participant", async (kind, label) => {
    render(
      <CallButton
        recipientId="coach-1"
        recipientName="Coach Mina"
        kind={kind}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() => {
      expect(startCallMock).toHaveBeenCalledWith(
        "coach-1",
        "Coach Mina",
        kind
      );
    });
  });

  it.each([
    ["audio", "Voice call Coach Mina", "Call"],
    ["video", "Video call Coach Mina", "Video"],
  ] as const)(
    "disables the labeled %s action without replacing its content while busy",
    (kind, label, content) => {
      useCallMock.mockReturnValue({
        startCall: startCallMock,
        busy: true,
      });

      render(
        <CallButton
          recipientId="coach-1"
          recipientName="Coach Mina"
          kind={kind}
          presentation="labeled"
        />
      );

      const button = screen.getByRole("button", { name: label });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(content);
      expect(button).not.toHaveAttribute("aria-busy");
    }
  );

  it("uses calm labeled controls in profile context", () => {
    render(
      <CallButton
        recipientId="coach-1"
        recipientName="Coach Mina"
        kind="audio"
        presentation="labeled"
      />
    );

    expect(
      screen.getByRole("button", { name: "Voice call Coach Mina" })
    ).toHaveTextContent("Call");
  });
});
