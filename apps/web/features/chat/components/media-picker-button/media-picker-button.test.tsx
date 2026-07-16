import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const originalMatchMedia = window.matchMedia;

describe("MediaPickerButton", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

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

  it("becomes a focus-trapped mobile sheet with an explicit close control", async () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    render(<MediaPickerButton {...callbacks} gifProvider={provider} />);
    fireEvent.click(screen.getByRole("button", {
      name: "Add emoji, GIF, or sticker",
    }));

    const close = await screen.findByRole("button", {
      name: "Close expression picker",
    });
    await waitFor(() => expect(close).toHaveFocus());
    expect(close.closest("[data-side]")?.parentElement).toHaveClass(
      "media-picker-positioner"
    );
    fireEvent.click(close);
    await waitFor(() => expect(
      screen.queryByRole("dialog", { name: "Choose emoji, GIF, or sticker" })
    ).toBeNull());
  });
});
