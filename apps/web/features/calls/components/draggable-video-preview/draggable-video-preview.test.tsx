import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { DraggableVideoPreview } from "./draggable-video-preview";

function renderPreview() {
  const stageRef = createRef<HTMLDivElement>();
  const view = render(
    <div ref={stageRef}>
      <DraggableVideoPreview stageRef={stageRef} stream={null} />
    </div>
  );
  const preview = screen.getByRole("group", { name: "Your movable video preview" });
  const stage = preview.parentElement as HTMLDivElement;

  Object.defineProperties(stage, {
    clientWidth: { configurable: true, value: 800 },
    clientHeight: { configurable: true, value: 600 },
  });
  Object.defineProperties(preview, {
    offsetWidth: { configurable: true, value: 200 },
    offsetHeight: { configurable: true, value: 112.5 },
    setPointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: () => false },
  });
  stage.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  });
  preview.getBoundingClientRect = () => ({
    x: 584,
    y: 471.5,
    left: 584,
    top: 471.5,
    right: 784,
    bottom: 584,
    width: 200,
    height: 112.5,
    toJSON: () => ({}),
  });

  return { ...view, preview };
}

describe("DraggableVideoPreview", () => {
  it("moves with arrow keys after the preview is focused", () => {
    const { preview } = renderPreview();

    fireEvent.keyDown(preview, { key: "ArrowLeft" });

    expect(preview).toHaveStyle({
      transform: "translate3d(568px, 471.5px, 0)",
    });
  });

  it("resizes with the keyboard handle while preserving the video ratio", () => {
    const { preview } = renderPreview();

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Resize your video preview" }),
      { key: "ArrowUp" }
    );

    expect(preview).toHaveStyle({
      width: "216px",
      height: "121.5px",
      transform: "translate3d(568px, 462.5px, 0)",
    });
  });

  it("resizes from a dragged edge", () => {
    const { preview } = renderPreview();

    fireEvent.pointerDown(preview, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 783,
      clientY: 528,
    });
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 799,
      clientY: 528,
    });

    expect(preview).toHaveStyle({
      width: "216px",
      height: "121.5px",
      transform: "translate3d(584px, 471.5px, 0)",
    });
  });
});
