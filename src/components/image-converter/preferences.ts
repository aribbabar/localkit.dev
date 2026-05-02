export const IMAGE_CONVERTER_PREFERENCES_KEY = "localkit:image-converter";

export interface ImageConverterPreferences {
  outputFormat: string;
  quality: number;
  resize: string;
  stripMetadata: boolean;
}

export const DEFAULT_IMAGE_CONVERTER_PREFERENCES: ImageConverterPreferences = {
  outputFormat: "png",
  quality: 90,
  resize: "",
  stripMetadata: false,
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function clampQuality(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_IMAGE_CONVERTER_PREFERENCES.quality;
  }

  return Math.min(100, Math.max(1, Math.round(value)));
}

export function sanitizeImageConverterPreferences(
  value: unknown,
): ImageConverterPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_IMAGE_CONVERTER_PREFERENCES };
  }

  const candidate = value as Partial<ImageConverterPreferences>;
  const outputFormat =
    typeof candidate.outputFormat === "string" && candidate.outputFormat.trim()
      ? candidate.outputFormat.trim().toLowerCase()
      : DEFAULT_IMAGE_CONVERTER_PREFERENCES.outputFormat;

  return {
    outputFormat,
    quality: clampQuality(candidate.quality),
    resize:
      typeof candidate.resize === "string"
        ? candidate.resize
        : DEFAULT_IMAGE_CONVERTER_PREFERENCES.resize,
    stripMetadata:
      typeof candidate.stripMetadata === "boolean"
        ? candidate.stripMetadata
        : DEFAULT_IMAGE_CONVERTER_PREFERENCES.stripMetadata,
  };
}

export function loadImageConverterPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): ImageConverterPreferences {
  try {
    const raw = storage?.getItem(IMAGE_CONVERTER_PREFERENCES_KEY);
    if (!raw) {
      return { ...DEFAULT_IMAGE_CONVERTER_PREFERENCES };
    }

    return sanitizeImageConverterPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_IMAGE_CONVERTER_PREFERENCES };
  }
}

export function saveImageConverterPreferences(
  preferences: ImageConverterPreferences,
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
) {
  try {
    storage?.setItem(
      IMAGE_CONVERTER_PREFERENCES_KEY,
      JSON.stringify(sanitizeImageConverterPreferences(preferences)),
    );
  } catch {
    // Storage may be unavailable or full.
  }
}
