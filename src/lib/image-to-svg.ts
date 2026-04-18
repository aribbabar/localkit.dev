export type PotracePresetId =
  | "balanced"
  | "logo"
  | "illustration"
  | "photo";

export interface PotraceOptions {
  turdsize: number;
  turnpolicy: number;
  alphamax: number;
  opticurve: number;
  opttolerance: number;
  extractcolors: boolean;
  posterizelevel: number;
  posterizationalgorithm: number;
}

export interface ConversionOptions {
  potrace: PotraceOptions;
}

export interface SvgResult {
  name: string;
  svgString: string;
  blob: Blob;
  buffer: ArrayBuffer;
  error?: string;
}

export type ProgressCallback = (
  fileIndex: number,
  fileProgress: number,
  totalFiles: number,
) => void;

export const POTRACE_PRESETS: Record<
  PotracePresetId,
  {
    label: string;
    description: string;
    options: PotraceOptions;
  }
> = {
  balanced: {
    label: "Balanced",
    description: "Closer visual match without making the SVG too noisy.",
    options: {
      turdsize: 1,
      turnpolicy: 4,
      alphamax: 0.85,
      opticurve: 1,
      opttolerance: 0.1,
      extractcolors: true,
      posterizelevel: 5,
      posterizationalgorithm: 1,
    },
  },
  logo: {
    label: "Logo",
    description: "Simpler, cleaner output for marks, icons, and flat shapes.",
    options: {
      turdsize: 6,
      turnpolicy: 4,
      alphamax: 0.35,
      opticurve: 1,
      opttolerance: 0.2,
      extractcolors: false,
      posterizelevel: 2,
      posterizationalgorithm: 0,
    },
  },
  illustration: {
    label: "Illustration",
    description: "Preserves more color and contour detail in artwork.",
    options: {
      turdsize: 1,
      turnpolicy: 4,
      alphamax: 0.95,
      opticurve: 1,
      opttolerance: 0.08,
      extractcolors: true,
      posterizelevel: 7,
      posterizationalgorithm: 1,
    },
  },
  photo: {
    label: "Photo",
    description: "Higher detail tracing for textured or tonal images.",
    options: {
      turdsize: 0,
      turnpolicy: 4,
      alphamax: 1.1,
      opticurve: 1,
      opttolerance: 0.05,
      extractcolors: true,
      posterizelevel: 10,
      posterizationalgorithm: 1,
    },
  },
};

export const DEFAULT_POTRACE_OPTIONS: PotraceOptions = {
  ...POTRACE_PRESETS.balanced.options,
};

let potraceModule: typeof import("esm-potrace-wasm") | null = null;
let potraceInitialized = false;

async function getPotrace() {
  if (!potraceModule) {
    potraceModule = await import("esm-potrace-wasm");
  }
  if (!potraceInitialized) {
    await potraceModule.init();
    potraceInitialized = true;
  }
  return potraceModule;
}

const POTRACE_MAX_DIM = 1024;

async function loadBitmap(
  file: File,
  maxDim?: number,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  let bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (maxDim && (width > maxDim || height > maxDim)) {
    const scale = Math.min(maxDim / width, maxDim / height);
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);
    const originalBitmap = bitmap;
    bitmap = await createImageBitmap(file, {
      resizeWidth: newWidth,
      resizeHeight: newHeight,
      resizeQuality: "high",
    });
    originalBitmap.close();
    width = newWidth;
    height = newHeight;
  }

  return { bitmap, width, height };
}

export async function extractImageData(
  file: File,
  maxDim?: number,
): Promise<ImageData> {
  const { bitmap, width, height } = await loadBitmap(file, maxDim);

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create offscreen canvas context");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return ctx.getImageData(0, 0, width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Failed to create canvas context");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, width, height);
}

async function convertWithPotrace(
  file: File,
  options: PotraceOptions,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const pt = await getPotrace();
  onProgress?.(0);

  const imageData = await extractImageData(file, POTRACE_MAX_DIM);

  const svg = await pt.potrace(imageData, {
    turdsize: options.turdsize,
    turnpolicy: options.turnpolicy,
    alphamax: options.alphamax,
    opticurve: options.opticurve,
    opttolerance: options.opttolerance,
    pathonly: false,
    extractcolors: options.extractcolors,
    posterizelevel: options.posterizelevel,
    posterizationalgorithm: options.posterizationalgorithm,
  });
  onProgress?.(1);

  return svg;
}

function changeExtension(filename: string, ext: string): string {
  const dotIndex = filename.lastIndexOf(".");
  const baseName = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  return `${baseName}.${ext}`;
}

export async function convertBatch(
  files: File[],
  options: ConversionOptions,
  onProgress?: ProgressCallback,
): Promise<SvgResult[]> {
  const results: SvgResult[] = [];

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, 0, files.length);
    const name = changeExtension(files[i].name, "svg");

    try {
      const svgString = await convertWithPotrace(
        files[i],
        options.potrace,
        (p) => onProgress?.(i, p, files.length),
      );

      const buffer = new TextEncoder().encode(svgString).buffer as ArrayBuffer;
      results.push({
        name,
        svgString,
        blob: new Blob([svgString], { type: "image/svg+xml" }),
        buffer,
      });
    } catch (err: unknown) {
      results.push({
        name,
        svgString: "",
        blob: new Blob([], { type: "image/svg+xml" }),
        buffer: new ArrayBuffer(0),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  onProgress?.(files.length, 0, files.length);
  return results;
}
