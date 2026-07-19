import { describe, expect, it } from "vitest";
import { heartbeatActivityState, heartbeatRetryDelay } from "./heartbeat-policy";

describe("presence heartbeat policy", () => {
  it("uses the calm 5/10/30 second retry progression", () => {
    expect([0, 1, 2, 4].map(heartbeatRetryDelay)).toEqual([5_000, 10_000, 30_000, 30_000]);
  });

  it("writes when returning online and after idle activity", () => {
    expect(heartbeatActivityState("online", 10_000, 9_900).shouldWrite).toBe(true);
    expect(heartbeatActivityState("activity", 10_000, 9_900, 1_000).shouldWrite).toBe(false);
    expect(heartbeatActivityState("activity", 10_000, 8_000, 1_000).shouldWrite).toBe(true);
  });
});
