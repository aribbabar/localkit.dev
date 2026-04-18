export interface SvgDownloadAsset {
  name: string;
  svgString: string;
  blob: Blob;
  buffer: ArrayBuffer;
}

export interface SvgOptimizationStats {
  originalBytes: number;
  optimizedBytes: number;
  bytesSaved: number;
  savedPercent: number;
}

export interface OptimizedSvgResult
  extends SvgDownloadAsset, SvgOptimizationStats {
  originalSvgString: string;
  error?: string;
}

export type SvgOptimizerProgressCallback = (
  fileIndex: number,
  fileProgress: number,
  totalFiles: number,
) => void;

let svgtidyModulePromise: Promise<typeof import("svgtidy")> | null = null;

function getSvgtidy() {
  if (!svgtidyModulePromise) {
    svgtidyModulePromise = import("svgtidy");
  }
  return svgtidyModulePromise;
}

function validateSvgMarkup(svgString: string) {
  if (!svgString.trim()) {
    throw new Error("SVG input is empty.");
  }

  if (!/<svg[\s>]/i.test(svgString)) {
    throw new Error("The provided content does not look like SVG markup.");
  }
}

function toArrayBuffer(text: string) {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

function buildSvgDownloadAsset(
  name: string,
  svgString: string,
): SvgDownloadAsset {
  const buffer = toArrayBuffer(svgString);
  return {
    name,
    svgString,
    blob: new Blob([svgString], { type: "image/svg+xml" }),
    buffer,
  };
}

export function isAcceptedSvgFile(file: File) {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

export async function optimizeSvgString(svgString: string) {
  validateSvgMarkup(svgString);
  const { optimize } = await getSvgtidy();
  return optimize(svgString);
}

export async function optimizeSvgAsset(name: string, svgString: string) {
  const optimizedSvgString = await optimizeSvgString(svgString);
  return buildSvgDownloadAsset(name, optimizedSvgString);
}

export async function optimizeNamedSvg(
  name: string,
  svgString: string,
): Promise<OptimizedSvgResult> {
  const originalBuffer = toArrayBuffer(svgString);
  const optimizedAsset = await optimizeSvgAsset(name, svgString);
  const bytesSaved = Math.max(
    0,
    originalBuffer.byteLength - optimizedAsset.buffer.byteLength,
  );

  return {
    ...optimizedAsset,
    originalSvgString: svgString,
    originalBytes: originalBuffer.byteLength,
    optimizedBytes: optimizedAsset.buffer.byteLength,
    bytesSaved,
    savedPercent:
      originalBuffer.byteLength > 0
        ? (bytesSaved / originalBuffer.byteLength) * 100
        : 0,
  };
}

export async function optimizeSvgFile(file: File) {
  const svgString = await file.text();
  return optimizeNamedSvg(file.name, svgString);
}

export async function optimizeSvgBatch(
  files: File[],
  onProgress?: SvgOptimizerProgressCallback,
): Promise<OptimizedSvgResult[]> {
  const results: OptimizedSvgResult[] = [];

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, 0, files.length);

    try {
      const result = await optimizeSvgFile(files[i]);
      results.push(result);
      onProgress?.(i, 1, files.length);
    } catch (err: unknown) {
      results.push({
        name: files[i].name,
        svgString: "",
        originalSvgString: "",
        blob: new Blob([], { type: "image/svg+xml" }),
        buffer: new ArrayBuffer(0),
        originalBytes: 0,
        optimizedBytes: 0,
        bytesSaved: 0,
        savedPercent: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  onProgress?.(files.length, 0, files.length);
  return results;
}
