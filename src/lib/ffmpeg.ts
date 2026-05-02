import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import ffmpegWorkerURL from "@ffmpeg/ffmpeg/worker?url";
import singleCoreURL from "@ffmpeg/core?url";
import singleWasmURL from "@ffmpeg/core/wasm?url";
import mtCoreURL from "@ffmpeg/core-mt?url";
import mtWasmURL from "@ffmpeg/core-mt/wasm?url";
import mtWorkerURL from "@ffmpeg/core-mt/worker?url";

export type ConversionMode = "fast" | "balanced" | "small";
export type ConversionStrategy = "transcode";
export type FFmpegEngine = "multi-thread" | "single-thread";

export interface VideoConvertOptions {
  format: string;
  mode?: ConversionMode;
  quality?: string; // CRF value: "18" (high) to "35" (low)
  resolution?: string; // e.g. "1280x720", "1920x1080", or "" for original
  frameRate?: number; // e.g. 30, 24, 60, or 0 for original
  audioBitrate?: string; // e.g. "128k", "192k", "320k"
  preset?: string; // encoding speed: "ultrafast" | "fast" | "medium" | "slow"
  muteAudio?: boolean;
}

export interface ConversionTimings {
  loadMs?: number;
  mountMs?: number;
  execMs?: number;
  readMs?: number;
  totalMs: number;
}

export interface ConvertedVideoFile {
  name: string;
  blob: Blob;
  buffer?: ArrayBuffer;
  strategy: ConversionStrategy;
  timings: ConversionTimings;
  engine?: FFmpegEngine;
}

export interface VideoConversionPlan {
  strategy: ConversionStrategy;
  inputExt: string;
  outputExt: string;
  requiresTranscode: boolean;
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

export const CONVERSION_MODE_OPTIONS = [
  {
    value: "fast",
    label: "Fast",
    description: "Faster transcode",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Re-encode normally",
  },
  {
    value: "small",
    label: "Small",
    description: "Prefer compression",
  },
] as const;

const AUDIO_ONLY_FORMATS = new Set(["mp3", "wav", "ogg", "aac", "flac"]);

const MIME_MAP: Record<string, string> = Object.fromEntries(
  VIDEO_FORMATS.map((f) => [f.ext, f.mime]),
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

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;
let selectedEngine: FFmpegEngine | null = null;
let currentProgressCallback: ((progress: number) => void) | undefined;
let currentLogCallback: ((message: string) => void) | undefined;
let uniqueFileId = 0;

export function isAcceptedVideo(file: File): boolean {
  return (
    ACCEPTED_VIDEO_TYPES.includes(file.type) ||
    ACCEPTED_VIDEO_EXTENSIONS.test(file.name)
  );
}

export const ACCEPTED_VIDEO_INPUT =
  "video/*,.mp4,.webm,.avi,.mkv,.mov,.flv,.ogv,.ts,.mpeg,.mpg,.3gp,.wmv,.m4v";

export function isAudioOnlyFormat(ext: string): boolean {
  return AUDIO_ONLY_FORMATS.has(ext.toLowerCase());
}

export function isMultiThreadFFmpegAvailable(): boolean {
  return (
    typeof globalThis.SharedArrayBuffer !== "undefined" &&
    "crossOriginIsolated" in globalThis &&
    globalThis.crossOriginIsolated === true
  );
}

export function getSelectedFFmpegEngine(): FFmpegEngine {
  return (
    selectedEngine ??
    (isMultiThreadFFmpegAvailable() ? "multi-thread" : "single-thread")
  );
}

export function planVideoConversion(
  filename: string,
  options: VideoConvertOptions,
): VideoConversionPlan {
  const inputExt = getFileExtension(filename) || "mp4";
  const outputExt = options.format.toLowerCase();

  return {
    strategy: "transcode",
    inputExt,
    outputExt,
    requiresTranscode: true,
  };
}

export function buildVideoConversionArgs(
  inputName: string,
  outputName: string,
  options: VideoConvertOptions,
): string[] {
  return buildTranscodeArgs(inputName, outputName, options);
}

export async function warmFFmpeg(
  onLog?: (message: string) => void,
): Promise<FFmpegEngine> {
  const start = now();
  await getFFmpeg(undefined, onLog);
  onLog?.(
    `FFmpeg warmed in ${formatMs(now() - start)} (${getSelectedFFmpegEngine()}).`,
  );
  return getSelectedFFmpegEngine();
}

async function getFFmpeg(
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void,
): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
    ffmpegInstance.on("progress", ({ progress }) => {
      currentProgressCallback?.(Math.max(0, Math.min(1, progress)));
    });
    ffmpegInstance.on("log", ({ message }) => {
      currentLogCallback?.(message);
    });
  }

  currentProgressCallback = onProgress;
  currentLogCallback = onLog;

  if (!loadPromise) {
    selectedEngine = isMultiThreadFFmpegAvailable()
      ? "multi-thread"
      : "single-thread";
    const config =
      selectedEngine === "multi-thread"
        ? {
            classWorkerURL: ffmpegWorkerURL,
            coreURL: mtCoreURL,
            wasmURL: mtWasmURL,
            workerURL: mtWorkerURL,
          }
        : {
            classWorkerURL: ffmpegWorkerURL,
            coreURL: singleCoreURL,
            wasmURL: singleWasmURL,
          };

    loadPromise = ffmpegInstance.load(config).then(() => {});
  }

  await loadPromise;
  return ffmpegInstance;
}

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > -1 ? filename.slice(dot + 1).toLowerCase() : "";
}

function changeExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.substring(0, dot) : filename;
  return `${base}.${newExt}`;
}

function buildTranscodeArgs(
  inputName: string,
  outputName: string,
  options: VideoConvertOptions,
): string[] {
  const args: string[] = ["-i", inputName];
  const outputExt = options.format.toLowerCase();
  const mode = options.mode ?? "fast";
  const isAudio = isAudioOnlyFormat(outputExt);

  if (isAudio) {
    args.push("-vn");
  } else {
    if (options.resolution) {
      args.push("-vf", `scale=${options.resolution.replace("x", ":")}`);
    }

    if (options.frameRate && options.frameRate > 0) {
      args.push("-r", String(options.frameRate));
    }

    if (outputExt === "gif") {
      if (!options.resolution) {
        args.push("-vf", "fps=10,scale=480:-1:flags=lanczos");
      } else {
        const vfIdx = args.indexOf("-vf");
        if (vfIdx !== -1) {
          args[vfIdx + 1] = `fps=10,${args[vfIdx + 1]}:flags=lanczos`;
        }
      }
    }

    const quality = options.quality || (mode === "small" ? "28" : undefined);
    if (quality) {
      if (outputExt === "webm") {
        args.push("-crf", quality, "-b:v", "0");
      } else if (outputExt !== "gif") {
        args.push("-crf", quality);
      }
    }

    const preset =
      options.preset ||
      (mode === "fast" ? "ultrafast" : mode === "small" ? "slow" : undefined);
    if (preset && outputExt !== "gif" && outputExt !== "webm") {
      args.push("-preset", preset);
    }
  }

  if (options.muteAudio && !isAudio) {
    args.push("-an");
  } else if (options.audioBitrate) {
    args.push("-b:a", options.audioBitrate);
  }

  args.push(outputName);
  return args;
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function formatMs(value: number): string {
  return `${Math.round(value)}ms`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function makeFileNames(file: File, outputExt: string) {
  const id = `${Date.now()}_${uniqueFileId++}`;
  const inputExt = getFileExtension(file.name) || "mp4";
  return {
    id,
    inputFileName: `input_${id}.${inputExt}`,
    outputName: `output_${id}.${outputExt}`,
    mountPoint: `/input_${id}`,
  };
}

async function prepareInputFile(
  ffmpeg: FFmpeg,
  file: File,
  inputFileName: string,
  mountPoint: string,
): Promise<{ inputName: string; mounted: boolean }> {
  try {
    await ffmpeg.createDir(mountPoint);
    await ffmpeg.mount(
      FFFSType.WORKERFS,
      { blobs: [{ name: inputFileName, data: file }] },
      mountPoint,
    );
    return { inputName: `${mountPoint}/${inputFileName}`, mounted: true };
  } catch {
    try {
      await ffmpeg.unmount(mountPoint);
    } catch {}
    try {
      await ffmpeg.deleteDir(mountPoint);
    } catch {}

    const inputData = await fetchFile(file);
    await ffmpeg.writeFile(inputFileName, inputData);
    return { inputName: inputFileName, mounted: false };
  }
}

async function cleanupInput(
  ffmpeg: FFmpeg,
  inputName: string,
  mountPoint: string,
  mounted: boolean,
): Promise<void> {
  if (mounted) {
    try {
      await ffmpeg.unmount(mountPoint);
    } catch {}
    try {
      await ffmpeg.deleteDir(mountPoint);
    } catch {}
    return;
  }

  try {
    await ffmpeg.deleteFile(inputName);
  } catch {}
}

async function readOutput(
  ffmpeg: FFmpeg,
  outputName: string,
  options: VideoConvertOptions,
  file: File,
  strategy: ConversionStrategy,
  timings: ConversionTimings,
): Promise<ConvertedVideoFile> {
  const readStart = now();
  const outputData = await ffmpeg.readFile(outputName);
  timings.readMs = now() - readStart;

  const outputBytes =
    outputData instanceof Uint8Array
      ? outputData
      : new TextEncoder().encode(outputData as string);
  const buffer = toArrayBuffer(outputBytes);
  const mime = MIME_MAP[options.format] || "application/octet-stream";

  return {
    name: changeExtension(file.name, options.format),
    blob: new Blob([buffer], { type: mime }),
    buffer,
    strategy,
    timings,
    engine: getSelectedFFmpegEngine(),
  };
}

export async function convertVideo(
  file: File,
  options: VideoConvertOptions,
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void,
): Promise<ConvertedVideoFile> {
  const totalStart = now();
  const normalizedOptions: VideoConvertOptions = {
    ...options,
    format: options.format.toLowerCase(),
    mode: options.mode ?? "fast",
  };
  const plan = planVideoConversion(file.name, normalizedOptions);
  const timings: ConversionTimings = { totalMs: 0 };

  const loadStart = now();
  const ffmpeg = await getFFmpeg(onProgress, onLog);
  timings.loadMs = now() - loadStart;

  const { inputFileName, outputName, mountPoint } = makeFileNames(
    file,
    normalizedOptions.format,
  );
  let inputName = inputFileName;
  let mounted = false;

  try {
    const mountStart = now();
    const prepared = await prepareInputFile(
      ffmpeg,
      file,
      inputFileName,
      mountPoint,
    );
    inputName = prepared.inputName;
    mounted = prepared.mounted;
    timings.mountMs = now() - mountStart;
    onLog?.(
      prepared.mounted
        ? `Mounted ${file.name} with WORKERFS in ${formatMs(timings.mountMs)}.`
        : `Copied ${file.name} into FFmpeg memory in ${formatMs(timings.mountMs)}.`,
    );

    const finalStrategy = plan.strategy;
    const args = buildVideoConversionArgs(
      inputName,
      outputName,
      normalizedOptions,
    );

    const execStart = now();
    const exitCode = await ffmpeg.exec(args);
    timings.execMs = now() - execStart;

    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`);
    }

    timings.totalMs = now() - totalStart;
    onLog?.(
      `Finished ${file.name} with ${finalStrategy} in ${formatMs(
        timings.totalMs,
      )} (load ${formatMs(timings.loadMs ?? 0)}, input ${formatMs(
        timings.mountMs ?? 0,
      )}, exec ${formatMs(timings.execMs ?? 0)}).`,
    );

    return await readOutput(
      ffmpeg,
      outputName,
      normalizedOptions,
      file,
      finalStrategy,
      timings,
    );
  } finally {
    await cleanupInput(ffmpeg, inputName, mountPoint, mounted);
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {}
    currentProgressCallback = undefined;
    currentLogCallback = undefined;
  }
}

export async function convertBatch(
  files: File[],
  options: VideoConvertOptions,
  onFileProgress?: (
    fileIndex: number,
    fileProgress: number,
    total: number,
  ) => void,
  onLog?: (message: string) => void,
): Promise<ConvertedVideoFile[]> {
  const results: ConvertedVideoFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await convertVideo(
      files[i],
      options,
      (progress) => onFileProgress?.(i, progress, files.length),
      onLog,
    );
    results.push(result);
    onFileProgress?.(i + 1, 0, files.length);
  }

  return results;
}
