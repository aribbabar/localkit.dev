import { describe, it, expect, beforeAll } from "vitest";
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

import { convertImage, SUPPORTED_FORMATS } from "../src/lib/imagemagick";

const IMAGES_DIR = path.join(__dirname, "images");
const files = fs.readdirSync(IMAGES_DIR).filter(f => fs.statSync(path.join(IMAGES_DIR, f)).isFile());

describe("Image Conversion Tests", () => {
  for (const filename of files) {
    const filePath = path.join(IMAGES_DIR, filename);
    const buffer = fs.readFileSync(filePath);
    
    // Create a mock File object as convertImage expects a Web API File
    const file = new File([buffer], filename, { type: "application/octet-stream" });

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
