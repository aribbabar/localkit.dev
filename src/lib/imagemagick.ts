import { ImageMagick, Magick, MagickFormat, MagickGeometry, initializeImageMagick } from "@imagemagick/magick-wasm";
import wasmUrl from "@imagemagick/magick-wasm/magick.wasm?url";

export interface ConvertOptions {
  quality?: number;
  resize?: string; // e.g. "800x600", "50%"
  strip?: boolean; // strip metadata
}

export interface ConvertedFile {
  name: string;
  blob: Blob;
  buffer: ArrayBuffer;
}

const FORMAT_MAP = {
  png: MagickFormat.Png,
  jpg: MagickFormat.Jpeg,
  gif: MagickFormat.Gif,
  bmp: MagickFormat.Bmp,
  tiff: MagickFormat.Tiff,
  ico: MagickFormat.Ico,
  tga: MagickFormat.Tga,
  psd: MagickFormat.Psd,
  ppm: MagickFormat.Ppm,
  pgm: MagickFormat.Pgm,
  hdr: MagickFormat.Hdr,
  pcx: MagickFormat.Pcx,
  heic: MagickFormat.Heic,
  heif: MagickFormat.Heif,
} as const;

type SupportedExt = keyof typeof FORMAT_MAP;

const MIME_MAP: Record<SupportedExt, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  ico: "image/x-icon",
  tga: "image/x-tga",
  psd: "image/vnd.adobe.photoshop",
  ppm: "image/x-portable-pixmap",
  pgm: "image/x-portable-graymap",
  hdr: "image/vnd.radiance",
  pcx: "image/x-pcx",
  heic: "image/heic",
  heif: "image/heif",
};

let initPromise: Promise<void> | null = null;
let writableFormats: Set<MagickFormat> | null = null;

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = fetch(wasmUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ImageMagick wasm (${res.status})`);
        }
        return res.arrayBuffer();
      })
      .then((bytes) => initializeImageMagick(new Uint8Array(bytes)));
  }

  return initPromise;
}

function getWritableFormats(): Set<MagickFormat> {
  if (!writableFormats) {
    writableFormats = new Set(Magick.supportedFormats.filter((info) => info.supportsWriting).map((info) => info.format));
  }

  return writableFormats;
}

function formatLabel(ext: string): string {
  return ext.toUpperCase();
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function changeExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.substring(0, dot) : filename;
  return `${base}.${newExt}`;
}

function resolveTargetFormat(targetFormat: string): { ext: SupportedExt; format: (typeof FORMAT_MAP)[SupportedExt] } {
  const ext = targetFormat.toLowerCase() as SupportedExt;
  const format = FORMAT_MAP[ext];
  if (!format) {
    throw new Error(`Unsupported output format: ${targetFormat}`);
  }
  if (!getWritableFormats().has(format)) {
    throw new Error(
      `Output format "${formatLabel(ext)}" is not available in this browser build. ` +
        "This ImageMagick build does not include an encoder for it."
    );
  }

  return { ext, format };
}

export async function convertImage(
  file: File,
  targetFormat: string,
  options: ConvertOptions = {}
): Promise<ConvertedFile> {
  await ensureInitialized();

  const { ext, format } = resolveTargetFormat(targetFormat);
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  let outputBytes: Uint8Array | null = null;

  try {
    ImageMagick.read(inputBytes, (image) => {
      if (options.strip) {
        image.strip();
      }

      if (options.resize?.trim()) {
        image.resize(new MagickGeometry(options.resize.trim()));
      }

      if (typeof options.quality === "number" && Number.isFinite(options.quality)) {
        image.quality = Math.min(100, Math.max(1, Math.round(options.quality)));
      }

      image.write(format, (data) => {
        outputBytes = new Uint8Array(data);
      });
    });
  } catch (error) {
    throw new Error(`Failed to convert "${file.name}": ${(error as Error).message}`);
  }

  if (!outputBytes) {
    throw new Error(`No output was generated for "${file.name}"`);
  }

  const buffer = toArrayBuffer(outputBytes);
  return {
    name: changeExtension(file.name, ext),
    blob: new Blob([buffer], { type: MIME_MAP[ext] }),
    buffer,
  };
}

export async function convertBatch(
  files: File[],
  targetFormat: string,
  options: ConvertOptions = {},
  onProgress?: (done: number, total: number) => void
): Promise<ConvertedFile[]> {
  const results: ConvertedFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const result = await convertImage(files[i], targetFormat, options);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }
  return results;
}

export async function getAvailableOutputFormats() {
  await ensureInitialized();
  return SUPPORTED_FORMATS.filter((format) => getWritableFormats().has(FORMAT_MAP[format.ext]));
}

export const SUPPORTED_FORMATS = [
  { ext: "png", label: "PNG", mime: MIME_MAP.png },
  { ext: "jpg", label: "JPEG", mime: MIME_MAP.jpg },
  { ext: "gif", label: "GIF", mime: MIME_MAP.gif },
  { ext: "bmp", label: "BMP", mime: MIME_MAP.bmp },
  { ext: "tiff", label: "TIFF", mime: MIME_MAP.tiff },
  { ext: "ico", label: "ICO", mime: MIME_MAP.ico },
  { ext: "tga", label: "TGA", mime: MIME_MAP.tga },
  { ext: "psd", label: "PSD", mime: MIME_MAP.psd },
  { ext: "ppm", label: "PPM", mime: MIME_MAP.ppm },
  { ext: "pgm", label: "PGM", mime: MIME_MAP.pgm },
  { ext: "hdr", label: "HDR", mime: MIME_MAP.hdr },
  { ext: "pcx", label: "PCX", mime: MIME_MAP.pcx },
  { ext: "heic", label: "HEIC", mime: MIME_MAP.heic },
  { ext: "heif", label: "HEIF", mime: MIME_MAP.heif },
] as const;

export const ACCEPTED_INPUT_EXTENSIONS = ".heic,.heif,.xcf," + SUPPORTED_FORMATS.map((f) => `.${f.ext}`).join(",");
