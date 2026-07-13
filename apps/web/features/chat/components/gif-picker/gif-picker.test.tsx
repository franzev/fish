import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

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
  it("uses the shared popup border for the panel and attribution divider", () => {
    render(<GifPicker provider={provider()} onSelect={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "Choose a GIF" })).toHaveClass(
      "border",
      "border-divider"
    );
    expect(screen.getByText("Powered by KLIPY")).toHaveClass(
      "border-t",
      "border-divider"
    );
  });

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

  it("pauses and resumes every animation in the picker", async () => {
    render(<GifPicker provider={provider()} onSelect={() => undefined} />);

    await screen.findByRole("button", { name: `Choose ${gif.description}` });
    expect(screen.getByLabelText(gif.description)).toHaveAttribute("src", gif.previewUrl);

    fireEvent.click(screen.getByRole("button", { name: "Pause GIF animations" }));
    expect(screen.getByRole("img", { name: gif.description })).toHaveAttribute(
      "src",
      gif.posterUrl
    );

    fireEvent.click(screen.getByRole("button", { name: "Play GIF animations" }));
    expect(screen.getByLabelText(gif.description)).toHaveAttribute("src", gif.previewUrl);
  });

  it("starts paused for reduced-motion users and plays only after they ask", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    render(<GifPicker provider={provider()} onSelect={() => undefined} />);

    await screen.findByRole("button", { name: `Choose ${gif.description}` });
    expect(screen.getByRole("img", { name: gif.description })).toHaveAttribute(
      "src",
      gif.posterUrl
    );

    fireEvent.click(screen.getByRole("button", { name: "Play GIF animations" }));
    expect(screen.getByLabelText(gif.description)).toHaveAttribute("src", gif.previewUrl);
  });

  it("shows a calm unavailable state when the provider is not configured", async () => {
    render(<GifPicker provider={provider({
      available: false,
      trending: vi.fn(async () => { throw new Error("not configured"); }),
    })} onSelect={() => undefined} />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "GIF search is taking a break. Your message is still here."
    ));
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("announces an empty result instead of the stale search label", async () => {
    render(<GifPicker provider={provider({
      trending: vi.fn(async () => ({ gifs: [], next: null })),
    })} onSelect={() => undefined} />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "No GIFs found. Try a simpler phrase."
    ));
  });
});
