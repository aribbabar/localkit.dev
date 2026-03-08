// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['jszip', 'compromise'],
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'mupdf', '@huggingface/transformers', '@wasm-fmt/clang-format']
    },
  },

  integrations: [react()]
});