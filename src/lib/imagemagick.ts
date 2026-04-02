import { ImageMagick, Magick, MagickFormat, MagickGeometry, initializeImageMagick, type IMagickImage } from "@imagemagick/magick-wasm";
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

export interface ImageInfo {
  width: number;
  height: number;
  channels: number;
  hasAlpha: boolean;
  fileSize: number;
  mimeType: string;
  sourceFormat: string | null;
  metadataBytes: number;
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
const PATCH_SAMPLE_FORMATS = new Set(["jpg", "heic", "heif", "psd"]);
const METADATA_FORMATS = new Set(["jpg", "png", "tiff", "heic", "heif", "psd"]);
const SAMPLE_PATCH_EDGE = 384;
const SAMPLE_THUMBNAIL_EDGE = 512;
const SMALL_IMAGE_EXACT_PIXELS = 512 * 512;
const THUMBNAIL_SCALE_BIAS: Partial<Record<SupportedExt, number>> = {
  png: 1.12,
  gif: 1.08,
  ico: 1.12,
  pcx: 1.08,
  tiff: 1.04,
  hdr: 1.02,
};

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
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function clampQuality(value: number): number {
  return Math.min(100, Math.max(1, Math.round(value)));
}

function writeImageBytes(image: IMagickImage, format: (typeof FORMAT_MAP)[SupportedExt]): Uint8Array {
  let outputBytes: Uint8Array | null = null;

  image.write(format, (data) => {
    outputBytes = new Uint8Array(data);
  });

  if (!outputBytes) {
    throw new Error("No output was generated");
  }

  return outputBytes;
}

function applyConversionOptions(image: IMagickImage, options: ConvertOptions) {
  if (options.strip) {
    image.strip();
  }

  if (options.resize?.trim()) {
    image.resize(new MagickGeometry(options.resize.trim()));
  }

  if (typeof options.quality === "number" && Number.isFinite(options.quality)) {
    image.quality = clampQuality(options.quality);
  }
}

function getStringByteLength(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  return new TextEncoder().encode(value).byteLength;
}

function getMetadataBytes(image: IMagickImage): number {
  let total = getStringByteLength(image.comment);

  for (const name of image.attributeNames) {
    total += getStringByteLength(name);
    total += getStringByteLength(image.getAttribute(name));
  }

  for (const name of image.profileNames) {
    total += image.getProfile(name)?.data.byteLength ?? 0;
  }

  return total;
}

function getEstimatedMetadataBytes(info: ImageInfo, targetFormat: string, options: ConvertOptions): number {
  if (options.strip || info.metadataBytes <= 0 || !METADATA_FORMATS.has(targetFormat)) {
    return 0;
  }

  return Math.min(info.fileSize, info.metadataBytes + 128);
}

function getExactRawEstimate(ext: string, width: number, height: number, hasAlpha: boolean): number | null {
  switch (ext) {
    case "bmp": {
      const bytesPerPixel = hasAlpha ? 4 : 3;
      const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4;
      return 54 + rowStride * height;
    }

    case "ppm":
      return getStringByteLength(`P6\n${width} ${height}\n255\n`) + width * height * 3;

    case "pgm":
      return getStringByteLength(`P5\n${width} ${height}\n255\n`) + width * height;

    case "tga":
      return 18 + width * height * (hasAlpha ? 4 : 3);

    default:
      return null;
  }
}

function getPatchGeometries(width: number, height: number, patchWidth: number, patchHeight: number): MagickGeometry[] {
  const maxX = Math.max(0, width - patchWidth);
  const maxY = Math.max(0, height - patchHeight);
  const points = [
    [0, 0],
    [Math.round(maxX / 2), Math.round(maxY / 2)],
    [maxX, maxY],
  ] as const;
  const seen = new Set<string>();

  return points.flatMap(([x, y]) => {
    const key = `${x}:${y}`;
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [new MagickGeometry(x, y, patchWidth, patchHeight)];
  });
}

function estimatePatchEncodedSize(
  image: IMagickImage,
  format: (typeof FORMAT_MAP)[SupportedExt],
  metadataBytes: number
): number {
  const patchWidth = Math.min(image.width, SAMPLE_PATCH_EDGE);
  const patchHeight = Math.min(image.height, SAMPLE_PATCH_EDGE);
  const geometries = getPatchGeometries(image.width, image.height, patchWidth, patchHeight);
  const patchPixels = patchWidth * patchHeight;
  const encodedPerPixel = geometries.map((geometry) =>
    image.cloneArea(geometry, (patch) => Math.max(0, writeImageBytes(patch, format).byteLength - metadataBytes) / patchPixels)
  );
  const averagePerPixel = encodedPerPixel.reduce((sum, value) => sum + value, 0) / encodedPerPixel.length;

  return Math.round(averagePerPixel * image.width * image.height + metadataBytes);
}

function estimateThumbnailEncodedSize(
  image: IMagickImage,
  ext: SupportedExt,
  format: (typeof FORMAT_MAP)[SupportedExt],
  metadataBytes: number
): number {
  const maxDimension = Math.max(image.width, image.height);
  const scale = maxDimension > SAMPLE_THUMBNAIL_EDGE ? SAMPLE_THUMBNAIL_EDGE / maxDimension : 1;
  const sampleWidth = Math.max(1, Math.round(image.width * scale));
  const sampleHeight = Math.max(1, Math.round(image.height * scale));
  const samplePixels = sampleWidth * sampleHeight;

  const sampleBytes = image.clone((sample) => {
    if (scale < 1) {
      sample.thumbnail(sampleWidth, sampleHeight);
    }

    return writeImageBytes(sample, format).byteLength;
  });

  if (scale === 1) {
    return sampleBytes;
  }

  const variableBytes = Math.max(0, sampleBytes - metadataBytes);
  const scaleRatio = (image.width * image.height) / samplePixels;
  const scaledVariableBytes = variableBytes * scaleRatio * (THUMBNAIL_SCALE_BIAS[ext] ?? 1);

  return Math.round(scaledVariableBytes + metadataBytes);
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
      applyConversionOptions(image, options);
      outputBytes = writeImageBytes(image, format);
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

export async function getImageInfo(file: File): Promise<ImageInfo> {
  await ensureInitialized();
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  let info: ImageInfo | null = null;

  ImageMagick.read(inputBytes, (image) => {
    info = {
      width: image.width,
      height: image.height,
      channels: image.channelCount,
      hasAlpha: image.hasAlpha,
      fileSize: file.size,
      mimeType: file.type,
      sourceFormat: image.format?.toString().toLowerCase() ?? null,
      metadataBytes: getMetadataBytes(image),
    };
  });

  if (!info) {
    throw new Error(`Failed to read image info for "${file.name}"`);
  }
  return info;
}

/**
 * Estimate output file size in bytes by encoding a representative sample of the image.
 * Small outputs are encoded at full size; larger ones use cropped or thumbnail samples.
 */
export async function estimateOutputSize(
  file: File,
  info: ImageInfo,
  targetFormat: string,
  options: ConvertOptions = {}
): Promise<number | null> {
  await ensureInitialized();

  try {
    const { ext, format } = resolveTargetFormat(targetFormat);
    const inputBytes = new Uint8Array(await file.arrayBuffer());
    const metadataBytes = getEstimatedMetadataBytes(info, ext, options);

    return ImageMagick.read(inputBytes, (image) => {
      applyConversionOptions(image, options);

      const exactRawEstimate = getExactRawEstimate(ext, image.width, image.height, image.hasAlpha);
      if (exactRawEstimate !== null) {
        return exactRawEstimate;
      }

      const pixels = image.width * image.height;
      if (pixels <= SMALL_IMAGE_EXACT_PIXELS) {
        return writeImageBytes(image, format).byteLength;
      }

      if (PATCH_SAMPLE_FORMATS.has(ext)) {
        return estimatePatchEncodedSize(image, format, metadataBytes);
      }

      return estimateThumbnailEncodedSize(image, ext, format, metadataBytes);
    });
  } catch {
    return null;
  }
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
