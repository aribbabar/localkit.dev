import { describe, expect, it } from "vitest";
import { createCollageLayout } from "../src/lib/image-collage";

const sampleImages = [
  { id: "wide", width: 2400, height: 1200 },
  { id: "portrait", width: 900, height: 1400 },
  { id: "square", width: 1600, height: 1600 },
  { id: "photo", width: 1800, height: 1200 },
  { id: "tall", width: 800, height: 1400 },
];

describe("image collage layout", () => {
  it("creates a tile for every image", () => {
    const layout = createCollageLayout(sampleImages, {
      ratioPreset: "auto",
      gap: 12,
    });

    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.tiles).toHaveLength(sampleImages.length);
    expect(new Set(layout.tiles.map((tile) => tile.imageId)).size).toBe(
      sampleImages.length,
    );
  });

  it("keeps fixed ratio layouts close to the requested canvas ratio", () => {
    const layout = createCollageLayout(sampleImages, {
      ratioPreset: "landscape",
      gap: 16,
    });

    expect(layout.width / layout.height).toBeCloseTo(16 / 9, 2);
  });

  it("keeps tiles inside the canvas with positive dimensions", () => {
    const layout = createCollageLayout(sampleImages, {
      ratioPreset: "portrait",
      gap: 8,
    });

    for (const tile of layout.tiles) {
      expect(tile.width).toBeGreaterThan(0);
      expect(tile.height).toBeGreaterThan(0);
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(layout.width + 1);
      expect(tile.y + tile.height).toBeLessThanOrEqual(layout.height + 1);
    }
  });

  it("caps very large source sets to the canvas budget", () => {
    const layout = createCollageLayout(
      [
        { id: "a", width: 8000, height: 6000 },
        { id: "b", width: 7000, height: 5000 },
      ],
      {
        ratioPreset: "square",
        gap: 0,
        maxPixels: 4_000_000,
      },
    );

    expect(layout.width * layout.height).toBeLessThanOrEqual(4_100_000);
  });

  it("keeps dense collages valid when requested gaps are large", () => {
    const images = Array.from({ length: 40 }, (_, index) => ({
      id: `image-${index}`,
      width: 120,
      height: 90,
    }));
    const layout = createCollageLayout(images, {
      ratioPreset: "square",
      gap: 40,
      maxPixels: 360_000,
    });

    expect(layout.tiles).toHaveLength(images.length);
    for (const tile of layout.tiles) {
      expect(tile.width).toBeGreaterThan(0);
      expect(tile.height).toBeGreaterThan(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(layout.width + 1);
      expect(tile.y + tile.height).toBeLessThanOrEqual(layout.height + 1);
    }
  });
});
