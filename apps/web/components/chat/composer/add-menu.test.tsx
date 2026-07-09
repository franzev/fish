import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddMenu } from "./add-menu";

const baseProps = {
  onUploadFile: vi.fn(),
  onAudioRecording: vi.fn(),
  onCreatePoll: vi.fn(),
  recording: false,
};

describe("AddMenu", () => {
  it("opens a menu with the three composer actions", () => {
    render(<AddMenu {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));

    expect(
      screen.getByRole("menuitem", { name: "Upload File" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Audio Recording" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Create Poll" })
    ).toBeInTheDocument();
  });

  it.each([
    ["Upload File", "onUploadFile"],
    ["Audio Recording", "onAudioRecording"],
    ["Create Poll", "onCreatePoll"],
  ] as const)("fires the callback for %s", (itemName, callbackName) => {
    const callbacks = {
      onUploadFile: vi.fn(),
      onAudioRecording: vi.fn(),
      onCreatePoll: vi.fn(),
    };
    render(<AddMenu {...baseProps} {...callbacks} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
    fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

    expect(callbacks[callbackName]).toHaveBeenCalledTimes(1);
  });

  it("reflects the active recording state on the trigger", () => {
    const { rerender } = render(<AddMenu {...baseProps} recording={false} />);
    const trigger = screen.getByRole("button", { name: "Add to message" });
    expect(trigger.className).not.toContain("bg-surface-2");

    rerender(<AddMenu {...baseProps} recording />);
    expect(trigger.className).toContain("bg-surface-2");
  });
});
