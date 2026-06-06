import { describe, expect, it } from "vitest";
import {
  centerTransform,
  zoomToPoint,
} from "../src/components/image-collage/viewer";

describe("image collage viewer", () => {
  it("keeps the cursor anchored when zooming in", () => {
    const viewportRect = { left: 0, top: 0, width: 500, height: 400 };
    const transform = { offsetX: 100, offsetY: 60, scale: 1 };

    const next = zoomToPoint({
      clientX: 300,
      clientY: 210,
      viewportRect,
      transform,
      nextScale: 2,
    });

    const pointerX = 300 - viewportRect.left;
    const pointerY = 210 - viewportRect.top;
    const contentX = (pointerX - transform.offsetX) / transform.scale;
    const contentY = (pointerY - transform.offsetY) / transform.scale;

    expect(next.scale).toBe(2);
    expect(next.offsetX + contentX * next.scale).toBeCloseTo(pointerX);
    expect(next.offsetY + contentY * next.scale).toBeCloseTo(pointerY);
  });

  it("keeps the cursor anchored when zooming out", () => {
    const viewportRect = { left: 20, top: 10, width: 600, height: 500 };
    const transform = { offsetX: -120, offsetY: -80, scale: 3 };

    const next = zoomToPoint({
      clientX: 420,
      clientY: 360,
      viewportRect,
      transform,
      nextScale: 1.5,
    });

    const pointerX = 420 - viewportRect.left;
    const pointerY = 360 - viewportRect.top;
    const contentX = (pointerX - transform.offsetX) / transform.scale;
    const contentY = (pointerY - transform.offsetY) / transform.scale;

    expect(next.scale).toBe(1.5);
    expect(next.offsetX + contentX * next.scale).toBeCloseTo(pointerX);
    expect(next.offsetY + contentY * next.scale).toBeCloseTo(pointerY);
  });

  it("returns the same transform when scale does not change", () => {
    const transform = { offsetX: 50, offsetY: 75, scale: 2 };

    const next = zoomToPoint({
      clientX: 100,
      clientY: 100,
      viewportRect: { left: 0, top: 0, width: 400, height: 400 },
      transform,
      nextScale: 2,
    });

    expect(next).toBe(transform);
  });

  it("centers content of any size inside the viewport", () => {
    const transform = centerTransform({
      viewportWidth: 800,
      viewportHeight: 600,
      contentWidth: 400,
      contentHeight: 300,
      scale: 1,
    });

    expect(transform).toEqual({ offsetX: 200, offsetY: 150, scale: 1 });
  });

  it("centers content at non-unit scales", () => {
    const transform = centerTransform({
      viewportWidth: 800,
      viewportHeight: 600,
      contentWidth: 400,
      contentHeight: 300,
      scale: 1.5,
    });

    expect(transform).toEqual({ offsetX: 100, offsetY: 75, scale: 1.5 });
  });
});
