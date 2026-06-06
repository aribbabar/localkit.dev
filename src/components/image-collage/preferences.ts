import type { CollageRatioPreset } from "../../lib/image-collage";

export const IMAGE_COLLAGE_MAKER_PREFERENCES_KEY =
  "localkit:image-collage-maker";

export type ImageCollageFitMode = "cover" | "contain";
export type ImageCollageOutputFormat = "png" | "jpeg" | "webp";

export interface ImageCollageMakerPreferences {
  ratioPreset: CollageRatioPreset;
  fitMode: ImageCollageFitMode;
  gap: number;
  cornerRadius: number;
  backgroundColor: string;
  outputFormat: ImageCollageOutputFormat;
  quality: number;
  viewerZoom: number;
}

export const MIN_IMAGE_COLLAGE_VIEWER_ZOOM = 50;
export const MAX_IMAGE_COLLAGE_VIEWER_ZOOM = 600;

export const DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES: ImageCollageMakerPreferences =
  {
    ratioPreset: "auto",
    fitMode: "cover",
    gap: 12,
    cornerRadius: 0,
    backgroundColor: "#111827",
    outputFormat: "png",
    quality: 92,
    viewerZoom: 100,
  };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const RATIO_PRESETS: CollageRatioPreset[] = [
  "auto",
  "square",
  "portrait",
  "landscape",
  "photo",
];
const FIT_MODES: ImageCollageFitMode[] = ["cover", "contain"];
const OUTPUT_FORMATS: ImageCollageOutputFormat[] = ["png", "jpeg", "webp"];

function sanitizeChoice<T extends string>(
  value: unknown,
  options: T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return Math.round(clampNumber(value, fallback, min, max));
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  return fallback;
}

export function sanitizeImageCollageMakerPreferences(
  value: unknown,
): ImageCollageMakerPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES };
  }

  const candidate = value as Partial<ImageCollageMakerPreferences>;
  const defaults = DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES;

  return {
    ratioPreset: sanitizeChoice(
      candidate.ratioPreset,
      RATIO_PRESETS,
      defaults.ratioPreset,
    ),
    fitMode: sanitizeChoice(candidate.fitMode, FIT_MODES, defaults.fitMode),
    gap: clampInteger(candidate.gap, defaults.gap, 0, 40),
    cornerRadius: clampInteger(
      candidate.cornerRadius,
      defaults.cornerRadius,
      0,
      32,
    ),
    backgroundColor: sanitizeColor(
      candidate.backgroundColor,
      defaults.backgroundColor,
    ),
    outputFormat: sanitizeChoice(
      candidate.outputFormat,
      OUTPUT_FORMATS,
      defaults.outputFormat,
    ),
    quality: clampInteger(candidate.quality, defaults.quality, 40, 100),
    viewerZoom: clampInteger(
      candidate.viewerZoom,
      defaults.viewerZoom,
      MIN_IMAGE_COLLAGE_VIEWER_ZOOM,
      MAX_IMAGE_COLLAGE_VIEWER_ZOOM,
    ),
  };
}

export function loadImageCollageMakerPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): ImageCollageMakerPreferences {
  try {
    const raw = storage?.getItem(IMAGE_COLLAGE_MAKER_PREFERENCES_KEY);
    if (!raw) return sanitizeImageCollageMakerPreferences(undefined);
    return sanitizeImageCollageMakerPreferences(JSON.parse(raw));
  } catch {
    return sanitizeImageCollageMakerPreferences(undefined);
  }
}

export function saveImageCollageMakerPreferences(
  preferences: ImageCollageMakerPreferences,
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
) {
  try {
    storage?.setItem(
      IMAGE_COLLAGE_MAKER_PREFERENCES_KEY,
      JSON.stringify(sanitizeImageCollageMakerPreferences(preferences)),
    );
  } catch {
    // Storage may be unavailable or full.
  }
}
