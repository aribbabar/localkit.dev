---
title: "QR Code Generator"
description: "How the QR Code Generator works — create styled QR codes with saved local preferences and browser-only downloads."
tool: "qr-code-generator"
accent: "teal"
icon: "QrCode"
lastUpdated: 2026-05-03
order: 17
---

## What It Does

The QR Code Generator creates downloadable QR codes for URLs, text, contact details, or any other short payload supported by QR encoding.

### Key Features

- **Live preview** — Updates the QR code as the content or style changes
- **Style controls** — Customize dot style, finder corners, colors, size, margin, shape, and error correction
- **Logo support** — Add a remote logo URL or upload a local image for the current session
- **Multiple exports** — Download PNG, SVG, WebP, or JPEG files
- **Saved preferences** — Remembers styling and export preferences in local storage
- **Reset defaults** — Restores the recommended LocalKit defaults in one click

## Architecture

The tool uses `qr-code-styling` inside a React island. The library is loaded dynamically in the browser so the static Astro page does not execute QR rendering code during server-side rendering.

### Processing Pipeline

1. **Input** — User enters QR content in the browser.
2. **Preferences** — Styling options are loaded from local storage and sanitized.
3. **Rendering** — `qr-code-styling` renders an SVG preview into the page.
4. **Export** — The library downloads the selected output format directly from the browser.
5. **Reset** — Defaults restore the content sample, styling, logo settings, and export type.

### Code Structure

```
src/pages/tools/qr-code-generator.astro          -> Page with SEO metadata
src/components/qr-code-generator/
  QrCodeGeneratorApp.tsx                         -> Main React component
  preferences.ts                                 -> Local storage defaults and sanitization
tests/qr-code-generator-preferences.test.ts      -> Preference behavior tests
```

## Privacy & Security

QR rendering happens locally in the browser. QR content is not uploaded and is not saved to local storage. The only persisted data is the styling and export preference object. Uploaded logo files are held as temporary browser object URLs for the current session.

## Technical Details

- **Dependency**: `qr-code-styling`
- **Persistence**: `localStorage`
- **Preview type**: SVG
- **Export formats**: PNG, SVG, WebP, JPEG
- **Browser support**: Modern browsers with dynamic imports, Blob URLs, and standard DOM APIs
