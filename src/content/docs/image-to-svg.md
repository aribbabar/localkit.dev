---
title: "Image to SVG"
description: "How the Image to SVG tool works: convert raster images into SVGs with Potrace, locally in your browser."
tool: "image-to-svg"
accent: "purple"
icon: "Image"
lastUpdated: 2026-04-18
order: 3
---

## What It Does

The Image to SVG tool converts raster images into SVG vector graphics. You can drop in PNG, JPG, GIF, BMP, WebP, or TIFF files, tune the tracing settings, preview the result, and download each SVG on its own or as a ZIP.

This tool works especially well for icons, logos, stickers, and illustrations with clear shapes. It can handle photos too, but those usually produce larger and more complex SVG output.

### Key Features

* **Batch conversion**: Convert multiple images in one run
* **Built-in presets**: Start from tuned Potrace profiles for logos, illustrations, and photos
* **Potrace controls**: Adjust noise filtering, corner smoothness, curve optimization, and tracing behavior
* **Color extraction**: Keep color regions in the SVG, or turn it off for black and white output
* **Preview modes**: Switch between SVG, original image, or a side by side comparison
* **Background modes**: Preview against light, dark, or checkerboard backgrounds
* **ZIP download**: Download all successful conversions in one archive

## Architecture

The tool uses **Potrace**, compiled to WebAssembly through `esm-potrace-wasm`.

The Potrace module loads lazily when you actually start a conversion, which keeps the initial page load lighter.

Before tracing starts, each image is decoded in the browser and drawn into a canvas. For larger inputs, the tool scales the image down before sending it into Potrace. This keeps memory usage under control and avoids pushing the WASM runtime past its heap limits.

### Processing Pipeline

1. **File input**: The user drops images into the tool or selects them through the file picker.
2. **Client-side decode**: Each file is decoded with `createImageBitmap()` and drawn into a canvas so the tool can extract `ImageData`.
3. **Safety downscaling**: If the image is very large, it is resized to fit within a 1024px maximum dimension before tracing.
4. **Vectorization**: Potrace traces the bitmap into SVG paths using the selected settings.
5. **Preview generation**: The SVG string is wrapped as a Blob so the browser can preview it instantly.
6. **Download**: Successful outputs are downloaded one by one, or packed into a ZIP with `jszip` when multiple files finish successfully.

### Code Structure

```
src/pages/tools/image-to-svg.astro      → Page with SEO
src/components/image-to-svg/
  ImageToSvgTool.tsx                    → Main React component
  ImageToSvgTool.module.css             → Slider styling
  preferences.ts                        → Saved Potrace settings
src/lib/image-to-svg.ts                 → Potrace loader, image extraction, batch conversion
```

The `image-to-svg.ts` library exposes the Potrace loader and the batch conversion pipeline. The WASM module is initialized once per session and then reused for later conversions.

## Privacy & Security

All processing happens locally in your browser. Your images are never uploaded to a server. Files are read from disk with the File API, traced in memory, and returned as Blob downloads. Nothing leaves your device.

## Technical Details

* **Tracing engine**: Potrace via WebAssembly
* **Input formats**: PNG, JPG, GIF, BMP, WebP, TIFF
* **Output format**: SVG
* **Large image handling**: Inputs may be resized to a maximum dimension of 1024px before tracing
* **Preference storage**: Potrace settings are saved in `localStorage`
* **Batch downloads**: Powered by `jszip`
* **Browser support**: Modern browsers with WebAssembly support

## FAQs

### Does it keep the original colors?

Yes. Leave **Extract colors** enabled if you want the tool to preserve color regions from the original image. You can then use **Color Levels** and **Color Algorithm** to decide how much color detail to keep.

If you want a simpler black and white result, turn **Extract colors** off.

### Why does my SVG look simpler than the source image?

SVG vectorization is not a pixel perfect copy. The tracing step tries to rebuild the image as shapes and curves, which means tiny details, texture, and noise may be simplified or removed. That is usually what you want, but it can make photographic images look different from the original.

### Why is my SVG file so large?

This usually happens when the source image has too much detail, too many colors, or a noisy background. Photos are the most common example. Lowering **Color Levels**, increasing **Noise Filter**, or disabling **Extract colors** can produce a much cleaner file.

### What kinds of images work best?

Simple artwork usually gives the best results. Logos, flat illustrations, icons, and drawings with strong edges tend to convert cleanly. Photos can still work, but they often create dense SVGs with lots of paths.

### Why does the tool resize large images before tracing?

That is a practical limit to keep the browser-side Potrace runtime stable. Extremely large bitmaps can use a lot of memory, so the tool scales them down before tracing. This keeps conversions more reliable, especially on lower-memory devices.
