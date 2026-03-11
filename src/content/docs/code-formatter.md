---
title: "Code Formatter"
description: "How the Code Formatter works — format 25+ languages with Prettier and Clang-format WASM."
tool: "code-formatter"
accent: "teal"
icon: "🔧"
lastUpdated: 2026-03-10
order: 9
---

## What It Does

The Code Formatter beautifies and formats code in 25+ languages. Paste messy code, select the language, and get clean, consistently formatted output. It also provides syntax highlighting and the ability to export formatted code as images.

### Key Features

- **25+ languages** — JavaScript, TypeScript, HTML, CSS, JSON, C, C++, Java, C#, Python, Go, Rust, and more
- **Dual formatting engines** — Prettier for web languages, Clang-format for C-family languages
- **Syntax highlighting** — Color-coded output using Shiki
- **Image export** — Download a screenshot of your formatted code
- **Configurable options** — Tab size, print width, quote style, and more

## Architecture

The formatter uses two engines depending on the language:

- **[Prettier](https://prettier.io/)** — For JavaScript, TypeScript, HTML, CSS, JSON, Markdown, YAML, GraphQL, and other web languages
- **[Clang-format](https://clang.llvm.org/docs/ClangFormat.html)** (compiled to WASM) — For C, C++, Java, C#, Objective-C, and other C-family languages

Syntax highlighting is powered by [Shiki](https://shiki.style/), the same engine used by VS Code.

### Processing Pipeline

1. **Input** — User pastes code and selects a language.
2. **Engine selection** — Based on the language, either Prettier or Clang-format WASM is loaded.
3. **Formatting** — The code is passed through the selected formatter with the configured options.
4. **Highlighting** — The formatted output is syntax-highlighted by Shiki.
5. **Display** — The highlighted code is rendered with line numbers.
6. **Export** — Optionally, the rendered code can be captured as a PNG using html-to-image.

### Code Structure

```
src/pages/tools/code-formatter.astro   → Page with SEO
src/components/code-formatter/
  CodeFormatterApp.tsx                → Main React component
src/lib/formatter.ts                  → Formatting + highlighting logic
```

The `formatter.ts` library abstracts over both Prettier and Clang-format, presenting a unified `format(code, language, options)` API. Clang-format WASM is loaded lazily only when a C-family language is selected.

## Privacy & Security

All formatting happens locally in your browser. Your code is never sent to any server. Both Prettier (JavaScript) and Clang-format (WASM) run entirely client-side.

## Technical Details

- **Prettier**: JavaScript bundle (~500KB gzipped), supports 15+ languages
- **Clang-format WASM**: ~3MB (loaded on demand for C-family languages)
- **Syntax highlighting**: Shiki with VS Code themes
- **Image export**: html-to-image library for PNG screenshots
- **Browser support**: All modern browsers

## FAQs

### Why are there two formatting engines?
Prettier is the gold standard for web languages but doesn't support C-family languages. Clang-format is the standard formatter for C/C++/Java/C#. Using both gives you the best formatter for each language.

### Can I customize the formatting style?
Yes — you can adjust tab size, print width, quote style (single vs. double), and other options. These map to Prettier and Clang-format configuration options under the hood.

### Does it auto-detect the language?
Not currently — you need to select the language from the dropdown. Auto-detection based on syntax patterns is planned for a future update.

### How does the image export work?
The formatted, syntax-highlighted code is captured as a PNG screenshot using the html-to-image library. This renders the DOM element to a canvas and exports it as an image — useful for sharing code snippets on social media or in presentations.
