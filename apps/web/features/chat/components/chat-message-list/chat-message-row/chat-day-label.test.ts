import { describe, expect, it } from "vitest";
import { formatChatDayLabel } from "./chat-day-label";

describe("formatChatDayLabel", () => {
  const now = new Date(2026, 6, 15, 12);

  it("labels the current local calendar day", () => {
    expect(
      formatChatDayLabel(new Date(2026, 6, 15, 8).toISOString(), now)
    ).toBe("Today");
  });

  it("labels the previous local calendar day", () => {
    expect(
      formatChatDayLabel(new Date(2026, 6, 14, 20).toISOString(), now)
    ).toBe("Yesterday");
  });

  it("uses an English full date for earlier days", () => {
    expect(
      formatChatDayLabel(new Date(2026, 6, 10, 8).toISOString(), now)
    ).toBe("July 10, 2026");
  });
});
