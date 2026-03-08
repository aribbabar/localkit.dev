import type * as MuPDFModule from "mupdf";

// ── Types ──

export type EntityType =
  | "name"
  | "address"
  | "ssn"
  | "phone"
  | "email"
  | "url"
  | "organization"
  | "location";

export type RedactionEngine = "compromise" | "transformers";
export type RedactionStyle = "placeholder" | "blackbox";

export interface DetectedEntity {
  type: EntityType;
  text: string;
  start: number;
  end: number;
}

export interface RedactorOptions {
  engine: RedactionEngine;
  entityTypes: EntityType[];
  style: RedactionStyle;
}

export interface ConvertedFile {
  name: string;
  blob: Blob;
  buffer: ArrayBuffer;
}

// ── Placeholder labels ──

const PLACEHOLDER_MAP: Record<EntityType, string> = {
  name: "[NAME]",
  address: "[ADDRESS]",
  ssn: "[SSN]",
  phone: "[PHONE]",
  email: "[EMAIL]",
  url: "[URL]",
  organization: "[ORGANIZATION]",
  location: "[LOCATION]",
};

const BLACKBOX = "\u2588\u2588\u2588\u2588\u2588\u2588";

// ── Regex patterns ──

const REGEX_PATTERNS: Partial<Record<EntityType, RegExp>> = {
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  phone:
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  url: /\bhttps?:\/\/[^\s<>"')\]]+/gi,
  address:
    /\b\d{1,5}\s+(?:[A-Z][a-z]+\s?){1,4}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Way|Ct|Court|Pl|Place|Cir|Circle)\.?\b/gi,
};

// ── NLP Detection (compromise) ──

async function detectWithCompromise(
  text: string,
  entityTypes: EntityType[]
): Promise<DetectedEntity[]> {
  const nlp = (await import("compromise")).default;
  const doc = nlp(text);
  const entities: DetectedEntity[] = [];

  // NLP-based entity detection
  const nlpMappings: {
    type: EntityType;
    method: "people" | "places" | "organizations";
  }[] = [
    { type: "name", method: "people" },
    { type: "location", method: "places" },
    { type: "organization", method: "organizations" },
  ];

  for (const { type, method } of nlpMappings) {
    if (!entityTypes.includes(type)) continue;

    const matches = doc[method]();
    matches.forEach((m: any) => {
      const matchText = m.text();
      if (matchText.trim().length < 2) return;

      const offset = findTextOffset(text, matchText, entities);
      if (offset !== -1) {
        entities.push({
          type,
          text: matchText,
          start: offset,
          end: offset + matchText.length,
        });
      }
    });
  }

  // Phone numbers via compromise's built-in method
  if (entityTypes.includes("phone")) {
    const phones = doc.phoneNumbers();
    phones.forEach((m: any) => {
      const matchText = m.text();
      if (matchText.trim().length < 7) return;
      const offset = findTextOffset(text, matchText, entities);
      if (offset !== -1) {
        entities.push({
          type: "phone",
          text: matchText,
          start: offset,
          end: offset + matchText.length,
        });
      }
    });
  }

  // Emails via compromise
  if (entityTypes.includes("email")) {
    const emails = doc.emails();
    emails.forEach((m: any) => {
      const matchText = m.text();
      const offset = findTextOffset(text, matchText, entities);
      if (offset !== -1) {
        entities.push({
          type: "email",
          text: matchText,
          start: offset,
          end: offset + matchText.length,
        });
      }
    });
  }

  // URLs via compromise
  if (entityTypes.includes("url")) {
    const urls = doc.urls();
    urls.forEach((m: any) => {
      const matchText = m.text();
      const offset = findTextOffset(text, matchText, entities);
      if (offset !== -1) {
        entities.push({
          type: "url",
          text: matchText,
          start: offset,
          end: offset + matchText.length,
        });
      }
    });
  }

  // Supplement with regex patterns for types that benefit from it
  addRegexEntities(text, entityTypes, entities);

  return deduplicateEntities(entities);
}

// ── NLP Detection (transformers.js) ──

let nerPipeline: any = null;

async function detectWithTransformers(
  text: string,
  entityTypes: EntityType[]
): Promise<DetectedEntity[]> {
  const { pipeline } = await import("@huggingface/transformers");

  if (!nerPipeline) {
    nerPipeline = await pipeline(
      "token-classification",
      "Xenova/bert-base-NER",
      { device: "wasm" }
    );
  }

  const entities: DetectedEntity[] = [];

  // NER entity type mapping from model labels to our types
  const nerTypeMap: Record<string, EntityType> = {
    PER: "name",
    LOC: "location",
    ORG: "organization",
    MISC: "name", // fallback
  };

  // Process in chunks if text is long (model has token limit)
  const chunks = splitTextIntoChunks(text, 450);
  let globalOffset = 0;

  for (const chunk of chunks) {
    const results: any[] = await nerPipeline(chunk, {
      ignore_labels: [],
    });

    // Group B- and I- tokens into full entities
    let currentEntity: {
      type: EntityType;
      text: string;
      start: number;
      end: number;
    } | null = null;

    for (const token of results) {
      const label = token.entity as string;
      const entityLabel = label.replace(/^[BI]-/, "");
      const mappedType = nerTypeMap[entityLabel];

      if (!mappedType || !entityTypes.includes(mappedType)) {
        if (currentEntity) {
          entities.push(currentEntity);
          currentEntity = null;
        }
        continue;
      }

      if (label.startsWith("B-")) {
        if (currentEntity) entities.push(currentEntity);
        currentEntity = {
          type: mappedType,
          text: token.word.replace(/^##/, ""),
          start: globalOffset + token.start,
          end: globalOffset + token.end,
        };
      } else if (label.startsWith("I-") && currentEntity) {
        const word = token.word.replace(/^##/, "");
        if (token.start === currentEntity.end) {
          currentEntity.text += word;
        } else {
          currentEntity.text += " " + word;
        }
        currentEntity.end = globalOffset + token.end;
      }
    }

    if (currentEntity) entities.push(currentEntity);
    globalOffset += chunk.length;
  }

  // Clean up subword tokens
  for (const entity of entities) {
    entity.text = entity.text.replace(/\s+##/g, "").replace(/##/g, "");
  }

  // Add regex-based entities
  addRegexEntities(text, entityTypes, entities);

  return deduplicateEntities(entities);
}

// ── Shared helpers ──

function findTextOffset(
  fullText: string,
  searchText: string,
  existingEntities: DetectedEntity[]
): number {
  let startFrom = 0;
  while (true) {
    const idx = fullText.indexOf(searchText, startFrom);
    if (idx === -1) return -1;

    const overlaps = existingEntities.some(
      (e) => idx < e.end && idx + searchText.length > e.start
    );
    if (!overlaps) return idx;

    startFrom = idx + 1;
  }
}

function addRegexEntities(
  text: string,
  entityTypes: EntityType[],
  entities: DetectedEntity[]
): void {
  for (const type of entityTypes) {
    const pattern = REGEX_PATTERNS[type];
    if (!pattern) continue;

    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      const overlaps = entities.some(
        (e) => start < e.end && end > e.start && e.type === type
      );
      if (!overlaps) {
        entities.push({ type, text: match[0], start, end });
      }
    }
  }
}

function deduplicateEntities(entities: DetectedEntity[]): DetectedEntity[] {
  // Sort by start position, then by length (longer first)
  entities.sort((a, b) => a.start - b.start || b.end - a.end);

  const result: DetectedEntity[] = [];
  for (const entity of entities) {
    const overlaps = result.some(
      (e) => entity.start < e.end && entity.end > e.start
    );
    if (!overlaps) {
      result.push(entity);
    }
  }

  return result;
}

function splitTextIntoChunks(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return [text];

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

// ── Public API ──

export async function detectEntities(
  text: string,
  options: RedactorOptions
): Promise<DetectedEntity[]> {
  if (options.engine === "transformers") {
    return detectWithTransformers(text, options.entityTypes);
  }
  return detectWithCompromise(text, options.entityTypes);
}

export function applyRedactions(
  text: string,
  entities: DetectedEntity[],
  style: RedactionStyle
): string {
  // Sort entities by start position in reverse so we can replace from end
  const sorted = [...entities].sort((a, b) => b.start - a.start);

  let result = text;
  for (const entity of sorted) {
    const replacement =
      style === "placeholder"
        ? PLACEHOLDER_MAP[entity.type]
        : BLACKBOX;
    result =
      result.substring(0, entity.start) +
      replacement +
      result.substring(entity.end);
  }

  return result;
}

// ── PDF text extraction ──

let mupdfPromise: Promise<typeof MuPDFModule> | null = null;

async function getMuPDF(): Promise<typeof MuPDFModule> {
  if (!mupdfPromise) {
    mupdfPromise = import("mupdf");
  }
  return mupdfPromise;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const mupdf = await getMuPDF();
  const data = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(
    new Uint8Array(data),
    "application/pdf"
  ) as MuPDFModule.PDFDocument;

  const pageCount = doc.countPages();
  const parts: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const stext = page.toStructuredText("preserve-whitespace");
    parts.push(stext.asText());
  }

  return parts.join("\n\n");
}

// ── PDF redaction via MuPDF annotations ──

export async function redactPdf(
  file: File,
  entities: DetectedEntity[],
  style: RedactionStyle,
  onProgress?: (done: number, total: number) => void
): Promise<ConvertedFile> {
  const mupdf = await getMuPDF();
  const data = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(
    new Uint8Array(data),
    "application/pdf"
  ) as MuPDFModule.PDFDocument;

  const pageCount = doc.countPages();

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i) as MuPDFModule.PDFPage;
    const stext = page.toStructuredText("preserve-whitespace");

    for (const entity of entities) {
      const quads = stext.search(entity.text);
      if (!quads || quads.length === 0) continue;

      for (const quadGroup of quads) {
        const annot = page.createAnnotation("Redact");

        if (quadGroup.length > 0) {
          // Use the bounding rect of all quads
          const firstQuad = quadGroup[0];
          let minX = Math.min(firstQuad[0], firstQuad[2], firstQuad[4], firstQuad[6]);
          let minY = Math.min(firstQuad[1], firstQuad[3], firstQuad[5], firstQuad[7]);
          let maxX = Math.max(firstQuad[0], firstQuad[2], firstQuad[4], firstQuad[6]);
          let maxY = Math.max(firstQuad[1], firstQuad[3], firstQuad[5], firstQuad[7]);

          for (const quad of quadGroup.slice(1)) {
            minX = Math.min(minX, quad[0], quad[2], quad[4], quad[6]);
            minY = Math.min(minY, quad[1], quad[3], quad[5], quad[7]);
            maxX = Math.max(maxX, quad[0], quad[2], quad[4], quad[6]);
            maxY = Math.max(maxY, quad[1], quad[3], quad[5], quad[7]);
          }

          annot.setRect([minX, minY, maxX, maxY]);
        }

        annot.update();
      }
    }

    // PDF redactions always use black boxes (MuPDF limitation)
    page.applyRedactions(true);
    onProgress?.(i + 1, pageCount);
  }

  const outBuf = doc.saveToBuffer("compress");
  const arrayBuffer = outBuf.asUint8Array().slice().buffer as ArrayBuffer;

  const baseName = file.name.replace(/\.pdf$/i, "");

  return {
    name: `${baseName}-redacted.pdf`,
    blob: new Blob([arrayBuffer], { type: "application/pdf" }),
    buffer: arrayBuffer,
  };
}

// ── File text extraction ──

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    return extractTextFromPdf(file);
  }

  // txt, md — read as text
  return file.text();
}

// ── Redact text file ──

export function createRedactedTextFile(
  originalName: string,
  redactedText: string
): ConvertedFile {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "txt";
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const mimeType = ext === "md" ? "text/markdown" : "text/plain";

  const encoder = new TextEncoder();
  const bytes = encoder.encode(redactedText);
  const arrayBuffer = bytes.buffer as ArrayBuffer;

  return {
    name: `${baseName}-redacted.${ext}`,
    blob: new Blob([arrayBuffer], { type: mimeType }),
    buffer: arrayBuffer,
  };
}
