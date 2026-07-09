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

  it("falls back to a plain placeholder without a channel name", () => {
    render(<Composer {...baseProps} channelName={undefined} />);
    expect(screen.getByPlaceholderText("Message")).toBeInTheDocument();
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

  it("toggles recording through the + menu's Audio Recording item", () => {
    const onToggleRecording = vi.fn();
    render(<Composer {...baseProps} onToggleRecording={onToggleRecording} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Audio Recording" }));

    expect(onToggleRecording).toHaveBeenCalledTimes(1);
  });

  it("routes Upload File and Create Poll through onStub with sentence-ready labels", () => {
    const onStub = vi.fn();
    render(<Composer {...baseProps} onStub={onStub} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Upload File" }));
    expect(onStub).toHaveBeenCalledWith("File uploads");

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Create Poll" }));
    expect(onStub).toHaveBeenCalledWith("Polls");
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
