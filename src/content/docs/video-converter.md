---
title: "Video Converter"
description: "How the Video Converter works — convert videos between formats using FFmpeg WASM."
tool: "video-converter"
accent: "blue"
icon: "Video"
lastUpdated: 2026-03-10
order: 4
---

## What It Does

The Video Converter lets you convert videos between formats — MP4, WebM, AVI, MKV, MOV, and more. It runs [FFmpeg](https://ffmpeg.org/), the industry-standard media toolkit, directly in your browser via WebAssembly.

### Key Features

- **Multiple formats** — MP4, WebM, AVI, MKV, MOV, OGV, and more
- **Fast mode** — Uses faster encoder settings while still transcoding every selected file
- **Codec selection** — Choose video and audio codecs
- **Batch conversion** — Convert multiple videos at once
- **Progress tracking** — Real-time progress bar during conversion
- **No upload required** — Everything runs locally

## Architecture

The converter uses [FFmpeg WASM](https://github.com/nicolo-ribaudo/ffmpeg-wasm), a WebAssembly port of FFmpeg. This is the largest runtime dependency in LocalKit (~30MB), so it uses careful lazy loading and browser caching. LocalKit downloads the FFmpeg core from a pinned CDN URL at conversion time so the static site stays within hosting asset limits.

### Processing Pipeline

1. **File input** — User drops video files. FFmpeg starts warming as soon as valid files are selected.
2. **Plan** — Every selected file is planned as a transcode so quality, compression, audio, and transform settings are always applied consistently.
3. **WASM init** — FFmpeg WASM loads from a pinned CDN URL. Multi-threaded core is used when cross-origin isolation is available; otherwise the converter falls back to single-threaded core.
4. **Virtual filesystem** — Inputs are mounted with `WORKERFS` when supported to avoid an extra full copy into MEMFS, with MEMFS copy as a fallback.
5. **Conversion** — FFmpeg runs the planned transcode command with the selected format and codec options.
6. **Output** — The converted file is read from FFmpeg's filesystem and offered as a Blob URL download.

### Code Structure

```
src/pages/tools/video-converter.astro   → Page with SEO
src/components/video-converter/
  VideoConverterTool.tsx                → Main React component
src/lib/ffmpeg.ts                       → FFmpeg WASM singleton & conversion logic
```

### SharedArrayBuffer Requirement

FFmpeg WASM uses multi-threading for performance, which requires `SharedArrayBuffer`. This API is only available in [secure contexts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements) with the proper cross-origin isolation headers (`Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy`).

## Privacy & Security

Video files are typically large and sensitive. The FFmpeg runtime is downloaded on demand, but conversion happens in your browser and files are never uploaded. The FFmpeg WASM module processes video entirely in memory using its virtual filesystem.

## Technical Details

- **WASM module size**: ~30MB (loaded on demand, cached by browser)
- **Threading**: Multi-threaded via SharedArrayBuffer when cross-origin isolation is available; single-thread fallback otherwise
- **Fast mode**: always transcodes, using faster encoder settings by default
- **Supported formats**: MP4, WebM, AVI, MKV, MOV, OGV, FLV, and more
- **Video codecs**: H.264, VP8, VP9, and others
- **Audio codecs**: AAC, Opus, Vorbis, MP3
- **Browser support**: Chrome 79+, Firefox 79+, Safari 15.2+ (requires cross-origin isolation)

## FAQs

### Why is the first conversion slow?

The FFmpeg WASM module (~30MB) needs to be downloaded and compiled on first use. Subsequent conversions in the same session are much faster since the module is already in memory. The browser also caches the runtime download.

### Why does the video converter need special browser headers?

FFmpeg uses multi-threading for performance, which requires `SharedArrayBuffer`. For security, browsers only enable this API when the page is cross-origin isolated. LocalKit sets the required headers automatically.

### Is there a file size limit?

There's no hard limit, but video processing is memory-intensive. Files over 500MB may cause issues on devices with limited RAM. For very large files, a native FFmpeg installation is recommended.

### Can I extract audio from a video?

Yes — select an audio-only output format (like MP3 or OGG) to extract just the audio track.
