---
title: "HTML to Markdown"
description: "How the HTML to Markdown tool works — convert HTML to clean Markdown with configurable stripping and GFM support."
tool: "html-to-markdown"
accent: "orange"
icon: "FileCode"
lastUpdated: 2026-03-29
order: 7
---

## What It Does

The HTML to Markdown tool converts HTML source code into clean, readable Markdown. Paste raw HTML or upload an `.html` file and get well-formatted Markdown output — with full control over how the conversion handles styles, scripts, images, and formatting preferences.

### Key Features

- **Configurable stripping** — Remove `<style>` tags and inline styles, `<script>` tags, or `<img>` elements before conversion
- **GFM support** — Tables, strikethrough, and task lists via the GFM plugin
- **Heading style** — Choose between ATX (`# Heading`) or Setext (underline) style headings
- **Bullet markers** — Pick `-`, `*`, or `+` for unordered lists
- **Code block style** — Fenced (triple backtick) or indented code blocks
- **Link style** — Inline `[text](url)` or referenced `[text][1]` links
- **File upload** — Load `.html` or `.htm` files directly from disk
- **Export options** — Copy Markdown to clipboard or download as `.md`

## Architecture

The tool uses [Turndown](https://github.com/mixmark-io/turndown), a lightweight HTML-to-Markdown converter (~14KB gzipped), along with [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) for GitHub Flavored Markdown extensions. No WASM is required — pure JavaScript handles all conversion.

### Processing Pipeline

1. **Input** — User pastes HTML into the editor or uploads an `.html` file via the File API.
2. **Preprocessing** — The HTML string is parsed using the browser's built-in `DOMParser`. Based on user options, `<style>`, `<script>`, and `<img>` elements are removed, and inline `style` attributes are stripped.
3. **Conversion** — The cleaned HTML is passed to a `TurndownService` instance configured with the user's formatting preferences (heading style, bullet marker, code block style, link style, line break handling).
4. **GFM plugin** — If GFM support is enabled, the `gfm` plugin is applied to handle tables, strikethrough, and task lists.
5. **Output** — The resulting Markdown string is displayed in a read-only output pane.

### Code Structure

```
src/pages/tools/html-to-markdown.astro    → Page with SEO
src/components/html-to-markdown/
  HtmlToMarkdownApp.tsx                   → Main React component
src/lib/html-to-markdown.ts               → Turndown configuration and conversion
```

## Conversion Options

| Option               | Default | Description                                                    |
| -------------------- | ------- | -------------------------------------------------------------- |
| Strip Styles         | On      | Removes `<style>` tags and inline `style` attributes           |
| Strip Scripts        | On      | Removes all `<script>` tags                                    |
| Strip Images         | Off     | Removes all `<img>` elements (useful for text-only extraction) |
| GFM Support          | On      | Enables tables, strikethrough, and task list conversion        |
| Preserve Line Breaks | Off     | Converts `<br>` tags to Markdown line breaks                   |
| Heading Style        | ATX     | `# Heading` (ATX) vs underlined (Setext)                       |
| Bullet Marker        | `-`     | Unordered list marker: `-`, `*`, or `+`                        |
| Code Blocks          | Fenced  | Triple backtick (fenced) vs 4-space indent                     |
| Link Style           | Inline  | `[text](url)` (inline) vs `[text][1]` (referenced)             |

All options are persisted to `localStorage`, so your preferences are remembered between sessions.

## Privacy & Security

All HTML parsing and Markdown conversion happens locally in your browser. Your content is never sent to any server. The preprocessing step uses the browser's native `DOMParser`, and the output is plain-text Markdown — no risk of script execution from the input HTML.

## Technical Details

- **No WASM required** — Pure JavaScript conversion
- **Parser**: Turndown (~14KB gzipped) + GFM plugin
- **Preprocessing**: Browser-native `DOMParser` for robust HTML sanitization
- **Supported output**: CommonMark + GitHub Flavored Markdown (tables, strikethrough, task lists)
- **Browser support**: All modern browsers

## FAQs

### What HTML input works best?

The tool handles any valid HTML — from simple snippets to full pages with `<html>`, `<head>`, and `<body>` tags. For best results, use well-structured semantic HTML. The preprocessor will strip away styles and scripts automatically if those options are enabled.

### How does it handle complex tables?

With GFM support enabled, HTML `<table>` elements are converted to Markdown pipe tables. Simple tables with headers convert cleanly. Nested tables or tables with complex colspan/rowspan attributes may produce simplified output.

### Can I convert a full webpage?

Yes — you can paste the full HTML source of any webpage. Enable "Strip Styles" and "Strip Scripts" (both on by default) to get clean Markdown from the page content. You can also enable "Strip Images" if you only want the text.

### How is this different from Markdown Preview?

They are complementary tools. **Markdown Preview** converts Markdown to HTML (for previewing). **HTML to Markdown** converts HTML to Markdown (for content extraction and migration). Together they cover both directions of the HTML/Markdown conversion.
