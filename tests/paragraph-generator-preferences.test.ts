import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES,
  PARAGRAPH_GENERATOR_PREFERENCES_KEY,
  loadParagraphGeneratorPreferences,
  saveParagraphGeneratorPreferences,
  sanitizeParagraphGeneratorPreferences,
} from "../src/components/paragraph-generator/preferences";

describe("paragraph generator preferences", () => {
  it("loads saved preferences from storage", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          source: "faker",
          tone: "technical",
          paragraphCount: 6,
          sentencesPerParagraph: 5,
          separator: "line-break",
          includeHeadings: true,
          useSeed: true,
          seed: 12345,
        }),
      ),
      setItem: vi.fn(),
    };

    expect(loadParagraphGeneratorPreferences(storage)).toEqual({
      source: "faker",
      tone: "technical",
      paragraphCount: 6,
      sentencesPerParagraph: 5,
      separator: "line-break",
      includeHeadings: true,
      useSeed: true,
      seed: 12345,
    });
  });

  it("falls back to defaults for malformed storage data", () => {
    const storage = {
      getItem: vi.fn(() => "{not-json"),
      setItem: vi.fn(),
    };

    expect(loadParagraphGeneratorPreferences(storage)).toEqual(
      DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES,
    );
  });

  it("sanitizes invalid values and clamps numeric settings", () => {
    expect(
      sanitizeParagraphGeneratorPreferences({
        source: "original-faker",
        tone: "salesy",
        paragraphCount: 99,
        sentencesPerParagraph: -4,
        separator: "comma",
        includeHeadings: "yes",
        useSeed: "no",
        seed: 0,
      }),
    ).toEqual({
      source: "lorem",
      tone: "business",
      paragraphCount: 12,
      sentencesPerParagraph: 2,
      separator: "blank-line",
      includeHeadings: false,
      useSeed: false,
      seed: 1,
    });
  });

  it("saves normalized preferences to storage", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    saveParagraphGeneratorPreferences(
      {
        source: "faker",
        tone: "product",
        paragraphCount: 2.4,
        sentencesPerParagraph: 10,
        separator: "line-break",
        includeHeadings: true,
        useSeed: true,
        seed: 9999999,
      },
      storage,
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      PARAGRAPH_GENERATOR_PREFERENCES_KEY,
      JSON.stringify({
        source: "faker",
        tone: "product",
        paragraphCount: 2,
        sentencesPerParagraph: 8,
        separator: "line-break",
        includeHeadings: true,
        useSeed: true,
        seed: 999999,
      }),
    );
  });
});
