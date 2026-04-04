import {
  DEFAULT_VTRACER_OPTIONS,
  DEFAULT_POTRACE_OPTIONS,
  type EngineType,
  type VTracerOptions,
  type PotraceOptions,
} from "../../lib/image-to-svg";

export const IMAGE_TO_SVG_PREFERENCES_KEY = "localkit:image-to-svg";

export interface ImageToSvgPreferences {
  engine: EngineType;
  vtracer: VTracerOptions;
  potrace: PotraceOptions;
}

export const DEFAULT_IMAGE_TO_SVG_PREFERENCES: ImageToSvgPreferences = {
  engine: "potrace",
  vtracer: { ...DEFAULT_VTRACER_OPTIONS },
  potrace: { ...DEFAULT_POTRACE_OPTIONS },
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeVTracer(v: unknown): VTracerOptions {
  const d = DEFAULT_VTRACER_OPTIONS;
  if (!v || typeof v !== "object") return { ...d };
  const c = v as Partial<VTracerOptions>;
  return {
    mode: c.mode === "polygon" || c.mode === "spline" || c.mode === "none" ? c.mode : d.mode,
    filterSpeckle: clamp(c.filterSpeckle, 0, 128, d.filterSpeckle),
    cornerThreshold: clamp(c.cornerThreshold, 0, 180, d.cornerThreshold),
    lengthThreshold: clamp(c.lengthThreshold, 3.5, 10, d.lengthThreshold),
    maxIterations: clamp(c.maxIterations, 1, 20, d.maxIterations),
    spliceThreshold: clamp(c.spliceThreshold, 0, 180, d.spliceThreshold),
    pathPrecision: clamp(c.pathPrecision, 0, 8, d.pathPrecision),
    invert: typeof c.invert === "boolean" ? c.invert : d.invert,
    scale: clamp(c.scale, 0.1, 4, d.scale),
  };
}

function sanitizePotrace(p: unknown): PotraceOptions {
  const d = DEFAULT_POTRACE_OPTIONS;
  if (!p || typeof p !== "object") return { ...d };
  const c = p as Partial<PotraceOptions>;
  return {
    turdsize: clamp(c.turdsize, 0, 100, d.turdsize),
    turnpolicy: clamp(c.turnpolicy, 0, 6, d.turnpolicy),
    alphamax: clamp(c.alphamax, 0, 1.34, d.alphamax),
    opticurve: c.opticurve === 0 ? 0 : 1,
    opttolerance: clamp(c.opttolerance, 0, 1, d.opttolerance),
    extractcolors: typeof c.extractcolors === "boolean" ? c.extractcolors : d.extractcolors,
    posterizelevel: clamp(c.posterizelevel, 1, 255, d.posterizelevel),
    posterizationalgorithm: c.posterizationalgorithm === 1 ? 1 : 0,
  };
}

export function sanitizeImageToSvgPreferences(value: unknown): ImageToSvgPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_IMAGE_TO_SVG_PREFERENCES };
  }

  const candidate = value as Partial<ImageToSvgPreferences>;

  return {
    engine: candidate.engine === "potrace" ? "potrace" : "vtracer",
    vtracer: sanitizeVTracer(candidate.vtracer),
    potrace: sanitizePotrace(candidate.potrace),
  };
}

export function loadImageToSvgPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): ImageToSvgPreferences {
  try {
    const raw = storage?.getItem(IMAGE_TO_SVG_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_IMAGE_TO_SVG_PREFERENCES };
    return sanitizeImageToSvgPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_IMAGE_TO_SVG_PREFERENCES };
  }
}

export function saveImageToSvgPreferences(
  preferences: ImageToSvgPreferences,
  storage: StorageLike | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
) {
  try {
    storage?.setItem(
      IMAGE_TO_SVG_PREFERENCES_KEY,
      JSON.stringify(sanitizeImageToSvgPreferences(preferences)),
    );
  } catch {
    // Storage may be unavailable or full.
  }
}
