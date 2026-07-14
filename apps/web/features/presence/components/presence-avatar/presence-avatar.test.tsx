import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PresenceAvatar } from "./presence-avatar";

describe("PresenceAvatar", () => {
  it("keeps every status indicator inside the avatar's bottom-right corner", () => {
    render(
      <PresenceAvatar
        name="Coach Patty"
        status="online"
        statusLabel="Online"
        size="sm"
      />
    );

    expect(screen.getByLabelText("Online").parentElement).toHaveClass(
      "absolute",
      "bottom-0",
      "right-0",
      "z-10"
    );
    expect(screen.getByLabelText("Online").parentElement).not.toHaveClass(
      "p-3xs",
      "translate-x-1/2",
      "translate-y-1/2"
    );
  });
});
