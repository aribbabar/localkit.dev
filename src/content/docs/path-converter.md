---
title: "Path Converter"
description: "How the Path Converter works — convert file paths between forward and backslash formats."
tool: "path-converter"
accent: "teal"
icon: "🔧"
lastUpdated: 2026-03-10
order: 10
---

## What It Does

The Path Converter instantly converts file paths between forward-slash (Unix/macOS) and backslash (Windows) formats. Paste a path, and get both formats with one-click copy buttons.

### Key Features

- **Instant conversion** — Real-time conversion as you type
- **Bidirectional** — Unix to Windows and Windows to Unix
- **One-click copy** — Copy either format to clipboard
- **Batch support** — Convert multiple paths at once (one per line)

## Architecture

This is the simplest tool in LocalKit — no libraries, no WASM, just a few lines of string manipulation. It's a good example of how not every tool needs heavy infrastructure.

### Processing Pipeline

1. **Input** — User types or pastes a file path.
2. **Conversion** — Simple string replacement: `/` to `\` and `\` to `/`.
3. **Display** — Both formats are shown with copy buttons.

### Code Structure

```
src/pages/tools/path-converter.astro   → Page with SEO
src/components/path-converter/
  PathConverterApp.tsx                → Main React component (self-contained)
```

No library file needed — the logic is trivial enough to be inline.

## Privacy & Security

All conversion happens locally. File paths can sometimes reveal directory structure or usernames — this tool ensures your paths are never sent anywhere.

## Technical Details

- **No dependencies** — Pure string manipulation
- **Zero bundle cost** — No additional JavaScript libraries loaded
- **Browser support**: All browsers

## FAQs

### Does it handle UNC paths?
Yes — Windows UNC paths like `\\server\share\folder` are preserved correctly when converting. The leading `\\` is maintained.

### Does it handle mixed slashes?
Yes — paths with mixed separators (e.g., `C:\Users/name/Documents\file.txt`) are normalized to a consistent format in both output variants.

### Does it handle drive letters?
Yes — Windows drive letters like `C:\` are preserved in the Windows format and converted to `/c/` or similar in the Unix format.
