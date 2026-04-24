---
title: "Paragraph Generator"
description: "How the Paragraph Generator creates lorem ipsum and realistic fake paragraphs locally."
tool: "paragraph-generator"
accent: "cyan"
icon: "FileText"
lastUpdated: 2026-04-24
order: 11
---

## What It Does

The Paragraph Generator creates placeholder copy for layouts, mockups, and test content. It supports classic lorem ipsum and readable fake paragraphs powered by the maintained `@faker-js/faker` package.

### Key Features

- **Two source modes** — Generate classic lorem ipsum or realistic fake paragraphs
- **Configurable output** — Set paragraph count, sentence count, headings, and separators
- **Tone presets** — Use business, product, technical, or everyday paragraph styles
- **Repeatable seed** — Recreate the same generated copy when needed
- **Saved preferences** — Settings are stored in local storage and restored next time
- **Copy or download** — Copy text to the clipboard or save it as a `.txt` file

## Architecture

The tool is a lightweight React island with a small preference helper. Lorem ipsum generation uses a local word list, while realistic paragraph generation uses `@faker-js/faker`, the community-maintained fork of the original Faker package.

### Processing Pipeline

1. **Load preferences** — Configuration is read from local storage and sanitized.
2. **Choose source** — The app selects lorem ipsum generation or faker-backed realistic text.
3. **Generate paragraphs** — Paragraph count, sentence count, headings, tone, separator, and optional seed are applied.
4. **Display output** — Generated text is shown in an editable text area with word and character counts.
5. **Persist settings** — Configuration changes are saved back to local storage.

### Code Structure

```
src/pages/tools/paragraph-generator.astro        → Page with SEO
src/components/paragraph-generator/
  ParagraphGeneratorApp.tsx                      → Main React component
  preferences.ts                                 → Local storage defaults and sanitization
```

## Privacy

Everything runs in the browser. Generated paragraphs are never uploaded, and only the tool settings are stored in local storage. The generated text itself is kept in memory unless you copy or download it.

## Technical Details

- **Generator package**: `@faker-js/faker`
- **Persistence**: `localStorage`
- **Output formats**: Editable text area, clipboard, and plain text download
- **Seed support**: Optional repeatable generation for stable mockups and tests
- **Browser support**: All modern browsers with standard clipboard, Blob, and local storage APIs

## FAQs

### Why use `@faker-js/faker` instead of `faker`?

`@faker-js/faker` is the maintained community fork. The old `faker` package is not the right dependency for modern Faker usage.

### Are the realistic paragraphs real data?

No. They are synthetic paragraphs assembled from faker-generated names, companies, products, places, and technical terms. They may look plausible, but they are fake.

### Can I restore the original settings?

Yes. Use **Reset** to return to the default lorem ipsum setup: four paragraphs, four sentences each, blank-line separators, no headings, and no repeatable seed.
