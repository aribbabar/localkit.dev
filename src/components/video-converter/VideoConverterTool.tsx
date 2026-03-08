import { useState, type ChangeEvent, type DragEvent } from "react";
import type { ConvertedVideoFile, VideoConvertOptions } from "../../lib/ffmpeg";

let ffmpegLib: typeof import("../../lib/ffmpeg") | null = null;

async function getFFmpegLib() {
  if (!ffmpegLib) {
    ffmpegLib = await import("../../lib/ffmpeg");
  }
  return ffmpegLib;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function VideoConverterTool() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [convertedFiles, setConvertedFiles] = useState<ConvertedVideoFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [loadingFFmpeg, setLoadingFFmpeg] = useState(false);
  const [progress, setProgress] = useState({ fileIndex: 0, fileProgress: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Conversion options
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [quality, setQuality] = useState("23");
  const [resolution, setResolution] = useState("");
  const [frameRate, setFrameRate] = useState(0);
  const [audioBitrate, setAudioBitrate] = useState("");
  const [preset, setPreset] = useState("medium");
  const [muteAudio, setMuteAudio] = useState(false);

  const hasFiles = selectedFiles.length > 0;

  async function addFiles(files: File[]) {
    const lib = await getFFmpegLib();
    const accepted = files.filter(lib.isAcceptedVideo);
    if (!accepted.length) return;
    setSelectedFiles((prev) => [...prev, ...accepted]);
    setConvertedFiles([]);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearFiles() {
    setSelectedFiles([]);
    setConvertedFiles([]);
    setProgress({ fileIndex: 0, fileProgress: 0, total: 0 });
    setLogs([]);
  }

  async function convertFiles() {
    if (!selectedFiles.length || isConverting) return;

    setIsConverting(true);
    setLoadingFFmpeg(true);
    setConvertedFiles([]);
    setLogs([]);
    setProgress({ fileIndex: 0, fileProgress: 0, total: selectedFiles.length });

    try {
      const lib = await getFFmpegLib();
      setLoadingFFmpeg(false);

      const options: VideoConvertOptions = {
        format: outputFormat,
        quality: lib.isAudioOnlyFormat(outputFormat) ? undefined : quality,
        resolution: lib.isAudioOnlyFormat(outputFormat) ? undefined : resolution,
        frameRate: lib.isAudioOnlyFormat(outputFormat) ? undefined : frameRate,
        audioBitrate: audioBitrate || undefined,
        preset,
        muteAudio: lib.isAudioOnlyFormat(outputFormat) ? false : muteAudio,
      };

      const results = await lib.convertBatch(
        selectedFiles,
        options,
        (fileIndex, fileProgress, total) => {
          setProgress({ fileIndex, fileProgress, total });
        },
        (message) => {
          setLogs((prev) => [...prev.slice(-200), message]);
        }
      );

      setConvertedFiles(results);
    } catch (err: any) {
      alert(`Conversion error: ${err?.message ?? String(err)}`);
    } finally {
      setIsConverting(false);
      setLoadingFFmpeg(false);
    }
  }

  function downloadFile(file: ConvertedVideoFile) {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAll() {
    if (!convertedFiles.length || isZipping) return;

    if (convertedFiles.length === 1) {
      downloadFile(convertedFiles[0]);
      return;
    }

    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of convertedFiles) {
        zip.file(file.name, file.buffer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "localkit-converted-videos.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Zip error: ${err?.message ?? String(err)}`);
    } finally {
      setIsZipping(false);
    }
  }

  const lib = ffmpegLib;
  const VIDEO_FORMATS = lib?.VIDEO_FORMATS ?? [
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
  ];
  const QUALITY_PRESETS = lib?.QUALITY_PRESETS ?? [
    { value: "18", label: "High (CRF 18)" },
    { value: "23", label: "Medium (CRF 23)" },
    { value: "28", label: "Low (CRF 28)" },
    { value: "35", label: "Very Low (CRF 35)" },
  ];
  const RESOLUTION_OPTIONS = lib?.RESOLUTION_OPTIONS ?? [
    { value: "", label: "Original" },
    { value: "1920x1080", label: "1080p" },
    { value: "1280x720", label: "720p" },
    { value: "854x480", label: "480p" },
    { value: "640x360", label: "360p" },
  ];
  const FRAMERATE_OPTIONS = lib?.FRAMERATE_OPTIONS ?? [
    { value: 0, label: "Original" },
    { value: 60, label: "60 fps" },
    { value: 30, label: "30 fps" },
    { value: 24, label: "24 fps" },
    { value: 15, label: "15 fps" },
  ];
  const AUDIO_BITRATE_OPTIONS = lib?.AUDIO_BITRATE_OPTIONS ?? [
    { value: "", label: "Default" },
    { value: "320k", label: "320 kbps" },
    { value: "256k", label: "256 kbps" },
    { value: "192k", label: "192 kbps" },
    { value: "128k", label: "128 kbps" },
    { value: "96k", label: "96 kbps" },
    { value: "64k", label: "64 kbps" },
  ];
  const PRESET_OPTIONS = lib?.PRESET_OPTIONS ?? [
    { value: "ultrafast", label: "Ultrafast" },
    { value: "fast", label: "Fast" },
    { value: "medium", label: "Medium" },
    { value: "slow", label: "Slow (better compression)" },
  ];

  const isAudioOnly = lib?.isAudioOnlyFormat(outputFormat) ?? ["mp3", "wav", "ogg", "aac", "flac"].includes(outputFormat);

  const overallProgress =
    progress.total > 0
      ? ((progress.fileIndex + progress.fileProgress) / progress.total) * 100
      : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <div className="space-y-6">
        {/* Drop zone */}
        <div
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-bg-card/40 p-10 text-center transition-all duration-300 hover:bg-bg-card/60 ${
            isDragging
              ? "border-accent-blue bg-accent-blue/5"
              : "border-border-card hover:border-border-card-hover"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept="video/*,.mp4,.webm,.avi,.mkv,.mov,.flv,.ogv,.ts,.mpeg,.mpg,.3gp,.wmv,.m4v"
            className="absolute inset-0 z-10 cursor-pointer opacity-0"
            onChange={handleFileInputChange}
          />

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-accent-blue/20 bg-accent-blue/10">
            <svg
              className="h-7 w-7 text-accent-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <p className="font-display text-sm font-semibold text-text-primary">
            Drop videos here or <span className="text-accent-blue">browse</span>
          </p>
          <p className="mt-1.5 text-xs text-text-muted">
            MP4, WebM, AVI, MKV, MOV, FLV, OGV, TS, and more
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Multiple files supported for batch conversion
          </p>
        </div>

        {/* FFmpeg log viewer */}
        {(isConverting || logs.length > 0) && (
          <div className="rounded-xl border border-border-card bg-bg-card p-4">
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="flex w-full items-center justify-between text-xs font-medium text-text-secondary"
            >
              <span>FFmpeg Output</span>
              <svg
                className={`h-4 w-4 transition-transform ${showLogs ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showLogs && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-bg-primary p-3 font-mono text-[10px] leading-relaxed text-text-muted">
                {logs.length ? logs.join("\n") : "Waiting for output..."}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="space-y-4">
        {/* Selected files panel */}
        {hasFiles && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-text-primary">
                Selected Files <span className="text-text-muted">({selectedFiles.length})</span>
              </h3>
              <button
                type="button"
                onClick={clearFiles}
                className="text-xs text-text-muted transition-colors hover:text-accent-red"
              >
                Clear all
              </button>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-border-card bg-bg-secondary px-3 py-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent-blue/10">
                    <svg
                      className="h-4 w-4 text-accent-blue"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">{file.name}</p>
                    <p className="text-[10px] text-text-muted">{formatSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="shrink-0 text-text-muted transition-colors hover:text-accent-red"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversion settings */}
        {hasFiles && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-4 text-sm font-semibold text-text-primary">
              Conversion Settings
            </h3>

            <div className="space-y-4">
              {/* Output format */}
              <div>
                <label htmlFor="output-format" className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Output Format
                </label>
                <select
                  id="output-format"
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                >
                  <optgroup label="Video">
                    {VIDEO_FORMATS.filter((f) => !f.mime.startsWith("audio/")).map((format) => (
                      <option key={format.ext} value={format.ext}>
                        {format.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Audio (extract)">
                    {VIDEO_FORMATS.filter((f) => f.mime.startsWith("audio/")).map((format) => (
                      <option key={format.ext} value={format.ext}>
                        {format.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Video-only settings */}
              {!isAudioOnly && (
                <>
                  {/* Quality */}
                  <div>
                    <label htmlFor="quality" className="mb-1.5 block text-xs font-medium text-text-secondary">
                      Quality
                    </label>
                    <select
                      id="quality"
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                    >
                      {QUALITY_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Resolution */}
                  <div>
                    <label htmlFor="resolution" className="mb-1.5 block text-xs font-medium text-text-secondary">
                      Resolution
                    </label>
                    <select
                      id="resolution"
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                    >
                      {RESOLUTION_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Frame rate */}
                  <div>
                    <label htmlFor="framerate" className="mb-1.5 block text-xs font-medium text-text-secondary">
                      Frame Rate
                    </label>
                    <select
                      id="framerate"
                      value={frameRate}
                      onChange={(e) => setFrameRate(Number(e.target.value))}
                      className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                    >
                      {FRAMERATE_OPTIONS.map((fr) => (
                        <option key={fr.value} value={fr.value}>
                          {fr.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Encoding preset */}
                  {outputFormat !== "gif" && outputFormat !== "webm" && (
                    <div>
                      <label htmlFor="preset" className="mb-1.5 block text-xs font-medium text-text-secondary">
                        Encoding Speed
                      </label>
                      <select
                        id="preset"
                        value={preset}
                        onChange={(e) => setPreset(e.target.value)}
                        className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                      >
                        {PRESET_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Mute audio */}
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={muteAudio}
                      onChange={(e) => setMuteAudio(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                        muteAudio
                          ? "border-accent-blue bg-accent-blue/20"
                          : "border-border-card bg-bg-secondary"
                      }`}
                    >
                      <svg
                        className={`h-3 w-3 text-accent-blue ${muteAudio ? "block" : "hidden"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <span className="text-xs text-text-secondary">Remove audio track</span>
                  </label>
                </>
              )}

              {/* Audio bitrate (shown for all except muted) */}
              {!muteAudio && (
                <div>
                  <label htmlFor="audio-bitrate" className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Audio Bitrate <span className="text-text-muted">(optional)</span>
                  </label>
                  <select
                    id="audio-bitrate"
                    value={audioBitrate}
                    onChange={(e) => setAudioBitrate(e.target.value)}
                    className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                  >
                    {AUDIO_BITRATE_OPTIONS.map((ab) => (
                      <option key={ab.value} value={ab.value}>
                        {ab.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Convert button */}
            <button
              type="button"
              onClick={convertFiles}
              disabled={isConverting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-blue px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-blue/80 hover:shadow-[0_0_24px_rgba(59,130,246,0.25)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182"
                />
              </svg>
              {isConverting
                ? loadingFFmpeg
                  ? "Loading FFmpeg..."
                  : "Converting..."
                : "Convert"}
            </button>
          </div>
        )}

        {/* Progress */}
        {isConverting && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                {loadingFFmpeg ? "Loading FFmpeg WASM..." : "Converting..."}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {progress.fileIndex}/{progress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
              <div
                className="h-full rounded-full bg-accent-blue transition-all duration-300"
                style={{
                  width: `${Math.round(overallProgress)}%`,
                }}
              />
            </div>
            {!loadingFFmpeg && (
              <p className="mt-2 text-[10px] text-text-muted">
                File {Math.min(progress.fileIndex + 1, progress.total)} of {progress.total}
                {progress.fileProgress > 0 && ` — ${Math.round(progress.fileProgress * 100)}%`}
              </p>
            )}
          </div>
        )}

        {/* Converted files */}
        {convertedFiles.length > 0 && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-accent-green">
                Conversion Complete
              </h3>
              <button
                type="button"
                onClick={downloadAll}
                disabled={isZipping}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-1.5 text-xs font-medium text-accent-green transition-all hover:bg-accent-green/20 disabled:pointer-events-none disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                {isZipping ? "Zipping..." : convertedFiles.length > 1 ? "Download ZIP" : "Download"}
              </button>
            </div>

            <div className="space-y-2">
              {convertedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.buffer.byteLength}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-accent-green/20 bg-accent-green/5 px-3 py-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent-green/10">
                    <svg
                      className="h-4 w-4 text-accent-green"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">{file.name}</p>
                    <p className="text-[10px] text-text-muted">{formatSize(file.buffer.byteLength)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadFile(convertedFiles[index])}
                    className="shrink-0 rounded-md border border-accent-green/30 bg-accent-green/10 px-2 py-1 text-[10px] font-medium text-accent-green transition-colors hover:bg-accent-green/20"
                  >
                    Save
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
