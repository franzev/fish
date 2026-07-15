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

  it("keeps compact sticker dimensions in sync with its rendered size", () => {
    render(
      <StickerMedia
        stickerId="aquatic-great-job-sea-star"
        displaySize="control"
      />
    );

    const sticker = screen.getByRole("img", { name: /sea star/i });
    expect(sticker).not.toHaveClass("size-sticker-tile");
    expect(sticker).toHaveAttribute("width", "44");
    expect(sticker).toHaveAttribute("height", "44");
  });

  it("renders a calm fallback for an unknown persisted sticker id", () => {
    render(<StickerMedia stickerId="aquatic-new-rollout-sticker" />);

    const fallback = screen.getByRole("img", { name: "Sticker unavailable" });
    expect(fallback).toHaveTextContent("Sticker unavailable");
    expect(fallback).toHaveClass("size-sticker-tile", "text-muted");
  });
});
