import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./composer";

const baseProps = {
  channelName: "general",
  draft: "",
  canSend: false,
  localRecording: false,
  onDraftChange: vi.fn(),
  onSend: vi.fn(),
  onKeyDown: vi.fn(),
  onBlur: vi.fn(),
  onToggleRecording: vi.fn(),
  onSelectEmoji: vi.fn(),
  onStub: vi.fn(),
};

describe("Composer", () => {
  it("names the channel in the placeholder", () => {
    render(<Composer {...baseProps} />);
    expect(screen.getByPlaceholderText("Message #general")).toBeInTheDocument();
  });

  it("hides the Send button while the draft is empty", () => {
    render(<Composer {...baseProps} canSend={false} />);
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
  });

  it("shows the Send button once there is something to send", () => {
    render(<Composer {...baseProps} draft="Hello" canSend />);
    expect(
      screen.getByRole("button", { name: "Send message" })
    ).toBeInTheDocument();
  });

  it("routes the GIF and sticker affordances through onStub", () => {
    const onStub = vi.fn();
    render(<Composer {...baseProps} onStub={onStub} />);

    fireEvent.click(screen.getByRole("button", { name: "Add a GIF" }));
    expect(onStub).toHaveBeenCalledWith("GIFs");

    fireEvent.click(screen.getByRole("button", { name: "Add a sticker" }));
    expect(onStub).toHaveBeenCalledWith("Stickers");
  });

  it("reports draft changes from the textarea", () => {
    const onDraftChange = vi.fn();
    render(<Composer {...baseProps} onDraftChange={onDraftChange} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
      target: { value: "Typing away" },
    });

    expect(onDraftChange).toHaveBeenCalledWith("Typing away");
  });
});
