export interface ResizeEdges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface ResizeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeStage {
  width: number;
  height: number;
}

export function computeResizedBox(
  edges: ResizeEdges,
  startRect: ResizeRect,
  delta: { x: number; y: number },
  stageSize: ResizeStage,
  minWidth: number,
  aspectRatio = 16 / 9
): ResizeRect {
  const horizontalWidth = edges.left
    ? startRect.width - delta.x
    : edges.right
      ? startRect.width + delta.x
      : startRect.width;
  const verticalWidth = (edges.top
    ? startRect.height - delta.y
    : startRect.height + delta.y) * aspectRatio;
  const hasHorizontalEdge = edges.left || edges.right;
  const hasVerticalEdge = edges.top || edges.bottom;
  const nextWidth = hasHorizontalEdge && hasVerticalEdge
    ? Math.abs(horizontalWidth - startRect.width) >= Math.abs(verticalWidth - startRect.width)
      ? horizontalWidth
      : verticalWidth
    : hasHorizontalEdge
      ? horizontalWidth
      : verticalWidth;
  const maximumWidth = Math.min(
    edges.left
      ? startRect.x + startRect.width
      : stageSize.width - startRect.x,
    (edges.top
      ? startRect.y + startRect.height
      : stageSize.height - startRect.y) * aspectRatio
  );
  const width = Math.min(
    Math.max(nextWidth, Math.min(minWidth, maximumWidth)),
    maximumWidth
  );
  const height = width / aspectRatio;
  return {
    x: edges.left ? startRect.x + startRect.width - width : startRect.x,
    y: edges.top ? startRect.y + startRect.height - height : startRect.y,
    width,
    height,
  };
}
