import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./composer";

const baseProps = {
  channelName: "general",
  draft: "",
  canSend: false,
  onDraftChange: vi.fn(),
  onSend: vi.fn(),
  onKeyDown: vi.fn(),
  onBlur: vi.fn(),
  onSelectEmoji: vi.fn(),
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

  it("keeps Send visible but disabled while an attachment is preparing", () => {
    const file = new File(["image"], "photo.png", { type: "image/png" });
    render(<Composer
      {...baseProps}
      images={[{
        clientUploadId: "upload-1",
        file,
        kind: "image",
        sourceMimeType: "image/png",
        previewUrl: "blob:preview",
        progress: 0.5,
        status: "uploading",
      }]}
      canSend={false}
    />);

    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("keeps the image, GIF, sticker, and + menu affordances visible", () => {
    render(<Composer {...baseProps} />);

    expect(
      screen.getByRole("button", { name: "Add a GIF" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add a sticker" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
    expect(
      screen.getByRole("menuitem", { name: "Add files" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Audio Recording" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Create Poll" })
    ).toBeInTheDocument();
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
