"use client";

import { cn } from "@/lib/utils";
import { IconVideoOff } from "@tabler/icons-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

interface Position {
  x: number;
  y: number;
}

interface PreviewSize {
  width: number;
  height: number;
}

interface ResizeEdges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface DraggableVideoPreviewProps {
  stageRef: RefObject<HTMLDivElement | null>;
  stream: MediaStream | null;
}

const KEYBOARD_STEP = 16;
const VIDEO_ASPECT_RATIO = 16 / 9;
const POINTER_EDGE_SIZE = 8;
const TOUCH_EDGE_SIZE = 24;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function DraggableVideoPreview({
  stageRef,
  stream,
}: DraggableVideoPreviewProps) {
  const instructionsId = useId();
  const resizeInstructionsId = useId();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    position: Position;
    startWidth: number;
    startHeight: number;
    stageWidth: number;
    stageHeight: number;
    edges: ResizeEdges;
  } | null>(null);
  const minimumWidthRef = useRef<number | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [size, setSize] = useState<PreviewSize | null>(null);
  const [hoveredEdges, setHoveredEdges] = useState<ResizeEdges | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const constrain = useCallback((next: Position) => {
    const stage = stageRef.current;
    const preview = previewRef.current;
    if (!stage || !preview) return next;

    return {
      x: clamp(next.x, 0, stage.clientWidth - preview.offsetWidth),
      y: clamp(next.y, 0, stage.clientHeight - preview.offsetHeight),
    };
  }, [stageRef]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      setPosition((current) => current ? constrain(current) : current);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [constrain, stageRef]);

  function edgesAtPointer(
    event: PointerEvent<HTMLDivElement>,
    previewRect: DOMRect
  ): ResizeEdges | null {
    const threshold = event.pointerType === "touch"
      ? TOUCH_EDGE_SIZE
      : POINTER_EDGE_SIZE;
    const edges = {
      top: event.clientY - previewRect.top <= threshold,
      right: previewRect.right - event.clientX <= threshold,
      bottom: previewRect.bottom - event.clientY <= threshold,
      left: event.clientX - previewRect.left <= threshold,
    };
    return Object.values(edges).some(Boolean) ? edges : null;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const preview = previewRef.current;
    const stage = stageRef.current;
    if (!preview || !stage) return;

    const previewRect = preview.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const edges = edgesAtPointer(event, previewRect);
    if (edges) {
      minimumWidthRef.current ??= previewRect.width;
      resizeRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        position: {
          x: previewRect.left - stageRect.left,
          y: previewRect.top - stageRect.top,
        },
        startWidth: previewRect.width,
        startHeight: previewRect.height,
        stageWidth: stage.clientWidth,
        stageHeight: stage.clientHeight,
        edges,
      };
      setPosition({
        x: previewRect.left - stageRect.left,
        y: previewRect.top - stageRect.top,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - previewRect.left,
      offsetY: event.clientY - previewRect.top,
    };
    setPosition({
      x: previewRect.left - stageRect.left,
      y: previewRect.top - stageRect.top,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (resize?.pointerId === event.pointerId) {
      const horizontalWidth = resize.edges.left
        ? resize.startWidth - (event.clientX - resize.clientX)
        : resize.edges.right
          ? resize.startWidth + (event.clientX - resize.clientX)
          : resize.startWidth;
      const verticalWidth = (resize.edges.top
        ? resize.startHeight - (event.clientY - resize.clientY)
        : resize.startHeight + (event.clientY - resize.clientY)) * VIDEO_ASPECT_RATIO;
      const hasHorizontalEdge = resize.edges.left || resize.edges.right;
      const hasVerticalEdge = resize.edges.top || resize.edges.bottom;
      const nextWidth = hasHorizontalEdge && hasVerticalEdge
        ? Math.abs(horizontalWidth - resize.startWidth) >= Math.abs(verticalWidth - resize.startWidth)
          ? horizontalWidth
          : verticalWidth
        : hasHorizontalEdge
          ? horizontalWidth
          : verticalWidth;
      const maximumWidth = Math.min(
        resize.edges.left
          ? resize.position.x + resize.startWidth
          : resize.stageWidth - resize.position.x,
        (resize.edges.top
          ? resize.position.y + resize.startHeight
          : resize.stageHeight - resize.position.y) * VIDEO_ASPECT_RATIO
      );
      const minimumWidth = minimumWidthRef.current ?? resize.startWidth;
      const width = clamp(
        nextWidth,
        Math.min(minimumWidth, maximumWidth),
        maximumWidth
      );
      const height = width / VIDEO_ASPECT_RATIO;
      setSize({ width, height });
      setPosition({
        x: resize.edges.left
          ? resize.position.x + resize.startWidth - width
          : resize.position.x,
        y: resize.edges.top
          ? resize.position.y + resize.startHeight - height
          : resize.position.y,
      });
      return;
    }

    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) {
      const preview = previewRef.current;
      if (preview) setHoveredEdges(edgesAtPointer(event, preview.getBoundingClientRect()));
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    setPosition(constrain({
      x: event.clientX - stageRect.left - drag.offsetX,
      y: event.clientY - stageRect.top - drag.offsetY,
    }));
  }

  function stopPointerInteraction(event: PointerEvent<HTMLDivElement>) {
    if (
      dragRef.current?.pointerId !== event.pointerId &&
      resizeRef.current?.pointerId !== event.pointerId
    ) return;
    dragRef.current = null;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const movement = {
      ArrowLeft: { x: -KEYBOARD_STEP, y: 0 },
      ArrowRight: { x: KEYBOARD_STEP, y: 0 },
      ArrowUp: { x: 0, y: -KEYBOARD_STEP },
      ArrowDown: { x: 0, y: KEYBOARD_STEP },
    }[event.key];
    if (!movement) return;

    event.preventDefault();
    const preview = previewRef.current;
    const stage = stageRef.current;
    if (!preview || !stage) return;
    const previewRect = preview.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const current = position ?? {
      x: previewRect.left - stageRect.left,
      y: previewRect.top - stageRect.top,
    };
    setPosition(constrain({
      x: current.x + movement.x,
      y: current.y + movement.y,
    }));
  }

  function resizeTo(nextWidth: number, right: number, bottom: number) {
    const minimumWidth = minimumWidthRef.current ?? nextWidth;
    const maximumWidth = Math.min(right, bottom * VIDEO_ASPECT_RATIO);
    const width = clamp(nextWidth, Math.min(minimumWidth, maximumWidth), maximumWidth);
    const height = width / VIDEO_ASPECT_RATIO;
    setSize({ width, height });
    setPosition({ x: right - width, y: bottom - height });
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const direction = ["ArrowUp", "ArrowRight"].includes(event.key)
      ? 1
      : ["ArrowDown", "ArrowLeft"].includes(event.key)
        ? -1
        : 0;
    if (!direction) return;

    event.preventDefault();
    event.stopPropagation();
    const preview = previewRef.current;
    const stage = stageRef.current;
    if (!preview || !stage) return;
    const previewRect = preview.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    minimumWidthRef.current ??= previewRect.width;
    resizeTo(
      previewRect.width + (KEYBOARD_STEP * direction),
      previewRect.right - stageRect.left,
      previewRect.bottom - stageRect.top
    );
  }

  return (
    <div
      ref={previewRef}
      role="group"
      tabIndex={0}
      aria-label="Your movable video preview"
      aria-describedby={instructionsId}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopPointerInteraction}
      onPointerCancel={stopPointerInteraction}
      onPointerLeave={() => {
        if (!dragRef.current && !resizeRef.current) setHoveredEdges(null);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute z-20 aspect-video w-full max-w-call-preview touch-none select-none overflow-hidden rounded-none border-0 bg-bg shadow-none",
        "focus-visible:opacity-80",
        hoveredEdges?.left && hoveredEdges.top && "cursor-nwse-resize",
        hoveredEdges?.right && hoveredEdges.bottom && "cursor-nwse-resize",
        hoveredEdges?.right && hoveredEdges.top && "cursor-nesw-resize",
        hoveredEdges?.left && hoveredEdges.bottom && "cursor-nesw-resize",
        (hoveredEdges?.left || hoveredEdges?.right) && !hoveredEdges.top && !hoveredEdges.bottom && "cursor-ew-resize",
        (hoveredEdges?.top || hoveredEdges?.bottom) && !hoveredEdges.left && !hoveredEdges.right && "cursor-ns-resize",
        !hoveredEdges && "cursor-move",
        position === null && "bottom-xs right-xs"
      )}
      style={{
        ...(position === null ? undefined : {
          left: 0,
          top: 0,
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }),
        ...(size === null ? undefined : {
          width: `${size.width}px`,
          height: `${size.height}px`,
          maxWidth: "none",
        }),
      }}
    >
      <span id={instructionsId} className="sr-only">
        Drag the center to move. Drag an edge or corner to resize. Use arrow keys when focused.
      </span>
      <span id={resizeInstructionsId} className="sr-only">
        Drag to resize. Use arrow keys when focused.
      </span>
      {!stream && (
        <div className="flex h-full items-center justify-center text-muted">
          <IconVideoOff size={16} stroke={1.75} aria-label="Your camera is off" />
        </div>
      )}
      <video
        ref={videoRef}
        aria-label="Your video preview"
        autoPlay
        muted
        playsInline
        className={cn(
          "pointer-events-none h-full w-full -scale-x-100 object-contain",
          stream ? "block" : "hidden"
        )}
      />
      <button
        type="button"
        aria-label="Resize your video preview"
        aria-describedby={resizeInstructionsId}
        onKeyDown={handleResizeKeyDown}
        className="sr-only"
      />
    </div>
  );
}
