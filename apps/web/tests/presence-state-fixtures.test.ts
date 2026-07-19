import fixtures from "@fish/core/presence/state/fixtures/presence-state-vectors.json";
import {
  createInitialPresenceState,
  reducePresenceState,
  type PresenceEvent,
  type PresenceState,
} from "@fish/core/presence";
import { describe, expect, it } from "vitest";

interface PresenceFixture {
  name: string;
  initialState: PresenceState;
  events: PresenceEvent[];
  expectedState: PresenceState;
}

describe("portable presence-state fixtures", () => {
  it("replays every presence state vector", () => {
    for (const fixture of fixtures as PresenceFixture[]) {
      const actual = fixture.events.reduce(reducePresenceState, fixture.initialState);
      expect(actual, fixture.name).toEqual(fixture.expectedState);
    }
  });

  it("keeps the canonical fixture set non-empty and replayable from the default state", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
    expect(createInitialPresenceState()).toEqual({
      snapshots: {},
      preferenceSetting: { preference: "automatic", expiresAt: null },
      preferenceRevision: 0,
      pendingPreference: null,
    });
  });
});
