import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PresenceIndicator } from "./presence-indicator";

describe("PresenceIndicator", () => {
  it.each([
    ["online", "text-presence-online"],
    ["idle", "text-presence-idle"],
    ["away", "text-presence-away"],
    ["busy", "text-presence-busy"],
    ["offline", "text-presence-offline"],
    ["invisible", "text-presence-offline"],
  ] as const)("renders a named, shape-coded %s state", (status, colorClass) => {
    render(<PresenceIndicator status={status} label={status} />);
    expect(screen.getByLabelText(status)).toHaveClass(colorClass);
    expect(screen.getByLabelText(status).querySelector("svg")).toBeInTheDocument();
  });
});
