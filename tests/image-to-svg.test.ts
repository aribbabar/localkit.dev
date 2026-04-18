import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn(async () => undefined);
const potraceMock = vi.fn(
  async (imageData: ImageData, options: Record<string, unknown>) => {
    return `<svg data-width="${imageData.width}" data-height="${imageData.height}" data-extractcolors="${String(options.extractcolors)}"></svg>`;
  },
);

vi.mock("esm-potrace-wasm", () => ({
  init: initMock,
  potrace: potraceMock,
}));

import { DEFAULT_POTRACE_OPTIONS, convertBatch } from "../src/lib/image-to-svg";

const ILLUSTRATIONS_DIR = path.join(__dirname, "illustrations");

function createFixtureFile(filename: string) {
  const filePath = path.join(ILLUSTRATIONS_DIR, filename);
  const buffer = fs.readFileSync(filePath);
  const extension = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  return new File([buffer], filename, {
    type: mimeTypes[extension] ?? "application/octet-stream",
  });
}

describe("image to svg conversion", () => {
  beforeEach(() => {
    initMock.mockClear();
    potraceMock.mockClear();

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(
        async (
          _file: File,
          options?: { resizeWidth?: number; resizeHeight?: number },
        ) => ({
          width: options?.resizeWidth ?? 1600,
          height: options?.resizeHeight ?? 1200,
          close: vi.fn(),
        }),
      ),
    );

    class MockOffscreenCanvas {
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      getContext() {
        const { width, height } = this;
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(
            () =>
              ({
                width,
                height,
                data: new Uint8ClampedArray(width * height * 4),
              }) as ImageData,
          ),
        };
      }
    }

    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts illustration fixtures with potrace and reports progress", async () => {
    const files = [
      createFixtureFile("cute-cartoon-puppy-dog-illustration-free-vector.jpg"),
      createFixtureFile(
        "66bb67135fdd14f83c75ff3d_6694de41bd4a4967151e2f08_bold-illustration-style.png",
      ),
    ];
    const progressEvents: Array<[number, number, number]> = [];

    const results = await convertBatch(
      files,
      {
        potrace: {
          ...DEFAULT_POTRACE_OPTIONS,
          extractcolors: false,
        },
      },
      (fileIndex, fileProgress, totalFiles) => {
        progressEvents.push([fileIndex, fileProgress, totalFiles]);
      },
    );

    expect(results).toHaveLength(2);
    expect(results.every((result) => !result.error)).toBe(true);
    expect(results.map((result) => result.name)).toEqual([
      "cute-cartoon-puppy-dog-illustration-free-vector.svg",
      "66bb67135fdd14f83c75ff3d_6694de41bd4a4967151e2f08_bold-illustration-style.svg",
    ]);
    expect(results[0].svgString).toContain('data-width="1024"');
    expect(results[0].svgString).toContain('data-height="768"');
    expect(results[0].svgString).toContain('data-extractcolors="false"');
    expect(results[0].buffer.byteLength).toBeGreaterThan(0);

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(potraceMock).toHaveBeenCalledTimes(2);
    expect(progressEvents[0]).toEqual([0, 0, 2]);
    expect(progressEvents).toContainEqual([0, 1, 2]);
    expect(progressEvents).toContainEqual([1, 1, 2]);
    expect(progressEvents.at(-1)).toEqual([2, 0, 2]);
  });
});
