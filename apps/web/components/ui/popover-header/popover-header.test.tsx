import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PopoverHeader } from "./popover-header";

describe("PopoverHeader", () => {
  it("renders the supplied title and actions", () => {
    render(
      <PopoverHeader
        title={<h2>Notifications</h2>}
        actions={<button type="button">Close</button>}
      />
    );

    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
