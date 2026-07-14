import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { aquaticStickers } from "./sticker-catalog";
import { StickerPicker } from "./sticker-picker";

describe("StickerPicker", () => {
  it("keeps the default pack in a compact three-column grid", () => {
    render(<StickerPicker onSelect={() => undefined} />);

    expect(screen.getByTestId("sticker-grid")).toHaveClass("grid-cols-3");
    expect(screen.getAllByRole("button", { name: /^Add .* sticker$/ })).toHaveLength(32);
    expect(screen.getByRole("button", { name: "Add Hello! sticker" })).toHaveClass(
      "size-sticker-tile"
    );
    expect(screen.getByRole("img", { name: /sea otter/i })).toHaveClass("size-sticker-tile");
  });

  it("uses one unique animal for every default sticker", () => {
    const animals = aquaticStickers.map((sticker) => sticker.animal);

    expect(new Set(animals).size).toBe(animals.length);
  });

  it("searches the sample pack and returns the selected sticker", () => {
    const onSelect = vi.fn();
    render(<StickerPicker onSelect={onSelect} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search stickers" }), {
      target: { value: "sleep" },
    });

    expect(screen.getByRole("button", { name: "Add Good night sticker" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Thank you sticker" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add Good night sticker" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: "aquatic-good-night-whale",
      phrase: "Good night",
    }));
  });

  it("filters the samples by style", () => {
    render(<StickerPicker onSelect={() => undefined} />);

    const expressiveFilter = screen.getByRole("button", { name: "Expressive" });
    expect(expressiveFilter.querySelector("svg")).toBeInTheDocument();
    expect(expressiveFilter).not.toHaveTextContent("Expressive");
    fireEvent.click(expressiveFilter);

    expect(screen.getByRole("button", { name: "Add Great job sticker" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Good night sticker" })).toBeNull();
    expect(expressiveFilter).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a Base UI tooltip when a style receives focus", async () => {
    render(<StickerPicker onSelect={() => undefined} />);

    fireEvent.focus(screen.getByRole("button", { name: "Expressive" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Expressive");
  });
});
