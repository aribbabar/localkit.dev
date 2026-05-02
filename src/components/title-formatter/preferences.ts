import {
  TITLE_FORMAT_MODES,
  type TitleFormatMode,
} from "../../lib/title-formatting";

export const TITLE_FORMATTER_PREFERENCES_KEY = "localkit:title-formatter";

export interface TitleFormatterPreferences {
  mode: TitleFormatMode;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const DEFAULT_TITLE_FORMATTER_PREFERENCES: TitleFormatterPreferences = {
  mode: "title",
};

function sanitizeMode(value: unknown): TitleFormatMode {
  return TITLE_FORMAT_MODES.includes(value as TitleFormatMode)
    ? (value as TitleFormatMode)
    : DEFAULT_TITLE_FORMATTER_PREFERENCES.mode;
}

export function sanitizeTitleFormatterPreferences(
  value: unknown,
): TitleFormatterPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_TITLE_FORMATTER_PREFERENCES };
  }

  const candidate = value as Partial<TitleFormatterPreferences>;

  return {
    mode: sanitizeMode(candidate.mode),
  };
}

export function loadTitleFormatterPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): TitleFormatterPreferences {
  try {
    const raw = storage?.getItem(TITLE_FORMATTER_PREFERENCES_KEY);
    if (!raw) return sanitizeTitleFormatterPreferences(undefined);
    return sanitizeTitleFormatterPreferences(JSON.parse(raw));
  } catch {
    return sanitizeTitleFormatterPreferences(undefined);
  }
}

export function saveTitleFormatterPreferences(
  preferences: TitleFormatterPreferences,
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
) {
  try {
    storage?.setItem(
      TITLE_FORMATTER_PREFERENCES_KEY,
      JSON.stringify(sanitizeTitleFormatterPreferences(preferences)),
    );
  } catch {
    // Storage may be unavailable or full.
  }
}
