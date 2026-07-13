import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmojiPicker } from "./emoji-picker";

describe("EmojiPicker", () => {
  it("uses the shared popup border for the panel and category divider", () => {
    render(<EmojiPicker onSelect={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "Choose an emoji" })).toHaveClass(
      "border",
      "border-divider"
    );
    expect(screen.getByRole("tablist")).toHaveClass(
      "border-t",
      "border-divider"
    );
  });
});
