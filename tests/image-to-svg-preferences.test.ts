import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_TO_SVG_PREFERENCES,
  IMAGE_TO_SVG_PREFERENCES_KEY,
  loadImageToSvgPreferences,
  saveImageToSvgPreferences,
  sanitizeImageToSvgPreferences,
} from "../src/components/image-to-svg/preferences";

describe("image to svg preferences", () => {
  it("loads saved potrace preferences from storage", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          potrace: {
            turdsize: 8,
            turnpolicy: 2,
            alphamax: 0.4,
            opticurve: 0,
            opttolerance: 0.65,
            extractcolors: false,
            posterizelevel: 6,
            posterizationalgorithm: 1,
          },
        }),
      ),
      setItem: vi.fn(),
    };

    expect(loadImageToSvgPreferences(storage)).toEqual({
      potrace: {
        turdsize: 8,
        turnpolicy: 2,
        alphamax: 0.4,
        opticurve: 0,
        opttolerance: 0.65,
        extractcolors: false,
        posterizelevel: 6,
        posterizationalgorithm: 1,
      },
    });
  });

  it("normalizes potrace settings", () => {
    expect(
      sanitizeImageToSvgPreferences({
        potrace: {
          turdsize: 5,
          turnpolicy: 99,
          alphamax: -1,
          opticurve: 7,
          opttolerance: 0.5,
          extractcolors: true,
          posterizelevel: 0,
          posterizationalgorithm: 9,
        },
      }),
    ).toEqual({
      potrace: {
        turdsize: 5,
        turnpolicy: 6,
        alphamax: 0,
        opticurve: 1,
        opttolerance: 0.5,
        extractcolors: true,
        posterizelevel: 1,
        posterizationalgorithm: 0,
      },
    });
  });

  it("falls back to defaults for malformed storage data", () => {
    const storage = {
      getItem: vi.fn(() => "{not-json"),
      setItem: vi.fn(),
    };

    expect(loadImageToSvgPreferences(storage)).toEqual(
      DEFAULT_IMAGE_TO_SVG_PREFERENCES,
    );
  });

  it("saves normalized potrace preferences to storage", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    saveImageToSvgPreferences(
      {
        potrace: {
          turdsize: -10,
          turnpolicy: 3,
          alphamax: 5,
          opticurve: 0,
          opttolerance: 0.3,
          extractcolors: false,
          posterizelevel: 500,
          posterizationalgorithm: 1,
        },
      },
      storage,
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      IMAGE_TO_SVG_PREFERENCES_KEY,
      JSON.stringify({
        potrace: {
          turdsize: 0,
          turnpolicy: 3,
          alphamax: 1.34,
          opticurve: 0,
          opttolerance: 0.3,
          extractcolors: false,
          posterizelevel: 255,
          posterizationalgorithm: 1,
        },
      }),
    );
  });
});
