import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddMenu } from "./add-menu";

describe("AddMenu", () => {
  it("opens a menu with the three composer actions", () => {
    render(<AddMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));

    expect(
      screen.getByRole("menuitem", { name: "Add files" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Audio Recording" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Create Poll" })
    ).toBeInTheDocument();
  });

  it.each(["Add files", "Audio Recording", "Create Poll"])(
    "lets %s be clicked without raising an error",
    (itemName) => {
      render(<AddMenu />);

      fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
      expect(() =>
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }))
      ).not.toThrow();
    }
  );

  it("passes selected files to the composer", () => {
    const onSelectImages = vi.fn();
    render(<AddMenu onSelectImages={onSelectImages} />);
    const file = new File(["image"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose files"), {
      target: { files: [file] },
    });
    expect(onSelectImages).toHaveBeenCalledWith([file]);
  });
});
