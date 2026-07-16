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

  it("keeps the textarea surface transparent while focused", () => {
    render(<Composer {...baseProps} />);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveClass(
      "focus-visible:bg-transparent"
    );
  });

  it("matches the chat message text size", () => {
    render(<Composer {...baseProps} />);

    expect(screen.getByRole("textbox", { name: "Message" })).toHaveClass(
      "text-ui-md",
      "md:text-ui-sm"
    );
  });

  it("grows the textarea with its content without showing a scroll area", () => {
    render(<Composer {...baseProps} />);
    const textarea = screen.getByRole("textbox", { name: "Message" });
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(textarea, "clientHeight", {
      configurable: true,
      value: 120,
    });

    fireEvent.change(textarea, { target: { value: "A longer draft" } });

    expect(textarea).toHaveStyle({ height: "120px" });
    expect(textarea).toHaveStyle({ overflowY: "hidden" });
    expect(textarea).toHaveClass("max-h-chat-composer-max-height");
  });

  it("enables its scroll area only when content exceeds the maximum height", () => {
    render(<Composer {...baseProps} />);
    const textarea = screen.getByRole("textbox", { name: "Message" });
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 220,
    });
    Object.defineProperty(textarea, "clientHeight", {
      configurable: true,
      value: 160,
    });

    fireEvent.change(textarea, { target: { value: "A very long draft" } });

    expect(textarea).toHaveStyle({ overflowY: "auto" });
  });

  it("resizes when a saved draft is restored", () => {
    const { rerender } = render(<Composer {...baseProps} />);
    const textarea = screen.getByRole("textbox", { name: "Message" });
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 132,
    });

    rerender(<Composer {...baseProps} draft={"First line\nSecond line"} />);

    expect(textarea).toHaveStyle({ height: "132px" });
  });

  it("hides the Send button while the draft is empty", () => {
    render(<Composer {...baseProps} canSend={false} />);
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(document.querySelector("[data-slot='mobile-send-reserved-space']")).toHaveClass(
      "size-control",
      "max-md:inline-flex"
    );
  });

  it("shows the Send button once there is something to send", () => {
    render(<Composer {...baseProps} draft="Hello" canSend />);
    const sendButton = screen.getByRole("button", { name: "Send message" });

    expect(sendButton).toBeInTheDocument();
    expect(sendButton).toHaveClass(
      "size-control",
      "min-h-control",
      "px-0"
    );
    expect(sendButton).not.toHaveClass("px-md");
    expect(sendButton).not.toHaveAttribute("style");
  });

  it("keeps every action square without enlarging the first text line", () => {
    render(<Composer {...baseProps} draft="Hello" canSend />);

    expect(screen.getByRole("button", { name: "Add to message" })).toHaveClass(
      "size-control"
    );
    expect(
      screen.getByRole("button", { name: "Add emoji, GIF, or sticker" })
    ).toHaveClass("size-control");
    expect(screen.getByRole("button", { name: "Send message" })).toHaveClass(
      "size-control"
    );
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveClass(
      "h-control",
      "min-h-control",
      "pb-xs",
      "pt-sm"
    );
  });

  it("explains why Send is disabled while an attachment is uploading", async () => {
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
    const disabledReason = screen.getByLabelText(
      "Send unavailable: Still uploading your photo"
    );
    fireEvent.focus(disabledReason);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Still uploading your photo"
    );
  });

  it("explains how to resolve a failed upload before sending", async () => {
    const file = new File(["document"], "notes.pdf", { type: "application/pdf" });
    render(<Composer
      {...baseProps}
      images={[{
        clientUploadId: "upload-1",
        file,
        kind: "file",
        sourceMimeType: "application/pdf",
        previewUrl: "blob:preview",
        progress: 0.5,
        status: "failed",
      }]}
      canSend={false}
    />);

    const disabledReason = screen.getByLabelText(
      "Send unavailable: Retry or remove the upload that didn't finish"
    );
    fireEvent.focus(disabledReason);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Retry or remove the upload that didn't finish"
    );
  });

  it("previews a selected GIF and keeps sending behind the existing Send action", () => {
    const onRemoveGif = vi.fn();
    render(<Composer
      {...baseProps}
      canSend
      selectedGif={{
        provider: "klipy",
        providerId: "gif-1",
        title: "Happy cat",
        description: "A happy cat nodding",
        sourceUrl: "https://klipy.com/gifs/gif-1",
        posterUrl: "https://static.klipy.com/gif-1.jpg",
        previewUrl: "https://static.klipy.com/gif-1-tiny.mp4",
        mediaUrl: "https://static.klipy.com/gif-1.mp4",
        width: 480,
        height: 270,
      }}
      onRemoveGif={onRemoveGif}
    />);

    expect(screen.getByText("GIF selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove selected GIF" }));
    expect(onRemoveGif).toHaveBeenCalledOnce();
  });

  it("previews a bundled sticker as a removable thumbnail", () => {
    const onRemoveSticker = vi.fn();
    render(
      <Composer
        {...baseProps}
        canSend
        selectedStickerId="aquatic-hello-otter"
        onRemoveSticker={onRemoveSticker}
      />
    );

    expect(screen.getByRole("img", { name: /sea otter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
    const removeSticker = screen.getByRole("button", { name: "Remove selected sticker" });
    expect(removeSticker).toHaveClass("relative", "size-control");
    expect(screen.queryByRole("dialog", { name: "Selected sticker preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to message" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Message" }).parentElement).toHaveClass("p-xs");
    fireEvent.click(removeSticker);
    expect(onRemoveSticker).toHaveBeenCalledOnce();
  });

  it("keeps the same composer surface when sticker text is added", () => {
    render(
      <Composer
        {...baseProps}
        draft="Love this"
        canSend
        selectedStickerId="aquatic-love-you-angelfish"
      />
    );

    expect(screen.getByRole("button", { name: "Remove selected sticker" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" }).parentElement).not.toHaveClass("w-fit");
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Love this");
  });

  it("keeps one expression picker and the + menu affordance visible", () => {
    render(<Composer {...baseProps} />);

    expect(
      screen.getByRole("button", { name: "Add emoji, GIF, or sticker" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a GIF" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a sticker" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
    expect(
      screen.getByRole("menuitem", { name: "Add files" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Audio recording" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Create poll" })
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
