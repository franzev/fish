import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmojiPicker } from "./emoji-picker";
import { EmojiPickerButton } from "./emoji-picker-button";

describe("EmojiPicker", () => {
  it("keeps the category icon row at the bottom", () => {
    render(<EmojiPicker onSelect={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "Choose an emoji" })).toHaveClass(
      "border",
      "border-divider"
    );
    expect(screen.getByRole("tablist")).toHaveClass(
      "border-t-0"
    );
    expect(screen.getByRole("tablist").parentElement).toHaveClass(
      "border-t",
      "border-divider"
    );
    expect(document.querySelector("[data-slot='emoji-category-label']")).toHaveTextContent(
      "Smileys & Emotion"
    );
    expect(screen.getByRole("tab", { name: "Animals & Nature" })).not.toHaveTextContent(
      "Animals & Nature"
    );
  });

  it("keeps emoji targets at least five calm columns on narrow phones", () => {
    render(<EmojiPicker onSelect={() => undefined} />);

    const firstEmoji = screen.getAllByRole("button")[0];
    expect(firstEmoji?.parentElement).toHaveClass(
      "grid-cols-5",
      "sm:grid-cols-6"
    );
    expect(firstEmoji).toHaveClass("min-h-target-touch", "w-full");
  });

  it("shows a Base UI tooltip when a category receives focus", async () => {
    render(<EmojiPicker onSelect={() => undefined} />);

    fireEvent.focus(screen.getByRole("tab", { name: "Animals & Nature" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Animals & Nature");
  });

  it("labels its icon trigger with a tooltip without breaking the popover", async () => {
    render(
      <EmojiPickerButton label="Add a reaction" onSelect={() => undefined} />
    );

    const trigger = screen.getByRole("button", { name: "Add a reaction" });
    fireEvent.focus(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Add a reaction"
    );

    fireEvent.click(trigger);
    expect(
      await screen.findByRole("dialog", { name: "Choose an emoji" })
    ).toBeInTheDocument();
  });
});
