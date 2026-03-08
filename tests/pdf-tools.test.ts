import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  getPdfInfo,
  pdfToImages,
  pdfToText,
  pdfToHtml,
  mergePdfs,
  splitPdf,
  extractPages,
  compressPdf,
  parsePageRange,
  splitEveryNPages,
} from "../src/lib/mupdf";

const PDF_DIR = path.join(__dirname, "pdf");
const sample1Path = path.join(PDF_DIR, "sample1.pdf");
const sample2Path = path.join(PDF_DIR, "sample2.pdf");

describe("PDF Tools", () => {
  let sample1File: File;
  let sample2File: File;

  beforeAll(() => {
    const buffer1 = fs.readFileSync(sample1Path);
    sample1File = new File([buffer1], "sample1.pdf", { type: "application/pdf" });

    const buffer2 = fs.readFileSync(sample2Path);
    sample2File = new File([buffer2], "sample2.pdf", { type: "application/pdf" });
  });

  describe("Utility functions", () => {
    it("should parse page ranges correctly", () => {
      expect(parsePageRange("1-3, 5, 7-10", 15)).toEqual([0, 1, 2, 4, 6, 7, 8, 9]);
      expect(parsePageRange("2", 5)).toEqual([1]);
      expect(parsePageRange("4-2", 5)).toEqual([]); // invalid range
    });

    it("should split every N pages correctly", () => {
      expect(splitEveryNPages(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
      expect(splitEveryNPages(4, 4)).toEqual([[0, 1, 2, 3]]);
    });
  });

  describe("getPdfInfo", () => {
    it("should extract PDF info correctly", async () => {
      const info = await getPdfInfo(sample1File);
      expect(info.pageCount).toBeGreaterThan(0);
      expect(info.pages.length).toBe(info.pageCount);
      expect(info.pages[0].width).toBeGreaterThan(0);
      expect(info.pages[0].height).toBeGreaterThan(0);
    });
  });

  describe("pdfToText", () => {
    it("should extract text from a PDF", async () => {
      const text = await pdfToText(sample1File);
      expect(typeof text).toBe("string");
    });
  });

  describe("pdfToHtml", () => {
    it("should extract HTML from a PDF", async () => {
      const html = await pdfToHtml(sample1File);
      expect(typeof html).toBe("string");
    });
  });

  describe("pdfToImages", () => {
    it("should convert PDF pages to images", async () => {
      const images = await pdfToImages(sample1File, "jpeg", 72, 80, [0]);
      expect(images.length).toBe(1);
      expect(images[0].name).toMatch(/page-1\.jpg$/);
      expect(images[0].blob.type).toBe("image/jpeg");
      expect(images[0].buffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe("mergePdfs", () => {
    it("should merge multiple PDFs", async () => {
      const merged = await mergePdfs([sample1File, sample2File]);
      expect(merged.name).toBe("merged.pdf");
      expect(merged.blob.type).toBe("application/pdf");
      expect(merged.buffer.byteLength).toBeGreaterThan(0);
      
      const mergedFile = new File([merged.buffer], "merged.pdf", { type: "application/pdf" });
      const info1 = await getPdfInfo(sample1File);
      const info2 = await getPdfInfo(sample2File);
      const mergedInfo = await getPdfInfo(mergedFile);
      expect(mergedInfo.pageCount).toBe(info1.pageCount + info2.pageCount);
    });
  });

  describe("splitPdf", () => {
    it("should split PDF into multiple parts", async () => {
      const parts = await splitPdf(sample1File, [[0]]);
      expect(parts.length).toBe(1);
      expect(parts[0].blob.type).toBe("application/pdf");
      expect(parts[0].buffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe("extractPages", () => {
    it("should extract specific pages", async () => {
      const extracted = await extractPages(sample1File, [0]);
      expect(extracted.name).toMatch(/extracted\.pdf$/);
      expect(extracted.blob.type).toBe("application/pdf");
      
      const extractedFile = new File([extracted.buffer], "extracted.pdf", { type: "application/pdf" });
      const info = await getPdfInfo(extractedFile);
      expect(info.pageCount).toBe(1);
    });
  });

  describe("compressPdf", () => {
    it("should compress a PDF", async () => {
      const compressed = await compressPdf(sample1File);
      expect(compressed.name).toMatch(/compressed\.pdf$/);
      expect(compressed.blob.type).toBe("application/pdf");
      expect(compressed.buffer.byteLength).toBeGreaterThan(0);
    });
  });
});
