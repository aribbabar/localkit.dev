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

function sanitizePotrace(value: unknown): PotraceOptions {
  const defaults = DEFAULT_POTRACE_OPTIONS;
  if (!value || typeof value !== "object") return { ...defaults };

  const candidate = value as Partial<PotraceOptions>;
  return {
    turdsize: clamp(candidate.turdsize, 0, 100, defaults.turdsize),
    turnpolicy: clamp(candidate.turnpolicy, 0, 6, defaults.turnpolicy),
    alphamax: clamp(candidate.alphamax, 0, 1.34, defaults.alphamax),
    opticurve: candidate.opticurve === 0 ? 0 : 1,
    opttolerance: clamp(
      candidate.opttolerance,
      0,
      1,
      defaults.opttolerance,
    ),
    extractcolors:
      typeof candidate.extractcolors === "boolean"
        ? candidate.extractcolors
        : defaults.extractcolors,
    posterizelevel: clamp(
      candidate.posterizelevel,
      1,
      255,
      defaults.posterizelevel,
    ),
    posterizationalgorithm: candidate.posterizationalgorithm === 1 ? 1 : 0,
  };
}

export function sanitizeImageToSvgPreferences(
  value: unknown,
): ImageToSvgPreferences {
  if (!value || typeof value !== "object") {
    return {
      potrace: { ...DEFAULT_IMAGE_TO_SVG_PREFERENCES.potrace },
    };
  }

  const candidate = value as {
    potrace?: unknown;
  };

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
    if (!raw) {
      return sanitizeImageToSvgPreferences(undefined);
    }
    return sanitizeImageToSvgPreferences(JSON.parse(raw));
  } catch {
    return sanitizeImageToSvgPreferences(undefined);
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
