---
title: "Image Converter"
description: "How the Image Converter works — batch convert images between formats using ImageMagick WASM."
tool: "image-converter"
accent: "purple"
icon: "Image"
lastUpdated: 2026-03-10
order: 1
---

## What It Does

The Image Converter lets you batch convert images between formats — PNG, JPG, GIF, BMP, TIFF, WebP, AVIF, ICO, and more. Drop multiple files at once, pick a target format, and download all converted images individually or as a ZIP.

### Key Features

- **Batch processing** — Convert dozens of images at once
- **20+ formats** — PNG, JPG, GIF, BMP, TIFF, WebP, AVIF, ICO, PSD, and more
- **Quality control** — Adjust output quality for lossy formats
- **ZIP download** — Download all converted files in a single archive
- **Live previews** — See before/after thumbnails during conversion

## Architecture

The converter is powered by [ImageMagick](https://imagemagick.org/), compiled to WebAssembly via [@imagemagick/magick-wasm](https://github.com/nicolo-ribaudo/magick-wasm).

### Processing Pipeline

1. **File drop** — User drops images onto the drop zone. Files are read as `ArrayBuffer` via the File API.
2. **WASM init** — The ImageMagick WASM module (~5MB) loads lazily on first conversion.
3. **Conversion** — Each image is decoded by ImageMagick, converted to the target format in memory, and returned as a `Uint8Array`.
4. **Output** — Converted files are wrapped as Blob URLs for individual download, or packaged into a ZIP using jszip for batch download.

### Code Structure

```
src/pages/tools/image-converter.astro   → Page with SEO
src/components/image-converter/
  ImageConverterTool.tsx                → Main React component
  DropZone.astro                        → File drop target
  ConversionPanel.astro                 → Format/quality controls
src/lib/imagemagick.ts                  → WASM singleton & conversion logic
```

The `imagemagick.ts` library exposes a singleton loader — the WASM binary is fetched and compiled once, then reused for all subsequent conversions within the session.

## Privacy & Security

All image processing happens entirely in your browser. Your images are never uploaded to any server. Files are read into memory, processed by ImageMagick WASM, and the results are generated as downloadable Blob URLs. No data leaves your device.

## Technical Details

- **WASM module size**: ~5MB (loaded on demand, cached by browser)
- **Supported input formats**: PNG, JPG, GIF, BMP, TIFF, WebP, AVIF, ICO, PSD, SVG, and more
- **Supported output formats**: PNG, JPG, GIF, BMP, TIFF, WebP, AVIF, ICO
- **Batch downloads**: Powered by jszip for client-side ZIP generation
- **Browser support**: All modern browsers with WebAssembly support

## FAQs

### Is there a file size limit?

There's no hard limit, but very large images (50MB+) may cause the browser to run out of memory depending on your device. For best results, keep individual files under 30MB.

### Does conversion preserve EXIF metadata?

By default, metadata is stripped during conversion. If you need to inspect or preserve metadata, use the [Image Metadata](/tools/image-metadata) tool first.

### What's the difference between lossy and lossless formats?

Lossy formats (JPG, WebP at lower quality) reduce file size by discarding some image data. Lossless formats (PNG, BMP, TIFF) preserve all data exactly. Use the quality slider to control the tradeoff for lossy formats.
