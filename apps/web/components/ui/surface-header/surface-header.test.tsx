import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SurfaceHeader } from "./surface-header";

describe("SurfaceHeader", () => {
  it("keeps context and its single action in stable regions", () => {
    render(
      <SurfaceHeader
        title={<h2>Messages</h2>}
        description="Your recent conversations"
        action={<button type="button">Close</button>}
      />
    );

    const heading = screen.getByRole("heading", { name: "Messages" });
    expect(heading).toBeVisible();
    expect(heading.parentElement).toHaveClass(
      "font-serif",
      "text-heading-sm",
      "font-semibold",
      "text-foreground"
    );
    expect(screen.getByText("Your recent conversations")).toBeVisible();
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
  });
});
