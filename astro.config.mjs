// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://localkit.dev',

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['jszip', 'compromise'],
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'mupdf', '@huggingface/transformers', '@wasm-fmt/clang-format']
    },
  },

  integrations: [react(), sitemap()]
});