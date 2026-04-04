import {
  DEFAULT_POTRACE_OPTIONS,
  type PotraceOptions,
} from "../../lib/image-to-svg";

export const IMAGE_TO_SVG_PREFERENCES_KEY = "localkit:image-to-svg";

export interface ImageToSvgPreferences {
  potrace: PotraceOptions;
}

export const DEFAULT_IMAGE_TO_SVG_PREFERENCES: ImageToSvgPreferences = {
  potrace: { ...DEFAULT_POTRACE_OPTIONS },
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function clamp(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
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
    extractcolors:
      typeof c.extractcolors === "boolean" ? c.extractcolors : d.extractcolors,
    posterizelevel: clamp(c.posterizelevel, 1, 255, d.posterizelevel),
    posterizationalgorithm: c.posterizationalgorithm === 1 ? 1 : 0,
  };
}

export function sanitizeImageToSvgPreferences(
  value: unknown,
): ImageToSvgPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_IMAGE_TO_SVG_PREFERENCES };
  }

  const candidate = value as { potrace?: unknown };

  return {
    potrace: sanitizePotrace(candidate.potrace),
  };
}

export function loadImageToSvgPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
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
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
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
