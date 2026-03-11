---
title: "Info Redactor"
description: "How the Info Redactor works — detect and redact sensitive data from text locally."
tool: "info-redactor"
accent: "indigo"
icon: "🔒"
lastUpdated: 2026-03-10
order: 7
---

## What It Does

The Info Redactor automatically detects and redacts sensitive information from text — names, emails, phone numbers, addresses, credit card numbers, SSNs, and more. Paste your text, review the detected entities, and export the redacted version.

### Key Features

- **Auto-detection** — Finds names, emails, phone numbers, addresses, dates, and financial data
- **Entity highlighting** — Color-coded highlights for different data types
- **Selective redaction** — Choose which entity types to redact
- **Custom patterns** — Add your own patterns to detect
- **Multiple output styles** — Replace with [REDACTED], black bars, or custom placeholders

## Architecture

The redactor uses a combination of [compromise](https://compromise.cool/) (a natural language processing library) for named entity recognition and custom regex patterns for structured data like emails, phone numbers, and SSNs.

### Processing Pipeline

1. **Input** — User pastes text into the editor.
2. **NLP analysis** — compromise parses the text to identify names, places, and organizations.
3. **Pattern matching** — Regex patterns scan for structured data (emails, phone numbers, SSNs, credit cards, dates, IP addresses).
4. **Entity display** — Detected entities are highlighted inline with color-coded labels.
5. **Redaction** — Selected entities are replaced with the chosen redaction style.
6. **Output** — Redacted text is available for copy or download.

### Code Structure

```
src/pages/tools/info-redactor.astro   → Page with SEO
src/components/info-redactor/
  InfoRedactorApp.tsx                 → Main React component
src/lib/redactor.ts                   → NLP + regex detection logic
```

## Privacy & Security

This tool is inherently about privacy — you're using it to protect sensitive data. All detection and redaction happens entirely in your browser. Your text is never sent to any server. The compromise NLP library runs locally in JavaScript, and all regex matching is performed in-memory.

## Technical Details

- **No WASM required** — JavaScript NLP + regex
- **NLP library**: compromise (~200KB gzipped) for named entity recognition
- **Detection types**: Names, emails, phone numbers, addresses, SSNs, credit card numbers, dates, IP addresses, URLs
- **Redaction styles**: [REDACTED] text, black bars, custom placeholders
- **Browser support**: All modern browsers

## FAQs

### How accurate is the name detection?
The compromise NLP library is good at detecting common English names, but may miss unusual names or misidentify common words as names. Always review the highlighted entities before finalizing redaction.

### Does it work with non-English text?
The NLP detection (names, places) is primarily designed for English text. However, structured patterns (emails, phone numbers, credit cards, SSNs) work regardless of language since they follow universal formats.

### Can I add custom redaction patterns?
Yes — you can add custom regex patterns to detect domain-specific sensitive data that the built-in patterns don't cover.

### Is the redaction reversible?
No. Once you export the redacted text, the original content in the redacted positions is permanently removed. Always keep a copy of the original text if you may need it later.
