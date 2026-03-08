import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export interface VideoConvertOptions {
  format: string;
  quality?: string; // CRF value: "18" (high) to "35" (low)
  resolution?: string; // e.g. "1280x720", "1920x1080", or "" for original
  frameRate?: number; // e.g. 30, 24, 60, or 0 for original
  audioBitrate?: string; // e.g. "128k", "192k", "320k"
  preset?: string; // encoding speed: "ultrafast" | "fast" | "medium" | "slow"
  muteAudio?: boolean;
}

export interface ConvertedVideoFile {
  name: string;
  blob: Blob;
  buffer: ArrayBuffer;
}

export const VIDEO_FORMATS = [
  { ext: "mp4", label: "MP4", mime: "video/mp4" },
  { ext: "webm", label: "WebM", mime: "video/webm" },
  { ext: "avi", label: "AVI", mime: "video/x-msvideo" },
  { ext: "mkv", label: "MKV", mime: "video/x-matroska" },
  { ext: "mov", label: "MOV", mime: "video/quicktime" },
  { ext: "flv", label: "FLV", mime: "video/x-flv" },
  { ext: "ogv", label: "OGV", mime: "video/ogg" },
  { ext: "ts", label: "TS", mime: "video/mp2t" },
  { ext: "gif", label: "GIF", mime: "image/gif" },
  { ext: "mp3", label: "MP3 (audio)", mime: "audio/mpeg" },
  { ext: "wav", label: "WAV (audio)", mime: "audio/wav" },
  { ext: "ogg", label: "OGG (audio)", mime: "audio/ogg" },
  { ext: "aac", label: "AAC (audio)", mime: "audio/aac" },
  { ext: "flac", label: "FLAC (audio)", mime: "audio/flac" },
] as const;

export const QUALITY_PRESETS = [
  { value: "18", label: "High (CRF 18)" },
  { value: "23", label: "Medium (CRF 23)" },
  { value: "28", label: "Low (CRF 28)" },
  { value: "35", label: "Very Low (CRF 35)" },
] as const;

export const RESOLUTION_OPTIONS = [
  { value: "", label: "Original" },
  { value: "1920x1080", label: "1080p" },
  { value: "1280x720", label: "720p" },
  { value: "854x480", label: "480p" },
  { value: "640x360", label: "360p" },
] as const;

export const FRAMERATE_OPTIONS = [
  { value: 0, label: "Original" },
  { value: 60, label: "60 fps" },
  { value: 30, label: "30 fps" },
  { value: 24, label: "24 fps" },
  { value: 15, label: "15 fps" },
] as const;

export const AUDIO_BITRATE_OPTIONS = [
  { value: "", label: "Default" },
  { value: "320k", label: "320 kbps" },
  { value: "256k", label: "256 kbps" },
  { value: "192k", label: "192 kbps" },
  { value: "128k", label: "128 kbps" },
  { value: "96k", label: "96 kbps" },
  { value: "64k", label: "64 kbps" },
] as const;

export const PRESET_OPTIONS = [
  { value: "ultrafast", label: "Ultrafast" },
  { value: "fast", label: "Fast" },
  { value: "medium", label: "Medium" },
  { value: "slow", label: "Slow (better compression)" },
] as const;

const AUDIO_ONLY_FORMATS = new Set(["mp3", "wav", "ogg", "aac", "flac"]);

const MIME_MAP: Record<string, string> = Object.fromEntries(
  VIDEO_FORMATS.map((f) => [f.ext, f.mime])
);

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "video/quicktime",
  "video/x-flv",
  "video/ogg",
  "video/mp2t",
  "video/mpeg",
  "video/3gpp",
  "video/x-ms-wmv",
];

const ACCEPTED_VIDEO_EXTENSIONS =
  /\.(mp4|webm|avi|mkv|mov|flv|ogv|ts|mpeg|mpg|3gp|wmv|m4v)$/i;

export function isAcceptedVideo(file: File): boolean {
  return (
    ACCEPTED_VIDEO_TYPES.includes(file.type) ||
    ACCEPTED_VIDEO_EXTENSIONS.test(file.name)
  );
}

export const ACCEPTED_VIDEO_INPUT =
  "video/*,.mp4,.webm,.avi,.mkv,.mov,.flv,.ogv,.ts,.mpeg,.mpg,.3gp,.wmv,.m4v";

export function isAudioOnlyFormat(ext: string): boolean {
  return AUDIO_ONLY_FORMATS.has(ext);
}

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

async function getFFmpeg(
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void
): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }

  const ffmpeg = ffmpegInstance;

  // Clear previous listeners
  ffmpeg.on("progress", () => {});
  ffmpeg.on("log", () => {});

  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      onProgress(Math.max(0, Math.min(1, progress)));
    });
  }

  if (onLog) {
    ffmpeg.on("log", ({ message }) => {
      onLog(message);
    });
  }

  if (!loadPromise) {
    loadPromise = ffmpeg.load().then(() => {});
  }

  await loadPromise;
  return ffmpeg;
}

function changeExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.substring(0, dot) : filename;
  return `${base}.${newExt}`;
}

function buildArgs(
  inputName: string,
  outputName: string,
  options: VideoConvertOptions
): string[] {
  const args: string[] = ["-i", inputName];
  const isAudio = isAudioOnlyFormat(options.format);

  if (isAudio) {
    // Audio extraction - no video
    args.push("-vn");
  } else {
    // Video options
    if (options.resolution) {
      args.push("-vf", `scale=${options.resolution.replace("x", ":")}`);
    }

    if (options.frameRate && options.frameRate > 0) {
      args.push("-r", String(options.frameRate));
    }

    if (options.format === "gif") {
      // GIF-specific: use a reasonable fps and scale
      if (!options.resolution) {
        args.push("-vf", "fps=10,scale=480:-1:flags=lanczos");
      } else {
        // Replace existing -vf with one that includes fps
        const vfIdx = args.indexOf("-vf");
        if (vfIdx !== -1) {
          args[vfIdx + 1] = `fps=10,${args[vfIdx + 1]}:flags=lanczos`;
        }
      }
    }

    // Quality / CRF (applies to h264/libx264, libvpx)
    if (options.quality) {
      if (options.format === "webm") {
        args.push("-crf", options.quality, "-b:v", "0");
      } else if (options.format !== "gif") {
        args.push("-crf", options.quality);
      }
    }

    // Encoding preset (for h264)
    if (
      options.preset &&
      !isAudio &&
      options.format !== "gif" &&
      options.format !== "webm"
    ) {
      args.push("-preset", options.preset);
    }
  }

  // Audio options
  if (options.muteAudio && !isAudio) {
    args.push("-an");
  } else if (options.audioBitrate) {
    args.push("-b:a", options.audioBitrate);
  }

  args.push(outputName);
  return args;
}

export async function convertVideo(
  file: File,
  options: VideoConvertOptions,
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void
): Promise<ConvertedVideoFile> {
  const ffmpeg = await getFFmpeg(onProgress, onLog);

  const inputExt = file.name.split(".").pop() || "mp4";
  const inputName = `input_${Date.now()}.${inputExt}`;
  const outputName = `output_${Date.now()}.${options.format}`;

  try {
    const inputData = await fetchFile(file);
    await ffmpeg.writeFile(inputName, inputData);

    const args = buildArgs(inputName, outputName, options);
    const exitCode = await ffmpeg.exec(args);

    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`);
    }

    const outputData = await ffmpeg.readFile(outputName);
    let outputBytes: Uint8Array;
    if (outputData instanceof Uint8Array) {
      outputBytes = outputData;
    } else {
      outputBytes = new TextEncoder().encode(outputData as string);
    }

    const buffer = outputBytes.buffer.slice(
      outputBytes.byteOffset,
      outputBytes.byteOffset + outputBytes.byteLength
    ) as ArrayBuffer;

    const mime = MIME_MAP[options.format] || "application/octet-stream";

    return {
      name: changeExtension(file.name, options.format),
      blob: new Blob([buffer], { type: mime }),
      buffer,
    };
  } finally {
    // Clean up files from memory
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {}
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {}
  }
}

export async function convertBatch(
  files: File[],
  options: VideoConvertOptions,
  onFileProgress?: (
    fileIndex: number,
    fileProgress: number,
    total: number
  ) => void,
  onLog?: (message: string) => void
): Promise<ConvertedVideoFile[]> {
  const results: ConvertedVideoFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await convertVideo(
      files[i],
      options,
      (progress) => onFileProgress?.(i, progress, files.length),
      onLog
    );
    results.push(result);
    onFileProgress?.(i + 1, 0, files.length);
  }

  return results;
}
