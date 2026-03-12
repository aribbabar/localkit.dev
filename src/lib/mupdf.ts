import type * as MuPDFModule from "mupdf";

export interface ConvertedFile {
  name: string;
  blob: Blob;
  buffer: ArrayBuffer;
}

export interface PageInfo {
  index: number;
  width: number;
  height: number;
  label: string;
}

export interface MergeSource {
  file: File;
  pageCount: number;
}

export type ImageFormat = "png" | "jpeg";

// ── Lazy singleton ──

let mupdfPromise: Promise<typeof MuPDFModule> | null = null;

async function getMuPDF(): Promise<typeof MuPDFModule> {
  if (!mupdfPromise) {
    mupdfPromise = import("mupdf");
  }
  return mupdfPromise;
}

// ── Helpers ──

function changeExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.substring(0, dot) : filename;
  return `${base}.${newExt}`;
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.substring(0, dot) : filename;
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

function bufferToUint8Array(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf);
}

// ── Open document helpers ──

function openPdfDocument(
  mupdf: typeof MuPDFModule,
  data: ArrayBuffer
): MuPDFModule.PDFDocument {
  return mupdf.Document.openDocument(
    bufferToUint8Array(data),
    "application/pdf"
  ) as MuPDFModule.PDFDocument;
}

// ── PDF info ──

export async function getPdfInfo(
  file: File
): Promise<{ pageCount: number; pages: PageInfo[] }> {
  const mupdf = await getMuPDF();
  const data = await fileToArrayBuffer(file);
  const doc = await openPdfDocument(mupdf, data);

  const pageCount = doc.countPages();
  const pages: PageInfo[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const bounds = page.getBounds();
    pages.push({
      index: i,
      width: bounds[2] - bounds[0],
      height: bounds[3] - bounds[1],
      label: page.getLabel() || `${i + 1}`,
    });
  }

  return { pageCount, pages };
}

// ── PDF to Images ──

export async function pdfPageToImage(
  data: ArrayBuffer,
  pageIndex: number,
  format: ImageFormat = "png",
  dpi: number = 150,
  quality: number = 85
): Promise<ConvertedFile> {
  const mupdf = await getMuPDF();
  const doc = await openPdfDocument(mupdf, data);
  const page = doc.loadPage(pageIndex);

  const scale = dpi / 72;
  const matrix = [scale, 0, 0, scale, 0, 0] as MuPDFModule.Matrix;

  const useAlpha = format === "png";
  const pixmap = page.toPixmap(
    matrix,
    mupdf.ColorSpace.DeviceRGB,
    useAlpha,
    true
  );

  let mimeType: string;
  let ext: string;
  let rawBytes: Uint8Array;

  if (format === "jpeg") {
    const result = pixmap.asJPEG(quality, false);
    rawBytes = result instanceof Uint8Array ? result : (result as any).asUint8Array();
    mimeType = "image/jpeg";
    ext = "jpg";
  } else {
    const result = pixmap.asPNG();
    rawBytes = result instanceof Uint8Array ? result : (result as any).asUint8Array();
    mimeType = "image/png";
    ext = "png";
  }

  const arrayBuffer = rawBytes.slice().buffer as ArrayBuffer;

  return {
    name: `page-${pageIndex + 1}.${ext}`,
    blob: new Blob([arrayBuffer], { type: mimeType }),
    buffer: arrayBuffer,
  };
}

export async function pdfToImages(
  file: File,
  format: ImageFormat = "png",
  dpi: number = 150,
  quality: number = 85,
  pageIndices?: number[],
  onProgress?: (done: number, total: number) => void
): Promise<ConvertedFile[]> {
  const mupdf = await getMuPDF();
  const data = await fileToArrayBuffer(file);
  const doc = await openPdfDocument(mupdf, data);

  const totalPages = doc.countPages();
  const indices = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);
  const results: ConvertedFile[] = [];

  for (let i = 0; i < indices.length; i++) {
    const result = await pdfPageToImage(data, indices[i], format, dpi, quality);
    const baseName = stripExtension(file.name);
    result.name = `${baseName}-page-${indices[i] + 1}.${format === "jpeg" ? "jpg" : "png"}`;
    results.push(result);
    onProgress?.(i + 1, indices.length);
  }

  return results;
}

// ── PDF to Text / HTML ──

export async function pdfToText(
  file: File,
  pageIndices?: number[]
): Promise<string> {
  const mupdf = await getMuPDF();
  const data = await fileToArrayBuffer(file);
  const doc = await openPdfDocument(mupdf, data);

  const totalPages = doc.countPages();
  const indices = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);
  const parts: string[] = [];

  for (const idx of indices) {
    const page = doc.loadPage(idx);
    const stext = page.toStructuredText("preserve-whitespace");
    parts.push(stext.asText());
  }

  return parts.join("\n\n--- Page Break ---\n\n");
}

export async function pdfToHtml(
  file: File,
  pageIndices?: number[]
): Promise<string> {
  const mupdf = await getMuPDF();
  const data = await fileToArrayBuffer(file);
  const doc = await openPdfDocument(mupdf, data);

  const totalPages = doc.countPages();
  const indices = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);
  const parts: string[] = [];

  for (const idx of indices) {
    const page = doc.loadPage(idx);
    const stext = page.toStructuredText("preserve-whitespace,preserve-spans");
    parts.push(stext.asHTML(idx));
  }

  return parts.join("\n");
}

// ── Merge PDFs ──

export async function mergePdfs(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<ConvertedFile> {
  const mupdf = await getMuPDF();
  const dstDoc = new mupdf.PDFDocument();

  for (let i = 0; i < files.length; i++) {
    const data = await fileToArrayBuffer(files[i]);
    const srcDoc = await openPdfDocument(mupdf, data);
    const srcPageCount = srcDoc.countPages();
    const graftMap = dstDoc.newGraftMap();

    for (let p = 0; p < srcPageCount; p++) {
      const srcPage = srcDoc.findPage(p);
      const dstPage = dstDoc.newDictionary();
      dstPage.put("Type", dstDoc.newName("Page"));

      if (srcPage.get("MediaBox"))
        dstPage.put("MediaBox", graftMap.graftObject(srcPage.get("MediaBox")));
      if (srcPage.get("Rotate"))
        dstPage.put("Rotate", graftMap.graftObject(srcPage.get("Rotate")));
      if (srcPage.get("Resources"))
        dstPage.put("Resources", graftMap.graftObject(srcPage.get("Resources")));
      if (srcPage.get("Contents"))
        dstPage.put("Contents", graftMap.graftObject(srcPage.get("Contents")));

      dstDoc.insertPage(-1, dstDoc.addObject(dstPage));
    }

    onProgress?.(i + 1, files.length);
  }

  const outBuf = dstDoc.saveToBuffer("compress");
  const arrayBuffer = outBuf.asUint8Array().slice().buffer as ArrayBuffer;

  return {
    name: "merged.pdf",
    blob: new Blob([arrayBuffer], { type: "application/pdf" }),
    buffer: arrayBuffer,
  };
}

// ── Split PDF ──

export async function splitPdf(
  file: File,
  ranges: number[][],
  onProgress?: (done: number, total: number) => void
): Promise<ConvertedFile[]> {
  const mupdf = await getMuPDF();
  const data = await fileToArrayBuffer(file);
  const results: ConvertedFile[] = [];

  for (let r = 0; r < ranges.length; r++) {
    const range = ranges[r];
    const srcDoc = await openPdfDocument(mupdf, data);
    const dstDoc = new mupdf.PDFDocument();
    const graftMap = dstDoc.newGraftMap();

    for (const pageIdx of range) {
      const srcPage = srcDoc.findPage(pageIdx);
      const dstPage = dstDoc.newDictionary();
      dstPage.put("Type", dstDoc.newName("Page"));

      if (srcPage.get("MediaBox"))
        dstPage.put("MediaBox", graftMap.graftObject(srcPage.get("MediaBox")));
      if (srcPage.get("Rotate"))
        dstPage.put("Rotate", graftMap.graftObject(srcPage.get("Rotate")));
      if (srcPage.get("Resources"))
        dstPage.put("Resources", graftMap.graftObject(srcPage.get("Resources")));
      if (srcPage.get("Contents"))
        dstPage.put("Contents", graftMap.graftObject(srcPage.get("Contents")));

      dstDoc.insertPage(-1, dstDoc.addObject(dstPage));
    }

    const outBuf = dstDoc.saveToBuffer("compress");
    const arrayBuffer = outBuf.asUint8Array().slice().buffer as ArrayBuffer;
    const baseName = stripExtension(file.name);
    const label =
      range.length === 1
        ? `page-${range[0] + 1}`
        : `pages-${range[0] + 1}-${range[range.length - 1] + 1}`;

    results.push({
      name: `${baseName}-${label}.pdf`,
      blob: new Blob([arrayBuffer], { type: "application/pdf" }),
      buffer: arrayBuffer,
    });

    onProgress?.(r + 1, ranges.length);
  }

  return results;
}

// ── Extract pages ──

export async function extractPages(
  file: File,
  pageIndices: number[]
): Promise<ConvertedFile> {
  const results = await splitPdf(file, [pageIndices]);
  const baseName = stripExtension(file.name);
  results[0].name = `${baseName}-extracted.pdf`;
  return results[0];
}

// ── Compress PDF ──

export async function compressPdf(file: File): Promise<ConvertedFile> {
  const mupdf = await getMuPDF();
  const data = await fileToArrayBuffer(file);
  const doc = await openPdfDocument(mupdf, data);

  const outBuf = doc.saveToBuffer(
    "garbage=4,compress=yes,clean=yes"
  );
  const arrayBuffer = outBuf.asUint8Array().slice().buffer as ArrayBuffer;
  const baseName = stripExtension(file.name);

  return {
    name: `${baseName}-compressed.pdf`,
    blob: new Blob([arrayBuffer], { type: "application/pdf" }),
    buffer: arrayBuffer,
  };
}

// ── PDF to Word (DOCX) ──

interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface STextLine {
  wmode: 0 | 1;
  bbox: BBox;
  font: {
    name: string;
    family: "serif" | "sans-serif" | "monospace";
    weight: "normal" | "bold";
    style: "normal" | "italic";
    size: number;
  };
  x: number;
  y: number;
  text: string;
}

interface STextBlock {
  type: "image" | "text";
  bbox: BBox;
  lines: STextLine[];
}

interface STextPage {
  blocks: STextBlock[];
}

interface ExtractedImage {
  bbox: number[];
  pngData: Uint8Array;
}

// ── Docx builders ──

function mapFont(family: string): string {
  switch (family) {
    case "serif":
      return "Times New Roman";
    case "monospace":
      return "Courier New";
    case "sans-serif":
    default:
      return "Arial";
  }
}

function getHeadingLevel(
  fontSize: number,
  isBold: boolean
): any {
  if (!isBold) return undefined;
  if (fontSize >= 24) return "Heading1";
  if (fontSize >= 18) return "Heading2";
  if (fontSize >= 14) return "Heading3";
  return undefined;
}

function lineToTextRun(
  docxLib: typeof import("docx"),
  line: STextLine,
  prependSpace: boolean
): InstanceType<typeof import("docx")["TextRun"]> {
  const text = prependSpace ? " " + line.text : line.text;
  return new docxLib.TextRun({
    text,
    bold: line.font.weight === "bold",
    italics: line.font.style === "italic",
    size: Math.round(line.font.size) * 2,
    font: mapFont(line.font.family),
  });
}

function linesToParagraph(
  docxLib: typeof import("docx"),
  lines: STextLine[],
  detectHeading: boolean = true
): InstanceType<typeof import("docx")["Paragraph"]> {
  const runs = lines.map((line, li) => lineToTextRun(docxLib, line, li > 0));
  const avgSize = lines.reduce((s, l) => s + l.font.size, 0) / lines.length;
  const isBold = lines.every((l) => l.font.weight === "bold");
  const heading = detectHeading ? getHeadingLevel(avgSize, isBold) : undefined;

  return new docxLib.Paragraph({
    children: runs,
    heading,
    spacing: { after: 120 },
  });
}

function groupLinesIntoParagraphs(lines: STextLine[]): STextLine[][] {
  const groups: STextLine[][] = [];
  let current: STextLine[] = [];

  for (const line of lines) {
    if (current.length === 0) {
      current.push(line);
    } else {
      const prev = current[current.length - 1];
      const gap = line.bbox.y - (prev.bbox.y + prev.bbox.h);
      if (gap > prev.font.size * 0.8) {
        groups.push(current);
        current = [line];
      } else {
        current.push(line);
      }
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function buildImageParagraph(
  docxLib: typeof import("docx"),
  img: ExtractedImage
): InstanceType<typeof import("docx")["Paragraph"]> | null {
  try {
    const imgWidth = Math.abs(img.bbox[2] - img.bbox[0]);
    const imgHeight = Math.abs(img.bbox[3] - img.bbox[1]);
    if (imgWidth < 5 || imgHeight < 5) return null; // skip tiny images (decorative)

    const maxWidth = 6 * 72;
    const scale = imgWidth > maxWidth ? maxWidth / imgWidth : 1;

    return new docxLib.Paragraph({
      children: [
        new docxLib.ImageRun({
          data: img.pngData,
          transformation: {
            width: Math.round(imgWidth * scale),
            height: Math.round(imgHeight * scale),
          },
          type: "png",
        }),
      ],
      spacing: { after: 120 },
    });
  } catch {
    return null;
  }
}

// ── Main conversion ──

/** Safe stext options for JSON extraction (segment/table-hunt cause invalid JSON in MuPDF WASM) */
const STEXT_JSON_OPTIONS = "preserve-whitespace,preserve-spans";

/** Options for image extraction via walk() */
const STEXT_IMAGE_OPTIONS = "preserve-whitespace,preserve-images";

/**
 * Sanitize JSON output from MuPDF which can produce invalid JSON
 * (e.g. empty array entries like `[,{...}]` or trailing commas).
 */
function sanitizeMuPDFJson(raw: string): string {
  // Remove empty entries: [, → [   and ,, → ,   and ,] → ]
  return raw
    .replace(/\[,/g, "[")
    .replace(/,,+/g, ",")
    .replace(/,\s*\]/g, "]")
    .replace(/,\s*\}/g, "}");
}

export async function pdfToDocx(
  file: File,
  pageIndices?: number[],
  onProgress?: (done: number, total: number) => void
): Promise<ConvertedFile> {
  const mupdf = await getMuPDF();
  const docxLib = await import("docx");
  const data = await fileToArrayBuffer(file);
  const doc = openPdfDocument(mupdf, data);

  const totalPages = doc.countPages();
  const indices = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);

  const children: any[] = [];

  for (let i = 0; i < indices.length; i++) {
    const page = doc.loadPage(indices[i]);

    // Extract text structure
    const stextForJson = page.toStructuredText(STEXT_JSON_OPTIONS);
    const rawJson = stextForJson.asJSON();
    const pageData: STextPage = JSON.parse(sanitizeMuPDFJson(rawJson));

    // Extract images
    const images: ExtractedImage[] = [];
    const stextForImages = page.toStructuredText(STEXT_IMAGE_OPTIONS);
    stextForImages.walk({
      onImageBlock(bbox: number[], _transform: number[], image: any) {
        try {
          const pixmap = image.toPixmap();
          const pngBuf = pixmap.asPNG();
          const pngData =
            pngBuf instanceof Uint8Array ? pngBuf : pngBuf.asUint8Array();
          images.push({ bbox, pngData });
        } catch {
          // skip images that fail to render
        }
      },
    });

    // Add page break before every page except the first
    if (i > 0) {
      children.push(
        new docxLib.Paragraph({ children: [], pageBreakBefore: true })
      );
    }

    // Build a combined list sorted by vertical position
    type ContentItem =
      | { kind: "block"; block: STextBlock; y: number }
      | { kind: "image"; image: ExtractedImage; y: number };

    const items: ContentItem[] = [];

    for (const block of pageData.blocks) {
      items.push({ kind: "block", block, y: block.bbox.y });
    }
    for (const image of images) {
      items.push({ kind: "image", image, y: image.bbox[1] });
    }

    items.sort((a, b) => a.y - b.y);

    for (const item of items) {
      if (item.kind === "image") {
        const p = buildImageParagraph(docxLib, item.image);
        if (p) children.push(p);
      } else {
        const block = item.block;
        if (block.type === "text" && block.lines) {
          const paragraphGroups = groupLinesIntoParagraphs(block.lines);
          for (const group of paragraphGroups) {
            children.push(linesToParagraph(docxLib, group));
          }
        }
      }
    }

    onProgress?.(i + 1, indices.length);
  }

  const docxDoc = new docxLib.Document({
    sections: [{ children }],
  });

  const blob = await docxLib.Packer.toBlob(docxDoc);
  const arrayBuffer = await blob.arrayBuffer();
  const baseName = stripExtension(file.name);

  return {
    name: `${baseName}.docx`,
    blob: new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    buffer: arrayBuffer,
  };
}

// ── Page range parser ──
// Accepts: "1-3, 5, 7-10" and returns 0-based indices

export function parsePageRange(
  input: string,
  totalPages: number
): number[] {
  const indices = new Set<number>();
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    const rangeParts = part.split("-").map((s) => s.trim());

    if (rangeParts.length === 1) {
      const num = parseInt(rangeParts[0], 10);
      if (num >= 1 && num <= totalPages) {
        indices.add(num - 1);
      }
    } else if (rangeParts.length === 2) {
      const start = parseInt(rangeParts[0], 10);
      const end = parseInt(rangeParts[1], 10);
      if (start >= 1 && end >= start && end <= totalPages) {
        for (let i = start; i <= end; i++) {
          indices.add(i - 1);
        }
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

// ── Split mode helpers ──

export function splitEveryNPages(
  totalPages: number,
  n: number
): number[][] {
  const ranges: number[][] = [];
  for (let i = 0; i < totalPages; i += n) {
    const range: number[] = [];
    for (let j = i; j < Math.min(i + n, totalPages); j++) {
      range.push(j);
    }
    ranges.push(range);
  }
  return ranges;
}
