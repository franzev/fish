import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StickerMedia } from "./sticker-media";

describe("StickerMedia", () => {
  it("resolves a bundled sticker at the shared render size", () => {
    render(<StickerMedia stickerId="aquatic-hello-otter" />);

    const sticker = screen.getByRole("img", { name: /sea otter/i });
    expect(decodeURIComponent(sticker.getAttribute("src") ?? "")).toContain(
      "/stickers/aquatic/hello-otter.webp"
    );
    expect(sticker).toHaveClass("size-sticker-tile");
    expect(sticker).toHaveAttribute("width", "96");
    expect(sticker).toHaveAttribute("height", "96");
  });

  it("renders transcript stickers at the compact message size", () => {
    render(<StickerMedia stickerId="aquatic-see-you-soon-turtle" />);

    const sticker = screen.getByRole("img", { name: /sea turtle/i });
    expect(sticker).toHaveClass("size-sticker-tile");
    expect(sticker).toHaveAttribute("width", "96");
    expect(sticker).toHaveAttribute("height", "96");
  });
});
