---
title: "Password Generator"
description: "How the Password Generator works — generate cryptographically strong passwords locally."
tool: "password-generator"
accent: "indigo"
icon: "KeyRound"
lastUpdated: 2026-03-10
order: 8
---

## What It Does

The Password Generator creates strong, random passwords with customizable length and character options. Choose which character types to include (uppercase, lowercase, numbers, symbols), set the length, and generate passwords instantly.

### Key Features

- **Cryptographic randomness** — Uses the Web Crypto API for true random generation
- **Customizable rules** — Toggle uppercase, lowercase, numbers, and symbols
- **Adjustable length** — From short PINs to long passphrases
- **Strength indicator** — Visual feedback on password strength
- **One-click copy** — Copy generated passwords to clipboard instantly

## Architecture

This is one of the simplest tools in LocalKit — no WASM, no external libraries. It uses the browser's built-in `crypto.getRandomValues()` API for cryptographically secure random number generation.

### Processing Pipeline

1. **Configuration** — User sets length and character type preferences.
2. **Character pool** — A character set is built from the selected types (uppercase, lowercase, digits, symbols).
3. **Random generation** — `crypto.getRandomValues()` generates random indices into the character pool.
4. **Strength calculation** — Entropy is calculated as `log2(poolSize^length)` and mapped to a strength label.
5. **Display** — The password is displayed with a copy button and strength indicator.

### Code Structure

```
src/pages/tools/password-generator.astro   → Page with SEO
src/components/password-generator/
  PasswordGeneratorApp.tsx                → Main React component (self-contained)
```

No separate library file is needed — the generation logic is simple enough to live directly in the component.

## Privacy & Security

Password generation is entirely local. The Web Crypto API provides cryptographically secure randomness sourced from the operating system's random number generator. Generated passwords are never transmitted, stored, or logged. They exist only in your browser's memory until you navigate away.

## Technical Details

- **No WASM, no libraries** — Pure browser APIs
- **RNG**: `crypto.getRandomValues()` (CSPRNG)
- **Character sets**: Uppercase (A-Z), lowercase (a-z), digits (0-9), symbols (!@#$%^&*...)
- **Entropy calculation**: `log2(poolSize ^ length)` bits
- **Browser support**: All modern browsers (Web Crypto API is universally supported)

## FAQs

### Is `crypto.getRandomValues()` truly random?
Yes — it's a cryptographically secure pseudo-random number generator (CSPRNG) that draws entropy from the operating system. It's the same API used by password managers and cryptographic libraries in the browser.

### What makes a password "strong"?
Password strength is measured in bits of entropy. A password with 80+ bits of entropy (e.g., 14+ characters with mixed types) is considered very strong. The strength indicator reflects this calculation.

### Should I use symbols in my passwords?
Symbols increase the character pool size, boosting entropy per character. However, some systems restrict which symbols are allowed. If a site rejects your password, try generating one without symbols or with a longer length to compensate.
