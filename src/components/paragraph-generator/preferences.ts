export const PARAGRAPH_GENERATOR_PREFERENCES_KEY =
  "localkit:paragraph-generator";

export type ParagraphSource = "lorem" | "faker";
export type ParagraphTone = "business" | "product" | "technical" | "everyday";
export type ParagraphSeparator = "blank-line" | "line-break";

export interface ParagraphGeneratorPreferences {
  source: ParagraphSource;
  tone: ParagraphTone;
  paragraphCount: number;
  sentencesPerParagraph: number;
  separator: ParagraphSeparator;
  includeHeadings: boolean;
  useSeed: boolean;
  seed: number;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const MIN_PARAGRAPHS = 1;
const MAX_PARAGRAPHS = 12;
const MIN_SENTENCES = 2;
const MAX_SENTENCES = 8;
const MIN_SEED = 1;
const MAX_SEED = 999999;

export const DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES: ParagraphGeneratorPreferences =
  {
    source: "lorem",
    tone: "business",
    paragraphCount: 4,
    sentencesPerParagraph: 4,
    separator: "blank-line",
    includeHeadings: false,
    useSeed: false,
    seed: 2026,
  };

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function sanitizeSource(value: unknown): ParagraphSource {
  return value === "faker" || value === "lorem"
    ? value
    : DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES.source;
}

function sanitizeTone(value: unknown): ParagraphTone {
  return value === "business" ||
    value === "product" ||
    value === "technical" ||
    value === "everyday"
    ? value
    : DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES.tone;
}

function sanitizeSeparator(value: unknown): ParagraphSeparator {
  return value === "line-break" || value === "blank-line"
    ? value
    : DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES.separator;
}

export function sanitizeParagraphGeneratorPreferences(
  value: unknown,
): ParagraphGeneratorPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES };
  }

  const candidate = value as Partial<ParagraphGeneratorPreferences>;

  return {
    source: sanitizeSource(candidate.source),
    tone: sanitizeTone(candidate.tone),
    paragraphCount: clampInteger(
      candidate.paragraphCount,
      DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES.paragraphCount,
      MIN_PARAGRAPHS,
      MAX_PARAGRAPHS,
    ),
    sentencesPerParagraph: clampInteger(
      candidate.sentencesPerParagraph,
      DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES.sentencesPerParagraph,
      MIN_SENTENCES,
      MAX_SENTENCES,
    ),
    separator: sanitizeSeparator(candidate.separator),
    includeHeadings:
      typeof candidate.includeHeadings === "boolean"
        ? candidate.includeHeadings
        : DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES.includeHeadings,
    useSeed:
      typeof candidate.useSeed === "boolean"
        ? candidate.useSeed
        : DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES.useSeed,
    seed: clampInteger(
      candidate.seed,
      DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES.seed,
      MIN_SEED,
      MAX_SEED,
    ),
  };
}

export function loadParagraphGeneratorPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): ParagraphGeneratorPreferences {
  try {
    const raw = storage?.getItem(PARAGRAPH_GENERATOR_PREFERENCES_KEY);
    if (!raw) return sanitizeParagraphGeneratorPreferences(undefined);
    return sanitizeParagraphGeneratorPreferences(JSON.parse(raw));
  } catch {
    return sanitizeParagraphGeneratorPreferences(undefined);
  }
}

export function saveParagraphGeneratorPreferences(
  preferences: ParagraphGeneratorPreferences,
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
) {
  try {
    storage?.setItem(
      PARAGRAPH_GENERATOR_PREFERENCES_KEY,
      JSON.stringify(sanitizeParagraphGeneratorPreferences(preferences)),
    );
  } catch {
    // Storage may be unavailable or full.
  }
}
