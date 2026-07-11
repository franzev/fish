import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AddMenu } from "./add-menu";

describe("AddMenu", () => {
  it("opens a menu with the three composer actions", () => {
    render(<AddMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Add to message" }));

    expect(
      screen.getByRole("menuitem", { name: "Upload File" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Audio Recording" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Create Poll" })
    ).toBeInTheDocument();
  });

  it.each(["Upload File", "Audio Recording", "Create Poll"])(
    "lets %s be clicked without raising an error",
    (itemName) => {
      render(<AddMenu />);

      fireEvent.click(screen.getByRole("button", { name: "Add to message" }));
      expect(() =>
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }))
      ).not.toThrow();
    }
  );
});
