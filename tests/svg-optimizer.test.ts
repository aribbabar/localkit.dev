import { describe, expect, it, vi } from "vitest";

const optimizeMock = vi.fn((svg: string) =>
  svg
    .replace(/<!--.*?-->/g, "")
    .replace(/>\s+</g, "><")
    .trim(),
);

vi.mock("svgtidy", () => ({
  optimize: optimizeMock,
}));

import {
  isAcceptedSvgFile,
  optimizeNamedSvg,
  optimizeSvgBatch,
  optimizeSvgString,
} from "../src/lib/svg-optimizer";

describe("svg optimizer", () => {
  it("accepts svg files by mime type or extension", () => {
    expect(
      isAcceptedSvgFile(
        new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" }),
      ),
    ).toBe(true);
    expect(
      isAcceptedSvgFile(new File(["<svg/>"], "icon.SVG", { type: "" })),
    ).toBe(true);
    expect(
      isAcceptedSvgFile(
        new File(["not svg"], "photo.png", { type: "image/png" }),
      ),
    ).toBe(false);
  });

  it("validates svg markup before optimizing", async () => {
    await expect(optimizeSvgString("")).rejects.toThrow("SVG input is empty.");
    await expect(optimizeSvgString("<div>hello</div>")).rejects.toThrow(
      "does not look like SVG markup",
    );
  });

  it("optimizes named svg content and reports size savings", async () => {
    const result = await optimizeNamedSvg(
      "icon.svg",
      '<svg><!-- note --><g><path d="M0 0" /></g></svg>',
    );

    expect(result.name).toBe("icon.svg");
    expect(result.originalSvgString).toContain("<!-- note -->");
    expect(result.svgString).not.toContain("<!-- note -->");
    expect(result.originalBytes).toBeGreaterThan(result.optimizedBytes);
    expect(result.bytesSaved).toBeGreaterThan(0);
    expect(result.savedPercent).toBeGreaterThan(0);
    expect(result.blob.type).toBe("image/svg+xml");
  });

  it("optimizes batches and surfaces per-file failures", async () => {
    optimizeMock.mockImplementationOnce(() => {
      throw new Error("bad svg");
    });

    const files = [
      new File(["<svg><!-- bad --></svg>"], "broken.svg", {
        type: "image/svg+xml",
      }),
      new File(["<svg><!-- good --></svg>"], "ok.svg", {
        type: "image/svg+xml",
      }),
    ];
    const progressEvents: Array<[number, number, number]> = [];

    const results = await optimizeSvgBatch(
      files,
      (fileIndex, fileProgress, totalFiles) => {
        progressEvents.push([fileIndex, fileProgress, totalFiles]);
      },
    );

    expect(results).toHaveLength(2);
    expect(results[0].error).toBe("bad svg");
    expect(results[1].error).toBeUndefined();
    expect(results[1].svgString).toBe("<svg></svg>");
    expect(progressEvents[0]).toEqual([0, 0, 2]);
    expect(progressEvents).toContainEqual([1, 1, 2]);
    expect(progressEvents.at(-1)).toEqual([2, 0, 2]);
  });
});
