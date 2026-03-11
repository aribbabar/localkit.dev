---
title: "Image Metadata"
description: "How the Image Metadata tool works — view, edit, and strip EXIF data from images locally."
tool: "image-metadata"
accent: "purple"
icon: "ScanSearch"
lastUpdated: 2026-03-10
order: 2
---

## What It Does

The Image Metadata tool lets you inspect and manage the hidden data embedded in your images — EXIF camera settings, GPS coordinates, IPTC captions, XMP metadata, and more. You can view all metadata fields, see GPS locations on a map, and strip sensitive data before sharing.

### Key Features

- **Full metadata display** — EXIF, GPS, IPTC, XMP, and ICC profile data
- **GPS visualization** — See photo locations on an interactive map
- **Metadata stripping** — Remove all or selected metadata fields
- **Multiple formats** — Works with JPEG, TIFF, PNG, HEIC, and WebP

## Architecture

The tool uses [exifr](https://github.com/nicolo-ribaudo/exifr), a fast JavaScript library for parsing image metadata. Unlike the image converter, this tool doesn't require WASM — pure JavaScript handles all parsing.

### Processing Pipeline

1. **File input** — User selects an image. The file is read as an `ArrayBuffer`.
2. **Metadata parsing** — exifr extracts all metadata segments (EXIF, GPS, IPTC, XMP, ICC).
3. **Display** — Metadata fields are grouped by category and rendered in a structured table.
4. **GPS mapping** — If GPS coordinates exist, they are plotted on an embedded map.
5. **Stripping** — To remove metadata, the raw image bytes are rewritten with metadata segments stripped.

### Code Structure

```
src/pages/tools/image-metadata.astro   → Page with SEO
src/components/image-metadata/
  ImageMetadataTool.tsx                → Main React component
src/lib/image-metadata.ts             → Parsing logic using exifr
```

## Privacy & Security

This tool is especially privacy-relevant — photos from smartphones often contain GPS coordinates, device info, and timestamps that you may not want to share. All processing happens in your browser. Your images and their metadata never leave your device.

## Technical Details

- **No WASM required** — Pure JavaScript metadata parsing
- **Supported formats**: JPEG, TIFF, PNG, HEIC, WebP
- **Metadata types**: EXIF, GPS, IPTC, XMP, ICC Profile
- **Library**: exifr (~45KB gzipped)
- **Browser support**: All modern browsers

## FAQs

### Why do my photos have GPS data?
Most smartphones embed GPS coordinates in photo metadata by default. This is useful for organizing photos by location, but can reveal your exact location when sharing images online. Use this tool to check and strip GPS data before sharing.

### Can I edit individual metadata fields?
Currently, the tool supports viewing all metadata and stripping it entirely. Selective field editing is planned for a future update.

### Does stripping metadata reduce image quality?
No. Metadata stripping only removes the non-pixel data segments from the file. The actual image pixels remain untouched and identical.
