import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES,
  IMAGE_COLLAGE_MAKER_PREFERENCES_KEY,
  loadImageCollageMakerPreferences,
  sanitizeImageCollageMakerPreferences,
  saveImageCollageMakerPreferences,
} from "../src/components/image-collage/preferences";

function createStorage(initialValue?: string) {
  const data = new Map<string, string>();
  if (initialValue) {
    data.set(IMAGE_COLLAGE_MAKER_PREFERENCES_KEY, initialValue);
  }

  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("image collage preferences", () => {
  it("falls back to defaults for invalid values", () => {
    const preferences = sanitizeImageCollageMakerPreferences({
      ratioPreset: "poster",
      fitMode: "stretch",
      gap: -20,
      cornerRadius: 99,
      backgroundColor: "white",
      outputFormat: "gif",
      quality: 200,
      viewerZoom: 10,
    });

    expect(preferences).toEqual({
      ...DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES,
      gap: 0,
      cornerRadius: 32,
      quality: 100,
      viewerZoom: 50,
    });
  });

  it("loads saved preferences from storage", () => {
    const storage = createStorage(
      JSON.stringify({
        ratioPreset: "landscape",
        fitMode: "contain",
        gap: 18,
        cornerRadius: 6,
        backgroundColor: "#ffffff",
        outputFormat: "webp",
        quality: 80,
        viewerZoom: 140,
      }),
    );

    expect(loadImageCollageMakerPreferences(storage)).toMatchObject({
      ratioPreset: "landscape",
      fitMode: "contain",
      gap: 18,
      cornerRadius: 6,
      backgroundColor: "#ffffff",
      outputFormat: "webp",
      quality: 80,
      viewerZoom: 140,
    });
  });

  it("allows deep preview zoom preferences", () => {
    const preferences = sanitizeImageCollageMakerPreferences({
      ...DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES,
      viewerZoom: 700,
    });

    expect(preferences.viewerZoom).toBe(600);
  });

  it("saves sanitized preferences to storage", () => {
    const storage = createStorage();

    saveImageCollageMakerPreferences(
      {
        ...DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES,
        ratioPreset: "portrait",
        outputFormat: "jpeg",
        viewerZoom: 175,
      },
      storage,
    );

    const saved = JSON.parse(
      storage.getItem(IMAGE_COLLAGE_MAKER_PREFERENCES_KEY)!,
    );
    expect(saved.ratioPreset).toBe("portrait");
    expect(saved.outputFormat).toBe("jpeg");
    expect(saved.viewerZoom).toBe(175);
  });
});
