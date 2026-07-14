import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import { MediaPickerButton } from "./media-picker-button";

const provider: GifProvider = {
  name: "KLIPY",
  available: true,
  trending: vi.fn(async () => ({ gifs: [], next: null })),
  search: vi.fn(async () => ({ gifs: [], next: null })),
  registerShare: vi.fn(async () => undefined),
};

const callbacks = {
  onSelectEmoji: vi.fn(),
  onSelectGif: vi.fn(),
  onSelectSticker: vi.fn(),
};

describe("MediaPickerButton", () => {
  it("uses a shared touch target and closes after a sticker is selected", async () => {
    const onSelectSticker = vi.fn();
    render(
      <MediaPickerButton
        {...callbacks}
        onSelectSticker={onSelectSticker}
        defaultTab="sticker"
        gifProvider={provider}
      />
    );

    const trigger = screen.getByRole("button", { name: "Add emoji, GIF, or sticker" });
    expect(trigger).toHaveClass("size-control", "min-h-control");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Add Thank you sticker" }));

    expect(onSelectSticker).toHaveBeenCalledWith(expect.objectContaining({
      id: "aquatic-thank-you-octopus",
    }));
    await waitFor(() => expect(
      screen.queryByRole("dialog", { name: "Choose emoji, GIF, or sticker" })
    ).toBeNull());
  });
});
