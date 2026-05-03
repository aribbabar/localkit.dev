// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

const mupdfBrowserShimPrefix = "\0localkit:mupdf-browser-node-shim:";

/** @param {string | undefined} importer */
const isMupdfDistImporter = (importer) => {
  return importer?.replaceAll("\\", "/").includes("/node_modules/mupdf/dist/");
};

/** @returns {import("vite").Plugin} */
const mupdfBrowserNodeShim = () => {
  return {
    name: "localkit:mupdf-browser-node-shim",
    enforce: "pre",
    /**
     * @param {string} source
     * @param {string | undefined} importer
     */
    resolveId(source, importer) {
      if (
        isMupdfDistImporter(importer) &&
        (source === "node:fs" || source === "module")
      ) {
        return `${mupdfBrowserShimPrefix}${source}`;
      }
    },
    /** @param {string} id */
    load(id) {
      if (id === `${mupdfBrowserShimPrefix}node:fs`) {
        return 'export const readFileSync = () => { throw new Error("node:fs is not available in the browser."); };';
      }

      if (id === `${mupdfBrowserShimPrefix}module`) {
        return 'export const createRequire = () => () => { throw new Error("module.createRequire is not available in the browser."); };';
      }
    },
  };
};

// https://astro.build/config
export default defineConfig({
  site: "https://localkit.dev",
  trailingSlash: "always",

  vite: {
    plugins: [mupdfBrowserNodeShim(), tailwindcss(), wasm(), topLevelAwait()],
    build: {
      chunkSizeWarningLimit: 1800,
    },
    optimizeDeps: {
      include: ["jszip", "compromise", "docx"],
      exclude: [
        "@ffmpeg/ffmpeg",
        "@ffmpeg/util",
        "mupdf",
        "@huggingface/transformers",
        "@wasm-fmt/clang-format",
        "esm-potrace-wasm",
        "svgtidy",
      ],
    },
  },

  integrations: [react(), sitemap()],
});
