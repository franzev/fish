import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingChatImage } from "@/features/chat/hooks/use-chat-image-uploads";
import { ImageUploadPreview } from "./image-upload-preview";

function pending(overrides: Partial<PendingChatImage> = {}): PendingChatImage {
  return {
    kind: "image",
    sourceMimeType: "image/png",
    clientUploadId: "upload-1",
    file: new File(["image"], "photo.png", { type: "image/png" }),
    previewUrl: "blob:preview",
    progress: 0.5,
    status: "uploading",
    ...overrides,
  };
}

describe("ImageUploadPreview", () => {
  it("shows quiet linear upload progress and removal", () => {
    const remove = vi.fn();
    render(<ImageUploadPreview images={[pending()]} onRemove={remove} onRetry={vi.fn()} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-density", "compact");
    expect(screen.getByRole("progressbar")).toHaveClass("h-3xs");
    expect(screen.queryByText("Preparing")).not.toBeInTheDocument();
    expect(screen.queryByText("Uploading")).not.toBeInTheDocument();
    const removeButton = screen.getByRole("button", { name: "Remove photo.png" });
    expect(removeButton).toHaveClass("min-h-control", "min-w-control");
    expect(removeButton.firstElementChild).toHaveClass("size-lg");
    fireEvent.click(removeButton);
    expect(remove).toHaveBeenCalledWith("upload-1");
  });

  it("opens retry and calm remove actions from a failed preview", () => {
    const retry = vi.fn();
    const remove = vi.fn();
    render(<ImageUploadPreview images={[pending({ status: "failed" })]} onRemove={remove} onRetry={retry} />);
    const trigger = screen.getByRole("button", { name: "Upload failed for photo.png. Show options" });
    expect(trigger.parentElement).toHaveClass("border-notice");
    expect(screen.queryByText("Not uploaded yet")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    const retryAction = screen.getByRole("menuitem", { name: "Retry" });
    expect(retryAction.parentElement).toHaveClass("w-max");
    expect(retryAction.parentElement).not.toHaveClass("min-w-menu");
    expect(retryAction.parentElement?.parentElement).toHaveAttribute("data-align", "end");
    fireEvent.click(retryAction);
    expect(retry).toHaveBeenCalledWith("upload-1");
    fireEvent.click(trigger);
    const removeAction = screen.getByRole("menuitem", { name: "Remove" });
    expect(removeAction).toHaveClass("text-body", "min-h-control");
    fireEvent.click(removeAction);
    expect(remove).toHaveBeenCalledWith("upload-1");
    expect(screen.getByAltText("Preview of image to send")).toBeInTheDocument();
  });

  it("wraps multiple previews and removes only the selected image", () => {
    const remove = vi.fn();
    const images = [
      pending({ clientUploadId: "first", file: new File(["1"], "first.png", { type: "image/png" }), status: "ready" }),
      pending({ clientUploadId: "second", file: new File(["2"], "second.png", { type: "image/png" }), status: "ready" }),
      pending({ clientUploadId: "third", file: new File(["3"], "third.png", { type: "image/png" }), status: "ready" }),
    ];
    render(<ImageUploadPreview images={images} onRemove={remove} onRetry={vi.fn()} />);

    expect(screen.getByRole("list", { name: "Files to send" })).toHaveClass("flex-wrap", "justify-start");
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove second.png" }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("second");
  });

  it("keeps one image at the compact composer preview size", () => {
    render(<ImageUploadPreview images={[pending({ status: "ready" })]} onRemove={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByRole("listitem")).toHaveClass("w-chat-image-preview");
  });

});
