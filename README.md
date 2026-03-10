# localkit.dev

A suite of powerful, privacy-first developer and utility tools that run entirely in your browser.

## Overview

localkit.dev is a collection of essential tools built with Astro and React. What makes localkit.dev special is that **all processing happens locally on your device**. By leveraging WebAssembly (WASM) and in-browser machine learning, powerful utilities like video conversion, image manipulation, and PDF processing run directly in your browser without ever uploading your sensitive data to a remote server.

## Features

- **Privacy First**: Zero server uploads. Your files never leave your device.
- **Offline Capable**: Once loaded, tools can function without an active internet connection.
- **Lightning Fast**: Utilizing WebAssembly for near-native performance directly in your browser.
- **Comprehensive Toolset**: A wide range of utilities for developers, designers, and everyday users.

## Available Tools

- **Code Formatter**: Format your code quickly and securely using Prettier and Clang-Format (via WASM).
- **Image Converter**: Convert between various image formats utilizing ImageMagick WASM.
- **Info Redactor**: Redact sensitive information from text and documents using in-browser NLP and Transformers.js.
- **Markdown Preview**: Real-time markdown rendering and preview.
- **Path Converter**: Easily convert file paths between different operating system formats (e.g., Windows to Unix).
- **PDF Tools**: A comprehensive suite of PDF utilities powered by MuPDF WASM:
  - Compress PDF
  - Extract Pages
  - Merge PDFs
  - Convert PDF to Images
  - Extract Text from PDF
  - Split PDF
- **SVG Viewer**: View, inspect, and interact with SVG files.
- **Video Converter**: Convert and process videos directly in the browser using FFmpeg WASM.

## Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **UI Library**: [React](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **WASM & Processing Libraries**:
  - `@ffmpeg/ffmpeg` (Video Processing)
  - `@imagemagick/magick-wasm` (Image Processing)
  - `mupdf` (PDF Processing)
  - `@wasm-fmt/clang-format` & `prettier` (Code Formatting)
- **Machine Learning**: `@huggingface/transformers` & `compromise` (In-browser ML & NLP)

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended).

### Installation

1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

Start the Astro development server:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:4321` (or the port provided in your terminal).

## Testing

The project uses Vitest for unit and integration testing. To run the test suite:

```bash
npx vitest
```

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

See the LICENSE file for details.