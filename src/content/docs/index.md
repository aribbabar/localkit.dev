---
title: "Architecture Overview"
description: "How LocalKit is built — a privacy-first, browser-native utility suite powered by WebAssembly."
icon: "⚡"
accent: "indigo"
lastUpdated: 2026-03-10
order: 0
---

## Why LocalKit?

Most online tools upload your files to a server for processing. LocalKit takes a different approach: **everything runs locally in your browser**. Your files never leave your device — no uploads, no accounts, no tracking.

This is possible thanks to **WebAssembly (WASM)**, which lets us run powerful native libraries like FFmpeg, ImageMagick, and MuPDF directly inside the browser at near-native speed.

## Frontend Architecture

LocalKit is built with [Astro](https://astro.build) — a modern framework that ships minimal JavaScript by default. The architecture follows three principles:

1. **Static-first rendering** — Pages are pre-rendered at build time as static HTML. No server required for hosting.
2. **Island architecture** — Interactive tool UIs are React components hydrated on the client via Astro's `client:load` directive. The rest of the page (navbar, footer, layout) is pure HTML with zero JS.
3. **Lazy WASM loading** — Heavy WebAssembly modules (10-30MB) are loaded on-demand when a user first interacts with a tool, not on page load.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro 5 (static site generation) |
| UI Components | React 19 (interactive islands) |
| Styling | Tailwind CSS 4 (utility-first) |
| Image Processing | ImageMagick WASM |
| Video Processing | FFmpeg WASM |
| PDF Processing | MuPDF WASM |
| Code Formatting | Prettier + Clang-format WASM |
| Bundler | Vite (via Astro) |

### File Organization

Each tool follows a consistent three-file pattern:

```
src/pages/tools/<tool>.astro      → Page with SEO metadata
src/components/<tool>/             → React UI components
src/lib/<tool>.ts                  → Core logic & WASM singleton
```

The page file handles routing and SEO (title, description, JSON-LD structured data). The component folder contains the interactive React UI. The library file manages the WASM runtime as a lazy-loaded singleton — initialized once and reused across operations.

### WASM Singleton Pattern

All WASM-powered tools follow the same initialization pattern:

```typescript
let instance: WasmModule | null = null;

export async function getModule(): Promise<WasmModule> {
  if (!instance) {
    instance = await loadWasmModule();
  }
  return instance;
}
```

This ensures the WASM binary is fetched and compiled only once per session, regardless of how many times the tool is used.

## Design System

LocalKit uses a dark theme with category-specific accent colors:

- **Purple** — Image tools (converter, metadata)
- **Blue** — Video tools (converter)
- **Red** — Document tools (PDF suite)
- **Cyan** — Document tools (Markdown, SVG)
- **Indigo** — Security tools (redactor, passwords)
- **Teal** — Developer tools (formatter, path converter)

Typography uses three font families: **DM Sans** for body text, **Space Grotesk** for headings and display text, and **JetBrains Mono** for code.

## Privacy Model

LocalKit has a strict privacy model:

- **No server processing** — All file manipulation happens in-browser via WASM or JavaScript
- **No file uploads** — Files are read into memory using the File API and processed locally
- **No analytics or tracking** — No third-party scripts, no cookies
- **No accounts** — No sign-up, no login, no user data stored

Files are processed entirely in memory and results are generated as Blob URLs for download. Nothing is persisted unless the user explicitly saves the output.

## FAQs

### Does LocalKit work offline?
Once the page and WASM modules are cached by your browser, most tools work fully offline. The initial visit requires an internet connection to download the assets.

### Why WebAssembly instead of server-side processing?
WASM lets us run the same battle-tested C/C++ libraries (FFmpeg, ImageMagick, MuPDF) that power server-side tools, but directly in your browser. This means zero latency from network round-trips, complete privacy, and no server costs.

### What browsers are supported?
LocalKit works in all modern browsers that support WebAssembly: Chrome 57+, Firefox 52+, Safari 11+, and Edge 16+. Some tools may require additional APIs like SharedArrayBuffer (video converter).

### Is LocalKit open source?
Yes. LocalKit is released under the AGPL-3.0 license. The source code is available on GitHub.

### How large are the WASM modules?
Module sizes vary: ImageMagick is ~5MB, MuPDF is ~12MB, and FFmpeg is ~30MB. They are loaded on-demand and cached by the browser after the first load.
