import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Mock fetch to handle local WASM file path before importing imagemagick
const originalFetch = global.fetch;
global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
  const urlStr = url.toString();
  if (urlStr.endsWith('magick.wasm')) {
    const wasmPath = path.resolve(process.cwd(), urlStr.replace(/^\//, ''));
    const buffer = fs.readFileSync(wasmPath);
    return new Response(buffer);
  }
  return originalFetch(url, options);
};

import { convertImage, estimateOutputSize, getImageInfo, SUPPORTED_FORMATS, type ImageInfo } from "../src/lib/imagemagick";

const IMAGES_DIR = path.join(__dirname, "images");
const files = fs.readdirSync(IMAGES_DIR).filter((f) => fs.statSync(path.join(IMAGES_DIR, f)).isFile());

function createFixtureFile(filename: string) {
  const filePath = path.join(IMAGES_DIR, filename);
  const buffer = fs.readFileSync(filePath);
  return new File([buffer], filename, { type: "application/octet-stream" });
}

function legacyEstimateOutputSize(
  info: ImageInfo,
  targetFormat: string,
  options: { quality?: number; resize?: string } = {}
): number | null {
  const ext = targetFormat.toLowerCase();
  let w = info.width;
  let h = info.height;

  if (options.resize?.trim()) {
    const r = options.resize.trim();
    const pctMatch = r.match(/^(\d+)%$/);
    const dimMatch = r.match(/^(\d+)x(\d+)$/i);
    if (pctMatch) {
      const scale = parseInt(pctMatch[1], 10) / 100;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    } else if (dimMatch) {
      w = parseInt(dimMatch[1], 10);
      h = parseInt(dimMatch[2], 10);
    }
  }

  const pixels = w * h;

  switch (ext) {
    case "png":
      return Math.round(pixels * info.channels * 0.45);
    case "jpg": {
      const q = typeof options.quality === "number" ? Math.max(1, Math.min(100, options.quality)) : 90;
      return Math.round(pixels * (0.04 + (q / 100) * 0.56));
    }
    default:
      return null;
  }
}

function relativeError(estimate: number, actual: number): number {
  return Math.abs(estimate - actual) / actual;
}

describe("Image Conversion Tests", () => {
  for (const filename of files) {
    const file = createFixtureFile(filename);

    describe(`Converting ${filename}`, () => {
      for (const target of SUPPORTED_FORMATS) {
        it(`should convert ${filename} to ${target.ext.toUpperCase()}`, async () => {
          try {
            // ICO requires dimensions to be <= 256
            const options = target.ext === 'ico' ? { resize: "256x256>" } : {};
            const result = await convertImage(file, target.ext, options);
            expect(result).toBeDefined();
            expect(result.name).toBe(`${path.parse(filename).name}.${target.ext}`);
            expect(result.blob).toBeInstanceOf(Blob);
            expect(result.buffer).toBeInstanceOf(ArrayBuffer);
            expect(result.buffer.byteLength).toBeGreaterThan(0);
          } catch (error: any) {
            const msg = error.message;
            if (
              msg.includes("unsupported output format") || 
              msg.includes("is not available in this browser build") || 
              msg.includes("not available")
            ) {
              console.log(`Expected skip: ${filename} to ${target.ext} (${msg})`);
              return;
            }
            if (msg.includes("NoDecodeDelegateForThisImageFormat")) {
              console.log(`Expected skip: Cannot read ${filename} (${msg})`);
              return;
            }
            throw error;
          }
        });
      }
    });
  }
});

describe("Image Size Estimation", () => {
  it("should beat the legacy heuristic for PNG to PNG estimation", async () => {
    const file = createFixtureFile("PNG.png");
    const info = await getImageInfo(file);
    const actual = (await convertImage(file, "png")).buffer.byteLength;
    const estimate = await estimateOutputSize(file, info, "png");
    const legacy = legacyEstimateOutputSize(info, "png");

    expect(estimate).not.toBeNull();
    expect(legacy).not.toBeNull();
    expect(relativeError(estimate!, actual)).toBeLessThan(relativeError(legacy!, actual));
    expect(relativeError(estimate!, actual)).toBeLessThan(0.4);
  });

  it("should react to JPEG quality and resize changes", async () => {
    const file = createFixtureFile("PNG.png");
    const info = await getImageInfo(file);

    const highQualityEstimate = await estimateOutputSize(file, info, "jpg", { quality: 90 });
    const lowQualityEstimate = await estimateOutputSize(file, info, "jpg", { quality: 45 });
    const resizedEstimate = await estimateOutputSize(file, info, "jpg", { quality: 90, resize: "50%" });

    expect(highQualityEstimate).not.toBeNull();
    expect(lowQualityEstimate).not.toBeNull();
    expect(resizedEstimate).not.toBeNull();
    expect(lowQualityEstimate!).toBeLessThan(highQualityEstimate!);
    expect(resizedEstimate!).toBeLessThan(highQualityEstimate!);
  });

  it("should stay near-exact for BMP output", async () => {
    const file = createFixtureFile("PNG.png");
    const info = await getImageInfo(file);
    const estimate = await estimateOutputSize(file, info, "bmp");
    const actual = (await convertImage(file, "bmp")).buffer.byteLength;

    expect(estimate).not.toBeNull();
    expect(relativeError(estimate!, actual)).toBeLessThan(0.02);
  });
});
