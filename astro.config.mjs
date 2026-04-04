// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://localkit.dev",

  vite: {
    plugins: [tailwindcss(), wasm(), topLevelAwait()],
    optimizeDeps: {
      include: ["jszip", "compromise", "docx"],
      exclude: [
        "@ffmpeg/ffmpeg",
        "@ffmpeg/util",
        "mupdf",
        "@huggingface/transformers",
        "@wasm-fmt/clang-format",
        "esm-potrace-wasm",
      ],
    },
  },

  integrations: [react(), sitemap()],
});
