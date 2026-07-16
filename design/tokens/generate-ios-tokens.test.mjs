import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  camelize,
  oklchToSrgb,
  renderColorSwift,
  renderTokensSwift,
} from "./generate-ios-tokens.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("./fish.tokens.json", import.meta.url), "utf8"),
);

test("OKLCH white converts to sRGB white", () => {
  const { r, g, b } = oklchToSrgb([1, 0, 0, 1]);
  assert.ok(
    Math.abs(r - 1) < 1e-4
      && Math.abs(g - 1) < 1e-4
      && Math.abs(b - 1) < 1e-4,
  );
});

test("OKLCH black converts to sRGB black", () => {
  const { r, g, b } = oklchToSrgb([0, 0, 0, 1]);
  assert.ok(r < 1e-6 && g < 1e-6 && b < 1e-6);
});

test("achromatic OKLCH yields equal channels and preserves alpha", () => {
  const { r, g, b, a } = oklchToSrgb([0.5, 0, 0, 0.4]);
  assert.ok(Math.abs(r - g) < 1e-9 && Math.abs(g - b) < 1e-9);
  assert.equal(a, 0.4);
  assert.ok(r > 0.3 && r < 0.5);
});

test("lightness is monotonic", () => {
  const at = (lightness) => oklchToSrgb([lightness, 0, 0, 1]).r;
  assert.ok(at(0.2) < at(0.5) && at(0.5) < at(0.8));
});

test("camelize spells leading digits and joins hyphens", () => {
  assert.equal(camelize("surface-2"), "surface2");
  assert.equal(camelize("3xs"), "threeXs");
  assert.equal(camelize("2xl"), "twoXl");
  assert.equal(camelize("on-primary"), "onPrimary");
  assert.equal(camelize("message-outgoing-container"), "messageOutgoingContainer");
});

test("Swift rendering is deterministic and uses the iOS platform values", () => {
  const colors = renderColorSwift(manifest);
  assert.equal(colors, renderColorSwift(manifest));
  assert.match(colors, /do not edit/i);
  assert.match(colors, /static let bg/);
  assert.match(colors, /static let messageOutgoingContainer/);

  const values = renderTokensSwift(manifest);
  assert.match(values, /enum Spacing/);
  assert.match(values, /static let threeXs: CGFloat = 2/);
  assert.match(values, /static let targetTouch: CGFloat = 44/);
  assert.match(values, /enum ChatRules/);
});
