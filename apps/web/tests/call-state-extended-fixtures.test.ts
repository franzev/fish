import fixtures from "@fish/core/call-state/fixtures/call-state-vectors.extended.json";
import {
  reduceCallState,
  selectCanMute,
  selectHasLiveCall,
  type CallEvent,
  type CallState,
} from "@fish/core/call-state";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type ExtendedFixture = {
  name: string;
  initialState: CallState;
  events: unknown[];
  expectedState: CallState;
  expectedSelectors?: { hasLiveCall?: boolean; canMute?: boolean };
};

const repoRoot = join(__dirname, "..", "..", "..");
const canonicalFixtureDir = join(
  repoRoot,
  "packages/core/src/call-state/fixtures"
);
const bundledFixtureDir = join(
  repoRoot,
  "apps/ios/FishKit/Sources/TestSupport/Resources"
);

describe("portable call-state extended fixtures", () => {
  it("replays every extended vector including selector expectations", () => {
    const cases = fixtures as ExtendedFixture[];
    expect(cases.length).toBeGreaterThanOrEqual(21);

    for (const fixture of cases) {
      const actual = (fixture.events as CallEvent[]).reduce(
        reduceCallState,
        fixture.initialState
      );
      expect(actual, fixture.name).toEqual(fixture.expectedState);

      if (fixture.expectedSelectors?.hasLiveCall !== undefined) {
        expect(selectHasLiveCall(actual), `${fixture.name} hasLiveCall`).toBe(
          fixture.expectedSelectors.hasLiveCall
        );
      }
      if (fixture.expectedSelectors?.canMute !== undefined) {
        expect(selectCanMute(actual), `${fixture.name} canMute`).toBe(
          fixture.expectedSelectors.canMute
        );
      }
    }
  });

  // The iOS test bundle replays byte-identical copies of the shared vectors
  // (SPM tests cannot read outside the package), so a fixture change cannot
  // land without re-syncing the native conformance suite.
  it.each([
    "call-state-vectors.json",
    "call-state-vectors.extended.json",
  ])("keeps the bundled iOS copy of %s in sync", (fileName) => {
    const canonical = readFileSync(join(canonicalFixtureDir, fileName), "utf8");
    const bundled = readFileSync(join(bundledFixtureDir, fileName), "utf8");
    expect(bundled).toBe(canonical);
  });
});
