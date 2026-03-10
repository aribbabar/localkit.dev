import exifr from "exifr";

export interface MetadataCategory {
  label: string;
  icon: string;
  fields: MetadataField[];
}

export interface MetadataField {
  key: string;
  label: string;
  value: string;
  category: string;
  editable: boolean;
}

export interface ImageMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  categories: MetadataCategory[];
  raw: Record<string, unknown>;
  thumbnailUrl?: string;
  previewUrl?: string;
}

const GPS_KEYS = new Set([
  "latitude",
  "longitude",
  "GPSLatitude",
  "GPSLongitude",
  "GPSAltitude",
  "GPSLatitudeRef",
  "GPSLongitudeRef",
  "GPSAltitudeRef",
  "GPSTimeStamp",
  "GPSDateStamp",
  "GPSSpeed",
  "GPSSpeedRef",
  "GPSImgDirection",
  "GPSImgDirectionRef",
  "GPSDestBearing",
  "GPSDestBearingRef",
  "GPSMapDatum",
  "GPSProcessingMethod",
]);

const CAMERA_KEYS = new Set([
  "Make",
  "Model",
  "LensModel",
  "LensMake",
  "LensInfo",
  "FocalLength",
  "FocalLengthIn35mmFormat",
  "FNumber",
  "ExposureTime",
  "ISO",
  "ISOSpeedRatings",
  "ExposureProgram",
  "ExposureMode",
  "MeteringMode",
  "WhiteBalance",
  "Flash",
  "ExposureBiasValue",
  "MaxApertureValue",
  "DigitalZoomRatio",
  "ShutterSpeedValue",
  "ApertureValue",
  "BrightnessValue",
  "SceneCaptureType",
  "Contrast",
  "Saturation",
  "Sharpness",
  "SubjectDistance",
  "SubjectDistanceRange",
  "LightSource",
  "SensingMethod",
  "FileSource",
  "SceneType",
  "CustomRendered",
  "GainControl",
]);

const IMAGE_KEYS = new Set([
  "ImageWidth",
  "ImageHeight",
  "ExifImageWidth",
  "ExifImageHeight",
  "Orientation",
  "XResolution",
  "YResolution",
  "ResolutionUnit",
  "BitsPerSample",
  "ColorSpace",
  "PixelXDimension",
  "PixelYDimension",
  "PhotometricInterpretation",
  "Compression",
  "YCbCrPositioning",
  "YCbCrSubSampling",
  "ComponentsConfiguration",
  "CompressedBitsPerPixel",
]);

const DATE_KEYS = new Set([
  "DateTimeOriginal",
  "CreateDate",
  "ModifyDate",
  "DateTimeDigitized",
  "GPSDateStamp",
  "OffsetTimeOriginal",
  "OffsetTime",
  "OffsetTimeDigitized",
  "SubSecTimeOriginal",
  "SubSecTimeDigitized",
  "SubSecTime",
]);

const AUTHOR_KEYS = new Set([
  "Artist",
  "Copyright",
  "ImageDescription",
  "XPTitle",
  "XPComment",
  "XPAuthor",
  "XPKeywords",
  "XPSubject",
  "UserComment",
  "DocumentName",
  "OwnerName",
  "BodySerialNumber",
  "CameraSerialNumber",
  "SerialNumber",
  "LensSerialNumber",
  "InternalSerialNumber",
]);

const SOFTWARE_KEYS = new Set([
  "Software",
  "ProcessingSoftware",
  "HostComputer",
  "ExifVersion",
  "FlashpixVersion",
  "InteropIndex",
  "InteropVersion",
]);

function categorizeKey(key: string): string {
  if (GPS_KEYS.has(key)) return "gps";
  if (CAMERA_KEYS.has(key)) return "camera";
  if (IMAGE_KEYS.has(key)) return "image";
  if (DATE_KEYS.has(key)) return "dates";
  if (AUTHOR_KEYS.has(key)) return "author";
  if (SOFTWARE_KEYS.has(key)) return "software";
  return "other";
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/GPS /g, "GPS ")
    .replace(/XP /g, "XP ")
    .replace(/ISO /g, "ISO ")
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString();
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return `[Binary data, ${value instanceof Uint8Array ? value.length : value.byteLength} bytes]`;
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

const EDITABLE_KEYS = new Set([
  "Artist",
  "Copyright",
  "ImageDescription",
  "XPTitle",
  "XPComment",
  "XPAuthor",
  "XPKeywords",
  "XPSubject",
  "UserComment",
  "DocumentName",
]);

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  camera: { label: "Camera & Lens", icon: "camera" },
  image: { label: "Image Details", icon: "image" },
  gps: { label: "GPS / Location", icon: "gps" },
  dates: { label: "Dates & Time", icon: "dates" },
  author: { label: "Author & Copyright", icon: "author" },
  software: { label: "Software", icon: "software" },
  other: { label: "Other", icon: "other" },
};

const CATEGORY_ORDER = ["camera", "image", "gps", "dates", "author", "software", "other"];

// Keys to skip (internal or not useful to display)
const SKIP_KEYS = new Set([
  "thumbnail",
  "ThumbnailOffset",
  "ThumbnailLength",
  "ThumbnailImage",
  "PreviewImage",
  "JpgFromRaw",
  "OtherImage",
  "Makerote",
  "MakerNote",
  "undefined",
]);

export async function parseMetadata(file: File): Promise<ImageMetadata> {
  const buffer = await file.arrayBuffer();

  let raw: Record<string, unknown> = {};
  let thumbnailUrl: string | undefined;

  try {
    const parsed = await exifr.parse(buffer, {
      tiff: true,
      xmp: true,
      icc: false,
      iptc: true,
      jfif: true,
      ihdr: true,
      exif: true,
      gps: true,
      interop: true,
      makerNote: false,
      userComment: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
      mergeOutput: true,
    });

    if (parsed) {
      raw = parsed;
    }
  } catch {
    // File may not contain any EXIF data
  }

  try {
    const thumb = await exifr.thumbnail(buffer);
    if (thumb) {
      thumbnailUrl = URL.createObjectURL(new Blob([thumb], { type: "image/jpeg" }));
    }
  } catch {
    // No embedded thumbnail
  }

  // Build preview URL
  const previewUrl = URL.createObjectURL(file);

  // Categorize fields
  const grouped: Record<string, MetadataField[]> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (SKIP_KEYS.has(key)) continue;
    const formatted = formatValue(value);
    if (!formatted) continue;

    const cat = categorizeKey(key);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      key,
      label: humanizeKey(key),
      value: formatted,
      category: cat,
      editable: EDITABLE_KEYS.has(key),
    });
  }

  const categories: MetadataCategory[] = CATEGORY_ORDER
    .filter((cat) => grouped[cat]?.length)
    .map((cat) => ({
      label: CATEGORY_META[cat].label,
      icon: CATEGORY_META[cat].icon,
      fields: grouped[cat],
    }));

  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || "unknown",
    categories,
    raw,
    thumbnailUrl,
    previewUrl,
  };
}

export interface StrippedImage {
  name: string;
  blob: Blob;
  buffer: ArrayBuffer;
}

export async function stripMetadata(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<StrippedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0);

        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
        const quality = mimeType === "image/jpeg" ? 0.95 : undefined;

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error("Failed to export image"));
              return;
            }

            const baseName = file.name.replace(/\.[^.]+$/, "");
            const outExt = mimeType === "image/jpeg" ? "jpg" : "png";
            const name = `${baseName}_clean.${outExt}`;

            blob.arrayBuffer().then((buffer) => {
              onProgress?.(1, 1);
              resolve({ name, blob, buffer });
            });
          },
          mimeType,
          quality,
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = url;
  });
}

export async function stripMetadataBatch(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<StrippedImage[]> {
  const results: StrippedImage[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await stripMetadata(files[i]);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }

  return results;
}

export function cleanupMetadata(meta: ImageMetadata): void {
  if (meta.thumbnailUrl) URL.revokeObjectURL(meta.thumbnailUrl);
  if (meta.previewUrl) URL.revokeObjectURL(meta.previewUrl);
}
