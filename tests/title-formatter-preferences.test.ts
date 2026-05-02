import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TITLE_FORMATTER_PREFERENCES,
  TITLE_FORMATTER_PREFERENCES_KEY,
  loadTitleFormatterPreferences,
  saveTitleFormatterPreferences,
  sanitizeTitleFormatterPreferences,
} from "../src/components/title-formatter/preferences";

describe("title formatter preferences", () => {
  it("loads saved preferences from storage", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ mode: "toggle" })),
      setItem: vi.fn(),
    };

    expect(loadTitleFormatterPreferences(storage)).toEqual({ mode: "toggle" });
  });

  it("falls back to defaults for malformed storage data", () => {
    const storage = {
      getItem: vi.fn(() => "{not-json"),
      setItem: vi.fn(),
    };

    expect(loadTitleFormatterPreferences(storage)).toEqual(
      DEFAULT_TITLE_FORMATTER_PREFERENCES,
    );
  });

  it("sanitizes invalid values", () => {
    expect(sanitizeTitleFormatterPreferences({ mode: "headline" })).toEqual({
      mode: "title",
    });
  });

  it("saves normalized preferences to storage", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    saveTitleFormatterPreferences({ mode: "alt" }, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      TITLE_FORMATTER_PREFERENCES_KEY,
      JSON.stringify({ mode: "alt" }),
    );
  });
});
