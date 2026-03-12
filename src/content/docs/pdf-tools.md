---
title: "PDF Tools"
description: "How the PDF Tools suite works — merge, split, compress, convert to images, text, or Word using MuPDF WASM."
tool: "pdf-tools"
accent: "red"
icon: "FileType"
lastUpdated: 2026-03-12
order: 5
---

## What It Does

The PDF Tools suite provides seven operations for working with PDF files — all running locally in your browser:

- **Merge** — Combine multiple PDF files into one
- **Split** — Split a PDF into individual single-page files
- **Extract Pages** — Pull specific pages out of a PDF
- **PDF to Images** — Convert pages to PNG or JPEG
- **PDF to Text** — Extract text or HTML content from pages
- **PDF to Word** — Convert PDF to editable Word document (.docx)
- **Compress** — Reduce PDF file size by optimizing content

### Key Features

- **Tabbed interface** — Switch between all seven tools without leaving the page
- **Drag-and-drop reordering** — Rearrange files and pages visually (merge tool)
- **Page range selection** — Specify exact pages to extract or convert
- **Multiple output formats** — PNG, JPEG for images; plain text, HTML for text extraction; Word (.docx) for editable documents
- **Batch processing** — Process multiple PDFs in sequence

## Architecture

The entire suite is powered by [MuPDF](https://mupdf.com/), a lightweight PDF/XPS/EPUB rendering library compiled to WebAssembly, combined with the [docx](https://docx.js.org/) library for Word document generation.

### Processing Pipeline

1. **File input** — User drops PDF files. Each file is read as a `Uint8Array`.
2. **WASM init** — MuPDF WASM (~12MB) loads lazily on first interaction.
3. **Document open** — PDFs are opened in memory via `mupdf.Document.openDocument()`.
4. **Operation** — The selected tool runs its operation (merge pages, render to image, extract text, etc.).
5. **Output** — Results are generated using `saveToBuffer()` for PDFs, or canvas rendering for images. Downloads are offered as Blob URLs.

### Code Structure

```
src/pages/tools/pdf-tools.astro         → Page with SEO
src/components/pdf-tools/
  PdfToolsApp.tsx                       → Main app with tab switching
  shared.tsx                            → Shared components and utilities
  tools/
    MergePdf.tsx                        → Merge tool
    SplitPdf.tsx                        → Split tool
    ExtractPages.tsx                    → Page extraction tool
    PdfToImages.tsx                     → PDF to image converter
    PdfToText.tsx                       → Text extraction tool
    PdfToWord.tsx                       → Word conversion tool
    CompressPdf.tsx                     → Compression tool
src/lib/mupdf.ts                        → MuPDF WASM singleton
```

### Tab Architecture

Unlike other tools that each get their own page, the PDF suite uses a single-page tabbed interface. `PdfToolsApp.tsx` manages tab state and renders the active tool component. All seven tools share the same MuPDF WASM instance through the singleton in `mupdf.ts`.

## Privacy & Security

PDFs often contain sensitive information — contracts, financial documents, personal records. All processing happens entirely in your browser. Your PDFs are never uploaded anywhere. The MuPDF WASM module processes documents in memory and results are generated as downloadable Blob URLs.

## Technical Details

- **WASM module size**: ~12MB (loaded on demand, cached by browser)
- **PDF engine**: MuPDF (the same engine behind SumatraPDF)
- **In-memory processing**: Uses `saveToBuffer()` to avoid filesystem access
- **Image output**: PNG or JPEG at configurable DPI/quality
- **Text output**: Plain text or structured HTML
- **Word output**: .docx with preserved text formatting and embedded images via the `docx` library
- **Browser support**: All modern browsers with WebAssembly support

## FAQs

### Can I merge PDFs with different page sizes?
Yes. MuPDF preserves each page's original dimensions when merging. The resulting PDF will contain pages of varying sizes, exactly as they were in the source files.

### How does PDF compression work?
The compress tool re-processes the PDF through MuPDF, which can optimize object streams, remove redundant data, and recompress images. The level of compression depends on how the original PDF was created — already-optimized PDFs may see minimal size reduction.

### Is there a page limit?
There's no hard limit on page count, but very large PDFs (1000+ pages) may be slow to process due to memory constraints. For best results, work with PDFs under 200 pages.

### Can I password-protect a PDF?
Not currently. Password protection and encryption are planned for a future update.

### Does the text extraction preserve formatting?
The HTML output mode preserves basic formatting (paragraphs, headings, font styles). Plain text mode extracts raw text without formatting. Neither mode perfectly reproduces the original layout, as PDF text extraction is inherently approximate.

### How accurate is the PDF to Word conversion?
The converter preserves text content, font styles (bold, italic), font sizes, and embedded images. It maps PDF fonts to standard Word fonts (Arial, Times New Roman, Courier New) and detects headings based on font size. Complex layouts like multi-column text or precise positioning will be approximated — PDF is a fixed-layout format while Word is flow-layout. For best results, use it with text-heavy documents like reports, articles, and letters.
