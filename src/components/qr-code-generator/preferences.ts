export const QR_CODE_GENERATOR_PREFERENCES_KEY = "localkit:qr-code-generator";

export type QrShape = "square" | "circle";
export type QrDotType =
  | "dots"
  | "rounded"
  | "classy"
  | "classy-rounded"
  | "square"
  | "extra-rounded";
export type QrCornerSquareType = "dot" | "square" | "extra-rounded" | QrDotType;
export type QrCornerDotType = "dot" | "square" | QrDotType;
export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type QrExportExtension = "png" | "jpeg" | "webp" | "svg";

export interface QrCodeGeneratorPreferences {
  size: number;
  margin: number;
  shape: QrShape;
  dotType: QrDotType;
  dotColor: string;
  cornerSquareType: QrCornerSquareType;
  cornerSquareColor: string;
  cornerDotType: QrCornerDotType;
  cornerDotColor: string;
  backgroundColor: string;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  imageUrl: string;
  imageSize: number;
  imageMargin: number;
  hideBackgroundDots: boolean;
  exportExtension: QrExportExtension;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const MIN_SIZE = 160;
const MAX_SIZE = 720;
const MIN_MARGIN = 0;
const MAX_MARGIN = 80;
const MIN_IMAGE_SIZE = 0.1;
const MAX_IMAGE_SIZE = 0.5;
const MIN_IMAGE_MARGIN = 0;
const MAX_IMAGE_MARGIN = 40;

const DOT_TYPES: QrDotType[] = [
  "dots",
  "rounded",
  "classy",
  "classy-rounded",
  "square",
  "extra-rounded",
];
const CORNER_SQUARE_TYPES: QrCornerSquareType[] = [
  "dot",
  "square",
  "extra-rounded",
  "dots",
  "rounded",
  "classy",
  "classy-rounded",
];
const CORNER_DOT_TYPES: QrCornerDotType[] = [
  "dot",
  "square",
  "dots",
  "rounded",
  "classy",
  "classy-rounded",
  "extra-rounded",
];
const ERROR_CORRECTION_LEVELS: QrErrorCorrectionLevel[] = ["L", "M", "Q", "H"];
const EXPORT_EXTENSIONS: QrExportExtension[] = ["png", "jpeg", "webp", "svg"];

export const DEFAULT_QR_CODE_GENERATOR_DATA = "https://localkit.dev";

export const DEFAULT_QR_CODE_GENERATOR_PREFERENCES: QrCodeGeneratorPreferences =
  {
    size: 320,
    margin: 12,
    shape: "square",
    dotType: "rounded",
    dotColor: "#0f766e",
    cornerSquareType: "extra-rounded",
    cornerSquareColor: "#14b8a6",
    cornerDotType: "dot",
    cornerDotColor: "#22c55e",
    backgroundColor: "#ffffff",
    errorCorrectionLevel: "Q",
    imageUrl: "",
    imageSize: 0.28,
    imageMargin: 6,
    hideBackgroundDots: true,
    exportExtension: "png",
  };

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

function sanitizeChoice<T extends string>(
  value: unknown,
  options: T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  return fallback;
}

function sanitizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeQrCodeGeneratorPreferences(
  value: unknown,
): QrCodeGeneratorPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_QR_CODE_GENERATOR_PREFERENCES };
  }

  const candidate = value as Partial<QrCodeGeneratorPreferences>;
  const defaults = DEFAULT_QR_CODE_GENERATOR_PREFERENCES;

  return {
    size: clampInteger(candidate.size, defaults.size, MIN_SIZE, MAX_SIZE),
    margin: clampInteger(
      candidate.margin,
      defaults.margin,
      MIN_MARGIN,
      MAX_MARGIN,
    ),
    shape: sanitizeChoice(
      candidate.shape,
      ["square", "circle"],
      defaults.shape,
    ),
    dotType: sanitizeChoice(candidate.dotType, DOT_TYPES, defaults.dotType),
    dotColor: sanitizeColor(candidate.dotColor, defaults.dotColor),
    cornerSquareType: sanitizeChoice(
      candidate.cornerSquareType,
      CORNER_SQUARE_TYPES,
      defaults.cornerSquareType,
    ),
    cornerSquareColor: sanitizeColor(
      candidate.cornerSquareColor,
      defaults.cornerSquareColor,
    ),
    cornerDotType: sanitizeChoice(
      candidate.cornerDotType,
      CORNER_DOT_TYPES,
      defaults.cornerDotType,
    ),
    cornerDotColor: sanitizeColor(
      candidate.cornerDotColor,
      defaults.cornerDotColor,
    ),
    backgroundColor: sanitizeColor(
      candidate.backgroundColor,
      defaults.backgroundColor,
    ),
    errorCorrectionLevel: sanitizeChoice(
      candidate.errorCorrectionLevel,
      ERROR_CORRECTION_LEVELS,
      defaults.errorCorrectionLevel,
    ),
    imageUrl: sanitizeString(candidate.imageUrl),
    imageSize: clampNumber(
      candidate.imageSize,
      defaults.imageSize,
      MIN_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
    ),
    imageMargin: clampInteger(
      candidate.imageMargin,
      defaults.imageMargin,
      MIN_IMAGE_MARGIN,
      MAX_IMAGE_MARGIN,
    ),
    hideBackgroundDots:
      typeof candidate.hideBackgroundDots === "boolean"
        ? candidate.hideBackgroundDots
        : defaults.hideBackgroundDots,
    exportExtension: sanitizeChoice(
      candidate.exportExtension,
      EXPORT_EXTENSIONS,
      defaults.exportExtension,
    ),
  };
}

export function loadQrCodeGeneratorPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): QrCodeGeneratorPreferences {
  try {
    const raw = storage?.getItem(QR_CODE_GENERATOR_PREFERENCES_KEY);
    if (!raw) return sanitizeQrCodeGeneratorPreferences(undefined);
    return sanitizeQrCodeGeneratorPreferences(JSON.parse(raw));
  } catch {
    return sanitizeQrCodeGeneratorPreferences(undefined);
  }
}

export function saveQrCodeGeneratorPreferences(
  preferences: QrCodeGeneratorPreferences,
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
) {
  try {
    storage?.setItem(
      QR_CODE_GENERATOR_PREFERENCES_KEY,
      JSON.stringify(sanitizeQrCodeGeneratorPreferences(preferences)),
    );
  } catch {
    // Storage may be unavailable or full.
  }
}
