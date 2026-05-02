import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_CONVERTER_PREFERENCES,
  IMAGE_CONVERTER_PREFERENCES_KEY,
  loadImageConverterPreferences,
  saveImageConverterPreferences,
  sanitizeImageConverterPreferences,
} from "../src/components/image-converter/preferences";

describe("image converter preferences", () => {
  it("loads saved preferences from storage", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          outputFormat: "jpg",
          quality: 80,
          resize: "100x100",
          stripMetadata: true,
        }),
      ),
      setItem: vi.fn(),
    };

    expect(loadImageConverterPreferences(storage)).toEqual({
      outputFormat: "jpg",
      quality: 80,
      resize: "100x100",
      stripMetadata: true,
    });
  });

  it("falls back to defaults for malformed storage data", () => {
    const storage = {
      getItem: vi.fn(() => "{not-json"),
      setItem: vi.fn(),
    };

    expect(loadImageConverterPreferences(storage)).toEqual(
      DEFAULT_IMAGE_CONVERTER_PREFERENCES,
    );
  });

  it("sanitizes invalid preference values", () => {
    expect(
      sanitizeImageConverterPreferences({
        outputFormat: " ICO ",
        quality: 1000,
        resize: 42,
        stripMetadata: "yes",
      }),
    ).toEqual({
      outputFormat: "ico",
      quality: 100,
      resize: "",
      stripMetadata: false,
    });
  });

  it("saves normalized preferences to storage", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    saveImageConverterPreferences(
      {
        outputFormat: " JPG ",
        quality: 0,
        resize: "50%",
        stripMetadata: true,
      },
      storage,
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      IMAGE_CONVERTER_PREFERENCES_KEY,
      JSON.stringify({
        outputFormat: "jpg",
        quality: 1,
        resize: "50%",
        stripMetadata: true,
      }),
    );
  });
});
