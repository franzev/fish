import { describe, expect, it } from "vitest";
import { computeResizedBox } from "./resize-geometry";

const startRect = { x: 100, y: 50, width: 320, height: 180 };
const stage = { width: 800, height: 600 };

describe("computeResizedBox", () => {
  it("keeps the video aspect ratio while resizing from the right", () => {
    expect(computeResizedBox(
      { top: false, right: true, bottom: false, left: false },
      startRect,
      { x: 160, y: 0 },
      stage,
      160
    )).toEqual({ x: 100, y: 50, width: 480, height: 270 });
  });

  it("uses the dominant axis for corner resizing", () => {
    expect(computeResizedBox(
      { top: false, right: true, bottom: true, left: false },
      startRect,
      { x: 10, y: 100 },
      stage,
      160
    ).width).toBe(497.77777777777777);
  });

  it("clamps to the stage and minimum width", () => {
    expect(computeResizedBox(
      { top: false, right: true, bottom: false, left: false },
      startRect,
      { x: -500, y: 0 },
      stage,
      240
    )).toEqual({ x: 100, y: 50, width: 240, height: 135 });
  });
});
