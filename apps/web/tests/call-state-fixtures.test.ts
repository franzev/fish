import fixtures from "@fish/core/call-state/fixtures/call-state-vectors.json";
import {
  reduceCallState,
  type CallEvent,
  type CallState,
} from "@fish/core/call-state";
import { describe, expect, it } from "vitest";

describe("portable call-state fixtures", () => {
  it("replays every shared vector", () => {
    expect(fixtures).toHaveLength(6);
    for (const fixture of fixtures) {
      const actual = (fixture.events as CallEvent[]).reduce(
        reduceCallState,
        fixture.initialState as CallState
      );
      expect(actual, fixture.name).toEqual(fixture.expectedState);
    }
  });
});
