import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_QR_CODE_GENERATOR_PREFERENCES,
  QR_CODE_GENERATOR_PREFERENCES_KEY,
  loadQrCodeGeneratorPreferences,
  saveQrCodeGeneratorPreferences,
  sanitizeQrCodeGeneratorPreferences,
} from "../src/components/qr-code-generator/preferences";

describe("qr code generator preferences", () => {
  it("loads saved preferences from storage", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          size: 480,
          margin: 24,
          shape: "circle",
          dotType: "dots",
          dotColor: "#111111",
          cornerSquareType: "rounded",
          cornerSquareColor: "#222222",
          cornerDotType: "square",
          cornerDotColor: "#333333",
          backgroundColor: "#fafafa",
          errorCorrectionLevel: "H",
          imageUrl: "https://example.com/logo.svg",
          imageSize: 0.35,
          imageMargin: 10,
          hideBackgroundDots: false,
          exportExtension: "svg",
        }),
      ),
      setItem: vi.fn(),
    };

    expect(loadQrCodeGeneratorPreferences(storage)).toEqual({
      size: 480,
      margin: 24,
      shape: "circle",
      dotType: "dots",
      dotColor: "#111111",
      cornerSquareType: "rounded",
      cornerSquareColor: "#222222",
      cornerDotType: "square",
      cornerDotColor: "#333333",
      backgroundColor: "#fafafa",
      errorCorrectionLevel: "H",
      imageUrl: "https://example.com/logo.svg",
      imageSize: 0.35,
      imageMargin: 10,
      hideBackgroundDots: false,
      exportExtension: "svg",
    });
  });

  it("falls back to defaults for malformed storage data", () => {
    const storage = {
      getItem: vi.fn(() => "{not-json"),
      setItem: vi.fn(),
    };

    expect(loadQrCodeGeneratorPreferences(storage)).toEqual(
      DEFAULT_QR_CODE_GENERATOR_PREFERENCES,
    );
  });

  it("sanitizes invalid values and clamps numeric settings", () => {
    expect(
      sanitizeQrCodeGeneratorPreferences({
        size: 9999,
        margin: -10,
        shape: "triangle",
        dotType: "soft",
        dotColor: "teal",
        cornerSquareType: "smooth",
        cornerSquareColor: "#12345",
        cornerDotType: "pin",
        cornerDotColor: "#abcdef",
        backgroundColor: "#ABCDEF",
        errorCorrectionLevel: "Z",
        imageUrl: 42,
        imageSize: 0.9,
        imageMargin: -1,
        hideBackgroundDots: "yes",
        exportExtension: "pdf",
      }),
    ).toEqual({
      ...DEFAULT_QR_CODE_GENERATOR_PREFERENCES,
      size: 720,
      margin: 0,
      cornerDotColor: "#abcdef",
      backgroundColor: "#ABCDEF",
      imageSize: 0.5,
      imageMargin: 0,
    });
  });

  it("saves normalized preferences to storage", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    saveQrCodeGeneratorPreferences(
      {
        ...DEFAULT_QR_CODE_GENERATOR_PREFERENCES,
        size: 100,
        margin: 12.6,
        imageSize: 0.01,
        imageMargin: 200,
        exportExtension: "webp",
      },
      storage,
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      QR_CODE_GENERATOR_PREFERENCES_KEY,
      JSON.stringify({
        ...DEFAULT_QR_CODE_GENERATOR_PREFERENCES,
        size: 160,
        margin: 13,
        imageSize: 0.1,
        imageMargin: 40,
        exportExtension: "webp",
      }),
    );
  });
});
