import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import { MediaPicker, MediaPickerButton } from "./media-picker";

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

describe("MediaPicker", () => {
  it("shares one dialog and search layout across emoji, GIF, and sticker tabs", () => {
    render(<MediaPicker {...callbacks} gifProvider={provider} />);

    expect(screen.getByRole("dialog", { name: "Choose emoji, GIF, or sticker" })).toBeInTheDocument();
    const typeTabs = within(
      screen.getByRole("tablist", { name: "Expression type" })
    );
    expect(typeTabs.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "😀Emoji",
      "🎞️GIFs",
      "🦀Stickers",
    ]);

    expectSharedPickerSearch("Search emoji");
    fireEvent.click(screen.getByRole("tab", { name: "GIFs" }));
    expectSharedPickerSearch("Search GIFs");
    fireEvent.click(screen.getByRole("tab", { name: "Stickers" }));
    expectSharedPickerSearch("Search stickers");
    expect(screen.queryByRole("group", { name: "Sticker style" })).toBeNull();
  });

  it("uses one composer trigger and closes after a sticker is selected", async () => {
    const onSelectSticker = vi.fn();
    render(
      <MediaPickerButton
        {...callbacks}
        onSelectSticker={onSelectSticker}
        defaultTab="sticker"
        gifProvider={provider}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add emoji, GIF, or sticker" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Thank you sticker" }));

    expect(onSelectSticker).toHaveBeenCalledWith(expect.objectContaining({
      id: "aquatic-thank-you-octopus",
    }));
    await waitFor(() => expect(
      screen.queryByRole("dialog", { name: "Choose emoji, GIF, or sticker" })
    ).toBeNull());
  });
});

function expectSharedPickerSearch(name: string) {
  const search = screen.getByRole("searchbox", { name });
  expect(search).toHaveClass("rounded-control");
  expect(search.closest('[data-slot="media-picker-search"]')).toHaveClass("p-xs");
}
