// ── Types ────────────────────────────────────────────────────────────────

export type EngineType = "vtracer" | "potrace";

export interface VTracerOptions {
  mode: "polygon" | "spline" | "none";
  filterSpeckle: number;      // 0-128, default 4
  cornerThreshold: number;    // 0-180, default 60
  lengthThreshold: number;    // 3.5-10, default 4.0
  maxIterations: number;      // 1-20, default 10
  spliceThreshold: number;    // 0-180, default 45
  pathPrecision: number;      // 0-8, default 2
  invert: boolean;
  scale: number;              // 0.1-4, default 1
}

export interface PotraceOptions {
  turdsize: number;              // 0-100, default 2
  turnpolicy: number;            // 0-6, default 4 (MINORITY)
  alphamax: number;              // 0-1.34, default 1
  opticurve: number;             // 0|1, default 1
  opttolerance: number;          // 0-1, default 0.2
  extractcolors: boolean;        // default true
  posterizelevel: number;        // 1-255, default 2
  posterizationalgorithm: number; // 0|1, default 0
}

export interface ConversionOptions {
  engine: EngineType;
  vtracer: VTracerOptions;
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

// ── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_VTRACER_OPTIONS: VTracerOptions = {
  mode: "spline",
  filterSpeckle: 4,
  cornerThreshold: 60,
  lengthThreshold: 4.0,
  maxIterations: 10,
  spliceThreshold: 45,
  pathPrecision: 2,
  invert: false,
  scale: 1,
};

export const DEFAULT_POTRACE_OPTIONS: PotraceOptions = {
  turdsize: 2,
  turnpolicy: 4,
  alphamax: 1,
  opticurve: 1,
  opttolerance: 0.2,
  extractcolors: true,
  posterizelevel: 2,
  posterizationalgorithm: 0,
};

// ── Engine singletons ────────────────────────────────────────────────────

let vtracerModule: typeof import("vectortracer") | null = null;

async function getVTracer() {
  if (!vtracerModule) {
    vtracerModule = await import("vectortracer");
  }
  return vtracerModule;
}

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

// ── ImageData extraction ─────────────────────────────────────────────────

const POTRACE_MAX_DIM = 1024;

export async function extractImageData(
  file: File,
  maxDim?: number,
): Promise<ImageData> {
  let bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Downscale if needed to stay within WASM heap limits
  if (maxDim && (width > maxDim || height > maxDim)) {
    const scale = Math.min(maxDim / width, maxDim / height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);
    const old = bitmap;
    bitmap = await createImageBitmap(file, {
      resizeWidth: newW,
      resizeHeight: newH,
      resizeQuality: "high",
    });
    old.close();
    width = newW;
    height = newH;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return ctx.getImageData(0, 0, width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, width, height);
}

// ── VTracer conversion ───────────────────────────────────────────────────

async function convertWithVTracer(
  imageData: ImageData,
  options: VTracerOptions,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const vt = await getVTracer();

  const converter = new vt.BinaryImageConverter(
    imageData,
    {
      debug: false,
      mode: options.mode,
      cornerThreshold: options.cornerThreshold,
      lengthThreshold: options.lengthThreshold,
      maxIterations: options.maxIterations,
      spliceThreshold: options.spliceThreshold,
      filterSpeckle: options.filterSpeckle,
      pathPrecision: options.pathPrecision,
    },
    {
      invert: options.invert,
      pathFill: undefined,
      backgroundColor: undefined,
      attributes: undefined,
      scale: options.scale,
    },
  );

  converter.init();

  return new Promise<string>((resolve, reject) => {
    let freed = false;

    function safeFree() {
      if (freed) return;
      freed = true;
      try { converter.free(); } catch { /* WASM object may already be in a bad state */ }
    }

    function tick() {
      try {
        const done = converter.tick();
        onProgress?.(converter.progress());

        if (done) {
          const result = converter.getResult();
          safeFree();
          resolve(result);
        } else {
          setTimeout(tick, 0);
        }
      } catch (err) {
        safeFree();
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("parallel")) {
          reject(new Error("VTracer failed: the image contains geometry that causes a tracing error. Try using Potrace instead, or resize the image."));
        } else if (msg.includes("recursive use")) {
          reject(new Error("VTracer failed: internal WASM error. Try using Potrace instead, or resize the image."));
        } else {
          reject(err);
        }
      }
    }
    tick();
  });
}

// ── Potrace conversion ──────────────────────────────────────────────────

async function convertWithPotrace(
  file: File,
  options: PotraceOptions,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const pt = await getPotrace();
  onProgress?.(0);

  // Extract ImageData with downscaling to stay within WASM heap limits.
  // Passing ImageData directly also bypasses potrace's internal canvas creation.
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

// ── Batch conversion ─────────────────────────────────────────────────────

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
      const svgString =
        options.engine === "vtracer"
          ? await convertWithVTracer(
              await extractImageData(files[i]),
              options.vtracer,
              (p) => onProgress?.(i, p, files.length),
            )
          : await convertWithPotrace(
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
    } catch (err: any) {
      results.push({
        name,
        svgString: "",
        blob: new Blob([], { type: "image/svg+xml" }),
        buffer: new ArrayBuffer(0),
        error: err?.message ?? String(err),
      });
    }
  }

  onProgress?.(files.length, 0, files.length);
  return results;
}
