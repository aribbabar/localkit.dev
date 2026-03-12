---
title: "Image Converter"
description: "How the Image Converter works — batch convert images between formats using ImageMagick WASM."
tool: "image-converter"
accent: "purple"
icon: "Image"
lastUpdated: 2026-03-12
order: 1
---

## What It Does

The Image Converter lets you batch convert images between formats — PNG, JPG, GIF, BMP, TIFF, ICO, PSD, and more. Drop multiple files at once, pick a target format, and download all converted images individually or as a ZIP.

### Key Features

- **Batch processing** — Convert dozens of images at once
- **14 formats** — PNG, JPG, GIF, BMP, TIFF, ICO, TGA, PSD, PPM, PGM, HDR, PCX, HEIC, HEIF
- **Quality control** — Adjust output quality for lossy formats (JPG, PSD, HEIC, HEIF)
- **Size estimation** — See estimated output sizes per file before converting, updated live as you change format, quality, or resize settings
- **Size comparison** — After conversion, see original vs output size with percentage change for each file
- **Resize** — Optionally resize images during conversion (e.g. `800x600` or `50%`)
- **Strip metadata** — Remove EXIF and other metadata for privacy
- **ZIP download** — Download all converted files in a single archive

## Architecture

The converter is powered by [ImageMagick](https://imagemagick.org/), compiled to WebAssembly via [@imagemagick/magick-wasm](https://github.com/nicolo-ribaudo/magick-wasm).

### Processing Pipeline

1. **File drop** — User drops images onto the drop zone. Files are read as `ArrayBuffer` via the File API.
2. **WASM init** — The ImageMagick WASM module (~5MB) loads lazily on first use (triggered by file add for size estimation, or on first conversion).
3. **Image info** — On file add, each image is read via ImageMagick to extract dimensions and channel count. This powers the live size estimates.
4. **Size estimation** — Heuristic estimates are computed per file based on target format, quality, and resize settings. Lossless formats (BMP, PPM, TIFF) are near-exact; lossy formats (JPG, HEIC) use quality-based curves and are approximate.
5. **Conversion** — Each image is decoded by ImageMagick, converted to the target format in memory, and returned as a `Uint8Array`.
6. **Output** — Converted files are wrapped as Blob URLs for individual download, or packaged into a ZIP using jszip for batch download. Each result shows the original and output size with percentage change.

### Code Structure

```
src/pages/tools/image-converter.astro   → Page with SEO
src/components/image-converter/
  ImageConverterTool.tsx                → Main React component (state, UI, estimates)
  ImageConverterTool.module.css         → Quality slider styling
src/lib/imagemagick.ts                  → WASM singleton, conversion, getImageInfo, estimateOutputSize
```

The `imagemagick.ts` library exposes a singleton loader — the WASM binary is fetched and compiled once, then reused for all subsequent operations within the session.

## Privacy & Security

All image processing happens entirely in your browser. Your images are never uploaded to any server. Files are read into memory, processed by ImageMagick WASM, and the results are generated as downloadable Blob URLs. No data leaves your device.

## Technical Details

- **WASM module size**: ~5MB (loaded on demand, cached by browser)
- **Supported input formats**: PNG, JPG, GIF, BMP, TIFF, ICO, PSD, TGA, HEIC, HEIF, XCF, and more
- **Supported output formats**: PNG, JPG, GIF, BMP, TIFF, ICO, TGA, PSD, PPM, PGM, HDR, PCX, HEIC, HEIF
- **Batch downloads**: Powered by jszip for client-side ZIP generation
- **Browser support**: All modern browsers with WebAssembly support

## FAQs

### Is there a file size limit?

There's no hard limit, but very large images (50MB+) may cause the browser to run out of memory depending on your device. For best results, keep individual files under 30MB.

### Does conversion preserve EXIF metadata?

By default, metadata is preserved. Enable the **Strip metadata** checkbox to remove EXIF, color profiles, and all embedded metadata. If you need to inspect metadata, use the [Image Metadata](/tools/image-metadata) tool.

### What's the difference between lossy and lossless formats?

Lossy formats (JPG, HEIC, HEIF) reduce file size by discarding some image data. Lossless formats (PNG, BMP, TIFF) preserve all data exactly. Use the quality slider to control the tradeoff for lossy formats.

### How accurate are the size estimates?

Estimates for uncompressed formats (BMP, PPM, TIFF) are near-exact. For lossy formats like JPG and HEIC, estimates use heuristic curves based on quality settings and can vary from the actual output — image content (detail, noise, gradients) heavily affects compression. Treat lossy estimates as a rough guide.
