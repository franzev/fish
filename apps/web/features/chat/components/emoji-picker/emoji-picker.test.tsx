import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmojiPicker } from "./emoji-picker";

describe("EmojiPicker", () => {
  it("keeps the category icon row at the bottom", () => {
    render(<EmojiPicker onSelect={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "Choose an emoji" })).toHaveClass(
      "border",
      "border-divider"
    );
    expect(screen.getByRole("tablist")).toHaveClass(
      "border-t",
      "border-divider"
    );
    expect(screen.getByRole("tab", { name: "Animals & Nature" })).not.toHaveTextContent(
      "Animals & Nature"
    );
  });

  it("shows a Base UI tooltip when a category receives focus", async () => {
    render(<EmojiPicker onSelect={() => undefined} />);

    fireEvent.focus(screen.getByRole("tab", { name: "Animals & Nature" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Animals & Nature");
  });
});
