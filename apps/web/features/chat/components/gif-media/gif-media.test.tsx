import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ClientChatGif } from "@/lib/services";
import { GifMedia } from "./gif-media";

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

describe("GifMedia", () => {
  it("uses the small provider rendition for picker previews", () => {
    render(<GifMedia gif={gif} preview />);
    expect(screen.getByLabelText(gif.description)).toHaveAttribute("src", gif.previewUrl);
  });

  it("shows a static poster until reduced-motion users explicitly play", () => {
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

    render(<GifMedia gif={gif} allowPlaybackControl />);
    expect(screen.getByRole("img", { name: gif.description })).toHaveAttribute("src", gif.posterUrl);
    fireEvent.click(screen.getByRole("button", { name: `Play GIF: ${gif.description}` }));
    expect(screen.getByLabelText(gif.description)).toHaveAttribute("src", gif.mediaUrl);
  });

  it("lets every user pause and resume a looping message GIF", () => {
    render(<GifMedia gif={gif} allowPlaybackControl />);

    expect(screen.getByLabelText(gif.description)).toHaveAttribute("src", gif.mediaUrl);
    fireEvent.click(screen.getByRole("button", { name: `Pause GIF: ${gif.description}` }));

    expect(screen.getByRole("img", { name: gif.description })).toHaveAttribute(
      "src",
      gif.posterUrl
    );
    fireEvent.click(screen.getByRole("button", { name: `Play GIF: ${gif.description}` }));
    expect(screen.getByLabelText(gif.description)).toHaveAttribute("src", gif.mediaUrl);
  });
});
