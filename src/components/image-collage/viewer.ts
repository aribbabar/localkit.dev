export interface ViewerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewerTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/**
 * Compute the next transform when zooming, anchored to a client-space point.
 * The content point currently under the cursor stays at the same on-screen
 * position after the zoom.
 *
 * Coordinates assume the transform is applied with `transform-origin: 0 0` so
 * that a content-space point `(cx, cy)` lands at viewport-space point
 * `(offsetX + cx * scale, offsetY + cy * scale)`.
 */
export function zoomToPoint({
  clientX,
  clientY,
  viewportRect,
  transform,
  nextScale,
}: {
  clientX: number;
  clientY: number;
  viewportRect: ViewerRect;
  transform: ViewerTransform;
  nextScale: number;
}): ViewerTransform {
  if (nextScale === transform.scale) return transform;

  const pointerX = clientX - viewportRect.left;
  const pointerY = clientY - viewportRect.top;
  const contentX = (pointerX - transform.offsetX) / transform.scale;
  const contentY = (pointerY - transform.offsetY) / transform.scale;

  return {
    offsetX: pointerX - contentX * nextScale,
    offsetY: pointerY - contentY * nextScale,
    scale: nextScale,
  };
}

/**
 * Compute the transform that centers content of size `contentWidth x
 * contentHeight` inside a viewport of size `viewportWidth x viewportHeight`
 * at the given scale.
 */
export function centerTransform({
  viewportWidth,
  viewportHeight,
  contentWidth,
  contentHeight,
  scale,
}: {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  scale: number;
}): ViewerTransform {
  return {
    offsetX: (viewportWidth - contentWidth * scale) / 2,
    offsetY: (viewportHeight - contentHeight * scale) / 2,
    scale,
  };
}
