import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientChatGif } from "@/lib/services";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import { GifPicker } from "./gif-picker";

const gif: ClientChatGif = {
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
};

function provider(overrides: Partial<GifProvider> = {}): GifProvider {
  return {
    name: "KLIPY",
    available: true,
    trending: vi.fn(async () => ({ gifs: [gif], next: null })),
    search: vi.fn(async () => ({ gifs: [gif], next: null })),
    registerShare: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("GifPicker", () => {
  it("loads trending GIFs and returns the chosen item without sending it", async () => {
    const onSelect = vi.fn();
    render(<GifPicker provider={provider()} onSelect={onSelect} />);

    const choice = await screen.findByRole("button", { name: `Choose ${gif.description}` });
    fireEvent.click(choice);

    expect(onSelect).toHaveBeenCalledWith(gif, "");
    expect(screen.getByText("Powered by KLIPY")).toBeInTheDocument();
  });

  it("debounces phrase search and preserves punctuation", async () => {
    const search = vi.fn(async () => ({ gifs: [gif], next: null }));
    render(<GifPicker provider={provider({ search })} onSelect={() => undefined} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search GIFs" }), {
      target: { value: "bruh?!" },
    });

    await waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
      query: "bruh?!",
      cursor: null,
    })), { timeout: 1000 });
  });

  it("shows a calm unavailable state when the provider is not configured", async () => {
    render(<GifPicker provider={provider({
      available: false,
      trending: vi.fn(async () => { throw new Error("not configured"); }),
    })} onSelect={() => undefined} />);

    expect(await screen.findByText("GIF search is taking a break. Your message is still here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
