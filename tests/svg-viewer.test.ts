import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { hasAnimation, validateSvg } from "../src/lib/svg";

const SVG_DIR = path.join(__dirname, "svg");

describe("SVG Viewer Tests", () => {
  describe("hasAnimation", () => {
    it("should detect animations in sample1.svg", () => {
      const sample1 = fs.readFileSync(path.join(SVG_DIR, "sample1.svg"), "utf8");
      expect(hasAnimation(sample1)).toBe(true);
    });

    it("should detect animations in sample2.svg", () => {
      const sample2 = fs.readFileSync(path.join(SVG_DIR, "sample2.svg"), "utf8");
      expect(hasAnimation(sample2)).toBe(true);
    });

    it("should not detect animations in a static SVG", () => {
      const staticSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
      </svg>`;
      expect(hasAnimation(staticSvg)).toBe(false);
    });

    it("should detect <animate> tags", () => {
      const animatedSvg = `<svg><animate attributeName="x" values="0;100" dur="1s" repeatCount="indefinite"/></svg>`;
      expect(hasAnimation(animatedSvg)).toBe(true);
    });

    it("should detect CSS animations", () => {
      const cssAnimatedSvg = `<svg><style>@keyframes spin { 100% { transform: rotate(360deg); } }</style></svg>`;
      expect(hasAnimation(cssAnimatedSvg)).toBe(true);
    });
  });

  describe("validateSvg", () => {
    it("should return null for valid SVG (mocked DOMParser)", () => {
      // Mock DOMParser
      global.DOMParser = class {
        parseFromString(str: string, type: string) {
          return {
            querySelector: (selector: string) => {
              if (selector === "parsererror") {
                return str.includes("INVALID") ? {} : null; // Mock parsererror element if string contains INVALID
              }
              return null;
            }
          };
        }
      } as any;

      const validSvg = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
      expect(validateSvg(validSvg)).toBeNull();
    });

    it("should return error for invalid SVG (mocked DOMParser)", () => {
      // The mock above returns a truthy value if str includes INVALID
      const invalidSvg = `<svg xmlns="http://www.w3.org/2000/svg">INVALID</svg>`;
      expect(validateSvg(invalidSvg)).toBe("Invalid SVG markup");
    });

    it("should handle exceptions from DOMParser", () => {
      global.DOMParser = class {
        parseFromString() {
          throw new Error("Parse error");
        }
      } as any;

      expect(validateSvg("<svg></svg>")).toBe("Failed to parse SVG");
    });
  });
});
