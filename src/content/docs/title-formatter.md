---
title: "Title Formatter"
description: "How the Title Formatter works — convert titles and headings between common case styles."
tool: "title-formatter"
accent: "teal"
icon: "FileText"
lastUpdated: 2026-05-02
order: 12
---

## What It Does

The Title Formatter converts pasted titles, headings, and short text snippets between common capitalization styles.

### Key Features

- **Title case** — Capitalizes headline-style words while keeping short connector words lowercase when appropriate
- **Sentence case** — Lowercases text and capitalizes sentence starts
- **Uppercase and lowercase** — Converts all letters in one step
- **First letter** — Capitalizes the first letter of each word
- **Alt case** — Alternates letter case across the text starting uppercase
- **Toggle case** — Alternates letter case across the text starting lowercase
- **Saved preference** — Remembers the selected format in local storage

## Architecture

The formatter uses small string utilities that run entirely in the browser. The React component handles input, output, copy state, and preference persistence.

### Processing Pipeline

1. **Input** — User pastes or types text.
2. **Mode selection** — The selected case mode is loaded from local storage and saved when changed.
3. **Formatting** — The shared formatter transforms the input immediately.
4. **Output** — The result is displayed and can be copied.

### Code Structure

```
src/pages/tools/title-formatter.astro             -> Page with SEO
src/components/title-formatter/
  TitleFormatterApp.tsx                           -> Main React component
  preferences.ts                                  -> Local storage defaults and sanitization
src/lib/title-formatting.ts                       -> Case conversion utilities
```

## Privacy & Security

All formatting happens locally in the browser. Input text is never uploaded or sent to a server. The only stored data is the selected formatting mode.

## Technical Details

- **Persistence**: `localStorage`
- **Dependencies**: No formatter dependencies
- **Browser support**: Modern browsers with Unicode regular expression support
